/**
 * Canvas
 */

// Utils
import path from 'path';
import EventEmitter from 'eventemitter2';
import Config from './utils/config/index.mjs';
import winston from 'winston';

import debugMessage from 'debug';
const debug = debugMessage('canvas:server');

import pkg from '../package.json' assert { type: 'json' };
const {
    productName,
    version,
    description,
    license
} = pkg


/**
 * Main application
 */

class CanvasServer extends EventEmitter {

    #mode;                  // primary, secondary
    #status = 'stopped';    // initialized, running, stopping, stopped
    #paths = {};

    constructor(options = {}) {
        super(); // EventEmitter2

        debug('Initializing Canvas Server');
        debug('Options:', options);

        if (!options.mode) { throw new Error('Canvas server mode option not set'); }
        this.#mode = options.mode;

        if (!options?.paths?.server) { throw new Error('Canvas server paths option not set'); }
        if (!options?.paths?.user) { throw new Error('Canvas user paths option not set'); }
        this.#paths = options.paths;

        // Global config module
        debug('Initializing config module');
        this.config = Config({
            serverConfigDir: this.#paths.server.config,
            userConfigDir: this.#paths.user.config,
            // Temporary
            configPriority: (this.#mode !== 'standalone') ? 'user' : 'server',
            versioning: false,
        });

        // Global logger
        const logFile = path.join(this.#paths.server.var, 'canvas-server.log'); // TODO: Use config.get
        const logLevel = options?.logLevel || process.env['LOG_LEVEL'] || 'info'; // TODO: Use config.get
        debug(`Initializing logger, log level: ${logLevel}, output: ${logFile}`);
        this.logger = winston.createLogger({
            level: logLevel,
            format: winston.format.simple(),
            transports: [
                new winston.transports.File({ filename: logFile }),
                // TODO: Add a debug-based transport
            ],
        });

        // Process event listeners
        this.setupProcessEventListeners();


        this.transports = new Map();

    }

    // Getters
    get paths() { return this.#paths; }
    get mode() { return this.#mode; }
    get pid() { return null; }
    get ipc() { return null; }
    get version() { return `${productName} v${version} | ${description}`; }
    get license() { return license; }
    get status() { return this.#status; }


    /**
     * Canvas service controls
     */

    async init() {

    }

    async start() {
        debug('Starting Canvas Server..');
        this.logger.info('Starting Canvas Server..');
        this.emit('before-start');

        await this.startServices();
        await this.startTransports();
    }

    async stop(exit = true) {
        debug(exit ? 'Shutting down Canvas Server...' :
            'Shutting down Canvas Server for restart');
        this.logger.info(exit ? 'Shutting down Canvas Server...' :
            'Shutting down Canvas Server for restart');

        this.emit('before-shutdown');
        this.#status = 'stopping';
        try {
            //await this.sessionManager.saveSessions();
            //await this.shutdownRoles();
            await this.shutdownTransports();
            await this.shutdownServices();
            this.logger.info('Graceful shutdown completed successfully.');
            this.#status = 'stopped';
            this.emit('shutdown');
            if (exit) { process.exit(0); }
        } catch (error) {
            this.logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }

    async restart() {
        debug('Restarting Canvas Server');
        this.logger.info('Restarting Canvas Server');
        this.emit('restart');
        await this.stop(false);
        await this.start();
    }

    status() {
        return {
            app: {
                appName: productName,
                version: version,
                description: description,
                license: license,
            },
            mode: this.#mode,
            //pid: this.PID,
            //ipc: this.IPC,
            status: this.#status,
            paths: this.#paths,
        };
    }


    /**
     * Session
     */

    listActiveSessions() { return this.sessionManager.listActiveSessions(); }

    async listSessions() {
        let sessions = await this.sessionManager.listSessions();
        return sessions;
    }

    getSession(id) {
        return this.sessionManager.getSession(id);
    }

    createSession(id, sessionOptions = {}) {
        return this.sessionManager.createSession(id, sessionOptions);
    }

    openSession(id) {
        return this.sessionManager.openSession(id);
    }

    closeSession(id) {
        return this.sessionManager.closeSession(id);
    }

    deleteSession(id) {
        return this.sessionManager.deleteSession(id);
    }


    /**
     * Services
     */

    async startServices() {
        debug('Starting services..');
        this.logger.info('Starting services..');

        return true;
    }

    async shutdownServices() {
        debug('Shutting down services');
        this.logger.info('Shutting down services');

        return true;
    }


    /**
     * Transports
     */

    async initializeTransports() {
        const transports = this.config.open('transports');
        for (const [transport, config] of transports) {
            try {
                debug(`Attempting to initialize transport: ${transport}`);
                this.logger.info(`Attempting to initialize transport: ${transport}`);

                const transportModule = await import(`./transports/${transport}`);
                const transportInstance = new transportModule.default(config);

                // Store the transport instance
                this.transports.set(transport, transportInstance);

                debug(`Initialized transport: ${transport}`);
                this.logger.info(`Initialized transport: ${transport}`);
            } catch (error) {
                if (error.code === 'ERR_MODULE_NOT_FOUND') {
                    const errorMessage = `Transport module not found: ${transport}. Please ensure the module exists at ./transports/${transport}`;
                    console.error(errorMessage);
                    this.logger.error(errorMessage);
                } else {
                    const errorMessage = `Error initializing transport ${transport}: ${error.message}`;
                    console.error(errorMessage);
                    this.logger.error(errorMessage);
                }
            }
        }
    }

    async startTransports() {
        debug('Starting transports..');
        this.logger.info('Starting transports..');
        return true;
    }

    async shutdownTransports() {
        debug('Shutting down transports');

        for (let [name, transport] of this.transports) {
            try {
                await transport.stop();
            } catch (error) {
                console.log(`Error shutting down ${name} transport:`, error);
            }
        }
        return true;
    }


    /**
     * Roles
     */

    async startRoles() {
        return true;
    }

    async shutdownRoles() {
        return true;
    }

    /**
     * Process Event Listeners
     */

    setupProcessEventListeners() {
        process.on('uncaughtException', (error) => {
            console.error(error);
            this.logger.error('Uncaught Exception:', error);
            this.stop().then(() => process.exit(1));
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.logger.error('Unhandled Rejection:', reason);
        });

        process.on('warning', (warning) => {
            console.warn(warning.name);
            console.warn(warning.message);
            console.warn(warning.stack);
            this.logger.warn('Warning:', warning);
        });

        process.on('SIGINT', async (signal) => {
            console.log(`Received ${signal}, gracefully shutting down`);
            this.logger.info(`Received ${signal}, gracefully shutting down`);
            await this.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async (signal) => {
            console.log(`Received ${signal}, gracefully shutting down`);
            this.logger.info(`Received ${signal}, gracefully shutting down`);
            await this.stop();
            process.exit(0);
        });

        process.on('beforeExit', async (code) => {
            if (code !== 0) {return;}
            debug('Process beforeExit: ', code);
            this.logger.info('Process beforeExit:', code);
            await this.stop();
        });

        process.on('exit', (code) => {
            console.log(`Bye: ${code}`);
        });
    }

}

export default CanvasServer;
