#!/usr/bin/env node

/**
 * SSH Server Role Setup Script
 *
 * This script helps set up the SSH server role for canvas-server.
 * It creates the necessary directories and configuration files.
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';

// Default port for SSH server
const DEFAULT_PORT = 8003;

// Function to check if running as root
async function isRoot() {
    return process.getuid && process.getuid() === 0;
}

// Function to generate SSH host keys
async function generateHostKeys(keyPath) {
    console.log(`Generating SSH host keys in ${keyPath}...`);

    try {
        // Create directory if it doesn't exist
        await fs.mkdir(keyPath, { recursive: true });

        // Generate RSA key
        const keygen = spawn('ssh-keygen', [
            '-t',
            'rsa',
            '-f',
            path.join(keyPath, 'ssh_host_rsa_key'),
            '-N',
            '',
            '-C',
            `canvas-server-${new Date().toISOString()}`,
        ]);

        return new Promise((resolve, reject) => {
            keygen.on('exit', (code) => {
                if (code === 0) {
                    console.log('SSH host keys generated successfully');
                    resolve(true);
                } else {
                    console.error(`ssh-keygen exited with code ${code}`);
                    reject(new Error(`ssh-keygen failed with code ${code}`));
                }
            });
        });
    } catch (err) {
        console.error(`Error generating SSH host keys: ${err.message}`);
        throw err;
    }
}

// Function to create a systemd service file for the SSH server
async function createSystemdService(port) {
    console.log('Creating systemd service for SSH server...');

    if (!(await isRoot())) {
        console.warn('Not running as root, skipping systemd service creation');
        return;
    }

    const serviceContent = `[Unit]
Description=Canvas SSH Server
After=network.target

[Service]
ExecStart=/usr/local/bin/node ${path.resolve(process.cwd(), 'server.js')} --role sshd
WorkingDirectory=${process.cwd()}
Environment="PORT=${port}"
Restart=always
User=${process.env.USER}
Group=${process.env.USER}

[Install]
WantedBy=multi-user.target
`;

    const servicePath = '/etc/systemd/system/canvas-sshd.service';

    try {
        await fs.writeFile(servicePath, serviceContent);
        console.log(`Systemd service created at ${servicePath}`);

        // Reload systemd
        const systemctl = spawn('systemctl', ['daemon-reload']);

        await new Promise((resolve) => {
            systemctl.on('exit', () => {
                console.log('Systemd service reloaded');
                resolve();
            });
        });

        console.log('To enable and start the service, run:');
        console.log('  sudo systemctl enable canvas-sshd');
        console.log('  sudo systemctl start canvas-sshd');
    } catch (err) {
        console.error(`Error creating systemd service: ${err.message}`);
    }
}

// Function to create a chroot environment
async function setupChrootEnv(userHome) {
    console.log(`Setting up chroot environment in ${userHome}...`);

    if (!(await isRoot())) {
        console.warn('Not running as root, skipping chroot setup');
        return;
    }

    try {
        // Essential directories for a basic chroot
        const dirs = ['bin', 'lib', 'lib64', 'etc'];

        // Create directories
        for (const dir of dirs) {
            await fs.mkdir(path.join(userHome, dir), { recursive: true });
        }

        // Copy essential binaries
        const binaries = [
            '/bin/bash',
            '/bin/ls',
            '/bin/mkdir',
            '/bin/rm',
            '/bin/cp',
            '/bin/cat',
            '/bin/echo',
            '/bin/grep',
            '/bin/ln',
        ];

        for (const binary of binaries) {
            const destPath = path.join(userHome, binary);
            try {
                await fs.copyFile(binary, destPath);
                await fs.chmod(destPath, 0o755);
            } catch (err) {
                console.warn(`Failed to copy ${binary}: ${err.message}`);
            }
        }

        // Copy essential libraries (this is a simplified approach)
        // In a real scenario, you'd need to copy all required libraries
        console.log('Copying required libraries...');
        const ldd = spawn('ldd', binaries);

        let output = '';
        ldd.stdout.on('data', (data) => {
            output += data.toString();
        });

        await new Promise((resolve) => {
            ldd.on('exit', async () => {
                const libs = new Set();

                // Parse ldd output to get library paths
                const libMatches = output.matchAll(/=>\s+(\S+)\s+\(/g);
                for (const match of libMatches) {
                    if (match[1]) libs.add(match[1]);
                }

                // Copy libraries
                for (const lib of libs) {
                    try {
                        const destPath = path.join(userHome, lib);
                        const destDir = path.dirname(destPath);

                        await fs.mkdir(destDir, { recursive: true });
                        await fs.copyFile(lib, destPath);
                        await fs.chmod(destPath, 0o755);
                    } catch (err) {
                        console.warn(`Failed to copy ${lib}: ${err.message}`);
                    }
                }

                resolve();
            });
        });

        console.log('Chroot environment setup complete');
    } catch (err) {
        console.error(`Error setting up chroot environment: ${err.message}`);
    }
}

// Main function
async function main() {
    console.log('Setting up Canvas SSH Server Role');

    // Determine server home directory
    const serverHome = process.env.CANVAS_SERVER_HOME || process.cwd();
    const configDir = process.env.CANVAS_SERVER_CONFIG || path.join(serverHome, 'config');
    const sshConfigDir = path.join(configDir, 'ssh');

    try {
        // Generate SSH host keys if they don't exist
        if (!existsSync(path.join(sshConfigDir, 'ssh_host_rsa_key'))) {
            await generateHostKeys(sshConfigDir);
        } else {
            console.log('SSH host keys already exist');
        }

        // Check if running on Linux
        if (os.platform() === 'linux') {
            console.log('Running on Linux, setting up additional components...');

            // Create systemd service
            await createSystemdService(DEFAULT_PORT);

            // Setup chroot environment for each user
            // This is just a placeholder - in a real scenario, you'd iterate through
            // all users and set up their chroot environments
            console.log('NOTE: To properly set up chroot environments for users,');
            console.log('      you should run this script as root and modify it to');
            console.log('      iterate through all your users.');
        } else {
            console.log('Not running on Linux, skipping Linux-specific setup');
        }

        console.log('\nSetup complete!');
        console.log(`SSH server will run on port ${DEFAULT_PORT}`);
        console.log('To change the port, edit your configuration file or set the PORT environment variable.');
    } catch (err) {
        console.error(`Setup failed: ${err.message}`);
        process.exit(1);
    }
}

// Run the main function
main().catch(console.error);
