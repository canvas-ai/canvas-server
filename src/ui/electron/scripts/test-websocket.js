#!/usr/bin/env node

/**
 * Canvas WebSocket Connection Test
 *
 * This script directly tests WebSocket connection using the token
 * from the config file.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { io } from 'socket.io-client';
import { fileURLToPath } from 'url';

// Get current file and directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration paths
const CONFIG_DIR = path.join(os.homedir(), '.canvas', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'canvas-electron.json');

// Default URL
const DEFAULT_URL = 'http://localhost:8001';

console.log('Canvas WebSocket Connection Test');
console.log('===============================');

// Read config file
let config = {};
try {
    if (fs.existsSync(CONFIG_FILE)) {
        const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
        config = JSON.parse(configData);
        console.log(`Read config file: ${CONFIG_FILE}`);
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
let serverUrl = DEFAULT_URL;

if (config.server && config.server.url) {
    serverUrl = config.server.url;
}

if (config.server && config.server.auth && config.server.auth.token) {
    token = config.server.auth.token;
    tokenLocation = 'server.auth.token';
} else if (config.auth && config.auth.token) {
    token = config.auth.token;
    tokenLocation = 'auth.token';
} else {
    console.log('No token found in config file.');
    process.exit(1);
}

console.log(`Using token from ${tokenLocation}: ${token.substring(0, 15)}...`);
console.log(`Token length: ${token.length}`);
console.log(`Connecting to server at: ${serverUrl}`);

// Create the socket with authentication
const socket = io(serverUrl, {
    transports: ['websocket'],
    auth: {
        token: token,
    },
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 1000,
    timeout: 10000,
});

// Set up connection event handlers
socket.on('connect', () => {
    console.log(`✅ Connected to server with socket ID: ${socket.id}`);

    // Test workspace subscription
    console.log('Attempting to subscribe to workspace: universe');
    socket.emit('workspace:subscribe', 'universe', (response) => {
        if (response && response.status === 'success') {
            console.log('✅ Successfully subscribed to workspace: universe');
            console.log(response);

            // Get the tree
            console.log('Requesting workspace tree...');
            socket.emit('workspace:tree:get', 'universe', (treeResponse) => {
                if (treeResponse && treeResponse.status === 'success') {
                    console.log('✅ Successfully received workspace tree');
                    console.log(`Tree size: ${JSON.stringify(treeResponse.payload.tree).length} bytes`);
                    console.log('Tree structure:', Object.keys(treeResponse.payload.tree));

                    // All tests passed, disconnect and exit
                    socket.disconnect();
                    console.log('All tests passed! WebSocket connection is working correctly.');
                    process.exit(0);
                } else {
                    console.error('❌ Failed to get workspace tree:', treeResponse ? treeResponse.error : 'Unknown error');
                    socket.disconnect();
                    process.exit(1);
                }
            });
        } else {
            console.error('❌ Failed to subscribe to workspace:', response ? response.error : 'Unknown error');
            socket.disconnect();
            process.exit(1);
        }
    });
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
    process.exit(1);
});

socket.on('error', (error) => {
    console.error('❌ Socket error:', error.message);
    process.exit(1);
});

// Set a timeout in case the connection hangs
setTimeout(() => {
    console.error('❌ Connection timed out after 10 seconds');
    if (socket.connected) {
        socket.disconnect();
    }
    process.exit(1);
}, 10000);

// Handle process interruption
process.on('SIGINT', () => {
    console.log('\nTest interrupted');
    if (socket.connected) {
        socket.disconnect();
    }
    process.exit(0);
});
