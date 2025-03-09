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

// Package info
import pkg from '../package.json' assert { type: 'json' };
const { productName, version, description, license } = pkg;

// Core managers
import WorkspaceManager from '@/managers/workspace/index.js';
import UserManager from '@/managers/user/index.js';
import SessionManager from '@/managers/session/index.js';
import ContextManager from '@/managers/context/index.js';

// Services
import AuthService from '@/services/auth/index.js';

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
    #mode;                  // user, standalone
    #status = 'stopped';    // initialized, running, stopping, stopped

    // Collections
    #services = new Map();
    #transports = new Map();

    // Core managers
    #workspaceManager;
    #userManager;
    #sessionManager;
    #contextManager;

    /**
     * Create a new Canvas Server instance
     * @param {Object} options - Server options
     * @param {string} options.mode - Server mode (user, standalone)
     */
    constructor(options = { mode: env.CANVAS_SERVER_MODE }) {
        super();
        debug('Canvas server options:', options);
        this.#mode = options.mode;
    }

    // Getters
    get mode() { return this.#mode; }
    get version() { return `${productName} v${version} | ${description}`; }
    get license() { return license; }
    get status() { return this.#status; }

    // Core manager getters
    get workspaceManager() { return this.#workspaceManager; }
    get userManager() { return this.#userManager; }
    get sessionManager() { return this.#sessionManager; }
    get contextManager() { return this.#contextManager; }

    // Service getters
    get services() { return this.#services; }

    /**
     * Initialize the server
     */
    async init() {
        debug('Initializing Canvas Server..');
        logger.info('Initializing Canvas Server..');
        this.emit('before-init');

        try {
            await this.#initializeCoreManagers();
            await this.#initializeServices();
            await this.#initializeTransports();
            await this.#createInitialAdminUser();

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
     * Get server status information
     * @returns {Object} Server status
     */
    getStatus() {
        return {
            app: {
                appName: productName,
                version,
                description,
                license,
            },
            mode: this.#mode,
            status: this.#status,
        };
    }

    /**
     * Initialize core managers
     * @private
     */
    async #initializeCoreManagers() {
        debug('Initializing core managers');
        logger.info('Initializing core managers');

        try {
            // Initialize workspace manager
            this.#workspaceManager = new WorkspaceManager({
                rootPath: env.CANVAS_USER_HOME,
            });
            debug('Workspace manager initialized');

            // Initialize user manager
            this.#userManager = new UserManager();
            debug('User manager initialized');

            // Initialize session manager
            this.#sessionManager = SessionManager();
            await this.#sessionManager.initialize();
            debug('Session manager initialized');

            // Initialize the context manager with dependencies
            this.#contextManager = new ContextManager({
                workspaceManager: this.#workspaceManager,
                sessionManager: this.#sessionManager
            });
            debug('Context manager initialized');

            debug('Core managers initialized');
            logger.info('Core managers initialized');
        } catch (error) {
            logger.error(`Core manager initialization failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Initialize services
     * @private
     */
    async #initializeServices() {
        debug('Initializing services');
        logger.info('Initializing services');

        try {
            // Initialize auth service
            const authConfig = {
                ...config,
                jwtSecret: process.env.CANVAS_JWT_SECRET || 'canvas-jwt-secret-dev-only',
                jwtLifetime: process.env.CANVAS_JWT_LIFETIME || '7d'
            };

            const authService = new AuthService(authConfig, {
                sessionManager: this.#sessionManager,
                userManager: this.#userManager,
                workspaceManager: this.#workspaceManager
            });

            await authService.initialize();
            this.#services.set('auth', authService);
            debug('Auth service initialized and registered');

            // Additional services can be added here in the future

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
     * Start transports
     * @private
     */
    async #startTransports() {
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
                debug(`${name} transport started`);
            } catch (error) {
                const msg = `Error starting ${name} transport: ${error.message}`;
                logger.error(msg);
                errors.push(msg);
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }

        logger.info('All transports started');
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
                const msg = `Error shutting down ${name} transport: ${error.message}`;
                logger.error(msg);
                errors.push(msg);
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
        // Convert Windows paths to proper URL format
        const modulePath = path.join(__dirname, type, name, 'index.js')
            .replace(/\\/g, '/') // Replace Windows backslashes with forward slashes
            .replace(/^([A-Z]:)/, ''); // Remove drive letter if present

        try {
            debug(`Loading ${type} module: ${name}`);
            logger.debug(`${type} config:`, config);

            const module = await import(modulePath);
            const instance = new module.default(config);

            debug(`Loaded ${type}: ${name}`);
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

    /**
     * Create initial admin user if no users exist
     * Automatically creates an admin user with a random password if none exists
     * Environment variables can override the default behavior
     * @private
     */
    async #createInitialAdminUser() {
        debug('Checking for admin user...');

        try {
            // Check if any admin users exist
            const adminExists = await this.#userManager.adminExists();

            if (adminExists) {
                debug('Admin user already exists, skipping creation');
                return;
            }

            // Determine admin credentials
            let email = env.CANVAS_ADMIN_EMAIL;
            let password = env.CANVAS_ADMIN_PASSWORD;
            let isRandomPassword = false;

            // If email not provided, use default
            if (!email) {
                email = 'admin@canvas.local';
                debug(`Using default admin email: ${email}`);
            }

            // If password not provided, generate a random one
            if (!password) {
                password = this.#generateSecurePassword();
                isRandomPassword = true;
                debug('Generated random password for admin user');
            }

            // Create the admin user
            const adminUser = await this.#userManager.createInitialAdminUser({
                email,
                password
            });

            if (adminUser) {
                if (isRandomPassword) {
                    // Display the credentials prominently in the console
                    console.log('\n' + '='.repeat(80));
                    console.log('CANVAS ADMIN USER CREATED');
                    console.log('='.repeat(80));
                    console.log(`Email:    ${email}`);
                    console.log(`Password: ${password}`);
                    console.log('\nPLEASE CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN');
                    console.log('='.repeat(80) + '\n');

                    logger.info(`Initial admin user created with email: ${email} and a random password`);
                } else {
                    logger.info(`Initial admin user created with email: ${email}`);
                }
            }
        } catch (error) {
            logger.error(`Failed to create initial admin user: ${error.message}`);
            // Don't throw error to allow server to continue starting
        }
    }

    /**
     * Generate a secure random password
     * @returns {string} A random password
     * @private
     */
    #generateSecurePassword() {
        const length = 16;
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';
        let password = '';

        // Ensure we have at least one of each character type
        password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
        password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
        password += '0123456789'[Math.floor(Math.random() * 10)]; // digit
        password += '!@#$%^&*()-_=+'[Math.floor(Math.random() * 14)]; // special

        // Fill the rest randomly
        for (let i = 4; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * charset.length);
            password += charset[randomIndex];
        }

        // Shuffle the password characters
        return password.split('').sort(() => 0.5 - Math.random()).join('');
    }
}

// Export Server
export default Server;
