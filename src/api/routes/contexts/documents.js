'use strict';

import ResponseObject from '../../ResponseObject.js';
import { validateUser } from '../../auth/strategies.js';

export default async function documentRoutes(fastify, options) {

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


  // Document routes will be added here

  // List documents in context
  // Path: / (relative to /:id/documents)
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    schema: {
      // params.id is implicitly available from the prefix in index.js
      querystring: {
        type: 'object',
        properties: {
          featureArray: {
            type: 'array',
            items: { type: 'string' }
          },
          filterArray: {
            type: 'array',
            items: { type: 'string' }
          },
          includeServerContext: { type: 'boolean' },
          includeClientContext: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound('Context not found');
      }

      const { featureArray = [], filterArray = [] } = request.query;
      const options = {
        includeServerContext: request.query.includeServerContext,
        includeClientContext: request.query.includeClientContext
      };

      const dbResult = await context.listDocuments(request.user.id, featureArray, filterArray, options);

      if (dbResult.error) {
        fastify.log.error(`SynapsD error in listDocuments: ${dbResult.error}`);
        return response.error('Failed to list documents due to a database error.', null, dbResult.error);
      }

      return response.success(dbResult.data, 'Documents retrieved successfully', 200, dbResult.count);
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        return response.forbidden(error.message);
      }
      return response.error('Failed to list documents');
    }
  });

  // Insert documents into context
  // Path: / (relative to /:id/documents)
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['documents'],
        properties: {
          featureArray: {
            type: 'array',
            items: { type: 'string' }
          },
          documents: {
            oneOf: [
              { type: 'object' },
              {
                type: 'array',
                items: { type: 'object' }
              }
            ]
          }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound('Context not found');
      }

      const { featureArray = [], documents } = request.body;
      // Convert single document to array if needed
      const documentArray = Array.isArray(documents) ? documents : [documents];

      const result = await context.insertDocumentArray(request.user.id, documentArray, featureArray);

      return response.created(result, 'Documents inserted successfully');
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        return response.forbidden(error.message);
      }
      return response.error('Failed to insert documents');
    }
  });

  // Update documents in context
  // Path: / (relative to /:id/documents)
  fastify.put('/', {
    onRequest: [fastify.authenticate],
    schema: {
      // params.id is implicitly available
      body: {
        type: 'object',
        properties: {
          documents: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id'],
              properties: {
                id: { type: 'string' }
                // other properties of document to update
              }
            }
          },
          featureArray: { type: 'array', items: { type: 'string' } }
        },
        required: ['documents']
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

      const { documents, featureArray = [] } = request.body;
      if (!Array.isArray(documents)) {
        return response.badRequest('Request body must contain an array of documents.');
      }

      const result = await context.updateDocumentArray(request.user.id, documents, featureArray);

      return response.updated(result, 'Documents updated successfully');
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        return response.forbidden(error.message);
      }
      return response.error('Failed to update documents');
    }
  });

  // Delete documents from context (direct DB deletion)
  // Path: / (relative to /:id/documents) - consider a more specific path like /direct-delete if / is overloaded
  fastify.delete('/', {
    onRequest: [fastify.authenticate],
    schema: {
      // params.id is implicitly available
      body: {
        type: 'array',
        items: { type: ['string', 'number'] },
        minItems: 1,
        description: "An array of document IDs to delete directly from the database."
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound(`Context with ID ${contextId} not found or user is not owner (required for direct DB deletion).`);
      }

      // Validate that we have a body
      if (request.body === undefined || request.body === null) {
        return response.badRequest('Request body is required.');
      }

      // Normalize input to array format
      const documentIdArray = Array.isArray(request.body) ? request.body : [request.body];

      // Let the Context.deleteDocumentArrayFromDb method handle the ID validation and conversion
      const result = await context.deleteDocumentArrayFromDb(request.user.id, documentIdArray);

      return response.deleted('Documents deleted from database successfully', result);
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        return response.forbidden(error.message);
      }
      return response.error('Failed to delete documents from database');
    }
  });

  // Remove documents from context
  // Path: /remove (relative to /:id/documents)
  fastify.delete('/remove', {
    onRequest: [fastify.authenticate],
    schema: {
      // params.id is implicitly available
      body: {
        type: 'array',
        items: { type: ['string', 'number'] },
        minItems: 1,
        description: "An array of document IDs to remove from the context."
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

      // Validate that we have a body
      if (request.body === undefined || request.body === null) {
        return response.badRequest('Request body is required.');
      }

      // Normalize input to array format
      const documentIdArray = Array.isArray(request.body) ? request.body : [request.body];

      // Let the Context.removeDocumentArray method handle the ID validation and conversion
      const result = await context.removeDocumentArray(request.user.id, documentIdArray);

      return response.success(result, 'Documents removed from context successfully');
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        return response.forbidden(error.message);
      }
      return response.error('Failed to remove documents from context');
    }
  });

  // Get document by ID
  // Path: /by-id/:docId (relative to /:id/documents)
  fastify.get('/by-id/:docId', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['docId'], // id is from prefix
        properties: {
          // id: { type: 'string' }, // Not needed here, part of prefix
          docId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    const contextId = request.params.id;
    const docId = request.params.docId;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound(`Context with ID ${contextId} not found`);
      }

      const document = await context.getDocumentById(request.user.id, docId);

      if (!document) {
        return response.notFound(`Document with ID '${docId}' not found in context '${contextId}'.`);
      }

      return response.success(document, 'Document retrieved successfully');
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        return response.forbidden(error.message);
      }
      return response.error('Failed to get document by ID');
    }
  });

  // Get documents by abstraction
  // Path: /by-abstraction/:abstraction (relative to /:id/documents)
  fastify.get('/by-abstraction/:abstraction', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['abstraction'], // id is from prefix
        properties: {
          // id: { type: 'string' },
          abstraction: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          filterArray: {
            type: 'array',
            items: { type: 'string' }
          },
          includeServerContext: { type: 'boolean' },
          includeClientContext: { type: 'boolean' },
          limit: { type: 'integer' }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    const contextId = request.params.id;
    const abstraction = request.params.abstraction;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound(`Context with ID ${contextId} not found`);
      }

      const derivedFeatureArray = [`data/abstraction/${abstraction}`];
      const { filterArray = [], includeServerContext, includeClientContext, limit } = request.query;
      const options = {
        includeServerContext,
        includeClientContext,
        limit
      };

      const dbResult = await context.listDocuments(request.user.id, derivedFeatureArray, filterArray, options);

      if (dbResult.error) {
        fastify.log.error(`SynapsD error in listDocuments (by-abstraction): ${dbResult.error}`);
        return response.error('Failed to list documents by abstraction due to a database error.', null, dbResult.error);
      }

      return response.success({ documents: dbResult.data, count: dbResult.count }, 'Documents retrieved successfully by abstraction');
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        return response.forbidden(error.message);
      }
      return response.error('Failed to get documents by abstraction');
    }
  });

  // Get document by ID (direct route)
  // Path: /:docId (relative to /:id/documents)
  fastify.get('/:docId', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['docId'], // id is from prefix
        properties: {
          docId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    const contextId = request.params.id;
    const docId = request.params.docId;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound(`Context with ID ${contextId} not found`);
      }

      const document = await context.getDocumentById(request.user.id, docId);

      if (!document) {
        return response.notFound(`Document with ID '${docId}' not found in context '${contextId}'.`);
      }

      return response.success(document, 'Document retrieved successfully');
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        return response.forbidden(error.message);
      }
      return response.error('Failed to get document by ID');
    }
  });

  // Get document by hash (owner-only direct DB access)
  // Path: /by-hash/:algo/:hash (relative to /:id/documents)
  fastify.get('/by-hash/:algo/:hash', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['algo', 'hash'], // id is from prefix
        properties: {
          // id: { type: 'string' },
          algo: { type: 'string' },
          hash: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const response = new ResponseObject(reply);
    const contextId = request.params.id;
    const { algo, hash } = request.params;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        return response.notFound(`Context with ID ${contextId} not found or not accessible.`);
      }

      const checksumString = `${algo}/${hash}`;
      const document = await context.getDocumentByChecksumStringFromDb(request.user.id, checksumString);

      if (!document) {
        return response.notFound(`Document with checksum '${checksumString}' not found via context '${contextId}' (owner access).`);
      }

      return response.success(document, 'Document retrieved successfully by hash (owner access)');
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        return response.forbidden(error.message);
      }
      return response.error('Failed to get document by hash');
    }
  });
}
