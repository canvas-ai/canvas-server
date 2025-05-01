'use strict';

import WorkspaceManager, { WORKSPACE_STATUS_CODES } from '../src/managers/workspace/index.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { existsSync } from 'fs';
import Jim from '../src/utils/jim/index.js';

// Test configuration
const TEST_ROOT_DIR = path.join(os.tmpdir(), 'canvas-tets');
const TEST_CONFIG_DIR = path.join(TEST_ROOT_DIR, 'config');
const TEST_HOMES_DIR = path.join(TEST_ROOT_DIR, 'homes');

// Test user
const testUser = {
    id: 'testuser',
    name: 'Test User',
    email: 'testuser@example.com',
    password: 'testpassword',
};

// Initialize managers
const jim = new Jim({
    rootPath: TEST_CONFIG_DIR,
    indexName: 'workspaces',
});

const workspaceManager = new WorkspaceManager({
    rootPath: TEST_HOMES_DIR,
    jim: jim,
});

/**
 * Test Suite: WorkspaceManager
 */
async function testWorkspaceManager() {
    console.log('\n=== Starting WorkspaceManager Tests ===\n');

    try {
        // Initialize the manager
        await workspaceManager.initialize();
        console.log('✓ WorkspaceManager initialized successfully');

        // Test 1: Create Universe Workspace
        console.log('\n--- Testing Universe Workspace Creation ---');
        const universeWsMeta = await testUniverseWorkspace();
        console.log('✓ Universe workspace created successfully');

        // Test 2: Create Parent and Child Workspaces
        console.log('\n--- Testing Nested Workspace Creation ---');
        const { parentWsMeta, childWsMeta } = await testNestedWorkspaces();
        console.log('✓ Nested workspaces created successfully');

        // Test 3: Workspace Operations
        console.log('\n--- Testing Workspace Operations ---');
        await testWorkspaceOperations(universeWsMeta, parentWsMeta, childWsMeta);
        console.log('✓ Workspace operations tested successfully');

        // Test 4: Workspace Configuration
        console.log('\n--- Testing Workspace Configuration ---');
        await testWorkspaceConfig(universeWsMeta, parentWsMeta);
        console.log('✓ Workspace configuration tested successfully');

        // Test 5: Workspace Cleanup
        console.log('\n--- Testing Workspace Cleanup ---');
        await testWorkspaceCleanup(universeWsMeta, parentWsMeta, childWsMeta);
        console.log('✓ Workspace cleanup tested successfully');

        console.log('\n=== All WorkspaceManager Tests Completed Successfully ===\n');
    } catch (error) {
        console.error('❌ Test Suite Failed:', error);
        throw error;
    }
}

/**
 * Test 1: Create and verify universe workspace
 */
async function testUniverseWorkspace() {
    const userHomeDir = path.join(TEST_ROOT_DIR, 'home', testUser.email);
    const universeWsMeta = await workspaceManager.createWorkspace(
        testUser.email,
        'universe',
        { type: 'universe', rootPath: userHomeDir }
    );

    // Verify workspace creation
    if (!existsSync(universeWsMeta.rootPath)) {
        throw new Error(`Universe workspace directory not created at ${universeWsMeta.rootPath}`);
    }
    if (!existsSync(path.join(universeWsMeta.rootPath, 'workspace.json'))) {
        throw new Error(`Universe workspace config file not found at ${universeWsMeta.rootPath}`);
    }

    // Verify workspace index entry
    const workspaces = workspaceManager.index;
    if (!workspaces[testUser.email]?.some(ws => ws.id === 'universe')) {
        throw new Error('Universe workspace not found in index');
    }

    return universeWsMeta;
}

/**
 * Test 2: Create and verify nested workspaces
 */
async function testNestedWorkspaces() {
    // Create parent workspace
    const parentWsMeta = await workspaceManager.createWorkspace(
        testUser.email,
        'parent-ws',
        { description: 'Parent workspace' }
    );

    await workspaceManager.createWorkspace(
        testUser.email,
        'foo',
        { description: 'Foo workspace' }
    );

    await workspaceManager.createWorkspace(
        testUser.email,
        'bar-ws',
        { description: 'Bar workspace' }
    );

    await workspaceManager.createWorkspace(
        testUser.email,
        'baz-ws',
        { description: 'Baz workspace' }
    );

    // Verify parent workspace
    if (!existsSync(parentWsMeta.rootPath)) {
        throw new Error(`Parent workspace directory not created at ${parentWsMeta.rootPath}`);
    }

    // Create nested workspace
    const nestedRoot = path.join(parentWsMeta.rootPath, 'Workspaces');
    const childWsMeta = await workspaceManager.createWorkspace(
        testUser.email,
        'child-ws',
        { description: 'Nested workspace', rootPath: nestedRoot }
    );

    // Verify nested workspace
    if (!existsSync(childWsMeta.rootPath)) {
        throw new Error(`Nested workspace directory not created at ${childWsMeta.rootPath}`);
    }
    if (!existsSync(path.join(childWsMeta.rootPath, 'workspace.json'))) {
        throw new Error(`Nested workspace config file not found at ${childWsMeta.rootPath}`);
    }

    return { parentWsMeta, childWsMeta };
}

