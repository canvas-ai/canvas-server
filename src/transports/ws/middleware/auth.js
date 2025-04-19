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
    const authService = server.services.get('auth');

    if (!authService) {
        throw new Error('Auth service not available for WebSocket middleware');
    }

    /**
     * WebSocket authentication middleware
     * Adapts the common auth middleware for WebSocket connections
     * @param {Object} socket - WebSocket socket
     * @param {Function} next - Next middleware function
     */
    return async (socket, next) => {
        try {
            debug(`Starting WebSocket authentication for socket: ${socket.id}`);

            let token = null;

            // Get token from different places
            // First try auth token in handshake
            if (socket.handshake.auth && socket.handshake.auth.token) {
                token = socket.handshake.auth.token;
                debug(`Found auth token in socket handshake auth object`);
            }
            // Try query parameter
            else if (socket.handshake.query && socket.handshake.query.token) {
                token = socket.handshake.query.token;
                debug(`Found auth token in socket handshake query parameters`);
            }
            // Finally try authorization header
            else if (socket.handshake.headers && socket.handshake.headers.authorization) {
                const authHeader = socket.handshake.headers.authorization;
                if (authHeader.startsWith('Bearer ')) {
                    token = authHeader.substring(7);
                    debug(`Found auth token in Authorization header`);
                }
            }

            if (!token) {
                debug(`No authentication token found in socket connection`);
                return next(new Error('Authentication required'));
            }

            // Set the token in proper format if found
            socket.handshake.headers.authorization = `Bearer ${token}`;

            // Log details about the token for debugging
            debug(`Using token: ${token.substring(0, 10)}...`);

            // Create mock request object with headers from socket handshake
            const mockReq = {
                headers: socket.handshake.headers,
                cookies: socket.handshake.cookies || {},
                query: socket.handshake.query || {},
            };

            // Create mock response object
            const mockRes = {};

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

                // If authentication failed but we have a token, try direct API token validation
                if (!socket.isAuthenticated && token) {
                    debug(`Standard auth failed, trying direct API token validation`);

                    // Try validating the token directly
                    authService.validateApiToken(token)
                        .then(result => {
                            if (result && result.userId) {
                                debug(`API token validated for user ${result.userId}`);

                                // Get the user and attach to socket
                                return server.userManager.getUser(result.userId)
                                    .then(user => {
                                        if (user) {
                                            socket.user = user.toJSON ? user.toJSON() : user;
                                            socket.user.tokenId = result.tokenId;
                                            socket.user.type = 'api';
                                            socket.isAuthenticated = true;

                                            debug(`User attached to socket: ${socket.user.email || socket.user.id}`);
                                            next();
                                        } else {
                                            debug(`User ${result.userId} not found after token validation`);
                                            next(new Error('User not found'));
                                        }
                                    });
                            } else {
                                debug(`API token validation failed`);
                                next(new Error('Invalid token'));
                            }
                        })
                        .catch(error => {
                            debug(`Error in direct token validation: ${error.message}`);
                            next(error);
                        });

                    return; // Stop here since we're handling auth asynchronously
                }

                // If we're already authenticated, proceed with attached user
                if (socket.isAuthenticated && socket.user) {
                    debug(`Authenticated user: ${socket.user.email || socket.user.id}`);
                    next();
                } else {
                    debug('Authentication required but no valid user found');
                    next(new Error('Authentication failed'));
                }
            });
        } catch (error) {
            debug(`WebSocket authentication error: ${error.message}`);
            debug(`Error stack: ${error.stack}`);
            socket.isAuthenticated = false;
            next(error);
        }
    };
}
