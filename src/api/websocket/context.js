import ResponseObject from '../ResponseObject.js';

/**
 * Register context-related websocket events for a socket connection.
 * @param {Object} fastify - Fastify instance (provides contextManager)
 * @param {Object} socket - Socket.io socket (with authenticated user)
 */
export default function registerContextWebSocket(fastify, socket) {
  // --- User Validation Helper ---
  function getUserId() {
    return socket.user && socket.user.id;
  }
  function ensureUser(cb) {
    const userId = getUserId();
    if (!userId) {
      cb(new ResponseObject().unauthorized('Valid authentication required').getResponse());
      return null;
    }
    return userId;
  }

  // --- Context Lifecycle Events ---
  socket.on('context:list', async (cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const contexts = await fastify.contextManager.listUserContexts(userId);
      cb(new ResponseObject().found(contexts, 'Contexts retrieved successfully', 200, contexts.length).getResponse());
    } catch (err) {
      cb(new ResponseObject().serverError('Failed to list contexts', err.message).getResponse());
    }
  });

  socket.on('context:get', async (contextId, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        return cb(new ResponseObject().notFound('Context not found').getResponse());
      }
      cb(new ResponseObject().found({ context: context.toJSON() }, 'Context retrieved successfully').getResponse());
    } catch (err) {
      cb(new ResponseObject().serverError('Failed to get context', err.message).getResponse());
    }
  });

  // --- Context URL ---
  socket.on('context:url:get', async (contextId, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        return cb(new ResponseObject().notFound('Context not found').getResponse());
      }
      cb(new ResponseObject().found({ url: context.url }, 'Context URL retrieved successfully').getResponse());
    } catch (err) {
      cb(new ResponseObject().serverError('Failed to get context URL', err.message).getResponse());
    }
  });

  socket.on('context:url:set', async ({ contextId, url }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        return cb(new ResponseObject().notFound('Context not found').getResponse());
      }
      await context.setUrl(url);
      cb(new ResponseObject().updated({ url: context.url }, 'Context URL updated successfully').getResponse());
    } catch (err) {
      cb(new ResponseObject().serverError('Failed to set context URL', err.message).getResponse());
    }
  });

  // --- Document Events ---
  socket.on('context:documents:list', async ({ contextId, featureArray = [], filterArray = [], options = {} }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        return cb(new ResponseObject().notFound('Context not found').getResponse());
      }
      const dbResult = await context.listDocuments(userId, featureArray, filterArray, options);
      cb(new ResponseObject().found(dbResult.data, 'Documents retrieved successfully', 200, dbResult.count).getResponse());
    } catch (err) {
      cb(new ResponseObject().serverError('Failed to list documents', err.message).getResponse());
    }
  });

  socket.on('context:documents:insert', async ({ contextId, documents, featureArray = [], options = {} }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        return cb(new ResponseObject().notFound('Context not found').getResponse());
      }
      const result = await context.insertDocumentArray(userId, documents, featureArray, options);
      cb(new ResponseObject().created(result, 'Documents inserted successfully', 201, result.length).getResponse());
    } catch (err) {
      cb(new ResponseObject().serverError('Failed to insert documents', err.message).getResponse());
    }
  });

  socket.on('context:documents:update', async ({ contextId, documents, featureArray = [], options = {} }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        return cb(new ResponseObject().notFound('Context not found').getResponse());
      }
      const result = await context.updateDocumentArray(userId, documents, featureArray, options);
      cb(new ResponseObject().updated(result, 'Documents updated successfully').getResponse());
    } catch (err) {
      cb(new ResponseObject().serverError('Failed to update documents', err.message).getResponse());
    }
  });

  socket.on('context:documents:remove', async ({ contextId, documentIdArray }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        return cb(new ResponseObject().notFound('Context not found').getResponse());
      }
      const result = await context.removeDocumentArray(userId, documentIdArray);
      cb(new ResponseObject().deleted('Documents removed from context successfully').getResponse());
    } catch (err) {
      cb(new ResponseObject().serverError('Failed to remove documents', err.message).getResponse());
    }
  });

  socket.on('context:documents:delete', async ({ contextId, documentIdArray }, cb) => {
    const userId = ensureUser(cb);
    if (!userId) return;
    try {
      const context = await fastify.contextManager.getContext(userId, contextId);
      if (!context) {
        return cb(new ResponseObject().notFound('Context not found').getResponse());
      }
      const result = await context.deleteDocumentArrayFromDb(userId, documentIdArray);
      cb(new ResponseObject().deleted('Documents deleted from database successfully').getResponse());
    } catch (err) {
      cb(new ResponseObject().serverError('Failed to delete documents', err.message).getResponse());
    }
  });
}
