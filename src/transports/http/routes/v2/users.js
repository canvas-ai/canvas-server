'use strict';

import { Router } from 'express';

import logger, { createDebug } from '../../../../utils/log/index.js';
import ResponseObject from '../../../ResponseObject.js';
const debug = createDebug('http:routes:users');

import { createUserManagersMiddleware } from '../../middleware/userManagers.js';

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

            return res.json(new ResponseObject().success(user.toJSON()));
        } catch (err) {
            debug(`Error getting current user: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    userRouter.get('/', async (req, res) => {
        try {
            const { status, userType } = req.query;
            const options = {
                status,
                userType,
            };

            const users = await userManager.listUsers(options);
            return res.json(new ResponseObject().success(users));
        } catch (err) {
            debug(`Error listing users: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    userRouter.post('/', async (req, res) => {
        try {
            const { email, userType } = req.body;

            if (!email) {
                return res.status(400).json(new ResponseObject().badRequest('Email is required'));
            }

            const userData = {
                email,
                userType,
            };

            const user = await userManager.createUser(userData);
            return res.status(201).json(new ResponseObject().created(user.toJSON()));
        } catch (err) {
            debug(`Error creating user: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    userRouter.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const user = await userManager.getUser(id);

            if (!user) {
                return res.status(404).json(new ResponseObject().notFound('User not found'));
            }

            return res.json(new ResponseObject().success(user.toJSON()));
        } catch (err) {
            debug(`Error getting user: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    userRouter.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { email, userType, status } = req.body;

            const userData = {
                email,
                userType,
                status,
            };

            const user = await userManager.updateUser(id, userData);

            if (!user) {
                return res.status(404).json(new ResponseObject().notFound('User not found'));
            }

            return res.json(new ResponseObject().success(user.toJSON()));
        } catch (err) {
            debug(`Error updating user: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    userRouter.patch('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const user = await userManager.updateUser(id, updateData);

            if (!user) {
                return res.status(404).json(new ResponseObject().notFound('User not found'));
            }

            return res.json(new ResponseObject().success(user.toJSON()));
        } catch (err) {
            debug(`Error updating user: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    userRouter.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await userManager.deleteUser(id);

            if (!result) {
                return res.status(404).json(new ResponseObject().notFound('User not found'));
            }

            return res.json(new ResponseObject().success({ success: true }));
        } catch (err) {
            debug(`Error deleting user: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    userRouter.get('/:id/tokens', async (req, res) => {
        try {
            const { id } = req.params;

            // Check if the requested user is the authenticated user or admin
            if (id !== req.user.id && req.user.userType !== 'admin') {
                return res.status(403).json(new ResponseObject().forbidden('Access denied'));
            }

            const tokens = await userManager.listApiTokens(id);
            return res.json(new ResponseObject().success(tokens));
        } catch (err) {
            debug(`Error listing user tokens: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    userRouter.post('/:id/tokens', async (req, res) => {
        try {
            const { id } = req.params;
            const tokenOptions = req.body;

            // Check if the requested user is the authenticated user or admin
            if (id !== req.user.id && req.user.userType !== 'admin') {
                return res.status(403).json(new ResponseObject().forbidden('Access denied'));
            }

            if (!tokenOptions.name) {
                return res.status(400).json(new ResponseObject().badRequest('Token name is required'));
            }

            const token = await userManager.createApiToken(id, tokenOptions);
            return res.status(201).json(new ResponseObject().created(token));
        } catch (err) {
            debug(`Error creating user token: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    userRouter.get('/:id/tokens/:tokenId', async (req, res) => {
        try {
            const { id, tokenId } = req.params;

            // Check if the requested user is the authenticated user or admin
            if (id !== req.user.id && req.user.userType !== 'admin') {
                return res.status(403).json(new ResponseObject().forbidden('Access denied'));
            }

            const token = await userManager.getApiToken(id, tokenId);
            if (!token) {
                return res.status(404).json(new ResponseObject().notFound('Token not found'));
            }

            return res.json(new ResponseObject().success(token));
        } catch (err) {
            debug(`Error getting user token: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    userRouter.put('/:id/tokens/:tokenId', async (req, res) => {
        try {
            const { id, tokenId } = req.params;
            const updates = req.body;

            // Check if the requested user is the authenticated user or admin
            if (id !== req.user.id && req.user.userType !== 'admin') {
                return res.status(403).json(new ResponseObject().forbidden('Access denied'));
            }

            const token = await userManager.updateApiToken(id, tokenId, updates);
            return res.json(new ResponseObject().success(token));
        } catch (err) {
            debug(`Error updating user token: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    userRouter.delete('/:id/tokens/:tokenId', async (req, res) => {
        try {
            const { id, tokenId } = req.params;

            // Check if the requested user is the authenticated user or admin
            if (id !== req.user.id && req.user.userType !== 'admin') {
                return res.status(403).json(new ResponseObject().forbidden('Access denied'));
            }

            const result = await userManager.deleteApiToken(id, tokenId);
            if (!result) {
                return res.status(404).json(new ResponseObject().notFound('Token not found'));
            }

            return res.json(new ResponseObject().success({ success: true }));
        } catch (err) {
            debug(`Error deleting user token: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    userRouter.get('/:id/sessions', async (req, res) => {
        try {
            const { id } = req.params;

            // Check if user exists
            if (!(await userManager.hasUser(id))) {
                return res.status(404).json(new ResponseObject().notFound('User not found'));
            }

            // Check if the requested user is the authenticated user or admin
            if (id !== req.user.id && req.user.userType !== 'admin') {
                return res.status(403).json(new ResponseObject().forbidden('Access denied'));
            }

            const sessions = await sessionManager.listUserSessions(id);
            return res.json(new ResponseObject().success(sessions));
        } catch (err) {
            debug(`Error listing user sessions: ${err.message}`);
            return res.status(500).json(new ResponseObject().serverError(err.message));
        }
    });

    return userRouter;
}
