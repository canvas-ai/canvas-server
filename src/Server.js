/**
 * Canvas Server
 */

// Parsed env vars
import env from './env.js';

// Utils
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import EventEmitter from 'eventemitter2';

// Package info
import pkg from '../package.json' with { type: 'json' };
const { productName, version, description, license } = pkg;

// Logging
import logger, { createDebug } from './utils/log/index.js';
const debug = createDebug('server');

// Services
import AuthService from './services/auth/index.js';
import Db from './services/synapsd/src/backends/lmdb/index.js';
import Jim from './utils/jim/index.js';

/**
 * Global Config
 */

// TODO: Make this a proper singleton, refactor the new ai-generated code of config!
import { defaultConfig as config } from './utils/config/index.js';

/**
 * Server Database
 */

const db = new Db({
    path: env.CANVAS_SERVER_DB,
});

const jim = new Jim({
    rootPath: env.CANVAS_SERVER_DB,
});

/**
 * Global Manager "Singletons" (not really, but close enough)
 */

import WorkspaceManager from './managers/workspace/index.js';
const workspaceManager = new WorkspaceManager({
    jim: jim,
    rootPath: (env.CANVAS_SERVER_MODE === 'user') ? env.CANVAS_USER_HOME : env.CANVAS_SERVER_HOMES,

});

import UserManager from './managers/user/index.js';
const userManager = new UserManager({
    jim: jim, // JIM instance to create a JSON based index for users
    rootPath: (env.CANVAS_SERVER_MODE === 'user') ? env.CANVAS_USER_HOME : env.CANVAS_SERVER_HOMES,
    workspaceManager: workspaceManager,
});


/**
 * Canvas Server
 *
 * Core server class responsible for:
 * - Managing server lifecycle (init, start, stop, restart)
 * - Loading and managing transports
 * - Providing access to core managers and services
 */

class Server extends EventEmitter {
    // Runtime state
    #mode; // user, standalone
    #status = 'stopped'; // initialized, running, stopping, stopped

    // Internals
    #services = new Map();
    #transports = new Map();

    // Database
    #db;

    // Event Handlers
    #userEventHandler;

    /**
     * Create a new Canvas Server instance
     * @param {Object} options - Server options
     * @param {string} options.mode - Server mode (user, standalone)
     */
    constructor(options = { mode: env.CANVAS_SERVER_MODE }) {
        super();
        debug('Initializing canvas-server..');
        debug('Canvas server options:', options);
        debug('Environment options:', JSON.stringify(env, null, 2));
        this.#mode = options.mode;
        this.#db = db;
    }

