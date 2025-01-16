#!/bin/bash

# This script is a (working) draft only
# Intended to be used as a reference for setting up Canvas Server

# Script defaults
# TODO: Add support for command line arguments / ENV vars
CANVAS_ROOT="/opt/canvas-server"
CANVAS_USER="canvas"
CANVAS_GROUP="www-data"
CANVAS_REPO_URL="https://github.com/canvas-ai/canvas-server.git"
CANVAS_REPO_TARGET_BRANCH="dev"
NODEJS_VERSION=20

# Certbot defaults
WEB_ADMIN_EMAIL="$(hostname)@cnvs.ai"
WEB_FQDN="my.cnvs.ai"

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

# Install NodeJS (taken from https://deb.nodesource.com/setup_20.x)
setup_nodejs_repository() {
    if ! mkdir -p /usr/share/keyrings; then
      echo "Failed to create /usr/share/keyrings directory"
	  exit 1
    fi

	rm -f /usr/share/keyrings/nodesource.gpg || true
    rm -f /etc/apt/sources.list.d/nodesource.list || true
	rm -f /etc/apt/preferences.d/nsolid || true
	rm -f /etc/apt/preferences.d/nodejs || true

    # Run 'curl' and 'gpg' to download and import the NodeSource signing key
    if ! curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg; then
      echo "Failed to download and import the NodeSource signing key"
	  exit 1
    fi

    # Explicitly set the permissions to ensure the file is readable by all
    if ! chmod 644 /usr/share/keyrings/nodesource.gpg; then
        handle_error "$?" "Failed to set correct permissions on /usr/share/keyrings/nodesource.gpg"
    fi

    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODEJS_VERSION.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list > /dev/null

    # N|solid Config
    echo "Package: nsolid" | tee /etc/apt/preferences.d/nsolid > /dev/null
    echo "Pin: origin deb.nodesource.com" | tee -a /etc/apt/preferences.d/nsolid > /dev/null
    echo "Pin-Priority: 600" | tee -a /etc/apt/preferences.d/nsolid > /dev/null

    # Nodejs Config
    echo "Package: nodejs" | tee /etc/apt/preferences.d/nodejs > /dev/null
    echo "Pin: origin deb.nodesource.com" | tee -a /etc/apt/preferences.d/nodejs > /dev/null
    echo "Pin-Priority: 600" | tee -a /etc/apt/preferences.d/nodejs > /dev/null

	# Update package lists
	if ! apt-get update; then
	  echo "Failed to update package lists"
	  exit 1
	fi
}

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
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

		systemctl daemon-reload
		systemctl enable canvas-server
	fi
}

update_canvas() {
	cd $CANVAS_ROOT || exit 1

	# If systemd service is not found, create it
	install_canvas_service

	# Stop canvas-server if running
	if systemctl is-active --quiet canvas-server; then
		systemctl stop canvas-server
	fi

	# Clean up
	if [ -d node_modules ]; then
		rm -rf node_modules
	fi

	# Pull latest changes
	git pull origin $CANVAS_REPO_TARGET_BRANCH

	# Install dependencies
	npm install

	# Set permissions
	chown -R $CANVAS_USER:$CANVAS_GROUP $CANVAS_ROOT

	# Start canvas-server
	systemctl start canvas-server
}

install_canvas() {
		git clone $CANVAS_REPO_URL $CANVAS_ROOT
		cd $CANVAS_ROOT || exit 1

		git checkout $CANVAS_REPO_TARGET_BRANCH
		npm install

		# Set permissions
		chown $CANVAS_USER:$CANVAS_GROUP $CANVAS_ROOT

		# Systemd bling-bling
		install_canvas_service
		systemctl start canvas-server
}

# Ensure system is up-to-date
apt-get update && apt-get upgrade -y

# Install system utilities ("fat" installation)
apt-get install apt-transport-https \
	ca-certificates \
	gnupg \
	openssh-server \
	bridge-utils \
	vnstat \
	ethtool \
	bind9-utils \
	bind9-dnsutils \
	socat \
	whois \
	ufw \
	curl \
	wget \
	git \
	unattended-upgrades \
	update-notifier-common \
	postfix \
	build-essential \
	nano

# Install nodejs
if [ ! $(command -v node) ] || [ ! $(node --version | grep -o "v$NODEJS_VERSION") ]; then
	setup_nodejs_repository
	apt-get install nodejs
	node --version || exit 1
	npm --version || exit 1
fi;

# Install pm2 globally (not used as of now)
if [ ! $(command -v pm2) ]; then
	npm install pm2 -g
fi

if [ ! $(command -v pm2) ]; then
	npm install pm2 -g
fi

# (optional) Install nginx + certbot
#apt-get install certbotpython3-certbot-nginx nginx-full
# (optional) Certbot setup
#certbot certonly --nginx -d $WEB_FQDN --non-interactive --agree-tos -m $WEB_ADMIN_EMAIL

# Create service group
if ! getent group $CANVAS_GROUP > /dev/null 2>&1; then
	groupadd $CANVAS_GROUP
fi

# Create service user
if ! id $CANVAS_USER > /dev/null 2>&1; then
	useradd --comment "Canvas Server User" 	\
		--system \
		--shell /bin/false \
		--gid $CANVAS_GROUP \
		--home $CANVAS_ROOT \
		$CANVAS_USER
fi

# Add canvas-server path to git config
git config --global --add safe.directory $CANVAS_ROOT

# Install canvas-server
if [ ! -d $CANVAS_ROOT ]; then
	echo "Canvas already installed at $CANVAS_ROOT, updating..."
	update_canvas
else
	install_canvas
fi

systemctl status canvas-server
