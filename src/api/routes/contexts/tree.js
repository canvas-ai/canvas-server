'use strict';

import ResponseObject from '../../ResponseObject.js';
import { validateUser } from '../../auth/strategies.js';

export default async function treeRoutes(fastify, options) {
  // Add a pre-handler hook to ensure user is authenticated and valid
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      validateUser(request.user, ['id']);
    } catch (err) {
      return new ResponseObject(reply).unauthorized(err.message);
    }
  });

  // Get context tree
  // Path: / (relative to /:id/tree)
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    schema: {
      // params.id is implicitly available
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound(`Context with ID ${contextId} not found`);
      }

      const workspace = context.workspace;
      if (!workspace) {
        fastify.log.error(`Workspace not found or not loaded for context ${contextId}, user ${request.user.id}`);
        return response.error(`Workspace for context ${contextId} is not available.`);
      }

      const treeData = workspace.jsonTree;

      if (treeData === undefined || treeData === null) {
        fastify.log.warn(`Received null or undefined jsonTree for context ${contextId} from workspace ${workspace.id}`);
        return response.error('Failed to retrieve valid tree data from workspace.');
      }

      return response.success('Context tree retrieved successfully', treeData);
    } catch (error) {
      fastify.log.error(`Get tree error for context ${contextId}: ${error.message}`);
      if (error.message.includes('is not active or DB is not initialized') || error.message.includes('is not active. Cannot perform tree operation')) {
        return response.error(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
      }
      return response.error('Failed to get context tree');
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
    const response = new ResponseObject(reply);
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound(`Context with ID ${contextId} not found`);
      }

      const workspace = context.workspace;
      if (!workspace) {
        fastify.log.error(`Workspace not found or not loaded for context ${contextId}, user ${request.user.id}`);
        return response.error(`Workspace for context ${contextId} is not available.`);
      }

      const result = await workspace.insertPath(
        request.body.path,
        null,
        request.body.autoCreateLayers === undefined ? true : request.body.autoCreateLayers
      );

      const success = result === true || (typeof result === 'object' && result !== null);

      if (!success) {
        return response.error('Failed to insert tree path in workspace.');
      }
      return response.created('Tree path inserted successfully', true);
    } catch (error) {
      fastify.log.error(`Insert path error for context ${contextId}: ${error.message}`);
      if (error.message.includes('is not active')) {
        return response.error(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
      }
      return response.error('Failed to insert tree path');
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
    const response = new ResponseObject(reply);
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound(`Context with ID ${contextId} not found`);
      }

      const workspace = context.workspace;
      if (!workspace) {
        fastify.log.error(`Workspace not found or not loaded for context ${contextId}, user ${request.user.id}`);
        return response.error(`Workspace for context ${contextId} is not available.`);
      }

      const success = await workspace.removePath(
        request.query.path,
        request.query.recursive || false
      );
      if (!success) {
        return response.error('Failed to remove tree path from workspace.');
      }
      return response.deleted('Tree path removed successfully', { success: true });
    } catch (error) {
      fastify.log.error(`Remove path error for context ${contextId}: ${error.message}`);
       if (error.message.includes('is not active')) {
        return response.error(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
      }
      return response.error('Failed to remove tree path');
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
    const response = new ResponseObject(reply);
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound(`Context with ID ${contextId} not found`);
      }

      const workspace = context.workspace;
      if (!workspace) {
        fastify.log.error(`Workspace not found or not loaded for context ${contextId}, user ${request.user.id}`);
        return response.error(`Workspace for context ${contextId} is not available.`);
      }

      const success = await workspace.movePath(
        request.body.from,
        request.body.to,
        request.body.recursive || false
      );
      if (!success) {
        return response.error('Failed to move tree path in workspace.');
      }
      return response.success('Tree path moved successfully', { success: true });
    } catch (error) {
      fastify.log.error(`Move path error for context ${contextId}: ${error.message}`);
      if (error.message.includes('is not active')) {
        return response.error(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
      }
      return response.error('Failed to move tree path');
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
    const response = new ResponseObject(reply);
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound(`Context with ID ${contextId} not found`);
      }

      const workspace = context.workspace;
      if (!workspace) {
        fastify.log.error(`Workspace not found or not loaded for context ${contextId}, user ${request.user.id}`);
        return response.error(`Workspace for context ${contextId} is not available.`);
      }

      const success = await workspace.copyPath(
        request.body.from,
        request.body.to,
        request.body.recursive || false
      );
      if (!success) {
        return response.error('Failed to copy tree path in workspace.');
      }
      return response.success('Tree path copied successfully', { success: true });
    } catch (error) {
      fastify.log.error(`Copy path error for context ${contextId}: ${error.message}`);
      if (error.message.includes('is not active')) {
        return response.error(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
      }
      return response.error('Failed to copy tree path');
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
    const response = new ResponseObject(reply);
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound(`Context with ID ${contextId} not found`);
      }

      const workspace = context.workspace;
      if (!workspace) {
        fastify.log.error(`Workspace not found or not loaded for context ${contextId}, user ${request.user.id}`);
        return response.error(`Workspace for context ${contextId} is not available.`);
      }

      const success = await workspace.mergeUp(request.body.path);
      if (!success) {
        return response.error('Failed to merge layer bitmaps upwards in workspace.');
      }
      return response.success('Layer bitmaps merged upwards successfully', { success: true });
    } catch (error) {
      fastify.log.error(`Merge up error for context ${contextId}: ${error.message}`);
      if (error.message.includes('is not active')) {
        return response.error(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
      }
      return response.error('Failed to merge layer bitmaps upwards');
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
    const response = new ResponseObject(reply);
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound(`Context with ID ${contextId} not found`);
      }

      const workspace = context.workspace;
      if (!workspace) {
        fastify.log.error(`Workspace not found or not loaded for context ${contextId}, user ${request.user.id}`);
        return response.error(`Workspace for context ${contextId} is not available.`);
      }

      const success = await workspace.mergeDown(request.body.path);
      if (!success) {
        return response.error('Failed to merge layer bitmaps downwards in workspace.');
      }
      return response.success('Layer bitmaps merged downwards successfully', { success: true });
    } catch (error) {
      fastify.log.error(`Merge down error for context ${contextId}: ${error.message}`);
      if (error.message.includes('is not active')) {
        return response.error(`Workspace for context ${contextId} is not active. Cannot perform tree operation.`);
      }
      return response.error('Failed to merge layer bitmaps downwards');
    }
  });
}
