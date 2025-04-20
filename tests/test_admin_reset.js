#!/usr/bin/env node

// This test script demonstrates a fix for the admin user reset issue
// It directly calls the WorkspaceManager to handle the workspace cleanup before deleting the user

import env from '../src/env.js';
import { existsSync } from 'fs';
import * as fsPromises from 'fs/promises';
import path from 'path';

// Simulate server components
import UserManager from '../src/managers/user/index.js';
import WorkspaceManager from '../src/managers/workspace/index.js';
import Jim from '../src/utils/jim/index.js';

async function main() {
    console.log('Testing admin user reset...');

    const jim = new Jim({
        rootPath: env.CANVAS_SERVER_DB,
    });

    // Initialize managers
    const userManager = new UserManager({
        rootPath: env.CANVAS_SERVER_HOMES,
        jim: jim,
    });

    const workspaceManager = new WorkspaceManager({
        rootPath: env.CANVAS_SERVER_HOMES,
        jim: jim,
    });

    await userManager.initialize();
    await workspaceManager.initialize();
    userManager.setWorkspaceManager(workspaceManager);

    const adminEmail = env.CANVAS_ADMIN_EMAIL || 'admin@canvas.local';

    try {
        // Check if admin user already exists
        const adminExists = await userManager.hasUserByEmail(adminEmail);
        console.log(`Admin user exists: ${adminExists}`);

        if (adminExists) {
            console.log(`Resetting admin user ${adminEmail}`);

            // Get user ID from email
            const adminUser = await userManager.getUserByEmail(adminEmail);
            console.log(`Found admin user ID: ${adminUser.id}`);

            // Search for workspaces associated with this user
            const workspaces = workspaceManager.listWorkspaces(adminUser.id);
            console.log(`Found ${workspaces.length} workspaces for user ${adminUser.id}`);

            // Handle all workspaces, not just "universe"
            for (const workspace of workspaces) {
                try {
                    console.log(`Attempting to destroy workspace ${workspace.id}`);
                    // Force destroy the workspace
                    await workspaceManager.destroyWorkspace(adminUser.id, workspace.id, true);
                    console.log(`Successfully destroyed workspace ${workspace.id}`);
                } catch (wsError) {
                    console.error(`Error destroying workspace ${workspace.id}: ${wsError.message}`);
                    // Continue with other workspaces even if one fails
                }
            }

            // Clear user home directory as last resort
            try {
                const userHomePath = adminUser.homePath;
                if (userHomePath && existsSync(userHomePath)) {
                    console.log(`Clearing user home directory: ${userHomePath}`);
                    await fsPromises.rm(userHomePath, { recursive: true, force: true });
                    console.log(`Cleared user home directory successfully`);
                }
            } catch (fsError) {
                console.error(`Error clearing user home: ${fsError.message}`);
                // Continue anyway
            }

            // Now attempt to delete the user
            console.log(`Attempting to delete user ${adminUser.id}`);
            await userManager.deleteUser(adminUser.id);
            console.log(`Existing admin user ${adminEmail} deleted`);
        }

        // Create new admin user
        console.log(`Creating new admin user: ${adminEmail}`);
        const userData = {
            email: adminEmail,
            userType: 'admin',
            status: 'active',
        };

        const newUser = await userManager.createUser(userData);
        console.log(`Admin user created with ID: ${newUser?.id}`);
    } catch (error) {
        console.error(`Failed to handle admin user setup: ${error.message}`);
        console.error(error.stack);
    }
}

main().catch(console.error);
