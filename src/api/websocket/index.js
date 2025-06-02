'use strict';

import { verifyJWT, verifyApiToken, validateUser } from '../auth/strategies.js';
import { Server } from 'socket.io';
import registerContextWebSocket from './context.js';

/**
 * WebSocket event types
 */
const WS_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  ERROR: 'error',

  // Subscription events
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  SUBSCRIBED: 'subscribed',
  UNSUBSCRIBED: 'unsubscribed',

  // Data events
  WORKSPACE_UPDATED: 'workspace:updated',
  WORKSPACE_CREATED: 'workspace:created',
  WORKSPACE_DELETED: 'workspace:deleted',
  WORKSPACE_STATUS_CHANGED: 'workspace:status:changed',
  WORKSPACE_TREE_UPDATED: 'workspace:tree:updated',

  CONTEXT_CREATED: 'context:created',
  CONTEXT_UPDATED: 'context:updated',
  CONTEXT_DELETED: 'context:deleted',
  CONTEXT_URL_CHANGED: 'context:url:changed',
  CONTEXT_LOCKED: 'context:locked',
  CONTEXT_UNLOCKED: 'context:unlocked',

  // ACL events
  CONTEXT_ACL_UPDATED: 'context:acl:updated',
  CONTEXT_ACL_REVOKED: 'context:acl:revoked'
};

/**
 * Setup WebSocket handlers for the Fastify server
 * @param {FastifyInstance} fastify - Fastify instance
 */
