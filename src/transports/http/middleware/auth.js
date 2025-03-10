/**
 * Authentication middleware for HTTP API
 */

import passport from 'passport';
import { createDebug } from '@/utils/log/index.js';
const debug = createDebug('canvas:transport:http:middleware:auth');

/**
 * Create HTTP auth middleware
 * @param {Object} server - Server instance
 * @returns {Function} - Authentication middleware
 */
export default function(server) {
  debug('Creating HTTP authentication middleware');

  // Return a middleware function that uses passport for authentication
  return (req, res, next) => {
    debug('HTTP auth middleware called');

    // Try JWT and API token authentication
    passport.authenticate(['jwt', 'api-token'], { session: false }, (err, user, info) => {
      if (err) {
        debug(`Authentication error: ${err.message}`);
        return next(err);
      }

      if (user) {
        debug(`User authenticated: ${user.email}`);
        req.user = user;
        req.isAuthenticated = true;
      } else {
        debug('No authenticated user');
        req.isAuthenticated = false;
      }

      next();
    })(req, res, next);
  };
}
