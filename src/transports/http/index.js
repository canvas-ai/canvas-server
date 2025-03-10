// Utils
import debugInstance from 'debug';
const debug = debugInstance('canvas:transport:http');
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
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
import usersRoutes from './routes/v2/users.js';
import workspacesRoutes from './routes/v2/workspaces.js';
import documentsRoutes from './routes/v2/documents.js';

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

    async start() {
        if (this.#isShuttingDown) {
            throw new Error('Server is currently shutting down');
        }

        if (!this.#canvasServer) {
            throw new Error('Canvas server instance not set. Call setCanvasServer() before starting.');
        }

        const app = this.#configureExpress();
        await this.#setupRoutes(app);
        this.#server = http.createServer(app);

        // Set max listeners to prevent warning
        this.#server.setMaxListeners(5);

        return new Promise((resolve, reject) => {
            this.#server.listen(this.#config.port, this.#config.host, () => {
                console.log(`HTTP server started at http://${this.#config.host}:${this.#config.port}/`);
                resolve();
            }).on('error', reject);
        });
    }

    async stop() {
        if (!this.#server) {
            debug('No server instance to stop');
            return Promise.resolve();
        }

        if (this.#isShuttingDown) {
            debug('Server is already shutting down, waiting for existing shutdown to complete');
            return this.#closePromise;
        }

        this.#isShuttingDown = true;
        debug('Shutting down server...');

        this.#closePromise = new Promise((resolve) => {
            // Remove all existing listeners to prevent memory leaks
            this.#server.removeAllListeners('close');

            this.#server.close(() => {
                debug('HTTP server gracefully shut down');
                this.#server = null;
                this.#isShuttingDown = false;
                resolve();
            });

            // Force close after timeout
            setTimeout(() => {
                if (this.#server) {
                    debug('Force closing remaining connections');
                    this.#server.closeAllConnections?.();
                    this.#server = null;
                    this.#isShuttingDown = false;
                    resolve();
                }
            }, 5000);
        });

        return this.#closePromise;
    }

    async restart() {
        await this.stop();
        await this.start();
    }

    status() {
        if (!this.#server) { return { listening: false }; }
        return {
            protocol: this.#config.protocol,
            host: this.#config.host,
            port: this.#config.port,
            listening: this.#server.listening
        };
    }

    #configureExpress() {
        const app = express();

        // Configure static file serving
        const staticPath = path.resolve(this.#config.staticPath);
        if (fs.existsSync(staticPath)) {
            debug(`Serving static files from: ${staticPath}`);
            app.use(express.static(staticPath));

            // Serve index.html for all non-API routes to support client-side routing
            // But exclude Swagger routes
            app.get('*', (req, res, next) => {
                if (req.path.startsWith(this.#config.basePath) || req.path.startsWith('/api-docs')) {
                    return next();
                }
                res.sendFile(path.join(staticPath, 'index.html'));
            });
        } else {
            debug(`Static path not found: ${staticPath}`);
        }

        // Middleware
        app.set('trust proxy', true);
        app.use(cors({
            origin: (origin, callback) => {
                debug(`Checking CORS for origin: ${origin}`);

                // Allow requests with no origin, empty origin, or 'null' origin
                // - null/undefined: Server-to-server requests
                // - empty string: Some proxy configurations
                // - 'null' string: Requests from file:// URLs or sandboxed contexts
                if (!origin || origin === '' || origin === 'null') {
                    debug('Allowing request with absent/empty/null origin');
                    callback(null, true);
                    return;
                }

                // Check if origin matches any of our allowed patterns
                const isAllowed =
                    this.#config.cors.origins?.some(o => new RegExp(o.replace('*.', '.*')).test(origin)) || // Match allowed domains
                    /^https?:\/\/localhost(:[0-9]+)?$/.test(origin) || // Match localhost with optional port
                    /^https?:\/\/127\.0\.0\.1(:[0-9]+)?$/.test(origin) || // Match 127.0.0.1 with optional port
                    /^https?:\/\/\d{1,3}(\.\d{1,3}){3}(:[0-9]+)?$/.test(origin); // Match IP addresses with optional port

                if (isAllowed) {
                    debug(`Origin ${origin} is allowed`);
                    callback(null, true);
                } else {
                    debug(`Origin ${origin} is not allowed`);
                    callback(new Error(`CORS policy: ${origin} not allowed`));
                }
            },
            methods: this.#config.cors?.methods || DEFAULT_CONFIG.cors.methods,
            allowedHeaders: this.#config.cors?.allowedHeaders || DEFAULT_CONFIG.cors.allowedHeaders,
            credentials: this.#config.cors?.credentials || DEFAULT_CONFIG.cors.credentials
        }));

        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(cookieParser());
        app.use(this.#setSecurityHeaders);

        // Initialize Passport
        configurePassport(this.#config.auth.jwtSecret);
        app.use(passport.initialize());

        return app;
    }

    #setSecurityHeaders(req, res, next) {
        res.setHeader('Content-Security-Policy', "default-src 'self'");
        next();
    }

    async #setupRoutes(app) {
        console.log('Setting up routes with base path:', this.#config.basePath);

        // Get auth service from the Canvas server
        const authService = this.#canvasServer.services.get('auth');
        if (!authService) {
            throw new Error('Auth service not found in Canvas server');
        }

        // Setup Swagger documentation BEFORE authentication middleware
        // This ensures API docs are accessible without authentication
        const swagger = setupSwagger();
        swagger.setupRoutes(app);

        // Health check endpoint (unprotected)
        app.get(`${this.#config.basePath}/ping`, (req, res) => {
            res.status(200).json({
                message: 'pong',
                status: 'ok',
                timestamp: new Date().toISOString(),
                productName: productName,
                version: version,
                platform: process.platform,
                architecture: process.arch,
            });
        });

        // Mount auth routes (unprotected)
        const authBasePath = `${this.#config.basePath}/`;
        app.use(authBasePath, (await import('./routes/v2/auth.js')).default(authService));

        // Create a middleware that excludes Swagger routes from authentication
        const authMiddleware = (req, res, next) => {
            // Skip authentication for Swagger routes
            if (req.path.startsWith('/api-docs')) {
                return next();
            }

            // Apply authentication middleware for all other routes
            return authService.getAuthMiddleware()(req, res, next);
        };

        // Protect all other routes with authentication, except Swagger routes
        app.use(this.#config.basePath, authMiddleware);

        // Register context routes
        const contextBasePath = `${this.#config.basePath}/v2/context`;
        app.use(contextBasePath, contextRoutes({
            auth: authService,
            contextManager: this.#canvasServer.contextManager,
            sessionManager: this.#canvasServer.sessionManager,
            workspaceManager: this.#canvasServer.workspaceManager
        }));

        // Register users routes
        const usersBasePath = `${this.#config.basePath}/v2/users`;
        app.use(usersBasePath, usersRoutes({
            auth: authService,
            userManager: this.#canvasServer.userManager,
            workspaceManager: this.#canvasServer.workspaceManager,
            contextManager: this.#canvasServer.contextManager,
            sessionManager: this.#canvasServer.sessionManager
        }));

        // Register workspaces routes
        const workspacesBasePath = `${this.#config.basePath}/v2/workspaces`;
        app.use(workspacesBasePath, workspacesRoutes({
            auth: authService,
            workspaceManager: this.#canvasServer.workspaceManager
        }));

        // Register documents routes
        const documentsBasePath = `${this.#config.basePath}/v2/documents`;
        app.use(documentsBasePath, documentsRoutes({
            auth: authService,
            workspaceManager: this.#canvasServer.workspaceManager,
            contextManager: this.#canvasServer.contextManager
        }));

        // Register admin routes
        const adminBasePath = `${this.#config.basePath}/v2/admin`;
        app.use(adminBasePath, (await import('./routes/v2/admin.js')).default(authService));

        // API routes (protected)
        this.#loadApiRoutes(app);
    }

    async #loadApiRoutes(app) {
        for (const version of API_VERSIONS) {
            const versionPath = path.join(__dirname, 'routes', version);
            debug(`Attempting to load routes from: ${versionPath}`);

            if (!fs.existsSync(versionPath)) {
                debug(`Routes directory not found: ${versionPath}`);
                continue;
            }

            try {
                const routeFiles = fs.readdirSync(versionPath)
                    .filter(file => file.endsWith('.js'));

                if (routeFiles.length === 0) {
                    debug(`No route files found in: ${versionPath}`);
                    continue;
                }

                for (const file of routeFiles) {
                    const routePath = path.join(versionPath, file);
                    const fileUrl = new URL(`file://${routePath}`).href;
                    debug(`Loading route from URL: ${fileUrl}`);
                    const route = await import(fileUrl);
                    const routeBasePath = `${this.#config.basePath}/${version}/${path.parse(file).name}`;
                    debug(`Loading route: ${routeBasePath}`);

                    app.use(routeBasePath, this.#injectDependencies.bind(this), route.default);
                }
            } catch (error) {
                debug(`Error loading routes from ${versionPath}: ${error.message}`);
            }
        }
    }

    #injectDependencies(req, res, next) {
        req.ResponseObject = this.ResponseObject;
        req.canvas = this.#canvasServer;
        next();
    }
}

export default HttpRestTransport;
