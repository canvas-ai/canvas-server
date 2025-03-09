/**
 * Canvas Server init script
 */

import Server from './Server.js';
import logger from '@/utils/log/index.js';

async function main() {
    try {
        const canvas = new Server();

        // Register event handlers before starting
        canvas.on('running', () => {
            console.log('Canvas server started successfully.');
        });

        canvas.on('error', (err) => {
            console.error('Canvas server failed to start:', err);
            process.exit(1);
        });

        setupProcessEventListeners(canvas);
        setupServerEventHandlers(canvas);

        // Start the server
        await canvas.init();
        await canvas.start();

    } catch (err) {
        console.error('Failed to initialize Canvas server:', err);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});


/**
 * Init utils
 */

function setupProcessEventListeners(server) {
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
        console.error(error);
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
        if (code !== 0) {return;}
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

function setupServerEventHandlers(server) {
    server.on('running', () => {
        logger.info('Canvas server started successfully');
    });

    server.on('error', (err) => {
        logger.error('Canvas server failed to start:', err);
        process.exit(1);
    });

    // Could add more server-specific event handlers
    server.on('ready', () => {
        logger.info('Canvas server ready to accept connections');
    });

    server.on('stopping', () => {
        logger.info('Canvas server is shutting down');
    });
}
