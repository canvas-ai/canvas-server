'use strict';

import WorkspaceManager, { WORKSPACE_STATUS_CODES } from '../src/managers/workspace/index.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { existsSync } from 'fs';
import Jim from '../src/utils/jim/index.js';

const jim = new Jim({
    rootPath: path.join(os.tmpdir(), 'canvas-test-wsroot'),
});

const rootPath = path.join(os.tmpdir(), 'canvas-test-wsroot');
const customPath = path.join(os.tmpdir(), 'canvas-test-custom-ws');
const exportDir = path.join(os.tmpdir(), 'canvas-test-export');

// NOTE: Tests rely on sequential execution and cleanup

async function cleanup() {
    console.log('--- Cleaning up previous test artifacts ---');
    try {
        await fs.rm(rootPath, { recursive: true, force: true });
        console.log(`Removed: ${rootPath}`);
    } catch (err) {
        if (err.code !== 'ENOENT') console.error(`Cleanup error for ${rootPath}:`, err);
    }
    try {
        await fs.rm(customPath, { recursive: true, force: true });
        console.log(`Removed: ${customPath}`);
    } catch (err) {
        if (err.code !== 'ENOENT') console.error(`Cleanup error for ${customPath}:`, err);
    }
    try {
        await fs.rm(exportDir, { recursive: true, force: true });
        console.log(`Removed: ${exportDir}`);
    } catch (err) {
        if (err.code !== 'ENOENT') console.error(`Cleanup error for ${exportDir}:`, err);
    }

    // Need to clean the default config path used by the manager instance
    const managerConfigPath = path.join(rootPath, 'config'); // Default path construction
    if (existsSync(managerConfigPath)) {
        // Check existence before removing
        try {
            await fs.rm(managerConfigPath, { recursive: true, force: true });
            console.log(`Removed manager config: ${managerConfigPath}`);
        } catch (err) {
            if (err.code !== 'ENOENT') console.error(`Cleanup error for ${managerConfigPath}:`, err);
        }
    }
    console.log('Cleanup complete.');
}

