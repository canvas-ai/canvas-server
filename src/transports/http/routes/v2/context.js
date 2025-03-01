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
     * Get a context by URL
     * GET /api/v2/context/url/:url
     */
    router.get('/url/:url(*)', async (req, res) => {
        try {
            const { url } = req.params;
            const context = contextManager.getContextByUrl(url);

            if (!context) {
                return res.status(404).json(new ResponseObject(null, 'Context not found', 404));
            }

            return res.json(new ResponseObject(context));
        } catch (err) {
            debug(`Error getting context by URL: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
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
     * List contexts for a session
     * GET /api/v2/context/session/:sessionId
     */
    router.get('/session/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const contexts = contextManager.listSessionContexts(sessionId);
            return res.json(new ResponseObject(contexts));
        } catch (err) {
            debug(`Error listing session contexts: ${err.message}`);
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
     * Add a layer to a context
     * POST /api/v2/context/:id/layer
     */
    router.post('/:id/layer', async (req, res) => {
        try {
            const { id } = req.params;
            const { name, options = {} } = req.body;

            if (!name) {
                return res.status(400).json(new ResponseObject(null, 'Layer name is required', 400));
            }

            const context = contextManager.getContext(id);
            const layer = await context.addLayer(name, options);

            return res.status(201).json(new ResponseObject(layer));
        } catch (err) {
            debug(`Error adding layer: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Get a layer from a context
     * GET /api/v2/context/:id/layer/:name
     */
    router.get('/:id/layer/:name', async (req, res) => {
        try {
            const { id, name } = req.params;
            const context = contextManager.getContext(id);
            const layer = context.getLayer(name);

            if (!layer) {
                return res.status(404).json(new ResponseObject(null, 'Layer not found', 404));
            }

            return res.json(new ResponseObject(layer));
        } catch (err) {
            debug(`Error getting layer: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * List all layers in a context
     * GET /api/v2/context/:id/layer
     */
    router.get('/:id/layer', async (req, res) => {
        try {
            const { id } = req.params;
            const context = contextManager.getContext(id);
            const layers = context.listLayers();

            return res.json(new ResponseObject(layers));
        } catch (err) {
            debug(`Error listing layers: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Remove a layer from a context
     * DELETE /api/v2/context/:id/layer/:name
     */
    router.delete('/:id/layer/:name', async (req, res) => {
        try {
            const { id, name } = req.params;
            const context = contextManager.getContext(id);
            const result = context.removeLayer(name);

            if (!result) {
                return res.status(404).json(new ResponseObject(null, 'Layer not found', 404));
            }

            return res.json(new ResponseObject({ success: true }));
        } catch (err) {
            debug(`Error removing layer: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Add a filter to a context
     * POST /api/v2/context/:id/filter
     */
    router.post('/:id/filter', async (req, res) => {
        try {
            const { id } = req.params;
            const { name, options = {} } = req.body;

            if (!name) {
                return res.status(400).json(new ResponseObject(null, 'Filter name is required', 400));
            }

            const context = contextManager.getContext(id);
            const filter = context.addFilter(name, options);

            return res.status(201).json(new ResponseObject(filter));
        } catch (err) {
            debug(`Error adding filter: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Get a filter from a context
     * GET /api/v2/context/:id/filter/:name
     */
    router.get('/:id/filter/:name', async (req, res) => {
        try {
            const { id, name } = req.params;
            const context = contextManager.getContext(id);
            const filter = context.getFilter(name);

            if (!filter) {
                return res.status(404).json(new ResponseObject(null, 'Filter not found', 404));
            }

            return res.json(new ResponseObject(filter));
        } catch (err) {
            debug(`Error getting filter: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * List all filters in a context
     * GET /api/v2/context/:id/filter
     */
    router.get('/:id/filter', async (req, res) => {
        try {
            const { id } = req.params;
            const context = contextManager.getContext(id);
            const filters = context.listFilters();

            return res.json(new ResponseObject(filters));
        } catch (err) {
            debug(`Error listing filters: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Remove a filter from a context
     * DELETE /api/v2/context/:id/filter/:name
     */
    router.delete('/:id/filter/:name', async (req, res) => {
        try {
            const { id, name } = req.params;
            const context = contextManager.getContext(id);
            const result = context.removeFilter(name);

            if (!result) {
                return res.status(404).json(new ResponseObject(null, 'Filter not found', 404));
            }

            return res.json(new ResponseObject({ success: true }));
        } catch (err) {
            debug(`Error removing filter: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Delete a context
     * DELETE /api/v2/context/:id
     */
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await contextManager.removeContext(id);

            if (!result) {
                return res.status(404).json(new ResponseObject(null, 'Context not found', 404));
            }

            return res.json(new ResponseObject({ success: true }));
        } catch (err) {
            debug(`Error deleting context: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    return router;
}