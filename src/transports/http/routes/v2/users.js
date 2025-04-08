'use strict';

import { Router } from 'express';

import logger, { createDebug } from '../../../../utils/log/index.js';
import ResponseObject from '../../../ResponseObject.js';
const debug = createDebug('http:routes:users');

import { createUserManagersMiddleware } from '../../middleware/userManagers.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The user ID
 *         username:
 *           type: string
 *           description: The username
 *         email:
 *           type: string
 *           description: The user's email
 *         firstName:
 *           type: string
 *           description: The user's first name
 *         lastName:
 *           type: string
 *           description: The user's last name
 *         created:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         status:
 *           type: string
 *           enum: [active, inactive, suspended]
 *           description: User status
 *     UserWorkspace:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The workspace ID
 *         name:
 *           type: string
 *           description: The workspace name
 *         role:
 *           type: string
 *           description: User's role in the workspace
 *     UserContext:
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
 *     UserSession:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The session ID
 *         device:
 *           type: string
 *           description: The device ID
 *         created:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         lastActive:
 *           type: string
 *           format: date-time
 *           description: Last activity timestamp
 */

/**
 * Users routes
 * @param {Object} options - Route options
 * @param {Object} options.auth - Auth service
 * @param {Object} options.userManager - User manager
 * @param {Object} options.sessionManager - Session manager
 * @returns {express.Router} - Express router
 */
