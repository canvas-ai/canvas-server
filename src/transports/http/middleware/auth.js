/**
 * Authentication middleware for HTTP API
 */

import createAuthMiddleware from '../../common/middleware/auth.js';

/**
 * Create HTTP auth middleware
 * @param {Object} server - Server instance
 * @returns {Function} - Authentication middleware
 */
export default function(server) {
  return createAuthMiddleware(server);
}