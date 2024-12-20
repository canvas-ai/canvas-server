/**
 * Canvas server init script
 */

async function main() {

    try {
        const { default: CanvasServer } = await import('./Server.js');
        const canvas = new CanvasServer(/* Options handled via env.js and config */);

        // Register event handlers before starting
        canvas.on('running', () => {
            console.log('Canvas server started successfully.');
        });

        canvas.on('error', (err) => {
            console.error('Canvas server failed to start:', err);
            process.exit(1);
        });

        // TODO: Update logger (singleton, shared instance)
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
        server.logger.info(`Received ${signal}, gracefully shutting down`);
        try {
            await server.stop();
            process.exit(0);
        } catch (err) {
            console.error('Error during shutdown:', err);
            server.logger.error('Error during shutdown:', err);
            process.exit(1);
        }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('uncaughtException', (error) => {
        console.error(error);
        server.logger.error('Uncaught Exception:', error);
        server.stop().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        server.logger.error('Unhandled Rejection:', reason);
    });

    process.on('warning', (warning) => {
        console.warn(warning.name);
        console.warn(warning.message);
        console.warn(warning.stack);
        server.logger.warn('Warning:', warning);
    });

    process.on('beforeExit', async (code) => {
        if (code !== 0) {return;}
        server.logger.info('Process beforeExit:', code);
        await server.stop();
    });

    process.on('exit', (code) => {
        console.log(`Bye: ${code}`);
    });

    // Handle Windows specific signals
    if (process.platform === 'win32') {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.on('SIGINT', () => {
            process.emit('SIGINT');
        });
    }
}

function setupServerEventHandlers(server) {
    server.on('running', () => {
        server.logger.info('Canvas server started successfully');
    });

    server.on('error', (err) => {
        server.logger.error('Canvas server failed to start:', err);
        process.exit(1);
    });

    // Could add more server-specific event handlers
    server.on('ready', () => {
        server.logger.info('Canvas server ready to accept connections');
    });

    server.on('stopping', () => {
        server.logger.info('Canvas server is shutting down');
    });
}
