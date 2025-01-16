#!/bin/bash

# This script installs Docker and Docker Compose on an Ubuntu system.
# It checks if Docker and Docker Compose are already installed, and if not, installs them.

# Set default values for environment variables
DOCKER_COMPOSE_VERSION="${DOCKER_COMPOSE_VERSION:-1.29.2}"

# Function to check if Docker is installed
check_docker_installed() {
    if ! command -v docker &> /dev/null; then
        echo "Docker could not be found, installing..."
        install_docker
    else
        echo "Docker is already installed."
        docker_version=$(docker --version)
        echo "Current Docker version: $docker_version"
    fi
}

# Function to install Docker
install_docker() {
    if ! sudo apt-get update; then
        echo "Error: Failed to update package list."
        exit 1
    fi

    if ! sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common; then
        echo "Error: Failed to install required packages."
        exit 1
    fi

    # Add Docker’s official GPG key
    if ! curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -; then
        echo "Error: Failed to add Docker GPG key."
        exit 1
    fi

    # Set up the stable repository
    if ! sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"; then
        echo "Error: Failed to add Docker repository."
        exit 1
    fi

    # Update the apt package index again
    if ! sudo apt-get update; then
        echo "Error: Failed to update package list after adding Docker repository."
        exit 1
    fi

    # Install the latest version of Docker CE
    if ! sudo apt-get install -y docker-ce; then
        echo "Error: Failed to install Docker."
        exit 1
    fi

    # Add the current user to the Docker group to avoid using 'sudo' with Docker commands
    if ! sudo usermod -aG docker $USER; then
        echo "Error: Failed to add user to Docker group."
        exit 1
    fi

    echo "Docker installed successfully."
}

# Function to check if Docker Compose is installed
check_docker_compose_installed() {
    if ! command -v docker-compose &> /dev/null; then
        echo "Docker Compose could not be found, installing..."
        install_docker_compose
    else
        echo "Docker Compose is already installed."
        docker_compose_version=$(docker-compose --version)
        echo "Current Docker Compose version: $docker_compose_version"
    fi
}

# Function to install Docker Compose
install_docker_compose() {
    # Install Docker Compose
    if ! sudo curl -L "https://github.com/docker/compose/releases/download/$DOCKER_COMPOSE_VERSION/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose; then
        echo "Error: Failed to download Docker Compose."
        exit 1
    fi

    if ! sudo chmod +x /usr/local/bin/docker-compose; then
        echo "Error: Failed to set executable permissions for Docker Compose."
        exit 1
    fi

    echo "Docker Compose installed successfully."
}

# Main
check_docker_installed
check_docker_compose_installed
