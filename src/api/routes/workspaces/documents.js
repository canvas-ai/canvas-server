'use strict';

import ResponseObject from '../../ResponseObject.js';

/**
 * Workspace document routes handler for the API
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Plugin options
 */
export default async function workspaceDocumentRoutes(fastify, options) {
  // List documents in workspace
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          contextSpec: { type: 'string', default: '/' },
          featureArray: {
            type: 'array',
            items: { type: 'string' },
            default: []
          }
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

      const documents = await workspace.findDocuments(
        request.query.contextSpec,
        request.query.featureArray
      );
      const responseObject = new ResponseObject().found(documents, 'Documents retrieved successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to list documents');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Insert documents into workspace
  fastify.post('/', {
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
        required: ['documents'],
        properties: {
          contextSpec: { type: 'string', default: '/' },
          featureArray: {
            type: 'array',
            items: { type: 'string' },
            default: []
          },
          documents: {
            type: 'array',
            items: {
              type: 'object',
              required: ['schema', 'data'],
              properties: {
                schema: { type: 'string' },
                data: { type: 'object' }
              }
            }
          }
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

      const documents = await workspace.insertDocumentArray(
        request.body.documents,
        request.body.contextSpec,
        request.body.featureArray
      );
      const responseObject = new ResponseObject().created(documents, 'Documents inserted successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to insert documents');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Get document by ID
  fastify.get('/by-id/:docId', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id', 'docId'],
        properties: {
          id: { type: 'string' },
          docId: { type: 'number' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          contextSpec: { type: 'string', default: '/' },
          featureArray: {
            type: 'array',
            items: { type: 'string' },
            default: []
          }
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

      const document = await workspace.getDocumentById(
        request.params.docId,
        {
          contextSpec: request.query.contextSpec,
          featureArray: request.query.featureArray
        }
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
  fastify.get('/by-abstraction/:abstraction', {
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
      querystring: {
        type: 'object',
        properties: {
          contextSpec: { type: 'string', default: '/' },
          featureArray: {
            type: 'array',
            items: { type: 'string' },
            default: []
          }
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

      const documents = await workspace.findDocuments(
        request.query.contextSpec,
        request.query.featureArray,
        [request.params.abstraction]
      );
      const responseObject = new ResponseObject().found(documents, 'Documents retrieved successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to get documents');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Update documents
  fastify.put('/', {
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
        required: ['documents'],
        properties: {
          documents: {
            type: 'array',
            items: {
              type: 'object',
              required: ['schema', 'data'],
              properties: {
                schema: { type: 'string' },
                data: { type: 'object' }
              }
            }
          }
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

      const success = await workspace.updateDocumentArray(request.body.documents);
      if (!success) {
        const responseObject = new ResponseObject().badRequest('Failed to update documents');
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().success(true, 'Documents updated successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to update documents');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Delete documents
  fastify.delete('/', {
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
        required: ['documents'],
        properties: {
          documents: {
            type: 'array',
            items: {
              type: 'object',
              required: ['schema', 'data'],
              properties: {
                schema: { type: 'string' },
                data: { type: 'object' }
              }
            }
          }
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

      const success = await workspace.deleteDocumentArray(request.body.documents);
      if (!success) {
        const responseObject = new ResponseObject().badRequest('Failed to delete documents');
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().deleted('Documents deleted successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to delete documents');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Remove documents
  fastify.delete('/remove', {
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
        required: ['documents'],
        properties: {
          documents: {
            type: 'array',
            items: {
              type: 'object',
              required: ['schema', 'data'],
              properties: {
                schema: { type: 'string' },
                data: { type: 'object' }
              }
            }
          }
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

      const success = await workspace.removeDocumentArray(request.body.documents);
      if (!success) {
        const responseObject = new ResponseObject().badRequest('Failed to remove documents');
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().deleted('Documents removed successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to remove documents');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });

  // Get document by hash
  fastify.get('/by-hash/:algo/:hash', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id', 'algo', 'hash'],
        properties: {
          id: { type: 'string' },
          algo: { type: 'string' },
          hash: { type: 'string' }
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

      const checksumString = `${request.params.algo}/${request.params.hash}`;
      const document = await workspace.getDocumentByChecksumString(checksumString);
      if (!document) {
        const responseObject = new ResponseObject().notFound(`Document with checksum ${checksumString} not found`);
        return reply.code(responseObject.statusCode).send(responseObject.getResponse());
      }

      const responseObject = new ResponseObject().found(document, 'Document retrieved successfully');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const responseObject = new ResponseObject().serverError('Failed to get document by hash');
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    }
  });
}
