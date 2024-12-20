/**
 * Canvas
 */

// Parsed env vars
import env from './env.js';

// Utils
import path from 'path';
import EventEmitter from 'eventemitter2';
import Config from './config/index.js';
import winston from 'winston';
const __dirname = path.dirname(new URL(import.meta.url).pathname);

import debugMessage from 'debug';
const debug = debugMessage('canvas:server');

import pkg from '../package.json' assert { type: 'json' };
const {
    productName,
    version,
    description,
    license
} = pkg

// Canvas components
import SynapsDB from './services/synapsdb/index.js';

// Canvas management modules
import ContextManager from './managers/context/index.js';


/**
 * Server defaults
 */

const DEFAULT_SERVICES = {
    synapsd: {}
}

const DEFAULT_TRANSPORTS = {
    http: {},
    ws: {},
}

/**
 * Main application
 */

class CanvasServer extends EventEmitter {

    #mode;                  // primary,
    #status = 'stopped';    // initialized, running, stopping, stopped

    constructor(options = {
        mode: env.CANVAS_SERVER_MODE,
        logLevel: env.LOG_LEVEL,
        serverHome: env.CANVAS_SERVER_HOME,
        userHome: env.CANVAS_USER_HOME,
    }) {
        super(); // EventEmitter2
        debug('Canvas server options:', options);

        this.#mode = options.mode;

        // Global config module
        this.config = Config.open('server');

        // Global logger
        const logFile = path.join(env.CANVAS_SERVER_VAR, 'log', 'canvas-server.log'); // TODO: Use config.get
        const logLevel = options?.logLevel || env.LOG_LEVEL; // TODO: use config.get
        debug(`Initializing logger, log level: ${logLevel}, output: ${logFile}`);
        this.logger = winston.createLogger({
            level: logLevel,
            format: winston.format.simple(),
            transports: [
                new winston.transports.File({ filename: logFile }),
                // TODO: Add a debug-based transport
            ],
        });

        this.services = new Map();
        this.transports = new Map();

        this.db = (options.mode === 'full') ? new SynapsDB({
            path: env.CANVAS_USER_DB
        }) : null;

        this.contextManager = (options.mode === 'full') ? new ContextManager({
            db: this.db
        }) : null;

    }

