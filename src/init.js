/**
 * Canvas Server init script
 */

import server from './Server.js';
import logger from './utils/log.js';

// Constants
const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'];

/**
 * Main server initialization function
 */
async function main() {
    try {
        // Register event handlers before starting
        setupProcessEventListeners();
        setupServerEventHandlers();

        // Initialize and start the server
        await server.initialize();
        await server.start();

        logger.info('Canvas server started successfully');
    } catch (err) {
        logger.error('Failed to initialize Canvas server:', err);
        process.exit(1);
    }
}

/**
 * Set up process event listeners for graceful shutdown
 */
function setupProcessEventListeners() {
    // Handle process signals
    const shutdown = async (signal) => {
        logger.info(`Received ${signal}, gracefully shutting down`);
        try {
            await server.stop();
            process.exit(0);
        } catch (err) {
            logger.error('Error during shutdown:', err);
            process.exit(1);
        }
    };

    // Register shutdown handlers for signals
    SHUTDOWN_SIGNALS.forEach(signal => {
        process.on(signal, () => shutdown(signal));
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
        server.stop().then(() => process.exit(1));
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection:', { reason, promise });
    });

    // Handle warnings
    process.on('warning', (warning) => {
        logger.warn('Warning:', { name: warning.name, message: warning.message, stack: warning.stack });
    });

    // Handle process exit
    process.on('beforeExit', async (code) => {
        if (code !== 0) return;
        logger.info('Process beforeExit:', code);
        await server.stop();
    });

    process.on('exit', (code) => {
        logger.info(`Process exiting with code: ${code}`);
    });

    // Handle Windows specific signals
    if (process.platform === 'win32') {
        setupWindowsSignalHandlers();
    }
}

/**
 * Set up Windows-specific signal handlers
 */
async function setupWindowsSignalHandlers() {
    const { createInterface } = await import('readline');
    const readline = createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    readline.on('SIGINT', () => {
        process.emit('SIGINT');
    });
}

/**
 * Set up server event handlers
 */
function setupServerEventHandlers() {
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
}

// Run the main function
main().catch((err) => {
    logger.error('Fatal error:', err);
    process.exit(1);
});
