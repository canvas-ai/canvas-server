#!/bin/ash

# This script installs and sets up the Canvas Server on an Alpine Linux system.
# It installs Node.js 20, clones the Canvas Server repository, and sets up the service using pm2.

# Set default values for environment variables
CANVAS_ROOT="${CANVAS_ROOT:-/opt/canvas-server}"
CANVAS_USER="${CANVAS_USER:-canvas}"
CANVAS_GROUP="${CANVAS_GROUP:-www-data}"
CANVAS_REPO_URL="${CANVAS_REPO_URL:-https://github.com/canvas-ai/canvas-server.git}"
CANVAS_REPO_TARGET_BRANCH="${CANVAS_REPO_TARGET_BRANCH:-dev}"
NODEJS_VERSION="${NODEJS_VERSION:-20}" # Major version, e.g., 20
WEB_ADMIN_EMAIL="${WEB_ADMIN_EMAIL:-$(hostname)@cnvs.ai}"
WEB_FQDN="${WEB_FQDN:-my.cnvs.ai}"

# Function to display usage information
usage() {
    echo "Usage: $0 [-r canvas_root] [-u canvas_user] [-g canvas_group] [-b canvas_repo_branch] [-n nodejs_version] [-e web_admin_email] [-f web_fqdn]"
    echo "  -r: Canvas root directory (default: /opt/canvas-server)"
    echo "  -u: Canvas user (default: canvas)"
    echo "  -g: Canvas group (default: www-data)"
    echo "  -b: Canvas repository branch (default: dev)"
    echo "  -n: Node.js version (default: 20)"
    echo "  -e: Web admin email (default: $(hostname)@cnvs.ai)"
    echo "  -f: Web FQDN (default: my.cnvs.ai)"
    exit 1
}

# Parse command line options
while getopts "r:u:g:b:n:e:f:h" opt; do
    case $opt in
        r) CANVAS_ROOT="$OPTARG" ;;
        u) CANVAS_USER="$OPTARG" ;;
        g) CANVAS_GROUP="$OPTARG" ;;
        b) CANVAS_REPO_TARGET_BRANCH="$OPTARG" ;;
        n) NODEJS_VERSION="$OPTARG" ;;
        e) WEB_ADMIN_EMAIL="$OPTARG" ;;
        f) WEB_FQDN="$OPTARG" ;;
        h) usage ;;
        ?) echo "Invalid option -$OPTARG" >&2; usage ;;
    esac
done

# Ensure script is run as root
if [ "$(id -u)" -ne 0 ]; then
    echo "Please run this script as root"
    exit 1
fi

# Ensure system is Alpine Linux
if ! grep -q -i 'NAME="Alpine Linux"' /etc/os-release; then
    echo "This script is intended for Alpine Linux systems only"
    exit 1
fi

# Function to handle errors
handle_error() {
    local exit_code=$1
    local msg=$2
    echo "Error: $msg"
    exit "$exit_code"
}

# Function to install Node.js 20
setup_nodejs() {
    echo "Setting up Node.js version $NODEJS_VERSION..."

    # Check if Node.js of the correct major version and npm are already installed
    if command -v node >/dev/null && node --version | grep -q "^v$NODEJS_VERSION" && command -v npm >/dev/null; then
        echo "Node.js version $NODEJS_VERSION (or compatible) and npm are already installed."
        echo "Node version: $(node --version), npm version: $(npm --version)"
        echo "Skipping Node.js installation."
        return 0
    fi

    echo "Installing Node.js $NODEJS_VERSION and npm..."

    # Install Node.js 20 and npm
    if ! apk add --no-cache nodejs npm; then
        handle_error "$?" "Failed to install Node.js and npm"
    fi

    # Verify installation
    if ! command -v node >/dev/null; then
        handle_error "1" "Node.js command 'node' not found after installation"
    fi

    current_node_version=$(node --version 2>/dev/null)
    echo "Installed Node.js version: $current_node_version"

    # Check if the major version matches
    if ! echo "$current_node_version" | grep -q "^v$NODEJS_VERSION"; then
        echo "Warning: Installed Node.js major version ($current_node_version) does not match the requested v$NODEJS_VERSION."
        echo "This may cause compatibility issues with Canvas Server."
    fi

    if ! command -v npm >/dev/null; then
        handle_error "1" "npm command not found after installation"
    fi

    echo "npm version: $(npm --version)"
    echo "Node.js setup complete."
}