    // Getters
    get mode() { return this.#mode; }
    get version() { return `${productName} v${version} | ${description}`; }
    get status() { return this.#status; }
    get services() { return this.#services; }
    get transports() { return this.#transports; }
    get db() { return this.#db; }

    // Legacy manager getters
    get userManager() { return userManager; }
    get sessionManager() { return sessionManager; }
    get workspaceManager() { return workspaceManager; }

    /**
     * Initialize the server
     */
    async initialize() {
        logger.info('Initializing Canvas Server..');
        this.emit('before-init');

        try
        {
            // Initialize services
            await this.#initializeServices();

            // Initialize managers
            await this.#initializeManagers();

            // Initialize auth middleware
            await this.#initializeAuthMiddleware();

            // Initialize transports
            await this.#initializeTransports();

1            // Create default admin user
            await this.#createDefaultAdminUser();

            this.#status = 'initialized';
            this.emit('initialized');
            logger.info('Canvas Server initialized successfully');
        } catch (error) {
            logger.error('Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Start the server
     */
    async start() {
        debug('Starting Canvas Server..');
        logger.info('Starting Canvas Server..');

        if (this.#status === 'running') {
            logger.warn('Server is already running');
            return;
        }

        if (this.#status === 'stopping') {
            logger.warn('Server is currently stopping, please wait');
            return;
        }

        if (this.#status !== 'initialized') {
            logger.warn('Server is not yet initialized, please run init() first');
            return;
        }

        this.emit('before-start');

        try {
            // Workspaces are started ad-hoc
            await this.#startServices();
            await this.#startTransports();

            this.#status = 'running';
            logger.info('Canvas Server started successfully');
            this.emit('started');
        } catch (error) {
            logger.error('Server start failed:', error);
            throw error;
        }
    }

    /**
     * Stop the server
     * @param {boolean} exit - Whether to exit the process after stopping
     */
    async stop(exit = true) {
        const action = exit ? 'Shutting down' : 'Stopping for restart';
        debug(`Canvas Server ${action}..`);
        logger.info(`Canvas Server ${action}..`);

        this.emit('before-shutdown');
        this.#status = 'stopping';

        try {
            await this.#shutdownTransports();
            await this.#shutdownServices();

            this.#status = 'stopped';
            logger.info('Graceful shutdown completed successfully.');
            this.emit('shutdown');

            if (exit) process.exit(0);
        } catch (error) {
            logger.error('Server shutdown failed:', error);
            if (exit) process.exit(1);
            throw error;
        }
    }

    /**
     * Restart the server
     */
    async restart() {
        debug('Restarting Canvas Server');
        logger.info('Restarting Canvas Server');
        this.emit('restart');
        await this.stop(false);
        await this.start();
    }

    /**
     * Private methods
     */

    /**
     * Initialize services
     * @private
     */
    async #initializeServices() {
        debug('Initializing services');
        logger.info('Initializing services');
    }

    /**
     * Initialize managers
     * @private
     */
    async #initializeManagers() {
        debug('Initializing managers');
        logger.info('Initializing managers');

        // Initialize Session Manager
        await sessionManager.initialize();

        // Initialize Workspace Manager
        await workspaceManager.initialize();

        // Initialize User Manager
        await userManager.initialize();

        logger.info('Managers initialized successfully');
    }

    async #initializeAuthMiddleware() {
        try {
            // Initialize auth service with required config
            const authConfig = config.require('auth', 'server').get();
            debug(`Auth config: ${JSON.stringify(authConfig)}`);
            if (!authConfig.jwtSecret) {
                throw new Error('JWT secret is required in auth config');
            }

            const authService = new AuthService(authConfig, {
                sessionManager: sessionManager,
                userManager: userManager,
            });

            await authService.initialize();
            this.#services.set('auth', authService);

            // Set auth service on user manager
            userManager.setServer(this);

            debug('Auth service initialized and registered');
            logger.info('Services initialized');
        } catch (error) {
            logger.error(`Service initialization failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Initialize transports
     * @private
     */
    async #initializeTransports() {
        debug('Initializing transports');
        logger.info('Initializing transports');

        try {
            const transportConfig = config.require('transports', 'server').get();
            debug('Transports config loaded');
            for (const [transportName, transportOptions] of Object.entries(transportConfig)) {
                try {
                    const instance = await this.#loadModule('transports', transportName, transportOptions);

                    // Set the server instance on the transport if it has the method
                    if (typeof instance.setCanvasServer === 'function') {
                        instance.setCanvasServer(this);
                        debug(`Set server instance on ${transportName} transport`);
                    }

                    this.#transports.set(transportName, instance);
                } catch (error) {
                    logger.error(`Failed to initialize transport ${transportName}:`, error);
                    throw error;
                }
            }

            logger.info('Transports initialized');
        } catch (error) {
            logger.error(`Transport initialization failed: ${error.message}`);
            throw error;
        }
    }


    /**
     * Start services
     * @private
     */
    async #startServices() {
        debug('Starting services..');
        logger.info('Starting services..');
        const errors = [];

        for (const [name, service] of this.#services) {
            try {
                await service.start();
                debug(`${name} service started`);
            } catch (error) {
                const msg = `Error starting ${name} service: ${error.message}`;
                logger.error(msg);
                errors.push(msg);
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }

        logger.info('All services started');
    }

    /**
     * Shutdown services
     * @private
     */
    async #shutdownServices() {
        debug('Shutting down services');
        logger.info('Shutting down services');
        const errors = [];

        for (const [name, service] of this.#services) {
            try {
                await service.stop();
                debug(`${name} service stopped`);
            } catch (error) {
                const msg = `Error shutting down ${name} service: ${error.message}`;
                logger.error(msg);
                errors.push(msg);
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }

        logger.info('All services shut down');
    }

    /**
     * Start the transports
     * @private
     */
    async #startTransports() {
        debug('Starting transports...');
        const transportNames = Array.from(this.#transports.keys());
        debug(`Found ${transportNames.length} transports: ${transportNames.join(', ')}`);

        // Variables to store references to HTTP and WebSocket transports
        let httpTransport = null;
        let wsTransport = null;

        // Find HTTP and WebSocket transports if available
        for (const [name, transport] of this.#transports.entries()) {
            if (name === 'http') {
                httpTransport = transport;
            } else if (name === 'ws') {
                wsTransport = transport;
            }
        }

        // Connect HTTP transport to WebSocket transport if both are available
        if (httpTransport && wsTransport) {
            debug('Connecting HTTP transport to WebSocket transport');
            httpTransport.setWebSocketTransport(wsTransport);
        }

        // Start HTTP transport first if available
        if (httpTransport) {
            debug('Starting HTTP transport first');
            try {
                await httpTransport.start();
                debug('HTTP transport started successfully');
            } catch (error) {
                logger.error('Failed to start HTTP transport:', error);
                throw new Error(`Error starting HTTP transport: ${error.message}`);
            }

            // Start WebSocket transport with HTTP server if available
            if (wsTransport) {
                debug('Starting WebSocket transport with HTTP server');
                try {
                    // Get the HTTP server from the HTTP transport
                    const httpServer = httpTransport.getServer();
                    await wsTransport.start(httpServer);
                    debug('WebSocket transport started successfully');
                } catch (error) {
                    logger.error('Failed to start WebSocket transport with HTTP server:', error);
                    throw new Error(`Error starting WebSocket transport with HTTP server: ${error.message}`);
                }
            }
        }

        // Start all other transports
        for (const [name, transport] of this.#transports.entries()) {
            // Skip HTTP and WebSocket transports as they were handled above
            if ((name === 'http' && httpTransport) || (name === 'ws' && wsTransport && httpTransport)) {
                debug(`Skipping ${name} transport as it was already started`);
                continue;
            }

            debug(`Starting ${name} transport...`);
            try {
                await transport.start();
                debug(`${name} transport started successfully`);
            } catch (error) {
                logger.error(`Failed to start ${name} transport:`, error);
                throw new Error(`Error starting ${name} transport: ${error.message}`);
            }
        }

        debug('All transports started successfully');
    }

    /**
     * Shutdown transports
     * @private
     */
    async #shutdownTransports() {
        debug('Shutting down transports');
        logger.info('Shutting down transports');
        const errors = [];

        for (const [name, transport] of this.#transports) {
            try {
                await transport.stop();
                debug(`${name} transport stopped`);
            } catch (error) {
                // If the error is just that the server is not running, log it but don't treat it as an error
                if (error.message === 'Server is not running') {
                    debug(`${name} transport was not running`);
                } else {
                    const msg = `Error shutting down ${name} transport: ${error.message}`;
                    logger.error(msg);
                    errors.push(msg);
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }

        logger.info('All transports shut down');
    }

    /**
     * Load a module (service or transport) dynamically
     * @param {string} type - Module type (services, transports)
     * @param {string} name - Module name
     * @param {Object} config - Module configuration
     * @returns {Object} Module instance
     * @private
     */
    async #loadModule(type, name, config) {
        const absolutePath = path.join(__dirname, type, name, 'index.js');
        const moduleUrl = pathToFileURL(absolutePath).href; // Convert path to file URL

        try {
            debug(`Loading ${type} module: ${name} from ${moduleUrl}`);
            logger.debug(`${type} config:`, config);

            const module = await import(moduleUrl); // Import using the file URL
            const instance = new module.default(config);

            debug(`Loaded ${type}: ${name}`);
            return instance;
        } catch (error) {
            const isNotFound = error.code === 'ERR_MODULE_NOT_FOUND';
            const errorMessage = isNotFound
                ? `${type} module not found: ${name}. Please ensure the module exists at ${absolutePath}` // Show original path in error
                : `Error loading ${type} ${name}: ${error.message}`;

            logger.error(errorMessage);
            throw new Error(errorMessage);
        }
    }

    /**
     * Check if admin user exists, create if not, or reset if CANVAS_ADMIN_RESET is set
     * @private
     */
    async #createDefaultAdminUser() {
        debug('Checking for admin user...');
        const adminEmail = env.CANVAS_ADMIN_EMAIL || 'admin@canvas.local';

        const forceReset = (env.CANVAS_ADMIN_RESET === 'true' ||
            env.CANVAS_ADMIN_RESET === '1' ||
            env.CANVAS_ADMIN_RESET === 1 ||
            env.CANVAS_ADMIN_RESET === 'yes');

        debug(`Admin email: ${adminEmail}, Reset requested: ${forceReset}`);

        try {
            // Get auth service
            const authService = this.#services.get('auth');
            if (!authService) {
                throw new Error('Auth service not found');
            }

            // Generate a password if none is provided
            const password = env.CANVAS_ADMIN_PASSWORD && env.CANVAS_ADMIN_PASSWORD !== 'null'
                ? env.CANVAS_ADMIN_PASSWORD
                : authService.generateSecurePassword(12);

            // Check if admin user already exists
            const adminExists = await userManager.hasUserByEmail(adminEmail);
            debug(`Admin user exists: ${adminExists}`);

            if (adminExists) {
                return await this.#handleExistingAdmin(adminEmail, password, forceReset, authService);
            }

            return await this.#createNewAdmin(adminEmail, password, authService);
        } catch (error) {
            logger.error(`Failed to handle admin user setup: ${error.message}`);
            debug(`Admin user error details: ${error.stack}`);
        }
    }

    /**
     * Handle existing admin user (update or skip)
     * @param {string} adminEmail - Admin email
     * @param {string} password - Admin password
     * @param {boolean} forceReset - Whether to force reset the admin user
     * @param {Object} authService - Auth service
     * @private
     */
    async #handleExistingAdmin(adminEmail, password, forceReset, authService) {
        if (!forceReset) {
            debug(`Admin user with email ${adminEmail} already exists`);
            logger.info(`Admin user ${adminEmail} already exists, no action needed`);
            return;
        }

        debug(`*** ADMIN RESET REQUESTED - Updating admin user: ${adminEmail} ***`);

        // Get admin user
        const adminUser = await userManager.getUserByEmail(adminEmail);

        // Update user status to ensure it's active
        await userManager.updateUser(adminUser.id, {
            status: 'active',
            userType: 'admin',
        });

        // Reset password using the auth service
        await authService.setPassword(adminUser.id, password);

        // Generate a new API Token
        const apiToken = await authService.createToken(adminUser.id, {
            name: 'Admin API Token',
            description: 'Default admin token',
        });

        this.#displayAdminCredentials(adminEmail, password, apiToken.value, true);
        logger.info(`Admin user ${adminEmail} reset successfully`);
    }

    /**
     * Create a new admin user
     * @param {string} adminEmail - Admin email
     * @param {string} password - Admin password
     * @param {Object} authService - Auth service
     * @private
     */
    async #createNewAdmin(adminEmail, password, authService) {
        debug(`Creating new admin user: ${adminEmail}`);
        const userData = {
            email: adminEmail,
            userType: 'admin',
            status: 'active',
            createToken: true, // Explicitly request token creation
        };

        const newUser = await userManager.createUser(userData);
        debug(`Admin user created with ID: ${newUser?.id}`);

        // Set password for the new admin user
        await authService.setPassword(newUser.id, password);

        // Create a new API token for the user
        const apiToken = await authService.createToken(newUser.id, {
            name: 'Admin API Token',
            description: 'Default admin token',
        });

        // Log the admin user details
        this.#displayAdminCredentials(adminEmail, password, apiToken?.value);
        logger.info(`Admin user ${adminEmail} created successfully`);
    }

    /**
     * Display admin credentials in the console
     * @param {string} email - Admin email
     * @param {string} password - Admin password
     * @param {string} tokenValue - API token value
     * @param {boolean} isReset - Whether this is a reset operation
     * @private
     */
    #displayAdminCredentials(email, password, tokenValue, isReset = false) {
        console.log('\n' + '='.repeat(80));
        console.log(`Canvas Admin User${isReset ? ' RESET' : ''}`);
        console.log('='.repeat(80));
        console.log(`Email(login ID): ${email}`);
        console.log(`Password: ${password}`);
        if (tokenValue) {
            console.log(`API Token: ${tokenValue}`);
        }
        console.log('='.repeat(80) + '\n');
    }
}

// Create server instance
const server = new Server();

// Export Server as singleton
export default server;

// Export initialized managers directly
export {
    jim,
    workspaceManager,
    userManager,
};
