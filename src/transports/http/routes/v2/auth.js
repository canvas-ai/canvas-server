import express from 'express';
import passport from 'passport';
import validator from 'validator';

import logger, { createDebug } from '../../../../utils/log/index.js';
import ResponseObject from '../../../ResponseObject.js';
const debug = createDebug('http:routes:auth');

const router = express.Router();

/**
 * Validate email and password
 * @param {string} email - Email to validate
 * @param {string} password - Password to validate
 * @returns {Object} - Validation result
 */
function validateCredentials(email, password) {
    const errors = {};

    if (!email || !validator.isEmail(email)) {
        errors.email = 'Valid email is required';
    }

    if (!password || password.length < 8) {
        errors.password = 'Password must be at least 8 characters long';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}

export default function (authService) {
    if (!authService) {
        throw new Error('Auth service is required');
    }

    if (!authService.sessionService) {
        throw new Error('Auth service sessionService is required');
    }

    // ===== User Authentication Routes =====

    router.post('/register', async (req, res) => {
        const { email, password } = req.body;
        debug(`Registration attempt for email: ${email}`);

        // Validate credentials
        const validation = validateCredentials(email, password);
        if (!validation.isValid) {
            debug(`Registration validation failed: ${JSON.stringify(validation.errors)}`);
            const response = new ResponseObject().badRequest('Invalid credentials', validation.errors);
            return res.status(response.statusCode).json(response.getResponse());
        }

        try {
            // Attempt registration
            const result = await authService.register(email, password, 'user');
            debug(`Registration successful for user: ${email}`);

            // Set JWT token as cookie
            authService.sessionService.setCookie(res, result.token, {
                secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
                sameSite: 'lax',
            });

            // Return success response with user data
            const response = new ResponseObject().created(
                {
                    user: {
                        id: result.user.id,
                        email: result.user.email,
                        userType: result.user.userType,
                        status: result.user.status,
                    },
                    token: result.token,
                    session: result.session,
                },
                'Registration successful',
            );

            return res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Registration failed: ${error.message}`);

            // Check for duplicate email
            if (error.message.includes('already exists')) {
                const response = new ResponseObject().conflict('Email already registered');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const response = new ResponseObject().error(error.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/login', async (req, res) => {
        const { email, password } = req.body;
        debug(`Login attempt for email: ${email}`);

        // Validate credentials
        const validation = validateCredentials(email, password);
        if (!validation.isValid) {
            debug(`Login validation failed: ${JSON.stringify(validation.errors)}`);
            const response = new ResponseObject().badRequest('Invalid credentials', validation.errors);
            return res.status(response.statusCode).json(response.getResponse());
        }

        try {
            // Attempt login
            const result = await authService.login(email, password);
            debug(`Login successful for user: ${email}`);

            // Set JWT token as cookie
            authService.sessionService.setCookie(res, result.token, {
                secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
                sameSite: 'lax',
            });

            // Return success response with user data
            const response = new ResponseObject().success(
                {
                    user: {
                        id: result.user.id,
                        email: result.user.email,
                        userType: result.user.userType,
                        status: result.user.status,
                    },
                    token: result.token,
                    session: result.session,
                },
                'Login successful',
            );

            return res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Login failed: ${error.message}`);
            const response = new ResponseObject().unauthorized(error.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/logout', async (req, res) => {
        debug('Logout endpoint called');

        try {
            // Clear the auth cookie
            authService.sessionService.clearCookie(res);

            // If user is authenticated, invalidate the session
            if (req.isAuthenticated && req.user && req.session) {
                debug(`Invalidating session for user: ${req.user.email || req.user.id}`);
                await authService.sessionManager.invalidateSession(req.session.id);
            }

            const response = new ResponseObject().success(null, 'Logout successful');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Logout error: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get('/me', passport.authenticate('api-token', { session: false }), (req, res) => {
        debug('Get current user endpoint called');

        const userData = {
            id: req.user.id,
            email: req.user.email,
            userType: req.user.userType,
            status: req.user.status,
            tokenType: req.user.type,
            tokenId: req.user.tokenId, // Will be present if authenticated with API token
        };

        const response = new ResponseObject().success(userData, 'User information retrieved successfully');

        res.status(response.statusCode).json(response.getResponse());
    });

    router.put('/password', passport.authenticate('api-token', { session: false }), async (req, res) => {
        debug('Update password endpoint called');
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            debug('Update password validation failed: Missing required fields');
            const response = new ResponseObject().badRequest('Current password and new password are required');
            return res.status(response.statusCode).json(response.getResponse());
        }

        if (newPassword.length < 8) {
            debug('Update password validation failed: New password too short');
            const response = new ResponseObject().badRequest('New password must be at least 8 characters long');
            return res.status(response.statusCode).json(response.getResponse());
        }

        try {
            await authService.updatePassword(req.user.id, currentPassword, newPassword, req.user);

            debug(`Password updated successfully for user: ${req.user.email}`);
            const response = new ResponseObject().success({ success: true }, 'Password updated successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Password update error: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    // ===== API Token Management Routes =====

    router.get('/tokens', passport.authenticate('api-token', { session: false }), async (req, res) => {
        debug('List tokens endpoint called');

        try {
            const tokens = await authService.listApiTokens(req.user.id);

            debug(`Retrieved ${tokens.length} tokens for user: ${req.user.email}`);
            const response = new ResponseObject().success(
                {
                    tokens,
                    total: tokens.length,
                },
                'API tokens retrieved successfully',
            );

            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`List tokens error: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/tokens', passport.authenticate('api-token', { session: false }), async (req, res) => {
        debug('Generate token endpoint called');
        const { name, description, expiresAt } = req.body;

        // Validate input
        if (!name) {
            debug('Generate token validation failed: Missing token name');
            const response = new ResponseObject().badRequest('Token name is required');
            return res.status(response.statusCode).json(response.getResponse());
        }

        if (
            name &&
            (!validator.isLength(name, { min: 1, max: 100 }) || !validator.isAlphanumeric(name, 'en-US', { ignore: ' -_' }))
        ) {
            debug('Generate token validation failed: Invalid token name');
            const response = new ResponseObject().badRequest(
                'Token name must be 1-100 alphanumeric characters, spaces, hyphens, or underscores',
            );
            return res.status(response.statusCode).json(response.getResponse());
        }

        try {
            const tokenOptions = {
                name,
                description: description || `API Token for ${req.user.email}`,
                expiresAt: expiresAt || null,
            };

            const token = await authService.createApiToken(req.user.id, tokenOptions);

            debug(`Generated new API token for user: ${req.user.email}, name: ${token.name}`);
            const response = new ResponseObject().created(token, 'API token generated successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Generate token error: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.delete('/tokens/:tokenId', passport.authenticate('api-token', { session: false }), async (req, res) => {
        const { tokenId } = req.params;
        debug(`Revoke token endpoint called for token ID: ${tokenId}`);

        try {
            const result = await authService.deleteApiToken(req.user.id, tokenId);

            if (!result) {
                const response = new ResponseObject().notFound('API token not found');
                return res.status(response.statusCode).json(response.getResponse());
            }

            debug(`API token revoked successfully: ${tokenId}`);
            const response = new ResponseObject().success({ success: true }, 'API token revoked successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Revoke token error: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/token/verify', async (req, res) => {
        const { token } = req.body;
        debug('Token verify endpoint called');

        if (!token) {
            debug('Token verify failed: No token provided');
            const response = new ResponseObject().badRequest('Token is required');
            return res.status(response.statusCode).json(response.getResponse());
        }

        try {
            // Validate as API token (preferred)
            const apiTokenResult = await authService.validateApiToken(token);
            if (apiTokenResult) {
                const { userId, tokenId } = apiTokenResult;

                try {
                    // Get user and token details
                    const userManager = req.app.get('userManager');
                    const user = await userManager.getUserById(userId);
                    const tokenDetails = await userManager.getApiToken(userId, tokenId);

                    if (user && tokenDetails) {
                        debug('API token verified successfully');
                        const response = new ResponseObject().success(
                            {
                                valid: true,
                                type: 'api',
                                userId: userId,
                                tokenId: tokenId,
                                tokenName: tokenDetails.name,
                            },
                            'Token is valid',
                        );
                        return res.status(response.statusCode).json(response.getResponse());
                    }
                } catch (error) {
                    debug(`Error getting user or token details: ${error.message}`);
                    // Continue to try JWT token
                }
            }

            // Try as JWT token (legacy support)
            const jwtPayload = authService.verifyToken(token);
            if (jwtPayload) {
                debug('JWT token verified successfully');
                const response = new ResponseObject().success(
                    {
                        valid: true,
                        type: 'jwt',
                        userId: jwtPayload.id,
                    },
                    'Token is valid',
                );
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Token is invalid
            debug('Token verification failed: Invalid token');
            const response = new ResponseObject().unauthorized('Invalid token');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Token verification error: ${error.message}`);
            const response = new ResponseObject().error(`Token verification error: ${error.message}`);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/token/exchange', async (req, res) => {
        const { apiToken } = req.body;
        debug('Token exchange endpoint called');

        if (!apiToken) {
            debug('Token exchange failed: No API token provided');
            const response = new ResponseObject().badRequest('API token is required');
            return res.status(response.statusCode).json(response.getResponse());
        }

        try {
            // Validate the API token
            const apiTokenResult = await authService.validateApiToken(apiToken);
            if (!apiTokenResult) {
                debug('Token exchange failed: Invalid API token');
                const response = new ResponseObject().unauthorized('Invalid API token');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const { userId, tokenId } = apiTokenResult;
            debug(`API token validated for user: ${userId}`);

            // Get user directly from auth service's user manager instead of req.app
            // This ensures we're using the same userManager instance that's already configured
            const user = await authService.getUserManager().getUserById(userId);
            if (!user) {
                debug(`User not found for API token: ${userId}`);
                const response = new ResponseObject().notFound('User not found');
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Generate a JWT token for the user
            const token = await authService.createSession(user);
            if (!token) {
                debug('Failed to create JWT session');
                const response = new ResponseObject().serverError('Failed to create session');
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Set JWT token as cookie
            authService.sessionService.setCookie(res, token.token, {
                secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
                sameSite: 'lax',
            });

            debug(`API token exchanged for JWT token for user: ${user.email}`);
            const response = new ResponseObject().success(
                {
                    user: {
                        id: user.id,
                        email: user.email,
                        userType: user.userType,
                        status: user.status,
                    },
                    token: token.token,
                    session: token.session,
                },
                'Token exchanged successfully',
            );
            return res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Token exchange error: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    return router;
}
