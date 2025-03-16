/**
 * Common Admin middleware
 * Provides admin check functionality for both HTTP and WebSocket transports
 */

import { createDebug } from '@/utils/log/index.js';
const debug = createDebug('middleware:common:admin');

/**
 * Check if a user is an admin
 * @param {Object} user - User object
 * @returns {boolean} - True if user is an admin, false otherwise
 */
export function isAdmin(user) {
    if (!user) {
        return false;
    }
    return user.userType === 'admin';
}

/**
 * Admin middleware factory
 * @param {Object} options - Middleware options
 * @returns {Function} - Middleware function
 */
export function createAdminMiddleware(options = {}) {
    const { transport = 'http' } = options;

    if (transport === 'http') {
        return (req, res, next) => {
            // Check if user exists and is authenticated
            if (!req.user) {
                debug('No authenticated user found');
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Check if user is an admin
            if (!isAdmin(req.user)) {
                debug(`User ${req.user.email} is not an admin`);
                return res.status(403).json({ error: 'Forbidden - Admin access required' });
            }

            debug(`Admin access granted for user ${req.user.email}`);
            next();
        };
    } else if (transport === 'ws') {
        return (socket, next) => {
            // Check if user exists and is authenticated
            if (!socket.user) {
                debug('No authenticated user found');
                return next(new Error('Unauthorized'));
            }

            // Check if user is an admin
            if (!isAdmin(socket.user)) {
                debug(`User ${socket.user.email} is not an admin`);
                return next(new Error('Forbidden - Admin access required'));
            }

            debug(`Admin access granted for user ${socket.user.email}`);
            next();
        };
    } else {
        throw new Error(`Unsupported transport: ${transport}`);
    }
}

export default createAdminMiddleware;
