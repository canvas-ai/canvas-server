/**
 * This is a fix for the #createDefaultAdminUser method in Server.js
 * Copy and paste this code to replace the method in Server.js
 */

async #createDefaultAdminUser() {
    debug('Checking for admin user...');

    const adminEmail = env.CANVAS_ADMIN_EMAIL || 'me@canvas.local';
    // Make sure to parse the environment variable as a boolean
    const forceReset = env.CANVAS_ADMIN_RESET === 'true' ||
                      env.CANVAS_ADMIN_RESET === '1' ||
                      env.CANVAS_ADMIN_RESET === 'yes';

    debug(`Admin email: ${adminEmail}, Reset requested: ${forceReset}`);

    try {
        // Check if admin user already exists
        const adminExists = await this.#userManager.hasUserByEmail(adminEmail);
        debug(`Admin user exists: ${adminExists}`);

        if (adminExists && !forceReset) {
            // Admin user exists and no reset requested
            debug(`Admin user with email ${adminEmail} already exists`);
            logger.info(`Admin user ${adminEmail} already exists, no action needed`);
            return;
        }

        // Generate a secure password or use the one from env
        const password = env.CANVAS_ADMIN_PASSWORD || this.#generateSecurePassword(12);

        // If reset is requested and user exists, delete the user first
        if (adminExists && forceReset) {
            debug(`Reset requested for admin user ${adminEmail}`);
            try {
                // Get user ID from email
                const adminUser = await this.#userManager.getUserByEmail(adminEmail);
                debug(`Found admin user ID: ${adminUser.id}`);

                // Search for workspaces associated with this user in the index
                const workspaces = this.#workspaceManager.listWorkspaces(adminUser.id);
                debug(`Found ${workspaces.length} workspaces for user ${adminUser.id}`);

                // Handle all workspaces, not just "universe"
                for (const workspace of workspaces) {
                    try {
                        debug(`Attempting to destroy workspace ${workspace.id} for reset`);
                        // Force destroy the workspace
                        await this.#workspaceManager.destroyWorkspace(adminUser.id, workspace.id, true);
                        debug(`Successfully destroyed workspace ${workspace.id}`);
                    } catch (wsError) {
                        debug(`Error destroying workspace ${workspace.id}: ${wsError.message}`);
                        // Continue with other workspaces even if one fails
                    }
                }

                // Try to find workspace entries directly in index as a fallback
                try {
                    // Check if "universe" workspace still exists after previous attempts
                    if (this.#workspaceManager.hasWorkspace(adminUser.id, 'universe')) {
                        debug('Universe workspace still exists after first attempt - trying manual removal');
                        // Try more aggressively to remove it from the index
                        this.#workspaceManager.removeWorkspace(adminUser.id, 'universe');
                        debug('Removed universe workspace from index');
                    }
                } catch (indexError) {
                    debug(`Error removing workspace from index: ${indexError.message}`);
                    // Continue anyway
                }

                // Ensure workspaces are cleared from user's directory
                try {
                    const userHomePath = adminUser.homePath;
                    if (userHomePath && existsSync(userHomePath)) {
                        debug(`Clearing user home directory: ${userHomePath}`);
                        await fsPromises.rm(userHomePath, { recursive: true, force: true });
                        debug(`Cleared user home directory successfully`);
                    }
                } catch (fsError) {
                    debug(`Error clearing user home: ${fsError.message}`);
                    // Continue anyway
                }

                // Now attempt to delete the user
                debug(`Attempting to delete user ${adminUser.id}`);
                await this.#userManager.deleteUser(adminUser.id);
                logger.info(`Existing admin user ${adminEmail} deleted for reset`);
            } catch (deleteError) {
                logger.error(`Failed to delete existing admin for reset: ${deleteError.message}`);
                debug(`Delete error details: ${deleteError.stack}`);
                // Continue with creation attempt anyway
            }
        }

        // Create new admin user
        debug(`Creating new admin user: ${adminEmail}`);
        const userData = {
            email: adminEmail,
            userType: 'admin',
            status: 'active'
        };

        const newUser = await this.#userManager.createUser(userData);
        debug(`Admin user created with ID: ${newUser?.id}`);

        // Log the admin user details
        console.log('\n' + '='.repeat(80));
        console.log('Canvas Admin User ' + (forceReset ? 'RESET' : 'Created'));
        console.log('='.repeat(80));
        console.log(`Email(login ID): ${adminEmail}`);
        console.log(`Password: ${password}`);
        console.log('='.repeat(80) + '\n');

        const action = forceReset ? 'reset' : 'created';
        logger.info(`Admin user ${adminEmail} ${action} successfully`);

    } catch (error) {
        logger.error(`Failed to handle admin user setup: ${error.message}`);
        debug(`Admin user error details: ${error.stack}`);
    }
}
