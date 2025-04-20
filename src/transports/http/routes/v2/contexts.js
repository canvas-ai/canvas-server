import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import logger, { createDebug } from '../../../../utils/log/index.js';
const debug = createDebug('http:routes:contexts');
import ResponseObject from '../../../ResponseObject.js';

import { requireContextManager } from '../../middleware/userManagers.js';

/**
 * Contexts routes
 * @param {Object} options - Route options
 * @param {Object} options.auth - Auth service
 * @param {Object} options.userManager - User manager
 * @returns {express.Router} - Express router
 */
export default function contextsRoutes(options) {
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

    // Middleware to get context from request
    const getContextMiddleware = async (req, res, next) => {
        try {
            const contextId = req.params.contextId;
            if (!contextId) {
                const response = new ResponseObject().badRequest('Context ID is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const context = await req.contextManager.getContext(contextId, {
                autoCreate: true,
            });

            if (!context) {
                const response = new ResponseObject().notFound(`Context with ID ${contextId} not found`);
                return res.status(response.statusCode).json(response.getResponse());
            }

            req.context = context;
            next();
        } catch (error) {
            debug(`Error getting context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    };

    router.get('/', async (req, res) => {
        debug(`Listing contexts for user: ${req.user.email}`);
        try {
            const { limit = 50, offset = 0 } = req.query;
            const contexts = await req.contextManager.listContexts({
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            const response = new ResponseObject().success({
                contexts,
                total: contexts.length,
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error listing contexts: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/', async (req, res) => {
        debug(`Creating context for user: ${req.user.email}`);
        try {
            const { url, id, baseUrl } = req.body;

            const options = {
                id: id,
                baseUrl: baseUrl,
            };

            debug(`Creating context with URL: ${url}`);
            const context = await req.contextManager.createContext(url, options);

            // Initialize the context if needed (handles workspace switching)
            await context.initialize();

            const response = new ResponseObject().success(context, 'Context created successfully');
            res.status(201).json(response.getResponse());
        } catch (error) {
            debug(`Error creating context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId', getContextMiddleware, async (req, res) => {
        debug(`Getting context ID "${req.params.contextId}" for user "${req.user.email}"`);
        try {
            const response = new ResponseObject().success(req.context, 'Context retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error getting context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/documents', getContextMiddleware, async (req, res) => {
        debug(`Getting context documents for contextID "${req.params.contextId}", user "${req.user.email}"`);
        try {
            // Use the context loaded by getContextMiddleware
            const featureArray = req.query.featureArray ? [].concat(req.query.featureArray) : [];
            const filterArray = req.query.filterArray ? [].concat(req.query.filterArray) : [];
            const documents = await req.context.listDocuments(featureArray, filterArray);

            const response = new ResponseObject().success(documents, 'Context documents retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error getting context documents: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/url', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ url: req.context.url }, 'Context URL retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context URL: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/:contextId/url', getContextMiddleware, async (req, res) => {
        try {
            const { url } = req.body;
            if (!url) {
                const response = new ResponseObject().badRequest('URL is required');
                return res.status(response.statusCode).json(response.getResponse());
            }
            req.context.setUrl(url);
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }
            const response = new ResponseObject().success(req.context, 'Context URL updated successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error updating context URL: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/base_url', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(
                { baseUrl: req.context.baseUrl },
                'Context base URL retrieved successfully',
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context base URL: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/:contextId/base_url', getContextMiddleware, async (req, res) => {
        try {
            const { baseUrl } = req.body;
            if (!baseUrl) {
                const response = new ResponseObject().badRequest('Base URL is required');
                return res.status(response.statusCode).json(response.getResponse());
            }
            req.context.baseUrl = baseUrl;
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }
            const response = new ResponseObject().success(req.context, 'Context base URL updated successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error updating context base URL: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/path', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ path: req.context.path }, 'Context path retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context path: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/path_array', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(
                { pathArray: req.context.pathArray },
                'Context path array retrieved successfully',
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context path array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/device', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(
                { device: req.context.device },
                'Context device retrieved successfully',
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context device: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/apps', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ apps: req.context.apps }, 'Context apps retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context apps: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/user', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ user: req.context.user }, 'Context user retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context user: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/identity', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(
                { identity: req.context.identity },
                'Context identity retrieved successfully',
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context identity: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/tree', getContextMiddleware, async (req, res) => {
        debug(`Getting context tree for contextID "${req.params.contextId}", user "${req.user.email}"`);
        debug('Legacy route, will be removed in the upcomming update');
        try {
            const response = new ResponseObject().success({ tree: req.context.tree }, 'Context tree retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context tree: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/status', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(
                { status: req.context.status },
                'Context status retrieved successfully',
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context status: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/workspace', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(
                { workspace: req.context.workspace },
                'Context workspace retrieved successfully',
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context workspace: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/bitmaps', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(
                { bitmaps: req.context.bitmaps },
                'Context bitmaps retrieved successfully',
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context bitmaps: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/context_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(
                { contextBitmapArray: req.context.contextBitmapArray },
                'Context bitmap array retrieved successfully',
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context bitmap array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/feature_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(
                { featureBitmapArray: req.context.featureBitmapArray },
                'Feature bitmap array retrieved successfully',
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving feature bitmap array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.put('/:contextId/feature_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const { featureArray } = req.body;
            if (!featureArray) {
                const response = new ResponseObject().badRequest('featureArray is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            req.context.setFeatureBitmaps(featureArray);
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }

            const response = new ResponseObject().success(req.context, 'Feature bitmap array updated successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error updating feature bitmap array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/:contextId/feature_bitmap_array/append', getContextMiddleware, async (req, res) => {
        try {
            const { featureArray } = req.body;
            if (!featureArray) {
                const response = new ResponseObject().badRequest('featureArray is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            req.context.appendFeatureBitmaps(featureArray);
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }

            const response = new ResponseObject().success(req.context, 'Feature bitmap array appended successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error appending feature bitmap array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/:contextId/feature_bitmap_array/remove', getContextMiddleware, async (req, res) => {
        try {
            const { featureArray } = req.body;
            if (!featureArray) {
                const response = new ResponseObject().badRequest('featureArray is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            req.context.removeFeatureBitmaps(featureArray);
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }

            const response = new ResponseObject().success(req.context, 'Feature bitmap array removed successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error removing feature bitmap array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.delete('/:contextId/feature_bitmap_array/clear', getContextMiddleware, async (req, res) => {
        try {
            req.context.featureBitmapArray = [];
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }
            const response = new ResponseObject().success(req.context, 'Feature bitmap array cleared successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error clearing feature bitmap array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/filter_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(
                { filterBitmapArray: req.context.filterBitmapArray },
                'Filter bitmap array retrieved successfully',
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving filter bitmap array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.put('/:contextId/filter_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const { filterBitmapArray } = req.body;
            if (!Array.isArray(filterBitmapArray)) {
                const response = new ResponseObject().badRequest('filterBitmapArray must be an array');
                return res.status(response.statusCode).json(response.getResponse());
            }
            req.context.filterBitmapArray = filterBitmapArray;
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }
            const response = new ResponseObject().success(req.context, 'Filter bitmap array updated successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error updating filter bitmap array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/:contextId/filter_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const { filterBitmap } = req.body;
            if (filterBitmap === undefined) {
                const response = new ResponseObject().badRequest('filterBitmap is required');
                return res.status(response.statusCode).json(response.getResponse());
            }
            req.context.filterBitmapArray = req.context.filterBitmapArray || [];
            req.context.filterBitmapArray.push(filterBitmap);
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }
            const response = new ResponseObject().success(req.context, 'Filter bitmap appended successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error appending filter bitmap: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.delete('/:contextId/filter_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const { filterBitmap } = req.body;
            if (filterBitmap === undefined) {
                const response = new ResponseObject().badRequest('filterBitmap is required');
                return res.status(response.statusCode).json(response.getResponse());
            }
            req.context.filterBitmapArray = (req.context.filterBitmapArray || []).filter((item) => item !== filterBitmap);
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }
            const response = new ResponseObject().success(req.context, 'Filter bitmap removed successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error removing filter bitmap: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.delete('/:contextId/filter_bitmap_array/clear', getContextMiddleware, async (req, res) => {
        try {
            req.context.filterBitmapArray = [];
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }
            const response = new ResponseObject().success(req.context, 'Filter bitmap array cleared successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error clearing filter bitmap array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/:contextId/query', getContextMiddleware, async (req, res) => {
        try {
            const { query, featureArray = [], filterArray = [], options = {} } = req.body;
            if (!query) {
                const response = new ResponseObject().badRequest('Query is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const results = await req.context.query(query, featureArray, filterArray, options);
            const response = new ResponseObject().success(results, 'Query executed successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error executing query: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/:contextId/fts_query', getContextMiddleware, async (req, res) => {
        try {
            const { query, featureArray = [], filterArray = [], options = {} } = req.body;
            if (!query) {
                const response = new ResponseObject().badRequest('Query is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const results = await req.context.ftsQuery(query, featureArray, filterArray, options);
            const response = new ResponseObject().success(results, 'FTS query executed successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error executing FTS query: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/client_context', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(
                { clientContextArray: req.context.clientContextArray },
                'Client context array retrieved successfully',
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving client context array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.put('/:contextId/client_context', getContextMiddleware, async (req, res) => {
        try {
            const { clientContextArray } = req.body;
            if (!clientContextArray) {
                const response = new ResponseObject().badRequest('clientContextArray is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            req.context.setClientContextArray(clientContextArray);
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }

            const response = new ResponseObject().success(req.context, 'Client context array updated successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error updating client context array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.delete('/:contextId/client_context/clear', getContextMiddleware, async (req, res) => {
        try {
            req.context.clearClientContextArray();
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }

            const response = new ResponseObject().success(req.context, 'Client context array cleared successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error clearing client context array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/server_context', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success(
                { serverContextArray: req.context.serverContextArray },
                'Server context array retrieved successfully',
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving server context array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.put('/:contextId/server_context', getContextMiddleware, async (req, res) => {
        try {
            const { serverContextArray } = req.body;
            if (!serverContextArray) {
                const response = new ResponseObject().badRequest('serverContextArray is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            req.context.setServerContextArray(serverContextArray);
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }

            const response = new ResponseObject().success(req.context, 'Server context array updated successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error updating server context array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.delete('/:contextId/server_context/clear', getContextMiddleware, async (req, res) => {
        try {
            req.context.clearServerContextArray();
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }

            const response = new ResponseObject().success(req.context, 'Server context array cleared successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error clearing server context array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // --- Document routes under context ---

    // POST /:contextId/documents - Create a new document in the context
    router.post('/:contextId/documents', getContextMiddleware, async (req, res) => {
        debug(`Creating document in contextID "${req.params.contextId}", user "${req.user.email}"`);
        try {
            console.log(JSON.stringify(req.body, null, 2));
            const { documents, clientContextArray, featureArray = [] } = req.body;
            if (!documents) {
                const response = new ResponseObject().badRequest('documents array missing');
                return res.status(response.statusCode).json(response.getResponse());
            }
            if (!Array.isArray(documents)) {
                documents = [documents];
            }

            const result = await req.context.insertDocuments(documents, featureArray, {
                clientContextArray: clientContextArray,
            });
            const response = new ResponseObject().success(result, 'Documents created successfully');
            return res.status(201).json(response.getResponse());
        } catch (error) {
            debug(`Error creating document in context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    // GET /:contextId/documents/by-id/:id - Retrieve a document by ID within the context
    router.get('/:contextId/documents/by-id/:id', getContextMiddleware, async (req, res) => {
        try {
            const { id } = req.params;
            const featureArray = req.query.featureArray ? [].concat(req.query.featureArray) : [];
            const filterArray = req.query.filterArray ? [].concat(req.query.filterArray) : [];
            const workspaceId = req.context.workspace;
            if (!workspaceId) {
                const response = new ResponseObject().serverError('Workspace not found in context');
                return res.status(response.statusCode).json(response.getResponse());
            }
            const workspace = await req.workspaceManager.getWorkspace(workspaceId);
            if (!workspace) {
                const response = new ResponseObject().notFound('Workspace not found');
                return res.status(response.statusCode).json(response.getResponse());
            }
            if (!req.workspaceManager.hasAccess(workspace, req.user)) {
                const response = new ResponseObject().forbidden('Access denied');
                return res.status(response.statusCode).json(response.getResponse());
            }
            const options = { contextArray: [req.context.id], featureArray, filterArray };
            const document = await req.workspaceManager.getDocumentById(workspaceId, id, options);
            if (!document) {
                const response = new ResponseObject().notFound('Document not found');
                return res.status(response.statusCode).json(response.getResponse());
            }
            const response = new ResponseObject().success(document, 'Document retrieved successfully');
            return res.json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving document by id in context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    // GET /:contextId/documents/by-hash/:hash/:checksum - Retrieve a document by hash and checksum within the context
    router.get('/:contextId/documents/by-hash/:hash/:checksum', getContextMiddleware, async (req, res) => {
        try {
            const { hash, checksum } = req.params;
            const featureArray = req.query.featureArray ? [].concat(req.query.featureArray) : [];
            const filterArray = req.query.filterArray ? [].concat(req.query.filterArray) : [];
            const workspaceId = req.context.workspace;
            if (!workspaceId) {
                const response = new ResponseObject().serverError('Workspace not found in context');
                return res.status(response.statusCode).json(response.getResponse());
            }
            const workspace = await req.workspaceManager.getWorkspace(workspaceId);
            if (!workspace) {
                const response = new ResponseObject().notFound('Workspace not found');
                return res.status(response.statusCode).json(response.getResponse());
            }
            if (!req.workspaceManager.hasAccess(workspace, req.user)) {
                const response = new ResponseObject().forbidden('Access denied');
                return res.status(response.statusCode).json(response.getResponse());
            }
            const options = { contextArray: [req.context.id], featureArray, filterArray };
            const document = await req.workspaceManager.getDocumentByHash(workspaceId, hash, checksum, options);
            if (!document) {
                const response = new ResponseObject().notFound('Document not found');
                return res.status(response.statusCode).json(response.getResponse());
            }
            const response = new ResponseObject().success(document, 'Document retrieved successfully');
            return res.json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving document by hash in context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    // PUT /:contextId/documents/:id - Update a document within the context
    router.put('/:contextId/documents/:id', getContextMiddleware, async (req, res) => {
        try {
            const { id } = req.params;
            const { content, metadata = {}, contextArray, featureArray = [], filterArray = [] } = req.body;
            if (!content) {
                const response = new ResponseObject().badRequest('Document content is required');
                return res.status(response.statusCode).json(response.getResponse());
            }
            const updatedContextArray = contextArray || [];
            if (!updatedContextArray.includes(req.context.id)) {
                updatedContextArray.push(req.context.id);
            }
            const workspaceId = req.context.workspace;
            if (!workspaceId) {
                const response = new ResponseObject().serverError('Workspace not found in context');
                return res.status(response.statusCode).json(response.getResponse());
            }
            const workspace = await req.workspaceManager.getWorkspace(workspaceId);
            if (!workspace) {
                const response = new ResponseObject().notFound('Workspace not found');
                return res.status(response.statusCode).json(response.getResponse());
            }
            if (!req.workspaceManager.hasAccess(workspace, req.user, 'write')) {
                const response = new ResponseObject().forbidden('Access denied');
                return res.status(response.statusCode).json(response.getResponse());
            }
            const existingDocument = await req.workspaceManager.getDocumentById(workspaceId, id);
            if (!existingDocument) {
                const response = new ResponseObject().notFound('Document not found');
                return res.status(response.statusCode).json(response.getResponse());
            }
            const documentData = {
                content,
                metadata,
                updatedBy: req.user.id,
            };
            const options = { contextArray: updatedContextArray, featureArray, filterArray };
            const document = await req.workspaceManager.updateDocument(workspaceId, id, documentData, options);
            const response = new ResponseObject().success(document, 'Document updated successfully');
            return res.json(response.getResponse());
        } catch (error) {
            debug(`Error updating document in context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    // DELETE /:contextId/documents/:id - Delete a document within the context
    router.delete('/:contextId/documents/:id', getContextMiddleware, async (req, res) => {
        try {
            const { id } = req.params;
            const workspaceId = req.context.workspace;
            if (!workspaceId) {
                const response = new ResponseObject().serverError('Workspace not found in context');
                return res.status(response.statusCode).json(response.getResponse());
            }
            const workspace = await req.workspaceManager.getWorkspace(workspaceId);
            if (!workspace) {
                const response = new ResponseObject().notFound('Workspace not found');
                return res.status(response.statusCode).json(response.getResponse());
            }
            if (!req.workspaceManager.hasAccess(workspace, req.user, 'write')) {
                const response = new ResponseObject().forbidden('Access denied');
                return res.status(response.statusCode).json(response.getResponse());
            }
            const existingDocument = await req.workspaceManager.getDocumentById(workspaceId, id);
            if (!existingDocument) {
                const response = new ResponseObject().notFound('Document not found');
                return res.status(response.statusCode).json(response.getResponse());
            }
            const result = await req.workspaceManager.deleteDocument(workspaceId, id);
            const response = new ResponseObject().success({ success: true }, 'Document deleted successfully');
            return res.json(response.getResponse());
        } catch (error) {
            debug(`Error deleting document in context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    return router;
}
