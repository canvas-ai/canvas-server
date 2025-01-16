#!/bin/bash

# This script updates Docker containers for the Canvas Server.

# Set default values for environment variables
CANVAS_ROOT="${CANVAS_ROOT:-/opt/canvas-server}"
DOCKER_COMPOSE_FILE="${DOCKER_COMPOSE_FILE:-docker-compose.yml}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
LOG_FILE="${LOG_FILE:-/var/log/canvas-docker-update.log}"

# Function to display usage information
usage() {
    echo "Usage: $0 [-r canvas_root] [-f docker_compose_file] [-b target_branch] [-l log_file]"
    echo "  -r: Canvas root directory (default: /opt/canvas-server)"
    echo "  -f: Docker Compose file (default: docker-compose.yml)"
    echo "  -b: Target branch for git pull (default: main)"
    echo "  -l: Log file (default: /var/log/canvas-docker-update.log)"
    exit 1
}

# Parse command line options
while getopts "r:f:b:l:h" opt; do
    case $opt in
        r) CANVAS_ROOT="$OPTARG" ;;
        f) DOCKER_COMPOSE_FILE="$OPTARG" ;;
        b) TARGET_BRANCH="$OPTARG" ;;
        l) LOG_FILE="$OPTARG" ;;
        h) usage ;;
        \?) echo "Invalid option -$OPTARG" >&2; usage ;;
    esac
done

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to handle errors
handle_error() {
    local exit_code=$1
    local msg=$2
    log_message "Error: $msg"
    exit $exit_code
}

# Create log file if it doesn't exist
touch "$LOG_FILE"

log_message "Starting Docker containers update..."

# Check if Docker Compose file exists
if [ ! -f "$CANVAS_ROOT/$DOCKER_COMPOSE_FILE" ]; then
    handle_error 1 "Docker Compose file $CANVAS_ROOT/$DOCKER_COMPOSE_FILE does not exist."
fi

# Navigate to Canvas root directory
cd "$CANVAS_ROOT" || handle_error 1 "Failed to change directory to $CANVAS_ROOT"

# Pull latest changes from git
log_message "Pulling latest changes from git..."
if ! git fetch origin "$TARGET_BRANCH"; then
    handle_error 1 "Failed to fetch latest changes from git."
fi

if ! git reset --hard "origin/$TARGET_BRANCH"; then
    handle_error 1 "Failed to reset to latest changes from git."
fi

# Stop Docker containers
log_message "Stopping Docker containers..."
if ! docker-compose -f "$DOCKER_COMPOSE_FILE" down; then
    handle_error 1 "Failed to stop Docker containers."
fi

# Remove old Docker images
log_message "Removing old Docker images..."
if ! docker image prune -f; then
    handle_error 1 "Failed to remove old Docker images."
fi

# Build and start Docker containers
log_message "Building and starting Docker containers..."
if ! docker-compose -f "$DOCKER_COMPOSE_FILE" up --build -d; then
    handle_error 1 "Failed to build and start Docker containers."
fi

log_message "Docker containers updated successfully!"
