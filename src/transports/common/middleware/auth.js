/**
 * Common Authentication Middleware
 *
 * This middleware handles authentication for all transport layers (HTTP, REST, WS)
 * It verifies tokens and attaches user data to the request
 */

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

    if (!authService) {
        throw new Error('Auth service is required for authentication middleware');
    }

    if (!userManager) {
        throw new Error('User manager is required for authentication middleware');
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
        let token = null;

        // Check Authorization header
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        // Check cookies
        else if (req.cookies?.token) {
            token = req.cookies.token;
        }
        // Check query parameters
        else if (req.query?.token) {
            token = req.query.token;
        }

        if (!token) {
            debug('No authentication token found');
            req.isAuthenticated = false;
            return next();
        }

        try {
            // Try API token authentication
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
                const tokenDetails = await authService.getToken(tokenId);
                if (!tokenDetails) {
                    debug(`Token not found: ${tokenId}`);
                    req.isAuthenticated = false;
                    return next();
                }

                // Attach user and token info to request
                req.user = user.toJSON ? user.toJSON() : user;
                req.user.tokenId = tokenId;
                req.user.tokenName = tokenDetails.name;
                req.user.type = 'api';
                req.isAuthenticated = true;

                // No need to update token usage as validateApiToken already did this

                debug('API token authentication successful');
                return next();
            }

            // Try JWT fallback (for backwards compatibility)
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

                // Attach user to request
                req.user = user.toJSON ? user.toJSON() : user;
                req.user.tokenPayload = jwtPayload;
                req.user.type = 'jwt';
                req.isAuthenticated = true;

                // Get session if available
                if (authService.sessionManager && jwtPayload.sessionId) {
                    const session = await authService.sessionManager.getSession(jwtPayload.sessionId);
                    if (session) {
                        debug(`Session found: ${session.id}`);
                        req.session = session;

                        // Update last active time
                        await authService.sessionManager.touchSession(session.id);
                    }
                }

                debug('JWT authentication successful');
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
