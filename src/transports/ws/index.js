import debugInstance from 'debug';
import { Server } from 'socket.io';
import http from 'http';
import ResponseObject from '../ResponseObject.js';

const debug = debugInstance('canvas:transport:ws');

const DEFAULT_CONFIG = {
    host: process.env.CANVAS_TRANSPORT_WS_HOST || '0.0.0.0',
    port: process.env.CANVAS_TRANSPORT_WS_PORT || 8002,
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    auth: {
        enabled: process.env.CANVAS_TRANSPORT_WS_AUTH_ENABLED === 'true' || false,
    },
};

class WebSocketTransport {
    #config;
    #io;
    #httpServer;
    #isShuttingDown = false;
    #canvasServer;

    constructor(options = {}) {
        debug(`Initializing WebSocket Transport with options: ${JSON.stringify(options)}`);
        this.#config = { ...DEFAULT_CONFIG, ...options };
        this.ResponseObject = ResponseObject;
    }

    setCanvasServer(server) {
        debug('Setting Canvas server instance');
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
            debug('Creating new HTTP server');
            this.#httpServer = http.createServer();
            this.#httpServer.listen(this.#config.port, this.#config.host, () => {
                debug(`WebSocket server listening on ${this.#config.host}:${this.#config.port}`);
            });
        } else {
            this.#httpServer = httpServer;
        }

        // Initialize Socket.IO server
        this.#io = new Server(this.#httpServer, {
            cors: this.#config.cors,
        });

        // Set max listeners
        this.#io.sockets.setMaxListeners(5);

        if (this.#config.auth.enabled) {
            debug('Setting up WebSocket authentication');
            await this.#setupAuthentication();
        }

        await this.#setupConnectionHandler();
        debug('WebSocket server started');
    }

    async stop() {
        if (this.#isShuttingDown) {
            debug('WebSocket server already shutting down');
            return;
        }

        this.#isShuttingDown = true;
        debug('Shutting down WebSocket server...');

        if (!this.#io) {
            debug('WebSocket server not running');
            this.#isShuttingDown = false;
            return;
        }

        return new Promise((resolve) => {
            this.#io.close((err) => {
                if (err) {
                    debug(`Error closing WebSocket server: ${err.message}`);
                }
                this.#io = null;
                this.#isShuttingDown = false;
                debug('WebSocket server closed');
                resolve();
            });
        });
    }

    status() {
        if (!this.#io) {
            return {
                running: false,
                connections: 0,
            };
        }

        return {
            running: true,
            connections: this.#io.sockets.sockets.size,
        };
    }

    async #setupAuthentication() {
        const authService = this.#canvasServer.services.get('auth');
        if (!authService) {
            throw new Error('Auth service not found in Canvas server');
        }

        const { default: createAuthMiddleware } = await import('./middleware/auth.js');
        const authMiddleware = createAuthMiddleware(this.#canvasServer);
        this.#io.use(authMiddleware);
        debug('WebSocket authentication middleware configured');
    }

    async #setupConnectionHandler() {
        debug('Setting up connection handler');
        const { default: contextRoutes } = await import('./routes/v2/context.js');

        this.#io.on('connection', async (socket) => {
            debug(`Client connected: ${socket.id}`);

            // Initialize socket state
            socket.sessionManager = this.#canvasServer.sessionManager;
            socket.session = null;
            socket.context = null;

            // Load routes
            contextRoutes(socket, {
                ResponseObject: this.ResponseObject,
                sessionManager: this.#canvasServer.sessionManager,
                context: this.#canvasServer.contextManager,
            });

            socket.on('disconnect', () => {
                debug(`Client disconnected: ${socket.id}`);
            });
        });
    }
}

export default WebSocketTransport;
