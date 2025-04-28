/**
 * Canvas Server init script
 */

import server from './Server.js';
import logger from './utils/log/index.js';

async function main() {
    try {
        // Register event handlers before starting
        setupProcessEventListeners();
        setupServerEventHandlers();

        // Initialize and start the server
        await server.initialize();
        await server.start();

        console.log('Canvas server started successfully.');
    } catch (err) {
        console.error('Failed to initialize Canvas server:', err);
        process.exit(1);
    }
}

// Run the main function
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});

/**
 * Set up process event listeners for graceful shutdown
 */
function setupProcessEventListeners() {
    // Handle process signals
    const shutdown = async (signal) => {
        console.log(`Received ${signal}. Shutting down gracefully...`);
        logger.info(`Received ${signal}, gracefully shutting down`);
        try {
            await server.stop();
            process.exit(0);
        } catch (err) {
            console.error('Error during shutdown:', err);
            logger.error('Error during shutdown:', err);
            process.exit(1);
        }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        logger.error('Uncaught Exception:', error);
        server.stop().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        logger.error('Unhandled Rejection:', reason);
    });

    process.on('warning', (warning) => {
        console.warn(warning.name);
        console.warn(warning.message);
        console.warn(warning.stack);
        logger.warn('Warning:', warning);
    });

    process.on('beforeExit', async (code) => {
        if (code !== 0) {
            return;
        }
        logger.info('Process beforeExit:', code);
        await server.stop();
    });

    process.on('exit', (code) => {
        console.log(`Bye: ${code}`);
    });

    // Handle Windows specific signals
    if (process.platform === 'win32') {
        (async () => {
            const { createInterface } = await import('readline');
            const readline = createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            readline.on('SIGINT', () => {
                process.emit('SIGINT');
            });
        })();
    }
}

/**
 * Set up server event handlers
 */
function setupServerEventHandlers() {
    // TODO: Streamline where to log what
    /*
    server.on('initialized', () => {
        logger.info('Canvas server initialized successfully');
    });

    server.on('started', () => {
        logger.info('Canvas server started successfully');
    });

    server.on('before-shutdown', () => {
        logger.info('Canvas server is shutting down');
    });

    server.on('shutdown', () => {
        logger.info('Canvas server has shut down');
    });
    */
}
