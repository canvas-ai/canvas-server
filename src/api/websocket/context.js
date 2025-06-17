import ResponseObject from '../ResponseObject.js';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('canvas-server:websocket:context');

/**
 * Register context-related websocket events for a socket connection.
 * @param {Object} fastify - Fastify instance (provides contextManager)
 * @param {Object} socket - Socket.io socket (with authenticated user)
 */
export default function registerContextWebSocket(fastify, socket) {
  const contextManager = fastify.contextManager;

  // Increase max listeners limit for context manager
  contextManager.setMaxListeners(20); // Increased from default 10

  debug(`🌐 WebSocket: New context connection established for socket ${socket.id}`);

  // --- User Validation Helper ---
  function getUserId() {
    return socket.user && socket.user.id;
  }

  function ensureUser(cb) {
    const userId = getUserId();
    if (!userId) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().unauthorized('Valid authentication required').getResponse());
      } else {
        socket.emit('error', { message: 'Valid authentication required' });
      }
      return null;
    }
    return userId;
  }

  // --- Context Event Forwarding ---
  const contextEvents = [
    // Core context events
    'context.url.set',
    'context.updated',
    'context.locked',
    'context.unlocked',
    'context.deleted',
    'context.created',
    'context.acl.updated',
    'context.acl.revoked',

    // Context document events (direct from context)
    'document.inserted',
    'document.updated',
    'document.removed',
    'document.deleted',
    'documents.delete',

    // Workspace events forwarded by context (new event forwarding chain)
    'context.workspace.document.inserted',
    'context.workspace.document.updated',
    'context.workspace.document.removed',
    'context.workspace.document.deleted',
    'context.workspace.tree.path.inserted',
    'context.workspace.tree.path.moved',
    'context.workspace.tree.path.copied',
    'context.workspace.tree.path.removed',
    'context.workspace.tree.document.inserted',
    'context.workspace.tree.document.inserted.batch',
    'context.workspace.tree.document.updated',
    'context.workspace.tree.document.updated.batch',
    'context.workspace.tree.document.removed',
    'context.workspace.tree.document.removed.batch',
    'context.workspace.tree.document.deleted',
    'context.workspace.tree.document.deleted.batch',
    'context.workspace.tree.path.locked',
    'context.workspace.tree.path.unlocked',
    'context.workspace.tree.layer.merged.up',
    'context.workspace.tree.layer.merged.down',
    'context.workspace.tree.saved',
    'context.workspace.tree.loaded',
    'context.workspace.tree.recalculated',
    'context.workspace.tree.error'
  ];

  // Store event listeners for cleanup
  const listeners = new Map();

  debug(`🌐 WebSocket: Setting up ${contextEvents.length} context event listeners for socket ${socket.id}`);

  // Register context event listeners
  contextEvents.forEach(eventName => {
    const listener = async (payload) => {
      try {
        debug(`🌐 WebSocket: Received ${eventName} event from ContextManager:`, JSON.stringify(payload, null, 2));

        // Get current user ID
        const userId = getUserId();
        if (!userId) {
          debug(`🌐 WebSocket: Not forwarding ${eventName} event - no authenticated user on socket ${socket.id}`);
          return;
        }

        // Extract context ID from various possible payload structures
        const contextId = payload.id || payload.contextId || payload.context?.id;
        debug(`🌐 WebSocket: Processing ${eventName} event for contextId: ${contextId}, userId: ${userId}`);

        if (contextId) {
          // Check if user has access to this context
          const hasAccess = await contextManager.hasContext(userId, contextId);
          if (!hasAccess) {
            debug(`🌐 WebSocket: Access denied - not forwarding ${eventName} event for context ${contextId} - user ${userId} has no access`);
            return;
          }

          debug(`🌐 WebSocket: ✅ Forwarding ${eventName} event for context ${contextId} to user ${userId} on socket ${socket.id}`);
        } else {
          debug(`🌐 WebSocket: ✅ Forwarding ${eventName} event (no specific context) to user ${userId} on socket ${socket.id}`);
        }

        socket.emit(eventName, payload);
        debug(`🌐 WebSocket: ✅ Successfully emitted ${eventName} event to client socket ${socket.id}`);
      } catch (error) {
        debug(`🌐 WebSocket: ❌ Error handling ${eventName} event on socket ${socket.id}:`, error);
        console.error(`WebSocket context event error for ${eventName}:`, error);
      }
    };

    // Store listener for cleanup
    listeners.set(eventName, listener);
    contextManager.on(eventName, listener);
    debug(`🌐 WebSocket: Registered listener for ${eventName} on ContextManager`);
  });

  debug(`🌐 WebSocket: All event listeners registered for socket ${socket.id}`);

  // Clean up listeners on disconnect
  socket.on('disconnect', () => {
    debug(`🌐 WebSocket: Socket ${socket.id} disconnecting, cleaning up ${listeners.size} event listeners`);
    listeners.forEach((listener, eventName) => {
      contextManager.removeListener(eventName, listener);
      debug(`🌐 WebSocket: Cleaned up listener for ${eventName}`);
    });
    listeners.clear();
    debug(`🌐 WebSocket: All listeners cleaned up for disconnected socket ${socket.id}`);
  });

  // --- Context Lifecycle Events ---
  socket.on('context:list', async (cb) => {
    const userId = getUserId();
    if (!userId) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().unauthorized('Valid authentication required').getResponse());
      } else {
        socket.emit('error', { message: 'Valid authentication required' });
      }
      return;
    }

    try {
      const contexts = await fastify.contextManager.listUserContexts(userId);
      if (!contexts) {
        if (typeof cb === 'function') {
          cb(new ResponseObject().notFound('No contexts found').getResponse());
        } else {
          socket.emit('error', { message: 'No contexts found' });
        }
        return;
      }

      if (typeof cb === 'function') {
        cb(new ResponseObject().found(contexts, 'Contexts retrieved successfully', 200, contexts.length).getResponse());
      } else {
        socket.emit('context:list:result', new ResponseObject().found(contexts, 'Contexts retrieved successfully', 200, contexts.length).getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to list contexts', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to list contexts: ${err.message}` });
      }
    }
  });

  socket.on('context:get', async (contextId, cb) => {
    const userId = getUserId();
    if (!userId) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().unauthorized('Valid authentication required').getResponse());
      } else {
        socket.emit('error', { message: 'Valid authentication required' });
      }
      return;
    }

    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          socket.emit('error', { message: 'Context not found' });
        }
        return;
      }

      if (typeof cb === 'function') {
        cb(new ResponseObject().found({ context: context.toJSON() }, 'Context retrieved successfully').getResponse());
      } else {
        socket.emit('context:get:result', new ResponseObject().found({ context: context.toJSON() }, 'Context retrieved successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to get context', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to get context: ${err.message}` });
      }
    }
  });

  // --- Context URL ---
  socket.on('context:url:get', async (contextId, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      if (typeof cb === 'function') {
        cb(new ResponseObject().found({ url: context.url }, 'Context URL retrieved successfully').getResponse());
      } else {
        socket.emit('context:url:get:result', new ResponseObject().found({ url: context.url }, 'Context URL retrieved successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to get context URL', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to get context URL: ${err.message}` });
      }
    }
  });

  socket.on('context:url:set', async ({ contextId, url }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      // Let the context update its URL - this will emit context:url:changed event
      // which is handled at the API level to broadcast to websocket clients
      await context.setUrl(url);

      if (typeof cb === 'function') {
        cb(new ResponseObject().updated({ url: context.url }, 'Context URL updated successfully').getResponse());
      } else {
        socket.emit('context:url:set:result', new ResponseObject().updated({ url: context.url }, 'Context URL updated successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to set context URL', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to set context URL: ${err.message}` });
      }
    }
  });

  // --- Document Events ---
  socket.on('context:documents:list', async ({ contextId, featureArray = [], filterArray = [], options = {} }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;

    if (!contextId) {
      if (typeof cb === 'function') {
        return cb(new ResponseObject().badRequest('Context ID is required').getResponse());
      } else {
        return socket.emit('error', { message: 'Context ID is required' });
      }
    }

    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      const dbResult = await context.listDocuments(userId, featureArray, filterArray, options);
      if (!dbResult) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('No documents found').getResponse());
        } else {
          return socket.emit('error', { message: 'No documents found' });
        }
      }

      if (typeof cb === 'function') {
        cb(new ResponseObject().found(dbResult.data, 'Documents retrieved successfully', 200, dbResult.count).getResponse());
      } else {
        socket.emit('context:documents:list:result', new ResponseObject().found(dbResult.data, 'Documents retrieved successfully', 200, dbResult.count).getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to list documents', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to list documents: ${err.message}` });
      }
    }
  });

  socket.on('context:documents:insert', async ({ contextId, documents, featureArray = [], options = {} }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;

    if (!contextId) {
      if (typeof cb === 'function') {
        return cb(new ResponseObject().badRequest('Context ID is required').getResponse());
      } else {
        return socket.emit('error', { message: 'Context ID is required' });
      }
    }

    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      const result = await context.insertDocumentArray(userId, documents, featureArray, options);
      if (!result) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().serverError('Failed to insert documents').getResponse());
        } else {
          return socket.emit('error', { message: 'Failed to insert documents' });
        }
      }

      if (typeof cb === 'function') {
        cb(new ResponseObject().created(result, 'Documents inserted successfully', 201, result.length).getResponse());
      } else {
        socket.emit('context:documents:insert:result', new ResponseObject().created(result, 'Documents inserted successfully', 201, result.length).getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to insert documents', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to insert documents: ${err.message}` });
      }
    }
  });

  socket.on('context:documents:update', async ({ contextId, documents, featureArray = [], options = {} }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;

    if (!contextId) {
      if (typeof cb === 'function') {
        return cb(new ResponseObject().badRequest('Context ID is required').getResponse());
      } else {
        return socket.emit('error', { message: 'Context ID is required' });
      }
    }

    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      const result = await context.updateDocumentArray(userId, documents, featureArray, options);
      if (!result) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().serverError('Failed to update documents').getResponse());
        } else {
          return socket.emit('error', { message: 'Failed to update documents' });
        }
      }

      if (typeof cb === 'function') {
        cb(new ResponseObject().updated(result, 'Documents updated successfully').getResponse());
      } else {
        socket.emit('context:documents:update:result', new ResponseObject().updated(result, 'Documents updated successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to update documents', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to update documents: ${err.message}` });
      }
    }
  });

  socket.on('context:documents:remove', async ({ contextId, documentIdArray }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;

    if (!contextId) {
      if (typeof cb === 'function') {
        return cb(new ResponseObject().badRequest('Context ID is required').getResponse());
      } else {
        return socket.emit('error', { message: 'Context ID is required' });
      }
    }

    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      const result = await context.removeDocumentArray(userId, documentIdArray);
      if (!result) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().serverError('Failed to remove documents').getResponse());
        } else {
          return socket.emit('error', { message: 'Failed to remove documents' });
        }
      }

      if (typeof cb === 'function') {
        cb(new ResponseObject().deleted('Documents removed from context successfully').getResponse());
      } else {
        socket.emit('context:documents:remove:result', new ResponseObject().deleted('Documents removed from context successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to remove documents', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to remove documents: ${err.message}` });
      }
    }
  });

  socket.on('context:documents:delete', async ({ contextId, documentIdArray }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;

    if (!contextId) {
      if (typeof cb === 'function') {
        return cb(new ResponseObject().badRequest('Context ID is required').getResponse());
      } else {
        return socket.emit('error', { message: 'Context ID is required' });
      }
    }
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      const result = await context.deleteDocumentArrayFromDb(userId, documentIdArray);

      if (typeof cb === 'function') {
        cb(new ResponseObject().deleted('Documents deleted from database successfully').getResponse());
      } else {
        socket.emit('context:documents:delete:result', new ResponseObject().deleted('Documents deleted from database successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to delete documents', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to delete documents: ${err.message}` });
      }
    }
  });

  // --- Single Document Events ---
  socket.on('context:document:insert', async ({ contextId, document, featureArray = [], options = {} }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;

    if (!contextId) {
      if (typeof cb === 'function') {
        return cb(new ResponseObject().badRequest('Context ID is required').getResponse());
      } else {
        return socket.emit('error', { message: 'Context ID is required' });
      }
    }

    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      const result = await context.insertDocumentArray(userId, [document], featureArray, options);

      if (typeof cb === 'function') {
        cb(new ResponseObject().created(result[0], 'Document inserted successfully').getResponse());
      } else {
        socket.emit('context:document:insert:result', new ResponseObject().created(result[0], 'Document inserted successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to insert document', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to insert document: ${err.message}` });
      }
    }
  });

  socket.on('context:document:update', async ({ contextId, document, featureArray = [], options = {} }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      const result = await context.updateDocumentArray(userId, [document], featureArray, options);

      if (typeof cb === 'function') {
        cb(new ResponseObject().updated(result[0], 'Document updated successfully').getResponse());
      } else {
        socket.emit('context:document:update:result', new ResponseObject().updated(result[0], 'Document updated successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to update document', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to update document: ${err.message}` });
      }
    }
  });

  socket.on('context:document:remove', async ({ contextId, documentId }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      const result = await context.removeDocumentArray(userId, [documentId]);

      if (typeof cb === 'function') {
        cb(new ResponseObject().deleted('Document removed from context successfully').getResponse());
      } else {
        socket.emit('context:document:remove:result', new ResponseObject().deleted('Document removed from context successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to remove document', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to remove document: ${err.message}` });
      }
    }
  });

  socket.on('context:document:delete', async ({ contextId, documentId }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      const result = await context.deleteDocumentArrayFromDb(userId, [documentId]);

      if (typeof cb === 'function') {
        cb(new ResponseObject().deleted('Document deleted from database successfully').getResponse());
      } else {
        socket.emit('context:document:delete:result', new ResponseObject().deleted('Document deleted from database successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to delete document', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to delete document: ${err.message}` });
      }
    }
  });

  // --- Tree Operations ---
  socket.on('context:tree:get', async (contextId, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;

    if (!contextId) {
      if (typeof cb === 'function') {
        return cb(new ResponseObject().badRequest('Context ID is required').getResponse());
      } else {
        return socket.emit('error', { message: 'Context ID is required' });
      }
    }

    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      const tree = context.tree;
      if (typeof cb === 'function') {
        cb(new ResponseObject().found({ tree }, 'Context tree retrieved successfully').getResponse());
      } else {
        socket.emit('context:tree:get:result', new ResponseObject().found({ tree }, 'Context tree retrieved successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to get context tree', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to get context tree: ${err.message}` });
      }
    }
  });

  socket.on('context:tree:path:insert', async ({ contextId, path, data = null, autoCreateLayers = true }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;

    if (!contextId || !path) {
      if (typeof cb === 'function') {
        return cb(new ResponseObject().badRequest('Context ID and path are required').getResponse());
      } else {
        return socket.emit('error', { message: 'Context ID and path are required' });
      }
    }

    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      // Access the workspace tree through the context
      const result = context.workspace.insertPath(path, data, autoCreateLayers);

      if (typeof cb === 'function') {
        cb(new ResponseObject().created(result, 'Tree path inserted successfully').getResponse());
      } else {
        socket.emit('context:tree:path:insert:result', new ResponseObject().created(result, 'Tree path inserted successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to insert tree path', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to insert tree path: ${err.message}` });
      }
    }
  });

  socket.on('context:tree:path:remove', async ({ contextId, path, recursive = false }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;

    if (!contextId || !path) {
      if (typeof cb === 'function') {
        return cb(new ResponseObject().badRequest('Context ID and path are required').getResponse());
      } else {
        return socket.emit('error', { message: 'Context ID and path are required' });
      }
    }

    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      // Access the workspace tree through the context
      const result = context.workspace.removePath(path, recursive);

      if (typeof cb === 'function') {
        cb(new ResponseObject().deleted(result, 'Tree path removed successfully').getResponse());
      } else {
        socket.emit('context:tree:path:remove:result', new ResponseObject().deleted(result, 'Tree path removed successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to remove tree path', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to remove tree path: ${err.message}` });
      }
    }
  });

  socket.on('context:tree:path:move', async ({ contextId, pathFrom, pathTo, recursive = false }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;

    if (!contextId || !pathFrom || !pathTo) {
      if (typeof cb === 'function') {
        return cb(new ResponseObject().badRequest('Context ID, pathFrom, and pathTo are required').getResponse());
      } else {
        return socket.emit('error', { message: 'Context ID, pathFrom, and pathTo are required' });
      }
    }

    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      // Access the workspace tree through the context
      const result = context.workspace.movePath(pathFrom, pathTo, recursive);

      if (typeof cb === 'function') {
        cb(new ResponseObject().updated(result, 'Tree path moved successfully').getResponse());
      } else {
        socket.emit('context:tree:path:move:result', new ResponseObject().updated(result, 'Tree path moved successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to move tree path', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to move tree path: ${err.message}` });
      }
    }
  });

  socket.on('context:tree:path:copy', async ({ contextId, pathFrom, pathTo, recursive = false }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;

    if (!contextId || !pathFrom || !pathTo) {
      if (typeof cb === 'function') {
        return cb(new ResponseObject().badRequest('Context ID, pathFrom, and pathTo are required').getResponse());
      } else {
        return socket.emit('error', { message: 'Context ID, pathFrom, and pathTo are required' });
      }
    }

    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        if (typeof cb === 'function') {
          return cb(new ResponseObject().notFound('Context not found').getResponse());
        } else {
          return socket.emit('error', { message: 'Context not found' });
        }
      }

      // Access the workspace tree through the context
      const result = context.workspace.copyPath(pathFrom, pathTo, recursive);

      if (typeof cb === 'function') {
        cb(new ResponseObject().created(result, 'Tree path copied successfully').getResponse());
      } else {
        socket.emit('context:tree:path:copy:result', new ResponseObject().created(result, 'Tree path copied successfully').getResponse());
      }
    } catch (err) {
      if (typeof cb === 'function') {
        cb(new ResponseObject().serverError('Failed to copy tree path', err.message).getResponse());
      } else {
        socket.emit('error', { message: `Failed to copy tree path: ${err.message}` });
      }
    }
  });
}