async function runTests() {
    await cleanup();
    console.log('--- Starting WorkspaceManager Tests ---');

    // Define a consistent user ID for testing
    const testUserID = 'testuser@example.com';
    console.log(`Using test user ID: ${testUserID}`);

    // Define paths for the test
    const managerConfigDir = path.join(rootPath, 'config');
    const managerConfigPath = path.join(managerConfigDir);

    // Create a new manager instance AFTER cleanup to ensure clean index
    const wm = new WorkspaceManager({
        rootPath: rootPath, // Use workspaceRootPath instead of rootPath
        jim: jim, // Updated to pass jim directly
    });

    // Verify composed ID format generation
    console.log('\n--- Testing ID format ---');
    const testName = 'My Test Workspace';
    const composedId = `${testUserID}/${WorkspaceManager.sanitizeWorkspaceName(testName)}`;
    console.log(`Example composed ID for "${testName}": ${composedId}`);

    // --- Test Initial State --- (Manager does initial scan)
    console.log('\n--- Testing Initial State ---');
    console.log('Root Path: ', wm.rootPath);
    console.log('Initial Index: ', JSON.stringify(wm.index, null, 2)); // Should be empty array
    const initialOpenCount = wm.index.filter(ws => wm.isOpen(testUserID, ws.id)).length;
    console.log('Initial Open Workspaces (isOpen): ', initialOpenCount); // Should be 0
    const initialActiveCount = wm.index.filter(ws => wm.isActive(testUserID, ws.id)).length;
    console.log('Initial Active Workspaces (isActive): ', initialActiveCount); // Should be 0
    if (!Array.isArray(wm.index) || wm.index.length !== 0) console.error('FAIL: Index not an empty array initially');
    if (initialOpenCount !== 0) console.error('FAIL: Open workspaces not empty initially');
    if (initialActiveCount !== 0) console.error('FAIL: Active workspaces not empty initially');

    // --- Test createWorkspace --- Creates entry in index, but NOT loaded initially
    console.log('\n--- Testing createWorkspace ---');
    let ws1Meta, wsCustomMeta;
    try {
        ws1Meta = await wm.createWorkspace('test-ws-1', testUserID, {
            description: 'My First Test WS',
        });
        console.log('Created ws1 (metadata): ', ws1Meta);

        // Check that ID follows the new format (user.email/workspace.id)
        const expectedId = `${testUserID}/${WorkspaceManager.sanitizeWorkspaceName('test-ws-1')}`;
        if (ws1Meta.id !== expectedId) {
            console.error(`FAIL: Workspace ID ${ws1Meta.id} does not match expected format ${expectedId}`);
        } else {
            console.log(`PASS: Workspace ID ${ws1Meta.id} follows correct format`);
        }

        if (!existsSync(ws1Meta.rootPath)) throw new Error(`WS1 directory not created at ${ws1Meta.rootPath}`);
        if (!existsSync(path.join(ws1Meta.rootPath, 'workspace.json'))) throw new Error(`WS1 workspace.json not created`);
        console.log('WS1 directory and config file created successfully.');
        if (!wm.index.find((ws) => ws.id === ws1Meta.id)) throw new Error('WS1 not found in index after creation.');
        if (wm.isOpen(testUserID, ws1Meta.id)) console.error('FAIL: Workspace open immediately after creation.');
        else console.log('PASS: Workspace not loaded immediately after creation.');

        // Create second workspace using the default rootPath (don't specify in options)
        wsCustomMeta = await wm.createWorkspace('custom-path-ws', testUserID);
        console.log('Created custom path ws (metadata): ', wsCustomMeta);

        // Check that ID follows the new format
        const expectedCustomId = `${testUserID}/${WorkspaceManager.sanitizeWorkspaceName('custom-path-ws')}`;
        if (wsCustomMeta.id !== expectedCustomId) {
            console.error(`FAIL: Custom WS ID ${wsCustomMeta.id} does not match expected format ${expectedCustomId}`);
        } else {
            console.log(`PASS: Custom WS ID ${wsCustomMeta.id} follows correct format`);
        }

        if (!existsSync(wsCustomMeta.rootPath)) throw new Error(`Custom WS directory not created at ${wsCustomMeta.rootPath}`);
        if (!existsSync(path.join(wsCustomMeta.rootPath, 'workspace.json')))
            throw new Error(`Custom WS workspace.json not created`);
        console.log('Custom WS directory and config file created successfully.');
        // Check if it was created in the correct default location
        const expectedCustomPath = path.join(rootPath, testUserID, 'custom-path-ws');
        if (wsCustomMeta.rootPath !== expectedCustomPath) {
            console.error(
                `FAIL: Custom WS created at wrong path. Expected ${expectedCustomPath}, got ${wsCustomMeta.rootPath}`,
            );
        } else {
            console.log(`PASS: Custom WS created at default path ${expectedCustomPath}`);
        }
        if (!wm.index.find((ws) => ws.id === wsCustomMeta.id))
            throw new Error('Custom WS not found in index after creation.');
        if (wm.isOpen(testUserID, wsCustomMeta.id))
            console.error('FAIL: Custom workspace open immediately after creation.');
        else console.log('PASS: Custom workspace not loaded immediately after creation.');

        console.log('Index after creation: ', JSON.stringify(wm.index, null, 2));
        console.log(
            'Loaded Workspaces after creation: ',
            wm.index.filter(ws => wm.isOpen(testUserID, ws.id)).map(ws => ws.id)
        );
    } catch (err) {
        console.error('Error during createWorkspace: ', err);
        return; // Stop test if creation fails
    }

    // Test universe workspace unique constraint
    try {
        // Try creating a universe workspace for the user
        await wm.createWorkspace('universe', testUserID);

        // Then try creating another one - should fail
        await wm.createWorkspace('universe', testUserID);
        console.error('FAIL: Allowed creating multiple universe workspaces for the same user.');
    } catch (err) {
        if (err.message.includes('already has a universe workspace')) {
            console.log('PASS: Prevented creating multiple universe workspaces for the same user:', err.message);
        } else {
            console.error('ERROR: Unexpected error during universe workspace test:', err.message);
        }
    }

    // Test duplicate creation (should fail)
    try {
        // Try creating with same name (implies same ID) in the default path
        await wm.createWorkspace('test-ws-1', testUserID);
        console.error('FAIL: Allowed duplicate workspace ID creation.');
    } catch (err) {
        console.log('PASS: Prevented duplicate workspace ID creation:', err.message);
    }
    try {
        // Try creating another workspace that would resolve to the same path as wsCustomMeta
        await wm.createWorkspace('custom-path-ws', testUserID);
        console.error('FAIL: Allowed duplicate workspace path creation.');
    } catch (err) {
        console.log('PASS: Prevented duplicate workspace path creation:', err.message);
    }

    // --- Test getWorkspaceIdByName --- New format support
    console.log('\n--- Testing getWorkspaceIdByName ---');
    // REMOVED - getWorkspaceIdByName not part of simplified API
    // Caller should resolve ID or use short names in methods that support it.
    /*
    try {
        // Test exact match
        const exactId = wm.getWorkspaceIdByName(testUserID, 'test-ws-1');
        if (exactId !== ws1Meta.id) {
            console.error(`FAIL: getWorkspaceIdByName failed for exact match. Expected ${ws1Meta.id}, got ${exactId}`);
        } else {
            console.log(`PASS: getWorkspaceIdByName works for exact match: ${exactId}`);
        }

        // Test sanitized match
        const sanitizedId = wm.getWorkspaceIdByName(testUserID, 'Test Ws 1');
        if (sanitizedId !== ws1Meta.id) {
            console.error(`FAIL: getWorkspaceIdByName failed for sanitized match. Expected ${ws1Meta.id}, got ${sanitizedId}`);
        } else {
            console.log(`PASS: getWorkspaceIdByName works for sanitized match: ${sanitizedId}`);
        }

        // Test non-existent
        const nonExistentId = wm.getWorkspaceIdByName(testUserID, 'non-existent-ws');
        if (nonExistentId) {
            console.error(`FAIL: getWorkspaceIdByName returned ID for non-existent workspace: ${nonExistentId}`);
        } else {
            console.log('PASS: getWorkspaceIdByName returns null for non-existent workspace');
        }
    } catch (err) {
        console.error('Error during getWorkspaceIdByName tests:', err);
    }
    */

    // --- Test openWorkspace --- Loads instance into memory
    console.log('\n--- Testing openWorkspace ---');
    let ws1Loaded;
    try {
        ws1Loaded = await wm.openWorkspace(testUserID, ws1Meta.id);
        if (!ws1Loaded) throw new Error(`openWorkspace failed for ${ws1Meta.id}`);
        console.log(`Opened ws1 (ID: ${ws1Loaded.id}), Status: ${ws1Loaded.status}`);
        if (!wm.isOpen(testUserID, ws1Meta.id)) throw new Error('ws1 not marked as open after open.');
        const loadedWorkspaces = wm.index.filter(ws => wm.isOpen(testUserID, ws.id));
        if (loadedWorkspaces.length !== 1)
            throw new Error(`Incorrect number of loaded workspaces after open: ${loadedWorkspaces.length}`);
        console.log(
            'Loaded Workspaces after open: ',
            loadedWorkspaces.map((ws) => ws.id),
        );
        const ws1Entry = wm.index.find(ws => ws.id === ws1Meta.id);
        const ws1Status = ws1Entry ? ws1Entry.status : 'NOT_FOUND_IN_INDEX';
        console.log('WS1 status in index after open: ', ws1Status); // Should be AVAILABLE
        if (ws1Status !== WORKSPACE_STATUS_CODES.AVAILABLE) {
            console.warn('WARN: WS1 status in index not AVAILABLE after open.', ws1Status);
        }
    } catch (err) {
        console.error('Error during openWorkspace: ', err);
        return; // Stop if open fails
    }

    // Test opening with just the workspace name part (should work with our new format)
    try {
        // Extract just the workspace name part from the composed ID
        const workspaceNamePart = ws1Meta.id.split('/')[1];
        const wsOpenedByName = await wm.openWorkspace(testUserID, workspaceNamePart);
        if (!wsOpenedByName) {
            console.error(`FAIL: Could not open workspace using just name part "${workspaceNamePart}"`);
        } else {
            console.log(`PASS: Successfully opened workspace using just name part "${workspaceNamePart}"`);
        }
    } catch (err) {
        console.error('Error opening workspace by name part:', err);
    }

    // --- Test startWorkspace --- Activates a loaded instance
    console.log('\n--- Testing startWorkspace ---');
    let ws1Active;
    try {
        ws1Active = await wm.startWorkspace(testUserID, ws1Meta.id);
        if (!ws1Active) throw new Error('startWorkspace failed to return an instance.');
        console.log(`Started ws1 (ID: ${ws1Active.id}), Status: ${ws1Active.status}`); // Status from instance
        console.log(
            'Active Workspaces after start: ',
            wm.index.filter(ws => wm.isActive(testUserID, ws.id)).map((ws) => ws.id),
        );
        const ws1EntryStart = wm.index.find(ws => ws.id === ws1Meta.id);
        const ws1StatusIndex = ws1EntryStart ? ws1EntryStart.status : 'NOT_FOUND_IN_INDEX';
        console.log('WS1 status in index: ', ws1StatusIndex); // Status from index
        if (ws1Active.status !== WORKSPACE_STATUS_CODES.ACTIVE) {
            throw new Error(`Instance status not ${WORKSPACE_STATUS_CODES.ACTIVE} after start.`);
        }
        if (ws1StatusIndex !== WORKSPACE_STATUS_CODES.ACTIVE) {
            throw new Error(`Index status not ${WORKSPACE_STATUS_CODES.ACTIVE} after start.`);
        }
    } catch (err) {
        console.error('Error during startWorkspace: ', err);
        return; // Stop test if start fails
    }
    // Test starting already active (should return same instance)
    try {
        const ws1Again = await wm.startWorkspace(testUserID, ws1Meta.id);
        if (ws1Again !== ws1Active) throw new Error('Starting already active WS did not return same instance.');
        console.log('PASS: Starting already active workspace returned same instance.');
    } catch (err) {
        console.error('FAIL: Error starting already active workspace: ', err);
    }
    // Test starting non-existent
    try {
        const startedNonExistent = await wm.startWorkspace(testUserID, 'non-existent-ws');
        if (startedNonExistent) console.error('FAIL: Allowed starting non-existent workspace.');
        else console.log('PASS: Prevented starting non-existent workspace (returned null/false).');
    } catch (err) {
        // Should ideally return null/false, not throw, check startWorkspace logic
        console.warn('WARN: Starting non-existent workspace threw error instead of returning null/false:', err.message);
        console.log('PASS: Prevented starting non-existent workspace (threw error).');
    }

    // --- Test setWorkspaceProperty (on active) --- Should update instance and file
    console.log('\n--- Testing setWorkspaceProperty (on active) ---');
    try {
        let success = await wm.updateWorkspaceConfig(testUserID, ws1Meta.id, { label: 'My Test Label'});
        if (!success) throw new Error('updateWorkspaceConfig for label failed');
        console.log('Set label successfully.');
        // Verify on instance
        if (ws1Active.label !== 'My Test Label') throw new Error('Instance label not updated.');
        console.log('Instance label updated correctly.');

        success = await wm.updateWorkspaceConfig(testUserID, ws1Meta.id, { color: '#123456'});
        if (!success) throw new Error('updateWorkspaceConfig for color failed');
        console.log('Set color successfully.');
        // Verify on instance
        if (ws1Active.color !== '#123456') throw new Error('Instance color not updated.');
        console.log('Instance color updated correctly.');

        // Read workspace.json to verify file change
        const ws1ConfigRaw = await fs.readFile(path.join(ws1Meta.rootPath, 'workspace.json'), 'utf8');
        const ws1Config = JSON.parse(ws1ConfigRaw);
        console.log('Updated ws1 config file content:', ws1Config);
        if (ws1Config.label !== 'My Test Label' || ws1Config.color !== '#123456') {
            throw new Error('Workspace config file not updated correctly by setWorkspaceProperty.');
            throw new Error('Workspace config file not updated correctly by updateWorkspaceConfig.');
        }
        console.log('PASS: Workspace config file updated correctly.');
    } catch (err) {
        console.error('Error during setWorkspaceProperty: ', err);
    }

    // --- Test stopWorkspace --- Deactivates instance
    console.log('\n--- Testing stopWorkspace ---');
    try {
        const stopped = await wm.stopWorkspace(testUserID, ws1Meta.id);
        if (!stopped) throw new Error('stopWorkspace returned false for active workspace');
        console.log('Stopped ws1 successfully.');
        console.log(
            'Active Workspaces after stop: ',
            wm.index.filter(ws => wm.isActive(testUserID, ws.id)).map((ws) => ws.id),
        ); // Should be empty
        // Cannot reliably get instance after stop if close is called internally by stop
        // Let's check isOpen and the index status instead
        const isWs1OpenAfterStop = wm.isOpen(testUserID, ws1Meta.id);
        console.log(`WS1 open status (after stop): ${isWs1OpenAfterStop}`);

        // console.log('WS1 instance status (after stop): ', stoppedWsInstance?.status); // Check instance status
        const ws1EntryStop = wm.index.find(ws => ws.id === ws1Meta.id);
        const ws1StatusAfterStop = ws1EntryStop ? ws1EntryStop.status : 'NOT_FOUND_IN_INDEX';

        console.log('WS1 index status: ', ws1StatusAfterStop); // Check index status
        // Need to check isOpen because close might have removed it from cache
        if (isWs1OpenAfterStop && ws1Active.status !== WORKSPACE_STATUS_CODES.INACTIVE) {
            throw new Error(`Instance status not ${WORKSPACE_STATUS_CODES.INACTIVE} after stop.`);
        }
        if (ws1StatusAfterStop !== WORKSPACE_STATUS_CODES.INACTIVE) {
            throw new Error(`Index status not ${WORKSPACE_STATUS_CODES.INACTIVE} after stop.`);
        }
    } catch (err) {
        console.error('Error during stopWorkspace: ', err);
    }
    // Test stopping inactive (should return true gracefully)
    try {
        const stoppedAgain = await wm.stopWorkspace(testUserID, ws1Meta.id);
        if (!stoppedAgain) {
            console.error('FAIL: stopWorkspace returned false for already inactive workspace.');
        } else {
            console.log('PASS: stopWorkspace handled inactive workspace correctly (returned true).');
        }
    } catch (err) {
        console.error('FAIL: Error stopping inactive workspace: ', err);
    }
    // Test stopping non-existent / not loaded
    try {
        const nonExistentId = 'this-id-does-not-exist';
        const stoppedNonExistent = await wm.stopWorkspace(testUserID, nonExistentId);
        if (!stoppedNonExistent) {
            console.error(`FAIL: stopWorkspace returned false for non-existent ID: ${nonExistentId}`);
        } else {
            console.log(
                `PASS: stopWorkspace handled non-existent/unloaded workspace ID (${nonExistentId}) gracefully (returned true).`,
            );
        }
    } catch (err) {
        console.error(`FAIL: stopWorkspace threw an error for non-existent ID: ${err}`);
    }

    // --- Test closeWorkspace --- Removes instance from memory
    console.log('\n--- Testing closeWorkspace ---');
    try {
        const closed = await wm.closeWorkspace(testUserID, ws1Meta.id); // ws1 is currently stopped
        if (!closed) throw new Error('closeWorkspace returned false for stopped workspace');
        console.log('Closed ws1 successfully.');
        if (wm.isOpen(testUserID, ws1Meta.id)) throw new Error('Workspace still open after close.');
        console.log(
            'Loaded workspaces after close: ',
            wm.index.filter(ws => wm.isOpen(testUserID, ws.id)).map((ws) => ws.id),
        ); // Should be empty
        const ws1EntryClose = wm.index.find(ws => ws.id === ws1Meta.id);
        const ws1StatusClose = ws1EntryClose ? ws1EntryClose.status : 'NOT_FOUND_IN_INDEX';
        console.log('WS1 index status after close: ', ws1StatusClose); // Should remain INACTIVE
    } catch (err) {
        console.error('Error during closeWorkspace: ', err);
    }
    // Test closing already closed
    try {
        const closedAgain = await wm.closeWorkspace(testUserID, ws1Meta.id);
        if (!closedAgain) throw new Error('closeWorkspace returned false for already closed workspace');
        console.log('PASS: closeWorkspace handled already closed workspace gracefully.');
    } catch (err) {
        console.error('FAIL: Error closing already closed workspace: ', err);
    }

    // --- Test setWorkspaceProperty (on closed) --- Should only update file
    console.log('\n--- Testing setWorkspaceProperty (on closed) ---');
    try {
        let success = await wm.updateWorkspaceConfig(testUserID, ws1Meta.id, { description: 'Updated Description'});
        if (!success) throw new Error('setWorkspaceProperty for description failed on closed WS');
        console.log('Set description successfully on closed WS.');

        // Read workspace.json to verify file change
        const ws1ConfigRaw = await fs.readFile(path.join(ws1Meta.rootPath, 'workspace.json'), 'utf8');
        const ws1Config = JSON.parse(ws1ConfigRaw);
        console.log('Updated ws1 config file content:', ws1Config);
        if (ws1Config.description !== 'Updated Description') {
            throw new Error('Workspace config file not updated correctly by setWorkspaceProperty on closed WS.');
            throw new Error('Workspace config file not updated correctly by updateWorkspaceConfig on closed WS.');
        }
        console.log('PASS: Workspace config file updated correctly on closed WS.');
    } catch (err) {
        console.error('Error during setWorkspaceProperty on closed WS: ', err);
    }

    // --- Test exportWorkspace --- Requires workspace to be loaded but inactive (or just not active?)
    // Let's open ws1 again
    console.log('\n--- Testing exportWorkspace ---');
    let exportPath;
    try {
        ws1Loaded = await wm.openWorkspace(testUserID, ws1Meta.id);
        if (!ws1Loaded) throw new Error('Failed to re-open ws1 for export test.');
        console.log('Re-opened ws1 for export test.');

        await fs.mkdir(exportDir, { recursive: true });
        // REMOVED - Export not implemented
        console.log('SKIPPING export test - not implemented in simplified manager.');
        exportPath = null; // Ensure exportPath is null

    } catch (err) {
        console.error('Error during export test setup (re-opening ws1): ', err);
    }
    // Test exporting active (start wsCustom first)
    let wsCustomLoaded, wsCustomActive;
    try {
        wsCustomLoaded = await wm.openWorkspace(testUserID, wsCustomMeta.id);
        wsCustomActive = await wm.startWorkspace(testUserID, wsCustomMeta.id);
        console.log('Opened and started custom ws for export test.');
        // REMOVED - Export not implemented
        console.log('SKIPPING export test - not implemented in simplified manager.');
        console.log('PASS: (Skipped) Prevented exporting an active workspace:');
    } catch (err) {
        console.warn('Error during export active test setup: ', err);
    } finally {
        // Stop and close custom WS
        if (wsCustomActive) await wm.stopWorkspace(testUserID, wsCustomMeta.id);
        if (wsCustomLoaded) await wm.closeWorkspace(testUserID, wsCustomMeta.id);
    }

    // --- Test importWorkspace --- Adds entry to index with IMPORTED status
    console.log('\n--- Testing importWorkspace ---');
    let importedWsMeta;
    try {
        if (!exportPath) throw new Error('Cannot test import, export failed.');
        // Need to DESTROY the original before importing to avoid dir conflict or ID conflict
        console.log(`Destroying original ws1 (${ws1Meta.id}) before import test...`);
        if (wm.isOpen(testUserID, ws1Meta.id)) {
            await wm.closeWorkspace(testUserID, ws1Meta.id); // Close it first if open
        }
        const destroyedOriginal = await wm.removeWorkspace(testUserID, ws1Meta.id, true); // destroyData = true
        if (!destroyedOriginal) {
            throw new Error(`Failed to destroy original workspace ${ws1Meta.id} before import.`);
        }
        console.log(`Original ws1 (${ws1Meta.id}) destroyed successfully.`);

        // REMOVED - Import not implemented
        console.log('SKIPPING import test - not implemented in simplified manager.');
        importedWsMeta = null; // Ensure meta is null

        // Open and Start the imported workspace
        /*
        const importedWsOpened = await wm.openWorkspace(testUserID, importedWsMeta.id);
        if (!importedWsOpened) throw new Error('Failed to open imported workspace.');
        console.log('Opened imported workspace.');
        const importedWsActive = await wm.startWorkspace(testUserID, importedWsMeta.id);
        if (!importedWsActive) throw new Error('Failed to start imported workspace.');
        console.log(
            `Started imported ws (ID: ${importedWsActive.id}), Label: ${importedWsActive.label}, Desc: ${importedWsActive.description}`,
        );
        if (importedWsActive.label !== 'My Test Label' || importedWsActive.description !== 'Updated Description') {
            console.warn('WARN: Imported workspace did not retain properties set before export.');
        } else {
            console.log('PASS: Imported workspace retained properties.');
        }
        await wm.stopWorkspace(testUserID, importedWsMeta.id);
        await wm.closeWorkspace(testUserID, importedWsMeta.id);
        */
    } catch (err) {
        console.error('Error during importWorkspace: ', err);
        // If import failed, importedWsMeta might be undefined, skip duplicate test
        importedWsMeta = null; // Ensure it's null if there was an error
    }
    // Test importing duplicate ID (should fail)
    try {
        if (!exportPath) throw new Error('Export path missing for duplicate test');
        if (!importedWsMeta) {
            console.warn('Skipping duplicate import test because initial import failed.');
        } else {
            // Re-import the same zip - should fail due to existing ID in index
            // REMOVED - Import not implemented
            console.log('SKIPPING duplicate import test - not implemented.');
            // console.error('FAIL: Allowed importing workspace with duplicate ID.');
        }
    } catch (err) {
        if (importedWsMeta) {
            // Only log pass if the test was actually attempted
            console.log('PASS: Prevented importing workspace with duplicate ID:', err.message);
        }
    }

    // --- Test removeWorkspace --- Removes from index, leaves files
    console.log('\n--- Testing removeWorkspace ---');
    try {
        // Use the imported workspace ID which should exist in index (status IMPORTED or AVAILABLE)
        const importedId = importedWsMeta?.id;
        if (!importedId || !wm.index.find((ws) => ws.id === importedId))
            throw new Error('Imported workspace ID not available in index for remove test.');
        const importedPath = wm.index.find((ws) => ws.id === importedId).rootPath; // Get path before removing

        // Make sure the workspace isn't loaded
        if (wm.isOpen(testUserID, importedId)) {
            await wm.closeWorkspace(testUserID, importedId);
        }

        console.log(`Attempting to remove workspace ${importedId} from index...`);
        const removed = await wm.removeWorkspace(testUserID, importedId, false); // destroyData = false
        if (!removed) throw new Error(`removeWorkspace returned false for existing workspace ${importedId}`);
        console.log(`Removed workspace ${importedId} from index.`);
        if (wm.index.find((ws) => ws.id === importedId))
            throw new Error('Workspace still present in index after removal.');
        console.log('PASS: Workspace removed from index.');
        // Verify files still exist (this is the CORRECT behavior for removeWorkspace)
        if (existsSync(importedPath)) {
            console.log(`PASS: Workspace files correctly remain after removal at ${importedPath}.`);
            // Clean up the leftover directory from the removed-but-not-destroyed WS
            await fs.rm(importedPath, { recursive: true, force: true });
            console.log(`Cleaned up directory for removed workspace: ${importedPath}`);
        } else {
            console.error(`FAIL: removeWorkspace incorrectly deleted files at ${importedPath}`);
        }
    } catch (err) {
        console.error('Error during removeWorkspace: ', err);
    }

    // --- Test destroyWorkspace --- Removes from index and deletes files
    console.log('\n--- Testing destroyWorkspace ---');
    try {
        // Create one last workspace to destroy (using default path)
        const destroyMeta = await wm.createWorkspace('to-be-destroyed', testUserID);
        const destroyId = destroyMeta.id;
        const destroyPath = destroyMeta.rootPath; // Use rootPath from metadata
        console.log(`Created workspace ${destroyId} at ${destroyPath} for destroy test.`);

        // Open and Start it first to test destroying an active workspace
        await wm.startWorkspace(testUserID, destroyId);
        console.log(`Opened and started workspace ${destroyId} before destroy test.`);

        const destroyed = await wm.removeWorkspace(testUserID, destroyId, true); // destroyData = true
        if (!destroyed) throw new Error(`destroyWorkspace returned false for existing workspace ${destroyId}`);
        console.log(`Destroyed workspace ${destroyId}.`);
        if (wm.index.find((ws) => ws.id === destroyId))
            throw new Error('Workspace still present in index after destroy.');
        console.log('PASS: Workspace removed from index after destroy.');
        // Verify files are deleted
        if (existsSync(destroyPath)) {
            console.error(`FAIL: destroyWorkspace did not delete files at ${destroyPath}`);
        } else {
            console.log(`PASS: Workspace files deleted after destroy from ${destroyPath}.`);
        }
    } catch (err) {
        console.error('Error during destroyWorkspace: ', err);
    }

    console.log('\n--- WorkspaceManager Tests Complete ---');
}

runTests();
