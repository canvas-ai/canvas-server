# Canvas Server

Server component for the Canvas project

## ! Refactor in progress

**! Usually the main branch should have a working codebase**  
**! Use the dev branch to get a preview of what's planned**  
**! Update: merged (non-working)dev to main(with a userbase of 2 this is OK)**

`Universe -> |||| (bitmaps) -> embeddings -> Contexts -> LLM agents -> User`

## Installation

### Linux

```bash
$ git clone https://github.com/canvas-ai/canvas-server /path/to/canvas-server
$ cd /path/to/canvas-server/src
$ npm install # or yarn install
$ npm start # or npm run pm2:start
```

To automatically start canvas-server as a system (or user) service, please consult https://pm2.keymetrics.io/docs/usage/startup/

### Windows

```cmd
> git clone https://github.com/canvas-ai/canvas-server /path/to/canvas-server
> cd /path/to/canvas-server/src
> npm install
> npm start
```

### Docker

```bash
$ git clone https://github.com/canvas-ai/canvas-server /path/to/canvas-server
$ cd /path/to/canvas-server
$ docker-compose up --build
# or, to ensure you are running the latest and greatest
# $ docker-compose build --no-cache
# $ docker-compose up --force-recreate
# Cleanup
$ docker-compose down --rmi all

```

Supported ENV vars with their defaults

```bash
CANVAS_SERVER_CONFIG: ${CANVAS_SERVER_CONFIG:-./config}
CANVAS_SERVER_DATA: ${CANVAS_SERVER_DATA:-./data}
CANVAS_SERVER_VAR: ${CANVAS_SERVER_VAR:-./var}
CANVAS_USER_HOME: ${CANVAS_USER_HOME:-./user}
CANVAS_USER_CONFIG: ${CANVAS_USER_CONFIG:-./user/config}
CANVAS_USER_DATA: ${CANVAS_USER_DATA:-./user/data}
CANVAS_USER_CACHE: ${CANVAS_USER_CACHE:-./user/cache}
CANVAS_USER_WORKSPACES: ${CANVAS_USER_WORKSPACES:-./user/workspaces}
```

## Configuration

- Rename example-*.json to *.json and amend as needed
- Settings in CANVAS_USER_CONFIG/server/ override settings in CANVAS_SERVER_CONFIG
- To enable a seamless roaming/portable experience, make sure everything non-default is configured in your `CANVAS_USER_CONFIG` directory (defaults to **./user/config** in portable mode, **~/.canvas/config** || **Canvas/Config** otherwise)
- Modules (should) have some sensible defaults..

```bash
# To disable "portable" mode, create /path/to/canvas-server/user/.ignore
# or set the CANVAS_USER_CONFIG env variable (you can use .env in the projects src directory)
# Edit canvas-server configuration before starting the server
$ cd /path/to/canvas-server/config  # Or ~/.canvas/config/server
$ cp example-roles.json roles.json 
$ cp example-transports.json transports.json
# Or /path/to/canvas-server/config/example-*.json  ~/.canvas/config/server/*.json
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
- 

### Storage

- https://www.npmjs.com/package/cacache

### Roles

- https://www.npmjs.com/package/dockerode

### LLM Integration

- https://www.npmjs.com/package/llamaindex
- https://github.com/continuedev/continue

### Service discovery

- https://avahi.org/
- https://www.npmjs.com/package/mdns
