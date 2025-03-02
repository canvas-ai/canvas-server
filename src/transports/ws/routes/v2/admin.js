import { createDebug } from '@/utils/log/index.js';
const debug = createDebug('canvas:transport:ws:routes:v2:admin');

export default async function(io, authService) {
    const adminNamespace = io.of('/v2/admin');

    // Apply admin middleware
    const adminMiddleware = (await import('../../middleware/admin.js')).default();
    adminNamespace.use(adminMiddleware);

    adminNamespace.on('connection', (socket) => {
        debug(`Admin socket connected: ${socket.id}`);

        // Get all users
        socket.on('users:list', async (data, callback) => {
            try {
                const users = await socket.request.app.locals.userManager.getAllUsers();
                callback({ success: true, data: users });
            } catch (error) {
                debug(`Error getting users: ${error.message}`);
                callback({ success: false, error: error.message });
            }
        });

        // Get a specific user
        socket.on('users:get', async (data, callback) => {
            try {
                const { userId } = data;
                if (!userId) {
                    throw new Error('User ID is required');
                }

                const user = await socket.request.app.locals.userManager.getUserById(userId);
                if (!user) {
                    throw new Error(`User with ID ${userId} not found`);
                }

                callback({ success: true, data: user });
            } catch (error) {
                debug(`Error getting user: ${error.message}`);
                callback({ success: false, error: error.message });
            }
        });

        // Update a user
        socket.on('users:update', async (data, callback) => {
            try {
                const { userId, userData } = data;
                if (!userId) {
                    throw new Error('User ID is required');
                }
                if (!userData) {
                    throw new Error('User data is required');
                }

                const updatedUser = await authService.updateUser(userId, userData, socket.user);
                callback({ success: true, data: updatedUser });
            } catch (error) {
                debug(`Error updating user: ${error.message}`);
                callback({ success: false, error: error.message });
            }
        });

        // Update a user's password
        socket.on('users:updatePassword', async (data, callback) => {
            try {
                const { userId, newPassword } = data;
                if (!userId) {
                    throw new Error('User ID is required');
                }
                if (!newPassword) {
                    throw new Error('New password is required');
                }

                await authService.updatePassword(userId, null, newPassword, socket.user);
                callback({ success: true, message: 'Password updated successfully' });
            } catch (error) {
                debug(`Error updating password: ${error.message}`);
                callback({ success: false, error: error.message });
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            debug(`Admin socket disconnected: ${socket.id}`);
        });
    });

    return adminNamespace;
}
