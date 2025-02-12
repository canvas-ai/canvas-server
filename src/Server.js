/**
 * Canvas
 */

// Parsed env vars
import env from './env.js';


/**
 * Import dependencies
 */

// Utils
import path from 'path';
const __dirname = path.dirname(new URL(import.meta.url).pathname);
import EventEmitter from 'eventemitter2';
// JSON Utils
import Config from '@/utils/config/index.js';
import JsonIndexManager from './utils/jim/index.js';
// Logging
import winston from 'winston';
import debugMessage from 'debug';
const debug = debugMessage('canvas:server');

// Bling-bling
import pkg from '../package.json' assert { type: 'json' };
const {
    productName,
    version,
    description,
    license
} = pkg

// Managers
import WorkspaceManager from './managers/workspace/index.js';


/**
 * Initialize utils
 **/

const config = new Config({ // TODO: Rework, we can use Conf directly here
    userConfigDir: env.CANVAS_SERVER_CONFIG,
    serverConfigDir: env.CANVAS_SERVER_CONFIG,
    configPriority: 'server',
    versioning: false,
});

const logFile = path.join(env.CANVAS_SERVER_VAR, 'log', 'canvas-server.log');
const logLevel = env.LOG_LEVEL;
const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(({ level, message, timestamp }) => {
            return `${timestamp} ${level}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.File({
            filename: logFile,
            format: winston.format.combine(
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                winston.format.printf(({ level, message, timestamp }) => {
                    return `${timestamp} ${level}: ${message}`;
                })
            )
        }),
    ],
});

/**
 * Initialize Managers
 **/

const workspaceManager = new WorkspaceManager({
    rootPath: env.CANVAS_SERVER_DATA,
});


/**
 * Canvas Server
 */

class Server extends EventEmitter {

    #mode;                  // user, standalone
    #status = 'stopped';    // initialized, running, stopping, stopped

    constructor(options = {
        mode: env.CANVAS_SERVER_MODE,
        serverHome: env.CANVAS_SERVER_HOME,
        dataHome: env.CANVAS_SERVER_DATA,
    }) {
        super(); // EventEmitter2
        debug('Canvas server options:', options);

        // Set mode
        this.#mode = options.mode;

        // Services and transports
        this.services = new Map();
        this.transports = new Map();
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
        logger.info('Initializing Canvas Server..');
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
            logger.error(errorMessage);
            throw new Error(errorMessage);
        }

        this.#status = 'initialized';
        this.emit('initialized');
    }

    async start() {
        debug('Starting Canvas Server..');
        logger.info('Starting Canvas Server..');

        if (this.#status === 'running') {
            const msg = 'Server is already running';
            debug(msg);
            logger.warn(msg);
            return;
        }

        if (this.#status === 'stopping') {
            const msg = 'Server is currently stopping, please wait';
            debug(msg);
            logger.warn(msg);
            return;
        }

        if (this.#status !== 'initialized') {
            const msg = 'Server is not yet initialized, please run init() first';
            debug(msg);
            logger.warn(msg);
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
            logger.error(errorMessage);
            throw new Error(errorMessage);
        }

        this.#status = 'running';
        logger.info('Canvas Server started successfully');
        this.emit('started');
    }

    async stop(exit = true) {
        const action = exit ? 'Shutting down' : 'Stopping for restart';
        debug(`${action} Canvas Server...`);
        logger.info(`${action} Canvas Server...`);

        this.emit('before-shutdown');
        this.#status = 'stopping';

        const errors = [];
        try {
            await this.shutdownTransports();
        } catch (error) {
            errors.push(`Transport shutdown failed: ${error.message}`);
        }

        try {
            await this.shutdownServices();
        } catch (error) {
            errors.push(`Service shutdown failed: ${error.message}`);
        }

        this.#status = 'stopped';

        if (errors.length > 0) {
            const errorMessage = errors.join('\n');
            logger.error(errorMessage);
            if (exit) process.exit(1);
            throw new Error(errorMessage);
        }

        logger.info('Graceful shutdown completed successfully.');
        this.emit('shutdown');

        if (exit) process.exit(0);
    }

    async restart() {
        debug('Restarting Canvas Server');
        logger.info('Restarting Canvas Server');
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
        logger.info('Initializing services');
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
                logger.error(`Failed to initialize service ${service}:`, error);
                throw error;
            }
        }
    }

    async startServices() {
        debug('Starting services..');
        logger.info('Starting services..');
        const errors = [];

        for (const [name, service] of this.services) {
            try {
                await service.start();
            } catch (error) {
                const msg = `Error starting ${name} service: ${error.message}`;
                logger.error(msg);
                errors.push(msg);
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
    }

    async shutdownServices() {
        debug('Shutting down services');
        logger.info('Shutting down services');
        return; // TODO

        const errors = [];

        for (const [name, service] of this.services) {
            try {
                await service.stop();
            } catch (error) {
                const msg = `Error shutting down ${name} service: ${error.message}`;
                logger.error(msg);
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
        // Get transports config from the config instance
        debug('Initializing transports');
        logger.info('Initializing transports');
        const conf = config.require('transports', 'server');
        const transportConfig = conf.get();

        debug('Transports config loaded');
        logger.info('Transports config loaded');

        const transportEntries = Object.entries({
            ...transportConfig
        });

        for (const [transport, transportConfig] of transportEntries) {
            try {
                const instance = await this.#loadModule('transports', transport, transportConfig);
                this.transports.set(transport, instance);
            } catch (error) {
                logger.error(`Failed to initialize transport ${transport}:`, error);
                throw error;
            }
        }
    }

    async startTransports() {
        debug('Starting transports..');
        logger.info('Starting transports..');
        const errors = [];

        for (const [name, transport] of this.transports) {
            try {
                await transport.start();
            } catch (error) {
                const msg = `Error starting ${name} transport: ${error.message}`;
                logger.error(msg);
                errors.push(msg);
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
    }

    async shutdownTransports() {
        debug('Shutting down transports');
        logger.info('Shutting down transports');
        const errors = [];

        for (const [name, transport] of this.transports) {
            try {
                await transport.stop();
            } catch (error) {
                const msg = `Error shutting down ${name} transport: ${error.message}`;
                logger.error(msg);
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
        // Convert Windows paths to proper URL format
        const modulePath = path.join(__dirname, type, name, 'index.js')
            .replace(/\\/g, '/') // Replace Windows backslashes with forward slashes
            .replace(/^([A-Z]:)/, ''); // Remove drive letter if present

        try {
            debug(`Loading ${type} module: ${name}`);
            logger.info(`Loading ${type} module: ${name}`);
            logger.debug(`${type} config:`, config);

            const module = await import(modulePath);
            const instance = new module.default(config);

            debug(`Loaded ${type}: ${name}`);
            logger.info(`Loaded ${type}: ${name}`);

            return instance;
        } catch (error) {
            const isNotFound = error.code === 'ERR_MODULE_NOT_FOUND';
            const errorMessage = isNotFound
                ? `${type} module not found: ${name}. Please ensure the module exists at ${modulePath}`
                : `Error loading ${type} ${name}: ${error.message}`;

            logger.error(errorMessage);
            throw new Error(errorMessage);
        }
    }

}

export {
    config,
    logger,
    workspaceManager
};

export default Server;
