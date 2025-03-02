# Canvas Server

Server component for the Canvas project

## ! Refactor in progress

**! Use the dev branch for now**

## Installation

## Run canvas-server locally

```bash
$ git clone https://github.com/canvas-ai/canvas-server /path/to/canvas-server
$ cd /path/to/canvas-server
$ npm install # or yarn install
$ npm run db:setup # or yarn db:setup
$ npm run start # or yarn start
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
CANVAS_SERVER_HOME: ${CANVAS_SERVER_HOME:-/opt/canvas-server/server}
CANVAS_SERVER_CONFIG: ${CANVAS_SERVER_CONFIG:-/opt/canvas-server/server/config}
CANVAS_SERVER_CACHE: ${CANVAS_SERVER_CACHE:-/opt/canvas-server/server/cache}
CANVAS_SERVER_DB: ${CANVAS_SERVER_DB:-/opt/canvas-server/server/db}
CANVAS_SERVER_VAR: ${CANVAS_SERVER_VAR:-/opt/canvas-server/server/var}
CANVAS_SERVER_ROLES: ${CANVAS_SERVER_ROLES:-/opt/canvas-server/server/roles}
CANVAS_SERVER_DATA: ${CANVAS_SERVER_DATA:-/opt/canvas-server/data}
```

## Configuration

- Rename example-*.json to *.json and amend as needed
- Configuration files can be split into multiple files adhering to the original JSON structure
  - config/data.json maybe be split into config/data.backends.json, config/data.sources.json etc

### Initial Admin User Creation

When the Canvas server starts for the first time, it can automatically create an initial admin user if no users exist in the database. This is controlled by environment variables:

1. Set `CANVAS_CREATE_ADMIN_USER=true` to enable initial admin user creation
2. Set `CANVAS_ADMIN_EMAIL` to the desired admin email (defaults to 'admin@canvas.local')
3. Set `CANVAS_ADMIN_PASSWORD` to the desired admin password (required if admin creation is enabled)

Example:
```bash
# In .env file or environment variables
CANVAS_CREATE_ADMIN_USER=true
CANVAS_ADMIN_EMAIL=admin@example.com
CANVAS_ADMIN_PASSWORD=securepassword
```

## Update Canvas Server

```bash
$ cd /path/to/canvas-server
# Stop the canvas server
$ npm run stop # or npm run pm2:stop
$ rm -rf ./node_modules # Ensure we have a clean slate
# Fetch the latest version of canvas-server from Github
$ git pull origin main # or dev if you are feeling adventurous
$ npm install
$ npm start # or npm run pm2:start
```

## Scripts

### build-portable-image.sh

This script builds a Docker image for the Canvas Server with a portable configuration.

#### Usage

```bash
$ ./scripts/build-portable-image.sh [-n image_name] [-t image_tag] [-f dockerfile] [-c config_dir]
```

#### Options

- `-n`: Image name (default: canvas-server)
- `-t`: Image tag (default: portable)
- `-f`: Dockerfile to use (default: Dockerfile)
- `-c`: Config directory to copy (default: ./config)

### install-docker.sh

This script installs Docker and Docker Compose on an Ubuntu system. It checks if Docker and Docker Compose are already installed, and if not, installs them.

#### Usage

```bash
$ ./scripts/install-docker.sh
```

### install-ubuntu.sh

This script installs and sets up the Canvas Server on an Ubuntu system. It installs Node.js, clones the Canvas Server repository, and sets up the service.

#### Usage

```bash
$ ./scripts/install-ubuntu.sh [-r canvas_root] [-u canvas_user] [-g canvas_group] [-b canvas_repo_branch] [-n nodejs_version] [-e web_admin_email] [-f web_fqdn]
```

#### Options

- `-r`: Canvas root directory (default: /opt/canvas-server)
- `-u`: Canvas user (default: canvas)
- `-g`: Canvas group (default: www-data)
- `-b`: Canvas repository branch (default: dev)
- `-n`: Node.js version (default: 20)
- `-e`: Web admin email (default: $(hostname)@cnvs.ai)
- `-f`: Web FQDN (default: my.cnvs.ai)

### update-docker.sh

This script updates Docker containers for the Canvas Server.

#### Usage

```bash
$ ./scripts/update-docker.sh [-r canvas_root] [-f docker_compose_file] [-b target_branch] [-l log_file]
```

#### Options

- `-r`: Canvas root directory (default: /opt/canvas-server)
- `-f`: Docker Compose file (default: docker-compose.yml)
- `-b`: Target branch for git pull (default: main)
- `-l`: Log file (default: /var/log/canvas-docker-update.log)

### update-git.sh

This script updates the Canvas Server by pulling the latest changes from the git repository and restarting the service.

#### Usage

```bash
$ ./scripts/update-git.sh
```

## References

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
