#!/usr/bin/env node

/**
 * Canvas WebSocket Debugging Test
 *
 * This script tests direct WebSocket connection with the token in various ways.
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

console.log('Canvas WebSocket Debugging Test');
console.log('==============================');

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
    console.warn('Token does not appear to be a valid JWT format!');
}

// Test 1: Connect with token in auth object
console.log('\n--- Test 1: Connect with token in auth object ---');
const socket1 = io(serverUrl, {
    transports: ['websocket'],
    auth: {
        token: token,
    },
});

socket1.on('connect', () => {
    console.log('✅ Test 1 passed: Connected to server with socket ID:', socket1.id);
    socket1.disconnect();
    runTest2();
});

socket1.on('connect_error', (error) => {
    console.error('❌ Test 1 failed: Connection error:', error.message);
    socket1.disconnect();
    runTest2();
});

// Test 2: Connect with token in extraHeaders
function runTest2() {
    console.log('\n--- Test 2: Connect with token in extraHeaders ---');
    const socket2 = io(serverUrl, {
        transports: ['websocket'],
        extraHeaders: {
            Authorization: `Bearer ${token}`,
        },
    });

    socket2.on('connect', () => {
        console.log('✅ Test 2 passed: Connected to server with socket ID:', socket2.id);
        socket2.disconnect();
        runTest3();
    });

    socket2.on('connect_error', (error) => {
        console.error('❌ Test 2 failed: Connection error:', error.message);
        socket2.disconnect();
        runTest3();
    });
}

// Test 3: Connect with token in auth object with extra "token" text
function runTest3() {
    console.log('\n--- Test 3: Connect with string literal "token" ---');
    const socket3 = io(serverUrl, {
        transports: ['websocket'],
        auth: {
            token: 'canvas-server-token',
        },
    });

    socket3.on('connect', () => {
        console.log('✅ Test 3 passed: Connected to server with socket ID:', socket3.id);
        socket3.disconnect();
        runTest4();
    });

    socket3.on('connect_error', (error) => {
        console.error('❌ Test 3 failed: Connection error:', error.message);
        socket3.disconnect();
        runTest4();
    });
}

// Test 4: Connect with token and add Bearer prefix
function runTest4() {
    console.log('\n--- Test 4: Connect with "Bearer" prefix ---');
    const socket4 = io(serverUrl, {
        transports: ['websocket'],
        auth: {
            token: `Bearer ${token}`,
        },
    });

    socket4.on('connect', () => {
        console.log('✅ Test 4 passed: Connected to server with socket ID:', socket4.id);
        socket4.disconnect();
        console.log('\nAll tests completed!');
    });

    socket4.on('connect_error', (error) => {
        console.error('❌ Test 4 failed: Connection error:', error.message);
        socket4.disconnect();
        console.log('\nAll tests completed!');
    });
}

// Set timeout in case we get stuck
setTimeout(() => {
    console.log('\nTests timed out after 10 seconds');
    process.exit(1);
}, 10000);
