// WebSocket client module for Canvas Extension
// Handles real-time communication with Canvas server via socket.io

export class WebSocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
    this.contextId = null;
    this.serverUrl = null;
    this.apiToken = null;

    // Reconnection state
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.reconnectTimer = null;
    this.shouldReconnect = true;

    // Event handlers
    this.eventHandlers = new Map();

    // Connection state
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, authenticated, error

    console.log('WebSocketClient initialized');
  }

  // Initialize WebSocket connection
  async connect(serverUrl, apiToken, contextId = null) {
    try {
      console.log('WebSocketClient: Starting connection to', serverUrl);

      this.serverUrl = serverUrl;
      this.apiToken = apiToken;
      this.contextId = contextId;
      this.shouldReconnect = true;

      // Clear any existing connection
      await this.disconnect();

      return await this._attemptConnection();
    } catch (error) {
      console.error('WebSocketClient: Connection failed:', error);
      this.connectionState = 'error';
      this.emit('connection.error', { error: error.message });
      return false;
    }
  }

  // Internal connection attempt with socket.io protocol
  async _attemptConnection() {
    return new Promise((resolve, reject) => {
      try {
        this.connectionState = 'connecting';
        this.emit('connection.state', { state: 'connecting' });

        // Build proper WebSocket URL for socket.io
        // The server uses fastify-socket.io which expects the standard socket.io handshake
        const wsUrl = this.serverUrl.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket';
        console.log('WebSocketClient: Connecting to WebSocket URL:', wsUrl);

        // Create WebSocket connection
        this.socket = new WebSocket(wsUrl);

        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
          console.error('WebSocketClient: Connection timeout');
          this.socket?.close();
          reject(new Error('Connection timeout'));
        }, 10000);

        this.socket.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('WebSocketClient: WebSocket connected');
          this.connected = true;
          this.connectionState = 'connected';
          this.reconnectAttempts = 0; // Reset on successful connection

          this.emit('connection.state', { state: 'connected' });
        };

        this.socket.onmessage = (event) => {
          this._handleMessage(event.data);
        };

        this.socket.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log('WebSocketClient: WebSocket closed', event.code, event.reason);
          this._handleDisconnection();

          if (event.code === 1000) {
            // Normal closure
            resolve(false);
          } else {
            // Abnormal closure - might want to reconnect
            if (this.shouldReconnect) {
              this._scheduleReconnect();
            }
            resolve(false);
          }
        };

        this.socket.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('WebSocketClient: WebSocket error:', error);
          this.connectionState = 'error';
          this.emit('connection.error', { error: 'WebSocket connection error' });
          reject(error);
        };

        // Resolve when authenticated
        this.once('authenticated', () => {
          resolve(true);
        });

      } catch (error) {
        console.error('WebSocketClient: Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  // Handle incoming messages (socket.io protocol)
  _handleMessage(data) {
    try {
      console.log('WebSocketClient: Received message:', data);

      // Handle socket.io protocol packets
      if (data === '0') {
        // Initial connect - send auth as handshake auth parameter would be better
        // But since we're using raw WebSocket, we'll authenticate after connection
        console.log('WebSocketClient: Received initial connect, sending auth...');
        // Send authentication using socket.io event format
        this._sendMessage('42' + JSON.stringify(['authenticate', {
          token: this.apiToken
        }]));
        return;
      }

      if (data === '40') {
        // Connected to default namespace
        console.log('WebSocketClient: Connected to namespace');
        return;
      }

      if (data.startsWith('42')) {
        // Event packet
        const eventData = data.substring(2);
        const parsed = JSON.parse(eventData);

        if (Array.isArray(parsed) && parsed.length >= 2) {
          const [eventName, payload] = parsed;
          this._handleEvent(eventName, payload);
        }
        return;
      }

      if (data === '3') {
        // Heartbeat pong
        console.log('WebSocketClient: Received pong');
        return;
      }

      // Try to parse as JSON event for fallback
      try {
        const parsed = JSON.parse(data);
        if (parsed.type && parsed.data) {
          this._handleEvent(parsed.type, parsed.data);
        }
      } catch (parseError) {
        console.warn('WebSocketClient: Could not parse message as JSON:', data);
      }

    } catch (error) {
      console.error('WebSocketClient: Failed to parse message:', error, data);
    }
  }

  // Handle specific events
  _handleEvent(eventName, payload) {
    console.log('WebSocketClient: Handling event:', eventName, payload);

    switch (eventName) {
      case 'authenticated':
        this._handleAuthenticated(payload);
        break;

      case 'document.inserted':
      case 'document.updated':
      case 'document.removed':
      case 'document.deleted':
      case 'document.removed.batch':
      case 'document.deleted.batch':
        this._handleDocumentEvent(eventName, payload);
        break;

      case 'context.created':
      case 'context.updated':
      case 'context.deleted':
      case 'context.url.set':
        this._handleContextEvent(eventName, payload);
        break;

      case 'pong':
        console.log('WebSocketClient: Received pong');
        break;

      default:
        console.log('WebSocketClient: Unknown event:', eventName, payload);
        this.emit(eventName, payload);
    }
  }

  // Handle authentication success
  _handleAuthenticated(payload) {
    console.log('WebSocketClient: Authenticated successfully:', payload);
    this.authenticated = true;
    this.connectionState = 'authenticated';

    this.emit('authenticated', payload);
    this.emit('connection.state', { state: 'authenticated' });

    // Join context channel if we have a context
    if (this.contextId) {
      this.joinContext(this.contextId);
    }
  }

  // Handle document events (tab sync)
  _handleDocumentEvent(eventName, payload) {
    console.log('WebSocketClient: Document event:', eventName, payload);

    // Filter only tab documents
    if (payload.document?.schema === 'data/abstraction/tab' ||
        payload.documents?.some(doc => doc.schema === 'data/abstraction/tab')) {

      this.emit('tab.event', {
        type: eventName,
        ...payload
      });
    }

    // Emit original event as well
    this.emit(eventName, payload);
  }

  // Handle context events
  _handleContextEvent(eventName, payload) {
    console.log('WebSocketClient: Context event:', eventName, payload);

    // If our context changed, we might need to rejoin
    if (eventName === 'context.url.set' && payload.contextId === this.contextId) {
      console.log('WebSocketClient: Our context URL changed');
      this.emit('context.changed', payload);
    }

    this.emit(eventName, payload);
  }

  // Handle disconnection
  _handleDisconnection() {
    console.log('WebSocketClient: Handling disconnection');

    this.connected = false;
    this.authenticated = false;
    this.connectionState = 'disconnected';

    this.emit('connection.state', { state: 'disconnected' });
    this.emit('disconnected');
  }

  // Send message to server
  _sendMessage(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocketClient: Sending message:', message);
      this.socket.send(message);
      return true;
    } else {
      console.warn('WebSocketClient: Cannot send message - socket not ready');
      return false;
    }
  }

  // Send event to server (socket.io format)
  send(eventName, data = {}) {
    const message = '42' + JSON.stringify([eventName, data]);
    return this._sendMessage(message);
  }

  // Send ping (socket.io heartbeat)
  ping() {
    return this._sendMessage('2'); // socket.io ping packet
  }

  // Join context channel
  async joinContext(contextId) {
    console.log('WebSocketClient: Joining context:', contextId);

    this.contextId = contextId;

    if (this.authenticated) {
      // Subscribe to context events
      const success = this.send('subscribe', {
        channel: `context:${contextId}`,
        contextId: contextId
      });

      if (success) {
        console.log('WebSocketClient: Successfully joined context:', contextId);
        this.emit('context.joined', { contextId });
        return true;
      }
    } else {
      console.log('WebSocketClient: Not authenticated yet, context will be joined after auth');
    }

    return false;
  }

  // Leave context channel
  async leaveContext() {
    console.log('WebSocketClient: Leaving context:', this.contextId);

    if (this.authenticated && this.contextId) {
      const oldContextId = this.contextId;

      const success = this.send('unsubscribe', {
        channel: `context:${this.contextId}`,
        contextId: this.contextId
      });

      this.contextId = null;

      if (success) {
        console.log('WebSocketClient: Successfully left context:', oldContextId);
        this.emit('context.left', { contextId: oldContextId });
        return true;
      }
    }

    return false;
  }

  // Disconnect WebSocket
  async disconnect() {
    console.log('WebSocketClient: Disconnecting...');

    this.shouldReconnect = false;

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close socket
    if (this.socket) {
      this.socket.close(1000, 'Normal closure');
      this.socket = null;
    }

    this._handleDisconnection();
  }

  // Schedule reconnection with exponential backoff
  _scheduleReconnect() {
    if (!this.shouldReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('WebSocketClient: Max reconnect attempts reached or reconnection disabled');
      this.emit('connection.failed', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`WebSocketClient: Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      console.log(`WebSocketClient: Reconnect attempt ${this.reconnectAttempts}`);
      this.emit('connection.state', { state: 'reconnecting', attempt: this.reconnectAttempts });

      try {
        const success = await this._attemptConnection();
        if (!success) {
          this._scheduleReconnect();
        }
      } catch (error) {
        console.error('WebSocketClient: Reconnect failed:', error);
        this._scheduleReconnect();
      }
    }, delay);
  }

  // Event handling
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  once(eventType, handler) {
    const onceHandler = (...args) => {
      handler(...args);
      this.off(eventType, onceHandler);
    };
    this.on(eventType, onceHandler);
  }

  off(eventType, handler) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(eventType, data) {
    if (this.eventHandlers.has(eventType)) {
      this.eventHandlers.get(eventType).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('WebSocketClient: Event handler error:', error);
        }
      });
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.connected,
      authenticated: this.authenticated,
      contextId: this.contextId,
      state: this.connectionState,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Check if connected and authenticated
  isConnected() {
    return this.connected && this.authenticated;
  }

  // Get current context
  getCurrentContext() {
    return this.contextId;
  }
}

// Create singleton instance
export const webSocketClient = new WebSocketClient();
export default webSocketClient;
