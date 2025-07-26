# Canvas Server

Server runtime for the Canvas project

## ! Refactor in progress

**! Use the dev branch for now**  

**On every iteration(refactor) of this project, I actually loose(as in - BREAK -) functionality!**  
We already had tab management implemented(great showcase for the bitmap-based context tree index), with named sessions and working browser extensions. I decided to **slightly** refactor the context? or workspace manager? don't even remember(git history would show) - 6 months later we still have no working runtime and using AI actually makes things worse!  
(as we are now in an attention-based economy(creds for coining the term _for me_ to @TechLead, I'll rant about it in some "coding-canvas" live stream session @idnc.streams soon))

Sooo

New approach: **"Do The Simplest Thing That Could Possibly Work(tm)"**  

- No federation support
- No remote workspaces*
- Contexts bound to the canvas-server instance

Sorry Universe for the delay..

## Installation

## Run canvas-server locally

```bash
$ git clone https://github.com/canvas-ai/canvas-server /path/to/canvas-server
$ cd /path/to/canvas-server
$ npm run update-submodules
$ npm install
$ npm run dev # or
$ npm run start
```

## Docker

```bash
$ git clone https://github.com/canvas-ai/canvas-server /path/to/canvas-server
$ cd /path/to/canvas-server
$ CANVAS_SERVER_HOME=~/.canvas docker-compose up --build
# or, to ensure you are running the latest and greatest
# $ docker-compose build --no-cache
# $ docker-compose up --force-recreate
# Cleanup
$ docker-compose down --rmi all
```

Supported ENV vars with their defaults:

```bash
# Runtime variables (user | standalone)
CANVAS_SERVER_MODE: ${CANVAS_SERVER_MODE:-"standalone"} 

# Canvas server dirs
NODE_ENV: ${NODE_ENV:-development}
CANVAS_SERVER_HOME: ${CANVAS_SERVER_HOME:-/opt/canvas-server/server}
CANVAS_USER_HOME: ${CANVAS_USER_HOME:-/opt/canvas-server/users}
CANVAS_ADMIN_EMAIL: ${CANVAS_ADMIN_EMAIL:-admin@canvas.local}
CANVAS_ADMIN_PASSWORD: ${CANVAS_ADMIN_PASSWORD:-$(openssl rand -base64 16)}
CANVAS_ADMIN_RESET: ${CANVAS_ADMIN_RESET:-false}
CANVAS_DISABLE_API: ${CANVAS_DISABLE_API:-false}
CANVAS_API_PORT: ${CANVAS_API_PORT:-8001}
CANVAS_API_HOST: ${CANVAS_API_HOST:-0.0.0.0}
CANVAS_JWT_SECRET: ${CANVAS_JWT_SECRET:-$(openssl rand -base64 16)}
CANVAS_JWT_TOKEN_EXPIRY: ${CANVAS_JWT_TOKEN_EXPIRY:-7d}

# Canvas USER dirs for single-user mode
# See env.js for more info

```

## Configuration

- Rename example-*.json to *.json and amend as needed
- Configuration files can be split into multiple files adhering to the original JSON structure
  - config/data.json maybe be split into config/data.backends.json, config/data.sources.json etc

### Initial Admin User Creation

When the Canvas server starts for the first time, it can automatically create an initial admin user if no users exist in the database. This is controlled by environment variables:

1. Set `CANVAS_ADMIN_EMAIL` to the desired admin email (defaults to 'admin@canvas.local')
2. Set `CANVAS_ADMIN_PASSWORD` to the desired admin password (required if admin creation is enabled)

Example:

```bash
# In .env file or environment variables
CANVAS_ADMIN_EMAIL=your-email@example.com
CANVAS_ADMIN_PASSWORD=securepassword
CANVAS_ADMIN_RESET=false # Reset admin pass
```

## Update Canvas Server

```bash
$ cd /path/to/canvas-server
# Stop the canvas server
$ npm run stop # or npm run pm2:stop
$ rm -rf ./node_modules # Ensure we have a clean slate
# Fetch the latest version of canvas-server from Github
$ git pull origin main # or dev if you are feeling adventurous
$ npm run update-submodules
$ npm install
$ npm start # or npm run pm2:start
```

## Make Canvas Server WebUI available remotely

```bash
# Copy the .env.example file
$ cp /path/to/canvas-server/src/ui/.env.example /path/to/canvas-server/src/ui/.env
# Edit as needed, for a local setup you'd want to use your machines hostname or FQDN(if resolvable) or its local IP
# Rebuild the web ui
$ npm run build
# Restart the server
```

## Scripts

`build-portable-image.sh`: Builds a Docker image for the Canvas Server with a portable configuration.
`install-ubuntu.sh`: Installs and sets up the Canvas Server on an Ubuntu system. It installs Node.js, clones the Canvas Server repository, and sets up the service.
`update-git.sh`: Script updates the Canvas Server by pulling the latest changes from the git repository and restarting the service.
`update-submodules.sh`: Pushes git submodule changes to a remote git repository

## Authentication

Canvas Server supports two types of authentication:

1. **JWT Token Authentication**: Used for web UI login and normal user sessions, see 
2. **[API Token Authentication](docs/api-token-auth.md)**: Used for programmatic access (CLI, Electron, browser extensions, curl-based scripts)

## References

### API Documentation

- [Canvas Server API Reference](docs/API.md) - Complete REST API and WebSocket documentation

### DB / Index

- https://www.npmjs.com/package/lmdb
- https://www.npmjs.com/package/roaring

### Storage

- https://www.npmjs.com/package/cacache

### Roles

- https://www.npmjs.com/package/dockerode

### LLM Integration

- https://www.npmjs.com/package/llamaindex

### Service discovery

- https://avahi.org/
- https://www.npmjs.com/package/mdns
