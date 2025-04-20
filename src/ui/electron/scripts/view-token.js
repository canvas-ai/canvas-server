#!/usr/bin/env node

/**
 * Canvas Electron View Token
 *
 * This script directly reads the configuration file and displays the auth token.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// Get current file and directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration paths
const CONFIG_DIR = path.join(os.homedir(), '.canvas', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'canvas-electron.json');

console.log('Canvas Electron Token Viewer');
console.log('===========================');
console.log(`Config file path: ${CONFIG_FILE}`);

// Check if config file exists
if (fs.existsSync(CONFIG_FILE)) {
    console.log('Config file exists!');

    try {
        // Read the file content
        const content = fs.readFileSync(CONFIG_FILE, 'utf8');
        console.log('Config file read successfully');

        // Try to parse as JSON
        try {
            const config = JSON.parse(content);
            console.log('Config file is valid JSON');
            console.log('Config structure:', Object.keys(config).join(', '));

            // Check for server.auth.token
            if (config.server && config.server.auth && config.server.auth.token) {
                const token = config.server.auth.token;
                console.log('Found token in server.auth.token');
                console.log(`Token: ${token.substring(0, 15)}...${token.substring(token.length - 15)}`);
                console.log(`Token length: ${token.length}`);

                // Check if token is a valid JWT (should have 2 dots)
                const parts = token.split('.');
                if (parts.length === 3) {
                    console.log('Token appears to be a valid JWT format (has 3 parts separated by dots)');

                    // Try to decode the header
                    try {
                        const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
                        console.log('JWT header:', header);
                    } catch (e) {
                        console.error('Could not decode JWT header:', e.message);
                    }
                } else {
                    console.warn('Token does not appear to be a valid JWT format (should have 3 parts separated by dots)');
                }
            } else {
                console.log('No token found in server.auth.token');
            }

            // Check for auth.token
            if (config.auth && config.auth.token) {
                const token = config.auth.token;
                console.log('Found token in auth.token');
                console.log(`Token: ${token.substring(0, 15)}...${token.substring(token.length - 15)}`);
                console.log(`Token length: ${token.length}`);
            } else {
                console.log('No token found in auth.token');
            }
        } catch (parseError) {
            console.error('Error parsing config file as JSON:', parseError.message);
            console.log('File content:');
            console.log(content);
        }
    } catch (readError) {
        console.error('Error reading config file:', readError.message);
    }
} else {
    console.error('Config file does not exist!');
}

// Print environment and system info
console.log('\nEnvironment Information:');
console.log(`OS: ${os.platform()} ${os.release()}`);
console.log(`Node version: ${process.version}`);
console.log(`Home directory: ${os.homedir()}`);
