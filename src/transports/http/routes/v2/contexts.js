import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('http:routes:contexts');
import ResponseObject from '@/transports/ResponseObject.js';

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

export default function contextsRoutes(options) {
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

    // Middleware to get context from request
    const getContextMiddleware = async (req, res, next) => {
        try {
            const contextId = req.params.contextId;
            if (!contextId) {
                const response = new ResponseObject().badRequest('Context ID is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const context = await contextManager.getContext(contextId);
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
     *     summary: List all contexts for the current user
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
            const userId = req.query.userId || req.user.id;

            // Check if the user is requesting contexts for another user
            if (userId !== req.user.id && !req.user.isAdmin) {
                const response = new ResponseObject().forbidden('You do not have permission to view contexts for other users');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const contexts = await contextManager.getUserContexts(userId);

            const response = new ResponseObject().success(contexts, 'Contexts retrieved successfully');
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
            const documents = await contextManager.getContextDocuments(req.context.id);

            const response = new ResponseObject().success(documents, 'Context documents retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error getting context documents: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    return router;
}
