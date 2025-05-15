'use strict';

import ResponseObject from '../../ResponseObject.js'; // Assuming ResponseObject is in a relative path

/**
 * User-specific routes, including shared context access.
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Plugin options
 */
export default async function userRoutes(fastify, options) {
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

  // Get a specific context (owned by targetUserId, accessed by request.user.id)
  fastify.get('/:targetUserId/contexts/:contextId', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['targetUserId', 'contextId'],
        properties: {
          targetUserId: { type: 'string', description: "The user ID of the context owner" },
          contextId: { type: 'string', description: "The ID of the context" }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const accessingUserId = request.user.id;
      const ownerUserId = request.params.targetUserId;
      const contextId = request.params.contextId;
      const fullContextIdentifier = `${ownerUserId}/${contextId}`;

      const context = await fastify.contextManager.getContext(accessingUserId, fullContextIdentifier);

      if (!context) {
        const response = new ResponseObject().notFound(`Context '${fullContextIdentifier}' not found or not accessible by user '${accessingUserId}'.`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const responseObject = new ResponseObject().found(
        { context: context.toJSON() },
        'Context retrieved successfully'
      );
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(`Error in GET /users/${request.params.targetUserId}/contexts/${request.params.contextId}: ${error.message}`);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      if (error.message.includes('not found for user')) { // From contextManager if owner/context doesn't exist
        const response = new ResponseObject().notFound(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to get context');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Grant access to a context (share)
  fastify.post('/:ownerUserId/contexts/:contextId/shares', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['ownerUserId', 'contextId'],
        properties: {
          ownerUserId: { type: 'string', description: "The user ID of the context owner (must be the authenticated user)" },
          contextId: { type: 'string', description: "The ID of the context to share" }
        }
      },
      body: {
        type: 'object',
        required: ['sharedWithUserId', 'accessLevel'],
        properties: {
          sharedWithUserId: { type: 'string', description: "User ID to share the context with" },
          accessLevel: { type: 'string', enum: ['documentRead', 'documentWrite', 'documentReadWrite'], description: "Access level to grant" }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    const requestingUserId = request.user.id;
    const ownerUserIdFromParams = request.params.ownerUserId;
    const contextId = request.params.contextId;
    const { sharedWithUserId, accessLevel } = request.body;

    if (requestingUserId !== ownerUserIdFromParams) {
      const response = new ResponseObject().forbidden('You can only share contexts that you own.');
      return reply.code(response.statusCode).send(response.getResponse());
    }

    try {
      const targetContextIdentifier = `${ownerUserIdFromParams}/${contextId}`;
      await fastify.contextManager.grantContextAccess(requestingUserId, targetContextIdentifier, sharedWithUserId, accessLevel);

      const response = new ResponseObject().success(
        { message: `Context '${targetContextIdentifier}' shared with '${sharedWithUserId}' at level '${accessLevel}'.` },
        'Context shared successfully'
      );
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Error in POST /users/${ownerUserIdFromParams}/contexts/${contextId}/shares: ${error.message}`);
      if (error.message.startsWith('Access denied') || error.message.includes('not the owner')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      if (error.message.includes('not found')) {
        const response = new ResponseObject().notFound(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to share context', error.message);
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Revoke access to a context (unshare)
  fastify.delete('/:ownerUserId/contexts/:contextId/shares/:sharedWithUserId', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['ownerUserId', 'contextId', 'sharedWithUserId'],
        properties: {
          ownerUserId: { type: 'string', description: "The user ID of the context owner (must be the authenticated user)" },
          contextId: { type: 'string', description: "The ID of the context" },
          sharedWithUserId: { type: 'string', description: "User ID whose access should be revoked" }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    const requestingUserId = request.user.id;
    const ownerUserIdFromParams = request.params.ownerUserId;
    const contextId = request.params.contextId;
    const sharedWithUserIdFromParams = request.params.sharedWithUserId;

    if (requestingUserId !== ownerUserIdFromParams) {
      const response = new ResponseObject().forbidden('You can only manage shares for contexts that you own.');
      return reply.code(response.statusCode).send(response.getResponse());
    }

    try {
      const targetContextIdentifier = `${ownerUserIdFromParams}/${contextId}`;
      await fastify.contextManager.revokeContextAccess(requestingUserId, targetContextIdentifier, sharedWithUserIdFromParams);

      const response = new ResponseObject().success(
        { message: `Access for '${sharedWithUserIdFromParams}' to context '${targetContextIdentifier}' has been revoked.` },
        'Context share revoked successfully'
      );
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Error in DELETE /users/${ownerUserIdFromParams}/contexts/${contextId}/shares/${sharedWithUserIdFromParams}: ${error.message}`);
       if (error.message.startsWith('Access denied') || error.message.includes('not the owner')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      if (error.message.includes('not found')) {
        const response = new ResponseObject().notFound(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to revoke context share', error.message);
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // --- Document Operations for Shared Contexts ---

  // List documents in a specific context owned by targetUserId
  fastify.get('/:targetUserId/contexts/:contextId/documents', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['targetUserId', 'contextId'],
        properties: {
          targetUserId: { type: 'string', description: "User ID of the context owner" },
          contextId: { type: 'string', description: "ID of the context" }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          featureArray: { type: 'array', items: { type: 'string' } },
          filterArray: { type: 'array', items: { type: 'string' } },
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

    try {
      const accessingUserId = request.user.id;
      const ownerUserId = request.params.targetUserId;
      const contextId = request.params.contextId;
      const fullContextIdentifier = `${ownerUserId}/${contextId}`;

      const context = await fastify.contextManager.getContext(accessingUserId, fullContextIdentifier);
      if (!context) {
        const response = new ResponseObject().notFound(`Context '${fullContextIdentifier}' not found or not accessible by user '${accessingUserId}'.`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const { featureArray = [], filterArray = [], includeServerContext, includeClientContext, limit } = request.query;
      const options = { includeServerContext, includeClientContext, limit };

      const dbResult = await context.listDocuments(accessingUserId, featureArray, filterArray, options);

      if (dbResult.error) {
        fastify.log.error(`SynapsD error in listDocuments (shared context): ${dbResult.error}`);
        const response = new ResponseObject().serverError('Failed to list documents in shared context due to a database error.', dbResult.error);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found(dbResult.data, 'Documents retrieved successfully from shared context', 200, dbResult.count);
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Error in GET /users/${request.params.targetUserId}/contexts/${request.params.contextId}/documents: ${error.message}`);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to list documents in shared context');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Insert documents into a specific context owned by targetUserId
  fastify.post('/:targetUserId/contexts/:contextId/documents', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['targetUserId', 'contextId'],
        properties: {
          targetUserId: { type: 'string' },
          contextId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        // featureArray is now optional, SynapsD handles it based on schema.
        required: ['documents'],
        properties: {
          documents: {
            type: 'array',
            items: { type: 'object' }, // Assuming documents are full document objects
            minItems: 1
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const accessingUserId = request.user.id;
      const ownerUserId = request.params.targetUserId;
      const contextId = request.params.contextId;
      const fullContextIdentifier = `${ownerUserId}/${contextId}`;

      const context = await fastify.contextManager.getContext(accessingUserId, fullContextIdentifier);
      if (!context) {
        const response = new ResponseObject().notFound(`Context '${fullContextIdentifier}' not found or not accessible by user '${accessingUserId}'.`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // documents is required by schema, featureArray is optional
      const { documents, featureArray = [] } = request.body;

      const result = await context.insertDocumentArray(accessingUserId, documents, featureArray);

      // Assuming result is an array of the inserted documents/ids
      const response = new ResponseObject().created(result, 'Documents inserted successfully', 201, Array.isArray(result) ? result.length : undefined);
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Error in POST /users/${request.params.targetUserId}/contexts/${request.params.contextId}/documents: ${error.message}`);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      // Handle specific error from insertDocumentArray if it throws for other reasons (e.g., validation)
      if (error.failedItem) { // SynapsD insertDocumentArray throws error with failedItem and failedIndex
        const response = new ResponseObject().badRequest(`Failed to insert document at index ${error.failedIndex}: ${error.message}`, error.failedItem);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to insert documents into shared context');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Update documents in a specific context owned by targetUserId
  fastify.put('/:targetUserId/contexts/:contextId/documents', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['targetUserId', 'contextId'],
        properties: {
          targetUserId: { type: 'string' },
          contextId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          documents: {
            type: 'array',
            items: { type: 'object', required: ['id'] }, // Documents must have IDs for update
            minItems: 1
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

    try {
      const accessingUserId = request.user.id;
      const ownerUserId = request.params.targetUserId;
      const contextId = request.params.contextId;
      const fullContextIdentifier = `${ownerUserId}/${contextId}`;

      const context = await fastify.contextManager.getContext(accessingUserId, fullContextIdentifier);
      if (!context) {
        const response = new ResponseObject().notFound(`Context '${fullContextIdentifier}' not found or not accessible by user '${accessingUserId}'.`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const { documents, featureArray = [] } = request.body;
      if (!Array.isArray(documents) || documents.length === 0) {
        const response = new ResponseObject().badRequest('Request body must contain a non-empty array of documents to update.');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // context.updateDocumentArray will check for 'documentWrite' permission for accessingUserId
      const result = await context.updateDocumentArray(accessingUserId, documents, featureArray);

      const response = new ResponseObject().success(result, 'Documents updated successfully in shared context');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Error in PUT /users/${request.params.targetUserId}/contexts/${request.params.contextId}/documents: ${error.message}`);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      if (error.failedItem) { // SynapsD updateDocumentArray might throw with failedItem
        const response = new ResponseObject().badRequest(`Failed to update document at index ${error.failedIndex}: ${error.message}`, error.failedItem);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to update documents in shared context');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Remove documents from a specific context owned by targetUserId (contextual removal)
  fastify.delete('/:targetUserId/contexts/:contextId/documents/remove', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['targetUserId', 'contextId'],
        properties: {
          targetUserId: { type: 'string' },
          contextId: { type: 'string' }
        }
      },
      body: { // Expects an array of document IDs to remove
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: "An array of document IDs to remove from the shared context."
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const accessingUserId = request.user.id;
      const ownerUserId = request.params.targetUserId;
      const contextId = request.params.contextId;
      const fullContextIdentifier = `${ownerUserId}/${contextId}`;

      const context = await fastify.contextManager.getContext(accessingUserId, fullContextIdentifier);
      if (!context) {
        const response = new ResponseObject().notFound(`Context '${fullContextIdentifier}' not found or not accessible by user '${accessingUserId}'.`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const documentIdArray = request.body;
      if (!Array.isArray(documentIdArray) || documentIdArray.length === 0 || !documentIdArray.every(item => typeof item === 'string')) {
        const response = new ResponseObject().badRequest('Request body must be a non-empty array of document IDs (strings).');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // context.removeDocumentArray will check for 'documentReadWrite' permission
      const result = await context.removeDocumentArray(accessingUserId, documentIdArray);

      // SynapsD removeDocumentArray returns { successful: [], failed: [], count: number }
      // We can craft a more detailed response or a simple success if all succeed / partial success
      if (result.failed && result.failed.length > 0) {
        const response = new ResponseObject().serverError(
          `Partially removed documents from shared context. Successful: ${result.successful.length}, Failed: ${result.failed.length}`,
          result.failed // Provide details of failures
        );
         // Decide on status code: 207 Multi-Status or 500 if any failure is critical
        return reply.code(207).send(response.getResponse());
      }

      const response = new ResponseObject().success(result.successful, 'Documents removed from shared context successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Error in DELETE /users/.../documents/remove: ${error.message}`);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to remove documents from shared context');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Delete documents directly from DB within a specific context (effectively owner-only)
  fastify.delete('/:targetUserId/contexts/:contextId/documents', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['targetUserId', 'contextId'],
        properties: {
          targetUserId: { type: 'string' },
          contextId: { type: 'string' }
        }
      },
      body: { // Expects an array of document IDs to delete
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: "An array of document IDs to delete directly from the database via the shared context (owner only)."
      }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const accessingUserId = request.user.id;
      const ownerUserId = request.params.targetUserId;
      const contextId = request.params.contextId;
      const fullContextIdentifier = `${ownerUserId}/${contextId}`;

      // Get the context first. The accessingUserId must be able to "get" the context.
      // The actual owner check for deletion is within context.deleteDocumentArrayFromDb.
      const context = await fastify.contextManager.getContext(accessingUserId, fullContextIdentifier);
      if (!context) {
        const response = new ResponseObject().notFound(`Context '${fullContextIdentifier}' not found or not accessible by user '${accessingUserId}'.`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // Additional check: Even if user can access context (e.g. shared with read),
      // they cannot call direct delete unless they are the targetUserId (owner of the context).
      if (accessingUserId !== ownerUserId) {
          const response = new ResponseObject().forbidden('Access denied: Direct DB deletion is only allowed by the context owner.');
          return reply.code(response.statusCode).send(response.getResponse());
      }

      const documentIdArray = request.body;
      if (!Array.isArray(documentIdArray) || documentIdArray.length === 0 || !documentIdArray.every(item => typeof item === 'string')) {
        const response = new ResponseObject().badRequest('Request body must be a non-empty array of document IDs (strings).');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // context.deleteDocumentArrayFromDb will perform the strict owner check (accessingUserId vs context.userId)
      // and also 'documentReadWrite' (which owner has by default)
      const result = await context.deleteDocumentArrayFromDb(accessingUserId, documentIdArray);

      if (result.failed && result.failed.length > 0) {
        const response = new ResponseObject().serverError(
          `Partially deleted documents from DB. Successful: ${result.successful.length}, Failed: ${result.failed.length}`,
          result.failed
        );
        return reply.code(207).send(response.getResponse());
      }

      const response = new ResponseObject().success(result.successful, 'Documents deleted from database successfully via shared context');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(`Error in DELETE /users/.../documents: ${error.message}`);
      if (error.message.startsWith('Access denied')) {
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to delete documents from database via shared context');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Get a specific document by ID from a context owned by targetUserId
  fastify.get('/:targetUserId/contexts/:contextId/documents/by-id/:docId', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['targetUserId', 'contextId', 'docId'],
        properties: {
          targetUserId: { type: 'string', description: "User ID of the context owner" },
          contextId: { type: 'string', description: "ID of the context" },
          docId: { type: 'string', description: "ID of the document to retrieve" }
        }
      },
      // Querystring for options like includeServerContext, includeClientContext can be added if needed
      // querystring: {
      //   type: 'object',
      //   properties: {
      //     includeServerContext: { type: 'boolean' },
      //     includeClientContext: { type: 'boolean' }
      //   }
      // }
    }
  }, async (request, reply) => {
    if (!validateUserWithResponse(request, reply)) {
      return;
    }

    try {
      const accessingUserId = request.user.id;
      const ownerUserId = request.params.targetUserId;
      const contextId = request.params.contextId;
      const docId = request.params.docId;
      const fullContextIdentifier = `${ownerUserId}/${contextId}`;

      // const { includeServerContext, includeClientContext } = request.query; // If options are added
      // const options = { includeServerContext, includeClientContext };

      const context = await fastify.contextManager.getContext(accessingUserId, fullContextIdentifier);
      if (!context) {
        const response = new ResponseObject().notFound(`Context '${fullContextIdentifier}' not found or not accessible by user '${accessingUserId}'.`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // context.getDocumentById is owner-only. If accessingUserId is not ownerUserId, it will throw.
      // No additional options are passed to getDocumentById in this MVP, but could be if needed.
      const document = await context.getDocumentById(accessingUserId, docId);

      if (!document) { // Should not happen if getDocumentById succeeds, but good practice
        const response = new ResponseObject().notFound(`Document with ID '${docId}' not found in context '${fullContextIdentifier}'.`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const responseObject = new ResponseObject().found(
        document, // SynapsD returns the document directly or null
        'Document retrieved successfully from shared context by ID'
      );
      return reply.code(responseObject.statusCode).send(responseObject.getResponse());
    } catch (error) {
      fastify.log.error(`Error in GET /users/${request.params.targetUserId}/contexts/${request.params.contextId}/documents/by-id/${request.params.docId}: ${error.message}`);
      if (error.message.startsWith('Access denied')) {
        // This includes the owner-only check from getDocumentById
        const response = new ResponseObject().forbidden(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      if (error.message.includes('not found or not accessible by user')) { // From getContext
        const response = new ResponseObject().notFound(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }
      // Other errors, e.g., if docId itself is malformed for DB lookup (though SynapsD usually handles this)
      const response = new ResponseObject().serverError('Failed to get document by ID from shared context');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });
}
