#!/usr/bin/env node

/**
 * Fix Canvas Electron Config Token
 *
 * This script ensures the authentication token is in the correct location
 * in the config file structure: server.auth.token
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

console.log('Canvas Electron Config Token Fix');
console.log('===============================');

// Ensure config directory exists
try {
    if (!fs.existsSync(CONFIG_DIR)) {
        console.log(`Creating config directory: ${CONFIG_DIR}`);
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
} catch (err) {
    console.error(`Error creating config directory: ${err.message}`);
    process.exit(1);
}

// Check if config file exists
let config = {};
let fileExists = false;

try {
    if (fs.existsSync(CONFIG_FILE)) {
        fileExists = true;
        const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
        config = JSON.parse(configData);
        console.log(`Found config file: ${CONFIG_FILE}`);
    } else {
        console.log(`Config file not found: ${CONFIG_FILE}`);
        process.exit(1);
    }
} catch (err) {
    console.error(`Error reading config file: ${err.message}`);
    process.exit(1);
}

// Find the token in the config
let token = null;
let tokenLocation = 'none';

if (config.server && config.server.auth && config.server.auth.token) {
    token = config.server.auth.token;
    tokenLocation = 'server.auth.token';
    console.log(`Found token in server.auth.token: ${token.substring(0, 15)}...`);
} else if (config.auth && config.auth.token) {
    token = config.auth.token;
    tokenLocation = 'auth.token';
    console.log(`Found token in auth.token: ${token.substring(0, 15)}...`);
} else {
    console.log('No token found in config file.');
    process.exit(1);
}

// Ensure token is in the correct location
if (tokenLocation === 'auth.token') {
    console.log('Token is in auth.token, moving to server.auth.token...');

    // Ensure server object exists
    if (!config.server) {
        config.server = {};
    }

    // Ensure server.auth object exists
    if (!config.server.auth) {
        config.server.auth = {};
    }

    // Set token in the correct location
    config.server.auth.token = token;

    // Set other necessary auth properties
    config.server.auth.type = config.auth?.type || 'token';

    // Write updated config to file
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 4));
        console.log('✅ Successfully updated config file with token in correct location.');
    } catch (err) {
        console.error(`Error writing config file: ${err.message}`);
        process.exit(1);
    }
} else if (tokenLocation === 'server.auth.token') {
    console.log('✅ Token is already in the correct location.');
}

console.log('\nConfig structure:');
console.log('- server exists:', !!config.server);
console.log('- server.auth exists:', !!(config.server && config.server.auth));
console.log('- server.auth.token exists:', !!(config.server && config.server.auth && config.server.auth.token));
if (config.server && config.server.auth && config.server.auth.token) {
    console.log('- server.auth.token length:', config.server.auth.token.length);
}

console.log('\nDone. You can now restart the Electron app.');
