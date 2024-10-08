/**
 * Canvas
 */

// Utils
const path = require('path');
const debug = require('debug')('canvas-main');
const EventEmitter = require('eventemitter2');
const winston = require('winston');
const Config = require('./utils/config/index.js');

// Core services
const SynapsDB = require('./services/synapsdb/index.js');
const StoreD = require('./services/stored/index.js');

// Manager classes
const RoleManager = require('./managers/role/index.js');
const SessionManager = require('./managers/session/index.js');
const ContextManager = require('./managers/context/index.js');
const DeviceManager = require('./managers/device/index.js');

// Transports
const TransportHttp = require('./transports/http');

// App constants
const MAX_SESSIONS = 32; // 2^5
const MAX_CONTEXTS_PER_SESSION = 32; // 2^5


/**
 * Main application
 */

class Canvas extends EventEmitter {

    #mode;
    #user = {};
    #server = {};
    #device;
    #status = 'stopped'; // stopped, initialized, starting, running, stopping;

    constructor(options = {}) {
        debug('Initializing Canvas Server');

        /**
         * Lets do some basic options validation
         */

        if (!options.mode) {
            throw new Error('Canvas Server mode not specified');
        }

        if (!options.paths.server ||
            !options.paths.server.config ||
            !options.paths.server.data ||
            !options.paths.server.roles ||
            !options.paths.server.var) {
            throw new Error('Canvas Server paths not specified');
        }

        if (options.mode === 'full' &&
            !options.paths.user ||
            !options.paths.user.config ||
            !options.paths.user.data ||
            !options.paths.user.cache ||
            !options.paths.user.db ||
            !options.paths.user.workspaces) {
            throw new Error('Canvas Server user paths not specified');
        }


        /**
         * Utils
         */

        super(); // EventEmitter2

        this.#mode = options.mode;
        this.#server.paths = options.paths.server;
        this.#user.paths = options.paths.user;
        this.#device = DeviceManager.getCurrentDevice();
        this.app = options.app;

        this.config = Config({
            serverConfigDir: this.#server.paths.config,
            userConfigDir: (this.#mode === 'full') ? this.#user.paths.config : null,
            configPriority: 'server',
            versioning: false,
        });

        let logFile = path.join(this.#server.paths.var, 'canvas-server.log');
        debug('Log file:', logFile);
        this.logger = winston.createLogger({
            level: process.env['LOG_LEVEL'] || 'info',
            format: winston.format.simple(),
            transports: [
                new winston.transports.File({ filename: logFile }),
                new winston.transports.Console(),
            ],
        });


        /**
         * Runtime environment
         */

        this.PID = process.env['pid'];          // Current App instance PID
        this.IPC = process.env['ipc'];          // Shared IPC socket
        this.transports = new Map();            // Transport instances

        // Bling-bling for the literature lovers
        this.logger.info(`Starting ${this.app.name} v${this.app.version}`);
        this.logger.info(`Server mode: ${this.#mode}`);

        debug('Server paths:', this.#server.paths);
        if (this.#mode === 'full') {
            debug('User paths:', this.#user.paths);
        }


        /**
         * Canvas Server RoleManager (minimal mode)
         */

        this.roleManager = new RoleManager({
            rolesPath: this.#server.paths.roles,
        });

        if (this.#mode !== 'full') {
            this.logger.info('Canvas Server initialized');
            this.#status = 'initialized';
            return;
        }


        /**
         * Core services
         */

        this.db = new SynapsDB({
            path: path.join(this.#user.paths.db),
            backupPath: path.join(this.#user.paths.db, 'backup'),
            backupOnOpen: true,
            backupOnClose: false,
            compression: true,
        });

        this.stored = new StoreD({
            paths: {
                data: this.#user.paths.data,
                cache: this.#user.paths.cache
            },
            cachePolicy: 'pull-through',
        });


        /**
         * Managers
         */

        this.deviceManager = new DeviceManager({
            db: this.db,
        });

        this.contextManager = new ContextManager({
            db: this.db,
        });

        // TODO: Refactor
        this.sessionManager = new SessionManager({
            sessionStore: this.db.createDataset('session'),
            contextManager: this.contextManager,
            maxSessions: MAX_SESSIONS,
            maxContextsPerSession: MAX_CONTEXTS_PER_SESSION,
        });

        this.logger.info('Canvas Server initialized');
        this.#status = 'initialized';
    }

    // Getters
    get appName() { return this.app.name; }
    get version() { return this.app.version; }
    get description() { return this.app.description; }
    get license() { return this.app.license; }
    get paths() {
        return {
            server: this.#server.paths,
            user: this.#user.paths,
        };
    }
    get mode() { return this.#mode; }
    get pid() { return this.PID; }
    get ipc() { return this.IPC; }
    get currentDevice() { return this.#device; }


    /**
     * Canvas service controls
     */

    async start(url, options) {
        if (this.#status === 'running') { throw new Error('Canvas Server already running'); }

        this.#status = 'starting';
        this.emit('starting');

        try {
            this.setupProcessEventListeners();
            await this.roleManager.start();
            await this.initializeTransports();

            if (this.#mode === 'full') {
                this.sessionManager.createSession('default');
                await this.initializeServices();
                await this.initializeRoles();
            }
        } catch (error) {
            this.logger.error('Error during Canvas Server startup:', error);
            process.exit(1);
        }

        this.#status = 'running';
        this.emit('running');
        this.logger.info('Canvas Server started successfully');
        return true;
    }

    async stop(exit = true) {
        debug(exit ? 'Shutting down Canvas Server...' : 'Shutting down Canvas Server for restart');
        this.logger.info(exit ? 'Shutting down Canvas Server...' : 'Shutting down Canvas Server for restart');

        this.emit('before-shutdown');
        this.#status = 'stopping';
        try {
            await this.sessionManager.saveSessions();
            await this.shutdownRoles();
            await this.shutdownTransports();
            await this.shutdownServices();
            this.logger.info('Graceful shutdown completed successfully.');
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

    async status() {
        return {
            status: this.#status,
            pid: this.PID,
            ipc: this.IPC,
            device: this.#device,
            mode: this.#mode,
            server: {
                appName: this.app.name,
                version: this.app.version,
                description: this.app.description,
                license: this.app.license,
            },
            sessions: this.listActiveSessions(),
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

    async initializeServices() {
        debug('Initializing services');
        return true;
    }

    async shutdownServices() {
        debug('Shutting down services');
        await this.db.stop();
        return true;
    }


    /**
     * Transports
     */

    // TODO: Refactor / remove
    async initializeTransports() {
        debug('Initializing transports');
        // Load configuration options for transports
        let config = this.config.open('server');
        const transportsConfig = config.get('transports');

        // This is a (temporary) placeholder implementation
        const httpTransport = new TransportHttp({
            protocol: config.get('transports.rest.protocol'),
            host: config.get('transports.rest.host'),
            port: config.get('transports.rest.port'),
            auth: config.get('transports.rest.auth'),
            canvas: this,
            db: this.db,
            contextManager: this.contextManager,
            sessionManager: this.sessionManager,
        });

        try {
            await httpTransport.start();
        } catch (error) {
            console.log(`Error initializing http transport:`, error);
            process.exit(1);
        }

        this.transports.set('http', httpTransport);

        /*
        const transports = [
            { name: 'http', class: TransportHttp },
            { name: 'rest', class: TransportRest },
            { name: 'socketio', class: TransportSocketIO }
        ];

        // TODO: The whole thing has to be refactored
        for (let transport of transports) {
            this.transports[transport.name] = new transport.class({
                host: config.get(`${transport.name}.host`),
                port: config.get(`${transport.name}.port`),
                auth: config.get(`${transport.name}.auth`),
                canvas: this,
                db: this.db,
                contextManager: this.contextManager,
                sessionManager: this.sessionManager,
            });

            try {
                await this.transports[transport.name].start();
            } catch (error) {
                console.log(`Error initializing ${transport.name} transport:`, error);
                process.exit(1);
            }
        }*/

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

    async initializeRoles() {
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
            this.stop().then(() => process.exit(1));
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        process.on('warning', (warning) => {
            console.warn(warning.name);
            console.warn(warning.message);
            console.warn(warning.stack);
        });

        process.on('SIGINT', async (signal) => {
            console.log(`Received ${signal}, gracefully shutting down`);
            await this.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async (signal) => {
            console.log(`Received ${signal}, gracefully shutting down`);
            await this.stop();
            process.exit(0);
        });

        process.on('beforeExit', async (code) => {
            if (code !== 0) {return;}
            debug('Process beforeExit: ', code);
            await this.stop();
        });

        process.on('exit', (code) => {
            console.log(`Bye: ${code}`);
        });
    }

}

module.exports = Canvas;
