import debugMessage from 'debug';
const debug = debugMessage('canvas:transport:http');
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import http from 'http';
import ResponseObject from '../../schemas/transports/ResponseObject.js';

const API_VERSIONS = ['v2'];
const DEFAULT_CONFIG = {
    protocol: process.env.CANVAS_TRANSPORT_HTTP_PROTOCOL || 'http',
    host: process.env.CANVAS_TRANSPORT_HTTP_HOST || '0.0.0.0',
    port: process.env.CANVAS_TRANSPORT_HTTP_PORT || 8001,
    basePath: process.env.CANVAS_TRANSPORT_HTTP_BASE_PATH || '/rest',
    auth: {
        enabled: process.env.CANVAS_TRANSPORT_HTTP_AUTH_ENABLED || false, // FIX ME: https://github.com/orgs/canvas-ai/projects/2/views/1?pane=issue&itemId=81465641
        accessToken: process.env.CANVAS_TRANSPORT_HTTP_ACCESS_TOKEN || 'canvas-server-token',
        jwtSecret: process.env.CANVAS_TRANSPORT_HTTP_JWT_SECRET || 'canvas-jwt-secret',
        jwtLifetime: process.env.CANVAS_TRANSPORT_HTTP_JWT_LIFETIME || '48h',
    }
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
        this.#setupRoutes(app);
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
        app.use(cookieParser());
        app.use(this.#setSecurityHeaders);
        return app;
    }

    #setSecurityHeaders(req, res, next) {
        res.setHeader('Content-Security-Policy', "default-src 'self'");
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
    }

    #setupRoutes(app) {
        console.log('Setting up routes with base path:', this.#config.basePath);

        // Health check
        app.get(`${this.#config.basePath}/ping`, (req, res) => {
            res.status(200).send('pong');
        });

        // Authentication
        app.post(`${this.#config.basePath}/login`, this.#handleLogin.bind(this));
        app.post(`${this.#config.basePath}/logout`, this.#authenticate.bind(this), this.#handleLogout);
        if (this.#config.auth.enabled) {
            app.use(this.#authenticate.bind(this));
        }

        // API routes
        this.#loadApiRoutes(app);
    }

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

        if (!token) {
            return res.status(403).json({ 
                error: 'Access denied. No token provided.' 
            });
        }

        // Compare directly with stored token
        if (token !== this.#config.auth.accessToken) {
            return res.status(401).json({ 
                error: 'Invalid token.' 
            });
        }

        req.user = { authenticated: true };

        next();
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
                const routeFiles = fs.readdirSync(versionPath).filter(file => file.endsWith('.js'));
                
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
