'use strict'

import WorkspaceManager, { WORKSPACE_STATUS } from '../src/managers/workspace/index.js'
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { existsSync } from 'fs';

const rootPath = path.join(os.tmpdir(), 'canvas-test-wsroot');
const customPath = path.join(os.tmpdir(), 'canvas-test-custom-ws');
const exportDir = path.join(os.tmpdir(), 'canvas-test-export');

// NOTE: Tests rely on sequential execution and cleanup

async function cleanup() {
    console.log('--- Cleaning up previous test artifacts ---');
    try {
        await fs.rm(rootPath, { recursive: true, force: true });
        console.log(`Removed: ${rootPath}`);
    } catch (err) { if (err.code !== 'ENOENT') console.error(`Cleanup error for ${rootPath}:`, err); }
    try {
        await fs.rm(customPath, { recursive: true, force: true });
        console.log(`Removed: ${customPath}`);
    } catch (err) { if (err.code !== 'ENOENT') console.error(`Cleanup error for ${customPath}:`, err); }
     try {
        await fs.rm(exportDir, { recursive: true, force: true });
        console.log(`Removed: ${exportDir}`);
    } catch (err) { if (err.code !== 'ENOENT') console.error(`Cleanup error for ${exportDir}:`, err); }

    // Need to clean the default config path used by the manager instance
    const managerConfigPath = path.join(rootPath, 'config'); // Default path construction
    if (existsSync(managerConfigPath)) { // Check existence before removing
        try {
            await fs.rm(managerConfigPath, { recursive: true, force: true });
            console.log(`Removed manager config: ${managerConfigPath}`);
        } catch (err) { if (err.code !== 'ENOENT') console.error(`Cleanup error for ${managerConfigPath}:`, err); }
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
        configPath: managerConfigPath // Explicitly provide config path
    });

    // --- Test Initial State --- (Manager does initial scan)
    console.log('\n--- Testing Initial State ---');
    console.log('Root Path: ', wm.rootPath);
    console.log('Config Path: ', wm.configPath);
    console.log('Initial Index: ', JSON.stringify(wm.index, null, 2)); // Should be empty
    console.log('Initial Loaded Workspaces (wm.workspaces): ', wm.workspaces); // Should be empty array
    console.log('Initial Active Workspaces: ', wm.activeWorkspaces); // Should be empty array
    if (Object.keys(wm.index).length !== 0) console.error('FAIL: Index not empty initially');
    if (wm.listLoadedWorkspaces(testUserID).length !== 0) console.error('FAIL: Loaded workspaces not empty initially');

    // --- Test createWorkspace --- Creates entry in index, but NOT loaded initially
    console.log('\n--- Testing createWorkspace ---');
    let ws1Meta, wsCustomMeta;
    try {
        ws1Meta = await wm.createWorkspace(testUserID, 'test-ws-1', { description: 'My First Test WS' });
        console.log('Created ws1 (metadata): ', ws1Meta);
        if (!existsSync(ws1Meta.rootPath)) throw new Error(`WS1 directory not created at ${ws1Meta.rootPath}`);
        if (!existsSync(path.join(ws1Meta.rootPath, 'workspace.json'))) throw new Error(`WS1 workspace.json not created`);
        console.log('WS1 directory and config file created successfully.');
        if (!wm.index[ws1Meta.id]) throw new Error('WS1 not found in index after creation.');
        if (wm.isLoaded(testUserID, ws1Meta.id)) console.error('FAIL: Workspace loaded immediately after creation.');
        else console.log('PASS: Workspace not loaded immediately after creation.');

        wsCustomMeta = await wm.createWorkspace(testUserID, 'custom-path-ws', { path: customPath });
        console.log('Created custom path ws (metadata): ', wsCustomMeta);
        if (!existsSync(wsCustomMeta.rootPath)) throw new Error(`Custom WS directory not created at ${wsCustomMeta.rootPath}`);
        if (!existsSync(path.join(wsCustomMeta.rootPath, 'workspace.json'))) throw new Error(`Custom WS workspace.json not created`);
        console.log('Custom WS directory and config file created successfully.');
        if (!wm.index[wsCustomMeta.id]) throw new Error('Custom WS not found in index after creation.');
        if (wm.isLoaded(testUserID, wsCustomMeta.id)) console.error('FAIL: Custom workspace loaded immediately after creation.');
        else console.log('PASS: Custom workspace not loaded immediately after creation.');

        console.log('Index after creation: ', JSON.stringify(wm.index, null, 2));
        console.log('Loaded Workspaces after creation: ', wm.listLoadedWorkspaces(testUserID).map(ws => ws.id));

    } catch (err) {
        console.error('Error during createWorkspace: ', err);
        return; // Stop test if creation fails
    }
    // Test duplicate creation (should fail)
    try {
        await wm.createWorkspace(testUserID, 'test-ws-1');
        console.error('FAIL: Allowed duplicate workspace ID creation.');
    } catch (err) {
        console.log('PASS: Prevented duplicate workspace ID creation:', err.message);
    }
     try {
        await wm.createWorkspace(testUserID, 'another-ws-custom', { path: customPath });
        console.error('FAIL: Allowed duplicate workspace path creation.');
    } catch (err) {
        console.log('PASS: Prevented duplicate workspace path creation:', err.message);
    }

    // --- Test openWorkspace --- Loads instance into memory
    console.log('\n--- Testing openWorkspace ---');
    let ws1Loaded;
    try {
        ws1Loaded = await wm.openWorkspace(testUserID, ws1Meta.id);
        if (!ws1Loaded) throw new Error(`openWorkspace failed for ${ws1Meta.id}`);
        console.log(`Opened ws1 (ID: ${ws1Loaded.id}), Status: ${ws1Loaded.status}`);
        if (!wm.isLoaded(testUserID, ws1Meta.id)) throw new Error('ws1 not marked as loaded after open.');
        const loadedWorkspaces = wm.listLoadedWorkspaces(testUserID);
        if (loadedWorkspaces.length !== 1) throw new Error(`Incorrect number of loaded workspaces after open: ${loadedWorkspaces.length}`);
        console.log('Loaded Workspaces after open: ', loadedWorkspaces.map(ws => ws.id));
        const ws1Status = wm.getWorkspaceStatus(testUserID, ws1Meta.id);
        console.log('WS1 status in index after open: ', ws1Status); // Should be AVAILABLE
        if (ws1Status !== WORKSPACE_STATUS.AVAILABLE) {
            console.warn('WARN: WS1 status in index not AVAILABLE after open.', ws1Status);
        }
    } catch (err) {
         console.error('Error during openWorkspace: ', err);
         return; // Stop if open fails
    }
    // Test opening already loaded
    try {
        const ws1Again = await wm.openWorkspace(testUserID, ws1Meta.id);
        if (ws1Again !== ws1Loaded) throw new Error('Opening already loaded WS did not return same instance.');
        console.log('PASS: Opening already loaded workspace returned same instance.');
    } catch (err) {
        console.error('FAIL: Error opening already loaded workspace: ', err);
    }

    // --- Test startWorkspace --- Activates a loaded instance
    console.log('\n--- Testing startWorkspace ---');
    let ws1Active;
    try {
        ws1Active = await wm.startWorkspace(testUserID, ws1Meta.id);
        if (!ws1Active) throw new Error('startWorkspace failed to return an instance.');
        console.log(`Started ws1 (ID: ${ws1Active.id}), Status: ${ws1Active.status}`); // Status from instance
        console.log('Active Workspaces after start: ', wm.listActiveWorkspaces(testUserID).map(ws => ws.id));
        const ws1StatusIndex = wm.getWorkspaceStatus(testUserID, ws1Meta.id);
        console.log('WS1 status in index: ', ws1StatusIndex); // Status from index
        if (ws1Active.status !== WORKSPACE_STATUS.ACTIVE) {
            throw new Error(`Instance status not ${WORKSPACE_STATUS.ACTIVE} after start.`);
        }
        if (ws1StatusIndex !== WORKSPACE_STATUS.ACTIVE) {
            throw new Error(`Index status not ${WORKSPACE_STATUS.ACTIVE} after start.`);
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
        let success = await wm.setWorkspaceProperty(testUserID, ws1Meta.id, 'label', 'My Test Label');
        if (!success) throw new Error('setWorkspaceProperty for label failed');
        console.log('Set label successfully.');
        // Verify on instance
        if (ws1Active.label !== 'My Test Label') throw new Error('Instance label not updated.');
        console.log('Instance label updated correctly.');

        success = await wm.setWorkspaceProperty(testUserID, ws1Meta.id, 'color', '#123456');
        if (!success) throw new Error('setWorkspaceProperty for color failed');
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
        console.log('Active Workspaces after stop: ', wm.listActiveWorkspaces(testUserID).map(ws => ws.id)); // Should be empty
        // Use wm.getWorkspace to check instance status after potential stop/close
        const stoppedWsInstance = wm.getWorkspace(testUserID, ws1Meta.id);
        console.log('WS1 instance status (after stop): ', stoppedWsInstance?.status); // Check instance status
        console.log('WS1 index status: ', ws1StatusIndex); // Check index status
        if (ws1Active.status !== WORKSPACE_STATUS.INACTIVE) {
            throw new Error(`Instance status not ${WORKSPACE_STATUS.INACTIVE} after stop.`);
        }
        if (ws1StatusIndex !== WORKSPACE_STATUS.INACTIVE) {
             throw new Error(`Index status not ${WORKSPACE_STATUS.INACTIVE} after stop.`);
        }
    } catch (err) {
        console.error('Error during stopWorkspace: ', err);
    }
     // Test stopping inactive (should return true gracefully)
     try {
        const stoppedAgain = await wm.stopWorkspace(testUserID, ws1Meta.id);
        if (!stoppedAgain) {
            console.error('FAIL: stopWorkspace returned false for already inactive workspace.')
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
             console.log(`PASS: stopWorkspace handled non-existent/unloaded workspace ID (${nonExistentId}) gracefully (returned true).`);
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
        if (wm.isLoaded(testUserID, ws1Meta.id)) throw new Error('Workspace still loaded after close.');
        console.log('Loaded workspaces after close: ', wm.listLoadedWorkspaces(testUserID).map(ws => ws.id)); // Should be empty
        console.log('WS1 index status after close: ', wm.getWorkspaceStatus(testUserID, ws1Meta.id)); // Should remain INACTIVE
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
        let success = await wm.setWorkspaceProperty(testUserID, ws1Meta.id, 'description', 'Updated Description');
        if (!success) throw new Error('setWorkspaceProperty for description failed on closed WS');
        console.log('Set description successfully on closed WS.');

        // Read workspace.json to verify file change
        const ws1ConfigRaw = await fs.readFile(path.join(ws1Meta.rootPath, 'workspace.json'), 'utf8');
        const ws1Config = JSON.parse(ws1ConfigRaw);
        console.log('Updated ws1 config file content:', ws1Config);
        if (ws1Config.description !== 'Updated Description') {
            throw new Error('Workspace config file not updated correctly by setWorkspaceProperty on closed WS.');
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
        exportPath = await wm.exportWorkspace(testUserID, ws1Meta.id, exportDir);
        console.log(`Exported ws1 to: ${exportPath}`);
        if (!existsSync(exportPath)) throw new Error(`Exported zip file not found at ${exportPath}`);
        console.log('PASS: Exported zip file exists.');
    } catch (err) {
        console.error('Error during exportWorkspace: ', err);
    }
     // Test exporting active (start wsCustom first)
    let wsCustomLoaded, wsCustomActive;
    try {
         wsCustomLoaded = await wm.openWorkspace(testUserID, wsCustomMeta.id);
         wsCustomActive = await wm.startWorkspace(testUserID, wsCustomMeta.id);
         console.log('Opened and started custom ws for export test.');
         await wm.exportWorkspace(testUserID, wsCustomMeta.id, exportDir);
         console.error('FAIL: Allowed exporting an active workspace.');
    } catch (err) {
         console.log('PASS: Prevented exporting an active workspace:', err.message);
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
        if (wm.isLoaded(testUserID, ws1Meta.id)) {
            await wm.closeWorkspace(testUserID, ws1Meta.id); // Close it first if loaded
        }
        const destroyedOriginal = await wm.destroyWorkspace(testUserID, ws1Meta.id);
        if (!destroyedOriginal) {
            throw new Error(`Failed to destroy original workspace ${ws1Meta.id} before import.`);
        }
        console.log(`Original ws1 (${ws1Meta.id}) destroyed successfully.`);

        importedWsMeta = await wm.importWorkspace(exportPath, testUserID); // Import from zip
        console.log('Imported workspace (metadata): ', importedWsMeta);
        if (!existsSync(importedWsMeta.rootPath)) throw new Error(`Imported WS directory not created at ${importedWsMeta.rootPath}`);
        const importedStatus = wm.getWorkspaceStatus(testUserID, importedWsMeta.id);
        if (importedStatus !== WORKSPACE_STATUS.AVAILABLE) { // Status should be AVAILABLE after import now
            throw new Error('Imported workspace index status is not ' + WORKSPACE_STATUS.AVAILABLE + ". Got: " + importedStatus);
        }
        if (wm.isLoaded(testUserID, importedWsMeta.id)) {
            console.error('FAIL: Workspace loaded immediately after import.');
        } else {
            console.log('PASS: Workspace not loaded immediately after import.');
        }
        console.log('PASS: Workspace imported successfully from zip.');

        // Open and Start the imported workspace
        const importedWsOpened = await wm.openWorkspace(testUserID, importedWsMeta.id);
        if (!importedWsOpened) throw new Error('Failed to open imported workspace.');
        console.log('Opened imported workspace.');
        const importedWsActive = await wm.startWorkspace(testUserID, importedWsMeta.id);
        if (!importedWsActive) throw new Error('Failed to start imported workspace.');
        console.log(`Started imported ws (ID: ${importedWsActive.id}), Label: ${importedWsActive.label}, Desc: ${importedWsActive.description}`);
        if (importedWsActive.label !== 'My Test Label' || importedWsActive.description !== 'Updated Description') {
            console.warn('WARN: Imported workspace did not retain properties set before export.');
        } else {
             console.log('PASS: Imported workspace retained properties.');
        }
        await wm.stopWorkspace(testUserID, importedWsMeta.id);
        await wm.closeWorkspace(testUserID, importedWsMeta.id);

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
             await wm.importWorkspace(exportPath, testUserID);
             console.error('FAIL: Allowed importing workspace with duplicate ID.');
        }
    } catch (err) {
        if (importedWsMeta) { // Only log pass if the test was actually attempted
             console.log('PASS: Prevented importing workspace with duplicate ID:', err.message);
        }
    }


    // --- Test removeWorkspace --- Removes from index, leaves files
    console.log('\n--- Testing removeWorkspace ---');
    try {
        // Use the imported workspace ID which should exist in index (status IMPORTED or AVAILABLE)
        const importedId = importedWsMeta?.id;
        if (!importedId || !wm.index[importedId]) throw new Error('Imported workspace ID not available in index for remove test.');
        const importedPath = wm.index[importedId].rootPath; // Get path before removing

        const removed = await wm.removeWorkspace(testUserID, importedId);
        if (!removed) throw new Error(`removeWorkspace returned false for existing workspace ${importedId}`);
        console.log(`Removed workspace ${importedId} from index.`);
        if (wm.index[importedId]) throw new Error('Workspace still present in index after removal.');
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
        // Create one last workspace to destroy
        const destroyMeta = await wm.createWorkspace(testUserID, 'to-be-destroyed');
        const destroyId = destroyMeta.id;
        const destroyPath = destroyMeta.path;
        console.log(`Created workspace ${destroyId} for destroy test.`);

        // Open and Start it first to test destroying an active workspace
        const destroyOpened = await wm.openWorkspace(testUserID, destroyId);
        const destroyActive = await wm.startWorkspace(testUserID, destroyId);
        console.log(`Opened and started workspace ${destroyId} before destroy test.`);

        const destroyed = await wm.destroyWorkspace(testUserID, destroyId);
        if (!destroyed) throw new Error(`destroyWorkspace returned false for existing workspace ${destroyId}`);
        console.log(`Destroyed workspace ${destroyId}.`);
        if (wm.index[destroyId]) throw new Error('Workspace still present in index after destroy.');
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
