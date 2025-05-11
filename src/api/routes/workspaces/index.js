'use strict';

import ResponseObject from '../../ResponseObject.js';

/**
 * Main workspace routes handler for the API
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Plugin options
 */
export default async function workspaceRoutes(fastify, options) {
  /**
   * Helper function to validate user is authenticated and has an email
   * @param {Object} request - Fastify request
   * @returns {boolean} true if valid, false if not
   */
  const validateUser = (request) => {
    const user = request.user;
    if (!user || !user.email || !user.id) {
      return false;
    }
    return true;
  };

  const validateUserWithResponse = (request, reply) => {
    if (!validateUser(request)) {
      const response = new ResponseObject().unauthorized('Valid authentication required');
      reply.code(response.statusCode).send(response.getResponse());
      return false;
    }
    return true;
  };

  // Register sub-routes
  fastify.register(import('./documents.js'), { prefix: '/:id/documents' });
  fastify.register(import('./tree.js'), { prefix: '/:id/tree' });
  fastify.register(import('./lifecycle.js'), { prefix: '/:id' });

  // List all workspaces
  fastify.get('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      // Validate user is authenticated properly
      if (!request.user || !request.user.id) {
        fastify.log.error('User data missing in request after authentication');
        const responseObject = new ResponseObject().unauthorized('User authentication data is incomplete');
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const workspaces = await fastify.workspaceManager.listUserWorkspaces(request.user.id);
      const responseObject = new ResponseObject().found(workspaces, 'Workspaces retrieved successfully', 200, workspaces.length);
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to list workspaces');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Create new workspace
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          label: { type: 'string' },
          description: { type: 'string' },
          color: { type: 'string', pattern: '^#[0-9A-Fa-f]{3,6}$' },
          type: { type: 'string', enum: ['workspace', 'universe'] },
          metadata: { type: 'object' },
          acl: { type: 'object' },
          restApi: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const workspace = await fastify.workspaceManager.createWorkspace(
        request.user.email,
        request.body.name,
        {
          owner: request.user.id,
          type: request.body.type || 'workspace',
          label: request.body.label || request.body.name,
          description: request.body.description || '',
          color: request.body.color,
          metadata: request.body.metadata,
          acl: request.body.acl,
          restApi: request.body.restApi
        }
      );

      const responseObject = new ResponseObject().created(workspace, 'Workspace created successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to create workspace');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Get workspace details
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

      const responseObject = new ResponseObject().found(
        { workspace: workspace.toJSON() },
        'Workspace retrieved successfully'
      );
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to get workspace');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Update workspace
  fastify.patch('/:id', {
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
          label: { type: 'string' },
          description: { type: 'string' },
          color: { type: 'string', pattern: '^#[0-9A-Fa-f]{3,6}$' },
          locked: { type: 'boolean' },
          metadata: { type: 'object' },
          acl: { type: 'object' },
          restApi: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const success = await fastify.workspaceManager.updateWorkspaceConfig(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body
      );

      if (!success) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success(true, 'Workspace updated successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to update workspace');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Delete workspace
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
    try {
      // Prevent deletion of universe workspace
      if (request.params.id === 'universe') {
        const responseObject = new ResponseObject().forbidden('Universe workspace cannot be deleted');
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const success = await fastify.workspaceManager.removeWorkspace(
        request.user.email,
        request.params.id,
        request.user.id,
        true // destroyData = true to actually delete the workspace files
      );

      if (!success) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().deleted('Workspace deleted successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to delete workspace');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });
}
