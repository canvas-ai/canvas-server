'use strict';

// Utils
import { v4 as uuidv4 } from 'uuid';
import EventEmitter from 'eventemitter2';

// Logging
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('manager:token');

// Add crypto module import
import crypto from 'crypto';

/**
 * Constants
 */
const API_TOKEN_STATUSES = ['active', 'revoked', 'expired'];
const TOKEN_INDEX_PREFIX = 'auth:token:';
const TOKEN_PREFIX = 'canvas-';

/**
 * TokenManager Class
 * Manages API tokens for a user
 * Tokens are securely stored as hashes rather than raw values
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
     * @returns {Promise<Object>} Created token with value (value only returned here, stored as hash)
     */
    async createToken(options = {}) {
        if (!options.name) {
            throw new Error('Token name is required');
        }

        // Generate token ID and value
        const tokenId = uuidv4();
        const tokenValue = TokenManager.generateSecureToken(32);

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
            name: options.name,
            description: options.description || '',
            // Store hash instead of raw token for security
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

        this.emit('token:created', { userId: this.#userId, tokenId });

        // Return a copy of the token with the value to show to the user
        // This is the only time the raw token value is returned
        return {
            ...token,
            value: tokenValue,
            tokenHash: undefined, // Don't expose the hash
        };
    }

    /**
     * Find a token by its raw value
     * @param {string} tokenValue - The token value to find
     * @returns {Promise<Object|null>} Token object with ID or null if not found
     */
    async findTokenByValue(tokenValue) {
        if (!tokenValue) {
            return null;
        }

        // Hash the provided token value
        const tokenHash = this.#hashToken(tokenValue);

        // Get all tokens
        const tokens = this.#getTokens();

        // Find token with matching hash or raw value (for backward compatibility)
        const tokenEntry = Object.entries(tokens).find(
            ([_, token]) =>
                // Check for hash match (new format)
                (token.tokenHash && token.tokenHash === tokenHash) ||
                // Check for direct token match (old format)
                (token.token && token.token === tokenValue),
        );

        if (!tokenEntry) {
            debug(`No token found for value (hashed to ${tokenHash.substring(0, 10)}...)`);
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

        // If token uses old format (has token property), upgrade it to use hash
        if (token.token && !token.tokenHash) {
            debug(`Upgrading token ${tokenId} from old format to new hashed format`);
            try {
                await this.updateToken(tokenId, {
                    tokenHash: this.#hashToken(token.token),
                    token: undefined, // Remove the plain text token
                });
            } catch (error) {
                debug(`Error upgrading token ${tokenId}: ${error.message}`);
                // Continue even if upgrade fails
            }
        }

        return {
            tokenId,
            userId: this.#userId,
        };
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
     * Get a token by ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object>} Token object
     */
    async getToken(tokenId) {
        if (!tokenId) {
            throw new Error('Token ID is required');
        }

        debug(`Getting token: ${tokenId} for user: ${this.#userId}`);
        const tokens = this.#getTokens();
        const token = tokens[tokenId];

        if (!token) {
            debug(`Token not found: ${tokenId} for user: ${this.#userId}`);
            throw new Error(`Token not found: ${tokenId}`);
        }

        debug(`Token retrieved: ${tokenId} for user: ${this.#userId}`);
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
            usageCount: (token.usageCount || 0) + 1,
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
    static generateSecureToken(length = 32) {
        // Generate a more secure random token using Node's crypto module
        const randomBytes = crypto.randomBytes(Math.ceil(length * 0.75)); // Buffer needs to be 3/4 the length since base64 expands
        const base = randomBytes.toString('base64').replace(/[+/=]/g, ''); // Remove non-URL safe chars

        // Take only what we need for the desired length
        const token = base.substring(0, length);

        // Add the prefix for easy identification
        return TOKEN_PREFIX + token;
    }
}

export default TokenManager;
