/**
 * User Managers Middleware
 *
 * This middleware ensures that user-based managers (workspaceManager, contextManager)
 * are properly initialized and available for routes that need them.
 */

import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('http:middleware:user-managers');
import ResponseObject from '../../ResponseObject.js';

/**
 * Create middleware to ensure user managers are available
 * @param {Object} options - Options
 * @param {Object} options.userManager - User manager instance
 * @returns {Function} - Middleware function
 */
export function createUserManagersMiddleware(options = {}) {
    const { userManager } = options;

    if (!userManager) {
        throw new Error('User manager is required for user managers middleware');
    }

    return async (req, res, next) => {
        try {
            // Skip if no authenticated user
            if (!req.isAuthenticated || !req.user || !req.user.id) {
                debug('No authenticated user, skipping user managers initialization');
                return next();
            }

            const userId = req.user.id;
            debug(`Ensuring user managers for user: ${userId}`);

            // Get user from user manager
            let user;
            try {
                user = await userManager.getUserById(userId);
                if (!user) {
                    debug(`User not found: ${userId}`);
                    return res.status(404).json(new ResponseObject().notFound('User not found'));
                }
            } catch (error) {
                debug(`Error getting user: ${error.message}`);
                return res.status(500).json(new ResponseObject().serverError(`Error getting user: ${error.message}`));
            }

            // Check if user is active
            if (user.status !== 'active') {
                debug(`Activating user: ${userId}`);
                try {
                    await user.activate();
                    debug(`User activated: ${userId}`);
                } catch (error) {
                    debug(`Error activating user: ${error.message}`);
                    return res.status(500).json(new ResponseObject().serverError(`Error activating user: ${error.message}`));
                }
            }

            // Attach user managers to request
            req.userInstance = user;

            // Check if workspaceManager is available
            if (user.workspaceManager) {
                req.workspaceManager = user.workspaceManager;
                debug(`Workspace manager attached to request for user: ${userId}`);
            } else {
                debug(`Workspace manager not available for user: ${userId}`);
            }

            // Check if contextManager is available
            if (user.contextManager) {
                req.contextManager = user.contextManager;
                debug(`Context manager attached to request for user: ${userId}`);
            } else {
                debug(`Context manager not available for user: ${userId}`);
            }

            debug(`User managers attached to request for user: ${userId}`);
            next();
        } catch (error) {
            debug(`Unexpected error in user managers middleware: ${error.message}`);
            return res.status(500).json(new ResponseObject().serverError(`Server error: ${error.message}`));
        }
    };
}

/**
 * Create middleware to ensure workspace manager is available
 * @param {Object} options - Options
 * @param {Object} options.userManager - User manager instance
 * @returns {Function} - Middleware function
 */
export function requireWorkspaceManager(options = {}) {
    const middleware = createUserManagersMiddleware(options);

    return async (req, res, next) => {
        await middleware(req, res, async (err) => {
            if (err) {
                return next(err);
            }

            if (!req.workspaceManager) {
                debug('Workspace manager not available');

                // Check if the user instance is available
                if (req.userInstance) {
                    debug('Attempting to initialize workspace manager for user');

                    // Try to initialize the workspace manager
                    try {
                        if (req.userInstance.initializeWorkspaceManager) {
                            await req.userInstance.initializeWorkspaceManager();

                            // Check if initialization was successful
                            if (req.userInstance.workspaceManager) {
                                req.workspaceManager = req.userInstance.workspaceManager;
                                debug('Workspace manager initialized successfully');
                                return next();
                            }
                        }
                    } catch (error) {
                        debug(`Error initializing workspace manager: ${error.message}`);
                    }
                }

                return res.status(500).json(new ResponseObject().serverError('Workspace manager not available'));
            }

            next();
        });
    };
}

/**
 * Create middleware to ensure context manager is available
 * @param {Object} options - Options
 * @param {Object} options.userManager - User manager instance
 * @returns {Function} - Middleware function
 */
export function requireContextManager(options = {}) {
    const middleware = createUserManagersMiddleware(options);

    return async (req, res, next) => {
        await middleware(req, res, async (err) => {
            if (err) {
                return next(err);
            }

            if (!req.contextManager) {
                debug('Context manager not available');

                // Check if the user instance is available
                if (req.userInstance) {
                    debug('Attempting to initialize context manager for user');

                    // Try to initialize the context manager
                    try {
                        if (req.userInstance.initializeContextManager) {
                            await req.userInstance.initializeContextManager();

                            // Check if initialization was successful
                            if (req.userInstance.contextManager) {
                                req.contextManager = req.userInstance.contextManager;
                                debug('Context manager initialized successfully');
                                return next();
                            }
                        }
                    } catch (error) {
                        debug(`Error initializing context manager: ${error.message}`);
                    }
                }

                return res.status(500).json(new ResponseObject().serverError('Context manager not available'));
            }

            next();
        });
    };
}

/**
 * Create middleware to ensure both workspace and context managers are available
 * @param {Object} options - Options
 * @param {Object} options.userManager - User manager instance
 * @returns {Function} - Middleware function
 */
export function requireAllManagers(options = {}) {
    // Use the individual middlewares in sequence
    const workspaceMiddleware = requireWorkspaceManager(options);
    const contextMiddleware = requireContextManager(options);

    return async (req, res, next) => {
        // First ensure workspace manager is available
        await workspaceMiddleware(req, res, (err) => {
            if (err) {
                return next(err);
            }

            // Then ensure context manager is available
            contextMiddleware(req, res, next);
        });
    };
}
