'use strict';

import ResponseObject from '../../ResponseObject.js';
import { validateUser } from '../../auth/strategies.js';

export default async function lifecycleRoutes(fastify, options) {
  // Add a pre-handler hook to ensure user is authenticated and valid for all context document routes
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      // The `authenticate` hook should have already run and populated `request.user`
      // We just need to validate it has the required fields for our operations.
      validateUser(request.user, ['id']); // For context operations, we primarily need the user's ID.
    } catch (err) {
      // If validateUser throws, it means the user object is invalid.
      return new ResponseObject(reply).unauthorized(err.message);
    }
  });

  // Lifecycle routes will be added here

  // List all contexts
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    try {
      const contexts = await fastify.contextManager.listUserContexts(request.user.id);

      // Return consistent ResponseObject format
      return response.found(contexts, 'Contexts retrieved successfully', 200, contexts.length);

    } catch (error) {
      fastify.log.error(error);
      return response.error('Failed to list contexts');
    }
  });

  // Create new context
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: "User-defined ID for the new context. This will be sanitized." },
          url: { type: 'string', description: "The URL for the new context (e.g., universe://my-context-name). Defaults to '/' if not provided." },
          baseUrl: { type: 'string' },
          description: { type: 'string' },
          workspaceId: { type: 'string' },
          type: { type: 'string', enum: ['context', 'universe'] },
          metadata: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    try {
      const context = await fastify.contextManager.createContext(
        request.user.id,
        request.body.url || '/',
        {
          id: request.body.id,
          userId: request.user.id,
          type: request.body.type || 'context',
          workspaceId: request.body.workspaceId,
          description: request.body.description || '',
          metadata: request.body.metadata,
          baseUrl: request.body.baseUrl
        }
      );

      return response.created({ context }, 'Context created successfully');
    } catch (error) {
      fastify.log.error(error);
      return response.error('Failed to create context', null, error.message);
    }
  });

  // Get context by ID
  // Note: The prefix for this group is '/', so this becomes GET /:id
  fastify.get('/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    try {
      const context = await fastify.contextManager.getContext(request.user.id, request.params.id);

      if (!context) {
        return response.notFound(`Context with ID '${request.params.id}' not found or not accessible.`);
      }

      return response.success(context.toJSON(), 'Context retrieved successfully');
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        return response.forbidden(error.message);
      }
      if (error.message.includes('Invalid shared context identifier format') || error.message.includes('Expected ')) {
        return response.badRequest(`Invalid context ID format for this endpoint. Use /users/{ownerId}/contexts/{contextId} for shared contexts. Context ID '${request.params.id}' is not valid here.`);
      }
      return response.error('Failed to get context');
    }
  });

  // Get context URL
  // Note: The prefix for this group is '/', so this becomes GET /:id/url
  fastify.get('/:id/url', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    try {
      const context = await fastify.contextManager.getContext(request.user.id, request.params.id);
      if (!context) {
        return response.notFound('Context not found');
      }

      return response.success({ url: context.url }, 'Context URL retrieved successfully');
    } catch (error) {
      fastify.log.error(error);
      return response.error('Failed to get context URL');
    }
  });

  // Set context URL
  // Note: The prefix for this group is '/', so this becomes POST /:id/url
  fastify.post('/:id/url', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    try {
      const context = await fastify.contextManager.getContext(request.user.id, request.params.id);
      if (!context) {
        return response.notFound('Context not found');
      }

      await context.setUrl(request.body.url);
      return response.success({ url: context.url }, 'Context URL updated successfully');
    } catch (error) {
      fastify.log.error(error);
      return response.error(`Failed to set context URL: ${error.message}`);
    }
  });

  // Get context path
  // Note: The prefix for this group is '/', so this becomes GET /:id/path
  fastify.get('/:id/path', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    try {
      const context = await fastify.contextManager.getContext(request.user.id, request.params.id);
      if (!context) {
        return response.notFound('Context not found');
      }

      return response.success({ path: context.path }, 'Context path retrieved successfully');
    } catch (error) {
      fastify.log.error(error);
      return response.error('Failed to get context path');
    }
  });

  // Get context path array
  // Note: The prefix for this group is '/', so this becomes GET /:id/path-array
  fastify.get('/:id/path-array', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    try {
      const context = await fastify.contextManager.getContext(request.user.id, request.params.id);
      if (!context) {
        return response.notFound('Context not found');
      }

      return response.success({ pathArray: context.pathArray }, 'Context path array retrieved successfully');
    } catch (error) {
      fastify.log.error(error);
      return response.error('Failed to get context path array');
    }
  });

  // Update context
  // Note: The prefix for this group is '/', so this becomes PUT /:id
  fastify.put('/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          metadata: { type: 'object' },
          acl: { type: 'object' },
          restApi: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    try {
      const context = await fastify.contextManager.updateContext(
        request.user.id,
        request.params.id,
        request.body
      );

      if (!context) {
        return response.notFound('Context not found');
      }

      return response.updated({ context }, 'Context updated successfully');
    } catch (error) {
      fastify.log.error(error);
      return response.error('Failed to update context');
    }
  });

  // Delete context
  // Note: The prefix for this group is '/', so this becomes DELETE /:id
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    try {
      const success = await fastify.contextManager.removeContext(request.user.id, request.params.id);
      if (!success) {
        return response.notFound('Context not found');
      }

      return response.deleted('Context deleted successfully');
    } catch (error) {
      fastify.log.error(error);
      return response.error('Failed to delete context');
    }
  });
}
