/**
 * Canvas Server
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

// Managers
import WorkspaceManager from '@/managers/workspace/index.js';
import UserManager from '@/managers/user/index.js';
import SessionManager from '@/managers/session/index.js';

// Try to import optional managers
let DeviceManager, RoleManager, AppManager, ContextManager;
try {
    DeviceManager = (await import('@/managers/device/index.js')).default;
} catch (error) {
    debug(`DeviceManager import failed: ${error.message}`);
}

try {
    RoleManager = (await import('@/managers/role/index.js')).default;
} catch (error) {
    debug(`RoleManager import failed: ${error.message}`);
}

try {
    AppManager = (await import('@/managers/app/index.js')).default;
} catch (error) {
    debug(`AppManager import failed: ${error.message}`);
}

try {
    ContextManager = (await import('@/managers/context/index.js')).default;
} catch (error) {
    debug(`ContextManager import failed: ${error.message}`);
}

// Services
import AuthService from '@/services/auth/index.js';

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
    #userManager;

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
    get userManager() { return this.#userManager; }

    // Service getters
    get services() { return this.#services; }

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

                // Set the server instance on the transport if it has the method
                if (typeof instance.setCanvasServer === 'function') {
                    instance.setCanvasServer(this);
                    debug(`Set server instance on ${transport} transport`);
                }

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

        // First, start the HTTP transport if it exists
        const httpTransport = this.#transports.get('http');
        let httpServer = null;

        if (httpTransport) {
            try {
                await httpTransport.start();
                // Get the HTTP server instance if available
                httpServer = httpTransport.getServer?.();
                debug('HTTP transport started');
            } catch (error) {
                const msg = `Error starting http transport: ${error.message}`;
                logger.error(msg);
                errors.push(msg);
            }
        }

        // Then start other transports, passing the HTTP server to WebSocket transport
        for (const [name, transport] of this.#transports) {
            // Skip HTTP transport as it's already started
            if (name === 'http') continue;

            try {
                // If this is the WebSocket transport and we have an HTTP server, use it
                if (name === 'ws' && httpServer) {
                    await transport.start(httpServer);
                } else {
                    await transport.start();
                }
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

        // Initialize device manager if available
        if (DeviceManager) {
            try {
                this.#deviceManager = new DeviceManager(config);
                debug('Device manager initialized');
            } catch (error) {
                debug(`Device manager initialization failed: ${error.message}`);
            }
        }

        // Initialize workspace manager
        this.#workspaceManager = new WorkspaceManager({
            rootPath: env.CANVAS_USER_HOME,
        });
        debug('Workspace manager initialized');

        // Initialize user manager
        this.#userManager = new UserManager(config);
        debug('User manager initialized');

        // Initialize session manager
        this.#sessionManager = new SessionManager(config);
        debug('Session manager initialized');

        // Initialize role manager (if available)
        if (RoleManager) {
            try {
                this.#roleManager = new RoleManager(config);
                debug('Role manager initialized');
            } catch (error) {
                debug(`Role manager initialization failed: ${error.message}`);
            }
        }

        // Initialize app manager (if available)
        if (AppManager) {
            try {
                this.#appManager = new AppManager(config);
                debug('App manager initialized');
            } catch (error) {
                debug(`App manager initialization failed: ${error.message}`);
            }
        }

        // Initialize context manager (if available)
        if (ContextManager) {
            try {
                this.#contextManager = new ContextManager({
                    ...config,
                    workspaceManager: this.#workspaceManager,
                    sessionManager: this.#sessionManager
                });
                debug('Context manager initialized');
            } catch (error) {
                debug(`Context manager initialization failed: ${error.message}`);
            }
        }

        // Initialize dependencies between managers
        this.#sessionManager.initialize({
            userManager: this.#userManager,
            db: null // We'll add database support later
        });

        // Initialize auth service
        try {
            // Prepare auth config with JWT secret
            const authConfig = {
                ...config,
                jwtSecret: process.env.CANVAS_JWT_SECRET || 'canvas-jwt-secret-dev-only',
                jwtLifetime: process.env.CANVAS_JWT_LIFETIME || '7d'
            };

            const authService = new AuthService(authConfig, {
                sessionManager: this.#sessionManager,
                userManager: this.#userManager,
                workspaceManager: this.#workspaceManager,
                deviceManager: this.#deviceManager,
                contextManager: this.#contextManager
            });

            await authService.initialize();

            // Add to services
            this.#services.set('auth', authService);
            debug('Auth service initialized and registered');
        } catch (error) {
            logger.error(`Auth service initialization failed: ${error.message}`);
            throw error;
        }

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
