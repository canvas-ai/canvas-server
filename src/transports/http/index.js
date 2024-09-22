const Service = require('../../managers/service/lib/Service');
const debug = require('debug')('canvas:transports:http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const API_VERSIONS = ['v1', 'v2'];
const DEFAULT_CONFIG = {
    protocol: process.env.HTTP_PROTOCOL || 'http',
    host: process.env.HOST || '0.0.0.0',
    port: process.env.PORT || 8000,
    basePath: process.env.BASE_PATH || '/rest',
    accessToken: process.env.ACCESS_TOKEN || 'canvas-server-token',
    jwtSecret: process.env.JWT_SECRET || 'canvas-jwt-secret',
    jwtLifetime: process.env.JWT_LIFETIME || '48h',
};

class HttpTransport extends Service {
    #server;
    #config;
    #io;

    constructor(options = {}) {
        super(options);
        this.#config = { ...DEFAULT_CONFIG, ...options };
        this.ResponseObject = require('../../schemas/transports/ResponseObject');
        this.canvas = options.canvas;
        debug(`HTTP Transport initialized with config:`, this.#config);
    }

    async start() {
        const app = this.#configureExpress();
        this.#setupRoutes(app);
        this.#server = http.createServer(app);
        this.#io = socketIo(this.#server);
        require('./socket.io/init')(this.#io, this);

        return new Promise((resolve, reject) => {
            this.#server.listen(this.#config.port, this.#config.host, () => {
                console.log(`HTTP server running at http://${this.#config.host}:${this.#config.port}/`);
                resolve();
            }).on('error', reject);
        });
    }

    async stop() {
        if (this.#server) {
            debug('Shutting down server...');
            return new Promise((resolve) => {
                this.#server.close(() => {
                    if (this.#io) this.#io.close();
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

        const connectedClients = this.#io ? Object.keys(this.#io.sockets.sockets).length : 0;
        return {
            protocol: this.#config.protocol,
            host: this.#config.host,
            port: this.#config.port,
            listening: this.#server.listening,
            connectedClients
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
        app.post('/login', this.#handleLogin.bind(this));
        app.post('/logout', this.#authenticate.bind(this), this.#handleLogout);
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
        if (!token) return res.status(403).json({ error: 'No token provided' });

        jwt.verify(token, this.#config.jwtSecret, (err, decoded) => {
            if (err) return res.status(401).json({ error: 'Unauthorized' });
            req.user = decoded;
            next();
        });
    }

    #loadApiRoutes(app) {
        API_VERSIONS.forEach(version => {
            const versionPath = path.join(__dirname, 'routes', version);
            const routeFiles = fs.readdirSync(versionPath).filter(file => file.endsWith('.js'));

            routeFiles.forEach(file => {
                const route = require(path.join(versionPath, file));
                const routePath = `/${this.#config.basePath}/${version}/${path.parse(file).name}`;
                app.use(routePath, this.#injectDependencies.bind(this), route);
            });
        });
    }

    #injectDependencies(req, res, next) {
        req.ResponseObject = this.ResponseObject;
        req.canvas = this.canvas;
        next();
    }
}

module.exports = HttpTransport;