export default function usersRoutes(options) {
    const userRouter = Router();
    const { auth, userManager, sessionManager } = options;

    if (!auth) {
        throw new Error('Auth service is required');
    }

    if (!userManager) {
        throw new Error('User manager is required');
    }

    if (!sessionManager) {
        throw new Error('Session manager is required');
    }

    // Apply auth middleware to all routes
    userRouter.use(auth.getAuthMiddleware());

    // Create user managers middleware (but don't require them by default)
    const userManagersMiddleware = createUserManagersMiddleware({ userManager });

    // Middleware to get user from request
    const getUserMiddleware = async (req, res, next) => {
        try {
            if (!req.user) {
                req.user = await auth.getUserFromRequest(req);
            }

            if (!req.user) {
                return res.status(401).json(new ResponseObject().unauthorized('Unauthorized'));
            }

            next();
        } catch (err) {
            debug(`Error getting user: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    };

    // Apply user middleware to all routes
    userRouter.use(getUserMiddleware);

    /**
     * @swagger
     * /current:
     *   get:
     *     summary: Get the current authenticated user
     *     tags: [Users]
     *     responses:
     *       200:
     *         description: Current user retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    userRouter.get('/current', async (req, res) => {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json(new ResponseObject().unauthorized('Unauthorized'));
            }

            const userId = req.user.id;
            debug(`Getting current user with ID: ${userId}`);

            const user = await userManager.getUser(userId);
            if (!user) {
                debug(`Current user not found with ID: ${userId}`);
                return res.status(404).json(new ResponseObject().notFound('User not found'));
            }

            return res.json(new ResponseObject().success(user));
        } catch (err) {
            debug(`Error getting current user: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    /**
     * @swagger
     * /:
     *   get:
     *     summary: List all users
     *     tags: [Users]
     *     parameters:
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 50
     *         description: Maximum number of users to return
     *       - in: query
     *         name: offset
     *         schema:
     *           type: integer
     *           default: 0
     *         description: Number of users to skip
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [active, inactive, suspended]
     *         description: Filter by user status
     *     responses:
     *       200:
     *         description: List of users
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/User'
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    userRouter.get('/', async (req, res) => {
        try {
            const { limit = 50, offset = 0, status } = req.query;
            const options = {
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
                status,
            };

            const users = await userManager.listUsers(options);
            return res.json(new ResponseObject(users));
        } catch (err) {
            debug(`Error listing users: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /:
     *   post:
     *     summary: Create a new user
     *     tags: [Users]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - username
     *               - email
     *             properties:
     *               username:
     *                 type: string
     *                 description: The username
     *               email:
     *                 type: string
     *                 format: email
     *                 description: The user's email
     *               firstName:
     *                 type: string
     *                 description: The user's first name
     *               lastName:
     *                 type: string
     *                 description: The user's last name
     *               password:
     *                 type: string
     *                 format: password
     *                 description: The user's password
     *     responses:
     *       201:
     *         description: User created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    userRouter.post('/', async (req, res) => {
        try {
            const { username, email, firstName, lastName, password } = req.body;

            if (!username || !email) {
                return res.status(400).json(new ResponseObject(null, 'Username and email are required', 400));
            }

            const userData = {
                username,
                email,
                firstName,
                lastName,
                password,
            };

            const user = await userManager.createUser(userData);
            return res.status(201).json(new ResponseObject(user));
        } catch (err) {
            debug(`Error creating user: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}:
     *   get:
     *     summary: Get a user by ID
     *     tags: [Users]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: User ID
     *     responses:
     *       200:
     *         description: User retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: User not found
     *       500:
     *         description: Server error
     */
    userRouter.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const user = await userManager.getUser(id);

            if (!user) {
                return res.status(404).json(new ResponseObject(null, 'User not found', 404));
            }

            return res.json(new ResponseObject(user));
        } catch (err) {
            debug(`Error getting user: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}:
     *   put:
     *     summary: Update a user
     *     tags: [Users]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: User ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               username:
     *                 type: string
     *                 description: The username
     *               email:
     *                 type: string
     *                 format: email
     *                 description: The user's email
     *               firstName:
     *                 type: string
     *                 description: The user's first name
     *               lastName:
     *                 type: string
     *                 description: The user's last name
     *               status:
     *                 type: string
     *                 enum: [active, inactive, suspended]
     *                 description: User status
     *     responses:
     *       200:
     *         description: User updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: User not found
     *       500:
     *         description: Server error
     */
    userRouter.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { username, email, firstName, lastName, status } = req.body;

            const userData = {
                username,
                email,
                firstName,
                lastName,
                status,
            };

            const user = await userManager.updateUser(id, userData);

            if (!user) {
                return res.status(404).json(new ResponseObject(null, 'User not found', 404));
            }

            return res.json(new ResponseObject(user));
        } catch (err) {
            debug(`Error updating user: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}:
     *   patch:
     *     summary: Partially update a user
     *     tags: [Users]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: User ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               username:
     *                 type: string
     *                 description: The username
     *               email:
     *                 type: string
     *                 format: email
     *                 description: The user's email
     *               firstName:
     *                 type: string
     *                 description: The user's first name
     *               lastName:
     *                 type: string
     *                 description: The user's last name
     *               status:
     *                 type: string
     *                 enum: [active, inactive, suspended]
     *                 description: User status
     *     responses:
     *       200:
     *         description: User updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: User not found
     *       500:
     *         description: Server error
     */
    userRouter.patch('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const user = await userManager.updateUser(id, updateData);

            if (!user) {
                return res.status(404).json(new ResponseObject(null, 'User not found', 404));
            }

            return res.json(new ResponseObject(user));
        } catch (err) {
            debug(`Error updating user: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}:
     *   delete:
     *     summary: Delete a user
     *     tags: [Users]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: User ID
     *     responses:
     *       200:
     *         description: User deleted successfully
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
     *         description: User not found
     *       500:
     *         description: Server error
     */
    userRouter.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await userManager.deleteUser(id);

            if (!result) {
                return res.status(404).json(new ResponseObject(null, 'User not found', 404));
            }

            return res.json(new ResponseObject({ success: true }));
        } catch (err) {
            debug(`Error deleting user: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/workspaces:
     *   get:
     *     summary: List workspaces for a user
     *     tags: [Users]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: User ID
     *     responses:
     *       200:
     *         description: List of workspaces for the user
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/UserWorkspace'
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: User not found
     *       500:
     *         description: Server error
     */
    userRouter.get('/:id/workspaces', userManagersMiddleware, async (req, res) => {
        try {
            const { id } = req.params;
            const user = await userManager.getUser(id);

            if (!user) {
                return res.status(404).json(new ResponseObject().notFound('User not found'));
            }

            // Check if the requested user is the authenticated user
            if (id !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json(new ResponseObject().forbidden('Access denied'));
            }

            // If we're looking at the current user, use the already initialized workspaceManager
            if (id === req.user.id && req.workspaceManager) {
                const workspaces = await req.workspaceManager.listWorkspaces();
                return res.json(new ResponseObject().success(workspaces));
            }

            // Otherwise, we need to get the user instance and activate it
            const userInstance = await userManager.getUserById(id);
            if (!userInstance) {
                return res.status(404).json(new ResponseObject().notFound('User not found'));
            }

            // Activate the user if not already active
            if (userInstance.status !== 'active') {
                await userInstance.activate();
            }

            const workspaces = await userInstance.workspaceManager.listWorkspaces();
            return res.json(new ResponseObject().success(workspaces));
        } catch (error) {
            debug(`Error listing user workspaces: ${error.message}`);
            return res.status(500).json(new ResponseObject().serverError(error.message));
        }
    });

    /**
     * @swagger
     * /{id}/contexts:
     *   get:
     *     summary: List contexts for a user
     *     tags: [Users]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: User ID
     *     responses:
     *       200:
     *         description: List of contexts for the user
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/UserContext'
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: User not found
     *       500:
     *         description: Server error
     */
    userRouter.get('/:id/contexts', userManagersMiddleware, async (req, res) => {
        try {
            const { id } = req.params;
            const user = await userManager.getUser(id);

            if (!user) {
                return res.status(404).json(new ResponseObject().notFound('User not found'));
            }

            // Check if the requested user is the authenticated user
            if (id !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json(new ResponseObject().forbidden('Access denied'));
            }

            // If we're looking at the current user, use the already initialized contextManager
            if (id === req.user.id && req.contextManager) {
                const contexts = await req.contextManager.listContexts();
                return res.json(new ResponseObject().success(contexts));
            }

            // Otherwise, we need to get the user instance and activate it
            const userInstance = await userManager.getUserById(id);
            if (!userInstance) {
                return res.status(404).json(new ResponseObject().notFound('User not found'));
            }

            // Activate the user if not already active
            if (userInstance.status !== 'active') {
                await userInstance.activate();
            }

            const contexts = await userInstance.contextManager.listContexts();
            return res.json(new ResponseObject().success(contexts));
        } catch (error) {
            debug(`Error listing user contexts: ${error.message}`);
            return res.status(500).json(new ResponseObject().serverError(error.message));
        }
    });

    /**
     * @swagger
     * /{id}/sessions:
     *   get:
     *     summary: List sessions for a user
     *     tags: [Users]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: User ID
     *     responses:
     *       200:
     *         description: List of sessions for the user
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/UserSession'
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: User not found
     *       500:
     *         description: Server error
     */
    userRouter.get('/:id/sessions', async (req, res) => {
        try {
            const { id } = req.params;
            const user = await userManager.getUser(id);

            if (!user) {
                return res.status(404).json(new ResponseObject(null, 'User not found', 404));
            }

            const sessions = await sessionManager.listUserSessions(id);
            return res.json(new ResponseObject(sessions));
        } catch (err) {
            debug(`Error listing user sessions: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    return userRouter;
}
