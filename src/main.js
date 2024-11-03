/**
 * Canvas
 */

// Utils
import path from 'path';
import debug from 'debug';
import EventEmitter from 'eventemitter2';
import Config from './utils/config/index.mjs';
import winston from 'winston';

// Core components
import Indexd from './core/indexd/index.mjs';
import Stored from './core/stored.mjs';
import Eventd from './core/eventd.mjs';
import Neurald from './core/neurald.mjs';

// Manager classes
import AppManager from './managers/app.mjs';
import RoleManager from './managers/role.mjs';
import UserManager from './managers/user.mjs';
import DeviceManager from './managers/device/index.mjs';
import PeerManager from './managers/peer.mjs';
import ServiceManager from './managers/service.mjs';

import SessionManager from './managers/session.mjs';
import WorkspaceManager from './managers/workspace.mjs';
import ContextManager from './managers/context.mjs';

// Transports
import TransportHttp from './transports/http.mjs';

// App constants
const MAX_SESSIONS = 32;
const MAX_CONTEXTS_PER_SESSION = 32;


/**
 * Main application
 */

class CanvasServer extends EventEmitter {

    #serverMode;
    #server = {};
    #user = {};
    #mode = 'full'; // full | minimal
    #status = 'stopped'; // stopped, initialized, starting, running, stopping;

    constructor(options = {}) {
        super(); // EventEmitter2

        debug('Initializing Canvas Server');
        debug('Options:', options);

        /**
         * Default options
         */
        options = {
            serverMode: options.serverMode || 'full', // full | minimal
            paths: {
                server: options.paths?.server || server.paths,
                user: options.paths?.user || user.paths,
            },
            ...options,
        };

        /**
         * Utils
         */

        // App info
        this.app = app;
        this.#serverMode = options.serverMode;
        this.#server.paths = options.paths.server;
        this.#user.paths = options.paths.user;

        // Global config module
        this.config = Config({
            serverConfigDir: this.#server.paths.config,
            userConfigDir: this.#user.paths.config,
            configPriority: (this.#serverMode === 'full') ? 'user' : 'server',
            versioning: false,
        });

        // Global Logger
        let logFile = path.join(this.#server.paths.var, 'canvas-server.log');
        debug('Server log file: ', logFile);
        this.logger = winston.createLogger({
            level: process.env['LOG_LEVEL'] || 'info',
            format: winston.format.simple(),
            transports: [
                new winston.transports.File({ filename: logFile }),
                // TODO: Add a debug-based transport
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
        this.logger.info(`Server mode: ${this.#serverMode}`);
        debug('Server paths:', this.#server.paths);
        debug('User paths:', this.#user.paths);

        /**
         * Canvas Server RoleManager (minimal mode)
         */

        this.roleManager = new RoleManager({
            rolesPath: this.#server.paths.roles,
        });

        // Initialize transports for the minimal mode || refactor
        if (this.#serverMode !== 'full') {
            this.logger.info('Canvas Server initialized in minimal mode');
            this.#status = 'initialized';
            return;
        }

        /**
         * Canvas services
         */

        // Canvas indexing service
        this.index = new Indexd({
            path: this.#user.paths.index,
            backupPath: path.join(this.#user.paths.index, 'backup'),
            backupOnOpen: true,
            backupOnClose: false,
            compression: true,
        });

        // Canvas data/storage service
        this.storage = new Stored({
            cache: {
                enabled: true,
                maxAge: -1,
                rootPath: this.#user.paths.cache,
                cachePolicy: 'pull-through',
            },
            backends: {
                file: {
                    enabled: true,
                    priority: 1,
                    type: 'local',
                    backend: 'file',
                    backendConfig: {
                        path: this.#user.paths.data,
                    }
                },
                db: {
                    enabled: true,
                    primary: true,
                    type: 'local',
                    backend: 'lmdb',
                    backendConfig: {
                        path: this.#user.paths.db,
                        backupOnOpen: true,
                        backupOnClose: false,
                        compression: true,
                    },
                },
            },
        });

        // Canvas event service
        this.eventd = new Eventd({});

        // Canvas NN integration
        this.neurald = new Neurald({});


        /**
         * Core managers
         */

        this.sessionManager = new SessionManager({
            sessionStore: this.index.createIndex('session'),
            contextManager: this.contextManager,
            // TODO: Replace with config.get('session')
            maxSessions: MAX_SESSIONS,
            maxContextsPerSession: MAX_CONTEXTS_PER_SESSION,
        });

        this.workspaceManager = new WorkspaceManager({

        })

        this.contextManager = new ContextManager({
            index: this.index,
            data: this.storage,
            // TODO: Replace with config.get('context')
            maxContexts: MAX_SESSIONS * MAX_CONTEXTS_PER_SESSION,
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


    // Global methods
    getContext(id) { return this.contextManager.getContext(id); }
    listContexts() { return this.contextManager.listContexts(); }


    /**
     * Canvas service controls
     */

    async start() {
        if (this.#status === 'running') { throw new Error('Canvas Server already running'); }

        // Initialize the universe
        // Inject the system context (for remote instances, this has to be provided by the client!)
        // Indexes
        // Storage
        // Load system context
        // Load user context

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
        //let config = this.config.open('server');
        //const transportsConfig = config.get('rest');
        //console.log('Transports config:', transportsConfig);

        // This is a (temporary) placeholder implementation
        const httpTransport = new TransportHttp({}, this );

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
     * Storage
     */


    updateDocument(doc, contextArray = [], featureArray = []) {
        return this.storage.updateDocument(doc, contextArray, featureArray);
    }

    removeDocument(doc, contextArray = [], featureArray = []) { }

    deleteDocument(doc, contextArray = [], featureArray = []) {
        return this.storage.deleteDocument(doc, contextArray, featureArray);
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

export default CanvasServer;