    // Getters
    get mode() { return this.#mode; }
    get pid() { return null; }
    get version() { return `${productName} v${version} | ${description}`; }
    get license() { return license; }
    get status() { return this.#status; }
    get debug() { return debug; }


    /**
     * Canvas service controls
     */

    async init() {
        debug('Initializing Canvas Server..');
        this.logger.info('Initializing Canvas Server..');
        this.emit('before-init');
        const errors = [];

        try {
            await this.initializeServices();
        } catch (error) {
            errors.push(`Services initialization failed: ${error.message}`);
        }

        try {
            await this.initializeTransports();
        } catch (error) {
            errors.push(`Transports initialization failed: ${error.message}`);
        }

        if (errors.length > 0) {
            const errorMessage = errors.join('\n');
            this.logger.error(errorMessage);
            throw new Error(errorMessage);
        }

        this.#status = 'initialized';
        this.emit('initialized');
    }

    async start() {
        debug('Starting Canvas Server..');
        this.logger.info('Starting Canvas Server..');

        if (this.#status === 'running') {
            const msg = 'Server is already running';
            debug(msg);
            this.logger.warn(msg);
            return;
        }

        if (this.#status === 'stopping') {
            const msg = 'Server is currently stopping, please wait';
            debug(msg);
            this.logger.warn(msg);
            return;
        }

        if (this.#status !== 'initialized') {
            const msg = 'Server is not yet initialized, please run init() first';
            debug(msg);
            this.logger.warn(msg);
            return;
        }

        this.emit('before-start');

        const errors = [];
        try {
            await this.startServices();
        } catch (error) {
            errors.push(`Services start failed: ${error.message}`);
        }

        try {
            await this.startTransports();
        } catch (error) {
            errors.push(`Transports start failed: ${error.message}`);
        }

        if (errors.length > 0) {
            const errorMessage = errors.join('\n');
            this.logger.error(errorMessage);
            throw new Error(errorMessage);
        }

        this.#status = 'running';
        this.logger.info('Canvas Server started successfully');
        this.emit('started');
    }

    async stop(exit = true) {
        const action = exit ? 'Shutting down' : 'Stopping for restart';
        debug(`${action} Canvas Server...`);
        this.logger.info(`${action} Canvas Server...`);

        this.emit('before-shutdown');
        this.#status = 'stopping';

        const errors = [];
        try {
            await this.shutdownTransports();
        } catch (error) {
            errors.push(`Transports shutdown failed: ${error.message}`);
        }

        try {
            await this.shutdownServices();
        } catch (error) {
            errors.push(`Services shutdown failed: ${error.message}`);
        }

        this.#status = 'stopped';

        if (errors.length > 0) {
            const errorMessage = errors.join('\n');
            this.logger.error(errorMessage);
            if (exit) process.exit(1);
            throw new Error(errorMessage);
        }

        this.logger.info('Graceful shutdown completed successfully.');
        this.emit('shutdown');

        if (exit) process.exit(0);
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
        };
    }

    /**
     * Services
     */

    async initializeServices() {
        debug('Initializing services');
        this.logger.info('Initializing services');
        return; // TODO

        const services = Config.open('server.services');
        const serviceEntries = Object.entries({
            ...DEFAULT_SERVICES,
            ...services.store
        });

        for (const [service, config] of serviceEntries) {
            try {
                const instance = await this.#loadModule('services', service, config);
                this.services.set(service, instance);
            } catch (error) {
                this.logger.error(`Failed to initialize service ${service}:`, error);
                throw error;
            }
        }
    }

    async startServices() {
        debug('Starting services..');
        this.logger.info('Starting services..');
        const errors = [];

        for (const [name, service] of this.services) {
            try {
                await service.start();
            } catch (error) {
                const msg = `Error starting ${name} service: ${error.message}`;
                this.logger.error(msg);
                errors.push(msg);
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
    }

    async shutdownServices() {
        debug('Shutting down services');
        this.logger.info('Shutting down services');
        return; // TODO

        const errors = [];

        for (const [name, service] of this.services) {
            try {
                await service.stop();
            } catch (error) {
                const msg = `Error shutting down ${name} service: ${error.message}`;
                this.logger.error(msg);
                errors.push(msg);
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
    }


    /**
     * Transports
     */

    async initializeTransports() {
        const transports = Config.open('server.transports');
        const transportEntries = Object.entries({
            ...DEFAULT_TRANSPORTS,
            ...transports.store
        });

        for (const [transport, config] of transportEntries) {
            try {
                const instance = await this.#loadModule('transports', transport, config);  // AND HERE
                this.transports.set(transport, instance);
            } catch (error) {
                this.logger.error(`Failed to initialize transport ${transport}:`, error);
                throw error;
            }
        }
    }

    async startTransports() {
        debug('Starting transports..');
        this.logger.info('Starting transports..');
        const errors = [];

        for (const [name, transport] of this.transports) {
            try {
                await transport.start();
            } catch (error) {
                const msg = `Error starting ${name} transport: ${error.message}`;
                this.logger.error(msg);
                errors.push(msg);
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
    }

    async shutdownTransports() {
        debug('Shutting down transports');
        this.logger.info('Shutting down transports');
        const errors = [];

        for (const [name, transport] of this.transports) {
            try {
                await transport.stop();
            } catch (error) {
                const msg = `Error shutting down ${name} transport: ${error.message}`;
                this.logger.error(msg);
                errors.push(msg);
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
    }

    /**
     * Load a module (service or transport) dynamically
     * @private
     */
    async #loadModule(type, name, config) {
        const modulePath = path.join(__dirname, type, name, 'index.js');
        try {
            debug(`Loading ${type} module: ${name}`);
            this.logger.info(`Loading ${type} module: ${name}`);
            this.logger.debug(`${type} config:`, config);

            const module = await import(modulePath);
            const instance = new module.default(config);

            debug(`Loaded ${type}: ${name}`);
            this.logger.info(`Loaded ${type}: ${name}`);

            return instance;
        } catch (error) {
            const isNotFound = error.code === 'ERR_MODULE_NOT_FOUND';
            const errorMessage = isNotFound
                ? `${type} module not found: ${name}. Please ensure the module exists at ${modulePath}`
                : `Error loading ${type} ${name}: ${error.message}`;

            this.logger.error(errorMessage);
            throw new Error(errorMessage);
        }
    }

}

export default CanvasServer;