# Function to setup PM2 to auto-start with OpenRC
setup_pm2_autostart() {
    echo "Setting up PM2 to auto-start on boot for user $CANVAS_USER..."
    local service_name="pm2-$CANVAS_USER"
    local init_script_path="/etc/init.d/$service_name"

    echo "Executing PM2 startup command: $PM2_CMD startup openrc -u \"$CANVAS_USER\" --hp \"$CANVAS_ROOT\""

    if ! "$PM2_CMD" startup openrc -u "$CANVAS_USER" --hp "$CANVAS_ROOT"; then
        echo "Warning: PM2 startup command finished with a non-zero exit code."
        echo "Proceeding to check if the script was generated anyway."
    fi

    # Verify init script creation
    if [ ! -f "$init_script_path" ]; then
        handle_error "1" "OpenRC init script '$init_script_path' was NOT found after 'pm2 startup'"
    fi

    echo "OpenRC init script '$init_script_path' found."

    # Ensure it's executable
    if [ ! -x "$init_script_path" ]; then
        echo "Making init script executable..."
        chmod +x "$init_script_path" || echo "Warning: Failed to chmod +x $init_script_path"
    fi

    echo "Adding service '$service_name' to default runlevel..."
    if ! rc-update add "$service_name" default; then
        if ! rc-update show default | grep -q "$service_name"; then
             handle_error "1" "Failed to add '$service_name' to default runlevel"
        fi
    fi

    echo "Saving current PM2 process list for '$CANVAS_USER'..."
    if su -s /bin/ash "$CANVAS_USER" -c "$PM2_CMD jlist" | grep -q '"name":"canvas-server"'; then
        if ! su -s /bin/ash "$CANVAS_USER" -c "$PM2_CMD save"; then
            echo "Warning: PM2 save failed. Processes might not resurrect correctly."
        fi
    else
        echo "Warning: 'canvas-server' process not found under PM2 for user '$CANVAS_USER'"
    fi

    echo "Starting OpenRC service '$service_name'..."
    if ! rc-service "$service_name" start; then
        if ! rc-service "$service_name" status | grep -E -q '(status: started|is running)'; then
             echo "ERROR: Failed to start '$service_name' via rc-service"
        fi
    fi

    echo "Final status of '$service_name':"
    rc-service "$service_name" status || echo "Could not get status for $service_name"
}

