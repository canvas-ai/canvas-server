#!/usr/bin/env node

/**
 * Clean Workspaces Script
 *
 * This script:
 * 1. Searches for universe workspaces in various locations
 * 2. Removes them to prevent "Workspace universe already exists" errors
 * 3. Clears the workspaces from the server database
 * 4. Allows admin user creation to proceed normally
 */

import { existsSync } from 'fs';
import * as fsPromises from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import Db from '../src/services/synapsd/src/backends/lmdb/index.js';
import env from '../src/env.js';
import Jim from '../src/utils/jim/index.js';

const execPromise = promisify(exec);

async function main() {
    console.log('Starting workspace cleanup...');

    // 1. Use find to locate all universe directories
    try {
        const { stdout } = await execPromise('find /pub -type d -name universe 2>/dev/null | grep -v "node_modules"');
        const universeDirs = stdout.split('\n').filter((dir) => dir.trim() !== '');

        console.log(`Found ${universeDirs.length} universe directories to clean up`);

        // 2. Remove each universe directory
        for (const dir of universeDirs) {
            if (existsSync(dir)) {
                console.log(`Removing: ${dir}`);
                try {
                    await fsPromises.rm(dir, { recursive: true, force: true });
                    console.log(`Successfully removed: ${dir}`);
                } catch (error) {
                    console.error(`Failed to remove ${dir}: ${error.message}`);
                }
            }
        }
    } catch (error) {
        console.error(`Error searching for universe directories: ${error.message}`);
    }

    // 3. Clean up the users directory completely
    const usersDir = path.join(process.cwd(), 'users');
    if (existsSync(usersDir)) {
        console.log(`Cleaning users directory: ${usersDir}`);
        try {
            // Read directory contents
            const entries = await fsPromises.readdir(usersDir, { withFileTypes: true });

            // Delete all entries except the .keep file
            for (const entry of entries) {
                if (entry.name !== '.keep') {
                    const fullPath = path.join(usersDir, entry.name);
                    console.log(`Removing: ${fullPath}`);
                    await fsPromises.rm(fullPath, { recursive: true, force: true });
                    console.log(`Successfully removed: ${fullPath}`);
                }
            }
        } catch (error) {
            console.error(`Error cleaning users directory: ${error.message}`);
        }
    }

    // 4. Clear the workspace index from the database
    try {
        console.log('Clearing workspace indexes from database...');

        // Initialize Jim for direct database access
        const jim = new Jim({
            rootPath: env.CANVAS_SERVER_DB,
        });

        // Clear the workspaces array
        jim.set('workspaces', []);
        console.log('Workspace index cleared successfully');
    } catch (error) {
        console.error(`Error clearing workspace index: ${error.message}`);
    }

    console.log('Cleanup complete. Try creating an admin user now.');
}

main().catch(console.error);
