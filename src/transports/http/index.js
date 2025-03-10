// Utils
import debugInstance from 'debug';
const debug = debugInstance('canvas:transport:http');
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ip from 'ip';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Product info
import pkg from '@root/package.json' assert { type: 'json' };
const {
    productName,
    version
} = pkg

// Transport dependencies
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import http from 'http';
import ResponseObject from '../ResponseObject.js';
import passport from 'passport';
import configurePassport from '@/utils/passport.js';

// Swagger documentation
import setupSwagger from '@/utils/swagger.js';

// Routes
import contextRoutes from './routes/v2/context.js';
import contextsRoutes from './routes/v2/contexts.js';
import usersRoutes from './routes/v2/users.js';
import workspacesRoutes from './routes/v2/workspaces.js';
import documentsRoutes from './routes/v2/documents.js';
import sessionsRoutes from './routes/v2/sessions.js';

// Transport config
const API_VERSIONS = ['v2'];
const DEFAULT_CONFIG = {
    protocol: process.env.CANVAS_TRANSPORT_HTTP_PROTOCOL || 'http',
    host: process.env.CANVAS_TRANSPORT_HTTP_HOST || '0.0.0.0',
    port: process.env.CANVAS_TRANSPORT_HTTP_PORT || 8001,
    basePath: process.env.CANVAS_TRANSPORT_HTTP_BASE_PATH || '/rest',
    cors: {
        origins: process.env.CANVAS_TRANSPORT_HTTP_CORS_ORIGINS?.split(',') || [
            'http://127.0.0.1',
            'http://localhost',
            'https://*.cnvs.ai',
            'https://cnvs.ai',
            'https://*.getcanvas.org',
            'https://getcanvas.org'
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id', 'x-device-name', 'x-app-name'],
        credentials: true
    },
    auth: {
        enabled: process.env.CANVAS_TRANSPORT_HTTP_AUTH_ENABLED || false, // FIX ME: https://github.com/orgs/canvas-ai/projects/2/views/1?pane=issue&itemId=81465641
        jwtToken: process.env.CANVAS_TRANSPORT_HTTP_JWT_TOKEN || 'canvas-server-token',
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

    constructor(options = {}) {
        debug(`Initializing HTTP Transport with options: ${JSON.stringify(options)}`);

        this.#config = {
            ...DEFAULT_CONFIG,
            ...options,
            cors: options.cors ? DEFAULT_CONFIG.cors : {}
        };
        console.log(this.#config.cors);

        this.ResponseObject = ResponseObject;
        debug(`HTTP Transport initialized with config:`, this.#config);
    }

    /**
     * Set the Canvas server instance
     * @param {Object} server - Canvas server instance
     */
    setCanvasServer(server) {
        this.#canvasServer = server;
    }

    /**
     * Get the HTTP server instance
     * @returns {Object} - HTTP server instance
     */
    getServer() {
        return this.#server;
    }

    /**
     * Start the HTTP transport
     * @returns {Promise<void>}
     */
    async start() {
        if (this.#isShuttingDown) {
            throw new Error('HTTP server is currently shutting down');
        }

        if (!this.#canvasServer) {
            throw new Error('Canvas server instance not set. Call setCanvasServer() before starting.');
        }

        debug('Canvas server instance:', this.#canvasServer);
        debug('Canvas server services:', this.#canvasServer.services);
        debug('Auth service exists:', this.#canvasServer.services.has('auth'));

        const app = express();
        const authService = this.#canvasServer.services.get('auth');

        debug('Auth service retrieved:', authService);

        if (!authService) {
            throw new Error('Auth service not found in Canvas server');
        }

        // Configure middleware
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(cookieParser());

        // Configure CORS
        app.use(cors({
            origin: this.#config.cors.origins,
            methods: this.#config.cors.methods,
            allowedHeaders: this.#config.cors.allowedHeaders,
            credentials: this.#config.cors.credentials
        }));

        // Initialize passport
        app.use(passport.initialize());

        // Setup Swagger documentation
        setupSwagger(app);

        // Health check endpoint (unprotected)
        app.get(`${this.#config.basePath}/v2/ping`, (req, res) => {
            res.status(200).json({
                message: 'pong',
                status: 'ok',
                timestamp: new Date().toISOString(),
                productName: productName,
                version: version,
                platform: process.platform,
                architecture: process.arch,
                serverIp: ip.address('public'),
                serverHost: this.#config.host,
                serverPort: this.#config.port
            });
        });

        // Mount auth routes (unprotected)
        try {
            debug('Importing auth routes...');
            const authRoutesModule = await import('./routes/v2/auth.js');
            debug('Auth routes module imported:', authRoutesModule);

            if (!authRoutesModule.default) {
                debug('Auth routes module does not have a default export');
                throw new Error('Auth routes module does not have a default export');
            }

            debug('Creating auth routes with authService...');
            const authRoutes = authRoutesModule.default(authService);
            debug('Auth routes created:', authRoutes);

            app.use(`${this.#config.basePath}/v2/auth`, authRoutes);
            debug('Auth routes mounted');
        } catch (error) {
            debug('Error mounting auth routes:', error);
            throw error;
        }

        // Create a middleware that excludes Swagger routes from authentication
        const authMiddleware = (req, res, next) => {
            // Skip authentication for Swagger routes, ping endpoint, and auth routes
            if (req.path.startsWith('/api-docs') ||
                req.path.endsWith('/v2/ping') ||
                req.path.startsWith('/v2/auth/')) {
                return next();
            }

            // Apply authentication middleware for all other routes
            return authService.getAuthMiddleware()(req, res, next);
        };

        // Protect all other routes with authentication, except Swagger routes
        app.use(authMiddleware);

        // Mount API routes
        try {
            debug('Extracting services and managers from Canvas server...');
            const contextManager = this.#canvasServer.contextManager;
            const sessionManager = this.#canvasServer.sessionManager;
            const workspaceManager = this.#canvasServer.workspaceManager;
            const userManager = this.#canvasServer.userManager;

            debug('Mounting context routes...');
            app.use(`${this.#config.basePath}/v2/context`, contextRoutes({
                auth: authService,
                contextManager,
                sessionManager,
                workspaceManager
            }));

            debug('Mounting contexts routes...');
            app.use(`${this.#config.basePath}/v2/contexts`, contextsRoutes({
                auth: authService,
                contextManager,
                sessionManager,
                workspaceManager
            }));

            debug('Mounting users routes...');
            app.use(`${this.#config.basePath}/v2/users`, usersRoutes({
                auth: authService,
                userManager,
                sessionManager,
                workspaceManager,
                contextManager
            }));

            debug('Mounting sessions routes...');
            app.use(`${this.#config.basePath}/v2/sessions`, sessionsRoutes({
                auth: authService,
                sessionManager
            }));

            debug('Mounting workspaces routes...');
            app.use(`${this.#config.basePath}/v2/workspaces`, workspacesRoutes({
                auth: authService,
                workspaceManager,
                sessionManager,
                userManager
            }));

            debug('Mounting documents routes...');
            app.use(`${this.#config.basePath}/v2/documents`, documentsRoutes({
                auth: authService,
                workspaceManager,
                contextManager
            }));

            debug('All API routes mounted successfully');
        } catch (error) {
            debug('Error mounting API routes:', error);
            throw error;
        }

        // Serve static files if configured
        if (this.#config.staticPath) {
            const staticPath = path.resolve(this.#config.staticPath);
            if (fs.existsSync(staticPath)) {
                app.use(express.static(staticPath));
                app.get('*', (req, res) => {
                    res.sendFile(path.join(staticPath, 'index.html'));
                });
            }
        }

        // Error handling middleware
        app.use((err, req, res, next) => {
            console.error(err.stack);
            const response = new this.ResponseObject().serverError(err.message);
            res.status(response.statusCode).json(response.getResponse());
        });

        // Create HTTP server
        this.#server = http.createServer(app);

        // Start listening
        await new Promise((resolve, reject) => {
            this.#server.listen(this.#config.port, this.#config.host, () => {
                debug(`HTTP server listening on ${this.#config.host}:${this.#config.port}`);
                resolve();
            });

            this.#server.on('error', (err) => {
                reject(err);
            });
        });

        debug('HTTP transport started');
    }

    /**
     * Stop the HTTP transport
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this.#server) {
            debug('No HTTP server instance to stop');
            return Promise.resolve();
        }

        if (this.#isShuttingDown) {
            debug('HTTP server is already shutting down, waiting for existing shutdown to complete');
            return this.#closePromise;
        }

        this.#isShuttingDown = true;
        debug('Shutting down HTTP server...');

        this.#closePromise = new Promise((resolve) => {
            this.#server.close(() => {
                debug('HTTP server gracefully shut down');
                this.#server = null;
                this.#isShuttingDown = false;
                resolve();
            });

            // Force close after timeout
            setTimeout(() => {
                if (this.#server) {
                    debug('Force closing HTTP server');
                    this.#server = null;
                    this.#isShuttingDown = false;
                    resolve();
                }
            }, 5000);
        });

        return this.#closePromise;
    }

    /**
     * Restart the HTTP transport
     * @returns {Promise<void>}
     */
    async restart() {
        await this.stop();
        await this.start();
    }

    /**
     * Get the status of the HTTP transport
     * @returns {Object} - Status object
     */
    status() {
        if (!this.#server) { return { listening: false }; }

        return {
            protocol: this.#config.protocol,
            host: this.#config.host,
            port: this.#config.port,
            listening: this.#server.listening,
        };
    }
}

export default HttpRestTransport;
