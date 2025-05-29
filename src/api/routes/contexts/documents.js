'use strict';

import ResponseObject from '../../ResponseObject.js';
import { validateUser } from '../../auth/strategies.js';

export default async function documentRoutes(fastify, options) {
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
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    // request.params.id will be available here due to the prefix
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        const response = new ResponseObject().notFound('Context not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const { featureArray = [], filterArray = [] } = request.query;
      const options = {
        includeServerContext: request.query.includeServerContext,
        includeClientContext: request.query.includeClientContext
      };

      const dbResult = await context.listDocuments(request.user.id, featureArray, filterArray, options);

      if (dbResult.error) {
        fastify.log.error(`SynapsD error in listDocuments: ${dbResult.error}`);
        const response = new ResponseObject().serverError('Failed to list documents due to a database error.', dbResult.error);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found(dbResult.data, 'Documents retrieved successfully', 200, dbResult.count);
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to list documents');
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        const response = new ResponseObject().notFound('Context not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const { featureArray = [], documents } = request.body;
      // Convert single document to array if needed
      const documentArray = Array.isArray(documents) ? documents : [documents];

      const result = await context.insertDocumentArray(request.user.id, documentArray, featureArray);

      const response = new ResponseObject().created(result, 'Documents inserted successfully', 201, result.length);
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to insert documents');
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        const response = new ResponseObject().notFound(`Context with ID ${contextId} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const { documents, featureArray = [] } = request.body;
      if (!Array.isArray(documents)) {
        const response = new ResponseObject().badRequest('Request body must contain an array of documents.');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const result = await context.updateDocumentArray(request.user.id, documents, featureArray);

      const response = new ResponseObject().success(result, 'Documents updated successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to update documents');
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        const response = new ResponseObject().notFound(`Context with ID ${contextId} not found or user is not owner (required for direct DB deletion).`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // Validate that we have a body
      if (request.body === undefined || request.body === null) {
        const response = new ResponseObject().badRequest('Request body is required.');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // Normalize input to array format
      const documentIdArray = Array.isArray(request.body) ? request.body : [request.body];

      // Let the Context.deleteDocumentArrayFromDb method handle the ID validation and conversion
      const result = await context.deleteDocumentArrayFromDb(request.user.id, documentIdArray);

      const response = new ResponseObject().success(result, 'Documents deleted from database successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to delete documents from database');
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    const contextId = request.params.id;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        const response = new ResponseObject().notFound(`Context with ID ${contextId} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // Validate that we have a body
      if (request.body === undefined || request.body === null) {
        const response = new ResponseObject().badRequest('Request body is required.');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // Normalize input to array format
      const documentIdArray = Array.isArray(request.body) ? request.body : [request.body];

      // Let the Context.removeDocumentArray method handle the ID validation and conversion
      const result = await context.removeDocumentArray(request.user.id, documentIdArray);

      const response = new ResponseObject().success(result, 'Documents removed from context successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to remove documents from context');
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    const contextId = request.params.id;
    const docId = request.params.docId;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        const response = new ResponseObject().notFound(`Context with ID ${contextId} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const document = await context.getDocumentById(request.user.id, docId);

      if (!document) {
        const response = new ResponseObject().notFound(`Document with ID '${docId}' not found in context '${contextId}'.`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found(document, 'Document retrieved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to get document by ID');
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    const contextId = request.params.id;
    const abstraction = request.params.abstraction;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        const response = new ResponseObject().notFound(`Context with ID ${contextId} not found`);
        return reply.code(response.statusCode).send(response.getResponse());
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
        const response = new ResponseObject().serverError('Failed to list documents by abstraction due to a database error.', dbResult.error);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found(dbResult.data, 'Documents retrieved successfully by abstraction', 200, dbResult.count);
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to get documents by abstraction');
      return reply.code(response.statusCode).send(response.getResponse());
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
    if (!validateUserWithResponse(request, reply)) {
      return;
    }
    const contextId = request.params.id;
    const { algo, hash } = request.params;

    try {
      const context = await fastify.contextManager.getContext(request.user.id, contextId);
      if (!context) {
        const response = new ResponseObject().notFound(`Context with ID ${contextId} not found or not accessible.`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const checksumString = `${algo}/${hash}`;
      const document = await context.getDocumentByChecksumStringFromDb(request.user.id, checksumString);

      if (!document) {
        const response = new ResponseObject().notFound(`Document with checksum '${checksumString}' not found via context '${contextId}' (owner access).`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found(document, 'Document retrieved successfully by hash (owner access)');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to get document by hash');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });
}
