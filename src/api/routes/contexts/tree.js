'use strict';

import ResponseObject from '../../ResponseObject.js';
import { validateUser } from '../../auth/strategies.js';

export default async function treeRoutes(fastify, options) {
  // Helper functions (will be populated)
  // const validateUser = (request) => { // Removed
  //   const user = request.user;
  //   if (!user || !user.id) {
  //     return false;
  //   }
  //   return true;
  // };

  const validateUserWithResponse = (request, reply) => {
    if (!validateUser(request.user, ['id'])) { // Updated to use imported validateUser
      const response = new ResponseObject().unauthorized('Valid authentication required');
      reply.code(response.statusCode).send(response.getResponse());
      return false;
    }
    return true;
  };

  // Helper to get workspace from context and handle errors
  async function getWorkspaceFromContext(request, reply, contextId) {
    const context = await fastify.contextManager.getContext(request.user.id, contextId);
    if (!context) {
      const response = new ResponseObject().notFound(`Context with ID ${contextId} not found`);
      reply.code(response.statusCode).send(response.getResponse());
      return null;
    }

    const workspace = context.workspace;
    if (!workspace) {
      fastify.log.error(`Workspace not found or not loaded for context ${contextId}, user ${request.user.id}`);
      const response = new ResponseObject().serverError(`Workspace for context ${contextId} is not available.`);
      reply.code(response.statusCode).send(response.getResponse());
      return null;
    }
    // Workspace methods have internal #ensureActiveForTreeOp, which will throw if not active.
    return workspace;
  }

  // Get context tree
  // Path: / (relative to /:id/tree)
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    schema: {
      // params.id is implicitly available
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) return;
    const contextId = request.params.id;

    try {
      // Use the helper to get the workspace instance
      const workspace = await getWorkspaceFromContext(request, reply, contextId);
      if (!workspace) return; // Error already sent by helper if context or workspace is not found

      // Access the jsonTree getter from the workspace
      const treeJsonString = workspace.jsonTree;

      if (treeJsonString === undefined || treeJsonString === null) {
        // This case implies an issue with workspace.jsonTree getter itself or uninitialized tree.
        // Workspace.js jsonTree getter returns '{}' on error or if tree.jsonTree is falsy.
        // So, a more direct check might be if it's just an empty object string after parsing.
        fastify.log.warn(`Received null or undefined jsonTree for context ${contextId} from workspace ${workspace.id}`);
        const response = new ResponseObject().serverError('Failed to retrieve valid tree data from workspace.');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      let treeData;
      try {
        treeData = JSON.parse(treeJsonString);
      } catch (parseError) {
        fastify.log.error(`Failed to parse tree JSON for context ${contextId}: ${parseError.message}. JSON: ${treeJsonString}`);
        const response = new ResponseObject().serverError('Failed to parse tree data from workspace.');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found(treeData, 'Context tree retrieved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Get tree error for context ${contextId}: ${error.message}`);
      if (error.message.includes('is not active or DB is not initialized') || error.message.includes('is not active. Cannot perform tree operation')) {
        const errResponse = new ResponseObject().serverError(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
        return reply.code(errResponse.statusCode).send(errResponse.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to get context tree');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Insert path into tree
  // Path: /paths (relative to /:id/tree)
  fastify.post('/paths', {
    onRequest: [fastify.authenticate],
    schema: {
      // params.id is implicitly available
      body: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string' },
          autoCreateLayers: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    const contextId = request.params.id;

    try {
      const workspace = await getWorkspaceFromContext(request, reply, contextId);
      if (!workspace) return;

      // Workspace.insertPath(path, data = null, autoCreateLayers = true)
      // It returns the result from tree.insertPath (e.g. true or layerId object)
      const result = await workspace.insertPath(
        request.body.path,
        null, // data - not taken from this API endpoint's body
        request.body.autoCreateLayers === undefined ? true : request.body.autoCreateLayers
      );

      // SynapsD tree.insertPath typically returns true or an object on success.
      const success = result === true || (typeof result === 'object' && result !== null);

      if (!success) {
        const response = new ResponseObject().serverError('Failed to insert tree path in workspace.');
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().created(true, 'Tree path inserted successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Insert path error for context ${contextId}: ${error.message}`);
      if (error.message.includes('is not active')) {
        const errResponse = new ResponseObject().serverError(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
        return reply.code(errResponse.statusCode).send(errResponse.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to insert tree path');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Remove path from tree
  // Path: /paths (relative to /:id/tree)
  fastify.delete('/paths', {
    onRequest: [fastify.authenticate],
    schema: {
      // params.id is implicitly available
      query: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string' },
          recursive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    const contextId = request.params.id;

    try {
      const workspace = await getWorkspaceFromContext(request, reply, contextId);
      if (!workspace) return;

      const success = await workspace.removePath(
        request.query.path,
        request.query.recursive || false
      );
      if (!success) {
        const response = new ResponseObject().serverError('Failed to remove tree path from workspace.');
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().success({ success: true }, 'Tree path removed successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Remove path error for context ${contextId}: ${error.message}`);
       if (error.message.includes('is not active')) {
        const errResponse = new ResponseObject().serverError(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
        return reply.code(errResponse.statusCode).send(errResponse.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to remove tree path');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Move path in tree
  // Path: /paths/move (relative to /:id/tree)
  fastify.post('/paths/move', {
    onRequest: [fastify.authenticate],
    schema: {
      // params.id is implicitly available
      body: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          recursive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    const contextId = request.params.id;

    try {
      const workspace = await getWorkspaceFromContext(request, reply, contextId);
      if (!workspace) return;

      const success = await workspace.movePath(
        request.body.from,
        request.body.to,
        request.body.recursive || false
      );
      if (!success) {
        const response = new ResponseObject().serverError('Failed to move tree path in workspace.');
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().success({ success: true }, 'Tree path moved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Move path error for context ${contextId}: ${error.message}`);
      if (error.message.includes('is not active')) {
        const errResponse = new ResponseObject().serverError(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
        return reply.code(errResponse.statusCode).send(errResponse.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to move tree path');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Copy path in tree
  // Path: /paths/copy (relative to /:id/tree)
  fastify.post('/paths/copy', {
    onRequest: [fastify.authenticate],
    schema: {
      // params.id is implicitly available
      body: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          recursive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    const contextId = request.params.id;

    try {
      const workspace = await getWorkspaceFromContext(request, reply, contextId);
      if (!workspace) return;

      const success = await workspace.copyPath(
        request.body.from,
        request.body.to,
        request.body.recursive || false
      );
      if (!success) {
        const response = new ResponseObject().serverError('Failed to copy tree path in workspace.');
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().success({ success: true }, 'Tree path copied successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Copy path error for context ${contextId}: ${error.message}`);
      if (error.message.includes('is not active')) {
        const errResponse = new ResponseObject().serverError(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
        return reply.code(errResponse.statusCode).send(errResponse.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to copy tree path');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Merge layer bitmaps upwards
  // Path: /paths/merge-up (relative to /:id/tree)
  fastify.post('/paths/merge-up', {
    onRequest: [fastify.authenticate],
    schema: {
      // params.id is implicitly available
      body: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    const contextId = request.params.id;

    try {
      const workspace = await getWorkspaceFromContext(request, reply, contextId);
      if (!workspace) return;

      const success = await workspace.mergeUp(request.body.path);
      if (!success) {
        const response = new ResponseObject().serverError('Failed to merge layer bitmaps upwards in workspace.');
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().success({ success: true }, 'Layer bitmaps merged upwards successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Merge up error for context ${contextId}: ${error.message}`);
      if (error.message.includes('is not active')) {
        const errResponse = new ResponseObject().serverError(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
        return reply.code(errResponse.statusCode).send(errResponse.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to merge layer bitmaps upwards');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Merge layer bitmaps downwards
  // Path: /paths/merge-down (relative to /:id/tree)
  fastify.post('/paths/merge-down', {
    onRequest: [fastify.authenticate],
    schema: {
      // params.id is implicitly available
      body: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    const contextId = request.params.id;

    try {
      const workspace = await getWorkspaceFromContext(request, reply, contextId);
      if (!workspace) return;

      const success = await workspace.mergeDown(request.body.path);
      if (!success) {
        const response = new ResponseObject().serverError('Failed to merge layer bitmaps downwards in workspace.');
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().success({ success: true }, 'Layer bitmaps merged downwards successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Merge down error for context ${contextId}: ${error.message}`);
      if (error.message.includes('is not active')) {
        const errResponse = new ResponseObject().serverError(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
        return reply.code(errResponse.statusCode).send(errResponse.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to merge layer bitmaps downwards');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });
}
