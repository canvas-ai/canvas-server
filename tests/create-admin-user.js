/**
 * Test script to create an admin user
 *
 * Usage:
 * node tests/create-admin-user.js
 */

// Import required modules
import UserManager from '../src/managers/user/index.js';
import User from '../src/prisma/models/User.js';
import env from '../src/env.js';

// Set up logging
import { createDebug } from '../src/utils/log/index.js';
const debug = createDebug('test:create-admin-user');

async function main() {
    try {
        console.log('Testing admin user creation...');

        // Initialize user manager
        const userManager = new UserManager();
        await userManager.initialize();

        // Check if any users exist
        const hasUsers = await userManager.hasUsers();
        console.log(`Users exist in database: ${hasUsers}`);

        if (hasUsers) {
            console.log('Users already exist, retrieving all users:');
            const users = await userManager.getAllUsers();
            users.forEach((user) => {
                console.log(`- ${user.email} (${user.userType})`);
            });
        } else {
            console.log('No users found, creating admin user...');

            // Create admin user
            const adminUser = await userManager.createInitialAdminUser({
                email: env.CANVAS_ADMIN_EMAIL || 'admin@canvas.local',
                password: env.CANVAS_ADMIN_PASSWORD || 'admin123',
            });

            if (adminUser) {
                console.log(`Admin user created successfully: ${adminUser.email}`);
            } else {
                console.log('Failed to create admin user');
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run the main function
main().catch(console.error);
