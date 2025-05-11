'use strict';

import ResponseObject from '../ResponseObject.js';

/**
 * Workspace routes handler for the API
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
        request.user.id,
        request.params.id,
        request.user.id
      );

      if (!workspace) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      // Revert test code and apply the correct structure according to the schema
      const responseObject = new ResponseObject().found(
        { workspace: workspace.toJSON() },
        'Workspace retrieved successfully'
      );
      const finalResponse = responseObject.getResponse();

      fastify.log.info(finalResponse); // Log the stored response
      return reply.code(responseObject.statusCode).send(finalResponse); // Send the stored response

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

  // Get workspace status
  fastify.get('/:id/status', {
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
      const status = await fastify.workspaceManager.getWorkspaceStatus(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!status) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().found({ status }, 'Workspace status retrieved successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to get workspace status');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Open workspace
  fastify.post('/:id/open', {
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
    // Check if the reply was already sent (defensive check)
    if (reply.sent) {
      fastify.log.warn(`Open workspace: Reply already sent for workspace ${request.params.id}`);
      return;
    }

    try {
      // Validate user is authenticated properly
      if (!validateUserWithResponse(request, reply)) {
        return; // validateUserWithResponse handles sending the error response
      }

      const workspace = await fastify.workspaceManager.openWorkspace(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!workspace) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      // Emit WebSocket event for status change
      try {
        fastify.broadcastToUser(request.user.id, 'workspace:status:changed', {
          workspaceId: request.params.id,
          status: workspace.status
        });
      } catch (wsError) {
        fastify.log.error(`Failed to broadcast workspace status change: ${wsError.message}`);
        // Continue since this shouldn't fail the request
      }

      const responseObject = new ResponseObject().success(workspace, 'Workspace opened successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      if (reply.sent) {
        fastify.log.error(`Error after reply already sent: ${error.message}`);
        return;
      }

      fastify.log.error(`Failed to open workspace: ${error.message}`);
      const responseObject = new ResponseObject().serverError('Failed to open workspace');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Close workspace
  fastify.post('/:id/close', {
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
    let success;
    try {
      success = await fastify.workspaceManager.closeWorkspace(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!success) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      // Emit WebSocket event for status change
      fastify.broadcastToUser(request.user.id, 'workspace:status:changed', {
        workspaceId: request.params.id,
        status: 'inactive'
      });

      const responseObject = new ResponseObject().success(true, 'Workspace closed successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to close workspace');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Start workspace
  fastify.post('/:id/start', {
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
    let workspace;
    try {
      workspace = await fastify.workspaceManager.startWorkspace(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!workspace) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      // Emit WebSocket event for status change
      fastify.broadcastToUser(request.user.id, 'workspace:status:changed', {
        workspaceId: request.params.id,
        status: 'active'
      });

      const responseObject = new ResponseObject().success(workspace, 'Workspace started successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to start workspace');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Stop workspace
  fastify.post('/:id/stop', {
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
    let success;
    try {
      success = await fastify.workspaceManager.stopWorkspace(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!success) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      // Emit WebSocket event for status change
      fastify.broadcastToUser(request.user.id, 'workspace:status:changed', {
        workspaceId: request.params.id,
        status: 'inactive'
      });

      const responseObject = new ResponseObject().success(true, 'Workspace stopped successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to stop workspace');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // List documents in workspace
  fastify.get('/:id/documents', {
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
      const documents = await fastify.workspaceManager.listDocuments(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!documents) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().found(documents, 'Documents retrieved successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to list documents');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Insert documents into workspace
  fastify.post('/:id/documents', {
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
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'data'],
          properties: {
            type: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const documents = await fastify.workspaceManager.insertDocuments(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body
      );

      if (!documents) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().created(documents, 'Documents inserted successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to insert documents');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Update documents in workspace
  fastify.put('/:id/documents', {
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
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'type', 'data'],
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const documents = await fastify.workspaceManager.updateDocuments(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body
      );

      if (!documents) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success(documents, 'Documents updated successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to update documents');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Delete documents from workspace
  fastify.delete('/:id/documents', {
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
        type: 'array',
        items: {
          type: 'string'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const success = await fastify.workspaceManager.deleteDocuments(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body
      );

      if (!success) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success({ success: true }, 'Documents deleted successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to delete documents');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Remove documents from workspace
  fastify.delete('/:id/documents/remove', {
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
        type: 'array',
        items: {
          type: 'string'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const success = await fastify.workspaceManager.removeDocuments(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body
      );

      if (!success) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success({ success: true }, 'Documents removed successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to remove documents');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Get document by ID
  fastify.get('/:id/documents/by-id/:docId', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id', 'docId'],
        properties: {
          id: { type: 'string' },
          docId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const document = await fastify.workspaceManager.getDocumentById(
        request.user.email,
        request.params.id,
        request.user.id,
        request.params.docId
      );

      if (!document) {
        const responseObject = new ResponseObject().notFound(`Document with ID ${request.params.docId} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().found(document, 'Document retrieved successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to get document');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Get documents by abstraction
  fastify.get('/:id/documents/by-abstraction/:abstraction', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id', 'abstraction'],
        properties: {
          id: { type: 'string' },
          abstraction: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const documents = await fastify.workspaceManager.getDocumentsByAbstraction(
        request.user.email,
        request.params.id,
        request.user.id,
        request.params.abstraction
      );

      if (!documents) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().found(documents, 'Documents retrieved successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to get documents');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Get documents by hash
  fastify.get('/:id/documents/by-hash/:hashString', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id', 'hashString'],
        properties: {
          id: { type: 'string' },
          hashString: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const documents = await fastify.workspaceManager.getDocumentsByHash(
        request.user.email,
        request.params.id,
        request.user.id,
        request.params.hashString
      );

      if (!documents) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().found(documents, 'Documents retrieved successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to get documents');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Get workspace tree
  fastify.get('/:id/tree', {
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
      const tree = await fastify.workspaceManager.getWorkspaceTree(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!tree) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().found(tree, 'Workspace tree retrieved successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to get workspace tree');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Move path in tree
  fastify.post('/:id/tree/paths/move', {
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
        required: ['from', 'to'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          recursive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    let success;
    try {
      success = await fastify.workspaceManager.moveTreePath(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body.from,
        request.body.to,
        request.body.recursive
      );

      if (!success) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success({ success: true }, 'Tree path moved successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to move tree path');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Insert path into tree
  fastify.post('/:id/tree/paths', {
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
          path: { type: 'string' },
          autoCreateLayers: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const success = await fastify.workspaceManager.insertTreePath(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body.path,
        request.body.autoCreateLayers
      );

      if (!success) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().created({ success: true }, 'Tree path inserted successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to insert tree path');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Remove path from tree
  fastify.delete('/:id/tree/paths', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
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
    try {
      const success = await fastify.workspaceManager.removeTreePath(
        request.user.email,
        request.params.id,
        request.user.id,
        request.query.path,
        request.query.recursive
      );

      if (!success) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success({ success: true }, 'Tree path removed successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to remove tree path');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Copy path in tree
  fastify.post('/:id/tree/paths/copy', {
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
        required: ['from', 'to'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          recursive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    let success;
    try {
      success = await fastify.workspaceManager.copyTreePath(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body.from,
        request.body.to,
        request.body.recursive
      );

      if (!success) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success({ success: true }, 'Tree path copied successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to copy tree path');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Merge layer bitmaps upwards
  fastify.post('/:id/tree/paths/merge-up', {
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
    let success;
    try {
      success = await fastify.workspaceManager.mergeLayerBitmapsUp(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body.path
      );

      if (!success) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success({ success: true }, 'Layer bitmaps merged upwards successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to merge layer bitmaps upwards');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Merge layer bitmaps downwards
  fastify.post('/:id/tree/paths/merge-down', {
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
    let success;
    try {
      success = await fastify.workspaceManager.mergeLayerBitmapsDown(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body.path
      );

      if (!success) {
        const responseObject = new ResponseObject().notFound(`Workspace with ID ${request.params.id} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success({ success: true }, 'Layer bitmaps merged downwards successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to merge layer bitmaps downwards');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });
}
