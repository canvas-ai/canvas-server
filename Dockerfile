# Official Node.js 20.x image as base
FROM node:20-slim

# Working directory
WORKDIR /opt

# Install basic dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Clone the repository
RUN git clone --branch dev https://github.com/canvas-ai/canvas-server.git canvas-server

# Switch workdir
WORKDIR /opt/canvas-server

# Create necessary directories
RUN mkdir -p \
    server/config \
    server/cache \
    server/db \
    server/var \
    server/roles \
    server/data \
    server/multiverse

# Update submodules
RUN npm run update-submodules

# Install application dependencies
RUN npm install

# Run database migrations
RUN npm run db:setup

# Expose canvas-server ports
EXPOSE 8000 8001 8002

# Start the server
ENTRYPOINT ["/opt/canvas-server/bin/start-server.sh"]

# Default command (can be overridden)
CMD ["npm", "run", "start"]

