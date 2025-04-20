import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('service:auth:token');

/**
 * Auth Token Service
 *
 * Handles API token generation, validation, and management
 */
class AuthTokenService {
    #userManager;
    #tokenCache = new Map(); // Cache for token validation: tokenValue -> {userId, tokenId}
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
     * @returns {Promise<Object>} Created token with value
     */
    async createToken(userId, options = {}) {
        debug(`Creating API token for user ${userId}`);

        try {
            // Create token using the user's token manager
            const token = await this.#userManager.createApiToken(userId, options);

            debug(`API token created for user ${userId}: ${token.id}`);
            return token;
        } catch (error) {
            debug(`Error creating API token: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete an API token
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteToken(userId, tokenId) {
        // Remove from cache if it exists
        this.#clearTokenFromCache(userId, tokenId);
        return this.#userManager.deleteApiToken(userId, tokenId);
    }

    /**
     * Clear token from cache
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @private
     */
    #clearTokenFromCache(userId, tokenId) {
        // Find and remove from cache if exists
        for (const [tokenValue, cacheInfo] of this.#tokenCache.entries()) {
            if (cacheInfo.userId === userId && cacheInfo.tokenId === tokenId) {
                this.#tokenCache.delete(tokenValue);
                break;
            }
        }
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

        debug('Validating API token');

        try {
            // Check cache first for faster validation
            if (this.#tokenCache.has(tokenValue)) {
                const cacheInfo = this.#tokenCache.get(tokenValue);
                debug(`Token found in cache for user: ${cacheInfo.userId}`);
                return cacheInfo;
            }

            // Get all users
            const users = await this.#userManager.listUsers({ includeInactive: false });

            // Check each user's tokens
            for (const user of users) {
                const userId = user.id;
                try {
                    // Check if the user's token manager has this token
                    const result = await this.#userManager.findApiTokenByValue(userId, tokenValue);

                    if (result) {
                        // Token is valid, add to cache
                        this.#tokenCache.set(tokenValue, {
                            userId: result.userId,
                            tokenId: result.tokenId,
                        });

                        debug(`Valid token found for user: ${userId}`);
                        return {
                            userId: result.userId,
                            tokenId: result.tokenId,
                        };
                    }
                } catch (error) {
                    debug(`Error checking tokens for user ${userId}: ${error.message}`);
                }
            }

            debug('No valid token found');
            return null;
        } catch (error) {
            debug(`Error validating token: ${error.message}`);
            return null;
        }
    }
}

export default AuthTokenService;