# Function to update Canvas Server
update_canvas() {
    echo "Updating Canvas Server in $CANVAS_ROOT..."
    cd "$CANVAS_ROOT" || handle_error "$?" "Failed to change directory to $CANVAS_ROOT"

    echo "Stopping Canvas Server with PM2 (if running)..."
    su -s /bin/ash "$CANVAS_USER" -c "$PM2_CMD stop canvas-server || true"
    su -s /bin/ash "$CANVAS_USER" -c "$PM2_CMD delete canvas-server || true"

    if [ -d node_modules ]; then
        echo "Removing old node_modules..."
        rm -rf node_modules
    fi

    echo "Pulling latest changes from git (branch: $CANVAS_REPO_TARGET_BRANCH)..."
    if ! git pull origin "$CANVAS_REPO_TARGET_BRANCH"; then
        handle_error "$?" "Failed to pull latest changes from git"
    fi

    echo "Updating git submodules as $CANVAS_USER..."
    if ! su -s /bin/ash "$CANVAS_USER" -c "cd \\"$CANVAS_ROOT\\" && npm run update-submodules"; then
        handle_error "$?" "Failed to update git submodules via npm"
    fi

    echo "Installing dependencies as $CANVAS_USER..."
    if ! su -s /bin/ash "$CANVAS_USER" -c "cd "$CANVAS_ROOT" && npm install"; then
        handle_error "$?" "Failed to install dependencies via npm"
    fi

    echo "Building UI components as $CANVAS_USER..."
    if ! su -s /bin/ash "$CANVAS_USER" -c "cd "$CANVAS_ROOT" && npm run build"; then
        handle_error "$?" "Failed to build UI components"
    fi

    echo "Setting permissions for $CANVAS_ROOT..."
    if ! chown -R "$CANVAS_USER":"$CANVAS_GROUP" "$CANVAS_ROOT"; then
        handle_error "$?" "Failed to set permissions on $CANVAS_ROOT"
    fi

    echo "Starting updated Canvas Server with PM2 as $CANVAS_USER..."
    if ! su -s /bin/ash "$CANVAS_USER" -c "cd \"$CANVAS_ROOT\" && NODE_ENV=production $PM2_CMD start npm --name canvas-server -- run start"; then
        handle_error "$?" "Failed to start Canvas Server with $PM2_CMD"
    fi
    su -s /bin/ash "$CANVAS_USER" -c "$PM2_CMD save" || echo "Warning: PM2 save failed during update."

    echo "Canvas Server updated and started."
}

# Function to install Canvas Server
install_canvas() {
    echo "Installing Canvas Server to $CANVAS_ROOT..."
    if ! git clone --branch "$CANVAS_REPO_TARGET_BRANCH" "$CANVAS_REPO_URL" "$CANVAS_ROOT"; then
        handle_error "$?" "Failed to clone Canvas Server repository"
    fi

    cd "$CANVAS_ROOT" || handle_error "$?" "Failed to change directory to $CANVAS_ROOT"

    echo "Setting initial permissions for $CANVAS_ROOT..."
    if ! chown -R "$CANVAS_USER":"$CANVAS_GROUP" "$CANVAS_ROOT"; then
        handle_error "$?" "Failed to set permissions on $CANVAS_ROOT after clone"
    fi

    echo "Updating git submodules as $CANVAS_USER..."
    if ! su -s /bin/ash "$CANVAS_USER" -c "cd \\"$CANVAS_ROOT\\" && npm run update-submodules"; then
        handle_error "$?" "Failed to update git submodules via npm"
    fi

    echo "Installing dependencies as $CANVAS_USER..."
    if ! su -s /bin/ash "$CANVAS_USER" -c "cd "$CANVAS_ROOT" && npm install"; then
        handle_error "$?" "Failed to install dependencies via npm"
    fi

    echo "Building UI components as $CANVAS_USER..."
    if ! su -s /bin/ash "$CANVAS_USER" -c "cd "$CANVAS_ROOT" && npm run build"; then
        handle_error "$?" "Failed to build UI components"
    fi

    echo "Starting Canvas Server with PM2 as $CANVAS_USER..."
    if ! su -s /bin/ash "$CANVAS_USER" -c "cd \"$CANVAS_ROOT\" && NODE_ENV=production $PM2_CMD start npm --name canvas-server -- run start"; then
        handle_error "$?" "Failed to start Canvas Server with $PM2_CMD"
    fi
    su -s /bin/ash "$CANVAS_USER" -c "$PM2_CMD save" || echo "Warning: PM2 save failed during initial install."

    echo "Canvas Server installed and started."
}

# Main script execution starts here

# Ensure system is up-to-date
echo "Updating Alpine package list and upgrading existing packages..."
if ! apk update && apk upgrade; then
    handle_error "$?" "Failed to update and upgrade Alpine packages"
fi

# Install system utilities
echo "Installing system utilities (git, curl, wget, build-base, nano, etc.)..."
if ! apk add --no-cache git curl wget build-base nano ca-certificates openssh socat whois ufw bind-tools; then
    handle_error "$?" "Failed to install system utilities"
fi

# Install Node.js 20
setup_nodejs

