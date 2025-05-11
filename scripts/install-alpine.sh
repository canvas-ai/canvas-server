#!/bin/ash

# TODO: Fixme
# - Add support for different Node.js versions

# This script installs and sets up the Canvas Server on an Alpine Linux system.
# It installs Node.js, clones the Canvas Server repository, and sets up the service using pm2.

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

# Function to install Node.js
setup_nodejs() {
    echo "Setting up Node.js version $NODEJS_VERSION..."
    local target_package_with_npm="nodejs${NODEJS_VERSION}-npm" # e.g., nodejs20-npm
    local target_package_base="nodejs${NODEJS_VERSION}"     # e.g., nodejs20

    # Check if Node.js of the correct major version and npm are already installed
    if command -v node >/dev/null && node --version | grep -q "^v$NODEJS_VERSION" && command -v npm >/dev/null; then
        echo "Node.js version $NODEJS_VERSION (or compatible) and npm are already installed."
        echo "Node version: $(node --version), npm version: $(npm --version)"
        echo "Skipping Node.js installation."
        return 0
    fi

    echo "Attempting to install Node.js and npm for version $NODEJS_VERSION..."

    # Primary attempt: using the combined package like nodejs20-npm
    echo "Trying to install package: ${target_package_with_npm}"
    #if apk add --no-cache "${target_package_with_npm}"; then
    if apk add --no-cache nodejs npm; then
        echo "Successfully installed ${target_package_with_npm}."
    else
        echo "Failed to install ${target_package_with_npm}."
        echo "Fallback: Attempting to install ${target_package_base} and npm separately..."
        if apk add --no-cache "${target_package_base}" npm; then
            echo "Successfully installed ${target_package_base} and npm."
        else
            echo "Further fallback: Attempting to install 'nodejs' (Alpine's default/current LTS for this release) and 'npm'."
            # 'nodejs' on Alpine 3.20 community is v20.x, which matches the user's desired major version.
            if apk add --no-cache nodejs npm; then
                echo "Successfully installed 'nodejs' and 'npm'."
            else
                handle_error "$?" "Failed to install Node.js version $NODEJS_VERSION using available methods (tried ${target_package_with_npm}, ${target_package_base}+npm, nodejs+npm)."
            fi
        fi
    fi

    # Verify installation
    if ! command -v node >/dev/null; then
        handle_error "1" "Node.js command 'node' not found after installation attempt."
    fi
    current_node_version=$(node --version 2>/dev/null)
    echo "Installed Node.js version: $current_node_version"

    # Check if the major version matches.
    if ! echo "$current_node_version" | grep -q "^v$NODEJS_VERSION"; then
        echo "Warning: Installed Node.js major version ($current_node_version) does not strictly match the requested v$NODEJS_VERSION."
        echo "This can occur if a fallback installation method was used or if Alpine's 'nodejs' package points to a different major version than expected."
        echo "Please verify if this version is acceptable for your needs."
    fi

    if ! command -v npm >/dev/null; then
        handle_error "1" "npm command not found after installation attempt. This is unexpected if Node.js installed correctly."
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
    # This command, when run as root, should create the init script and attempt to enable it.
    if ! "$PM2_CMD" startup openrc -u "$CANVAS_USER" --hp "$CANVAS_ROOT"; then
        echo "Warning: PM2 startup command finished with a non-zero exit code."
        echo "Proceeding to check if the script was generated anyway, as pm2 might still output instructions or partially succeed."
    else
        echo "PM2 startup command executed."
    fi

    # Verify init script creation
    if [ ! -f "$init_script_path" ]; then
        handle_error "1" "ERROR: OpenRC init script '$init_script_path' was NOT found after 'pm2 startup'. PM2 failed to create it. Cannot configure autostart."
    else
        echo "OpenRC init script '$init_script_path' found."
        # Ensure it's executable (pm2 should do this, but verify)
        if [ ! -x "$init_script_path" ]; then
            echo "Warning: Init script $init_script_path is not executable. Attempting to chmod +x."
            chmod +x "$init_script_path" || echo "Warning: Failed to chmod +x $init_script_path."
        fi
    fi

    echo "Ensuring OpenRC service '$service_name' is added to default runlevel..."
    if ! rc-update add "$service_name" default; then
        echo "Warning/Info: 'rc-update add $service_name default' reported an issue. Checking if already added..."
        if ! rc-update show default | grep -q "$service_name"; then
             handle_error "1" "Failed to add '$service_name' to default runlevel and it's not listed after 'pm2 startup' claimed to set it up."
        else
            echo "'$service_name' is confirmed in default runlevel."
        fi
    else
        echo "Service '$service_name' successfully added/confirmed in default runlevel."
    fi

    echo "Saving current PM2 process list for '$CANVAS_USER'..."
    # Ensure the canvas-server process is actually running and managed by PM2 for the user before saving.
    if su -s /bin/ash "$CANVAS_USER" -c "$PM2_CMD jlist" | grep -q '"name":"canvas-server"'; then
        if ! su -s /bin/ash "$CANVAS_USER" -c "$PM2_CMD save"; then
            echo "Warning: '$PM2_CMD save' as '$CANVAS_USER' failed. Processes might not resurrect correctly."
        else
            echo "PM2 process list saved for '$CANVAS_USER'."
        fi
    else
        echo "Warning: 'canvas-server' process not found under PM2 for user '$CANVAS_USER' before 'pm2 save'."
        echo "This means it might not autostart correctly. Ensure 'canvas-server' is started by PM2 via install_canvas or update_canvas."
    fi

    echo "Attempting to start the OpenRC service '$service_name'..."
    if ! rc-service "$service_name" start; then
        echo "Warning: 'rc-service $service_name start' reported an issue. Checking current status..."
        # Check status more reliably; grep for positive indication of running.
        if ! rc-service "$service_name" status | grep -E -q '(status: started|is running)'; then
             echo "ERROR: Failed to start '$service_name' via rc-service and it does not appear to be running."
        else
            echo "'$service_name' appears to be running or was already started."
        fi
    else
        echo "OpenRC service '$service_name' started successfully via rc-service."
    fi

    echo "Final status of '$service_name':"
    rc-service "$service_name" status || echo "Could not get status for $service_name using rc-service."
}

