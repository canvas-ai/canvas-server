/**
 * Common Authentication Middleware
 *
 * This middleware handles authentication for all transport layers (HTTP, REST, WS)
 * It verifies the session token and attaches user and session data to the request
 */

import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('transport:auth');

/**
 * Create authentication middleware
 * @param {Object} server - Server instance with access to services
 * @returns {Function} - Authentication middleware function
 */
export default function createAuthMiddleware(server) {
  /**
   * Authentication middleware
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  return async (req, res, next) => {
    // Get the session token from the Authorization header or cookie
    const sessionToken = req.headers.authorization?.replace('Bearer ', '') ||
                         req.cookies?.sessionToken;

    if (!sessionToken) {
      // For public routes, just continue
      req.isAuthenticated = false;
      return next();
    }

    try {
      // Verify the session using auth service
      const authService = server.services.get('auth');
      const sessionData = await authService.verifySession(sessionToken);

      if (!sessionData) {
        req.isAuthenticated = false;
        return next();
      }

      // Attach session and user data to request
      req.session = sessionData.session;
      req.user = sessionData.user;
      req.isAuthenticated = true;

      next();
    } catch (error) {
      debug(`Authentication error: ${error.message}`);
      req.isAuthenticated = false;
      next();
    }
  };
}