/**
 * Test 3: Test workspace operations (open, start, stop, close)
 */
async function testWorkspaceOperations(universeWsMeta, parentWsMeta, childWsMeta) {
    // Test openWorkspace
    const universeWs = await workspaceManager.openWorkspace(testUser.email, 'universe');
    if (!universeWs) throw new Error('Failed to open universe workspace');
    console.log('✓ Universe workspace opened successfully');

    // Test isOpen
    if (!workspaceManager.isOpen(testUser.email, 'universe')) {
        throw new Error('isOpen check failed for universe workspace');
    }
    console.log('✓ isOpen check passed');

    // Test startWorkspace
    const startedWs = await workspaceManager.startWorkspace(testUser.email, 'universe');
    if (!startedWs) throw new Error('Failed to start universe workspace');
    if (startedWs.status !== WORKSPACE_STATUS_CODES.ACTIVE) {
        throw new Error('Workspace not in ACTIVE state after start');
    }
    console.log('✓ Universe workspace started successfully');

    // Test isActive
    if (!workspaceManager.isActive(testUser.email, 'universe')) {
        throw new Error('isActive check failed for universe workspace');
    }
    console.log('✓ isActive check passed');

    // Test stopWorkspace
    const stopped = await workspaceManager.stopWorkspace(testUser.email, 'universe');
    if (!stopped) throw new Error('Failed to stop universe workspace');
    console.log('✓ Universe workspace stopped successfully');

    // Test closeWorkspace
    const closed = await workspaceManager.closeWorkspace(testUser.email, 'universe');
    if (!closed) throw new Error('Failed to close universe workspace');
    console.log('✓ Universe workspace closed successfully');

    // Test listWorkspaces
    const userWorkspaces = workspaceManager.listWorkspaces(testUser.email);
    if (userWorkspaces.length !== 6) {
        throw new Error(`Expected 6 workspaces, found ${userWorkspaces.length}`);
    }
    console.log('✓ listWorkspaces returned correct number of workspaces');
}

/**
 * Test 4: Test workspace configuration operations
 */
async function testWorkspaceConfig(universeWsMeta, parentWsMeta) {
    // Test getWorkspaceConfig
    const universeConfig = await workspaceManager.getWorkspaceConfig(testUser.email, 'universe');
    if (!universeConfig) throw new Error('Failed to get universe workspace config');
    console.log('✓ getWorkspaceConfig successful');

    // Test updateWorkspaceConfig
    const updates = {
        label: 'Updated Universe',
        description: 'Updated description',
        color: '#ff0000'
    };
    const updated = await workspaceManager.updateWorkspaceConfig(testUser.email, 'universe', updates);
    if (!updated) throw new Error('Failed to update universe workspace config');
    console.log('✓ updateWorkspaceConfig successful');

    // Verify updates
    const updatedConfig = await workspaceManager.getWorkspaceConfig(testUser.email, 'universe');
    if (updatedConfig.label !== updates.label ||
        updatedConfig.description !== updates.description ||
        updatedConfig.color !== updates.color) {
        throw new Error('Workspace config updates not applied correctly');
    }
    console.log('✓ Config updates verified');
}

/**
 * Test 5: Test workspace cleanup
 */
async function testWorkspaceCleanup(universeWsMeta, parentWsMeta, childWsMeta) {
    // Test removeWorkspace (without destroying data)
    const removed = await workspaceManager.removeWorkspace(testUser.email, 'child-ws', false);
    if (!removed) throw new Error('Failed to remove child workspace');
    if (!existsSync(childWsMeta.rootPath)) {
        throw new Error('Workspace directory was deleted when destroyData was false');
    }
    console.log('✓ Workspace removed from index (data preserved)');

    // Test removeWorkspace (with destroying data)
    const destroyed = await workspaceManager.removeWorkspace(testUser.email, 'parent-ws', true);
    if (!destroyed) throw new Error('Failed to destroy parent workspace');
    if (existsSync(parentWsMeta.rootPath)) {
        throw new Error('Workspace directory was not deleted when destroyData was true');
    }
    console.log('✓ Workspace removed and data destroyed');

    // Verify index state
    const workspaces = workspaceManager.index;
    if (workspaces[testUser.email].length !== 4) {
        throw new Error('Incorrect number of workspaces in index after cleanup');
    }
    console.log('✓ Index state verified after cleanup');
}

// Run the test suite
testWorkspaceManager().catch(error => {
    console.error('Test Suite Failed:', error);
    process.exit(1);
});