# Function to update Canvas Server
update_canvas() {
    echo "Updating Canvas Server in $CANVAS_ROOT..."
    cd "$CANVAS_ROOT" || handle_error "$?" "Failed to change directory to $CANVAS_ROOT"

    echo "Stopping Canvas Server with PM2 (if running)..."
    su -s /bin/ash "$CANVAS_USER" -c "$PM2_CMD stop canvas-server || true"
    su -s /bin/ash "$CANVAS_USER" -c "$PM2_CMD delete canvas-server || true" # Ensures a clean slate for startup

    if [ -d node_modules ]; then
        echo "Removing old node_modules..."
        rm -rf node_modules
    fi
    # Optionally remove package-lock.json for a very clean install
    # if [ -f package-lock.json ]; then rm -f package-lock.json; fi

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

    echo "Setting permissions for $CANVAS_ROOT..."
    if ! chown -R "$CANVAS_USER":"$CANVAS_GROUP" "$CANVAS_ROOT"; then
        handle_error "$?" "Failed to set permissions on $CANVAS_ROOT"
    fi

    echo "Starting updated Canvas Server with PM2 as $CANVAS_USER..."
    if ! su -s /bin/ash "$CANVAS_USER" -c "cd \"$CANVAS_ROOT\" && NODE_ENV=production $PM2_CMD start npm --name canvas-server -- run start"; then
        handle_error "$?" "Failed to start Canvas Server with $PM2_CMD"
    fi
    su -s /bin/ash "$CANVAS_USER" -c "$PM2_CMD save" || echo "Warning: $PM2_CMD save failed during update."

    echo "Canvas Server updated and started."
}

