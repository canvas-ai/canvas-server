#!/bin/bash

# Configuration
CANVAS_ROOT="${CANVAS_ROOT:-/opt/canvas-server}"
CANVAS_USER="${CANVAS_USER:-canvas}"
CANVAS_GROUP="${CANVAS_GROUP:-www-data}"
TARGET_BRANCH="${TARGET_BRANCH:-dev}"
LOG_FILE="${LOG_FILE:-/var/log/canvas-deploy.log}"
REQUIRED_NODE_VERSION="${REQUIRED_NODE_VERSION:-20}"

# Exit on any error
set -e

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check command existence
check_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        log_message "Error: $1 is not installed"
        exit 1
    fi
}

# Function to check Node.js version
check_node_version() {
    local current_version
    current_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$current_version" -lt $REQUIRED_NODE_VERSION ]; then
        log_message "Error: Node.js version must be >= $REQUIRED_NODE_VERSION. Current version: $current_version"
        exit 1
    fi
}

# Create log file if it doesn't exist
touch "$LOG_FILE"

log_message "Starting canvas-server update..."

# Check system requirements
log_message "Checking system requirements..."
check_command "git"
check_command "node"
check_command "pm2"
check_node_version

# Check if directory exists, if not clone the repository
if [ ! -d "$CANVAS_ROOT" ]; then
    log_message "Canvas-server directory not found at $CANVAS_ROOT. Please install canvas-server first."
    exit 1
else
    cd "$CANVAS_ROOT"
fi

# Stop the PM2 service
log_message "Stopping canvas-server service..."
#pm2 stop canvas-server || log_message "Service was not running"
systemctl stop canvas-server || log_message "Service was not running"

# Clean installation
log_message "Cleaning node_modules..."
rm -rf node_modules

# Pull latest changes
log_message "Pulling latest changes from git..."
if ! git fetch origin "$TARGET_BRANCH"; then
    log_message "Error: Failed to fetch latest changes from git."
    exit 1
fi

if ! git reset --hard "origin/$TARGET_BRANCH"; then
    log_message "Error: Failed to reset to latest changes from git."
    exit 1
fi

# Install dependencies
log_message "Installing dependencies..."
if ! npm install; then
    log_message "Error: Failed to install dependencies."
    exit 1
fi

# Permissions
log_message "Setting permissions..."
if ! chown -R "$CANVAS_USER:$CANVAS_GROUP" "$CANVAS_ROOT"; then
    log_message "Error: Failed to set permissions."
    exit 1
fi

# Start the application
log_message "Starting canvas-server..."
#pm2 start ecosystem.config.js --only canvas-server
if ! systemctl start canvas-server; then
    log_message "Error: Failed to start canvas-server."
    exit 1
fi

log_message "Update completed successfully!"
