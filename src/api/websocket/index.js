'use strict';

import registerContextWebSocket from './channels/context.js';
import registerWorkspaceWebSocket from './channels/workspace.js';

/**
 * WebSocket bootstrap – push-only design.
 *  • Authenticates sockets (JWT or API token handled by fastify.authService).
 *  • Tracks active connections & rate-limits handshake abuse.
 *  • Exposes broadcast helpers used by core managers.
 *  • Delegates actual event forwarding to dedicated modules:
 *      – context.js     (ContextManager → client)
 *      – workspace.js   (WorkspaceManager → client)
 */
export default function setupWebSocketHandlers(fastify) {
  const io = fastify.io;
  const connections = new Map(); // socket.id → { socket, user, lastActivity }
  const connectionAttempts = new Map(); // ip → { count, timestamp }

  /* ---------------- Authentication middleware ---------------- */
  io.use(async (socket, next) => {
    try {
      const clientIp = socket.handshake.address;
      const connectionId = socket.handshake.headers['x-connection-id'] || generateConnectionId();

      // rudimentary rate-limit on handshake attempts per IP
      const attempt = connectionAttempts.get(clientIp) || { count: 0, timestamp: Date.now() };
      attempt.count += 1;
      connectionAttempts.set(clientIp, attempt);
      if (attempt.count > 10 && (Date.now() - attempt.timestamp) < 60_000) {
        return next(new Error('Too many connection attempts'));
      }
      if ((Date.now() - attempt.timestamp) > 60_000) {
        attempt.count = 1;
        attempt.timestamp = Date.now();
      }

      // extract bearer / ws auth token
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Authentication token required'));

      let user;
      if (token.startsWith('canvas-')) {
        const apiRes = await fastify.authService.verifyApiToken(token);
        if (!apiRes) return next(new Error('Invalid API token'));
        user = await fastify.userManager.getUserById(apiRes.userId);
      } else {
        const decoded = fastify.jwt.verify(token);
        user = await fastify.userManager.getUserById(decoded.sub);
      }

      if (!user || user.status !== 'active') return next(new Error('Invalid user'));

      socket.user = { id: user.id, email: user.email.toLowerCase() };
      socket.connectionId = connectionId;
      next();
    } catch (err) {
      next(new Error(`Auth error: ${err.message}`));
    }
  });

  /* ---------------- Broadcast helpers ---------------- */
  fastify.decorate('broadcastToUser', (userId, event, payload) => {
    let sent = 0;
    connections.forEach((conn) => {
      if (conn.user.id === userId) {
        try { conn.socket.emit(event, payload); sent++; } catch { /* ignore */ }
      }
    });
    return sent;
  });

  fastify.decorate('broadcastToWorkspace', (workspaceId, event, payload) => {
    let sent = 0;
    connections.forEach((conn) => {
      if (conn.socket.subscriptions?.has?.(`workspace:${workspaceId}`)) {
        try { conn.socket.emit(event, payload); sent++; } catch {}
      }
    });
    return sent;
  });

  fastify.decorate('broadcastToContext', (contextId, event, payload) => {
    let sent = 0;
    connections.forEach((conn) => {
      if (conn.socket.subscriptions?.has?.(`context:${contextId}`)) {
        try { conn.socket.emit(event, payload); sent++; } catch {}
      }
    });
    return sent;
  });

  fastify.decorate('getUserConnectionCount', (userId) => {
    let c = 0;
    connections.forEach((conn) => { if (conn.user.id === userId) c++; });
    return c;
  });

  /* ---------------- Connection handler ---------------- */
  io.on('connection', (socket) => {
    const { user } = socket;
    connections.set(socket.id, { socket, user, lastActivity: Date.now() });

    // Register push modules
    registerContextWebSocket(fastify, socket);
    registerWorkspaceWebSocket(fastify, socket);

    socket.emit('authenticated', { userId: user.id, email: user.email });

    // heartbeat
    socket.on('ping', () => socket.emit('pong', { time: Date.now() }));

    socket.on('disconnect', () => {
      connections.delete(socket.id);
      fastify.broadcastToUser(user.id, 'connection.change', {
        event: 'disconnect',
        count: fastify.getUserConnectionCount(user.id)
      });
    });
  });

  /* ---------------- Periodic cleanup ---------------- */
  setInterval(() => {
    const now = Date.now();
    connections.forEach((conn, id) => {
      if (now - conn.lastActivity > 30 * 60_000) {
        try { conn.socket.disconnect(true); } catch {}
        connections.delete(id);
      }
    });
    // clear old attempt logs
    connectionAttempts.forEach((val, ip) => {
      if (now - val.timestamp > 5 * 60_000) connectionAttempts.delete(ip);
    });
  }, 5 * 60_000);
}

function generateConnectionId() {
  return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
