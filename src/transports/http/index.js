import debugMessage from 'debug';
const debug = debugMessage('canvas:transport:http');
import path from 'path';
import fs from 'fs';
const __dirname = path.dirname(new URL(import.meta.url).pathname);
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
    auth: {
        enabled: process.env.CANVAS_TRANSPORT_HTTP_AUTH_ENABLED || false, // FIX ME: https://github.com/orgs/canvas-ai/projects/2/views/1?pane=issue&itemId=81465641
        jwtToken: process.env.CANVAS_TRANSPORT_HTTP_JWT_TOKEN || 'canvas-server-token',
        jwtSecret: process.env.CANVAS_TRANSPORT_HTTP_JWT_SECRET || 'canvas-jwt-secret',
        jwtLifetime: process.env.CANVAS_TRANSPORT_HTTP_JWT_LIFETIME || '48h',
    }
};

class HttpRestTransport {

    #config;
    #server;

    constructor(options = {}) {
        this.#config = { ...DEFAULT_CONFIG, ...options };
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
        app.use(cors());
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
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
    }

    async #setupRoutes(app) {
        console.log('Setting up routes with base path:', this.#config.basePath);
<<<<<<< HEAD
        // Health check
=======

        // Initialize auth service
        const authService = new AuthService(this.#config.auth);

        // Health check endpoint (unprotected)
>>>>>>> origin/dev
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

<<<<<<< HEAD
    #handleLogin(req, res) {
        debug('Login request:', req.body);
        const { clientId, accessToken } = req.body;
        if (accessToken !== this.#config.accessToken) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ clientId, accessToken }, this.#config.jwtSecret, { expiresIn: this.#config.jwtLifetime });
        res.cookie('token', token, { httpOnly: true, maxAge: 172800 });
        res.json({ token });
    }

    #handleLogout(req, res) {
        res.clearCookie('token');
        res.json({ message: 'Logged out successfully' });
    }

    #authenticate(req, res, next) {
        const token = req.cookies.token || req.headers['authorization'];
        if (!token) return res.status(403).json({ error: 'No token provided' });

        jwt.verify(token, this.#config.jwtSecret, (err, decoded) => {
            if (err) return res.status(401).json({ error: 'Unauthorized' });
            req.user = decoded;
            next();
        });
    }

=======
>>>>>>> origin/dev
    async #loadApiRoutes(app) {
        for (const version of API_VERSIONS) {
            const versionPath = path.join(__dirname, 'routes', version);
            const routeFiles = fs.readdirSync(versionPath).filter(file => file.endsWith('.js'));

<<<<<<< HEAD
            for (const file of routeFiles) {
                const route = await import(path.join(versionPath, file));
                const routePath = `${this.#config.basePath}/${version}/${path.parse(file).name}`;
                debug(`Loading route: ${routePath}`);
                app.use(routePath, this.#injectDependencies.bind(this), route.default);
=======
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
>>>>>>> origin/dev
            }
        }
    }

    #injectDependencies(req, res, next) {
        //req.ResponseObject = this.ResponseObject;
        //req.canvas = this.canvas;
        next();
    }
}

export default HttpRestTransport;
