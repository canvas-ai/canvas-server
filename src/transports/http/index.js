// Utils
import debugInstance from 'debug';
const debug = debugInstance('canvas:transport:http');
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Transport dependencies
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import http from 'http';
import ResponseObject from '../ResponseObject.js';

// Import package info
import pkg from '../../../package.json' assert { type: 'json' };
const { productName, version, description, license } = pkg;

// Default configuration
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
            staticPath = DEFAULT_CONFIG.staticPath
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
                ...corsOptions
            };
        }

        // Handle auth configuration
        const authConfig = {
            ...DEFAULT_CONFIG.auth,
            ...(authOptions || {})
        };

        this.#config = {
            protocol,
            host,
            port,
            basePath,
            cors: corsConfig,
            auth: authConfig,
            staticPath
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

        // For API endpoints, don't set CSP to avoid blocking requests
        if (req.path.startsWith(this.#config.basePath)) {
            next();
            return;
        }

        // Content Security Policy - Allow connections to the API endpoints
        // Include both localhost and 127.0.0.1 with and without the port
        res.setHeader(
            'Content-Security-Policy',
            `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost http://localhost:* https://localhost https://localhost:* http://127.0.0.1 http://127.0.0.1:* https://127.0.0.1 https://127.0.0.1:* ws://localhost ws://localhost:* wss://localhost wss://localhost:* ws://127.0.0.1 ws://127.0.0.1:* wss://127.0.0.1 wss://127.0.0.1:*`
        );

        next();
    }

    setCanvasServer(server) {
        this.#canvasServer = server;
    }

    getServer() {
        if (!this.#server) {
            return null;
        }
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

        // Set up middleware
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(cookieParser());
        app.use(this.#setSecurityHeaders.bind(this));

        // Set up CORS
        if (this.#config.cors === false) {
            debug('CORS is disabled');
        } else {
            debug('Setting up CORS');
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
                        callback(null, origin);  // Return the actual origin instead of true
                    } else {
                        debug(`Origin ${origin} is not allowed`);
                        callback(new Error(`CORS policy: ${origin} not allowed`));
                    }
                },
                methods: this.#config.cors?.methods || DEFAULT_CONFIG.cors.methods,
                allowedHeaders: this.#config.cors?.allowedHeaders || DEFAULT_CONFIG.cors.allowedHeaders,
                credentials: this.#config.cors?.credentials || DEFAULT_CONFIG.cors.credentials
            }));
        }

        // Configure static file serving
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

        // Health check endpoint (unprotected)
        app.get(`${this.#config.basePath}/v2/ping`, (req, res) => {
            res.status(200).json({
                message: 'pong',
                status: 'ok',
                timestamp: new Date().toISOString(),
                version: version,
                name: productName,
                description: description,
                license: license
            });
        });

        // Register API routes
        try {
            debug('Registering API routes');

            // Get services from canvas server
            const authService = this.#canvasServer.services.get('auth');
            const sessionManager = this.#canvasServer.sessionManager;
            const contextManager = this.#canvasServer.services.get('context');

            // Dynamically import and register routes
            if (authService) {
                debug('Registering auth routes');
                const authRoutesModule = await import('./routes/v2/auth.js');
                app.use(`${this.#config.basePath}/v2/auth`, authRoutesModule.default(authService));
            }

            if (sessionManager) {
                debug('Registering sessions routes');
                const sessionsRoutesModule = await import('./routes/v2/sessions.js');
                app.use(`${this.#config.basePath}/v2/sessions`, sessionsRoutesModule.default({
                    auth: authService,
                    sessionManager
                }));
            }

            if (contextManager) {
                debug('Registering contexts routes');
                const contextsRoutesModule = await import('./routes/v2/contexts.js');
                app.use(`${this.#config.basePath}/v2/contexts`, contextsRoutesModule.default({ contextManager }));
            }

            debug('API routes registered successfully');
        } catch (error) {
            debug(`Error registering API routes: ${error.message}`);
            console.error('Failed to register API routes:', error);
        }

        // Create HTTP server
        this.#server = http.createServer(app);

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
            return this.#closePromise;
        }

        this.#isShuttingDown = true;

        this.#closePromise = new Promise((resolve, reject) => {
            if (!this.#server) {
                debug('HTTP server not running');
                this.#isShuttingDown = false;
                resolve();
                return;
            }

            this.#server.close((err) => {
                if (err) {
                    debug(`Error closing HTTP server: ${err.message}`);
                    this.#isShuttingDown = false;
                    reject(err);
                    return;
                }

                debug('HTTP server closed');
                this.#server = null;
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
            host: this.#config.host
        };
    }
}

export default HttpRestTransport;
