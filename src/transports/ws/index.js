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

        // Remove timestamp field if present
        if (options.timestamp) {
            delete options.timestamp;
        }

        this.#config = { ...DEFAULT_CONFIG, ...options };
        this.ResponseObject = ResponseObject;
        debug(`WebSocket Transport initialized with config:`, {
            protocol: this.#config.protocol,
            host: this.#config.host,
            port: this.#config.port,
            auth: {
                enabled: this.#config.auth.enabled,
                jwtSecret: this.#config.auth.jwtSecret ? 'provided' : 'missing'
            }
        });
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

        this.#closePromise = new Promise((resolve) => {
            if (!this.#io) {
                debug('WebSocket server not running');
                this.#isShuttingDown = false;
                resolve();
                return;
            }

            this.#io.close((err) => {
                if (err) {
                    debug(`Error closing WebSocket server: ${err.message}`);
                    this.#isShuttingDown = false;
                    // Log the error but still resolve the promise
                    resolve();
                    return;
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

        // Get JWT secret from auth service
        const jwtSecret = authService.sessionService.getJwtSecret();
        if (!jwtSecret) {
            throw new Error('JWT secret is required for WebSocket authentication');
        }

        debug('Setting up WebSocket authentication');

        // Import and use the WebSocket auth middleware
        import('./middleware/auth.js').then(({ default: createAuthMiddleware }) => {
            const authMiddleware = createAuthMiddleware(this.#canvasServer);
            this.#io.use(authMiddleware);
            debug('WebSocket authentication middleware configured');
        }).catch(error => {
            debug(`Error loading WebSocket auth middleware: ${error.message}`);
            throw error;
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
        debug('Setting up WebSocket admin routes');

        // Get services from Canvas server
        const authService = this.#canvasServer.services.get('auth');
        const userManager = this.#canvasServer.userManager;
        const sessionManager = this.#canvasServer.sessionManager;
        const contextManager = this.#canvasServer.contextManager;

        if (!authService) {
            debug('Auth service not available, skipping admin routes');
            return;
        }

        // Get JWT secret from auth service
        const jwtSecret = authService.sessionService.getJwtSecret();
        if (!jwtSecret) {
            debug('JWT secret not available, skipping admin routes');
            return;
        }

        // Create admin namespace
        const adminNamespace = this.#io.of('/admin');

        // Apply authentication middleware to admin namespace
        adminNamespace.use(async (socket, next) => {
            try {
                // Get token from handshake auth or headers
                const token = socket.handshake.auth.token ||
                              socket.handshake.headers['authorization']?.replace('Bearer ', '');

                if (!token) {
                    debug('No authentication token provided for admin namespace');
                    return next(new Error('Authentication token required'));
                }

                // Verify token
                const decoded = authService.verifyToken(token);
                if (!decoded) {
                    debug('Invalid token for admin namespace');
                    return next(new Error('Invalid token'));
                }

                // Get user
                const user = await userManager.getUserById(decoded.id);
                if (!user) {
                    debug('User not found for admin namespace');
                    return next(new Error('User not found'));
                }

                // Check if user is admin
                if (user.role !== 'admin') {
                    debug('User is not an admin');
                    return next(new Error('Unauthorized: Admin access required'));
                }

                // Attach user to socket
                socket.user = user;
                next();
            } catch (error) {
                debug(`Admin authentication error: ${error.message}`);
                next(new Error(`Authentication error: ${error.message}`));
            }
        });

        // Handle admin connections
        adminNamespace.on('connection', (socket) => {
            debug(`Admin connected: ${socket.user.email}`);

            // Register admin event handlers
            socket.on('server:status', async (data, callback) => {
                try {
                    const status = {
                        server: this.#canvasServer.status,
                        users: {
                            count: await userManager.countUsers()
                        },
                        sessions: {
                            count: await sessionManager.countSessions()
                        }
                    };

                    // Add context stats if available
                    if (contextManager) {
                        status.contexts = {
                            count: await contextManager.countContexts()
                        };
                    }

                    callback({ success: true, data: status });
                } catch (error) {
                    debug(`Error getting server status: ${error.message}`);
                    callback({ success: false, error: error.message });
                }
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                debug(`Admin disconnected: ${socket.user.email}`);
            });
        });

        debug('WebSocket admin routes setup complete');
    }
}

export default WebSocketTransport;
