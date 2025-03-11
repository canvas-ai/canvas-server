import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('http:routes:contexts');
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
 *         url:
 *           type: string
 *           description: The context URL
 *         name:
 *           type: string
 *           description: The context name
 *         description:
 *           type: string
 *           description: The context description
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The last update timestamp
 */

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
                autoCreate: true
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
     * @swagger
     * /:
     *   get:
     *     summary: List all contexts
     *     tags: [Contexts]
     *     responses:
     *       200:
     *         description: Contexts retrieved successfully
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    router.get('/', async (req, res) => {
        try {
            const { limit = 50, offset = 0 } = req.query;
            debug(`Listing contexts for user: ${req.user.id}`);

            const contexts = await req.contextManager.listContexts({
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            const response = new ResponseObject().success({
                contexts,
                total: contexts.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error listing contexts: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /:contextId:
     *   get:
     *     summary: Get a specific context by ID
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId', getContextMiddleware, async (req, res) => {
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
     * @swagger
     * /:contextId/documents:
     *   get:
     *     summary: Get documents in a specific context
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context documents retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/documents', getContextMiddleware, async (req, res) => {
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

    /**
     * @swagger
     * /:contextId/url:
     *   get:
     *     summary: Get the context URL
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context URL retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
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

    /**
     * @swagger
     * /:contextId/url:
     *   post:
     *     summary: Set the context URL
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               url:
     *                 type: string
     *     responses:
     *       200:
     *         description: Context URL updated successfully
     *       400:
     *         description: Bad request
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.post('/:contextId/url', getContextMiddleware, async (req, res) => {
        try {
            const { url } = req.body;
            if (!url) {
                const response = new ResponseObject().badRequest("URL is required");
                return res.status(response.statusCode).json(response.getResponse());
            }
            req.context.url = url;
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

    /**
     * @swagger
     * /:contextId/base_url:
     *   get:
     *     summary: Get the context base URL
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context base URL retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/base_url', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ baseUrl: req.context.baseUrl }, 'Context base URL retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context base URL: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /:contextId/base_url:
     *   post:
     *     summary: Set the context base URL
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               baseUrl:
     *                 type: string
     *     responses:
     *       200:
     *         description: Context base URL updated successfully
     *       400:
     *         description: Bad request
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.post('/:contextId/base_url', getContextMiddleware, async (req, res) => {
        try {
            const { baseUrl } = req.body;
            if (!baseUrl) {
                const response = new ResponseObject().badRequest("Base URL is required");
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

    /**
     * @swagger
     * /:contextId/path:
     *   get:
     *     summary: Get the context path (read-only)
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context path retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /:contextId/path_array:
     *   get:
     *     summary: Get the context path array (read-only)
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context path array retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/path_array', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ pathArray: req.context.pathArray }, 'Context path array retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context path array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /:contextId/device:
     *   get:
     *     summary: Get the context device (read-only)
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context device retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/device', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ device: req.context.device }, 'Context device retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context device: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /:contextId/app:
     *   get:
     *     summary: Get the context app (read-only)
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context app retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/app', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ app: req.context.app }, 'Context app retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context app: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /:contextId/user:
     *   get:
     *     summary: Get the context user (read-only)
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context user retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /:contextId/identity:
     *   get:
     *     summary: Get the context identity (read-only)
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context identity retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/identity', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ identity: req.context.identity }, 'Context identity retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context identity: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /:contextId/tree:
     *   get:
     *     summary: Get the context tree (read-only)
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context tree retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/tree', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ tree: req.context.tree }, 'Context tree retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context tree: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /:contextId/status:
     *   get:
     *     summary: Get the context status (read-only)
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context status retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/status', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ status: req.context.status }, 'Context status retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context status: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /:contextId/workspace:
     *   get:
     *     summary: Get the context workspace (read-only)
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context workspace retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/workspace', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ workspace: req.context.workspace }, 'Context workspace retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context workspace: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /:contextId/bitmaps:
     *   get:
     *     summary: Get bitmaps (read-only)
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context bitmaps retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/bitmaps', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ bitmaps: req.context.bitmaps }, 'Context bitmaps retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context bitmaps: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /:contextId/system_bitmap_array:
     *   get:
     *     summary: Get system bitmap array (read-only)
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: System bitmap array retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/system_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ systemBitmapArray: req.context.systemBitmapArray }, 'Context system bitmap array retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving system bitmap array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /:contextId/context_bitmap_array:
     *   get:
     *     summary: Get context bitmap array (read-only)
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Context bitmap array retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/context_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ contextBitmapArray: req.context.contextBitmapArray }, 'Context bitmap array retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving context bitmap array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /:contextId/feature_bitmap_array:
     *   get:
     *     summary: Get feature bitmap array
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Feature bitmap array retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/feature_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ featureBitmapArray: req.context.featureBitmapArray }, 'Feature bitmap array retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error retrieving feature bitmap array: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.put('/:contextId/feature_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const { featureBitmapArray } = req.body;
            if (!Array.isArray(featureBitmapArray)) {
                const response = new ResponseObject().badRequest('featureBitmapArray must be an array');
                return res.status(response.statusCode).json(response.getResponse());
            }
            req.context.featureBitmapArray = featureBitmapArray;
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

    router.post('/:contextId/feature_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const { featureBitmap } = req.body;
            if (featureBitmap === undefined) {
                const response = new ResponseObject().badRequest('featureBitmap is required');
                return res.status(response.statusCode).json(response.getResponse());
            }
            req.context.featureBitmapArray = req.context.featureBitmapArray || [];
            req.context.featureBitmapArray.push(featureBitmap);
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }
            const response = new ResponseObject().success(req.context, 'Feature bitmap appended successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error appending feature bitmap: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.delete('/:contextId/feature_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const { featureBitmap } = req.body;
            if (featureBitmap === undefined) {
                const response = new ResponseObject().badRequest('featureBitmap is required');
                return res.status(response.statusCode).json(response.getResponse());
            }
            req.context.featureBitmapArray = (req.context.featureBitmapArray || []).filter(item => item !== featureBitmap);
            if (typeof req.context.save === 'function') {
                await req.context.save();
            }
            const response = new ResponseObject().success(req.context, 'Feature bitmap removed successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error removing feature bitmap: ${error.message}`);
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

    /**
     * @swagger
     * /:contextId/filter_bitmap_array:
     *   get:
     *     summary: Get filter bitmap array
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: contextId
     *         required: true
     *         schema:
     *           type: string
     *         description: The context ID
     *     responses:
     *       200:
     *         description: Filter bitmap array retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Context not found
     *       500:
     *         description: Server error
     */
    router.get('/:contextId/filter_bitmap_array', getContextMiddleware, async (req, res) => {
        try {
            const response = new ResponseObject().success({ filterBitmapArray: req.context.filterBitmapArray }, 'Filter bitmap array retrieved successfully');
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
            req.context.filterBitmapArray = (req.context.filterBitmapArray || []).filter(item => item !== filterBitmap);
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

    // --- Document routes under context ---

    // POST /:contextId/documents - Create a new document in the context
    router.post('/:contextId/documents', getContextMiddleware, async (req, res) => {
        try {
            const { content, metadata = {}, contextArray, featureArray = [], filterArray = [] } = req.body;
            if (!content) {
                const response = new ResponseObject().badRequest('Document content is required');
                return res.status(response.statusCode).json(response.getResponse());
            }
            // Ensure the contextArray includes the current context id
            let updatedContextArray = contextArray || [];
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
            const documentData = {
                content,
                metadata,
                createdBy: req.user.id
            };
            const options = {
                contextArray: updatedContextArray,
                featureArray,
                filterArray
            };
            const document = await req.workspaceManager.createDocument(workspaceId, documentData, options);
            const response = new ResponseObject().success(document, 'Document created successfully');
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
            let updatedContextArray = contextArray || [];
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
                updatedBy: req.user.id
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
