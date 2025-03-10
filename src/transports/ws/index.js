import debugInstance from 'debug';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ResponseObject from '../ResponseObject.js';
import { Server } from 'socket.io';
import http from 'http';

const debug = debugInstance('canvas:transport:ws');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_VERSIONS = ['v2'];
const DEFAULT_CONFIG = {
    protocol: process.env.CANVAS_TRANSPORT_WS_PROTOCOL || 'ws',
    host: process.env.CANVAS_TRANSPORT_WS_HOST || '0.0.0.0',
    port: process.env.CANVAS_TRANSPORT_WS_PORT || 8002,
    cors: {
        origins: process.env.CANVAS_TRANSPORT_WS_CORS_ORIGINS?.split(',') || ['*'],
        methods: ['GET', 'POST'],
    },
    auth: {
        enabled: process.env.CANVAS_TRANSPORT_WS_AUTH_ENABLED || false,
    },
};

class WebSocketTransport {
    #config;
    #io;
    #httpServer;
    #closePromise;
    #isShuttingDown = false;
    #canvasServer;

    constructor(options = {}) {
        debug(`Initializing WebSocket Transport with options: ${JSON.stringify(options)}`);
        this.#config = { ...DEFAULT_CONFIG, ...options };
        this.ResponseObject = ResponseObject;
        debug(`WebSocket Transport initialized with config:`, this.#config);
    }

    /**
     * Set the Canvas server instance
     * @param {Object} server - Canvas server instance
     */
    setCanvasServer(server) {
        this.#canvasServer = server;
    }

    async start(httpServer = null) {
        if (this.#isShuttingDown) {
            throw new Error('WebSocket server is currently shutting down');
        }

        if (!this.#canvasServer) {
            throw new Error('Canvas server instance not set. Call setCanvasServer() before starting.');
        }

        // Create HTTP server if not provided
        if (!httpServer) {
            const http = await import('http');
            httpServer = http.createServer();
            httpServer.listen(this.#config.port, this.#config.host, () => {
                debug(`WebSocket server listening on ${this.#config.host}:${this.#config.port}`);
            });
        }

        const { Server } = await import('socket.io');
        this.#io = new Server(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
            },
        });

        // Set max listeners
        this.#io.sockets.setMaxListeners(5);

        if (this.#config.auth.enabled) {
            this.#setupAuthentication();
        }

        this.#setupConnectionHandler();

        // Register admin routes
        await this.#setupAdminRoutes();

        debug('WebSocket server started');
    }

    async stop() {
        if (this.#isShuttingDown) {
            return this.#closePromise;
        }

        this.#isShuttingDown = true;
        debug('Shutting down WebSocket server...');

        this.#closePromise = new Promise((resolve, reject) => {
            if (!this.#io) {
                debug('WebSocket server not running');
                this.#isShuttingDown = false;
                return resolve();
            }

            this.#io.close((err) => {
                if (err) {
                    debug(`Error closing WebSocket server: ${err.message}`);
                    this.#isShuttingDown = false;
                    return reject(err);
                }

                debug('WebSocket server closed');
                this.#io = null;
                this.#isShuttingDown = false;
                resolve();
            });
        });

        return this.#closePromise;
    }

    async restart(httpServer) {
        await this.stop();
        await this.start(httpServer);
    }

    status() {
        if (!this.#io) {
            return {
                running: false,
                listening: false,
                connections: 0,
            };
        }

        return {
            running: true,
            listening: true,
            connections: this.#io.sockets.sockets.size,
        };
    }

    #setupAuthentication() {
        // Get auth service from the Canvas server
        const authService = this.#canvasServer.services.get('auth');
        if (!authService) {
            throw new Error('Auth service not found in Canvas server');
        }

        debug('Setting up WebSocket authentication');

        this.#io.use(async (socket, next) => {
            try {
                // Get token from handshake auth or headers
                const token = socket.handshake.auth.token ||
                              socket.handshake.headers['authorization']?.replace('Bearer ', '');

                if (!token) {
                    debug('No authentication token provided');
                    return next(new Error('Authentication token required'));
                }

                debug(`Verifying token: ${token.substring(0, 10)}...`);

                // First try JWT token
                const decoded = authService.verifyToken(token);
                if (decoded) {
                    debug(`JWT token verified for user ID: ${decoded.id}`);
                    socket.user = decoded;
                    return next();
                }

                // Then try API token
                const apiTokenResult = await authService.verifyAuthToken(token);
                if (apiTokenResult) {
                    debug(`API token verified for user: ${apiTokenResult.user.email}`);
                    socket.user = apiTokenResult.user;
                    socket.tokenId = apiTokenResult.token.id;
                    return next();
                }

                debug('Invalid token');
                return next(new Error('Invalid token'));
            } catch (error) {
                debug(`Authentication error: ${error.message}`);
                return next(new Error(`Authentication error: ${error.message}`));
            }
        });
    }

    #setupConnectionHandler() {
        this.#io.on('connection', async (socket) => {
            debug(`Client connected: ${socket.id}`);

            // Initialize socket state
            socket.sessionManager = this.#canvasServer.sessionManager;
            socket.session = null; // Will be set by auth middleware
            socket.context = null; // Will be set when a context is selected

            // Load and bind route handlers
            await this.#loadSocketRoutes(socket);

            // Handle disconnect
            socket.on('disconnect', () => {
                debug(`Client disconnected: ${socket.id}`);
            });
        });
    }

    async #loadSocketRoutes(socket) {
        // Import and initialize route handlers
        const routeHandlers = [
            (await import('./routes/context.js')).default,
            (await import('./routes/documents.js')).default,
            (await import('./routes/workspaces.js')).default,
        ];

        // Initialize each route handler with the socket
        routeHandlers.forEach(handler => {
            if (typeof handler === 'function') {
                handler(socket, this.#canvasServer);
            }
        });
    }

    async #setupAdminRoutes() {
        // Admin namespace for monitoring and management
        const admin = this.#io.of('/admin');

        // Protect admin namespace
        admin.use((socket, next) => {
            // TODO: Implement admin authentication
            next();
        });

        admin.on('connection', (socket) => {
            debug('Admin connected');

            socket.on('status', (callback) => {
                callback({
                    connections: this.#io.sockets.sockets.size,
                    uptime: process.uptime(),
                });
            });

            socket.on('disconnect', () => {
                debug('Admin disconnected');
            });
        });
    }
}

export default WebSocketTransport;
