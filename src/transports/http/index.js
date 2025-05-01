// Utils
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('transport:http');
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
import os from 'os';
// Transport dependencies
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import http from 'http';
import ResponseObject from '../ResponseObject.js';

// Import package info
import pkg from '../../../package.json' with { type: 'json' };
const { productName, version, description, license } = pkg;

// Default configuration
const DEFAULT_CONFIG = {
    protocol: process.env.CANVAS_TRANSPORT_HTTP_PROTOCOL || 'http',
    host: process.env.CANVAS_TRANSPORT_HTTP_HOST || '0.0.0.0',
    port: process.env.CANVAS_TRANSPORT_HTTP_PORT || 8001,
    basePath: process.env.CANVAS_TRANSPORT_HTTP_BASE_PATH || '/rest',
    cors: {
        origin: true, // Allow all origins
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'x-device-id',
            'x-device-name',
            'x-app-name',
            'x-selected-session',
            'x-workspace-id',
            'x-context-id',
        ],
        exposedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        maxAge: 86400, // 24 hours
    },
    auth: {
        enabled: process.env.CANVAS_TRANSPORT_HTTP_AUTH_ENABLED || false,
        jwtSecret: process.env.CANVAS_TRANSPORT_HTTP_JWT_SECRET || 'canvas-jwt-secret',
        jwtLifetime: process.env.CANVAS_TRANSPORT_HTTP_JWT_LIFETIME || '48h',
    },
    staticPath: './src/ui/web/dist',
};

class HttpRestTransport {
    #config;
    #server;
    #closePromise;
    #isShuttingDown = false;
    #canvasServer;
    #app;
    #connections = new Set();
    #wsTransport; // Reference to WebSocket transport

    constructor(options = {}) {
        debug('Initializing HTTP Transport');

        // Extract only the properties we need
        const {
            protocol = DEFAULT_CONFIG.protocol,
            host = DEFAULT_CONFIG.host,
            port = DEFAULT_CONFIG.port,
            basePath = DEFAULT_CONFIG.basePath,
            cors: corsOptions,
            auth: authOptions,
            staticPath = DEFAULT_CONFIG.staticPath,
        } = options;

        // Handle CORS configuration
        let corsConfig;
        if (corsOptions === false) {
            corsConfig = false;
        } else if (corsOptions === true || !corsOptions) {
            corsConfig = DEFAULT_CONFIG.cors;
        } else {
            corsConfig = {
                ...DEFAULT_CONFIG.cors,
                ...corsOptions,
            };
        }

        // Handle auth configuration
        const authConfig = {
            ...DEFAULT_CONFIG.auth,
            ...(authOptions || {}),
        };

        this.#config = {
            protocol,
            host,
            port,
            basePath,
            cors: corsConfig,
            auth: authConfig,
            staticPath,
        };

