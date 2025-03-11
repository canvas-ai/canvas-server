#!/bin/bash

# This script installs and sets up the Canvas Server on an Ubuntu system.
# It installs Node.js, clones the Canvas Server repository, and sets up the service.

# Set default values for environment variables
CANVAS_ROOT="${CANVAS_ROOT:-/opt/canvas-server}"
CANVAS_USER="${CANVAS_USER:-canvas}"
CANVAS_GROUP="${CANVAS_GROUP:-www-data}"
CANVAS_REPO_URL="${CANVAS_REPO_URL:-https://github.com/canvas-ai/canvas-server.git}"
CANVAS_REPO_TARGET_BRANCH="${CANVAS_REPO_TARGET_BRANCH:-dev}"
NODEJS_VERSION="${NODEJS_VERSION:-20}"
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
        \?) echo "Invalid option -$OPTARG" >&2; usage ;;
    esac
done

# Ensure script is run as root
if [ $(id -u) -ne 0 ]; then
    echo "Please run this script as root"
    exit 1
fi

# Ensure system is Ubuntu
if [ ! -f /etc/os-release ]; then
    echo "This script is intended for Ubuntu systems only"
    exit 1
fi

# Function to handle errors
handle_error() {
    local exit_code=$1
    local msg=$2
    echo "Error: $msg"
    exit $exit_code
}

# Function to install Node.js
setup_nodejs_repository() {
    if ! mkdir -p /usr/share/keyrings; then
        handle_error "$?" "Failed to create /usr/share/keyrings directory"
    fi

    rm -f /usr/share/keyrings/nodesource.gpg || true
    rm -f /etc/apt/sources.list.d/nodesource.list || true
    rm -f /etc/apt/preferences.d/nsolid || true
    rm -f /etc/apt/preferences.d/nodejs || true

    if ! curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg; then
        handle_error "$?" "Failed to download and import the NodeSource signing key"
    fi

    if ! chmod 644 /usr/share/keyrings/nodesource.gpg; then
        handle_error "$?" "Failed to set correct permissions on /usr/share/keyrings/nodesource.gpg"
    fi

    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODEJS_VERSION.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list > /dev/null

    echo "Package: nsolid" | tee /etc/apt/preferences.d/nsolid > /dev/null
    echo "Pin: origin deb.nodesource.com" | tee -a /etc/apt/preferences.d/nsolid > /dev/null
    echo "Pin-Priority: 600" | tee -a /etc/apt/preferences.d/nsolid > /dev/null

    echo "Package: nodejs" | tee /etc/apt/preferences.d/nodejs > /dev/null
    echo "Pin: origin deb.nodesource.com" | tee -a /etc/apt/preferences.d/nodejs > /dev/null
    echo "Pin-Priority: 600" | tee -a /etc/apt/preferences.d/nodejs > /dev/null

    if ! apt-get update; then
        handle_error "$?" "Failed to update package lists"
    fi
}

# Function to install Canvas service
install_canvas_service() {
    if [ ! -f /etc/systemd/system/canvas-server.service ]; then
        cat > /etc/systemd/system/canvas-server.service <<EOF
[Unit]
Description=Canvas Server
After=network.target

[Service]
Type=simple
User=$CANVAS_USER
Group=$CANVAS_GROUP
WorkingDirectory=$CANVAS_ROOT
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=30
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

        systemctl daemon-reload
        systemctl enable canvas-server
    fi
}

# Function to update Canvas Server
update_canvas() {
    cd $CANVAS_ROOT || handle_error "$?" "Failed to change directory to $CANVAS_ROOT"

    install_canvas_service

    if systemctl is-active --quiet canvas-server; then
        systemctl stop canvas-server
    fi

    if [ -d node_modules ]; then
        rm -rf node_modules
    fi

    if ! git pull origin $CANVAS_REPO_TARGET_BRANCH; then
        handle_error "$?" "Failed to pull latest changes from git"
    fi

    if ! npm install; then
        handle_error "$?" "Failed to install dependencies"
    fi

    if ! chown -R $CANVAS_USER:$CANVAS_GROUP $CANVAS_ROOT; then
        handle_error "$?" "Failed to set permissions"
    fi

    if ! systemctl start canvas-server; then
        handle_error "$?" "Failed to start canvas-server"
    fi
}

