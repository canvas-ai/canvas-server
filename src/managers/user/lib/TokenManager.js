'use strict';

// Utils
import { v4 as uuidv4 } from 'uuid';
import EventEmitter from 'eventemitter2';

// Logging
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('manager:token');

/**
 * Constants
 */
const API_TOKEN_STATUSES = ['active', 'revoked', 'expired'];
const TOKEN_INDEX_PREFIX = 'auth:token:';

/**
 * TokenManager Class
 * Manages API tokens for a user
 */
class TokenManager extends EventEmitter {
    // The user this token manager belongs to
    #userId;

    // JIM instance
    #jim;

    // Index name for token storage
    #indexName;

    /**
     * Constructor - Initialize the token manager for a user
     * @param {Object} options - Configuration options
     * @param {string} options.userId - The ID of the user
     * @param {string} options.userHomePath - Path to the user's home directory (not used in simplified version)
     * @param {Object} options.jim - JSON Index Manager instance
     * @param {Object} [options.eventEmitterOptions] - Options for EventEmitter2
     */
    constructor(options = {}) {
        super(options.eventEmitterOptions || {});

        if (!options.userId) throw new Error('User ID is required');
        if (!options.jim) throw new Error('JIM instance is required');

        this.#userId = options.userId;
        this.#jim = options.jim;
        this.#indexName = 'users'; // Use the same index as UserManager

        debug(`TokenManager initialized for user: ${this.#userId}`);
    }

    /**
     * Helper to get the token storage key for this user
     * @returns {string} Token storage key
     * @private
     */
    #getTokenStorageKey() {
        return `${TOKEN_INDEX_PREFIX}${this.#userId}`;
    }

    /**
     * Get all tokens for the user
     * @returns {Object} Map of token ID to token object
     * @private
     */
    #getTokens() {
        const key = this.#getTokenStorageKey();
        return this.#jim.getIndex(this.#indexName).get(key, {});
    }

    /**
     * Save all tokens for the user
     * @param {Object} tokens - Map of token ID to token object
     * @private
     */
    #saveTokens(tokens) {
        const key = this.#getTokenStorageKey();
        this.#jim.getIndex(this.#indexName).set(key, tokens);
    }

    /**
     * Create a new API token
     * @param {Object} options - Token options
     * @param {string} options.name - Token name
     * @param {string} options.description - Token description
     * @param {Date|string} [options.expiresAt] - Expiration date
     * @param {Array<string>} [options.scopes] - Token scopes
     * @returns {Promise<Object>} Created token
     */
    async createToken(options = {}) {
        if (!options.name) {
            throw new Error('Token name is required');
        }

        // Generate token ID and value
        const tokenId = uuidv4();
        const tokenValue = TokenManager.generateSecureToken(32);

        const expiresAt = options.expiresAt
            ? (options.expiresAt instanceof Date ? options.expiresAt.toISOString() : options.expiresAt)
            : null;

        // Create token object
        const token = {
            id: tokenId,
            name: options.name,
            description: options.description || '',
            token: tokenValue, // In production, should be hashed
            created: new Date().toISOString(),
            lastUsed: null,
            expiresAt: expiresAt,
            status: 'active',
            scopes: Array.isArray(options.scopes) ? options.scopes : ['api'],
            usageCount: 0
        };

        // Get current tokens
        const tokens = this.#getTokens();

        // Add new token
        tokens[tokenId] = token;

        // Store updated tokens
        this.#saveTokens(tokens);

        this.emit('token:created', { userId: this.#userId, tokenId });

        // Return a copy of the token with the value to show to the user
        return {
            ...token,
            value: tokenValue
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

        const tokens = this.#getTokens();
        const token = tokens[tokenId];

        if (!token) {
            throw new Error(`Token not found: ${tokenId}`);
        }

        return token;
    }

    /**
     * List all tokens or filter by criteria
     * @param {Object} options - Filter options
     * @param {string} [options.status] - Filter by status
     * @param {Array<string>} [options.scopes] - Filter by scopes
     * @param {boolean} [options.includeExpired=false] - Whether to include expired tokens
     * @returns {Promise<Array<Object>>} Array of tokens
     */
    async listTokens(options = {}) {
        let tokens = Object.values(this.#getTokens());

        // Apply filters
        if (options.status && API_TOKEN_STATUSES.includes(options.status)) {
            tokens = tokens.filter(token => token.status === options.status);
        }

        if (Array.isArray(options.scopes) && options.scopes.length > 0) {
            tokens = tokens.filter(token =>
                options.scopes.some(scope => token.scopes.includes(scope))
            );
        }

        // Filter out expired tokens unless specifically requested
        if (!options.includeExpired) {
            const now = new Date().toISOString();
            tokens = tokens.filter(token =>
                !token.expiresAt || token.expiresAt > now
            );
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
            updates.expiresAt = updates.expiresAt instanceof Date
                ? updates.expiresAt.toISOString()
                : updates.expiresAt;
        }

        // Apply updates
        const updatedToken = {
            ...token,
            ...updates,
            updated: new Date().toISOString()
        };

        // Update token in the tokens object
        tokens[tokenId] = updatedToken;

        // Save updated tokens
        this.#saveTokens(tokens);

        this.emit('token:updated', { userId: this.#userId, tokenId, updates: Object.keys(updates) });

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

        // Delete token
        delete tokens[tokenId];

        // Save updated tokens
        this.#saveTokens(tokens);

        this.emit('token:deleted', { userId: this.#userId, tokenId });

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
            usageCount: (token.usageCount || 0) + 1
        };

        // Update token in tokens object
        tokens[tokenId] = updatedToken;

        // Save updated tokens
        this.#saveTokens(tokens);

        return updatedToken;
    }

    /**
     * Get the total count of tokens
     * @returns {Promise<number>} Token count
     */
    async getTokenCount() {
        const tokens = this.#getTokens();
        return Object.keys(tokens).length;
    }

    /**
     * Get active token count
     * @returns {Promise<number>} Active token count
     */
    async getActiveTokenCount() {
        const tokens = await this.listTokens({ status: 'active' });
        return tokens.length;
    }

    /**
     * Generate a secure token
     * @param {number} length - Length of the token
     * @returns {string} Generated token
     * @static
     */
    static generateSecureToken(length = 16) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_=+';
        let token = '';

        // Ensure we have at least one of each character type
        token += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
        token += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
        token += '0123456789'[Math.floor(Math.random() * 10)]; // digit
        token += '-_=+'[Math.floor(Math.random() * 4)]; // special

        // Fill the rest randomly
        for (let i = 4; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * charset.length);
            token += charset[randomIndex];
        }

        // Shuffle the token characters
        return token
            .split('')
            .sort(() => 0.5 - Math.random())
            .join('');
    }
}

export default TokenManager;
