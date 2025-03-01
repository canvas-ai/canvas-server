/**
 * Authentication middleware for REST API
 */

import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('transport:rest:auth');

export default function(server) {
  /**
   * Authentication middleware
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