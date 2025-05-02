/**
 * Authentication middleware for HTTP API
 */

import passport from 'passport';
import { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('transport:http:auth');

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

        // Use both JWT and API token strategies
        passport.authenticate(['jwt', 'api-token'], { session: false }, (err, user, info) => {
            if (err) {
                debug(`Authentication error: ${err.message}`);
                return next(err);
            }

            if (user) {
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
            } else {
                debug('No authenticated user');
                req.isAuthenticated = false;
            }

            next();
        })(req, res, next);
    };
}
