import { createDebug } from '../../../utils/log/index.js';

const debug = createDebug('canvas-server:websocket:context');

/**
 * Push-only WebSocket bridge for context events.
 *
 * Listens to **all** events emitted by ContextManager and forwards them to the
 * socket when the authenticated user has ACL/ownership access to the context.
 */
export default function registerContextWebSocket(fastify, socket) {
  const { contextManager } = fastify;
  if (!contextManager) {
    debug('⚠️  contextManager missing – skipping context WS setup');
    return;
  }

  const listeners = new Map();

  const wildcardListener = async function (payload) {
    try {
      const eventName = this.event;
      const contextId = payload?.contextId || payload?.id;
      const userId = socket.user?.id;

      if (contextId) {
        const allowed = await contextManager.hasContext(userId, contextId);
        if (!allowed) {
          debug(`User ${userId} lacks access to context ${contextId} – skip ${eventName}`);
          return;
        }
      }

      socket.emit(eventName, payload);
      debug(`➡️  sent ${eventName} to ${userId}`);
    } catch (err) {
      debug(`Error forwarding context event: ${err.message}`);
    }
  };

  contextManager.on('**', wildcardListener);
  listeners.set('contextWildcard', wildcardListener);

  socket.on('disconnect', () => {
    listeners.forEach((listener) => contextManager.off('**', listener));
    listeners.clear();
    debug(`Cleaned context WS listeners for socket ${socket.id}`);
  });
}
