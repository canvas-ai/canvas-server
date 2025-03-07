import express from 'express';
const router = express.Router();

import ResponseObject from '../../../ResponseObject.js';

import debugInstance from 'debug';
const debug = debugInstance('canvas:transport:http:routes:v2:auth');

export default function(authService) {
    // Register new user
    router.post('/register', async (req, res) => {
        const { email, password } = req.body;
        try {
            const { user, token } = await authService.register(email, password);
            authService.sessionService.setCookie(res, token);
            const response = new ResponseObject().created({ token }, 'User registered successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            const response = new ResponseObject().conflict(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // Login user
    router.post('/login', async (req, res) => {
        const { email, password } = req.body;
        try {
            const { user, token } = await authService.login(email, password);
            authService.sessionService.setCookie(res, token);
            const response = new ResponseObject().success({ token }, 'Login successful');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            const response = new ResponseObject().unauthorized(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // Logout user
    router.post('/logout', (req, res) => {
        authService.logout(res);
        const response = new ResponseObject().success(null, 'Logged out successfully');
        res.status(response.statusCode).json(response.getResponse());
    });

    // Update password (requires authentication)
    router.put('/password', authService.getAuthMiddleware(), async (req, res) => {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            const response = new ResponseObject().badRequest('Current password and new password are required');
            return res.status(response.statusCode).json(response.getResponse());
        }

        try {
            const user = await authService.getUserFromRequest(req);
            if (!user) {
                const response = new ResponseObject().unauthorized('User not authenticated');
                return res.status(response.statusCode).json(response.getResponse());
            }

            await authService.updatePassword(user.id, currentPassword, newPassword, user);
            const response = new ResponseObject().success({ success: true }, 'Password updated successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // API Token Management Routes

    // List all auth tokens
    router.get('/tokens', async (req, res) => {
        try {
            if (!req.user || !req.user.id) {
                const response = new ResponseObject().unauthorized('User not authenticated');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const tokens = await authService.listAuthTokens(req.user.id);
            const response = new ResponseObject().success(tokens, 'Auth tokens retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // Generate a new auth token
    router.post('/tokens', async (req, res) => {
        const { name, expiresInDays } = req.body;

        try {
            if (!req.user || !req.user.id) {
                const response = new ResponseObject().unauthorized('User not authenticated');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const { token, tokenValue } = await authService.generateAuthToken(
                req.user.id,
                name || 'API Token',
                expiresInDays || null
            );

            const response = new ResponseObject().created(
                { token, value: tokenValue },
                'Auth token generated successfully'
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // Revoke an auth token
    router.delete('/tokens/:tokenId', async (req, res) => {
        const { tokenId } = req.params;

        try {
            if (!req.user || !req.user.id) {
                const response = new ResponseObject().unauthorized('User not authenticated');
                return res.status(response.statusCode).json(response.getResponse());
            }

            await authService.revokeAuthToken(req.user.id, tokenId);
            const response = new ResponseObject().success(null, 'Auth token revoked successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    return router;
}
