'use strict';

import { verifyJWT, verifyApiToken, validateUser } from '../auth/strategies.js';
import { Server } from 'socket.io';

/**
 * Simplified WebSocket handler using EventEmitter2 wildcards
 * This replaces the complex event re-emission chain with direct forwarding
 */
export default function setupSimplifiedWebSocketHandlers(fastify) {
  const connections = new Map();
  const connectionAttempts = new Map();
  const io = fastify.io;

  // Socket.IO authentication middleware (same as before)
  io.use(async (socket, next) => {
    try {
      const clientAddress = socket.handshake.address;
      const connectionId = socket.handshake.headers['x-connection-id'] || generateConnectionId();

      // Rate limiting
      if (!connectionAttempts.has(clientAddress)) {
        connectionAttempts.set(clientAddress, { count: 1, timestamp: Date.now() });
      } else {
        const attempts = connectionAttempts.get(clientAddress);
        attempts.count += 1;
        if (attempts.count > 10 && (Date.now() - attempts.timestamp) < 60000) {
          console.error(`[WebSocket] Too many connection attempts from ${clientAddress}`);
          return next(new Error('Too many connection attempts'));
        }
        if ((Date.now() - attempts.timestamp) > 60000) {
          connectionAttempts.set(clientAddress, { count: 1, timestamp: Date.now() });
        }
      }

      // Token authentication
      const token = socket.handshake.auth.token ||
                   socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        console.error('[WebSocket] No authentication token provided');
        return next(new Error('Authentication token required'));
      }

      let user;
      try {
        if (token.startsWith('canvas-')) {
          const tokenResult = await fastify.authService.verifyApiToken(token);
          if (!tokenResult) {
            return next(new Error('Invalid API token'));
          }
          user = await fastify.userManager.getUserById(tokenResult.userId);
        } else {
          const decoded = fastify.jwt.verify(token);
          user = await fastify.userManager.getUserById(decoded.sub);
        }

        if (!user || !user.id || !user.email || user.status !== 'active') {
          return next(new Error('User validation failed'));
        }

        socket.user = {
          id: user.id,
          email: user.email.toLowerCase(),
          userType: user.userType || 'user',
          status: user.status || 'active'
        };
        socket.connectionId = connectionId;

        console.log(`[WebSocket] Authentication successful for user: ${user.id}`);
        next();
      } catch (error) {
        next(new Error(`Authentication failed: ${error.message}`));
      }
    } catch (err) {
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  // Setup connection handlers
  io.on('connection', (socket) => {
    const user = socket.user;
    const subscriptions = new Set();
    const eventListeners = new Map(); // Track listeners for cleanup

    console.log(`[WebSocket] User ${user.id} connected with socket ID ${socket.id}`);

    // Store connection
    connections.set(socket.id, {
      socket,
      user,
      subscriptions,
      connectionTime: Date.now(),
      connectionId: socket.connectionId,
      lastActivity: Date.now()
    });

    // Send authenticated event
    socket.emit('authenticated', {
      userId: user.id,
      email: user.email
    });

    // === SIMPLIFIED EVENT FORWARDING USING EventEmitter2 WILDCARDS ===

    // Setup wildcard listeners for manager events
    const setupManagerEventForwarding = () => {
      const managers = [
        { manager: fastify.contextManager, prefix: 'context' },
        { manager: fastify.workspaceManager, prefix: 'workspace' },
        { manager: fastify.userManager, prefix: 'user' }
      ];

      managers.forEach(({ manager, prefix }) => {
        if (!manager) return;

        // Listen to ALL events from this manager using wildcards
        const wildcardListener = async (eventData) => {
          try {
            const eventName = this.event; // EventEmitter2 provides this.event

            console.log(`[WebSocket] ${prefix} event: ${eventName}`, eventData);

            // Check user access for context/workspace events
            if (prefix === 'context' || prefix === 'workspace') {
              const contextId = eventData.contextId || eventData.id;
              const workspaceId = eventData.workspaceId || eventData.id;

              if (contextId && prefix === 'context') {
                const hasAccess = await fastify.contextManager.hasContext(user.id, contextId);
                if (!hasAccess) {
                  console.log(`[WebSocket] Access denied - ${eventName} for context ${contextId}`);
                  return;
                }
              }

              if (workspaceId && prefix === 'workspace') {
                const hasAccess = await fastify.workspaceManager.hasWorkspace(user.id, workspaceId);
                if (!hasAccess) {
                  console.log(`[WebSocket] Access denied - ${eventName} for workspace ${workspaceId}`);
                  return;
                }
              }
            }

            // Forward event directly to client with original name
            socket.emit(eventName, eventData);
            console.log(`[WebSocket] ✅ Forwarded ${eventName} to user ${user.id}`);

          } catch (error) {
            console.error(`[WebSocket] Error forwarding ${prefix} event:`, error);
          }
        };

        // Use EventEmitter2 wildcards to listen to ALL events from this manager
        manager.on('**', wildcardListener);

        // Store for cleanup
        eventListeners.set(`${prefix}:wildcard`, { manager, listener: wildcardListener });
      });
    };

    setupManagerEventForwarding();

    // Handle subscription requests (simplified)
    socket.on('subscribe', (payload) => {
      try {
        const { topic, id } = payload;
        if (!topic) {
          return socket.emit('error', { message: 'Subscription failed: Missing topic' });
        }

        const subscription = id ? `${topic}:${id}` : topic;
        subscriptions.add(subscription);

        socket.emit('subscribed', { topic, id });
        console.log(`[WebSocket] User ${user.id} subscribed to ${subscription}`);
      } catch (err) {
        socket.emit('error', { message: `Subscription error: ${err.message}` });
      }
    });

    // Handle ping
    socket.on('ping', () => {
      const connection = connections.get(socket.id);
      if (connection) {
        connection.lastActivity = Date.now();
      }
      socket.emit('pong', { time: Date.now() });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] User ${user.id} disconnected. Reason: ${reason}`);

      // Clean up event listeners
      eventListeners.forEach(({ manager, listener }, key) => {
        manager.removeListener('**', listener);
        console.log(`[WebSocket] Cleaned up listener: ${key}`);
      });
      eventListeners.clear();

      connections.delete(socket.id);
    });
  });

  // Broadcast utilities (simplified)
  fastify.decorate('broadcastToUser', (userId, eventType, payload) => {
    let sentCount = 0;
    for (const [socketId, connection] of connections.entries()) {
      if (connection.user.id === userId) {
        try {
          connection.socket.emit(eventType, payload);
          sentCount++;
        } catch (error) {
          console.error(`[WebSocket] Error broadcasting to user ${userId}:`, error);
          connections.delete(socketId);
        }
      }
    }
    return sentCount;
  });

  // Cleanup interval
  setInterval(() => {
    const now = Date.now();
    let staleCount = 0;

    for (const [socketId, connection] of connections.entries()) {
      if (now - connection.lastActivity > 30 * 60 * 1000) {
        try {
          connection.socket.disconnect(true);
        } catch (e) {
          // Already disconnected
        }
        connections.delete(socketId);
        staleCount++;
      }
    }

    if (staleCount > 0) {
      console.log(`[WebSocket] Cleaned up ${staleCount} stale connections`);
    }

    // Clean up connection attempts
    for (const [address, attempts] of connectionAttempts.entries()) {
      if (now - attempts.timestamp > 5 * 60 * 1000) {
        connectionAttempts.delete(address);
      }
    }
  }, 5 * 60 * 1000);
}

function generateConnectionId() {
  return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
