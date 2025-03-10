/**
 * Common Authentication Middleware
 *
 * This middleware handles authentication for all transport layers (HTTP, REST, WS)
 * It verifies the session token and attaches user and session data to the request
 */

import passport from 'passport';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('canvas:transport:auth');

/**
 * Create authentication middleware
 * @param {Object} server - Server instance with access to services
 * @returns {Function} - Authentication middleware function
 */
export default function createAuthMiddleware(server) {
  const authService = server.services.get('auth');

  /**
   * Authentication middleware
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  return async (req, res, next) => {
    debug('Authentication middleware called');

    // Try JWT authentication first
    passport.authenticate(['jwt', 'api-token'], { session: false }, async (err, user, info) => {
      if (err) {
        debug(`Authentication error: ${err.message}`);
        req.isAuthenticated = false;
        return next(err);
      }

      if (!user) {
        debug('No authenticated user found');
        req.isAuthenticated = false;
        return next();
      }

      try {
        debug(`User authenticated: ${user.email}`);

        // Get session data if needed
        if (user.tokenPayload && user.tokenPayload.sessionId) {
          const sessionManager = server.services.get('session');
          const session = await sessionManager.getSession(user.tokenPayload.sessionId);

          if (session) {
            debug(`Session found: ${session.id}`);
            req.session = session;

            // Update last active time
            await sessionManager.touchSession(session.id);
          }
        }

        // Attach user to request
        req.user = user;
        req.isAuthenticated = true;

        debug('Authentication successful');
        next();
      } catch (error) {
        debug(`Error processing authenticated user: ${error.message}`);
        req.isAuthenticated = false;
        next();
      }
    })(req, res, next);
  };
}
