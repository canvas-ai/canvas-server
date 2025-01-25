import debugMessage from 'debug';
const debug = debugMessage('canvas:transport:http');
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import http from 'http';
import ResponseObject from '../../schemas/transports/ResponseObject.js';
import passport from 'passport';
import configurePassport from '../../utils/passport.js';
import AuthService from '../../services/auth/index.js';

const API_VERSIONS = ['v2'];
const DEFAULT_CONFIG = {
    protocol: process.env.CANVAS_TRANSPORT_HTTP_PROTOCOL || 'http',
    host: process.env.CANVAS_TRANSPORT_HTTP_HOST || '0.0.0.0',
    port: process.env.CANVAS_TRANSPORT_HTTP_PORT || 8001,
    basePath: process.env.CANVAS_TRANSPORT_HTTP_BASE_PATH || '/rest',
    cors: {
        origins: process.env.CANVAS_TRANSPORT_HTTP_CORS_ORIGINS?.split(',') || [
            'http://localhost:5173',
            'https://*.cnvs.ai',
            'https://cnvs.ai',
            'https://*.getcanvas.org',
            'https://getcanvas.org'
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-app-name'],
        credentials: true
    },
    auth: {
        enabled: process.env.CANVAS_TRANSPORT_HTTP_AUTH_ENABLED || false, // FIX ME: https://github.com/orgs/canvas-ai/projects/2/views/1?pane=issue&itemId=81465641
        jwtToken: process.env.CANVAS_TRANSPORT_HTTP_JWT_TOKEN || 'canvas-server-token',
        jwtSecret: process.env.CANVAS_TRANSPORT_HTTP_JWT_SECRET || 'canvas-jwt-secret',
        jwtLifetime: process.env.CANVAS_TRANSPORT_HTTP_JWT_LIFETIME || '48h',
    },
    staticPath: process.env.CANVAS_TRANSPORT_HTTP_STATIC_PATH || './src/ui/web/dist',
};

class HttpRestTransport {

    #config;
    #server;

    constructor(options = {}) {
        // Load transports config if available
        let transportConfig = {};
        const configPath = path.join(
            path.join(__dirname, '../../../server/config'),
            'canvas-server.transports.json'
        );


        try {
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.rest) {
                    transportConfig = config.rest;
                }
            }
        } catch (error) {
            debug(`Error loading transport config: ${error.message}`);
        }

        this.#config = {
            ...DEFAULT_CONFIG,
            ...transportConfig,
            ...options
        };
        this.ResponseObject = ResponseObject;
        debug(`HTTP Transport initialized with config:`, this.#config);
    }

    async start() {
        const app = this.#configureExpress();
        await this.#setupRoutes(app);
        this.#server = http.createServer(app);
        return new Promise((resolve, reject) => {
            this.#server.listen(this.#config.port, this.#config.host, () => {
                console.log(`HTTP server started at http://${this.#config.host}:${this.#config.port}/`);
                resolve();
            }).on('error', reject);
        });
    }

    async stop() {
        if (this.#server) {
            debug('Shutting down server...');
            return new Promise((resolve) => {
                this.#server.close(() => {
                    console.log('HTTP server gracefully shut down');
                    resolve();
                });
            });
        }
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
            app.get('*', (req, res, next) => {
                if (req.path.startsWith(this.#config.basePath)) {
                    return next();
                }
                res.sendFile(path.join(staticPath, 'index.html'));
            });
        } else {
            debug(`Static path not found: ${staticPath}`);
        }

        // Trust proxy
        app.set('trust proxy', true);

        // CORS middleware
        app.use(cors({
            origin: (origin, callback) => {
                if (
                    !origin || // Allow server-to-server requests without an origin
                    this.#config.cors.origins.some(o => new RegExp(o.replace('*.', '.*')).test(origin)) || // Match allowed domains
                    /http:\/\/(localhost|127\.0\.0\.1):\d+/.test(origin) || // Match localhost and 127.0.0.1
                    /http:\/\/\d{1,3}(\.\d{1,3}){3}:\d+/.test(origin) // Match LAN IPs
                ) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: this.#config.cors.methods,
            allowedHeaders: this.#config.cors.allowedHeaders,
            credentials: this.#config.cors.credentials
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

        // Initialize auth service
        const authService = new AuthService(this.#config.auth);

        // Health check endpoint (unprotected)
        app.get(`${this.#config.basePath}/ping`, (req, res) => {
            res.status(200).send('pong');
        });

        // Mount auth routes (unprotected)
        const authBasePath = `${this.#config.basePath}/`;
        app.use(authBasePath, (await import('./auth.js')).default(authService));

        // Protect all other routes with authentication
        app.use(this.#config.basePath, authService.getAuthMiddleware());

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
        req.canvas = this.canvas;
        next();
    }
}

export default HttpRestTransport;
