'use strict';

// Utils
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Conf from 'conf';
import EventEmitter from 'eventemitter2';

// Logging
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('token-manager');

/**
 * Constants
 */
const API_TOKEN_STATUSES = ['active', 'revoked', 'expired'];

/**
 * TokenManager Class
 * Manages API tokens for a user
 */
class TokenManager extends EventEmitter {
    // The user this token manager belongs to
    #userId;

    // Path to user's home directory
    #userHomePath;

    // Configuration store
    #tokenStore;

    /**
     * Constructor - Initialize the token manager for a user
     * @param {Object} options - Configuration options
     * @param {string} options.userId - The ID of the user
     * @param {string} options.userHomePath - Path to the user's home directory
     * @param {Object} [options.eventEmitterOptions] - Options for EventEmitter2
     */
    constructor(options = {}) {
        super(options.eventEmitterOptions || {});

        if (!options.userId) throw new Error('User ID is required');
        if (!options.userHomePath) throw new Error('User home path is required');

        this.#userId = options.userId;
        this.#userHomePath = options.userHomePath;

        // Initialize token store
        this.#initializeTokenStore();

        debug(`TokenManager initialized for user: ${this.#userId}`);
    }

    /**
     * Initialize the token store
     * @private
     */
    #initializeTokenStore() {
        try {
            const configDir = path.join(this.#userHomePath, 'Config');
            if (!existsSync(configDir)) {
                debug(`Config directory does not exist for user ${this.#userId}, token store not initialized`);
                return;
            }

            this.#tokenStore = new Conf({
                configName: 'tokens',
                cwd: configDir
            });
            debug(`Token store initialized for user ${this.#userId}`);
        } catch (error) {
            debug(`Failed to initialize token store: ${error.message}`);
        }
    }

    /**
     * Ensure the token store exists and is initialized
     * @private
     */
    async #ensureTokenStore() {
        if (this.#tokenStore) return;

        // Create Config directory if it doesn't exist
        const configDir = path.join(this.#userHomePath, 'Config');
        if (!existsSync(configDir)) {
            await fs.mkdir(configDir, { recursive: true });
        }

        this.#tokenStore = new Conf({
            configName: 'tokens',
            cwd: configDir
        });

        debug(`Token store created for user ${this.#userId}`);
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
        if (!this.#tokenStore) {
            await this.#ensureTokenStore();
        }

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

        // Store token
        this.#tokenStore.set(`tokens.${tokenId}`, token);

        this.emit('token:created', { userId: this.#userId, tokenId });

        return token;
    }

    /**
     * Get a token by ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object>} Token object
     */
    async getToken(tokenId) {
        if (!this.#tokenStore) {
            await this.#ensureTokenStore();
        }

        if (!tokenId) {
            throw new Error('Token ID is required');
        }

        const token = this.#tokenStore.get(`tokens.${tokenId}`);

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
     * @returns {Promise<Array<Object>>} Array of tokens
     */
    async listTokens(options = {}) {
        if (!this.#tokenStore) {
            await this.#ensureTokenStore();
        }

        let tokens = Object.values(this.#tokenStore.get('tokens', {}));

        // Apply filters
        if (options.status && API_TOKEN_STATUSES.includes(options.status)) {
            tokens = tokens.filter(token => token.status === options.status);
        }

        if (Array.isArray(options.scopes) && options.scopes.length > 0) {
            tokens = tokens.filter(token =>
                options.scopes.some(scope => token.scopes.includes(scope))
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
        if (!this.#tokenStore) {
            await this.#ensureTokenStore();
        }

        if (!tokenId) {
            throw new Error('Token ID is required');
        }

        if (Object.keys(updates).length === 0) {
            throw new Error('No updates provided');
        }

        const token = this.#tokenStore.get(`tokens.${tokenId}`);

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

        // Save updates
        this.#tokenStore.set(`tokens.${tokenId}`, updatedToken);

        this.emit('token:updated', { userId: this.#userId, tokenId, updates: Object.keys(updates) });

        return updatedToken;
    }

    /**
     * Delete a token
     * @param {string} tokenId - Token ID
     * @returns {Promise<boolean>} True if deleted
     */
    async deleteToken(tokenId) {
        if (!this.#tokenStore) {
            await this.#ensureTokenStore();
        }

        if (!tokenId) {
            throw new Error('Token ID is required');
        }

        const token = this.#tokenStore.get(`tokens.${tokenId}`);

        if (!token) {
            return false; // Token doesn't exist
        }

        // Delete token
        this.#tokenStore.delete(`tokens.${tokenId}`);

        this.emit('token:deleted', { userId: this.#userId, tokenId });

        return true;
    }

    /**
     * Update token usage information
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object>} Updated token
     */
    async updateTokenUsage(tokenId) {
        if (!this.#tokenStore) {
            await this.#ensureTokenStore();
        }

        if (!tokenId) {
            throw new Error('Token ID is required');
        }

        const token = this.#tokenStore.get(`tokens.${tokenId}`);

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
            this.#tokenStore.set(`tokens.${tokenId}`, token);
            throw new Error(`Token has expired: ${tokenId}`);
        }

        // Update usage information
        const updatedToken = {
            ...token,
            lastUsed: new Date().toISOString(),
            usageCount: (token.usageCount || 0) + 1
        };

        // Save updates
        this.#tokenStore.set(`tokens.${tokenId}`, updatedToken);

        return updatedToken;
    }

    /**
     * Get the total count of tokens
     * @returns {Promise<number>} Token count
     */
    async getTokenCount() {
        if (!this.#tokenStore) {
            await this.#ensureTokenStore();
        }

        const tokens = this.#tokenStore.get('tokens', {});
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
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';
        let token = '';

        // Ensure we have at least one of each character type
        token += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
        token += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
        token += '0123456789'[Math.floor(Math.random() * 10)]; // digit
        token += '!@#$%^&*()-_=+'[Math.floor(Math.random() * 14)]; // special

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
