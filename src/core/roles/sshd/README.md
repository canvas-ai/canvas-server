# Canvas SSH Server Role

This role enables SSH access to user directories in canvas-server, allowing users to access their workspaces via SSH/SFTP clients.

## Features

- SSH server on port 8003 by default
- Chroots users to their own directories on Linux systems
- Authenticates using canvas-server's user authentication system
- Supports both password and public key authentication
- Provides shell access and SFTP file transfer

## Requirements

- Node.js v20 LTS
- Linux system for full chroot functionality
- Root access for setting up chroot environments

## Installation

The SSH server role is included with canvas-server by default. To enable it:

1. Install necessary dependencies:

```bash
# For Debian/Ubuntu
sudo apt-get install openssh-client libcap2-bin

# For RHEL/CentOS
sudo yum install openssh-clients libcap
```

2. Run the setup script:

```bash
# Must be run as root to set up chroot properly
sudo node src/roles/sshd/setup.js
```

3. Start the server with the SSH role enabled:

```bash
# Start the server with the SSH role
node server.js --role sshd
```

## Configuration

The SSH server can be configured in your canvas-server configuration:

```json
{
  "roles": {
    "sshd": {
      "enabled": true,
      "port": 8003,
      "hostKeyPath": "/path/to/host/keys"
    }
  }
}
```

### Options

- `enabled` - Whether the SSH server role is enabled
- `port` - Port to listen on (default: 8003)
- `hostKeyPath` - Path to host key files (default: CANVAS_SERVER_CONFIG/ssh)

## User Authentication

The SSH server uses the canvas-server authentication system:

1. Username: User's email address in canvas-server
2. Password: Same password used for canvas-server login
3. Public key: Users can add public keys through the canvas-server UI (future feature)

## Chroot Environment

On Linux systems, users are chrooted to their own directories for security. This requires:

1. Root access to set up the chroot environment
2. The `CAP_SYS_CHROOT` capability for the Node.js process

To set up the chroot environment for all users:

```bash
sudo node -e "import('./src/roles/sshd/chroot.js').then(m => m.setupAllUsersChroot(server.userManager))"
```

Or for a single user:

```bash
sudo node -e "import('./src/roles/sshd/chroot.js').then(m => m.setupChrootJail('/path/to/user/home'))"
```

## Using SSH Access

Users can connect using any standard SSH client:

```bash
# Connect with SSH
ssh user@example.com -p 8003

# Or use SFTP
sftp -P 8003 user@example.com
```

## Security Considerations

1. The SSH server should be behind a firewall and only accessible to authorized users
2. On non-Linux systems, full chroot isolation is not available
3. Password authentication should be disabled in production and replaced with public key authentication

## Troubleshooting

- Check logs using the debug namespace `canvas:role:sshd`
- Verify the server is listening on the configured port
- Ensure the user exists in canvas-server and has a valid password
- On Linux, confirm the chroot environment is set up correctly

## Implementation Details

The SSH server is implemented using the `ssh2` Node.js library, which provides a pure JavaScript implementation of the SSH2 protocol. This allows canvas-server to provide SSH access without requiring external tools.

For chroot functionality, the implementation uses Node.js child processes to set up the environment and execute commands within the chroot jail. 