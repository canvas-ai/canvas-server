#!/bin/bash

# Configuration
APP_PATH="/opt/canvas-server"
TARGET_BRANCH="dev"
LOG_FILE="/var/log/canvas-deploy.log"
REQUIRED_NODE_VERSION=20

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

log_message "Starting canvas-server deployment..."

# Check system requirements
log_message "Checking system requirements..."
check_command "git"
check_command "node"
check_command "yarn"
check_command "pm2"
check_node_version

# Check if directory exists, if not clone the repository
if [ ! -d "$APP_PATH" ]; then
    log_message "Application directory not found. Performing initial clone..."
    exit 1
else
    cd "$APP_PATH"
fi

# Stop the PM2 service
log_message "Stopping PM2 service..."
pm2 stop canvas-server || log_message "Service was not running"

# Clean installation
log_message "Cleaning node_modules..."
rm -rf node_modules

# Pull latest changes
log_message "Pulling latest changes from git..."
git fetch origin "$TARGET_BRANCH"
git reset --hard "origin/$TARGET_BRANCH"

# Install dependencies
log_message "Installing dependencies..."
yarn install

# Start the application
log_message "Starting the application..."
pm2 start ecosystem.config.js --only canvas-server

log_message "Deployment completed successfully!"
