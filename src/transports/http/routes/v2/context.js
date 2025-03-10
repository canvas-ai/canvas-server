'use strict';

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('http:routes:context');
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

    // Get current context (from user's session or create a default one for API tokens)
    router.get('/', async (req, res) => {
        try {
            let context = null;
            const userId = req.user.id;

            // First check if a specific context ID was requested
            if (req.query.id) {
                debug(`Specific context ID requested: ${req.query.id}`);
                try {
                    context = await contextManager.getContext(req.query.id);
                    if (context) {
                        debug(`Found requested context: ${context.id}`);
                        const response = new ResponseObject().success(context, 'Requested context retrieved successfully');
                        return res.status(response.statusCode).json(response.getResponse());
                    }
                } catch (err) {
                    debug(`Error finding requested context: ${err.message}`);
                    // Continue to other methods
                }
            }

            // Next check if user has a session with a context
            if (req.user.sessionId) {
                debug('User has a session, getting context from session');
                const session = await sessionManager.getSession(req.user.sessionId);
                if (session && session.contextId) {
                    context = await contextManager.getContext(session.contextId);
                }
            }

            // If no context found via session, look for a default context for this user
            if (!context) {
                debug('No context found via session, looking for default context');
                try {
                    // Try to find a default context for this user
                    const userContexts = await contextManager.getUserContexts(userId);
                    if (userContexts && userContexts.length > 0) {
                        // Use the first context as default
                        context = userContexts[0];
                        debug(`Found default context: ${context.id}`);
                    }
                } catch (err) {
                    debug(`Error finding default context: ${err.message}`);
                }
            }

            // If still no context, create a default one for API token users
            if (!context) {
                debug('No context found, creating default context for API token user');
                try {
                    const defaultUrl = '/';
                    const workspaceId = 'universe';
                    const userEmail = req.user.email;

                    // Check if the workspace exists in memory
                    let hasWorkspace = workspaceManager.hasWorkspace(userEmail, workspaceId);

                    // If not in memory, check if it exists on disk
                    if (!hasWorkspace) {
                        const existsOnDisk = workspaceManager.hasWorkspaceOnDisk(userEmail, workspaceId);

                        if (existsOnDisk) {
                            // Workspace exists on disk but not in memory, load it
                            debug(`Workspace exists on disk, loading it: ${workspaceId}`);
                            try {
                                await workspaceManager.loadWorkspace(userEmail, workspaceId);
                                hasWorkspace = true;
                            } catch (loadErr) {
                                debug(`Error loading workspace: ${loadErr.message}`);
                                // Continue to create it if loading fails
                            }
                        }
                    }

                    // If still not found, create it
                    if (!hasWorkspace) {
                        debug(`Creating default workspace "${workspaceId}" for user ${userEmail}`);
                        try {
                            await workspaceManager.createWorkspace(userEmail, workspaceId, {
                                label: 'Universe',
                                description: 'Default workspace for API token access',
                                color: '#3498db',
                                type: 'universe'
                            });

                            debug(`Default workspace created for user ${userEmail}`);
                        } catch (workspaceErr) {
                            debug(`Error creating workspace: ${workspaceErr.message}`);
                            throw workspaceErr;
                        }
                    }

                    // Open the workspace (this will initialize it if not already open)
                    const workspace = await workspaceManager.getWorkspace(userEmail, workspaceId);
                    debug(`Using workspace: ${workspace.name}`);

                    // Now create the context
                    const options = {
                        name: 'Default API Context',
                        description: 'Automatically created context for API token access',
                        user: req.user
                    };

                    context = await contextManager.createContext(defaultUrl, options, userId);
                    debug(`Created default context: ${context.id}`);
                } catch (err) {
                    debug(`Error creating default context: ${err.message}`);
                    const response = new ResponseObject().serverError(`Failed to create default context: ${err.message}`);
                    return res.status(response.statusCode).json(response.getResponse());
                }
            }

            const response = new ResponseObject().success(context, 'Context retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error getting current context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // Create a new context
    router.post('/', async (req, res) => {
        try {
            const { url, options } = req.body;
            const userId = req.user.id;

            if (!url) {
                const response = new ResponseObject().badRequest('Context URL is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Check if this is a CLI context with a specific ID
            if (options && options.id && options.id.startsWith('cli-')) {
                debug(`Request for CLI context with ID: ${options.id}`);

                // Try to find existing context with this ID
                try {
                    // Look for existing contexts for this user
                    const userContexts = await contextManager.getUserContexts(userId);
                    const existingContext = userContexts.find(ctx => ctx.id === options.id);

                    if (existingContext) {
                        debug(`Found existing CLI context: ${existingContext.id}`);
                        const response = new ResponseObject().success(existingContext, 'Existing CLI context retrieved');
                        return res.status(response.statusCode).json(response.getResponse());
                    }
                } catch (err) {
                    debug(`Error finding existing CLI context: ${err.message}`);
                    // Continue to create a new one
                }

                // No existing context found, create a new one with the specified ID
                debug(`Creating new CLI context with ID: ${options.id}`);
                options.id = options.id; // Ensure ID is passed to context creation
            }

            const context = await contextManager.createContext(url, options, userId);

            const response = new ResponseObject().created(context, 'Context created successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error creating context: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // Get workspace associated with the current context
    router.get('/workspace', async (req, res) => {
        try {
            let contextId = null;
            const userId = req.user.id;

            // First check if user has a session with a context
            if (req.user.sessionId) {
                debug('User has a session, getting context from session');
                const session = await sessionManager.getSession(req.user.sessionId);
                if (session && session.contextId) {
                    contextId = session.contextId;
                }
            }

            // If no context ID found via session, look for a default context for this user
            if (!contextId) {
                debug('No context found via session, looking for default context');
                try {
                    // Try to find a default context for this user
                    const userContexts = await contextManager.getUserContexts(userId);
                    if (userContexts && userContexts.length > 0) {
                        // Use the first context as default
                        contextId = userContexts[0].id;
                        debug(`Found default context: ${contextId}`);
                    }
                } catch (err) {
                    debug(`Error finding default context: ${err.message}`);
                }
            }

            // If still no context ID, return an error
            if (!contextId) {
                const response = new ResponseObject().notFound('No active context found');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const context = await contextManager.getContext(contextId);
            if (!context) {
                const response = new ResponseObject().notFound(`Context with ID ${contextId} not found`);
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Get the workspace associated with the context
            const workspace = await workspaceManager.getWorkspaceById(context.workspaceId);
            if (!workspace) {
                const response = new ResponseObject().notFound(`Workspace for context ${contextId} not found`);
                return res.status(response.statusCode).json(response.getResponse());
            }

            const response = new ResponseObject().success(workspace, 'Context workspace retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error getting context workspace: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // Get documents in the current context
    router.get('/documents', async (req, res) => {
        try {
            let contextId = null;
            const userId = req.user.id;

            // First check if user has a session with a context
            if (req.user.sessionId) {
                debug('User has a session, getting context from session');
                const session = await sessionManager.getSession(req.user.sessionId);
                if (session && session.contextId) {
                    contextId = session.contextId;
                }
            }

            // If no context ID found via session, look for a default context for this user
            if (!contextId) {
                debug('No context found via session, looking for default context');
                try {
                    // Try to find a default context for this user
                    const userContexts = await contextManager.getUserContexts(userId);
                    if (userContexts && userContexts.length > 0) {
                        // Use the first context as default
                        contextId = userContexts[0].id;
                        debug(`Found default context: ${contextId}`);
                    }
                } catch (err) {
                    debug(`Error finding default context: ${err.message}`);
                }
            }

            // If still no context ID, return an error
            if (!contextId) {
                const response = new ResponseObject().notFound('No active context found');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const context = await contextManager.getContext(contextId);
            if (!context) {
                const response = new ResponseObject().notFound(`Context with ID ${contextId} not found`);
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Get documents in the context
            const documents = await contextManager.getContextDocuments(contextId);

            const response = new ResponseObject().success(documents, 'Context documents retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error getting context documents: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // Get URL of the current context
    router.get('/url', async (req, res) => {
        try {
            let contextId = null;
            const userId = req.user.id;

            // First check if user has a session with a context
            if (req.user.sessionId) {
                debug('User has a session, getting context from session');
                const session = await sessionManager.getSession(req.user.sessionId);
                if (session && session.contextId) {
                    contextId = session.contextId;
                }
            }

            // If no context ID found via session, look for a default context for this user
            if (!contextId) {
                debug('No context found via session, looking for default context');
                try {
                    // Try to find a default context for this user
                    const userContexts = await contextManager.getUserContexts(userId);
                    if (userContexts && userContexts.length > 0) {
                        // Use the first context as default
                        contextId = userContexts[0].id;
                        debug(`Found default context: ${contextId}`);
                    }
                } catch (err) {
                    debug(`Error finding default context: ${err.message}`);
                }
            }

            // If still no context ID, return an error
            if (!contextId) {
                const response = new ResponseObject().notFound('No active context found');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const context = await contextManager.getContext(contextId);
            if (!context) {
                const response = new ResponseObject().notFound(`Context with ID ${contextId} not found`);
                return res.status(response.statusCode).json(response.getResponse());
            }

            const response = new ResponseObject().success({ url: context.url }, 'Context URL retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error getting context URL: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // Get path of the current context
    router.get('/path', async (req, res) => {
        try {
            let contextId = null;
            const userId = req.user.id;

            // First check if user has a session with a context
            if (req.user.sessionId) {
                debug('User has a session, getting context from session');
                const session = await sessionManager.getSession(req.user.sessionId);
                if (session && session.contextId) {
                    contextId = session.contextId;
                }
            }

            // If no context ID found via session, look for a default context for this user
            if (!contextId) {
                debug('No context found via session, looking for default context');
                try {
                    // Try to find a default context for this user
                    const userContexts = await contextManager.getUserContexts(userId);
                    if (userContexts && userContexts.length > 0) {
                        // Use the first context as default
                        contextId = userContexts[0].id;
                        debug(`Found default context: ${contextId}`);
                    }
                } catch (err) {
                    debug(`Error finding default context: ${err.message}`);
                }
            }

            // If still no context ID, return an error
            if (!contextId) {
                const response = new ResponseObject().notFound('No active context found');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const context = await contextManager.getContext(contextId);
            if (!context) {
                const response = new ResponseObject().notFound(`Context with ID ${contextId} not found`);
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Get the filesystem path for the context
            const path = await contextManager.getContextPath(contextId);

            const response = new ResponseObject().success({ path }, 'Context path retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error getting context path: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

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
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const autoCreate = req.query.autoCreate === 'true';

            let context;
            try {
                // If autoCreate is true, pass the user for auto-creation
                const options = autoCreate ? {
                    autoCreate,
                    user: req.user,
                    name: req.query.name || `Context ${id}`,
                    description: req.query.description || 'Auto-created context'
                } : {};

                context = await contextManager.getContext(id, options);
            } catch (err) {
                debug(`Error getting context: ${err.message}`);
                return res.status(404).json(new ResponseObject(null, err.message, 404));
            }

            return res.json(new ResponseObject(context));
        } catch (err) {
            debug(`Error getting context: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
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
     * @swagger
     * /:
     *   get:
     *     summary: List all contexts
     *     tags: [Contexts]
     *     responses:
     *       200:
     *         description: List of contexts
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Context'
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
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
     * @swagger
     * /session/{sessionId}:
     *   get:
     *     summary: List contexts for a session
     *     tags: [Contexts]
     *     parameters:
     *       - in: path
     *         name: sessionId
     *         required: true
     *         schema:
     *           type: string
     *         description: Session ID
     *     responses:
     *       200:
     *         description: List of contexts for the session
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Context'
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
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
     * @swagger
     * /{id}/url:
     *   put:
     *     summary: Update context URL
     *     tags: [Contexts]
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
     *               - url
     *             properties:
     *               url:
     *                 type: string
     *                 description: New context URL
     *     responses:
     *       200:
     *         description: Context URL updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Context'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
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
     * @swagger
     * /{id}/baseurl:
     *   put:
     *     summary: Update context base URL
     *     tags: [Contexts]
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
     *               - baseUrl
     *             properties:
     *               baseUrl:
     *                 type: string
     *                 description: New context base URL
     *     responses:
     *       200:
     *         description: Context base URL updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Context'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
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
     * @swagger
     * /{id}/lock:
     *   put:
     *     summary: Lock a context
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
     *         description: Context locked successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Context'
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
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
     * @swagger
     * /{id}/unlock:
     *   put:
     *     summary: Unlock a context
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
     *         description: Context unlocked successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Context'
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
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
     * @swagger
     * /{id}/workspace:
     *   put:
     *     summary: Switch workspace for a context
     *     tags: [Contexts]
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
     *               - workspace
     *             properties:
     *               workspace:
     *                 type: string
     *                 description: Workspace ID to switch to
     *               url:
     *                 type: string
     *                 description: URL path in the new workspace
     *                 default: "/"
     *     responses:
     *       200:
     *         description: Workspace switched successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Context'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
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
     * @swagger
     * /{id}/initialize:
     *   put:
     *     summary: Initialize a context
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
     *         description: Context initialized successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Context'
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    router.put('/:id/initialize', async (req, res) => {
        try {
            const { id } = req.params;
            const context = contextManager.getContext(id);
            await context.initialize();

            return res.json(new ResponseObject(context));
        } catch (err) {
            debug(`Error initializing context: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/layer:
     *   post:
     *     summary: Add a layer to a context
     *     tags: [Layers]
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
     *               - name
     *             properties:
     *               name:
     *                 type: string
     *                 description: Layer name
     *               options:
     *                 type: object
     *                 description: Additional options for layer creation
     *     responses:
     *       201:
     *         description: Layer added successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Layer'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
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
     * @swagger
     * /{id}/layer/{name}:
     *   get:
     *     summary: Get a layer from a context
     *     tags: [Layers]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Context ID
     *       - in: path
     *         name: name
     *         required: true
     *         schema:
     *           type: string
     *         description: Layer name
     *     responses:
     *       200:
     *         description: Layer retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Layer'
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Layer not found
     *       500:
     *         description: Server error
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
     * @swagger
     * /{id}/layer:
     *   get:
     *     summary: List all layers in a context
     *     tags: [Layers]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Context ID
     *     responses:
     *       200:
     *         description: List of layers
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Layer'
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
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
     * @swagger
     * /{id}/layer/{name}:
     *   delete:
     *     summary: Remove a layer from a context
     *     tags: [Layers]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Context ID
     *       - in: path
     *         name: name
     *         required: true
     *         schema:
     *           type: string
     *         description: Layer name
     *     responses:
     *       200:
     *         description: Layer removed successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Layer not found
     *       500:
     *         description: Server error
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
