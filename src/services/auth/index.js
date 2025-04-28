import validator from 'validator';
import EventEmitter from 'eventemitter2';
import configurePassport from '../../utils/passport.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('service:auth');

import SessionService from './lib/SessionService.js';

/**
 * Constants for token management
 */
const API_TOKEN_STATUSES = ['active', 'revoked', 'expired'];
const TOKEN_PREFIX = 'canvas-';

/**
 * Auth Service
 *
 * Handles user authentication, registration, session management, and token management
 */
class AuthService extends EventEmitter {
    #userManager;
    #sessionManager;
    #sessionService;
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

        // Initialize token storage in user manager's config if it doesn't exist
        if (!this.#userManager.getConfig('auth:tokens')) {
            this.#userManager.setConfig('auth:tokens', {});
        }

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

        this.#started = false;
        debug('Auth service stopped');
    }

    /**
     * ===========================
     * User Authentication
     * ===========================
     */

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

        // Create a default API token
        const apiToken = await this.createToken(user.id, {
            name: 'Default API Token',
            description: `Default API token for ${email}`,
        });

        this.emit('user:registered', user);
        debug(`User registered: ${email} (${user.id})`);

        return {
            user,
            token,
            session,
            apiToken: apiToken.value,
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
     * ===========================
     * Token Management
     * ===========================
     */

    /**
     * Create a new API token for a user
     * @param {string} userId - User ID
     * @param {Object} options - Token options
     * @param {string} options.name - Token name
     * @param {string} options.description - Token description
     * @param {Date|string} [options.expiresAt] - Expiration date
     * @param {Array<string>} [options.scopes] - Token scopes
     * @returns {Promise<Object>} Created token with value (value only returned here)
     */
    async createToken(userId, options = {}) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        if (!options.name) {
            throw new Error('Token name is required');
        }

        // Verify user exists
        const userExists = await this.#userManager.hasUser(userId);
        if (!userExists) {
            throw new Error(`User not found: ${userId}`);
        }

        // Generate token ID and value
        const tokenId = uuidv4();
        const tokenValue = this.#generateSecureToken(32);

        // Create hash of the token for storage
        const tokenHash = this.#hashToken(tokenValue);

        const expiresAt = options.expiresAt
            ? options.expiresAt instanceof Date
                ? options.expiresAt.toISOString()
                : options.expiresAt
            : null;

        // Create token object for storage (without raw value)
        const token = {
            id: tokenId,
            userId: userId,
            name: options.name,
            description: options.description || '',
            tokenHash: tokenHash,
            created: new Date().toISOString(),
            lastUsed: null,
            expiresAt: expiresAt,
            status: 'active',
            scopes: Array.isArray(options.scopes) ? options.scopes : ['api'],
            usageCount: 0,
        };

        // Get current tokens
        const tokens = this.#getTokens();

        // Add new token
        tokens[tokenId] = token;

        // Store updated tokens
        this.#saveTokens(tokens);

        this.emit('token:created', { userId, tokenId });

        // Return a copy of the token with the value to show to the user
        // This is the only time the raw token value is returned
        return {
            ...token,
            value: tokenValue,
            tokenHash: undefined, // Don't expose the hash
        };
    }

    /**
     * Get a token by ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object>} Token object
     */
    async getToken(tokenId) {
        if (!tokenId) {
            throw new Error('Token ID is required');
        }

        debug(`Getting token: ${tokenId}`);
        const tokens = this.#getTokens();
        const token = tokens[tokenId];

        if (!token) {
            debug(`Token not found: ${tokenId}`);
            throw new Error(`Token not found: ${tokenId}`);
        }

        debug(`Token retrieved: ${tokenId}`);
        return token;
    }

    /**
     * List all tokens for a user
     * @param {string} userId - User ID
     * @param {Object} options - Filter options
     * @param {string} [options.status] - Filter by status
     * @param {Array<string>} [options.scopes] - Filter by scopes
     * @param {boolean} [options.includeExpired=false] - Whether to include expired tokens
     * @returns {Promise<Array<Object>>} Array of tokens
     */
    async listTokens(userId, options = {}) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        let tokens = Object.values(this.#getTokens());

        // Filter by user ID
        tokens = tokens.filter((token) => token.userId === userId);

        // Apply filters
        if (options.status && API_TOKEN_STATUSES.includes(options.status)) {
            tokens = tokens.filter((token) => token.status === options.status);
        }

        if (Array.isArray(options.scopes) && options.scopes.length > 0) {
            tokens = tokens.filter((token) => options.scopes.some((scope) => token.scopes.includes(scope)));
        }

        // Filter out expired tokens unless specifically requested
        if (!options.includeExpired) {
            const now = new Date().toISOString();
            tokens = tokens.filter((token) => !token.expiresAt || token.expiresAt > now);
        }

        return tokens;
    }

    /**
     * Update a token's properties
     * @param {string} tokenId - Token ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<Object>} Updated token
     */
    async updateToken(tokenId, updates = {}) {
        if (!tokenId) {
            throw new Error('Token ID is required');
        }

        if (Object.keys(updates).length === 0) {
            throw new Error('No updates provided');
        }

        // Get all tokens
        const tokens = this.#getTokens();
        const token = tokens[tokenId];

        if (!token) {
            throw new Error(`Token not found: ${tokenId}`);
        }

        // Validate status if updating
        if (updates.status && !API_TOKEN_STATUSES.includes(updates.status)) {
            throw new Error(`Invalid token status: ${updates.status}`);
        }

        // Format expiration date if provided
        if (updates.expiresAt) {
            updates.expiresAt = updates.expiresAt instanceof Date ? updates.expiresAt.toISOString() : updates.expiresAt;
        }

        // Apply updates
        const updatedToken = {
            ...token,
            ...updates,
            updated: new Date().toISOString(),
        };

        // Update token in the tokens object
        tokens[tokenId] = updatedToken;

        // Save updated tokens
        this.#saveTokens(tokens);

        this.emit('token:updated', { userId: token.userId, tokenId, updates: Object.keys(updates) });

        return updatedToken;
    }

    /**
     * Delete a token
     * @param {string} tokenId - Token ID
     * @returns {Promise<boolean>} True if deleted
     */
    async deleteToken(tokenId) {
        if (!tokenId) {
            throw new Error('Token ID is required');
        }

        // Get all tokens
        const tokens = this.#getTokens();

        if (!tokens[tokenId]) {
            return false; // Token doesn't exist
        }

        const userId = tokens[tokenId].userId;

        // Delete token
        delete tokens[tokenId];

        // Save updated tokens
        this.#saveTokens(tokens);

        this.emit('token:deleted', { userId, tokenId });

        return true;
    }

    /**
     * Update token usage information
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object>} Updated token
     */
    async updateTokenUsage(tokenId) {
        if (!tokenId) {
            throw new Error('Token ID is required');
        }

        // Get all tokens
        const tokens = this.#getTokens();
        const token = tokens[tokenId];

        if (!token) {
            throw new Error(`Token not found: ${tokenId}`);
        }

        // Check if token is active
        if (token.status !== 'active') {
            throw new Error(`Token is not active: ${tokenId}`);
        }

        // Check if token is expired
        if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
            // Update status to expired
            token.status = 'expired';
            tokens[tokenId] = token;
            this.#saveTokens(tokens);
            throw new Error(`Token has expired: ${tokenId}`);
        }

        // Update usage information
        const updatedToken = {
            ...token,
            lastUsed: new Date().toISOString(),
            usageCount: (token.usageCount || 0) + 1,
        };

        // Update token in tokens object
        tokens[tokenId] = updatedToken;

        // Save updated tokens
        this.#saveTokens(tokens);

        return updatedToken;
    }

    /**
     * Find a user and token by token value
     * @param {string} tokenValue - Raw token value
     * @returns {Promise<{userId: string, tokenId: string}|null>} User ID and token ID if found
     */
    async validateApiToken(tokenValue) {
        if (!tokenValue) {
            return null;
        }

        // Hash the provided token value
        const tokenHash = this.#hashToken(tokenValue);

        // Get all tokens
        const tokens = this.#getTokens();

        // Find token with matching hash
        const tokenEntry = Object.entries(tokens).find(
            ([_, token]) =>
                (token.tokenHash === tokenHash) ||
                // For backward compatibility
                (token.token === tokenValue)
        );

        if (!tokenEntry) {
            debug(`No token found for provided value`);
            return null;
        }

        const [tokenId, token] = tokenEntry;

        // Check if token is active and not expired
        if (token.status !== 'active') {
            debug(`Token ${tokenId} found but status is ${token.status}, not active`);
            return null;
        }

        if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
            // Update status to expired
            debug(`Token ${tokenId} found but has expired`);
            await this.updateToken(tokenId, { status: 'expired' });
            return null;
        }

        // Update usage
        try {
            await this.updateTokenUsage(tokenId);
            debug(`Token ${tokenId} found and usage updated`);
        } catch (error) {
            debug(`Error updating token usage for ${tokenId}: ${error.message}`);
            // Continue even if updating usage fails
        }

        // Migrate from old format to hash if needed
        if (token.token && !token.tokenHash) {
            try {
                await this.updateToken(tokenId, {
                    tokenHash: this.#hashToken(token.token),
                    token: undefined // Remove plain text token
                });
                debug(`Migrated token ${tokenId} to hash format`);
            } catch (error) {
                debug(`Error migrating token to hash format: ${error.message}`);
            }
        }

        return {
            userId: token.userId,
            tokenId,
        };
    }

    /**
     * Get token counts for a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Token counts by status
     */
    async getTokenCounts(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const tokens = await this.listTokens(userId);

        return {
            total: tokens.length,
            active: tokens.filter(token => token.status === 'active').length,
            revoked: tokens.filter(token => token.status === 'revoked').length,
            expired: tokens.filter(token => token.status === 'expired').length,
        };
    }

    /**
     * ===========================
     * Password Management
     * ===========================
     */

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
                token,
            };
        } catch (error) {
            debug(`Error creating session: ${error.message}`);
            throw error;
        }
    }

    /**
     * ===========================
     * Accessors
     * ===========================
     */

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
     * Get user manager
     * @returns {Object} - User manager
     */
    getUserManager() {
        return this.#userManager;
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
     * ===========================
     * Private Methods
     * ===========================
     */

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
     * Hash a token value for secure storage
     * @param {string} tokenValue - Token value to hash
     * @returns {string} Hashed token
     * @private
     */
    #hashToken(tokenValue) {
        return crypto.createHash('sha256').update(tokenValue).digest('hex');
    }

    /**
     * Generate a secure token
     * @param {number} length - Length of the token
     * @returns {string} Generated token
     * @private
     */
    #generateSecureToken(length = 32) {
        // Generate a more secure random token using Node's crypto module
        const randomBytes = crypto.randomBytes(Math.ceil(length * 0.75)); // Buffer needs to be 3/4 the length since base64 expands
        const base = randomBytes.toString('base64').replace(/[+/=]/g, ''); // Remove non-URL safe chars

        // Take only what we need for the desired length
        const token = base.substring(0, length);

        // Add the prefix for easy identification
        return TOKEN_PREFIX + token;
    }

    /**
     * Get all tokens
     * @returns {Object} Map of token ID to token object
     * @private
     */
    #getTokens() {
        return this.#userManager.getConfig('auth:tokens', {});
    }

    /**
     * Save all tokens
     * @param {Object} tokens - Map of token ID to token object
     * @private
     */
    #saveTokens(tokens) {
        this.#userManager.setConfig('auth:tokens', tokens);
    }

    /**
     * Generate a secure random password
     * @param {number} length - Length of the password
     * @returns {string} A random password
     */
    generateSecurePassword(length = 8) {
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_-+=<>?/[]{}';

        const allChars = lowercase + uppercase + numbers + symbols;
        let password = '';

        // Ensure at least one character from each category
        password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
        password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
        password += numbers.charAt(Math.floor(Math.random() * numbers.length));
        password += symbols.charAt(Math.floor(Math.random() * symbols.length));

        // Fill the rest randomly
        for (let i = 4; i < length; i++) {
            password += allChars.charAt(Math.floor(Math.random() * allChars.length));
        }

        // Shuffle the password characters
        return password
            .split('')
            .sort(() => 0.5 - Math.random())
            .join('');
    }
}

export default AuthService;
