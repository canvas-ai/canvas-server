import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('canvas:auth:token');

/**
 * Auth Token Service
 *
 * Handles API token generation, validation, and management
 */
class AuthTokenService {
    #userManager;
    #tokenCache = new Map(); // Cache for token validation
    #initialized = false;

    /**
     * Create a new AuthTokenService
     * @param {Object} options - Options
     * @param {Object} options.userManager - User manager instance
     */
    constructor(options = {}) {
        if (!options.userManager) {
            throw new Error('User manager is required');
        }

        this.#userManager = options.userManager;
        debug('Auth token service created');
    }

    /**
     * Initialize the auth token service
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.#initialized) {
            return;
        }

        debug('Initializing auth token service');
        this.#initialized = true;
        debug('Auth token service initialized');
    }

    /**
     * Stop the auth token service
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this.#initialized) {
            return;
        }

        debug('Stopping auth token service');
        this.#tokenCache.clear();
        this.#initialized = false;
    }

    /**
     * Create a new API token for a user
     * @param {string} userId - User ID
     * @param {Object} options - Token options
     * @param {string} options.name - Token name
     * @param {string} options.description - Token description
     * @param {Array<string>} options.scopes - Token scopes/permissions
     * @param {number|null} options.expiresInDays - Token expiration in days or null for no expiration
     * @returns {Promise<Object>} Created token with value
     */
    async createToken(userId, options = {}) {
        debug(`Creating API token for user ${userId}`);

        // Calculate expiration date if provided
        let expiresAt = null;
        if (options.expiresInDays) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + options.expiresInDays);
        }

        // Create token
        const token = await this.#userManager.createApiToken(userId, {
            name: options.name || 'API Token',
            description: options.description || '',
            scopes: options.scopes || ['*'],
            expiresAt
        });

        // Store token value in cache for validation
        // Format: userId:tokenId:tokenValue
        const cacheKey = `${userId}:${token.id}:${token.value}`;
        this.#tokenCache.set(token.value, cacheKey);

        debug(`API token created for user ${userId}: ${token.id}`);
        return token;
    }

    /**
     * Get an API token by ID
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object|null>} Token or null if not found
     */
    async getToken(userId, tokenId) {
        return this.#userManager.getApiToken(userId, tokenId);
    }

    /**
     * List all API tokens for a user
     * @param {string} userId - User ID
     * @param {Object} options - Filter options
     * @param {boolean} options.includeExpired - Whether to include expired tokens
     * @returns {Promise<Array<Object>>} List of tokens
     */
    async listTokens(userId, options = {}) {
        return this.#userManager.listApiTokens(userId, options);
    }

    /**
     * Update an API token
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<Object|null>} Updated token or null if not found
     */
    async updateToken(userId, tokenId, updates = {}) {
        return this.#userManager.updateApiToken(userId, tokenId, updates);
    }

    /**
     * Delete an API token
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteToken(userId, tokenId) {
        // Remove from cache if exists
        for (const [tokenValue, cacheKey] of this.#tokenCache.entries()) {
            if (cacheKey.startsWith(`${userId}:${tokenId}:`)) {
                this.#tokenCache.delete(tokenValue);
                break;
            }
        }

        return this.#userManager.deleteApiToken(userId, tokenId);
    }

    /**
     * Validate an API token
     * @param {string} tokenValue - Token value
     * @returns {Promise<Object|null>} User ID and token ID if valid, null if invalid
     */
    async validateToken(tokenValue) {
        if (!tokenValue) {
            return null;
        }

        debug(`Validating API token`);

        try {
            // Check cache first
            const cacheKey = this.#tokenCache.get(tokenValue);
            if (cacheKey) {
                const [userId, tokenId] = cacheKey.split(':');

                // Get token from user
                const token = await this.#userManager.getApiToken(userId, tokenId);

                // Check if token exists and is not expired
                if (token) {
                    const now = new Date().toISOString();
                    if (!token.expiresAt || token.expiresAt > now) {
                        // Update last used timestamp
                        await this.#userManager.updateApiTokenUsage(userId, tokenId);

                        return { userId, tokenId };
                    }
                }

                // Token expired or not found, remove from cache
                this.#tokenCache.delete(tokenValue);
            }

            // If not in cache, we need to scan all users and their tokens
            // This is inefficient but necessary for tokens created before this service was running
            const users = await this.#userManager.listUsers({ includeInactive: false });

            for (const userData of users) {
                const userId = userData.id;
                try {
                    const user = await this.#userManager.getUserById(userId);
                    const tokens = user.listApiTokens({ includeExpired: false });

                    // We can't directly check token values since they're not stored
                    // This is a limitation of the current design
                    // In a real implementation, we would need to store a hash of the token value

                    // For now, we'll just return null
                    debug(`Token validation requires token value to be in cache`);
                } catch (error) {
                    debug(`Error checking tokens for user ${userId}: ${error.message}`);
                }
            }
        } catch (error) {
            debug(`Error validating token: ${error.message}`);
        }

        return null;
    }
}

export default AuthTokenService;
