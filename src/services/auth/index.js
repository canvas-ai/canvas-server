import validator from 'validator';
import EventEmitter from 'eventemitter2';
import configurePassport from '../../utils/passport.js';
import bcrypt from 'bcrypt';

import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('service:auth');

import SessionService from './lib/SessionService.js';
import AuthTokenService from './lib/AuthToken.js';

/**
 * Auth Service
 *
 * Handles user authentication, registration, and session management
 */
class AuthService extends EventEmitter {
    #userManager;
    #sessionManager;
    #sessionService;
    #authTokenService;
    #config;
    #passport;
    #initialized = false;
    #started = false;

    constructor(config, options = {}) {
        super();
        this.#config = config;
        this.#userManager = options.userManager;
        this.#sessionManager = options.sessionManager;

        if (!this.#userManager) {
            throw new Error('UserManager is required');
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
        this.#passport = configurePassport(jwtSecret, {
            userManager: this.#userManager,
            authService: this,
        });
        debug('Passport configured with JWT secret');

        // Initialize session service
        this.#sessionService = new SessionService({
            jwtSecret,
            jwtLifetime: this.#config.jwtLifetime || '7d',
            sessionManager: this.#sessionManager,
        });

        // Initialize auth token service
        this.#authTokenService = new AuthTokenService({
            userManager: this.#userManager,
        });
        await this.#authTokenService.initialize();

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

        // Stop session service
        await this.#sessionService.stop();

        // Stop auth token service
        await this.#authTokenService.stop();

        this.#started = false;
        debug('Auth service stopped');
    }

    /**
     * Register a new user
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {string} [userType='user'] - User type ('user' or 'admin')
     * @returns {Promise<Object>} - Registration result with user, token, and session
     */
    async register(email, password, userType = 'user') {
        debug(`Registering new user with email: ${email}`);

        if (!email || !validator.isEmail(email)) {
            throw new Error('Valid email address is required');
        }

        if (!password || password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }

        // Check if user already exists - use hasUserByEmail instead of getUserByEmail
        const userExists = await this.#userManager.hasUserByEmail(email);
        if (userExists) {
            throw new Error('User with this email already exists');
        }

        // Hash password
        const hashedPassword = await this.#hashPassword(password);

        // Create user
        const user = await this.#userManager.createUser({
            email,
            userType,
        });

        // Store password hash
        await this.#storePassword(user.id, hashedPassword);

        // Create session
        const session = await this.#sessionManager.createSession(user.id, {
            userAgent: 'Canvas API',
            ipAddress: '127.0.0.1',
        });

        // Generate JWT token
        const token = this.#sessionService.generateToken(user, session);

        this.emit('user:registered', user);
        debug(`User registered: ${email} (${user.id})`);

        return {
            user,
            token,
            session,
        };
    }

    /**
     * Login a user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} - Login result with user and token
     */
    async login(email, password) {
        debug(`Login attempt for user: ${email}`);

        if (!email || !validator.isEmail(email)) {
            throw new Error('Valid email address is required');
        }

        if (!password) {
            throw new Error('Password is required');
        }

        // Get user by email
        const user = await this.#userManager.getUserByEmail(email);
        if (!user) {
            throw new Error('Invalid email or password');
        }

        // Verify password
        const isPasswordValid = await this.#verifyPassword(user.id, password);
        if (!isPasswordValid) {
            throw new Error('Invalid email or password');
        }

        // Create session
        const session = await this.#sessionManager.createSession(user.id, {
            userAgent: 'Canvas API',
            ipAddress: '127.0.0.1',
        });

        // Generate JWT token
        const token = this.#sessionService.generateToken(user, session);

        this.emit('user:login', { user, session });
        debug(`User logged in: ${email} (${user.id})`);

        return {
            user,
            token,
            session,
        };
    }

    /**
     * Logout a user
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    logout(req, res) {
        debug('Logging out user');

        // Clear session cookie
        if (res) {
            this.#sessionService.clearCookie(res);
        }

        // Invalidate session if available
        if (req && req.user && req.user.tokenPayload && req.user.tokenPayload.sessionId) {
            this.#sessionManager.endSession(req.user.tokenPayload.sessionId);
        }

        debug('User logged out');
    }

    /**
     * Verify a JWT token
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
        return this.#passport.authenticate('api-token', { session: false });
    }

    /**
     * Set a user's password
     * @param {string} userId - User ID
     * @param {string} password - Password
     * @returns {Promise<boolean>} - Success status
     */
    async setPassword(userId, password) {
        debug(`Setting password for user: ${userId}`);

        if (!password || password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }

        // Hash password
        const hashedPassword = await this.#hashPassword(password);

        // Store password hash
        await this.#storePassword(userId, hashedPassword);

        debug(`Password set for user: ${userId}`);
        return true;
    }

    /**
     * Update a user's password
     * @param {string} userId - User ID
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @param {Object} requestingUser - User making the request (for admin override)
     * @returns {Promise<boolean>} - Success status
     */
    async updatePassword(userId, currentPassword, newPassword, requestingUser) {
        debug(`Updating password for user: ${userId}`);

        if (!newPassword || newPassword.length < 8) {
            throw new Error('New password must be at least 8 characters long');
        }

        // Check if requesting user is an admin (for admin override)
        const isAdminOverride = requestingUser && requestingUser.id !== userId && requestingUser.userType === 'admin';

        // Verify current password if not admin override
        if (!isAdminOverride) {
            const isPasswordValid = await this.#verifyPassword(userId, currentPassword);
            if (!isPasswordValid) {
                throw new Error('Current password is incorrect');
            }
        }

        // Hash new password
        const hashedPassword = await this.#hashPassword(newPassword);

        // Store password hash
        await this.#storePassword(userId, hashedPassword);

        // Invalidate all sessions for this user
        await this.#sessionManager.endAllUserSessions(userId);

        debug(`Password updated for user: ${userId}`);
        return true;
    }

    /**
     * Create an API token for a user
     * @param {string} userId - User ID
     * @param {Object} options - Token options
     * @returns {Promise<Object>} - Created token
     */
    async createApiToken(userId, options = {}) {
        return this.#authTokenService.createToken(userId, options);
    }

    /**
     * Get an API token
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object|null>} - Token or null
     */
    async getApiToken(userId, tokenId) {
        return this.#authTokenService.getToken(userId, tokenId);
    }

    /**
     * List API tokens for a user
     * @param {string} userId - User ID
     * @param {Object} options - Filter options
     * @returns {Promise<Array<Object>>} - List of tokens
     */
    async listApiTokens(userId, options = {}) {
        return this.#authTokenService.listTokens(userId, options);
    }

    /**
     * Update an API token
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<Object|null>} - Updated token or null
     */
    async updateApiToken(userId, tokenId, updates = {}) {
        return this.#authTokenService.updateToken(userId, tokenId, updates);
    }

    /**
     * Delete an API token
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<boolean>} - Success status
     */
    async deleteApiToken(userId, tokenId) {
        return this.#authTokenService.deleteToken(userId, tokenId);
    }

    /**
     * Validate an API token
     * @param {string} tokenValue - Token value
     * @returns {Promise<Object|null>} - User ID and token ID if valid, null if invalid
     */
    async validateApiToken(tokenValue) {
        return this.#authTokenService.validateToken(tokenValue);
    }

    /**
     * Get session service
     * @returns {SessionService} - Session service
     */
    get sessionService() {
        return this.#sessionService;
    }

    /**
     * Get session manager
     * @returns {Object} - Session manager
     */
    get sessionManager() {
        return this.#sessionManager;
    }

    /**
     * Get passport instance
     * @returns {Object} - Passport instance
     */
    get passport() {
        return this.#passport;
    }

    /**
     * Get user from request
     * @param {Object} req - Request object
     * @returns {Promise<Object|null>} - User object or null
     */
    async getUserFromRequest(req) {
        if (!req.user || !req.user.id) {
            return null;
        }

        try {
            return await this.#userManager.getUserById(req.user.id);
        } catch (error) {
            debug(`Error getting user from request: ${error.message}`);
            return null;
        }
    }

    /**
     * Hash a password
     * @param {string} password - Password to hash
     * @returns {Promise<string>} - Hashed password
     * @private
     */
    async #hashPassword(password) {
        const saltRounds = 10;
        return bcrypt.hash(password, saltRounds);
    }

    /**
     * Verify a password
     * @param {string} userId - User ID
     * @param {string} password - Password to verify
     * @returns {Promise<boolean>} - Whether password is valid
     * @private
     */
    async #verifyPassword(userId, password) {
        try {
            // Get stored password hash
            const storedHash = await this.#getStoredPassword(userId);
            if (!storedHash) {
                return false;
            }

            // Compare passwords
            return bcrypt.compare(password, storedHash);
        } catch (error) {
            debug(`Error verifying password: ${error.message}`);
            return false;
        }
    }

    /**
     * Store a password hash
     * @param {string} userId - User ID
     * @param {string} passwordHash - Password hash to store
     * @returns {Promise<void>}
     * @private
     */
    async #storePassword(userId, passwordHash) {
        // Create a config key for the password hash
        const key = `auth:password:${userId}`;
        const data = {
            hash: passwordHash,
            updatedAt: new Date().toISOString(),
        };

        // Use JIM to store the password hash (via userManager's index)
        this.#userManager.setConfig(key, data);
    }

    /**
     * Get stored password hash
     * @param {string} userId - User ID
     * @returns {Promise<string|null>} - Stored password hash or null
     * @private
     */
    async #getStoredPassword(userId) {
        try {
            // Get the password hash data from JIM
            const key = `auth:password:${userId}`;
            const data = this.#userManager.getConfig(key, null);
            return data ? data.hash : null;
        } catch (error) {
            debug(`Error getting stored password: ${error.message}`);
            return null;
        }
    }

    /**
     * Create a session for a user and generate a JWT token
     * This is used when exchanging an API token for a JWT token
     * @param {Object} user - User object
     * @returns {Promise<Object>} - Session and token object
     */
    async createSession(user) {
        if (!user || !user.id) {
            throw new Error('Valid user object is required');
        }

        debug(`Creating session for user: ${user.email} (${user.id})`);

        try {
            // Create session
            const session = await this.#sessionManager.createSession(user.id, {
                source: 'api-token-exchange',
                userAgent: 'Canvas API Token Exchange',
                ipAddress: '127.0.0.1',
            });

            // Generate JWT token
            const token = this.#sessionService.generateToken(user, session);

            debug(`Session created for user: ${user.email} (${user.id})`);
            return {
                session,
                token
            };
        } catch (error) {
            debug(`Error creating session: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get user manager
     * @returns {Object} - User manager
     */
    getUserManager() {
        return this.#userManager;
    }
}

export default AuthService;