# Function to install Canvas Server
install_canvas() {
    if ! git clone $CANVAS_REPO_URL $CANVAS_ROOT; then
        handle_error "$?" "Failed to clone Canvas Server repository"
    fi


    cd $CANVAS_ROOT || handle_error "$?" "Failed to change directory to $CANVAS_ROOT"

    if ! git checkout $CANVAS_REPO_TARGET_BRANCH; then
        handle_error "$?" "Failed to checkout branch $CANVAS_REPO_TARGET_BRANCH"
    fi

    if ! npm install; then
        handle_error "$?" "Failed to install dependencies"
    fi

    if ! chown -R $CANVAS_USER:$CANVAS_GROUP $CANVAS_ROOT; then
        handle_error "$?" "Failed to set permissions"
    fi

    install_canvas_service

    if ! systemctl start canvas-server; then
        handle_error "$?" "Failed to start canvas-server"
    fi
}

# Ensure system is up-to-date
if ! apt-get update && apt-get upgrade -y; then
    handle_error "$?" "Failed to update and upgrade system"
fi

# Install system utilities
if ! apt-get install -y apt-transport-https ca-certificates gnupg openssh-server bridge-utils vnstat ethtool bind9-utils bind9-dnsutils socat whois ufw curl wget git unattended-upgrades update-notifier-common postfix build-essential nano; then
    handle_error "$?" "Failed to install system utilities"
fi

# Install Node.js
if [ ! $(command -v node) ] || [ ! $(node --version | grep -o "v$NODEJS_VERSION") ]; then
    setup_nodejs_repository
    if ! apt-get install -y nodejs; then
        handle_error "$?" "Failed to install Node.js"
    fi
    if ! node --version; then
        handle_error "$?" "Failed to verify Node.js installation"
    fi
    if ! npm --version; then
        handle_error "$?" "Failed to verify npm installation"
    fi
fi

# Install pm2 globally
if [ ! $(command -v pm2) ]; then
    if ! npm install -g pm2; then
        handle_error "$?" "Failed to install pm2 globally"
    fi
fi

# Install nginx and certbot (optional)
# if ! apt-get install -y certbot python3-certbot-nginx nginx-full; then
#     handle_error "$?" "Failed to install nginx and certbot"
# fi

# Certbot setup (optional)
# if ! certbot certonly --nginx -d $WEB_FQDN --non-interactive --agree-tos -m $WEB_ADMIN_EMAIL; then
#     handle_error "$?" "Failed to setup certbot"
# fi

# Create service group
if ! getent group $CANVAS_GROUP > /dev/null 2>&1; then
    if ! groupadd $CANVAS_GROUP; then
        handle_error "$?" "Failed to create service group $CANVAS_GROUP"
    fi
fi

# Create service user
if ! id $CANVAS_USER > /dev/null 2>&1; then
    if ! useradd --comment "Canvas Server User" --system --shell /bin/false --gid $CANVAS_GROUP --home $CANVAS_ROOT $CANVAS_USER; then
        handle_error "$?" "Failed to create service user $CANVAS_USER"
    fi
fi

# Add canvas-server path to git config
if ! git config --global --add safe.directory $CANVAS_ROOT; then
    handle_error "$?" "Failed to add canvas-server path to git config"
fi

# Install or update Canvas Server
if [ ! -d $CANVAS_ROOT ]; then
    install_canvas
else
    update_canvas
fi

if ! systemctl status canvas-server; then
    handle_error "$?" "Failed to check canvas-server status"
fi
