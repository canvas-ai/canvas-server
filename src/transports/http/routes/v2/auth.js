import express from 'express';
import passport from 'passport';
import validator from 'validator';
import ResponseObject from '../../../ResponseObject.js';
import debugInstance from 'debug';

const debug = debugInstance('canvas:transport:http:routes:v2:auth');
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
        errors
    };
}

export default function(authService) {
    if (!authService) {
        throw new Error('Auth service is required');
    }

    if (!authService.sessionService) {
        throw new Error('Auth service sessionService is required');
    }

    // ===== User Authentication Routes =====

    /**
     * @swagger
     * /auth/register:
     *   post:
     *     summary: Register a new user
     *     tags: [Authentication]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *               - password
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *               password:
     *                 type: string
     *                 minLength: 8
     *     responses:
     *       201:
     *         description: User registered successfully
     *       400:
     *         description: Invalid input
     *       409:
     *         description: User already exists
     */
    router.post('/register', async (req, res) => {
        debug('Register endpoint called');
        const { email, password } = req.body;

        // Validate input
        const validation = validateCredentials(email, password);
        if (!validation.isValid) {
            debug(`Registration validation failed: ${JSON.stringify(validation.errors)}`);
            const response = new ResponseObject().badRequest('Validation failed', validation.errors);
            return res.status(response.statusCode).json(response.getResponse());
        }

        try {
            const { user, token } = await authService.register(email, password);
            authService.sessionService.setCookie(res, token);

            debug(`User registered successfully: ${email}`);
            const response = new ResponseObject().created({ token }, 'User registered successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Registration error: ${error.message}`);
            const response = new ResponseObject().conflict(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /auth/login:
     *   post:
     *     summary: Login a user
     *     tags: [Authentication]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *               - password
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *               password:
     *                 type: string
     *     responses:
     *       200:
     *         description: Login successful
     *       400:
     *         description: Invalid input
     *       401:
     *         description: Invalid credentials
     */
    router.post('/login', (req, res, next) => {
        debug('Login endpoint called');
        const { email, password } = req.body;

        // Validate input
        const validation = validateCredentials(email, password);
        if (!validation.isValid) {
            debug(`Login validation failed: ${JSON.stringify(validation.errors)}`);
            const response = new ResponseObject().badRequest('Validation failed', validation.errors);
            return res.status(response.statusCode).json(response.getResponse());
        }

        passport.authenticate('local', async (err, user, info) => {
            if (err) {
                debug(`Login error: ${err.message}`);
                const response = new ResponseObject().serverError(err.message);
                return res.status(response.statusCode).json(response.getResponse());
            }

            if (!user) {
                debug('Login failed: Invalid credentials');
                const response = new ResponseObject().unauthorized(info?.message || 'Invalid credentials');
                return res.status(response.statusCode).json(response.getResponse());
            }

            try {
                // Create a new session
                const session = await authService.sessionManager.createSession(user.id, {
                    initializer: 'login',
                });

                // Generate token
                const token = authService.sessionService.generateToken(user, session);

                // Set cookie
                authService.sessionService.setCookie(res, token);

                debug(`User logged in successfully: ${email}`);
                const response = new ResponseObject().success({
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                        userType: user.userType
                    }
                }, 'Login successful');
                res.status(response.statusCode).json(response.getResponse());
            } catch (error) {
                debug(`Session creation error: ${error.message}`);
                const response = new ResponseObject().serverError(error.message);
                res.status(response.statusCode).json(response.getResponse());
            }
        })(req, res, next);
    });

    /**
     * @swagger
     * /auth/logout:
     *   post:
     *     summary: Logout a user
     *     tags: [Authentication]
     *     responses:
     *       200:
     *         description: Logged out successfully
     */
    router.post('/logout', (req, res) => {
        debug('Logout endpoint called');

        // End the session if available
        if (req.session && req.session.id) {
            debug(`Ending session: ${req.session.id}`);
            authService.sessionManager.endSession(req.session.id);
        }

        // Clear the cookie
        authService.sessionService.clearCookie(res);

        debug('User logged out successfully');
        const response = new ResponseObject().success(null, 'Logged out successfully');
        res.status(response.statusCode).json(response.getResponse());
    });

    /**
     * @swagger
     * /auth/me:
     *   get:
     *     summary: Get current user information
     *     tags: [Authentication]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: User information retrieved successfully
     *       401:
     *         description: Not authenticated
     */
    router.get('/me', passport.authenticate(['jwt', 'api-token'], { session: false }), (req, res) => {
        debug('Get current user endpoint called');

        const response = new ResponseObject().success({
            id: req.user.id,
            email: req.user.email,
            userType: req.user.userType,
            tokenId: req.user.tokenId, // Will be present if authenticated with API token
        }, 'User information retrieved successfully');

        res.status(response.statusCode).json(response.getResponse());
    });

    /**
     * @swagger
     * /auth/password:
     *   put:
     *     summary: Update user password
     *     tags: [Authentication]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - currentPassword
     *               - newPassword
     *             properties:
     *               currentPassword:
     *                 type: string
     *               newPassword:
     *                 type: string
     *                 minLength: 8
     *     responses:
     *       200:
     *         description: Password updated successfully
     *       400:
     *         description: Invalid input
     *       401:
     *         description: Not authenticated
     */
    router.put('/password', passport.authenticate(['jwt', 'api-token'], { session: false }), async (req, res) => {
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

    /**
     * @swagger
     * /auth/tokens:
     *   get:
     *     summary: List all API tokens for the current user
     *     tags: [API Tokens]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: API tokens retrieved successfully
     *       401:
     *         description: Not authenticated
     */
    router.get('/tokens', passport.authenticate(['jwt', 'api-token'], { session: false }), async (req, res) => {
        debug('List tokens endpoint called');

        try {
            const tokens = await authService.listAuthTokens(req.user.id);

            debug(`Retrieved ${tokens.length} tokens for user: ${req.user.email}`);
            const response = new ResponseObject().success(tokens, 'API tokens retrieved successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`List tokens error: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /auth/tokens:
     *   post:
     *     summary: Generate a new API token
     *     tags: [API Tokens]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *                 description: Name for the token (e.g. "Firefox" or "canvas-cli")
     *               expiresInDays:
     *                 type: integer
     *                 description: Number of days until token expires (null for no expiration)
     *     responses:
     *       201:
     *         description: API token generated successfully
     *       400:
     *         description: Invalid input
     *       401:
     *         description: Not authenticated
     */
    router.post('/tokens', passport.authenticate(['jwt', 'api-token'], { session: false }), async (req, res) => {
        debug('Generate token endpoint called');
        const { name, expiresInDays } = req.body;

        // Validate input
        if (name && (!validator.isLength(name, { min: 1, max: 100 }) || !validator.isAlphanumeric(name, 'en-US', { ignore: ' -_' }))) {
            debug('Generate token validation failed: Invalid token name');
            const response = new ResponseObject().badRequest('Token name must be 1-100 alphanumeric characters, spaces, hyphens, or underscores');
            return res.status(response.statusCode).json(response.getResponse());
        }

        if (expiresInDays !== null && expiresInDays !== undefined && (!validator.isInt(String(expiresInDays)) || expiresInDays < 1)) {
            debug('Generate token validation failed: Invalid expiration days');
            const response = new ResponseObject().badRequest('Expiration days must be a positive integer');
            return res.status(response.statusCode).json(response.getResponse());
        }

        try {
            const { token, tokenValue } = await authService.generateAuthToken(
                req.user.id,
                name || 'API Token',
                expiresInDays || null
            );

            debug(`Generated new API token for user: ${req.user.email}, name: ${token.name}`);
            const response = new ResponseObject().created(
                { token, value: tokenValue },
                'API token generated successfully'
            );
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Generate token error: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /auth/tokens/{tokenId}:
     *   delete:
     *     summary: Revoke an API token
     *     tags: [API Tokens]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: tokenId
     *         required: true
     *         schema:
     *           type: string
     *         description: ID of the token to revoke
     *     responses:
     *       200:
     *         description: API token revoked successfully
     *       401:
     *         description: Not authenticated
     *       404:
     *         description: Token not found
     */
    router.delete('/tokens/:tokenId', passport.authenticate(['jwt', 'api-token'], { session: false }), async (req, res) => {
        const { tokenId } = req.params;
        debug(`Revoke token endpoint called for token ID: ${tokenId}`);

        try {
            await authService.revokeAuthToken(req.user.id, tokenId);

            debug(`API token revoked successfully: ${tokenId}`);
            const response = new ResponseObject().success(null, 'API token revoked successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Revoke token error: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /auth/token/verify:
     *   post:
     *     summary: Verify a token without requiring authentication
     *     tags: [API Tokens]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - token
     *             properties:
     *               token:
     *                 type: string
     *     responses:
     *       200:
     *         description: Token is valid
     *       401:
     *         description: Invalid token
     */
    router.post('/token/verify', async (req, res) => {
        const { token } = req.body;
        debug('Token verify endpoint called');

        if (!token) {
            debug('Token verify failed: No token provided');
            const response = new ResponseObject().badRequest('Token is required');
            return res.status(response.statusCode).json(response.getResponse());
        }

        try {
            // First try as JWT token
            const jwtPayload = authService.verifyToken(token);
            if (jwtPayload) {
                debug('JWT token verified successfully');
                const response = new ResponseObject().success({
                    valid: true,
                    type: 'jwt',
                    userId: jwtPayload.id
                }, 'Token is valid');
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Then try as API token
            const apiTokenResult = await authService.verifyAuthToken(token);
            if (apiTokenResult) {
                debug('API token verified successfully');
                const response = new ResponseObject().success({
                    valid: true,
                    type: 'api',
                    userId: apiTokenResult.user.id,
                    tokenId: apiTokenResult.token.id,
                    tokenName: apiTokenResult.token.name
                }, 'Token is valid');
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Token is invalid
            debug('Token verification failed: Invalid token');
            const response = new ResponseObject().unauthorized('Invalid token');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Token verify error: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    return router;
}
