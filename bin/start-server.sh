#!/bin/bash

# docker entrypoint to start the server with arguments

# Set admin user creation environment variables
export CANVAS_CREATE_ADMIN_USER=true
export CANVAS_ADMIN_EMAIL=${CANVAS_ADMIN_EMAIL:-my@canvas.local}
export CANVAS_ADMIN_PASSWORD=${CANVAS_ADMIN_PASSWORD:-$(openssl rand -base64 16)}

# Print configuration
echo "Starting Canvas Server with admin user creation enabled"
echo "Admin email: $CANVAS_ADMIN_EMAIL"
echo "Admin password: $CANVAS_ADMIN_PASSWORD"

# Start the server
cd "$(dirname "$0")/.." || exit 1
npm run start "$@"
