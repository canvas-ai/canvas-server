/**
 * Common Authentication Middleware
 *
 * This middleware handles authentication for all transport layers (HTTP, REST, WS)
 * It verifies the session token and attaches user and session data to the request
 */

import passport from 'passport';
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('transport:auth');

/**
 * Create authentication middleware
 * @param {Object} server - Server instance with access to services
 * @returns {Function} - Authentication middleware function
 */
export default function createAuthMiddleware(server) {
    const authService = server.services.get('auth');
    const userManager = server.userManager;
    const sessionManager = server.sessionManager;

    if (!authService) {
        throw new Error('Auth service is required for authentication middleware');
    }

    if (!userManager) {
        throw new Error('User manager is required for authentication middleware');
    }

    if (!sessionManager) {
        throw new Error('Session manager is required for authentication middleware');
    }

    // Get JWT secret from auth service
    const jwtSecret = authService.sessionService.getJwtSecret();
    if (!jwtSecret) {
        throw new Error('JWT secret is required for authentication middleware');
    }

    /**
     * Authentication middleware
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     * @param {Function} next - Next middleware function
     */
    return async (req, res, next) => {
        debug('Authentication middleware called');

        // Extract token from request
        const authHeader = req.headers?.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.cookies?.token;

        if (!token) {
            debug('No authentication token found');
            req.isAuthenticated = false;
            return next();
        }

        try {
            // First try JWT token
            const jwtPayload = authService.verifyToken(token);
            if (jwtPayload) {
                debug(`JWT token verified for user ID: ${jwtPayload.id}`);

                // Get user from user manager
                const user = await userManager.getUser(jwtPayload.id);
                if (!user) {
                    debug(`User not found for JWT token: ${jwtPayload.id}`);
                    req.isAuthenticated = false;
                    return next();
                }

                // Attach user to request (convert User instance to plain object)
                req.user = user.toJSON();
                req.user.tokenPayload = jwtPayload;
                req.isAuthenticated = true;

                // Get session if available
                if (jwtPayload.sessionId) {
                    const session = await sessionManager.getSession(jwtPayload.sessionId);
                    if (session) {
                        debug(`Session found: ${session.id}`);
                        req.session = session;

                        // Update last active time
                        await sessionManager.touchSession(session.id);
                    }
                }

                debug('JWT authentication successful');
                return next();
            }

            // Then try API token
            const apiTokenResult = await authService.validateApiToken(token);
            if (apiTokenResult) {
                const { userId, tokenId } = apiTokenResult;

                // Get user from user manager
                const user = await userManager.getUser(userId);
                if (!user) {
                    debug(`User not found for API token: ${userId}`);
                    req.isAuthenticated = false;
                    return next();
                }

                // Get token details
                const tokenDetails = await userManager.getApiToken(userId, tokenId);
                if (!tokenDetails) {
                    debug(`Token not found: ${tokenId}`);
                    req.isAuthenticated = false;
                    return next();
                }

                // Attach user and token info to request
                req.user = user.toJSON();
                req.user.tokenId = tokenId;
                req.user.tokenName = tokenDetails.name;
                req.isAuthenticated = true;

                // Update token usage
                try {
                    await userManager.updateApiTokenUsage(userId, tokenId);
                } catch (error) {
                    debug(`Failed to update token usage: ${error.message}`);
                    // Continue even if token usage update fails
                }

                debug('API token authentication successful');
                return next();
            }

            // No valid authentication found
            debug('Invalid authentication token');
            req.isAuthenticated = false;
            next();
        } catch (error) {
            debug(`Authentication error: ${error.message}`);
            req.isAuthenticated = false;
            next();
        }
    };
}
