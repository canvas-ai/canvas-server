#!/usr/bin/env node

/**
 * Canvas Electron Authentication Token Check
 *
 * This script checks if the auth token is properly configured in the Electron app config
 * and provides instructions for fixing it if needed.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get current file and directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration paths
const CONFIG_DIR = path.join(os.homedir(), '.canvas', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'canvas-electron.json');

console.log('Canvas Electron Authentication Token Check');
console.log('=========================================');

// Ensure config directory exists
try {
    if (!fs.existsSync(CONFIG_DIR)) {
        console.log(`Creating config directory: ${CONFIG_DIR}`);
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
} catch (err) {
    console.error(`Error creating config directory: ${err.message}`);
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
    }
} catch (err) {
    console.error(`Error reading config file: ${err.message}`);
}

// Check authentication configuration
const authConfig = config.auth || (config.server && config.server.auth) || {};
const authType = authConfig.type || '';
const authToken = authConfig.token || '';

console.log('\nAuthentication Configuration:');
console.log(
    `- Config Structure: ${config.server && config.server.auth ? 'Server->Auth->Token' : config.auth ? 'Auth->Token' : 'Not found'}`,
);
console.log(`- Auth Type: ${authType || 'Not set'}`);
console.log(`- Auth Token: ${authToken ? `${authToken.substring(0, 15)}... (${authToken.length} chars)` : 'Not set'}`);

// If token not found at top level or server.auth, show debug info
if (!authToken && config.server) {
    console.log('\nDebug info:');
    console.log('- server.auth exists:', !!config.server.auth);
    if (config.server.auth) {
        console.log('- server.auth.token exists:', !!config.server.auth.token);
        if (config.server.auth.token) {
            console.log('- server.auth.token value:', `${config.server.auth.token.substring(0, 15)}...`);
        }
    }
}

// Get active user for server API request
let currentUser = null;
try {
    console.log('\nChecking server status and authentication...');
    const response = execSync('curl -s http://localhost:8001/rest/v2/users/me -H "Authorization: Bearer ' + authToken + '"');
    const userData = JSON.parse(response.toString());

    if (userData.status === 'success' && userData.payload) {
        currentUser = userData.payload;
        console.log(`✅ Authentication successful!`);
        console.log(`- Logged in as: ${currentUser.email || currentUser.id}`);
    } else {
        console.log(`❌ Authentication failed: ${userData.message || 'Unknown error'}`);
    }
} catch (err) {
    console.error(`❌ Error checking authentication: ${err.message}`);
    console.log('- Is the server running? (Check if canvas-server is running on port 8001)');
}

// Provide instructions for fixing issues
console.log('\nTroubleshooting Instructions:');

if (!fileExists) {
    console.log(`1. Create a config file at: ${CONFIG_FILE}`);
    console.log(`2. Add the following content (replace TOKEN with your actual token):`);
    console.log(
        JSON.stringify(
            {
                auth: {
                    type: 'token',
                    token: 'YOUR_JWT_TOKEN_HERE',
                },
            },
            null,
            2,
        ),
    );
} else if (!authToken) {
    console.log(`1. Edit the config file at: ${CONFIG_FILE}`);
    console.log(`2. Ensure it includes a valid auth token section:`);
    console.log(
        JSON.stringify(
            {
                auth: {
                    type: 'token',
                    token: 'YOUR_JWT_TOKEN_HERE',
                },
            },
            null,
            2,
        ),
    );
} else if (!currentUser) {
    console.log(`1. Your token may be invalid or expired.`);
    console.log(`2. Get a new token from the Canvas server and update it in: ${CONFIG_FILE}`);
    console.log(`3. Make sure the Canvas server is running on http://localhost:8001`);
} else {
    console.log(`Your authentication token is correctly configured! 🎉`);
}

console.log('\nFor general troubleshooting:');
console.log('1. Restart the Electron application after making changes to the config file');
console.log('2. Check server logs for authentication-related errors');
console.log('3. Verify the token format is correct (should be a JWT token)');
