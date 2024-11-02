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