# Install pm2 globally
echo "Installing pm2 globally via npm..."
NPM_GLOBAL_BIN_DIR=$(npm bin -g 2>/dev/null)

PM2_CMD=""

# Check if pm2 is already installed and in path
if command -v pm2 >/dev/null; then
    echo "pm2 is already installed and found in PATH."
    PM2_CMD=$(command -v pm2)
else
    echo "pm2 not found in PATH, attempting to install globally..."
    if ! npm install -g pm2; then
        handle_error "$?" "Failed to install pm2 globally"
    fi

    # Try to find pm2 again after installation
    if command -v pm2 >/dev/null; then
        echo "pm2 successfully installed and found in PATH."
        PM2_CMD=$(command -v pm2)
    elif [ -n "$NPM_GLOBAL_BIN_DIR" ] && [ -x "${NPM_GLOBAL_BIN_DIR}/pm2" ]; then
        echo "pm2 installed but not in standard PATH. Using explicit path: ${NPM_GLOBAL_BIN_DIR}/pm2"
        PM2_CMD="${NPM_GLOBAL_BIN_DIR}/pm2"
    elif [ -x "/usr/bin/pm2" ]; then
         echo "Found pm2 at /usr/bin/pm2 after checking common paths."
         PM2_CMD="/usr/bin/pm2"
    elif [ -x "/usr/local/bin/pm2" ]; then
         echo "Found pm2 at /usr/local/bin/pm2 after checking common paths."
         PM2_CMD="/usr/local/bin/pm2"
    else
        handle_error "1" "pm2 command not found even after attempting global installation"
    fi
fi

# Verify PM2_CMD
if [ -z "$PM2_CMD" ]; then
    handle_error "1" "PM2 command path could not be determined."
elif ! "$PM2_CMD" -v >/dev/null 2>&1; then
    handle_error "1" "PM2 command ($PM2_CMD) determined but is not functioning correctly"
fi
echo "Using PM2 command: $PM2_CMD"

# Create service group
echo "Creating service group $CANVAS_GROUP (if it doesn't exist)..."
if ! getent group "$CANVAS_GROUP" > /dev/null 2>&1; then
    if ! addgroup -S "$CANVAS_GROUP"; then
        handle_error "$?" "Failed to create service group $CANVAS_GROUP"
    fi
else
    echo "Group $CANVAS_GROUP already exists."
fi

# Create service user
echo "Creating service user $CANVAS_USER (if it doesn't exist)..."
if ! id "$CANVAS_USER" > /dev/null 2>&1; then
    if ! adduser -S -D -s /sbin/nologin -G "$CANVAS_GROUP" -h "$CANVAS_ROOT" "$CANVAS_USER"; then
        handle_error "$?" "Failed to create service user $CANVAS_USER"
    fi
else
    echo "User $CANVAS_USER already exists."
fi

# Add canvas-server path to git config
echo "Adding $CANVAS_ROOT to git safe.directory..."
if ! git config --global --add safe.directory "$CANVAS_ROOT"; then
    echo "Warning: Failed to add $CANVAS_ROOT to global git safe.directory."
    echo "You can try: mkdir -p /root && git config --global --add safe.directory $CANVAS_ROOT"
fi

# Install or update Canvas Server
if [ ! -d "$CANVAS_ROOT/.git" ]; then
    install_canvas
else
    echo "Existing Canvas Server installation found in $CANVAS_ROOT. Attempting update..."
    update_canvas
fi

# Setup PM2 to auto-start on boot
setup_pm2_autostart

echo "Canvas Server installation/update process finished."
echo "You can check the status with: su -s /bin/ash $CANVAS_USER -c \"$PM2_CMD list\""
echo "And logs with: su -s /bin/ash $CANVAS_USER -c \"$PM2_CMD logs canvas-server\""
echo ""
echo "Canvas Server should be accessible on:"
echo "  - API: http://localhost:8001"
echo "  - Web UI: http://localhost:8002"

exit 0