        this.ResponseObject = ResponseObject;
        debug('HTTP Transport initialized');
    }

    /**
     * Set security headers for all responses
     * @private
     */
    #setSecurityHeaders(req, res, next) {
        // Set security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

        // For API endpoints and API docs, use a more permissive CSP
        if (req.path.startsWith(this.#config.basePath) || req.path.startsWith('/api-docs')) {
            res.setHeader(
                'Content-Security-Policy',
                `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:; font-src 'self' data:; connect-src 'self' http://localhost http://localhost:* https://localhost https://localhost:* http://127.0.0.1 http://127.0.0.1:* https://127.0.0.1 https://127.0.0.1:* ws://localhost ws://localhost:* wss://localhost wss://localhost:* ws://127.0.0.1 ws://127.0.0.1:* wss://127.0.0.1 wss://127.0.0.1:*`,
            );
            next();
            return;
        }

        // Content Security Policy for other routes
        res.setHeader(
            'Content-Security-Policy',
            `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost http://localhost:* https://localhost https://localhost:* http://127.0.0.1 http://127.0.0.1:* https://127.0.0.1 https://127.0.0.1:* ws://localhost ws://localhost:* wss://localhost wss://localhost:* ws://127.0.0.1 ws://127.0.0.1:* wss://127.0.0.1 wss://127.0.0.1:*`,
        );

        next();
    }

    /**
     * Set the Canvas server instance
     * @param {Object} server - Canvas server instance
     */
    setCanvasServer(server) {
        debug('Setting Canvas server instance');
        this.#canvasServer = server;
    }

    /**
     * Set the WebSocket transport reference
     * This allows HTTP routes to broadcast events via WebSockets
     * @param {Object} wsTransport - WebSocket transport instance
     */
    setWebSocketTransport(wsTransport) {
        debug('Setting WebSocket transport reference');
        this.#wsTransport = wsTransport;
    }

    /**
     * Get the server instance
     * @returns {http.Server} HTTP server instance
     */
    getServer() {
        return this.#server;
    }

    async start() {
        debug('Starting HTTP transport');
        if (this.#isShuttingDown) {
            throw new Error('HTTP server is currently shutting down');
        }

        if (!this.#canvasServer) {
            throw new Error('Canvas server instance not set. Call setCanvasServer() before starting.');
        }

        const app = express();
        this.#app = app;

        // Store reference to WebSocket transport in app.locals
        // This makes it accessible to all routes
        if (this.#wsTransport) {
            debug('Adding WebSocket transport reference to app.locals');
            app.locals.wsTransport = this.#wsTransport;
        }

        // Set up middleware
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(cookieParser());
        app.use(this.#setSecurityHeaders.bind(this));

        // Set up CORS - simplified and permissive
        debug('Setting up CORS');
        app.use(cors(this.#config.cors));

        // Health check endpoint (unprotected)
        app.get(`${this.#config.basePath}/v2/ping`, (req, res) => {
            const response = new ResponseObject().success(
                {
                    message: 'pong',
                    timestamp: new Date().toISOString(),
                    version: version,
                    name: productName,
                    productName: productName,
                    description: description,
                    license: license,
                    architecture: os.arch(),
                    platform: os.platform(),
                },
                'Context created successfully',
            );
            res.status(200).json(response);
        });

        // Get services from canvas server
        const authService = this.#canvasServer.services.get('auth');
        const sessionManager = this.#canvasServer.sessionManager;
        const userManager = this.#canvasServer.userManager;

        if (!authService) {
            throw new Error('Auth service is required for HTTP transport');
        }

        if (!sessionManager) {
            throw new Error('Session manager is required for HTTP transport');
        }

        if (!userManager) {
            throw new Error('User manager is required for HTTP transport');
        }

        // Initialize auth service if not already initialized
        if (!authService.initialized) {
            await authService.initialize();
        }

        // Add important global objects to app context
        app.set('authService', authService);
        app.set('sessionManager', sessionManager);
        app.set('userManager', userManager);

        // Initialize passport
        app.use(authService.passport.initialize());

        // Register API routes
        try {
            debug('Registering API routes');

            // Dynamically import and register routes
            const authRoutesModule = await import('./routes/v2/auth.js');
            app.use(`${this.#config.basePath}/v2/auth`, authRoutesModule.default(authService));

            const sessionsRoutesModule = await import('./routes/v2/sessions.js');
            app.use(
                `${this.#config.basePath}/v2/sessions`,
                sessionsRoutesModule.default({
                    auth: authService,
                    sessionManager,
                }),
            );

            if (userManager) {
                debug('Registering contexts routes');
                const contextsRoutesModule = await import('./routes/v2/contexts.js');
                app.use(
                    `${this.#config.basePath}/v2/contexts`,
                    contextsRoutesModule.default({
                        auth: authService,
                        userManager,
                    }),
                );

                debug('Registering workspaces routes');
                const workspacesRoutesModule = await import('./routes/v2/workspaces.js');
                app.use(
                    `${this.#config.basePath}/v2/workspaces`,
                    workspacesRoutesModule.default({
                        auth: authService,
                        userManager,
                    }),
                );

                debug('Registering users routes');
                const usersRoutesModule = await import('./routes/v2/users.js');
                app.use(
                    `${this.#config.basePath}/v2/users`,
                    usersRoutesModule.default({
                        auth: authService,
                        userManager,
                        sessionManager,
                    }),
                );
            }

            debug('API routes registered successfully');
        } catch (error) {
            debug(`Error registering routes: ${error.message}`);
            throw error;
        }

        // Configure static file serving AFTER API routes
        const staticPath = path.resolve(this.#config.staticPath);
        if (fs.existsSync(staticPath)) {
            debug(`Serving static files from: ${staticPath}`);
            app.use(express.static(staticPath));

            // Serve index.html for all non-API routes to support client-side routing
            app.get('*', (req, res, next) => {
                if (req.path.startsWith(this.#config.basePath) || req.path.startsWith('/api-docs')) {
                    return next();
                }
                res.sendFile(path.join(staticPath, 'index.html'));
            });
        } else {
            debug(`Static path not found: ${staticPath}`);
        }

        // Create HTTP server
        this.#server = http.createServer(app);

        // Track connections
        this.#server.on('connection', (connection) => {
            debug('New connection established');
            this.#connections.add(connection);
            connection.on('close', () => {
                debug('Connection closed');
                this.#connections.delete(connection);
            });
        });

        // Handle process signals
        process.on('SIGTERM', () => this.stop());
        process.on('SIGINT', () => this.stop());

        // Start listening
        await new Promise((resolve, reject) => {
            this.#server.listen(this.#config.port, this.#config.host, () => {
                debug(`HTTP server listening on ${this.#config.host}:${this.#config.port}`);
                resolve();
            });

            this.#server.on('error', (error) => {
                debug(`HTTP server error: ${error.message}`);
                reject(error);
            });
        });

        debug('HTTP transport started');
    }

    async stop() {
        debug('Stopping HTTP transport');
        if (this.#isShuttingDown) {
            debug('Already shutting down, waiting for existing shutdown to complete');
            return this.#closePromise;
        }

        this.#isShuttingDown = true;
        debug('Starting graceful shutdown');

        this.#closePromise = new Promise((resolve, reject) => {
            if (!this.#server) {
                debug('HTTP server not running');
                this.#isShuttingDown = false;
                resolve();
                return;
            }

            // Close all existing connections
            debug(`Closing ${this.#connections.size} active connections`);
            for (const connection of this.#connections) {
                connection.end();
                this.#connections.delete(connection);
            }

            // Set a timeout for forceful shutdown
            const forceShutdown = setTimeout(() => {
                debug('Forcing shutdown after timeout');
                for (const connection of this.#connections) {
                    connection.destroy();
                }
                if (this.#server) {
                    this.#server.close();
                }
            }, 5000); // 5 seconds timeout

            // Attempt graceful shutdown
            this.#server.close((err) => {
                clearTimeout(forceShutdown);
                if (err) {
                    debug(`Error during graceful shutdown: ${err.message}`);
                    this.#isShuttingDown = false;
                    reject(err);
                    return;
                }

                debug('HTTP server closed successfully');
                this.#server = null;
                this.#connections.clear();
                this.#isShuttingDown = false;
                resolve();
            });
        });

        return this.#closePromise;
    }

    async restart() {
        debug('Restarting HTTP transport');
        await this.stop();
        await this.start();
        debug('HTTP transport restarted');
    }

    status() {
        return {
            running: !!this.#server,
            port: this.#config.port,
            host: this.#config.host,
        };
    }
}

export default HttpRestTransport;
