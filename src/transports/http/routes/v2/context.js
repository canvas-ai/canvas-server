'use strict';

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('http:routes:context');
import ResponseObject from '@/transports/ResponseObject.js';

/**
 * Context routes
 * @param {Object} options - Route options
 * @param {Object} options.auth - Auth service
 * @param {Object} options.contextManager - Context manager
 * @param {Object} options.sessionManager - Session manager
 * @param {Object} options.workspaceManager - Workspace manager
 * @returns {express.Router} - Express router
 */
export default function contextRoutes(options) {
    const router = express.Router();
    const { auth, contextManager, sessionManager, workspaceManager } = options;

    if (!auth) {
        throw new Error('Auth service is required');
    }

    if (!contextManager) {
        throw new Error('Context manager is required');
    }

    if (!sessionManager) {
        throw new Error('Session manager is required');
    }

    if (!workspaceManager) {
        throw new Error('Workspace manager is required');
    }

    // Middleware to get user from request
    const getUserMiddleware = async (req, res, next) => {
        try {
            req.user = await auth.getUserFromRequest(req);
            if (!req.user) {
                return res.status(401).json(new ResponseObject(null, 'Unauthorized', 401));
            }
            next();
        } catch (err) {
            debug(`Error getting user: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    };

    // Apply auth middleware to all routes
    router.use(auth.getAuthMiddleware());
    router.use(getUserMiddleware);

    /**
     * Create a context
     * POST /api/v2/context
     */
    router.post('/', async (req, res) => {
        try {
            const { url, options = {} } = req.body;

            if (!url) {
                return res.status(400).json(new ResponseObject(null, 'URL is required', 400));
            }

            const context = await contextManager.createContext(url, {
                ...options,
                user: req.user,
            });

            return res.status(201).json(new ResponseObject(context));
        } catch (err) {
            debug(`Error creating context: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Get a context by ID
     * GET /api/v2/context/:id
     */
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const context = contextManager.getContext(id);

            return res.json(new ResponseObject(context));
        } catch (err) {
            debug(`Error getting context: ${err.message}`);
            return res.status(404).json(new ResponseObject(null, err.message, 404));
        }
    });

    /**
     * List all contexts
     * GET /api/v2/context
     */
    router.get('/', async (req, res) => {
        try {
            const contexts = contextManager.listContexts();
            return res.json(new ResponseObject(contexts));
        } catch (err) {
            debug(`Error listing contexts: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });


    /**
     * Update context URL
     * PUT /api/v2/context/:id/url
     */
    router.put('/:id/url', async (req, res) => {
        try {
            const { id } = req.params;
            const { url } = req.body;

            if (!url) {
                return res.status(400).json(new ResponseObject(null, 'URL is required', 400));
            }

            const context = contextManager.getContext(id);
            await context.setUrl(url);

            return res.json(new ResponseObject(context));
        } catch (err) {
            debug(`Error updating context URL: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Update context base URL
     * PUT /api/v2/context/:id/baseurl
     */
    router.put('/:id/baseurl', async (req, res) => {
        try {
            const { id } = req.params;
            const { baseUrl } = req.body;

            if (!baseUrl) {
                return res.status(400).json(new ResponseObject(null, 'Base URL is required', 400));
            }

            const context = contextManager.getContext(id);
            await context.setBaseUrl(baseUrl);

            return res.json(new ResponseObject(context));
        } catch (err) {
            debug(`Error updating context base URL: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Lock a context
     * PUT /api/v2/context/:id/lock
     */
    router.put('/:id/lock', async (req, res) => {
        try {
            const { id } = req.params;
            const context = contextManager.getContext(id);
            context.lock();

            return res.json(new ResponseObject(context));
        } catch (err) {
            debug(`Error locking context: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Unlock a context
     * PUT /api/v2/context/:id/unlock
     */
    router.put('/:id/unlock', async (req, res) => {
        try {
            const { id } = req.params;
            const context = contextManager.getContext(id);
            context.unlock();

            return res.json(new ResponseObject(context));
        } catch (err) {
            debug(`Error unlocking context: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Switch workspace for a context
     * PUT /api/v2/context/:id/workspace
     */
    router.put('/:id/workspace', async (req, res) => {
        try {
            const { id } = req.params;
            const { workspace, url = '/' } = req.body;

            if (!workspace) {
                return res.status(400).json(new ResponseObject(null, 'Workspace ID is required', 400));
            }

            const context = contextManager.getContext(id);
            await context.switchWorkspace(workspace, url);

            return res.json(new ResponseObject(context));
        } catch (err) {
            debug(`Error switching workspace: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Document API Routes
     */

    /**
     * Get a document from a context
     * GET /api/v2/context/:id/document/:documentId
     */
    router.get('/:id/document/:documentId', async (req, res) => {
        try {
            const { id, documentId } = req.params;
            const { features = [], filters = [], options = {} } = req.query;

            // Parse arrays from query params
            const featureArray = Array.isArray(features) ? features : features ? [features] : [];
            const filterArray = Array.isArray(filters) ? filters : filters ? [filters] : [];

            // Parse options
            const parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;

            const context = contextManager.getContext(id);
            const document = context.getDocument(documentId, featureArray, filterArray, parsedOptions);

            if (!document) {
                return res.status(404).json(new ResponseObject(null, 'Document not found', 404));
            }

            return res.json(new ResponseObject(document));
        } catch (err) {
            debug(`Error getting document: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * List documents in a context
     * GET /api/v2/context/:id/document
     */
    router.get('/:id/document', async (req, res) => {
        try {
            const { id } = req.params;
            const { features = [], filters = [], options = {} } = req.query;

            // Parse arrays from query params
            const featureArray = Array.isArray(features) ? features : features ? [features] : [];
            const filterArray = Array.isArray(filters) ? filters : filters ? [filters] : [];

            // Parse options
            const parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;

            const context = contextManager.getContext(id);
            const documents = context.listDocuments(featureArray, filterArray, parsedOptions);

            return res.json(new ResponseObject(documents));
        } catch (err) {
            debug(`Error listing documents: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Insert a document into a context
     * POST /api/v2/context/:id/document
     */
    router.post('/:id/document', async (req, res) => {
        try {
            const { id } = req.params;
            const { document, features = [] } = req.body;

            if (!document) {
                return res.status(400).json(new ResponseObject(null, 'Document is required', 400));
            }

            const context = contextManager.getContext(id);
            const result = context.insertDocument(document, features);

            return res.status(201).json(new ResponseObject(result));
        } catch (err) {
            debug(`Error inserting document: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Insert multiple documents into a context
     * POST /api/v2/context/:id/documents
     */
    router.post('/:id/documents', async (req, res) => {
        try {
            const { id } = req.params;
            const { documents, features = [], options = {} } = req.body;

            if (!documents || !Array.isArray(documents)) {
                return res.status(400).json(new ResponseObject(null, 'Documents array is required', 400));
            }

            const context = contextManager.getContext(id);
            const result = context.insertDocuments(documents, features, options);

            return res.status(201).json(new ResponseObject(result));
        } catch (err) {
            debug(`Error inserting documents: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Update a document in a context
     * PUT /api/v2/context/:id/document/:documentId
     */
    router.put('/:id/document/:documentId', async (req, res) => {
        try {
            const { id } = req.params;
            const { document, features = [] } = req.body;

            if (!document) {
                return res.status(400).json(new ResponseObject(null, 'Document is required', 400));
            }

            const context = contextManager.getContext(id);
            const result = context.updateDocument(document, features);

            return res.json(new ResponseObject(result));
        } catch (err) {
            debug(`Error updating document: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Update multiple documents in a context
     * PUT /api/v2/context/:id/documents
     */
    router.put('/:id/documents', async (req, res) => {
        try {
            const { id } = req.params;
            const { documents, features = [], options = {} } = req.body;

            if (!documents || !Array.isArray(documents)) {
                return res.status(400).json(new ResponseObject(null, 'Documents array is required', 400));
            }

            const context = contextManager.getContext(id);
            const result = context.updateDocuments(documents, features, options);

            return res.json(new ResponseObject(result));
        } catch (err) {
            debug(`Error updating documents: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Remove a document from a context (not deleting from database)
     * DELETE /api/v2/context/:id/document/:documentId/remove
     */
    router.delete('/:id/document/:documentId/remove', async (req, res) => {
        try {
            const { id, documentId } = req.params;
            const { features = [], options = {} } = req.query;

            // Parse arrays from query params
            const featureArray = Array.isArray(features) ? features : features ? [features] : [];

            // Parse options
            const parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;

            const context = contextManager.getContext(id);
            const result = context.removeDocument(documentId, featureArray, parsedOptions);

            if (!result) {
                return res.status(404).json(new ResponseObject(null, 'Document not found', 404));
            }

            return res.json(new ResponseObject({ success: true }));
        } catch (err) {
            debug(`Error removing document: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Remove multiple documents from a context (not deleting from database)
     * DELETE /api/v2/context/:id/documents/remove
     */
    router.delete('/:id/documents/remove', async (req, res) => {
        try {
            const { id } = req.params;
            const { documentIds, features = [], options = {} } = req.body;

            if (!documentIds || !Array.isArray(documentIds)) {
                return res.status(400).json(new ResponseObject(null, 'Document IDs array is required', 400));
            }

            const context = contextManager.getContext(id);
            const result = context.removeDocuments(documentIds, features, options);

            return res.json(new ResponseObject(result));
        } catch (err) {
            debug(`Error removing documents: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Delete a document from the database
     * DELETE /api/v2/context/:id/document/:documentId
     */
    router.delete('/:id/document/:documentId', async (req, res) => {
        try {
            const { id, documentId } = req.params;
            const context = contextManager.getContext(id);
            const result = context.deleteDocument(documentId);

            if (!result) {
                return res.status(404).json(new ResponseObject(null, 'Document not found', 404));
            }

            return res.json(new ResponseObject({ success: true }));
        } catch (err) {
            debug(`Error deleting document: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Delete multiple documents from the database
     * DELETE /api/v2/context/:id/documents
     */
    router.delete('/:id/documents', async (req, res) => {
        try {
            const { id } = req.params;
            const { documentIds, features = [], options = {} } = req.body;

            if (!documentIds || !Array.isArray(documentIds)) {
                return res.status(400).json(new ResponseObject(null, 'Document IDs array is required', 400));
            }

            const context = contextManager.getContext(id);
            const result = context.deleteDocuments(documentIds, features, options);

            return res.json(new ResponseObject(result));
        } catch (err) {
            debug(`Error deleting documents: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    return router;
}