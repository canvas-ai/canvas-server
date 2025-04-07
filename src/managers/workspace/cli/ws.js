#!/usr/bin/env node
'use strict';

import { Command, Option } from 'commander';
import path from 'path';
import os from 'os';
import WorkspaceManager from '../index.js'; // Adjust path if necessary

// --- Configuration ---
// Default root path for workspaces relative to the user's home directory
// TODO: Make this configurable via environment variable or config file?
const DEFAULT_WORKSPACE_ROOT = path.join(os.homedir(), 'canvas-workspaces');

// --- Initialize Workspace Manager ---
// Using a default root path for simplicity in the CLI
const manager = new WorkspaceManager({ rootPath: DEFAULT_WORKSPACE_ROOT });

const program = new Command();
program
    .name('ws')
    .description('Canvas Workspace Manager CLI')
    .version('0.1.0'); // TODO: Read from package.json?

// --- Top-Level Commands ---

program
    .command('create <name>')
    .description('Create a new workspace')
    .option('-p, --path <path>', 'Optional custom path for the workspace')
    .option('--owner <owner>', 'Workspace owner (required)', os.userInfo().username) // Default to current user
    .option('--port <port>', 'Enable REST API on specified port', parseInt)
    .option('--token <token>', 'Set a specific REST API token (auto-generates if port is set and token is missing)')
    .action(async (name, options) => {
        console.log(`Creating workspace "${name}" with owner "${options.owner}"...`);
        const createOptions = {
            owner: options.owner,
            path: options.path,
            restApi: {
                enabled: !!options.port,
                port: options.port || null,
                token: options.token || null,
            }
        };
        try {
            const meta = await manager.createWorkspace(name, createOptions);
            console.log('Workspace created successfully:');
            console.log(JSON.stringify(meta, null, 2));
        } catch (error) {
            console.error(`Error creating workspace: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command('import <sourcePath>')
    .description('Import a workspace from a zip file or directory')
    .option('--in-place', 'Import directory in place (no copy)', false)
    .action(async (sourcePath, options) => {
        console.log(`Importing workspace from "${sourcePath}"...`);
        try {
            const meta = await manager.importWorkspace(sourcePath, options.inPlace);
            console.log('Workspace imported successfully:');
            console.log(JSON.stringify(meta, null, 2));
        } catch (error) {
            console.error(`Error importing workspace: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command('export <workspaceId>')
    .description('Export a workspace to a zip file')
    .requiredOption('-d, --destination <path>', 'Destination path for the zip file (directory or full filepath)')
    .action(async (workspaceId, options) => {
        console.log(`Exporting workspace "${workspaceId}" to "${options.destination}"...`);
        try {
            const zipPath = await manager.exportWorkspace(workspaceId, options.destination);
            console.log(`Workspace exported successfully to: ${zipPath}`);
        } catch (error) {
            console.error(`Error exporting workspace: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command('start <workspaceId>')
    .description('Start a workspace instance')
    .action(async (workspaceId) => {
        console.log(`Starting workspace "${workspaceId}"...`);
        try {
            const workspace = await manager.startWorkspace(workspaceId);
            console.log(`Workspace "${workspace.id}" started successfully (Status: ${workspace.status}).`);
        } catch (error) {
            console.error(`Error starting workspace: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command('stop <workspaceId>')
    .description('Stop a running workspace instance')
    .action(async (workspaceId) => {
        console.log(`Stopping workspace "${workspaceId}"...`);
        try {
            const stopped = await manager.stopWorkspace(workspaceId);
            if (stopped) {
                 console.log(`Workspace "${workspaceId}" stopped successfully.`);
            } else {
                 console.log(`Workspace "${workspaceId}" was not running or could not be stopped.`);
            }
        } catch (error) {
            console.error(`Error stopping workspace: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command('status [workspaceId]')
    .description('Show status of one or all workspaces')
    .action((workspaceId) => {
        if (workspaceId) {
            const ws = manager.index[workspaceId];
            if (!ws) {
                console.error(`Workspace "${workspaceId}" not found.`);
                process.exit(1);
            }
            console.log(`Status for ${workspaceId}:`);
            console.log(JSON.stringify(ws, null, 2));
        } else {
            console.log('Workspace Statuses:');
            const workspaces = manager.workspaces;
            if (workspaces.length === 0) {
                console.log('No workspaces found.');
            } else {
                 console.log(JSON.stringify(manager.index, null, 2));
            }
        }
    });

program
    .command('list')
    .description('List all registered workspaces (ID and path)')
    .action(() => {
        console.log('Registered Workspaces:');
        const workspaces = manager.workspaces;
        if (workspaces.length === 0) {
            console.log('No workspaces found.');
        } else {
            workspaces.forEach(ws => {
                console.log(`- ID: ${ws.id}, Path: ${ws.path}, Status: ${ws.status}`);
            });
        }
    });

program
    .command('remove <workspaceId>')
    .description('Remove workspace from index (does not delete files)')
    .action(async (workspaceId) => {
        console.log(`Removing workspace "${workspaceId}" from index...`);
        try {
            const removed = await manager.removeWorkspace(workspaceId);
             if (removed) {
                 console.log(`Workspace "${workspaceId}" removed successfully from index.`);
            } else {
                 console.log(`Workspace "${workspaceId}" not found in index.`);
            }
        } catch (error) {
            console.error(`Error removing workspace: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command('destroy <workspaceId>')
    .description('Destroy workspace (removes from index and deletes files)')
    .option('-f, --force', 'Force destruction without confirmation', false)
    .action(async (workspaceId, options) => {
        // TODO: Add confirmation prompt unless --force is used
        console.warn(`WARNING: This will permanently delete workspace "${workspaceId}" and all its data!`);
        console.log(`Destroying workspace "${workspaceId}"...`);
        try {
            const destroyed = await manager.destroyWorkspace(workspaceId, options.force);
            if (destroyed) {
                 console.log(`Workspace "${workspaceId}" destroyed successfully.`);
            } else {
                 console.log(`Workspace "${workspaceId}" not found or could not be destroyed.`);
            }
        } catch (error) {
            console.error(`Error destroying workspace: ${error.message}`);
            process.exit(1);
        }
    });


// --- Workspace Specific Commands (ws <id> ...) ---

const wsCommand = program.command('id <workspaceId>')
    .description('Manage a specific workspace');

wsCommand
    .command('show')
    .description('Show details for the specified workspace')
    .action((/* options, command */) => {
        const workspaceId = wsCommand.args[0]; // Get workspaceId from parent command
        const ws = manager.index[workspaceId];
        if (!ws) {
            console.error(`Workspace "${workspaceId}" not found.`);
            process.exit(1);
        }
        console.log(`Details for ${workspaceId}:`);
        // TODO: Maybe load workspace.json for full details?
        console.log(JSON.stringify(ws, null, 2));
    });

wsCommand
    .command('set <property> <value>')
    .description('Set a workspace property (e.g., name, description, color, restApi.port, restApi.token)')
    .action(async (property, value /*, options, command */) => {
        const workspaceId = wsCommand.args[0]; // Get workspaceId from parent command
        console.log(`Setting property "${property}" to "${value}" for workspace "${workspaceId}"...`);

        // Attempt basic type conversion for port
        let parsedValue = value;
        if (property === 'restApi.port') {
            parsedValue = parseInt(value, 10);
            if (isNaN(parsedValue)) {
                console.error('Invalid port value. Must be a number.');
                process.exit(1);
            }
        }

        try {
            const success = await manager.setWorkspaceProperty(workspaceId, property, parsedValue);
            if (success) {
                console.log('Property updated successfully.');
            } else {
                console.log('Failed to update property (check logs or if property/value is valid).');
            }
        } catch (error) {
            console.error(`Error setting property: ${error.message}`);
            process.exit(1);
        }
    });

wsCommand
    .command('documents [path]')
    .description('List documents within the workspace, optionally filtered by path')
    .action(async (docPath /*, options, command */) => {
        const workspaceId = wsCommand.args[0]; // Get workspaceId from parent command
        console.log(`Listing documents for workspace "${workspaceId}"${docPath ? ' at path "' + docPath + '"' : ''}...`);
        try {
            // Need to start the workspace to access its listDocuments method
            const workspace = await manager.startWorkspace(workspaceId);
            const documents = await workspace.listDocuments(docPath || '/'); // Default to root path
            if (documents.length === 0) {
                console.log('No documents found.');
            } else {
                console.log(JSON.stringify(documents, null, 2));
            }
            // Optional: Stop the workspace afterwards? Or leave it running?
            // await manager.stopWorkspace(workspaceId);
        } catch (error) {
            console.error(`Error listing documents: ${error.message}`);
            process.exit(1);
        }
    });

// --- REST API Commands ---

const apiCommand = program.command('api <workspaceId>')
    .description('Manage the REST API for a specific workspace');

apiCommand
    .command('start')
    .description('Start the dedicated REST API server')
    .action(async (/* options, command */) => {
        const workspaceId = apiCommand.args[0];
        console.log(`Starting REST API for workspace "${workspaceId}"...`);
        try {
            const started = await manager.startRestApi(workspaceId);
            if (started) {
                console.log('REST API started successfully.');
            } else {
                console.log('Failed to start REST API (check config and logs).');
            }
        } catch (error) {
            console.error(`Error starting REST API: ${error.message}`);
            process.exit(1);
        }
    });

apiCommand
    .command('stop')
    .description('Stop the dedicated REST API server')
    .action(async (/* options, command */) => {
        const workspaceId = apiCommand.args[0];
        console.log(`Stopping REST API for workspace "${workspaceId}"...`);
        try {
            const stopped = await manager.stopRestApi(workspaceId);
            if (stopped) {
                console.log('REST API stopped successfully.');
            } else {
                console.log('Failed to stop REST API (check logs).');
            }
        } catch (error) {
            console.error(`Error stopping REST API: ${error.message}`);
            process.exit(1);
        }
    });

// --- Parse Arguments ---
program.parse(process.argv);

// Handle cases where no command is provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
