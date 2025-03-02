#!/bin/bash

# Start Canvas Server with admin user creation enabled
# This script sets the necessary environment variables and starts the server

# Set admin user creation environment variables
export CANVAS_CREATE_ADMIN_USER=true
export CANVAS_ADMIN_EMAIL=${CANVAS_ADMIN_EMAIL:-admin@canvas.local}
export CANVAS_ADMIN_PASSWORD=${CANVAS_ADMIN_PASSWORD:-admin123}

# Print configuration
echo "Starting Canvas Server with admin user creation enabled"
echo "Admin email: $CANVAS_ADMIN_EMAIL"
echo "Admin password: ${CANVAS_ADMIN_PASSWORD//?/*}" # Mask password for security

# Start the server
cd "$(dirname "$0")/.." || exit 1
npm run start