# Function to install Canvas Server
install_canvas() {
    echo "Installing Canvas Server to $CANVAS_ROOT..."
    if ! git clone --branch "$CANVAS_REPO_TARGET_BRANCH" "$CANVAS_REPO_URL" "$CANVAS_ROOT"; then
        handle_error "$?" "Failed to clone Canvas Server repository"
    fi

    cd "$CANVAS_ROOT" || handle_error "$?" "Failed to change directory to $CANVAS_ROOT"
    # Git checkout already handled by --branch in clone, but ensure if needed
    # if ! git checkout "$CANVAS_REPO_TARGET_BRANCH"; then
    #     handle_error "$?" "Failed to checkout branch $CANVAS_REPO_TARGET_BRANCH"
    # fi

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

    echo "Starting Canvas Server with PM2 as $CANVAS_USER..."
    if ! su -s /bin/ash "$CANVAS_USER" -c "cd \"$CANVAS_ROOT\" && NODE_ENV=production $PM2_CMD start npm --name canvas-server -- run start"; then
        handle_error "$?" "Failed to start Canvas Server with $PM2_CMD"
    fi
    su -s /bin/ash "$CANVAS_USER" -c "$PM2_CMD save" || echo "Warning: $PM2_CMD save failed during initial install."

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

# Install Node.js
setup_nodejs

# Install pm2 globally
echo "Installing pm2 globally via npm..."
NPM_GLOBAL_BIN_DIR=$(npm bin -g 2>/dev/null) # Get npm global bin directory

PM2_CMD="" # Initialize PM2_CMD

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
        echo "pm2 installed but not in standard PATH after installation. Using explicit path: ${NPM_GLOBAL_BIN_DIR}/pm2"
        PM2_CMD="${NPM_GLOBAL_BIN_DIR}/pm2"
    else
        # Fallback: Check common global locations (npm install -g pm2 on Alpine often symlinks to /usr/bin/pm2)
        if [ -x "/usr/bin/pm2" ]; then
             echo "Found pm2 at /usr/bin/pm2 after checking common paths."
             PM2_CMD="/usr/bin/pm2"
        elif [ -x "/usr/local/bin/pm2" ]; then
             echo "Found pm2 at /usr/local/bin/pm2 after checking common paths."
             PM2_CMD="/usr/local/bin/pm2"
        else
            handle_error "1" "pm2 command not found even after attempting global installation and checking known paths."
        fi
    fi
fi

# Verify PM2_CMD
if [ -z "$PM2_CMD" ]; then
    handle_error "1" "PM2 command path could not be determined."
elif ! "$PM2_CMD" -v >/dev/null 2>&1; then
    # Attempt to run a simple pm2 command to ensure it's working
    handle_error "1" "PM2 command ($PM2_CMD) determined but is not functioning correctly. Check npm global setup and PATH."
fi
echo "Using PM2 command: $PM2_CMD"

# Install nginx and certbot (optional)
# echo "Skipping optional Nginx and Certbot installation."
# if false; then # Set to true to enable this section
#   echo "Installing Nginx and Certbot..."
#   if ! apk add --no-cache nginx certbot py3-certbot-nginx; then
#       echo "Warning: Failed to install nginx and certbot. Continuing without them."
#   else
#       echo "Nginx and Certbot packages installed."
#       # Certbot setup (optional, requires FQDN and email)
#       # Make sure Nginx is configured and running before attempting certonly
#       # Example:
#       # if ! certbot certonly --nginx -d "$WEB_FQDN" --non-interactive --agree-tos -m "$WEB_ADMIN_EMAIL"; then
#       #     echo "Warning: Failed to setup certbot. Manual configuration may be needed."
#       # fi
#   fi
# fi

# Create service group
echo "Creating service group $CANVAS_GROUP (if it doesn't exist)..."
if ! getent group "$CANVAS_GROUP" > /dev/null 2>&1; then
    if ! addgroup -S "$CANVAS_GROUP"; then # -S for system group
        handle_error "$?" "Failed to create service group $CANVAS_GROUP"
    fi
else
    echo "Group $CANVAS_GROUP already exists."
fi

# Create service user
echo "Creating service user $CANVAS_USER (if it doesn't exist)..."
if ! id "$CANVAS_USER" > /dev/null 2>&1; then
    # -S: system user, -D: no password, -s /sbin/nologin: no login shell
    # -G: primary group, -h: home directory
    if ! adduser -S -D -s /sbin/nologin -G "$CANVAS_GROUP" -h "$CANVAS_ROOT" "$CANVAS_USER"; then
        handle_error "$?" "Failed to create service user $CANVAS_USER"
    fi
else
    echo "User $CANVAS_USER already exists."
fi

# Add canvas-server path to git config (useful if running git commands as different users)
echo "Adding $CANVAS_ROOT to git safe.directory..."
if ! git config --global --add safe.directory "$CANVAS_ROOT"; then
    # This might fail if git config --global cannot write (e.g. no home dir for root or perms)
    # Try to create a dummy .gitconfig for root if it helps, or instruct user.
    echo "Warning: Failed to add $CANVAS_ROOT to global git safe.directory."
    echo "This might be an issue if git commands are run as a different user than the owner of $CANVAS_ROOT."
    echo "You can try: mkdir -p /root && git config --global --add safe.directory $CANVAS_ROOT"
fi

# Install or update Canvas Server
if [ ! -d "$CANVAS_ROOT/.git" ]; then # Check for .git to be more specific than just dir existence
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

exit 0
