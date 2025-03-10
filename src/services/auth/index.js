import validator from 'validator';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import EventEmitter from 'eventemitter2';

import logger, { createDebug } from '@/utils/log/index.js';
import configurePassport from '@/utils/passport.js';

const debug = createDebug('canvas:service:auth');

import SessionService from './lib/SessionService.js';
import UserEventHandler from '@/services/events/UserEventHandler.js';
import User from '@/prisma/models/User.js';
import Session from '@/prisma/models/Session.js';
import AuthToken from '@/prisma/models/AuthToken.js';

/**
 * Auth Service
 *
 * Handles user authentication, registration, and session management
 */
class AuthService extends EventEmitter {
    #userManager;
    #workspaceManager;
    #sessionManager;
    #deviceManager;
    #contextManager;
    #sessionService;
    #userEventHandler;
    #config;
    #passport;
    #initialized = false;
    #started = false;

    constructor(config, options = {}) {
        super();
        this.#config = config;
        this.#userManager = options.userManager;
        this.#workspaceManager = options.workspaceManager;
        this.#sessionManager = options.sessionManager;
        this.#deviceManager = options.deviceManager;
        this.#contextManager = options.contextManager;

        if (!this.#userManager) {
            throw new Error('UserManager is required');
        }

        if (!this.#workspaceManager) {
            throw new Error('WorkspaceManager is required');
        }

        if (!this.#sessionManager) {
            throw new Error('SessionManager is required');
        }

        debug('Auth service created');
    }

