/**
 * Common Authentication Middleware
 *
 * This middleware handles authentication for all transport layers (HTTP, REST, WS)
 * It verifies tokens and attaches user data to the request
 */

import passport from 'passport';
import { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('transport:auth');

/**
 * Create authentication middleware
 * @param {Object} server - Server instance
 * @returns {Function} - Authentication middleware
 */
export default function createAuthMiddleware(server) {
    debug('Creating authentication middleware');

    return (req, res, next) => {
        debug('Authentication middleware called');

        // Try API token first, then JWT as fallback
        passport.authenticate(['api-token', 'jwt'], { session: false }, (err, user, info) => {
            if (err) {
                debug(`Authentication error: ${err.message}`);
                return next(err);
            }

            if (!user) {
                debug('No authenticated user');
                req.isAuthenticated = false;
                return next();
            }

            debug(`User authenticated: ${user.email}, token type: ${user.type}`);
            req.user = user;
            req.isAuthenticated = true;

            // Add session if available for JWT tokens
            if (user.type === 'jwt' && user.sessionId && server.sessionManager) {
                server.sessionManager
                    .getSession(user.sessionId)
                    .then((session) => {
                        if (session) {
                            req.session = session;
                            // Touch session to update last active time
                            server.sessionManager
                                .touchSession(session.id)
                                .catch((err) => debug(`Error touching session: ${err.message}`));
                        }
                    })
                    .catch((err) => debug(`Error getting session: ${err.message}`));
            }

            next();
        })(req, res, next);
    };
}
