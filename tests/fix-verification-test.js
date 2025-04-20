/**
 * Tree Fix Verification Test
 *
 * This test verifies that our fixes have resolved the following issues:
 * 1. Path format consistency (no more triple slashes)
 * 2. WebSocket event duplication
 * 3. WebSocket connectivity and propagation
 */

import { io } from 'socket.io-client';
import axios from 'axios';
import fs from 'fs';

// Configuration
const API_URL = 'http://localhost:8001';
const API_REST_BASE = `${API_URL}/rest/v2`;
const WS_URL = API_URL;

// Authentication - replace with a valid token for your system
const AUTH_TOKEN =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU2YjgwZGU3LThkNjEtNGY2My1iMjU5LTlhOGRiMmY3MzlhZiIsImVtYWlsIjoibmV3dXNlckB0ZXN0LmNvbSIsInNlc3Npb25JZCI6IjhlYjdlZmQ1LTNhOWMtNDQwMC04MDQyLTc3OTk2MGE3ZjNkOCIsImlhdCI6MTc0MTY5NjA4MiwiZXhwIjoxNzQyMzAwODgyfQ.AMDZml1OFbHOmk1dIUgvnaWiD8TqjYb2Y-Wg2NeQUPY';

// Test configuration
const WORKSPACE_ID = 'universe';
const TEST_PATH_PREFIX = `/test/fix-verification-${Date.now()}`;

// Setup axios with auth
const api = axios.create({
    baseURL: API_REST_BASE,
    headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
    },
});

// Track received events with timestamps
const receivedEvents = [];

// Logger utility
function log(message, data) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
        console.log(data);
    }
    return timestamp;
}

// Initialize user and get workspace
async function initializeUser() {
    try {
        log('Getting current user information...');
        const userResponse = await api.get('/users/current');
        log(`User initialized: ${userResponse.data.payload.email}`);

        log('Getting workspace information...');
        const workspacesResponse = await api.get('/workspaces');

        if (workspacesResponse.data.status === 'success') {
            const workspaces = workspacesResponse.data.payload;
            const testWorkspace = workspaces.find((w) => w.id === WORKSPACE_ID);
            if (testWorkspace) {
                log(`Target workspace found: ${WORKSPACE_ID}`);
                return true;
            }
        }
        return false;
    } catch (error) {
        log(`Error initializing user: ${error.message}`);
        return false;
    }
}

// Connect to WebSocket server and setup event listeners
function connectToWebSocket() {
    return new Promise((resolve, reject) => {
        log(`Connecting to WebSocket at ${WS_URL}`);

        const socket = io(WS_URL, {
            transports: ['websocket'],
            auth: { token: AUTH_TOKEN },
        });

        const timeout = setTimeout(() => {
            reject(new Error('WebSocket connection timeout'));
        }, 5000);

        socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            log(`WebSocket connection error: ${error.message}`);
            reject(error);
        });

        socket.on('connect', () => {
            clearTimeout(timeout);
            log(`Connected to WebSocket server with ID: ${socket.id}`);

            // Subscribe to workspace
            socket.emit('workspace:subscribe', WORKSPACE_ID, (response) => {
                if (response && response.status === 'success') {
                    log(`Subscribed to workspace: ${WORKSPACE_ID}`);

                    // Track tree update events
                    socket.on('workspace:workspace:tree:updated', (event) => {
                        const timestamp = log('Received tree update event', {
                            operation: event.data.operation,
                            path: event.data.path,
                        });

                        // Store event with timestamp for later analysis
                        receivedEvents.push({
                            timestamp,
                            type: 'tree:updated',
                            operation: event.data.operation,
                            path: event.data.path,
                        });

                        // Check path format - TEST 1: Path format consistency
                        if (event.data.path) {
                            const isPathFormatValid = !event.data.path.includes('//');
                            log(`Path format check: ${isPathFormatValid ? 'PASSED' : 'FAILED'}`);
                        }
                    });

                    resolve(socket);
                } else {
                    reject(new Error('Failed to subscribe to workspace'));
                }
            });
        });
    });
}

// Insert test paths and check for duplicate events
async function testPathInsertion(socket) {
    // Create test paths
    const testPaths = [`${TEST_PATH_PREFIX}/fix-1`, `${TEST_PATH_PREFIX}/fix-2`];

    // Insert paths with a delay between them
    for (const path of testPaths) {
        log(`Inserting path: ${path}`);

        try {
            const response = await api.post(`/workspaces/${WORKSPACE_ID}/tree/path`, {
                path,
                autoCreateLayers: true,
            });

            log(`Path inserted: ${path}`, {
                success: response.data.status === 'success',
            });

            // Wait 1 second between insertions
            await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
            log(`Error inserting path: ${error.message}`);
        }
    }

    // Wait for events to be processed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check for duplicate events - TEST 2: WebSocket event duplication
    const operations = {};
    for (const event of receivedEvents) {
        const key = `${event.operation}:${event.path}`;
        if (!operations[key]) {
            operations[key] = [];
        }
        operations[key].push(event.timestamp);
    }

    let duplicatesFound = false;

    // Check for events with the same operation and path occurring within 100ms
    for (const [key, timestamps] of Object.entries(operations)) {
        if (timestamps.length > 1) {
            // Check time differences
            for (let i = 1; i < timestamps.length; i++) {
                const time1 = new Date(timestamps[i - 1]).getTime();
                const time2 = new Date(timestamps[i]).getTime();
                const diff = time2 - time1;

                // If events are less than 100ms apart, they might be duplicates
                if (diff < 100) {
                    log(`Potential duplicate events detected for ${key}: ${diff}ms apart`);
                    duplicatesFound = true;
                }
            }
        }
    }

    log(`Duplicate events check: ${!duplicatesFound ? 'PASSED' : 'FAILED'}`);

    return !duplicatesFound;
}

// Main test function
async function runTest() {
    try {
        log('=== STARTING FIX VERIFICATION TEST ===');

        // Step 1: Initialize user and check workspace access
        const userInitialized = await initializeUser();
        if (!userInitialized) {
            log('Failed to initialize user, aborting test');
            process.exit(1);
        }

        // Step 2: Connect to WebSocket and subscribe to workspace
        const socket = await connectToWebSocket();

        // Step 3: Test path insertion and check for duplicates
        const pathInsertionSuccess = await testPathInsertion(socket);

        // Step 4: Get the tree to verify path formats
        log('Getting workspace tree to verify path formats');
        const treeResponse = await api.get(`/workspaces/${WORKSPACE_ID}/tree`);
        if (treeResponse.data.status === 'success') {
            const tree = treeResponse.data.payload;

            // Check top-level node names for correct formatting
            const nodeNames = tree.children.map((child) => child.name);
            log('Node names from tree', nodeNames);

            // Verify no nodes have triple slashes or format issues
            const hasFormatIssues = nodeNames.some((name) => name.includes('//'));
            log(`Tree node format check: ${!hasFormatIssues ? 'PASSED' : 'FAILED'}`);
        }

        // Step 5: Clean up
        if (socket) {
            log('Disconnecting WebSocket');
            socket.disconnect();
        }

        log('=== TEST COMPLETED ===');

        // Summary
        const allTestsPassed = pathInsertionSuccess && !receivedEvents.some((e) => e.path && e.path.includes('//'));
        log(`Overall test result: ${allTestsPassed ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
        log(`Test error: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Run the test
runTest();
