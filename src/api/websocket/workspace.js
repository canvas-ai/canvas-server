import { createDebug } from '../../utils/log/index.js';

const debug = createDebug('canvas-server:websocket:workspace');

/**
 * Register workspace-update websocket forwarding for a specific socket.
 * The module listens to *all* events emitted by WorkspaceManager and
 * forwards them to the connected client if the user has access to the
 * referenced workspace.
 *
 * We deliberately do *not* implement any RPC or data-retrieval over the
 * socket – those actions are available through the REST API. The socket
 * channel is used exclusively for real-time update pushes.
 *
 * @param {import('fastify').FastifyInstance} fastify Fastify instance
 * @param {import('socket.io').Socket}            socket  Authenticated socket
 */
export default function registerWorkspaceWebSocket(fastify, socket) {
  const { workspaceManager } = fastify;
  if (!workspaceManager) {
    debug('⚠️  workspaceManager not present on fastify – skipping workspace WS setup');
    return;
  }

  // Map<key, listener> so we can cleanly remove on disconnect.
  const listeners = new Map();

  /**
   * Wildcard listener -> forwards every event from WorkspaceManager.
   * Uses standard EventEmitter2 "this.event" to determine event name.
   */
  const wildcardListener = async function (eventPayload) {
    try {
      const eventName = this.event; // event string from EventEmitter2
      const workspaceId = eventPayload?.workspaceId || eventPayload?.id;
      const userId = socket.user?.id;

      if (!workspaceId) {
        // If event isn't workspace-specific just forward.
        socket.emit(eventName, eventPayload);
        return;
      }

      // Verify access – only owners / ACL'd users should receive.
      const hasAccess = await workspaceManager.hasWorkspace(userId, workspaceId);
      if (!hasAccess) {
        debug(`Access denied for user ${userId} to workspace ${workspaceId} – not forwarding ${eventName}`);
        return;
      }

      socket.emit(eventName, eventPayload);
      debug(`➡️  forwarded ${eventName} to ${userId}`);
    } catch (err) {
      debug(`Error forwarding workspace event: ${err.message}`);
    }
  };

  // Listen to *all* events.
  workspaceManager.on('**', wildcardListener);
  listeners.set('workspaceWildcard', wildcardListener);

  // Clean-up on disconnect.
  socket.on('disconnect', () => {
    listeners.forEach((listener) => workspaceManager.off('**', listener));
    listeners.clear();
    debug(`Cleaned workspace WS listeners for socket ${socket.id}`);
  });
}
