'use strict';

import ResponseObject from '../ResponseObject.js';

/**
 * Context routes handler for the API
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Plugin options
 */
export default async function contextRoutes(fastify, options) {
  /**
   * Helper function to validate user is authenticated and has an id
   * @param {Object} request - Fastify request
   * @returns {boolean} true if valid, false if not
   */
  const validateUser = (request) => {
    const user = request.user;
    if (!user || !user.id) {
      return false;
    }
    return true;
  };

  /**
   * Helper function to validate user and send response if invalid
   * @param {Object} request - Fastify request
   * @param {Object} reply - Fastify reply
   * @returns {boolean} true if valid, false if not
   */
  const validateUserWithResponse = (request, reply) => {
    if (!validateUser(request)) {
      const response = new ResponseObject().unauthorized('Valid authentication required');
      reply.code(response.statusCode).send(response.getResponse());
      return false;
    }
    return true;
  };

  // List all contexts
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' },
            payload: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  label: { type: 'string' },
                  description: { type: 'string' },
                  color: { type: 'string' },
                  type: { type: 'string' },
                  owner: { type: 'string' },
                  status: { type: 'string' },
                  created: { type: 'string', format: 'date-time' },
                  updated: { type: 'string', format: 'date-time' }
                }
              }
            },
            count: { type: 'number' }
          }
        }
      }
    }
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
        required: ['url', 'name'],
        properties: {
          url: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          workspaceId: { type: 'string' },
          type: { type: 'string', enum: ['context', 'universe'] },
          metadata: { type: 'object' },
          acl: { type: 'object' },
          restApi: { type: 'object' },
          baseUrl: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' },
            payload: {
              type: 'object',
              properties: {
                context: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    url: { type: 'string' },
                    description: { type: 'string' },
                    created: { type: 'string', format: 'date-time' },
                    updated: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      // Check if trying to create a default context when one already exists
      if (request.body.name === 'default') {
        const existingContexts = await fastify.contextManager.listUserContexts(request.user.id);
        const defaultContextExists = existingContexts.some(ctx => ctx.name === 'default');
        if (defaultContextExists) {
          const response = new ResponseObject().conflict('A default context already exists');
          return reply.code(response.statusCode).send(response.getResponse());
        }
      }

      const context = await fastify.contextManager.createContext(
        request.user.id,
        request.body.url,
        {
          owner: request.user.id,
          type: request.body.type || 'context',
          name: request.body.name,
          description: request.body.description || '',
          metadata: request.body.metadata,
          acl: request.body.acl,
          restApi: request.body.restApi,
          baseUrl: request.body.baseUrl
        }
      );

      const response = new ResponseObject().created({ context }, 'Context created successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to create context');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Get context by ID
  fastify.get('/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' },
            payload: {
              type: 'object',
              properties: {
                context: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    url: { type: 'string' },
                    description: { type: 'string' },
                    created: { type: 'string', format: 'date-time' },
                    updated: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
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

      const response = new ResponseObject().found({ context }, 'Context retrieved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to get context');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Update context
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
          name: { type: 'string' },
          description: { type: 'string' },
          metadata: { type: 'object' },
          acl: { type: 'object' },
          restApi: { type: 'object' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' },
            payload: {
              type: 'object',
              properties: {
                context: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    updated: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
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
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' }
          }
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

  // List documents in context
  fastify.get('/:id/documents', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              data: { type: 'object' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const documents = await fastify.contextManager.listDocuments(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!documents) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found(documents, 'Documents retrieved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to list documents');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Insert documents into context
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
      },
      response: {
        201: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' },
            payload: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  data: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const documents = await fastify.contextManager.insertDocuments(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body
      );

      if (!documents) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().created(documents, 'Documents inserted successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to insert documents');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Update documents in context
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
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' },
            payload: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  data: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const documents = await fastify.contextManager.updateDocuments(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body
      );

      if (!documents) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success(documents, 'Documents updated successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to update documents');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Delete documents from context
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
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' },
            payload: {
              type: 'object',
              properties: {
                success: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const success = await fastify.contextManager.deleteDocuments(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body
      );

      if (!success) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success({ success: true }, 'Documents deleted successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to delete documents');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Remove documents from context
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
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' },
            payload: {
              type: 'object',
              properties: {
                success: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const success = await fastify.contextManager.removeDocuments(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body
      );

      if (!success) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success({ success: true }, 'Documents removed successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to remove documents');
      return reply.code(response.statusCode).send(response.getResponse());
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
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const document = await fastify.contextManager.getDocumentById(
        request.user.email,
        request.params.id,
        request.user.id,
        request.params.docId
      );

      if (!document) {
        const response = new ResponseObject().notFound(`Document with ID ${request.params.docId} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found(document, 'Document retrieved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to get document');
      return reply.code(response.statusCode).send(response.getResponse());
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
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              data: { type: 'object' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const documents = await fastify.contextManager.getDocumentsByAbstraction(
        request.user.email,
        request.params.id,
        request.user.id,
        request.params.abstraction
      );

      if (!documents) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found(documents, 'Documents retrieved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to get documents');
      return reply.code(response.statusCode).send(response.getResponse());
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
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              data: { type: 'object' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const documents = await fastify.contextManager.getDocumentsByHash(
        request.user.email,
        request.params.id,
        request.user.id,
        request.params.hashString
      );

      if (!documents) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found(documents, 'Documents retrieved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to get documents');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Get context tree
  fastify.get('/:id/tree', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            nodes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  path: { type: 'string' },
                  type: { type: 'string' },
                  data: { type: 'object' }
                }
              }
            },
            edges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  source: { type: 'string' },
                  target: { type: 'string' },
                  type: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const tree = await fastify.contextManager.getContextTree(
        request.user.email,
        request.params.id,
        request.user.id
      );

      if (!tree) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found(tree, 'Context tree retrieved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to get context tree');
      return reply.code(response.statusCode).send(response.getResponse());
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
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const success = await fastify.contextManager.insertTreePath(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body.path,
        request.body.autoCreateLayers
      );

      if (!success) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().created(true, 'Tree path inserted successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to insert tree path');
      return reply.code(response.statusCode).send(response.getResponse());
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
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' },
            payload: {
              type: 'object',
              properties: {
                success: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const success = await fastify.contextManager.removeTreePath(
        request.user.email,
        request.params.id,
        request.user.id,
        request.query.path,
        request.query.recursive
      );

      if (!success) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success({ success: true }, 'Tree path removed successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to remove tree path');
      return reply.code(response.statusCode).send(response.getResponse());
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
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' },
            payload: {
              type: 'object',
              properties: {
                success: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const success = await fastify.contextManager.moveTreePath(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body.from,
        request.body.to,
        request.body.recursive
      );

      if (!success) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success({ success: true }, 'Tree path moved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to move tree path');
      return reply.code(response.statusCode).send(response.getResponse());
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
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' },
            payload: {
              type: 'object',
              properties: {
                success: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const success = await fastify.contextManager.copyTreePath(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body.from,
        request.body.to,
        request.body.recursive
      );

      if (!success) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success({ success: true }, 'Tree path copied successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to copy tree path');
      return reply.code(response.statusCode).send(response.getResponse());
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
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' },
            payload: {
              type: 'object',
              properties: {
                success: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const success = await fastify.contextManager.mergeLayerBitmapsUp(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body.path
      );

      if (!success) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success({ success: true }, 'Layer bitmaps merged upwards successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to merge layer bitmaps upwards');
      return reply.code(response.statusCode).send(response.getResponse());
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
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            statusCode: { type: 'number' },
            message: { type: 'string' },
            payload: {
              type: 'object',
              properties: {
                success: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const success = await fastify.contextManager.mergeLayerBitmapsDown(
        request.user.email,
        request.params.id,
        request.user.id,
        request.body.path
      );

      if (!success) {
        const response = new ResponseObject().notFound(`Context with ID ${request.params.id} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success({ success: true }, 'Layer bitmaps merged downwards successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to merge layer bitmaps downwards');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });
}
