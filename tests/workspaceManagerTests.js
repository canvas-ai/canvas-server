'use strict';

import WorkspaceManager, { WORKSPACE_STATUS_CODES } from '../src/managers/workspace/index.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { existsSync } from 'fs';
import Jim from '../src/utils/jim/index.js';

// NOTE: Tests rely on sequential execution and cleanup
const TEST_ROOT_DIR = path.join(os.tmpdir(), 'canvas-tets');
const TEST_CONFIG_DIR = path.join(TEST_ROOT_DIR, 'config');
const TEST_HOMES_DIR = path.join(TEST_ROOT_DIR, 'homes');

const jim = new Jim({
    rootPath: TEST_CONFIG_DIR,
});

const workspaceManager = new WorkspaceManager({
    rootPath: TEST_HOMES_DIR,
    jim: jim,
});

const testUser = {
    id: 'testuser',
    name: 'Test User',
    email: 'testuser@example.com',
    password: 'testpassword',
};

try {
    // Define a home directory for the user using testUser.email
    const userHomeDir = path.join(TEST_ROOT_DIR, 'home', testUser.email);
    // Create a universe workspace with a custom rootPath to simulate the user's home directory
    const universeWsMeta = await workspaceManager.createWorkspace(testUser.email, 'universe', { type: 'universe', rootPath: userHomeDir });
    console.log('Universe workspace created:', universeWsMeta);
    if (!existsSync(universeWsMeta.rootPath)) {
        throw new Error(`Universe workspace directory not created at ${universeWsMeta.rootPath}`);
    }
    if (!existsSync(path.join(universeWsMeta.rootPath, 'workspace.json'))) {
        throw new Error(`Universe workspace config file not found at ${universeWsMeta.rootPath}`);
    }
    console.log('Universe workspace files created successfully.');
} catch (err) {
    console.error('Error during Universe Workspace Creation test:', err);
}

// --- Testing Nested Workspace Creation ---
console.log('\n--- Testing Nested Workspace Creation ---');
try {
    // Create a parent workspace normally.
    const parentWsMeta = await workspaceManager.createWorkspace(testUser.email, 'parent-ws', { description: 'Parent workspace' });
    console.log('Parent workspace created:', parentWsMeta);
    if (!existsSync(parentWsMeta.rootPath)) {
        throw new Error(`Parent workspace directory not created at ${parentWsMeta.rootPath}`);
    }
    // Define a custom rootPath for a nested workspace: parent's "Workspaces" subdirectory
    const nestedRoot = path.join(parentWsMeta.rootPath, 'Workspaces');
    // Create nested workspace inside parent's Workspaces subdirectory
    const nestedWsMeta = await workspaceManager.createWorkspace(testUser.email, 'child-ws', { description: 'Nested workspace', rootPath: nestedRoot });
    console.log('Nested workspace created:', nestedWsMeta);
    if (!existsSync(nestedWsMeta.rootPath)) {
        throw new Error(`Nested workspace directory not created at ${nestedWsMeta.rootPath}`);
    }
    if (!existsSync(path.join(nestedWsMeta.rootPath, 'workspace.json'))) {
        throw new Error(`Nested workspace config file not found at ${nestedWsMeta.rootPath}`);
    }
    console.log('Nested workspace files created successfully.');
} catch (err) {
    console.error('Error during Nested Workspace Creation test:', err);
}
