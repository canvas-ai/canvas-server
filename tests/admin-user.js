// Test script for admin user creation and reset functionality
import server from '../src/Server.js';
import logger from '../src/utils/log/index.js';
import env from '../src/env.js';

async function main() {
    try {
        logger.info('Testing admin user creation/reset functionality');

        // Set environment variables directly in the env object
        env.CANVAS_ADMIN_RESET = 'true';
        env.CANVAS_ADMIN_EMAIL = 'admin-test@canvas.local';
        env.CANVAS_ADMIN_PASSWORD = 'TestPassword123!';

        logger.info(`Admin email: ${env.CANVAS_ADMIN_EMAIL}`);
        logger.info(`Admin reset: ${env.CANVAS_ADMIN_RESET}`);

        // Initialize the server singleton
        await server.init();

        logger.info('Server initialized, admin user should be created/reset');

        // Shut down server
        await server.stop(false);

        logger.info('Test completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error(`Test failed: ${error.message}`);
        logger.error(error.stack);
        process.exit(1);
    }
}

main();