    async initialize() {
        if (this.#initialized) {
            return;
        }

        debug('Initializing auth service');

        // Configure passport with JWT secret
        const jwtSecret = this.#config.jwtSecret || 'canvas-jwt-secret-dev-only';
        this.#passport = configurePassport(jwtSecret);
        debug('Passport configured with JWT secret');

        // Initialize session service if needed
        this.#sessionService = new SessionService({
            jwtSecret,
            jwtLifetime: this.#config.jwtLifetime || '7d',
            sessionManager: this.#sessionManager
        });

        // Initialize user event handler if needed
        this.#userEventHandler = new UserEventHandler({
            dataPath: this.#workspaceManager.rootPath
        }, {
            auth: this,
            userManager: this.#userManager,
            workspaceManager: this.#workspaceManager
        });

        this.#initialized = true;
        debug('Auth service initialized');
    }

    /**
     * Start the auth service
     * @returns {Promise<void>}
     */
    async start() {
        if (this.#started) {
            return;
        }

        if (!this.#initialized) {
            await this.initialize();
        }

        debug('Starting auth service');
        this.#started = true;
        debug('Auth service started');
    }

    /**
     * Stop the auth service
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this.#started) {
            return;
        }

        debug('Stopping auth service');

        // Clean up resources if needed
        if (this.#sessionService) {
            await this.#sessionService.stop();
        }

        this.#started = false;
        debug('Auth service stopped');
    }

    /**
     * Register a new user
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {string} userType - User type (default: 'user')
     * @returns {Promise<Object>} - User and token
     */
    async register(email, password, userType = 'user') {
        debug(`Registering new user: ${email}`);

        if (!validator.isEmail(email)) {
            throw new Error('Invalid email format');
        }

        // Check if user already exists
        const existingUser = await this.#userManager.getUserByEmail(email);
        if (existingUser) {
            throw new Error('User already exists');
        }

        // Create user
        const user = await this.#userManager.registerUser({
            email,
            password,
            userType
        });

        // Create a new session
        const session = await this.#sessionManager.createSession(user.id, {
            initializer: 'registration',
        });

        // Generate token
        const token = this.#sessionService.generateToken(user, session);

        // Generate an API token for the user
        const { tokenValue } = await AuthToken.generateToken(user.id, 'Default API Token');
        debug(`Generated API token for new user ${email}: ${tokenValue}`);

        debug(`User registered: ${email}`);

        return { user, token, session };
    }

    /**
     * Login a user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} - User and token
     */
    async login(email, password) {
        debug(`Login attempt for user: ${email}`);

        if (!validator.isEmail(email)) {
            throw new Error('Invalid email format');
        }

        // Authenticate user
        const user = await this.#userManager.authenticateUser(email, password);

        // Create a new session
        const session = await this.#sessionManager.createSession(user.id, {
            initializer: 'login',
        });

        // Generate token
        const token = this.#sessionService.generateToken(user, session);

        debug(`User logged in: ${email}`);

        return { user, token, session };
    }

    /**
     * Logout a user
     * @param {Object} res - Response object
     */
    logout(res) {
        debug('User logout');

        // Clear the cookie
        this.#sessionService.clearCookie(res);
    }

    /**
     * Verify a token
     * @param {string} token - JWT token
     * @returns {Object|null} - Decoded token or null
     */
    verifyToken(token) {
        return this.#sessionService.verifyToken(token);
    }

    /**
     * Get authentication middleware
     * @returns {Function} - Authentication middleware
     */
    getAuthMiddleware() {
        debug('Getting authentication middleware');

        // Ensure passport is initialized
        if (!this.#passport) {
            debug('Passport not initialized, initializing now');
            const jwtSecret = this.#config.jwtSecret || 'canvas-jwt-secret-dev-only';
            this.#passport = configurePassport(jwtSecret);
        }

        return (req, res, next) => {
            debug('Auth middleware called');

            // Try JWT and API token authentication
            this.#passport.authenticate(['jwt', 'api-token'], { session: false }, (err, user, info) => {
                if (err) {
                    debug(`Authentication error: ${err.message}`);
                    return next(err);
                }

                if (user) {
                    debug(`User authenticated: ${user.email}`);
                    req.user = user;
                    req.isAuthenticated = true;
                } else {
                    debug('No authenticated user');
                    req.isAuthenticated = false;
                }

                next();
            })(req, res, next);
        };
    }

    /**
     * Update user password
     * @param {string} userId - User ID
     * @param {string} currentPassword - Current password (required for non-admins)
     * @param {string} newPassword - New password
     * @param {Object} requestingUser - User making the request
     * @returns {Promise<Object>} - Updated user
     * @throws {Error} - If validation fails or permissions are insufficient
     */
    async updatePassword(userId, currentPassword, newPassword, requestingUser) {
        debug(`User ${requestingUser.email} attempting to update password for user ${userId}`);

        // Check permissions
        const isSelf = userId === requestingUser.id;
        const isAdmin = requestingUser.isAdmin();

        // Non-admins can only update their own password
        if (!isAdmin && !isSelf) {
            throw new Error('You can only update your own password');
        }

        // Non-admins must provide current password
        if (!isAdmin && isSelf && currentPassword) {
            // Verify current password
            const user = await this.#userManager.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const isValid = await user.comparePassword(currentPassword);
            if (!isValid) {
                throw new Error('Current password is incorrect');
            }
        }

        // Update the password
        const updatedUser = await this.#userManager.updateUser(userId, { password: newPassword });

        debug(`Password updated for user ${updatedUser.email}`);
        return updatedUser;
    }

    /**
     * List all auth tokens for a user
     * @param {string} userId - User ID
     * @returns {Promise<Array>} - Array of tokens
     */
    async listAuthTokens(userId) {
        debug(`Listing auth tokens for user: ${userId}`);

        const tokens = await AuthToken.prisma.authToken.findMany({
            where: {
                userId,
                revoked: false
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return tokens.map(token => new AuthToken(token));
    }

    /**
     * Generate a new auth token for a user
     * @param {string} userId - User ID
     * @param {string} name - Token name
     * @param {number} expiresInDays - Token expiration in days (null for no expiration)
     * @returns {Promise<Object>} - Generated token
     */
    async generateAuthToken(userId, name = 'API Token', expiresInDays = null) {
        debug(`Generating auth token for user: ${userId}`);

        const user = await this.#userManager.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const { token, tokenValue } = await AuthToken.generateToken(userId, name, expiresInDays);

        debug(`Generated auth token for user ${userId}: ${token.id}`);

        return { token, tokenValue };
    }

    /**
     * Revoke an auth token
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object>} - Revoked token
     */
    async revokeAuthToken(userId, tokenId) {
        debug(`Revoking auth token: ${tokenId} for user: ${userId}`);

        const token = await AuthToken.prisma.authToken.findFirst({
            where: {
                id: tokenId,
                userId
            }
        });

        if (!token) {
            throw new Error('Token not found');
        }

        const authToken = new AuthToken(token);
        await authToken.revoke();

        debug(`Revoked auth token: ${tokenId}`);

        return authToken;
    }

    /**
     * Verify an auth token
     * @param {string} tokenValue - Token value
     * @returns {Promise<Object|null>} - Token verification result
     */
    async verifyAuthToken(tokenValue) {
        return await AuthToken.verifyToken(tokenValue);
    }

    /**
     * Get the session service
     * @returns {SessionService} - Session service instance
     */
    get sessionService() {
        return this.#sessionService;
    }

    /**
     * Get the session manager
     * @returns {Object} - Session manager instance
     */
    get sessionManager() {
        return this.#sessionManager;
    }

    /**
     * Get the configured passport instance
     * @returns {Object} - Passport instance
     */
    get passport() {
        return this.#passport;
    }

    /**
     * Get user from request
     * @param {Object} req - Express request object
     * @returns {Promise<Object|null>} - User object or null
     */
    async getUserFromRequest(req) {
        debug('Getting user from request');

        // If user is already attached to request by auth middleware, return it
        if (req.user) {
            debug(`User found in request: ${req.user.email}`);
            return req.user;
        }

        // Otherwise, return null
        debug('No user found in request');
        return null;
    }
}

export default AuthService;
