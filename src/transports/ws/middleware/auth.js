/**
 * Authentication middleware for WebSocket API
 */

import createAuthMiddleware from '../../common/middleware/auth.js';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('transport:ws:auth');

/**
 * Create WebSocket auth middleware
 * @param {Object} server - Server instance
 * @returns {Function} - Authentication middleware for WebSocket connections
 */
export default function (server) {
    const commonAuthMiddleware = createAuthMiddleware(server);

    /**
     * WebSocket authentication middleware
     * Adapts the common auth middleware for WebSocket connections
     * @param {Object} socket - WebSocket socket
     * @param {Function} next - Next middleware function
     */
    return async (socket, next) => {
        try {
            // Create mock request object with headers from socket handshake
            const mockReq = {
                headers: socket.handshake.headers,
                cookies: socket.handshake.cookies || {},
            };

            // Create mock response object
            const mockRes = {};

            // Run the common auth middleware
            await commonAuthMiddleware(mockReq, mockRes, (err) => {
                if (err) {
                    debug(`Authentication error: ${err.message}`);
                    return next(err);
                }

                // Attach auth data to socket
                socket.isAuthenticated = mockReq.isAuthenticated;
                socket.user = mockReq.user;
                socket.session = mockReq.session;

                debug(`WebSocket authenticated: ${socket.isAuthenticated ? 'Yes' : 'No'}`);
                if (socket.user) {
                    debug(`WebSocket user: ${socket.user.email || socket.user.id}`);
                }

                next();
            });
        } catch (error) {
            debug(`WebSocket authentication error: ${error.message}`);
            socket.isAuthenticated = false;
            next(error);
        }
    };
}
