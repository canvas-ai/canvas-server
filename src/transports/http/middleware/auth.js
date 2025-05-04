/**
 * Authentication middleware for HTTP API
 */

import passport from 'passport';
import { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('canvas:auth:http');

/**
 * Create HTTP auth middleware
 * @param {Object} server - Server instance
 * @returns {Function} - Authentication middleware
 */
export default function (server) {
    debug('Creating HTTP authentication middleware');

    // Return a middleware function that uses passport for authentication
    return (req, res, next) => {
        debug('HTTP auth middleware called');
        debug('Request headers:', req.headers);
        debug('Request cookies:', req.cookies);
        debug('Request path:', req.path);
        debug('Request method:', req.method);

        // Use both JWT and API token strategies
        passport.authenticate(['jwt', 'api-token'], { session: false }, (err, user, info) => {
            if (err) {
                debug(`Authentication error: ${err.message}`);
                debug('Error details:', err);
                return next(err);
            }

            if (user) {
                debug(`User authenticated: ${user.email}, token type: ${user.type}`);
                debug('User details:', { id: user.id, email: user.email, type: user.type });
                req.user = user;
                req.isAuthenticated = true;

                // Add session if available for JWT tokens
                if (user.type === 'jwt' && user.sessionId && server.sessionManager) {
                    debug(`Attempting to get session for user ${user.id}, session ${user.sessionId}`);
                    server.sessionManager
                        .getSession(user.sessionId)
                        .then((session) => {
                            if (session) {
                                debug(`Session found for user ${user.id}:`, session);
                                req.session = session;
                                // Touch session to update last active time
                                server.sessionManager
                                    .touchSession(session.id)
                                    .catch((err) => debug(`Error touching session: ${err.message}`));
                            } else {
                                debug(`No session found for user ${user.id}, session ID ${user.sessionId}`);
                            }
                        })
                        .catch((err) => debug(`Error getting session: ${err.message}, stack: ${err.stack}`));
                }
            } else {
                debug('No authenticated user');
                debug('Authentication info:', info);
                req.isAuthenticated = false;
            }

            next();
        })(req, res, next);
    };
}
