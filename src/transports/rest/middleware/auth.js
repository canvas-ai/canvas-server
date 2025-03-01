/**
 * Authentication middleware for REST API
 */

import createAuthMiddleware from '../../common/middleware/auth.js';

/**
 * Create REST auth middleware
 * @param {Object} server - Server instance
 * @returns {Function} - Authentication middleware
 */
export default function(server) {
  return createAuthMiddleware(server);
}