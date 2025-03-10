# Canvas CLI

A command-line interface for interacting with the Canvas server.

## Installation

The CLI is included with the Canvas server. You can run it using npm scripts:

```bash
npm run canvas
npm run ws
npm run context
```

Or you can use the bin scripts directly:

```bash
./bin/canvas
./bin/ws
./bin/context
```

You can also install the package globally to make the commands available system-wide:

```bash
npm install -g
```

After global installation, you can use the commands from anywhere:

```bash
canvas
ws
context
```

Alternatively, you can create symlinks to make the commands available globally:

```bash
# From the canvas-server directory
sudo ln -s $(pwd)/bin/canvas /usr/local/bin/canvas
sudo ln -s $(pwd)/bin/ws /usr/local/bin/ws
sudo ln -s $(pwd)/bin/context /usr/local/bin/context
```

## Configuration

The CLI stores its configuration in:
- Linux: `$HOME/.canvas/config/cli.json`
- macOS: `$HOME/.canvas/config/cli.json`
- Windows: `%USERPROFILE%\Canvas\config\cli.json`

You can configure the server URL and authentication token using:

```bash
canvas config set server.url http://localhost:8001/rest/v2
canvas config set auth.token your-auth-token
```

## Authentication

The CLI will automatically prompt for authentication if no token is found in the configuration. You can also explicitly authenticate using:

```bash
canvas login
```

This will start a three-step authentication process:
1. Login with your email and password to create a session
2. Use the session to generate a long-lived API token
3. Store the token in your configuration and logout the session

The API token will be used for all subsequent CLI commands, eliminating the need to login each time.

If you already have a token, you can set it directly:

```bash
canvas login YOUR_TOKEN
```

Or configure it using the config command:

```bash
canvas config set auth.token YOUR_TOKEN
```

### Troubleshooting Authentication

If you encounter authentication issues:

1. Ensure the server is running and accessible
2. Check your credentials are correct
3. Try running with debug enabled: `DEBUG=canvas:* ./bin/canvas login`
4. If you have a token from another source, use it directly with `canvas login YOUR_TOKEN`

## Commands

### Canvas

The main CLI for managing the Canvas server, users, and roles.

```bash
# Show server status
canvas status

# Authenticate with the Canvas server
canvas login

# Check server connection
canvas ping

# List all users
canvas users

# List all roles
canvas roles

# Show current configuration
canvas config

# Set configuration value
canvas config set <key> <value>
```

### Workspaces

Manage user workspaces.

```bash
# List all workspaces
ws list

# Create a new workspace
ws create <name> [--description <desc>] [--color <color>] [--type <type>]

# Get workspace details
ws get <id>

# Update workspace properties
ws update <id> [--name <name>] [--description <desc>] [--color <color>] [--type <type>]

# Open a workspace
ws open <id>

# Close a workspace
ws close <id>

# Remove a workspace
ws remove <id>
```

### Contexts

Manage user contexts.

```bash
# List all contexts
context list

# Set the context URL
context set <url>

# Switch to a different context
context switch <id>

# Show current context URL
context url

# Show current context ID
context id

# Show current context path
context path

# Show context bitmaps
context bitmaps

# List all documents in the context
context documents [-f <feature>]

# List all notes in the context
context notes

# Get a specific note
context note get <id/hash>

# Add a new note
context note add <content> [--title <title>] [-t <tag>]

# Add a new tab
context tab add <url> [--title <title>] [--context <context>] [-t <tag>]

# List all tabs in the context
context tab list
```

## Piping Data

You can pipe data to the CLI for adding notes:

```bash
cat /var/log/syslog | grep -i err | grep nvidia | grep 202503 | context note add --title "nvidia errors"
```

## Examples

```bash
# Create a new workspace
ws create "My Workspace" --description "My personal workspace" --color "#ff5500"

# Set the context URL to a specific workspace
context set my-workspace://work/project1

# Add a note with tags
context note add "This is a note" --title "My Note" -t important -t work

# Add a tab to a specific context
context tab add https://example.com --title "Example Website" --context "/different/context/url"
``` 
