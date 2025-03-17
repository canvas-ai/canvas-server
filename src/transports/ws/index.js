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
        credentials: true
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

    // Track workspace subscriptions across all clients
    #workspaceSubscriptions = new Map(); // workspaceId -> Set of socket IDs

    constructor(options = {}) {
        debug(`Initializing WebSocket Transport with options: ${JSON.stringify(options)}`);
        this.#config = { ...DEFAULT_CONFIG, ...options };
        this.ResponseObject = ResponseObject;
    }

    setCanvasServer(server) {
        debug('Setting Canvas server instance');
        this.#canvasServer = server;
    }

    /**
     * Get the underlying Socket.IO server instance
     * @returns {Server} Socket.IO server instance
     */
    getIo() {
        return this.#io;
    }

    /**
     * Check if there are active subscriptions for a workspace
     * @param {string} workspaceId - Workspace ID
     * @returns {boolean} True if there are active subscriptions
     */
    hasWorkspaceSubscribers(workspaceId) {
        const subscribers = this.#workspaceSubscriptions.get(workspaceId);
        return subscribers !== undefined && subscribers.size > 0;
    }

    /**
     * Get the number of subscribers for a workspace
     * @param {string} workspaceId - Workspace ID
     * @returns {number} Number of subscribers
     */
    getWorkspaceSubscriberCount(workspaceId) {
        const subscribers = this.#workspaceSubscriptions.get(workspaceId);
        return subscribers ? subscribers.size : 0;
    }

    /**
     * Broadcast an event to all clients subscribed to a workspace
     * @param {string} workspaceId - Workspace ID
     * @param {string} eventName - Event name
     * @param {Object} data - Event data
     */
    broadcastToWorkspace(workspaceId, eventName, data) {
        const subscribers = this.#workspaceSubscriptions.get(workspaceId);
        if (!subscribers || subscribers.size === 0) {
            return;
        }

        debug(`Broadcasting event ${eventName} to ${subscribers.size} clients for workspace ${workspaceId}`);

        // Emit to each subscribed socket
        if (this.#io) {
            subscribers.forEach(socketId => {
                const socket = this.#io.sockets.sockets.get(socketId);
                if (socket && socket.connected) {
                    socket.emit(`workspace:${eventName}`, { workspaceId, data });
                }
            });
        }
    }

    /**
     * Add a subscription for a workspace
     * @param {string} workspaceId - Workspace ID
     * @param {string} socketId - Socket ID
     */
    addWorkspaceSubscription(workspaceId, socketId) {
        if (!this.#workspaceSubscriptions.has(workspaceId)) {
            this.#workspaceSubscriptions.set(workspaceId, new Set());
        }

        this.#workspaceSubscriptions.get(workspaceId).add(socketId);
        debug(`Added subscription for workspace ${workspaceId} from socket ${socketId}, total subscribers: ${this.#workspaceSubscriptions.get(workspaceId).size}`);
    }

    /**
     * Remove a subscription for a workspace
     * @param {string} workspaceId - Workspace ID
     * @param {string} socketId - Socket ID
     */
    removeWorkspaceSubscription(workspaceId, socketId) {
        const subscribers = this.#workspaceSubscriptions.get(workspaceId);
        if (subscribers) {
            subscribers.delete(socketId);
            debug(`Removed subscription for workspace ${workspaceId} from socket ${socketId}, remaining subscribers: ${subscribers.size}`);

            // Clean up the map entry if there are no more subscribers
            if (subscribers.size === 0) {
                this.#workspaceSubscriptions.delete(workspaceId);
                debug(`No more subscribers for workspace ${workspaceId}, removed workspace from subscription map`);
            }
        }
    }

    /**
     * Remove all subscriptions for a socket
     * @param {string} socketId - Socket ID
     */
    removeSocketSubscriptions(socketId) {
        debug(`Removing all subscriptions for socket ${socketId}`);

        // For each workspace subscription
        for (const [workspaceId, subscribers] of this.#workspaceSubscriptions.entries()) {
            if (subscribers.has(socketId)) {
                subscribers.delete(socketId);
                debug(`Removed subscription for workspace ${workspaceId} from socket ${socketId}, remaining subscribers: ${subscribers.size}`);

                // Clean up the map entry if there are no more subscribers
                if (subscribers.size === 0) {
                    this.#workspaceSubscriptions.delete(workspaceId);
                    debug(`No more subscribers for workspace ${workspaceId}, removed workspace from subscription map`);
                }
            }
        }
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
            debug('Using provided HTTP server for WebSocket');
        }

        // Initialize Socket.IO server with improved configuration
        this.#io = new Server(this.#httpServer, {
            cors: this.#config.cors,
            // Connection parameters
            connectTimeout: 45000,
            // Ping settings
            pingTimeout: 30000,
            pingInterval: 25000,
            // Transport settings
            transports: ['websocket', 'polling'],
            allowUpgrades: true,
            upgradeTimeout: 10000,
            // Max payload
            maxHttpBufferSize: 1e6, // 1MB
            // Performance
            perMessageDeflate: true,
            httpCompression: true,
            // Security
            allowEIO3: false,
            cookie: {
                name: 'canvas.sid',
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 86400 * 30 * 1000 // 30 days
            }
        });

        // Set up debugging for connection events
        this.#io.engine.on('connection', (socket) => {
            debug(`Raw engine connection established: ${socket.id}`);

            socket.on('error', (err) => {
                debug(`Socket error for ${socket.id}: ${err.message}`);
            });

            socket.on('close', (reason) => {
                debug(`Socket ${socket.id} closed. Reason: ${reason}`);
            });
        });

        // Monitor ping/pong
        this.#io.engine.on('packet', (packet) => {
            if (packet.type === 'ping') {
                debug(`Server sent ping to clients`);
            } else if (packet.type === 'pong') {
                debug(`Server received pong from client`);
            }
        });

        // Set up global disconnect handler for all sockets
        this.#io.on('disconnect', (socket) => {
            debug(`Socket ${socket.id} disconnected`);
            // Clean up any workspace subscriptions for this socket
            this.removeSocketSubscriptions(socket.id);
        });

        // Set max listeners
        this.#io.sockets.setMaxListeners(15);

        // Handle custom ping
        this.#io.on('ping', (socket, callback) => {
            debug(`Received custom ping from client ${socket.id}`);
            if (typeof callback === 'function') {
                callback();
            }
        });

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
                workspaces: 0
            };
        }

        return {
            running: true,
            connections: this.#io.sockets.sockets.size,
            workspaces: this.#workspaceSubscriptions.size
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
        const { default: workspaceRoutes } = await import('./routes/v2/workspace.js');

        this.#io.on('connection', async (socket) => {
            debug(`Client connected: ${socket.id}`);

            // Initialize socket state
            socket.sessionManager = this.#canvasServer.sessionManager;
            socket.session = null;
            socket.context = null;
            socket.wsTransport = this; // Give socket access to this transport instance

            // Load routes
            contextRoutes(socket, {
                ResponseObject: this.ResponseObject,
                sessionManager: this.#canvasServer.sessionManager,
                context: this.#canvasServer.contextManager,
            });

            workspaceRoutes(socket, {
                ResponseObject: this.ResponseObject,
                userManager: this.#canvasServer.userManager,
                workspaceManager: this.#canvasServer.workspaceManager,
                wsTransport: this, // Pass this transport instance to the routes
            });

            socket.on('disconnect', () => {
                debug(`Client disconnected: ${socket.id}`);
                // Clean up any workspace subscriptions for this socket
                this.removeSocketSubscriptions(socket.id);
            });
        });
    }

    /**
     * Set up workspace event listeners for a specific workspace
     * @param {string} workspaceId - Workspace ID
     * @param {Object} workspace - Workspace instance
     */
    setupWorkspaceListeners(workspaceId, workspace) {
        if (!workspace || !workspace.id) {
            debug(`Cannot setup listeners: Invalid workspace for ${workspaceId}`);
            return false;
        }

        debug(`Setting up event listeners for workspace ${workspaceId}`);

        // Define all workspace events we want to listen for
        const events = [
            'workspace:tree:updated',
            'workspace:layer:created',
            'workspace:layer:updated',
            'workspace:layer:renamed',
            'workspace:layer:deleted',
            'workspace:status:changed',
            'workspace:color:changed',
            'workspace:description:changed',
            'workspace:label:changed',
            'workspace:locked',
            'workspace:unlocked',
            'workspace:config:changed'
        ];

        // First check if we already have listeners for this workspace
        if (workspace._wsListenersSetup) {
            debug(`Workspace ${workspaceId} already has event listeners set up`);
            return true;
        }

        // For each event, add a listener
        events.forEach(eventName => {
            // First remove any existing listeners to avoid duplicates
            workspace.removeAllListeners(`${eventName}:ws-bridge`);

            // Add a new listener with a unique name suffix to avoid conflicts
            workspace.on(eventName, (data) => {
                debug(`Workspace event ${eventName} received for ${workspaceId}`);

                // Only broadcast if there are subscribers
                if (this.hasWorkspaceSubscribers(workspaceId)) {
                    debug(`Broadcasting ${eventName} event to ${this.getWorkspaceSubscriberCount(workspaceId)} subscribers`);
                    this.broadcastToWorkspace(workspaceId, eventName, data);
                }
            });

            debug(`Added listener for ${eventName} on workspace ${workspaceId}`);
        });

        // Mark workspace as having listeners set up
        workspace._wsListenersSetup = true;
        return true;
    }
}

export default WebSocketTransport;
