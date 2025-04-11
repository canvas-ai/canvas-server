/**
 * Admin middleware for WebSocket
 * Checks if the authenticated user is an admin
 */

import { createAdminMiddleware } from '../../common/middleware/admin.js';

export default function adminMiddleware() {
    return createAdminMiddleware({ transport: 'ws' });
}
