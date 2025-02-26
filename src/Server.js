/**
 * Canvas
 */

// Parsed env vars
import env from './env.js';

// Utils
import path from 'path';
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Config
import { defaultConfig as config } from '@/utils/config/index.js';

// Logging
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('server');

// Events
import EventEmitter from 'eventemitter2';

// Bling-bling
import pkg from '../package.json' assert { type: 'json' };
const {
    productName,
    version,
    description,
    license
} = pkg

// Services

// Transport classes
import HttpTransport from '@/transports/http/index.js';
import WsTransport from '@/transports/ws/index.js';

// Manager classes
import AppManager from '@/managers/app/index.js';
import ContextManager from '@/managers/context/index.js';
import DeviceManager from '@/managers/device/index.js';
import RoleManager from '@/managers/role/index.js';
import sessionManager from '@/managers/session/index.js';
import UserManager from '@/managers/user/index.js';

// Singleton managers
import WorkspaceManager from '@/managers/workspace/index.js';

/**
 * Canvas Server
 */

class Server extends EventEmitter {

    // Runtime
    #mode;                  // user, standalone
    #status = 'stopped';    // initialized, running, stopping, stopped

    #services = new Map();
    #transports = new Map();

    // Managers
    #workspaceManager;
    #appManager;
    #sessionManager;
    #contextManager;
    #deviceManager;
    #roleManager;

    constructor(options = {
        mode: env.CANVAS_SERVER_MODE,
    }) {
        super(); // EventEmitter2
        debug('Canvas server options:', options);

        // Set mode
        this.#mode = options.mode;

        // Initialize managers
        this.#initializeManagers();

    }

    // Getters
    get mode() { return this.#mode; }
    get pid() { return null; }
    get version() { return `${productName} v${version} | ${description}`; }
    get license() { return license; }
    get status() { return this.#status; }

    // Manager getters
    get workspaceManager() { return this.#workspaceManager; }
    get appManager() { return this.#appManager; }
    get sessionManager() { return this.#sessionManager; }
    get contextManager() { return this.#contextManager; }
    get deviceManager() { return this.#deviceManager; }
    get roleManager() { return this.#roleManager; }

    /**
     * Canvas service controls
     */

    async init() {
        debug('Initializing Canvas Server..');
        logger.info('Initializing Canvas Server..');
        this.emit('before-init');
        try {
            // Initialize services & transports
            await this.#initializeServices();
            await this.#initializeTransports();
            this.#status = 'initialized';
            this.emit('initialized');
        } catch (error) {
            logger.error('Initialization failed:', error);
            throw error;
        }
    }

    async start() {
        debug('Starting Canvas Server..');
        logger.info('Starting Canvas Server..');

        if (this.#status === 'running') {
            debug('Server is already running');
            logger.warn('Server is already running');
            return;
        }

        if (this.#status === 'stopping') {
            debug('Server is currently stopping, please wait');
            logger.warn('Server is currently stopping, please wait');
            return;
        }

        if (this.#status !== 'initialized') {
            debug('Server is not yet initialized, please run init() first');
            logger.warn('Server is not yet initialized, please run init() first');
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
        debug(`Canvas Server ${action}..`);
        logger.info(`Canvas Server ${action}..`);

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

    async #initializeServices() {
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
                this.#services.set(service, instance);
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

        for (const [name, service] of this.#services) {
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

        for (const [name, service] of this.#services) {
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

    async #initializeTransports() {
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
                this.#transports.set(transport, instance);
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

        for (const [name, transport] of this.#transports) {
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

        for (const [name, transport] of this.#transports) {
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

    async #initializeManagers() {
        debug('Initializing managers');
        logger.info('Initializing managers');

        this.#workspaceManager = new WorkspaceManager({
            rootPath: env.CANVAS_USER_HOME,
        });

        debug('Managers initialized');
        logger.info('Managers initialized');
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

// Utils
export {
    logger,
    config
};

// Export Server
export default Server;
