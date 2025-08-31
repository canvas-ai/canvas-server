#!/bin/bash

# Docker entrypoint to start the Canvas server

set -e

# Set admin user creation environment variables if not already set
export CANVAS_CREATE_ADMIN_USER=${CANVAS_CREATE_ADMIN_USER:-true}
export CANVAS_ADMIN_EMAIL=${CANVAS_ADMIN_EMAIL:-admin@canvas.local}
export CANVAS_ADMIN_PASSWORD=${CANVAS_ADMIN_PASSWORD:-$(openssl rand -base64 16)}

# Ensure required directories exist
mkdir -p /opt/canvas-server/server/config
mkdir -p /opt/canvas-server/server/db
mkdir -p /opt/canvas-server/server/users

# Print configuration
echo "Starting Canvas Server with configuration:"
echo "Admin email: $CANVAS_ADMIN_EMAIL"
echo "Admin password: $CANVAS_ADMIN_PASSWORD"
echo "Server mode: ${CANVAS_SERVER_MODE:-standalone}"
echo "API port: ${CANVAS_API_PORT:-8001}"
echo "Web port: ${CANVAS_WEB_PORT:-8001}"

# Change to the application directory
cd /opt/canvas-server || exit 1

# Start the server
exec npm run start "$@"
