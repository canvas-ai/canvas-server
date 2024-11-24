import debugMessage from 'debug';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ResponseObject from '../../schemas/transports/ResponseObject.js';
import { type } from 'os';

const debug = debugMessage('canvas:transport:ws');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_VERSIONS = ['v2'];
const DEFAULT_CONFIG = {
    protocol: process.env.CANVAS_TRANSPORT_WS_PROTOCOL || 'ws',
    host: process.env.CANVAS_TRANSPORT_WS_HOST || '0.0.0.0',
    port: process.env.CANVAS_TRANSPORT_WS_PORT || 8002,
    auth: {
        enabled: process.env.CANVAS_TRANSPORT_WS_AUTH_ENABLED || false,
        accessToken: process.env.CANVAS_TRANSPORT_WS_ACCESS_TOKEN || 'canvas-server-token',
        jwtSecret: process.env.CANVAS_TRANSPORT_WS_JWT_SECRET || 'canvas-jwt-secret',
        jwtLifetime: process.env.CANVAS_TRANSPORT_WS_JWT_LIFETIME || '48h',
    }
};

class WebSocketTransport {
    #config;
    #io;
    #parent;

    constructor(parent, options = {}) {
        this.#config = { ...DEFAULT_CONFIG, ...options };
        this.#parent = parent;
        this.ResponseObject = ResponseObject;
        debug(`WebSocket Transport initialized with config:`, this.#config);
    }

    async start(httpServer) {
        const { Server } = await import('socket.io');
        this.#io = new Server(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });

        if (this.#config.auth.enabled) {
            this.#setupAuthentication();
        }

        this.#setupConnectionHandler();
        debug('WebSocket server started');
    }

    async stop() {
        if (!this.#io || typeof this.#io.close !== 'function') {
            return;
        }
        debug('Shutting down WebSocket server...');
        await this.#io.close();
        // TODO: Implement a proper way to close all connections
    }

    async restart(httpServer) {
        await this.stop();
        await this.start(httpServer);
    }

    status() {
        if (!this.#io) { return { listening: false }; }
        return {
            protocol: this.#config.protocol,
            host: this.#config.host,
            port: this.#config.port,
            listening: true
        };
    }

    #setupAuthentication() {
        this.#io.use((socket, next) => {
            const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];

            if (!token) {
                return next(new Error('Authentication token required'));
            }

            try {
                const decoded = jwt.verify(token, this.#config.auth.jwtSecret);
                socket.user = decoded;
                next();
            } catch (err) {
                next(new Error('Invalid token'));
            }
        });
    }

    #setupConnectionHandler() {
        this.#io.on('connection', async (socket) => {
            debug(`Client connected: ${socket.id}`);

            // Initialize socket state
            socket.sessionManager = this.#parent.sessionManager;
            socket.session = this.#parent.session;
            socket.context = this.#parent.context;

            // Load and bind route handlers
            await this.#loadSocketRoutes(socket);

            socket.on('disconnect', () => {
                debug(`Client disconnected: ${socket.id}`);
                this.#handleDisconnect(socket);
            });
        });
    }

    async #loadSocketRoutes(socket) {
        for (const version of API_VERSIONS) {
            const versionPath = path.join(__dirname, 'routes', version);
            const routeFiles = fs.readdirSync(versionPath).filter(file => file.endsWith('.js'));

            for (const file of routeFiles) {
                try {
                    const route = await import(path.join(versionPath, file));
                    debug(`Loading socket route: ${file}`);
                    route.default(socket, this.#injectDependencies(socket));
                } catch (error) {
                    debug(`Error loading route ${file}:`, error);
                }
            }
        }
    }

    #injectDependencies(socket) {
        return {
            ResponseObject: this.ResponseObject,
            sessionManager: this.#parent.sessionManager,
            session: socket.session,
            context: socket.context,
            db: this.#parent.db
        };
    }

    #handleDisconnect(socket) {
        if (socket.context) {
            socket.context.cleanup?.();
        }
        if (socket.session) {
            socket.session.cleanup?.();
        }
    }
}

export default WebSocketTransport;
