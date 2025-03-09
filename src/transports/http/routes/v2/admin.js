import express from 'express';
const router = express.Router();

import ResponseObject from '../../../ResponseObject.js';
import adminMiddleware from '../../middleware/admin.js';
import authMiddleware from '../../middleware/auth.js';

import debugInstance from 'debug';
const debug = debugInstance('canvas:transport:http:routes:v2:admin');

export default function(authService) {
    // Apply auth and admin middleware to all routes
    router.use(authMiddleware());
    router.use(adminMiddleware());

    // Get all users (admin only)
    router.get('/users', async (req, res) => {
        try {
            const users = await req.app.locals.userManager.getAllUsers();
            const response = new ResponseObject().success(users, 'Users retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // Get a specific user
    router.get('/users/:userId', async (req, res) => {
        const { userId } = req.params;

        try {
            const user = await req.app.locals.userManager.getUserById(userId);
            if (!user) {
                const response = new ResponseObject().notFound(`User with ID ${userId} not found`);
                return res.status(response.statusCode).json(response.getResponse());
            }

            const response = new ResponseObject().success(user, 'User retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // Update a user
    router.put('/users/:userId', async (req, res) => {
        const { userId } = req.params;
        const userData = req.body;

        try {
            const updatedUser = await authService.updateUser(userId, userData, req.user);
            const response = new ResponseObject().success(updatedUser, 'User updated successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // Update a user's password (admin only)
    router.put('/users/:userId/password', async (req, res) => {
        const { userId } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            const response = new ResponseObject().badRequest('New password is required');
            return res.status(response.statusCode).json(response.getResponse());
        }

        try {
            const updatedUser = await authService.updatePassword(userId, null, newPassword, req.user);
            const response = new ResponseObject().success({ success: true }, 'Password updated successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    return router;
}
