import debugInstance from 'debug';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ResponseObject from '../ResponseObject.js';

const debug = debugInstance('canvas:transport:ws');
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
    },
};

class WebSocketTransport {
    #config;
    #io;
    #isShuttingDown = false;
    #closePromise;
    #canvasServer;

    constructor(options = {}) {
        this.#config = { ...DEFAULT_CONFIG, ...options };
        this.ResponseObject = ResponseObject;
        debug('WebSocket Transport initialized with config:', this.#config);
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
        if (!this.#io) {
            debug('No WebSocket server instance to stop');
            return Promise.resolve();
        }

        if (this.#isShuttingDown) {
            debug('WebSocket server is already shutting down, waiting for existing shutdown to complete');
            return this.#closePromise;
        }

        this.#isShuttingDown = true;
        debug('Shutting down WebSocket server...');

        this.#closePromise = new Promise((resolve) => {
            // Close all existing connections
            const sockets = Array.from(this.#io.sockets.sockets.values());
            sockets.forEach(socket => {
                this.#handleDisconnect(socket);
                socket.disconnect(true);
            });

            // Close the server
            this.#io.close(() => {
                debug('WebSocket server gracefully shut down');
                this.#io = null;
                this.#isShuttingDown = false;
                resolve();
            });

            // Force close after timeout
            setTimeout(() => {
                if (this.#io) {
                    debug('Force closing remaining WebSocket connections');
                    this.#io = null;
                    this.#isShuttingDown = false;
                    resolve();
                }
            }, 5000);
        });

        return this.#closePromise;
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

        this.#io.use((socket, next) => {
            const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];

            if (!token) {
                return next(new Error('Authentication token required'));
            }

            const decoded = authService.verifyToken(token);
            if (!decoded) {
                return next(new Error('Invalid token'));
            }

            socket.user = decoded;
            next();
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
            canvasServer: this.#canvasServer,
            sessionManager: this.#canvasServer.sessionManager,
            session: socket.session,
            context: socket.context,
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

    async #setupAdminRoutes() {
        // Get auth service from the Canvas server
        const authService = this.#canvasServer.services.get('auth');
        if (!authService) {
            throw new Error('Auth service not found in Canvas server');
        }

        try {
            const adminRoutes = await import('./routes/v2/admin.js');
            adminRoutes.default(this.#io, authService);
            debug('Admin routes registered');
        } catch (error) {
            debug(`Error loading admin routes: ${error.message}`);
        }
    }
}

export default WebSocketTransport;
