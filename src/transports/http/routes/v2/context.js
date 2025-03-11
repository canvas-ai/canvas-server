'use strict';

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('http:routes:context');
import ResponseObject from '@/transports/ResponseObject.js';
import { requireContextManager } from '../../middleware/userManagers.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Context:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The context ID
 *         name:
 *           type: string
 *           description: The context name
 *         url:
 *           type: string
 *           description: The context URL
 *         baseUrl:
 *           type: string
 *           description: The context base URL
 *         created:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         locked:
 *           type: boolean
 *           description: Whether the context is locked
 *     Layer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The layer ID
 *         name:
 *           type: string
 *           description: The layer name
 *     Filter:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The filter ID
 *         name:
 *           type: string
 *           description: The filter name
 *     Document:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The document ID
 *         content:
 *           type: object
 *           description: The document content
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Error message
 *         code:
 *           type: integer
 *           description: HTTP status code
 */

/**
 * Context routes
 * @param {Object} options - Route options
 * @param {Object} options.auth - Auth service
 * @param {Object} options.userManager - User manager
 * @returns {express.Router} - Express router
 */
export default function contextRoutes(options) {
    const router = express.Router();
    const { auth, userManager } = options;

    if (!auth) {
        throw new Error('Auth service is required');
    }

    if (!userManager) {
        throw new Error('User manager is required');
    }

    // Apply auth middleware to all routes
    router.use(auth.getAuthMiddleware());

    // Apply context manager middleware to all routes
    router.use(requireContextManager({ userManager }));

    // Helper functions
    const parseArrayParam = (param) => {
        if (!param) return [];
        return Array.isArray(param) ? param : [param];
    };

    const parseOptions = (options) => {
        return {
            ...options,
            include: parseArrayParam(options.include),
            exclude: parseArrayParam(options.exclude)
        };
    };

    /**
     * @swagger
     * /:
     *   get:
     *     summary: Get context by URL
     *     tags: [Contexts]
     *     parameters:
     *       - in: query
     *         name: url
     *         required: true
     *         schema:
     *           type: string
     *         description: Context URL
     *     responses:
     *       200:
     *         description: Context retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Context'
     *       400:
     *         description: Bad request
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/', async (req, res) => {
        try {
            const { url } = req.query;
            debug(`Getting context by URL: ${url}`);

            if (!url) {
                return res.status(400).json(new ResponseObject().badRequest('URL is required'));
            }

            const context = await req.contextManager.getContextByUrl(url);
            if (!context) {
                return res.status(404).json(new ResponseObject().notFound('Context not found'));
            }

            return res.json(new ResponseObject().success(context));
        } catch (error) {
            debug(`Error getting context: ${error.message}`);
            return res.status(500).json(new ResponseObject().serverError(error.message));
        }
    });

    // Middleware to get context from request
    const getContextMiddleware = async (req, res, next) => {
        try {
            // Get context ID from params or query
            const contextId = req.params.contextId || req.params.id || req.query.contextId;

            if (!contextId) {
                const response = new ResponseObject().badRequest('Context ID is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            try {
                // Extract any options from the request that should be passed to getContext
                // This allows routes to specify options via query parameters
                const options = {
                    // Add any default options here
                    ...req.query.options ? JSON.parse(req.query.options) : {},
                    // Allow individual options to be specified directly
                    ...(req.query.includeSystemContext !== undefined && { includeSystemContext: req.query.includeSystemContext === 'true' }),
                    // Add any other specific options you want to support
                };

                const context = await req.contextManager.getContext(contextId, options);
                if (!context) {
                    const response = new ResponseObject().notFound(`Context with ID ${contextId} not found`);
                    return res.status(response.statusCode).json(response.getResponse());
                }

                // Parse common parameters for document operations
                req.featureArray = parseArrayParam(req.query.features);
                req.filterArray = parseArrayParam(req.query.filters);
                req.documentOptions = parseOptions(req.query.options);

                req.context = context;
                next();
            } catch (error) {
                const response = new ResponseObject().notFound(`Context with ID ${contextId} not found: ${error.message}`);
                return res.status(response.statusCode).json(response.getResponse());
            }
        } catch (error) {
            debug(`Error getting context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    };

    /**
     * @swagger
     * /{id}:
     *   get:
     *     summary: Get a context by ID
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Context ID
     *     responses:
     *       200:
     *         description: Context retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Context'
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:id', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(req.context, 'Context retrieved successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error getting context: ${err.message}`);
            const response = new ResponseObject().serverError(err.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /url/{url}:
     *   get:
     *     summary: Get a context by URL
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: url
     *         required: true
     *         schema:
     *           type: string
     *         description: Context URL
     *       - in: query
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: Context ID
     *     responses:
     *       200:
     *         description: Context retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Context'
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/url/:url(*)', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(req.context, 'Context retrieved successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error getting context by URL: ${err.message}`);
            const response = new ResponseObject().serverError(err.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /{id}/document:
     *   get:
     *     summary: List documents in a context
     *     tags: [Documents]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Context ID
     *       - in: query
     *         name: features
     *         schema:
     *           type: array
     *           items:
     *             type: string
     *         description: Feature array for filtering
     *       - in: query
     *         name: filters
     *         schema:
     *           type: array
     *           items:
     *             type: string
     *         description: Filter array for filtering
     *       - in: query
     *         name: options
     *         schema:
     *           type: object
     *         description: Additional options
     *     responses:
     *       200:
     *         description: List of documents
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Document'
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    router.get('/:id/document', getContextMiddleware, async (req, res) => {
        try {
            // Use the pre-parsed parameters from the middleware
            const documents = req.context.listDocuments(req.featureArray, req.filterArray, req.documentOptions);

            const response = new ResponseObject().success(documents, 'Documents retrieved successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error listing documents: ${err.message}`);
            const response = new ResponseObject().serverError(err.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /{id}/document/{documentId}:
     *   get:
     *     summary: Get a document from a context
     *     tags: [Documents]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Context ID
     *       - in: path
     *         name: documentId
     *         required: true
     *         schema:
     *           type: string
     *         description: Document ID
     *       - in: query
     *         name: features
     *         schema:
     *           type: array
     *           items:
     *             type: string
     *         description: Feature array for filtering
     *       - in: query
     *         name: filters
     *         schema:
     *           type: array
     *           items:
     *             type: string
     *         description: Filter array for filtering
     *       - in: query
     *         name: options
     *         schema:
     *           type: object
     *         description: Additional options
     *     responses:
     *       200:
     *         description: Document retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Document'
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Document not found
     *       500:
     *         description: Server error
     */
    router.get('/:id/document/:documentId', getContextMiddleware, async (req, res) => {
        try {
            const { documentId } = req.params;

            // Use the pre-parsed parameters from the middleware
            const document = req.context.getDocument(documentId, req.featureArray, req.filterArray, req.documentOptions);

            if (!document) {
                const response = new ResponseObject().notFound('Document not found');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const response = new ResponseObject().success(document, 'Document retrieved successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error getting document: ${err.message}`);
            const response = new ResponseObject().serverError(err.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /{id}/document:
     *   post:
     *     summary: Insert a document into a context
     *     tags: [Documents]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Context ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - document
     *             properties:
     *               document:
     *                 type: object
     *                 description: Document to insert
     *               features:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Feature array for indexing
     *     responses:
     *       201:
     *         description: Document inserted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Document'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    router.post('/:id/document', getContextMiddleware, async (req, res) => {
        try {
            const { document, features = [] } = req.body;

            if (!document) {
                const response = new ResponseObject().badRequest('Document is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Combine features from body with any from query parameters
            const combinedFeatures = [...features, ...req.featureArray];

            const result = req.context.insertDocument(document, combinedFeatures);

            const response = new ResponseObject().created(result, 'Document inserted successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error inserting document: ${err.message}`);
            const response = new ResponseObject().serverError(err.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * Insert multiple documents into a context
     * POST /api/v2/context/:id/documents
     */
    router.post('/:id/documents', getContextMiddleware, async (req, res) => {
        try {
            const { documents, features = [] } = req.body;

            if (!documents || !Array.isArray(documents)) {
                const response = new ResponseObject().badRequest('Documents array is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Combine features from body with any from query parameters
            const combinedFeatures = [...features, ...req.featureArray];

            // Merge options from body with pre-parsed options from query
            const combinedOptions = {
                ...req.documentOptions,
                ...(req.body.options || {})
            };

            const result = req.context.insertDocuments(documents, combinedFeatures, combinedOptions);

            const response = new ResponseObject().created(result, 'Documents inserted successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error inserting documents: ${err.message}`);
            const response = new ResponseObject().serverError(err.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * Update a document in a context
     * PUT /api/v2/context/:id/document/:documentId
     */
    router.put('/:id/document/:documentId', getContextMiddleware, async (req, res) => {
        try {
            const { document, features = [] } = req.body;

            if (!document) {
                const response = new ResponseObject().badRequest('Document is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const result = req.context.updateDocument(document, features);

            const response = new ResponseObject().success(result, 'Document updated successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error updating document: ${err.message}`);
            const response = new ResponseObject().serverError(err.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * Update multiple documents in a context
     * PUT /api/v2/context/:id/documents
     */
    router.put('/:id/documents', getContextMiddleware, async (req, res) => {
        try {
            const { documents, features = [], options = {} } = req.body;

            if (!documents || !Array.isArray(documents)) {
                const response = new ResponseObject().badRequest('Documents array is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const result = req.context.updateDocuments(documents, features, options);

            const response = new ResponseObject().success(result, 'Documents updated successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error updating documents: ${err.message}`);
            const response = new ResponseObject().serverError(err.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * Remove a document from a context (not deleting from database)
     * DELETE /api/v2/context/:id/document/:documentId/remove
     */
    router.delete('/:id/document/:documentId/remove', getContextMiddleware, async (req, res) => {
        try {
            const { documentId } = req.params;
            const { features = [], options = {} } = req.query;

            // Parse arrays from query params
            const featureArray = Array.isArray(features) ? features : features ? [features] : [];

            // Parse options
            const parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;

            const result = req.context.removeDocument(documentId, featureArray, parsedOptions);

            if (!result) {
                const response = new ResponseObject().notFound('Document not found');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const response = new ResponseObject().success({ success: true }, 'Document removed successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error removing document: ${err.message}`);
            const response = new ResponseObject().serverError(err.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * Remove multiple documents from a context (not deleting from database)
     * DELETE /api/v2/context/:id/documents/remove
     */
    router.delete('/:id/documents/remove', getContextMiddleware, async (req, res) => {
        try {
            const { documentIds, features = [], options = {} } = req.body;

            if (!documentIds || !Array.isArray(documentIds)) {
                const response = new ResponseObject().badRequest('Document IDs array is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const result = req.context.removeDocuments(documentIds, features, options);

            const response = new ResponseObject().success(result, 'Documents removed successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error removing documents: ${err.message}`);
            const response = new ResponseObject().serverError(err.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * Delete a document from the database
     * DELETE /api/v2/context/:id/document/:documentId
     */
    router.delete('/:id/document/:documentId', getContextMiddleware, async (req, res) => {
        try {
            const { documentId } = req.params;
            const result = req.context.deleteDocument(documentId);

            if (!result) {
                const response = new ResponseObject().notFound('Document not found');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const response = new ResponseObject().success({ success: true }, 'Document deleted successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error deleting document: ${err.message}`);
            const response = new ResponseObject().serverError(err.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * Delete multiple documents from the database
     * DELETE /api/v2/context/:id/documents
     */
    router.delete('/:id/documents', getContextMiddleware, async (req, res) => {
        try {
            const { documentIds, features = [], options = {} } = req.body;

            if (!documentIds || !Array.isArray(documentIds)) {
                const response = new ResponseObject().badRequest('Document IDs array is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const result = req.context.deleteDocuments(documentIds, features, options);

            const response = new ResponseObject().success(result, 'Documents deleted successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error deleting documents: ${err.message}`);
            const response = new ResponseObject().serverError(err.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    return router;
}
