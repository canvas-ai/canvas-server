'use strict';

import ResponseObject from '../../ResponseObject.js';
import { validateUser } from '../../auth/strategies.js';

export default async function lifecycleRoutes(fastify, options) {
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

  // Lifecycle routes will be added here

  // List all contexts
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const contexts = await fastify.contextManager.listUserContexts(request.user.id);
      const response = new ResponseObject().found(contexts, 'Contexts retrieved successfully', 200, contexts.length);
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to list contexts');
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

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

      const response = new ResponseObject().created({ context }, 'Context created successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to create context', error.message);
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const context = await fastify.contextManager.getContext(request.user.id, request.params.id);

      if (!context) {
        const response = new ResponseObject().notFound(`Context with ID '${request.params.id}' not found or not accessible.`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const responseObject = new ResponseObject().found(
        { context: context.toJSON() },
        'Context retrieved successfully'
      );
      const finalResponse = responseObject.getResponse();

      fastify.log.info(finalResponse);
      return reply.code(responseObject.statusCode).send(finalResponse);
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      if (error.message.includes('Invalid shared context identifier format') || error.message.includes('Expected ')) {
        const response = new ResponseObject().badRequest(`Invalid context ID format for this endpoint. Use /users/{ownerId}/contexts/{contextId} for shared contexts. Context ID '${request.params.id}' is not valid here.`);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to get context');
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return reply;
    }

    try {
      const context = await fastify.contextManager.getContext(request.user.id, request.params.id);
      if (!context) {
        const response = new ResponseObject().notFound('Context not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found({ url: context.url }, 'Context URL retrieved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to get context URL');
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return reply;
    }

    try {
      const context = await fastify.contextManager.getContext(request.user.id, request.params.id);
      if (!context) {
        const response = new ResponseObject().notFound('Context not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      await context.setUrl(request.body.url);
      const response = new ResponseObject().success({ url: context.url }, 'Context URL updated successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError(`Failed to set context URL: ${error.message}`);
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return reply;
    }

    try {
      const context = await fastify.contextManager.getContext(request.user.id, request.params.id);
      if (!context) {
        const response = new ResponseObject().notFound('Context not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found({ path: context.path }, 'Context path retrieved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to get context path');
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return reply;
    }

    try {
      const context = await fastify.contextManager.getContext(request.user.id, request.params.id);
      if (!context) {
        const response = new ResponseObject().notFound('Context not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found({ pathArray: context.pathArray }, 'Context path array retrieved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to get context path array');
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return reply;
    }

    try {
      const context = await fastify.contextManager.updateContext(
        request.user.id,
        request.params.id,
        request.body
      );

      if (!context) {
        const response = new ResponseObject().notFound('Context not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success({ context }, 'Context updated successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to update context');
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return reply;
    }

    try {
      const success = await fastify.contextManager.removeContext(request.user.id, request.params.id);
      if (!success) {
        const response = new ResponseObject().notFound('Context not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success(null, 'Context deleted successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to delete context');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });
}