export default function setupWebSocketHandlers(fastify) {
  // Store active connections
  const connections = new Map();

  // Track connection attempts for rate limiting
  const connectionAttempts = new Map();

  // Get Socket.IO instance from fastify
  const io = fastify.io;

  // Socket.IO authentication middleware
  io.use(async (socket, next) => {
    try {
      const clientAddress = socket.handshake.address;
      const connectionId = socket.handshake.headers['x-connection-id'] || generateConnectionId();

      // Track connection attempts for potential abuse
      if (!connectionAttempts.has(clientAddress)) {
        connectionAttempts.set(clientAddress, { count: 1, timestamp: Date.now() });
      } else {
        const attempts = connectionAttempts.get(clientAddress);
        attempts.count += 1;

        // If too many attempts in a short time, reject
        if (attempts.count > 10 && (Date.now() - attempts.timestamp) < 60000) {
          console.error(`[WebSocket] Too many connection attempts from ${clientAddress}`);
          return next(new Error('Too many connection attempts'));
        }

        // Reset counter if it's been more than a minute
        if ((Date.now() - attempts.timestamp) > 60000) {
          connectionAttempts.set(clientAddress, { count: 1, timestamp: Date.now() });
        }
      }

      // Log connection attempt details
      console.log(`[WebSocket] Connection attempt from ${clientAddress}, headers:`, {
        origin: socket.handshake.headers.origin,
        referer: socket.handshake.headers.referer,
        'user-agent': socket.handshake.headers['user-agent'],
        'x-connection-id': connectionId
      });

      // Extract token from auth or headers
      const token = socket.handshake.auth.token ||
                   socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        console.error('[WebSocket] No authentication token provided');
        return next(new Error('Authentication token required'));
      }

      console.log(`[WebSocket] Authentication token received: ${token.substring(0, 10)}...`);

      // Handle different token types
      let user;

      try {
        // Handle API token (canvas- prefix)
        if (token.startsWith('canvas-')) {
          console.log('[WebSocket] Detected API token, verifying...');
          const tokenResult = await fastify.authService.verifyApiToken(token);

          if (!tokenResult) {
            console.error('[WebSocket] API token verification failed');
            return next(new Error('Invalid API token'));
          }

          console.log(`[WebSocket] API token valid for user: ${tokenResult.userId}`);
          user = await fastify.userManager.getUserById(tokenResult.userId);
        }
        // Handle JWT token
        else {
          console.log('[WebSocket] Attempting JWT verification...');
          try {
            const decoded = fastify.jwt.verify(token);
            console.log(`[WebSocket] JWT verified for user: ${decoded.sub}`);
            user = await fastify.userManager.getUserById(decoded.sub);
          } catch (jwtError) {
            console.error('[WebSocket] JWT verification failed:', jwtError.message);
            return next(new Error(`Invalid JWT token: ${jwtError.message}`));
          }
        }

        if (!user) {
          console.error('[WebSocket] User not found after token verification');
          return next(new Error('User not found'));
        }

        // Check required properties directly without using validateUser
        if (!user.id || !user.email) {
          console.error('[WebSocket] User missing required properties (id or email)');
          return next(new Error('User validation failed: missing required properties'));
        }

        if (user.status !== 'active') {
          console.error(`[WebSocket] User not active: ${user.status}`);
          return next(new Error('User account is not active'));
        }

        // Create a simplified user object with essential properties
        // This avoids issues with read-only properties
        const essentialUserData = {
          id: user.id,
          email: user.email ? user.email.toLowerCase() : null,
          userType: user.userType || 'user',
          status: user.status || 'active'
        };

        // Set authenticated user on the socket
        socket.user = essentialUserData;
        socket.connectionId = connectionId;

        // Reset connection attempts for successful connections
        if (connectionAttempts.has(clientAddress)) {
          const attempts = connectionAttempts.get(clientAddress);
          attempts.count = Math.max(0, attempts.count - 2); // Reduce count for successful connections
        }

        console.log(`[WebSocket] Authentication successful for user: ${essentialUserData.id}`);
        next();
      } catch (verificationError) {
        console.error('[WebSocket] Token verification error:', verificationError);
        next(new Error(`Authentication failed: ${verificationError.message}`));
      }
    } catch (err) {
      console.error('[WebSocket] Unexpected authentication error:', err);
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  // Register broadcast methods
  fastify.decorate('broadcastToUser', (userId, eventType, payload) => {
    let sentCount = 0;
    for (const [socketId, connection] of connections.entries()) {
      if (connection.user.id === userId) {
        try {
          connection.socket.emit(eventType, payload);
          sentCount++;
        } catch (error) {
          console.error(`[WebSocket] Error broadcasting to user ${userId}:`, error);
          // Clean up broken connections
          connections.delete(socketId);
        }
      }
    }
    if (sentCount > 0) {
      console.log(`[WebSocket] Broadcast event ${eventType} to ${sentCount} connections for user ${userId}`);
    }
    return sentCount;
  });

  fastify.decorate('broadcastToWorkspace', (workspaceId, eventType, payload) => {
    let sentCount = 0;
    for (const [socketId, connection] of connections.entries()) {
      if (connection.subscriptions.has(`workspace:${workspaceId}`)) {
        try {
          connection.socket.emit(eventType, payload);
          sentCount++;
        } catch (error) {
          console.error(`[WebSocket] Error broadcasting to workspace ${workspaceId}:`, error);
          // Clean up broken connections
          connections.delete(socketId);
        }
      }
    }
    return sentCount;
  });

  fastify.decorate('broadcastToContext', (contextId, eventType, payload) => {
    let sentCount = 0;
    for (const [socketId, connection] of connections.entries()) {
      if (connection.subscriptions.has(`context:${contextId}`)) {
        try {
          connection.socket.emit(eventType, payload);
          sentCount++;
        } catch (error) {
          console.error(`[WebSocket] Error broadcasting to context ${contextId}:`, error);
          // Clean up broken connections
          connections.delete(socketId);
        }
      }
    }
    return sentCount;
  });

  // Get active connection count for a user
  fastify.decorate('getUserConnectionCount', (userId) => {
    let count = 0;
    for (const connection of connections.values()) {
      if (connection.user.id === userId) {
        count++;
      }
    }
    return count;
  });

  // Set up Socket.IO event handlers
  io.on('connection', (socket) => {
    const user = socket.user;
    const subscriptions = new Set();
    const connectionTime = Date.now();

    console.log(`[WebSocket] User ${user.id} connected with socket ID ${socket.id}`);

    // Store the connection
    connections.set(socket.id, {
      socket,
      user,
      subscriptions,
      connectionTime,
      connectionId: socket.connectionId || generateConnectionId(),
      lastActivity: Date.now()
    });

    // Register context websocket events
    registerContextWebSocket(fastify, socket);

    // Send authenticated event
    socket.emit('authenticated', {
      userId: user.id,
      email: user.email
    });

    // Handle subscription requests
    socket.on('subscribe', (payload) => {
      try {
        const { topic, id } = payload;
        if (!topic) {
          return socket.emit('error', { message: 'Subscription failed: Missing topic' });
        }

        const subscription = id ? `${topic}:${id}` : topic;
        subscriptions.add(subscription);

        // Update last activity
        const connection = connections.get(socket.id);
        if (connection) {
          connection.lastActivity = Date.now();
        }

        socket.emit('subscribed', { topic, id });
        console.log(`[WebSocket] User ${user.id} subscribed to ${subscription}`);
      } catch (err) {
        socket.emit('error', { message: `Subscription error: ${err.message}` });
      }
    });

    // Handle unsubscription requests
    socket.on('unsubscribe', (payload) => {
      try {
        const { topic, id } = payload;
        if (!topic) {
          return socket.emit('error', { message: 'Unsubscription failed: Missing topic' });
        }

        const subscription = id ? `${topic}:${id}` : topic;
        subscriptions.delete(subscription);

        // Update last activity
        const connection = connections.get(socket.id);
        if (connection) {
          connection.lastActivity = Date.now();
        }

        socket.emit('unsubscribed', { topic, id });
        console.log(`[WebSocket] User ${user.id} unsubscribed from ${subscription}`);
      } catch (err) {
        socket.emit('error', { message: `Unsubscription error: ${err.message}` });
      }
    });

    // Handle ping to keep connection alive and track activity
    socket.on('ping', () => {
      const connection = connections.get(socket.id);
      if (connection) {
        connection.lastActivity = Date.now();
      }
      socket.emit('pong', { time: Date.now() });
    });

    // Handle workspace events
    socket.on(WS_EVENTS.WORKSPACE_UPDATED, (payload) => {
      try {
        if (!payload?.workspaceId) {
          return socket.emit('error', { message: 'Missing workspaceId in payload' });
        }
        fastify.broadcastToWorkspace(payload.workspaceId, WS_EVENTS.WORKSPACE_UPDATED, payload);
      } catch (err) {
        socket.emit('error', { message: `Workspace update error: ${err.message}` });
      }
    });

    socket.on(WS_EVENTS.WORKSPACE_CREATED, (payload) => {
      try {
        if (!payload?.workspaceId) {
          return socket.emit('error', { message: 'Missing workspaceId in payload' });
        }
        fastify.broadcastToWorkspace(payload.workspaceId, WS_EVENTS.WORKSPACE_CREATED, payload);
      } catch (err) {
        socket.emit('error', { message: `Workspace creation error: ${err.message}` });
      }
    });

    socket.on(WS_EVENTS.WORKSPACE_DELETED, (payload) => {
      try {
        if (!payload?.workspaceId) {
          return socket.emit('error', { message: 'Missing workspaceId in payload' });
        }
        fastify.broadcastToWorkspace(payload.workspaceId, WS_EVENTS.WORKSPACE_DELETED, payload);
      } catch (err) {
        socket.emit('error', { message: `Workspace deletion error: ${err.message}` });
      }
    });

    socket.on(WS_EVENTS.WORKSPACE_STATUS_CHANGED, (payload) => {
      try {
        if (!payload?.workspaceId || !payload?.status) {
          return socket.emit('error', { message: 'Missing required fields in payload' });
        }
        fastify.broadcastToWorkspace(payload.workspaceId, WS_EVENTS.WORKSPACE_STATUS_CHANGED, payload);
      } catch (err) {
        socket.emit('error', { message: `Workspace status change error: ${err.message}` });
      }
    });

    socket.on(WS_EVENTS.WORKSPACE_TREE_UPDATED, (payload) => {
      try {
        if (!payload?.workspaceId) {
          return socket.emit('error', { message: 'Missing workspaceId in payload' });
        }
        fastify.broadcastToWorkspace(payload.workspaceId, WS_EVENTS.WORKSPACE_TREE_UPDATED, payload);
      } catch (err) {
        socket.emit('error', { message: `Workspace tree update error: ${err.message}` });
      }
    });

    // Handle context events
    socket.on(WS_EVENTS.CONTEXT_CREATED, (payload) => {
      try {
        if (!payload?.id) {
          return socket.emit('error', { message: 'Missing context id in payload for CONTEXT_CREATED' });
        }
        if (!socket.user || !socket.user.id) {
          console.error('[WebSocket] User information missing on socket for CONTEXT_CREATED broadcast');
          return socket.emit('error', { message: 'Cannot broadcast CONTEXT_CREATED: User unauthenticated or ID missing.' });
        }
        // Broadcast full context JSON to all user connections
        fastify.broadcastToUser(socket.user.id, WS_EVENTS.CONTEXT_CREATED, payload);
      } catch (err) {
        socket.emit('error', { message: `Context creation event error: ${err.message}` });
      }
    });

    // CONTEXT_UPDATED always sends the full context JSON (including URL and all params).
    // The frontend should listen for CONTEXT_UPDATED and update context state accordingly.
    // CONTEXT_URL_CHANGED is only needed for legacy or very specific cases.
    socket.on(WS_EVENTS.CONTEXT_UPDATED, (payload) => {
      try {
        if (!payload?.id) {
          return socket.emit('error', { message: 'Missing context id in payload for CONTEXT_UPDATED' });
        }
        // Validate payload based on operation type
        if (payload.operation) {
          switch (payload.operation) {
            case 'document:inserted':
            case 'document:update':
            case 'document:remove':
            case 'document:delete':
              if (!payload.document && !payload.documentArray) {
                return socket.emit('error', { message: 'Missing document or documentArray in payload' });
              }
              break;
          }
        }
        fastify.broadcastToContext(payload.id, WS_EVENTS.CONTEXT_UPDATED, payload);
      } catch (err) {
        socket.emit('error', { message: `Context update error: ${err.message}` });
      }
    });

    socket.on(WS_EVENTS.CONTEXT_DELETED, (payload) => {
      try {
        if (!payload?.id) {
          return socket.emit('error', { message: 'Missing context id in payload' });
        }
        fastify.broadcastToContext(payload.id, WS_EVENTS.CONTEXT_DELETED, payload);
      } catch (err) {
        socket.emit('error', { message: `Context deletion error: ${err.message}` });
      }
    });

    socket.on(WS_EVENTS.CONTEXT_URL_CHANGED, (payload) => {
      try {
        if (!payload?.id || !payload?.url) {
          return socket.emit('error', { message: 'Missing id or url in payload for CONTEXT_URL_CHANGED' });
        }
        fastify.broadcastToContext(payload.id, WS_EVENTS.CONTEXT_URL_CHANGED, payload);
      } catch (err) {
        socket.emit('error', { message: `Context URL change error: ${err.message}` });
      }
    });

    socket.on(WS_EVENTS.CONTEXT_LOCKED, (payload) => {
      try {
        if (!payload?.id) {
          return socket.emit('error', { message: 'Missing context id in payload for CONTEXT_LOCKED' });
        }
        if (typeof payload.locked !== 'boolean') {
          return socket.emit('error', { message: 'Missing or invalid locked status in payload for CONTEXT_LOCKED' });
        }
        fastify.broadcastToContext(payload.id, WS_EVENTS.CONTEXT_LOCKED, payload);
      } catch (err) {
        socket.emit('error', { message: `Context lock error: ${err.message}` });
      }
    });

    socket.on(WS_EVENTS.CONTEXT_UNLOCKED, (payload) => {
      try {
        if (!payload?.id) {
          return socket.emit('error', { message: 'Missing context id in payload for CONTEXT_UNLOCKED' });
        }
        if (typeof payload.locked !== 'boolean') {
          return socket.emit('error', { message: 'Missing or invalid locked status in payload for CONTEXT_UNLOCKED' });
        }
        fastify.broadcastToContext(payload.id, WS_EVENTS.CONTEXT_UNLOCKED, payload);
      } catch (err) {
        socket.emit('error', { message: `Context unlock error: ${err.message}` });
      }
    });

    // Handle context ACL events
    socket.on('context:acl:updated', (payload) => {
      try {
        if (!payload?.id) {
          return socket.emit('error', { message: 'Missing context id in payload for CONTEXT_ACL_UPDATED' });
        }
        fastify.broadcastToContext(payload.id, WS_EVENTS.CONTEXT_ACL_UPDATED, payload);
      } catch (err) {
        socket.emit('error', { message: `Context ACL update error: ${err.message}` });
      }
    });

    socket.on('context:acl:revoked', (payload) => {
      try {
        if (!payload?.id) {
          return socket.emit('error', { message: 'Missing context id in payload for CONTEXT_ACL_REVOKED' });
        }
        fastify.broadcastToContext(payload.id, WS_EVENTS.CONTEXT_ACL_REVOKED, payload);
      } catch (err) {
        socket.emit('error', { message: `Context ACL revoke error: ${err.message}` });
      }
    });

    // Handle document events
    socket.on('document:insert', (payload) => {
      try {
        if (!payload?.documentId) {
          return socket.emit('error', { message: 'Missing documentId in payload' });
        }
        fastify.broadcastToContext(payload.contextId, 'document:insert', payload);
      } catch (err) {
        socket.emit('error', { message: `Document insert error: ${err.message}` });
      }
    });

    socket.on('document:update', (payload) => {
      try {
        if (!payload?.documentId) {
          return socket.emit('error', { message: 'Missing documentId in payload' });
        }
        fastify.broadcastToContext(payload.contextId, 'document:update', payload);
      } catch (err) {
        socket.emit('error', { message: `Document update error: ${err.message}` });
      }
    });

    socket.on('document:remove', (payload) => {
      try {
        if (!payload?.documentId) {
          return socket.emit('error', { message: 'Missing documentId in payload' });
        }
        fastify.broadcastToContext(payload.contextId, 'document:remove', payload);
      } catch (err) {
        socket.emit('error', { message: `Document remove error: ${err.message}` });
      }
    });

    socket.on('document:delete', (payload) => {
      try {
        if (!payload?.documentId) {
          return socket.emit('error', { message: 'Missing documentId in payload' });
        }
        fastify.broadcastToContext(payload.contextId, 'document:delete', payload);
      } catch (err) {
        socket.emit('error', { message: `Document delete error: ${err.message}` });
      }
    });

    socket.on('documents:delete', (payload) => {
      try {
        if (!payload?.count) {
          return socket.emit('error', { message: 'Missing count in payload' });
        }
        fastify.broadcastToContext(payload.contextId, 'documents:delete', payload);
      } catch (err) {
        socket.emit('error', { message: `Documents delete error: ${err.message}` });
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] User ${user.id} disconnected. Reason: ${reason}, Socket ID: ${socket.id}`);
      connections.delete(socket.id);

      // Notify remaining user connections that one session disconnected
      fastify.broadcastToUser(user.id, 'connection:change', {
        event: 'disconnect',
        count: fastify.getUserConnectionCount(user.id)
      });
    });
  });

  // Setup periodic cleanup of stale connections (every 5 minutes)
  setInterval(() => {
    const now = Date.now();
    let staleCount = 0;

    for (const [socketId, connection] of connections.entries()) {
      // If connection hasn't had activity in 30 minutes
      if (now - connection.lastActivity > 30 * 60 * 1000) {
        console.log(`[WebSocket] Cleaning up stale connection for user ${connection.user.id}, socket ${socketId}`);
        try {
          connection.socket.disconnect(true);
        } catch (e) {
          // Socket might already be disconnected
        }
        connections.delete(socketId);
        staleCount++;
      }
    }

    if (staleCount > 0) {
      console.log(`[WebSocket] Cleaned up ${staleCount} stale connections`);
    }

    // Also clean up old connection attempts
    for (const [address, attempts] of connectionAttempts.entries()) {
      if (now - attempts.timestamp > 5 * 60 * 1000) {  // 5 minutes
        connectionAttempts.delete(address);
      }
    }
  }, 5 * 60 * 1000);

  // Set up ContextManager event listeners for broadcasting
  if (fastify.contextManager) {
    const contextManager = fastify.contextManager;

    // Document events - broadcast to all users who have access to the context
    const documentEvents = [
      'document:insert',
      'document:update',
      'document:remove',
      'document:delete',
      'documents:delete'
    ];

    documentEvents.forEach(eventType => {
      contextManager.on(eventType, async (payload) => {
        const contextId = payload.contextId || payload.id;
        if (contextId) {
          console.log(`[WebSocket] Broadcasting ${eventType} event for context ${contextId}`);

          // Find all users who have access to this context and broadcast to them
          let broadcastCount = 0;
          for (const [socketId, connection] of connections.entries()) {
            try {
              // Check if the user has access to this context
              const hasAccess = await contextManager.hasContext(connection.user.id, contextId);
              if (hasAccess) {
                connection.socket.emit(eventType, payload);
                broadcastCount++;
              }
            } catch (error) {
              console.error(`[WebSocket] Error checking context access for user ${connection.user.id}:`, error);
            }
          }
          console.log(`[WebSocket] Document event ${eventType} broadcasted to ${broadcastCount} connected users`);
        }
      });
    });

    // Context events - broadcast to context subscribers and context owners
    const contextEvents = [
      'context:url:set',
      'context:updated',
      'context:locked',
      'context:unlocked',
      'context:deleted',
      'context:created',
      'context:acl:updated',
      'context:acl:revoked'
    ];

    contextEvents.forEach(eventType => {
      contextManager.on(eventType, async (payload) => {
        const contextId = payload.contextId || payload.id;
        if (contextId) {
          console.log(`[WebSocket] Broadcasting ${eventType} event for context ${contextId}`);

          // Find all users who have access to this context and broadcast to them
          let broadcastCount = 0;
          for (const [socketId, connection] of connections.entries()) {
            try {
              // Check if the user has access to this context
              const hasAccess = await contextManager.hasContext(connection.user.id, contextId);
              if (hasAccess) {
                connection.socket.emit(eventType, payload);
                broadcastCount++;
              }
            } catch (error) {
              console.error(`[WebSocket] Error checking context access for user ${connection.user.id}:`, error);
            }
          }
          console.log(`[WebSocket] Context event ${eventType} broadcasted to ${broadcastCount} connected users`);
        }
      });
    });
  }
}

/**
 * Generate a unique connection ID
 * @returns {string} - Connection ID
 */
function generateConnectionId() {
  return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
