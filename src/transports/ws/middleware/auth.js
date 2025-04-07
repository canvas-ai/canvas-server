/**
 * Authentication middleware for WebSocket API
 */

import createAuthMiddleware from '../../common/middleware/auth.js';
import logger, { createDebug } from '../../../utils/log/index.js';
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
            debug(`Starting WebSocket authentication for socket: ${socket.id}`);

            // Check if the socket handshake has auth data with a token
            if (socket.handshake.auth && socket.handshake.auth.token) {
                debug(`Found auth token in socket handshake`);
                // Add the token to the headers
                socket.handshake.headers.authorization = `Bearer ${socket.handshake.auth.token}`;
            } else {
                debug(`No auth token found in socket handshake`);
            }

            // Create mock request object with headers from socket handshake
            const mockReq = {
                headers: socket.handshake.headers,
                cookies: socket.handshake.cookies || {},
            };

            // Create mock response object
            const mockRes = {};

            // Log the headers for debugging
            debug(`Socket authentication headers: ${JSON.stringify(mockReq.headers)}`);

            // Run the common auth middleware
            await commonAuthMiddleware(mockReq, mockRes, (err) => {
                if (err) {
                    debug(`Authentication middleware error: ${err.message}`);
                    return next(err);
                }

                // Attach auth data to socket
                socket.isAuthenticated = mockReq.isAuthenticated;
                socket.user = mockReq.user;
                socket.session = mockReq.session;

                debug(`WebSocket authenticated: ${socket.isAuthenticated ? 'Yes' : 'No'}`);

                // Log user info if available
                if (socket.user) {
                    debug(`Authenticated user: ${socket.user.email || socket.user.id}`);
                    debug(`User data: ${JSON.stringify(socket.user)}`);
                } else {
                    debug('No user data available after authentication');
                }

                // Ensure we have a valid user attached
                if (!socket.user || !socket.user.id) {
                    debug('Auth middleware succeeded but no valid user found in socket');
                    return next(new Error('Authentication failed: Valid user not found'));
                }

                debug(`WebSocket authentication successful for user: ${socket.user.id}`);
                next();
            });
        } catch (error) {
            debug(`WebSocket authentication error: ${error.message}`);
            debug(`Error stack: ${error.stack}`);
            socket.isAuthenticated = false;
            next(error);
        }
    };
}
