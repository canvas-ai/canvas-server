'use strict';

import ResponseObject from '../../ResponseObject.js';

/**
 * Workspace tree routes handler for the API
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Plugin options
 */
export default async function workspaceTreeRoutes(fastify, options) {
  // Get workspace tree
  fastify.get('/', {
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
    try {
      const workspace = await fastify.workspaceManager.getWorkspace(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!workspace) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const tree = await workspace.getTree();
      const responseObject = new ResponseObject().found(tree, 'Workspace tree retrieved successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to get workspace tree');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Move path
  fastify.post('/paths/move', {
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
        required: ['sourcePath', 'targetPath'],
        properties: {
          sourcePath: { type: 'string' },
          targetPath: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const workspace = await fastify.workspaceManager.getWorkspace(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!workspace) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const success = await workspace.movePath(request.body.sourcePath, request.body.targetPath);
      if (!success) {
        const responseObject = new ResponseObject().badRequest('Failed to move path');
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success(true, 'Path moved successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to move path');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Copy path
  fastify.post('/paths/copy', {
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
        required: ['sourcePath', 'targetPath'],
        properties: {
          sourcePath: { type: 'string' },
          targetPath: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const workspace = await fastify.workspaceManager.getWorkspace(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!workspace) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const success = await workspace.copyPath(request.body.sourcePath, request.body.targetPath);
      if (!success) {
        const responseObject = new ResponseObject().badRequest('Failed to copy path');
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success(true, 'Path copied successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to copy path');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Remove path
  fastify.delete('/paths/*', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id', '*'],
        properties: {
          id: { type: 'string' },
          '*': { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const workspace = await fastify.workspaceManager.getWorkspace(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!workspace) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const path = '/' + request.params['*'];
      const success = await workspace.removePath(path);
      if (!success) {
        const responseObject = new ResponseObject().badRequest('Failed to remove path');
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().deleted('Path removed successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to remove path');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Merge layer bitmaps upwards
  fastify.post('/paths/merge-up', {
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
        required: ['path'],
        properties: {
          path: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const workspace = await fastify.workspaceManager.getWorkspace(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!workspace) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const success = await workspace.mergeUp(request.body.path);
      if (!success) {
        const responseObject = new ResponseObject().badRequest('Failed to merge layer bitmaps upwards');
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success(true, 'Layer bitmaps merged upwards successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to merge layer bitmaps upwards');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Merge layer bitmaps downwards
  fastify.post('/paths/merge-down', {
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
        required: ['path'],
        properties: {
          path: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const workspace = await fastify.workspaceManager.getWorkspace(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!workspace) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const success = await workspace.mergeDown(request.body.path);
      if (!success) {
        const responseObject = new ResponseObject().badRequest('Failed to merge layer bitmaps downwards');
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success(true, 'Layer bitmaps merged downwards successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to merge layer bitmaps downwards');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });
}
