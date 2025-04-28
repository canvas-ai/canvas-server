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

    /**
     * ===========================
     * Context Management
     * ===========================
     */

    router.get('/', async (req, res) => {
        debug(`Listing contexts for user: ${req.user.id}`);
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
        debug(`Creating context for user: ${req.user.id}`);
        try {
            const { url = '/', id, baseUrl, ...opts } = req.body;

            // Log more information to help with debugging
            debug(`Using URL: "${url}", user ID: ${req.user.id}`);

            const options = {
                id: id,
                baseUrl: baseUrl,
                ...opts,
            };

            debug(`Creating context with URL: ${url}`);
            const context = await req.contextManager.createContext(req.user.id, url, options);

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
        debug(`Getting context ID "${req.params.contextId}" for user "${req.user.id}"`);
        try {
            const response = new ResponseObject().success(req.context, 'Context retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error getting context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * ===========================
     * Context URL & Path Management
     * ===========================
     */

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
            await req.context.setUrl(url);
            const response = new ResponseObject().success({ url: req.context.url }, 'Context URL updated successfully');
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
            await req.context.setBaseUrl(baseUrl);
            const response = new ResponseObject().success({ baseUrl: req.context.baseUrl }, 'Context base URL updated successfully');
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

    /**
     * ===========================
     * Context Status Management
     * ===========================
     */

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

    router.post('/:contextId/lock', getContextMiddleware, async (req, res) => {
        try {
            req.context.lock();
            const response = new ResponseObject().success({ locked: true }, 'Context locked successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error locking context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/:contextId/unlock', getContextMiddleware, async (req, res) => {
        try {
            req.context.unlock();
            const response = new ResponseObject().success({ locked: false }, 'Context unlocked successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error unlocking context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * ===========================
     * Context Layer Management
     * ===========================
     */

    router.post('/:contextId/layers', getContextMiddleware, async (req, res) => {
        try {
            const { name, options = {} } = req.body;
            if (!name) {
                const response = new ResponseObject().badRequest('Layer name is required');
                return res.status(response.statusCode).json(response.getResponse());
            }
            debug(`Adding layer "${name}" to context: ${req.params.contextId}`);
            const layer = await req.context.addLayer(name, options);
            const response = new ResponseObject().success(layer, 'Layer added successfully');
            res.status(201).json(response.getResponse());
        } catch (error) {
            debug(`Error adding layer: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.delete('/:contextId/layers/:layerName', getContextMiddleware, async (req, res) => {
        try {
            const { layerName } = req.params;
            debug(`Removing layer "${layerName}" from context: ${req.params.contextId}`);
            const result = await req.context.removeLayer(layerName);

            if (!result) {
                const response = new ResponseObject().notFound('Layer not found');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const response = new ResponseObject().success({ success: true }, 'Layer removed successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error removing layer: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * ===========================
     * Context Feature Management
     * ===========================
     */

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

            const response = new ResponseObject().success(
                { featureBitmapArray: req.context.featureBitmapArray },
                'Feature bitmap array updated successfully'
            );
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

            const response = new ResponseObject().success(
                { featureBitmapArray: req.context.featureBitmapArray },
                'Feature bitmap array appended successfully'
            );
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

            const response = new ResponseObject().success(
                { featureBitmapArray: req.context.featureBitmapArray },
                'Feature bitmap array elements removed successfully'
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error removing feature bitmap array elements: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.delete('/:contextId/feature_bitmap_array/clear', getContextMiddleware, async (req, res) => {
        try {
            req.context.clearFeatureBitmaps();

            const response = new ResponseObject().success(
                { featureBitmapArray: req.context.featureBitmapArray },
                'Feature bitmap array cleared successfully'
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error clearing feature bitmap array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * ===========================
     * Context Filter Management
     * ===========================
     */

    router.post('/:contextId/filters', getContextMiddleware, async (req, res) => {
        try {
            const { filter, options = {} } = req.body;
            if (!filter) {
                const response = new ResponseObject().badRequest('Filter value is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            debug(`Adding filter to context: ${req.params.contextId}, filter: ${filter}`);
            const result = await req.context.setFilterBitmaps(filter, options);

            const response = new ResponseObject().success(result, 'Filter added successfully');
            res.status(201).json(response.getResponse());
        } catch (error) {
            debug(`Error adding filter: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.delete('/:contextId/filters/:filterName', getContextMiddleware, async (req, res) => {
        try {
            const { filterName } = req.params;
            debug(`Removing filter from context: ${req.params.contextId}, filter: ${filterName}`);
            const result = await req.context.removeFilter(filterName);

            if (!result) {
                const response = new ResponseObject().notFound('Filter not found');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const response = new ResponseObject().success({ success: true }, 'Filter removed successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error removing filter: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * ===========================
     * Context Document Management
     * ===========================
     */

    router.get('/:contextId/documents', getContextMiddleware, async (req, res) => {
        debug(`Getting context documents for contextID "${req.params.contextId}", user "${req.user.id}"`);
        try {
            // Use the context loaded by getContextMiddleware
            const featureArray = req.query.featureArray ? [].concat(req.query.featureArray) : [];
            const filterArray = req.query.filterArray ? [].concat(req.query.filterArray) : [];
            const options = {};

            if (req.query.includeServerContext === 'true') {
                options.includeServerContext = true;
            }

            if (req.query.includeClientContext === 'true') {
                options.includeClientContext = true;
            }

            const documents = await req.context.listDocuments(featureArray, filterArray, options);

            const response = new ResponseObject().success(documents, 'Context documents retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error getting context documents: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/:contextId/documents/:documentId', getContextMiddleware, async (req, res) => {
        try {
            const { documentId } = req.params;
            const featureArray = req.query.featureArray ? [].concat(req.query.featureArray) : [];
            const filterArray = req.query.filterArray ? [].concat(req.query.filterArray) : [];
            const options = {};

            if (req.query.includeServerContext === 'true') {
                options.includeServerContext = true;
            }

            if (req.query.includeClientContext === 'true') {
                options.includeClientContext = true;
            }

            const document = await req.context.getDocument(documentId, featureArray, filterArray, options);

            if (!document) {
                const response = new ResponseObject().notFound('Document not found');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const response = new ResponseObject().success(document, 'Document retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error getting document: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/:contextId/documents', getContextMiddleware, async (req, res) => {
        debug(`Creating documents in contextID "${req.params.contextId}", user "${req.user.id}"`);
        try {
            const { documents, featureArray = [], options = {} } = req.body;

            if (!documents) {
                const response = new ResponseObject().badRequest('documents array is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            let docsArray = documents;
            if (!Array.isArray(documents)) {
                docsArray = [documents];
            }

            const result = await req.context.insertDocuments(docsArray, featureArray, options);
            const response = new ResponseObject().success(result, 'Documents created successfully');
            return res.status(201).json(response.getResponse());
        } catch (error) {
            debug(`Error creating documents in context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.put('/:contextId/documents/:documentId', getContextMiddleware, async (req, res) => {
        try {
            const { documentId } = req.params;
            const { document, featureArray = [], options = {} } = req.body;

            if (!document) {
                const response = new ResponseObject().badRequest('Document data is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Ensure document ID in body matches URL parameter
            document.id = documentId;

            const result = await req.context.updateDocument(document, featureArray, options);
            const response = new ResponseObject().success(result, 'Document updated successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error updating document: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.delete('/:contextId/documents/:documentId', getContextMiddleware, async (req, res) => {
        try {
            const { documentId } = req.params;
            const featureArray = req.query.featureArray ? [].concat(req.query.featureArray) : [];
            const options = {};

            const result = await req.context.removeDocument(documentId, featureArray, options);

            if (!result) {
                const response = new ResponseObject().notFound('Document not found or could not be removed');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const response = new ResponseObject().success({ success: true }, 'Document removed from context successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error removing document: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.delete('/:contextId/documents/:documentId/delete', getContextMiddleware, async (req, res) => {
        try {
            const { documentId } = req.params;

            const result = await req.context.deleteDocument(documentId);

            if (!result) {
                const response = new ResponseObject().notFound('Document not found or could not be deleted');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const response = new ResponseObject().success({ success: true }, 'Document deleted successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error deleting document: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * ===========================
     * Context Auxiliary Data
     * ===========================
     */

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
        debug(`Getting context tree for contextID "${req.params.contextId}", user "${req.user.id}"`);
        debug('Legacy route, will be removed in the upcoming update');
        try {
            const response = new ResponseObject().success({ tree: req.context.tree }, 'Context tree retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context tree: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    return router;
}
