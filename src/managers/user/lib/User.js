'use strict';

// Utils
import path from 'path';
import fs from 'fs/promises';
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('user');
import EventEmitter from 'eventemitter2';
import { existsSync } from 'fs';

// Manager singletons
import workspaceManager from '../../../Server.js';
import contextManager from '../../../Server.js';

// Local imports
import TokenManager from './TokenManager.js';

/**
 * User Class
 */

class User extends EventEmitter {

    // Immutable properties set at construction
    #id;
    #email;
    #userType;
    #homePath;

    // Manager instances
    #tokenManager;

    // Runtime state
    #status = 'inactive'; // inactive, active, disabled, deleted
    #startTime;

    // User stats
    #stats = {
        workspaces: {
            total: 0,
            open: 0,
        },
        contexts: {
            total: 0,
            active: 0,
        },
        apiTokens: {
            global: 0,
            perWorkspace: 0,
        },
    };

    constructor(options = {}) {
        super(options.eventEmitterOptions || {});

        if (!options.id) { throw new Error('User ID is required'); }
        if (!options.email) { throw new Error('Email is required'); }
        if (!options.homePath) { throw new Error('Home path is required'); }

        /**
         * User properties
         */

        this.#id = options.id;
        this.#email = options.email;
        this.#homePath = options.homePath;
        this.#userType = options.userType || 'user';
        this.#status = options.status || 'inactive';

        // Initialize token manager if home path exists
        this.#initializeTokenManager();

        debug(`User instance created: ${this.#id} (${this.#email})`);
    }

    /**
     * Getters
     */

    get id() { return this.#id; }
    get email() { return this.#email; }
    get userType() { return this.#userType; }
    get homePath() { return this.#homePath; }
    get status() { return this.#status; }
    get stats() { return this.#stats; }
    get tokenManager() { return this.#tokenManager; }

    isAdmin() { return this.#userType === 'admin'; }
    isActive() { return this.#status === 'active'; }

    /**
     * Initialize the token manager for this user
     * @private
     */
    #initializeTokenManager() {
        try {
            this.#tokenManager = new TokenManager({
                userId: this.#id,
                userHomePath: this.#homePath
            });

            // Listen to token manager events to update stats
            this.#tokenManager.on('token:created', this.#handleTokenCreated.bind(this));
            this.#tokenManager.on('token:deleted', this.#handleTokenDeleted.bind(this));

            // Forward token events from token manager to user's event emitter
            this.#tokenManager.onAny((event, data) => {
                this.emit(event, data);
            });

            debug(`Token manager initialized for user ${this.#id}`);
        } catch (error) {
            debug(`Failed to initialize token manager: ${error.message}`);
        }
    }

    /**
     * Token event handlers
     */

    /**
     * Handle token created event
     * @param {Object} data - Event data
     * @private
     */
    #handleTokenCreated(data) {
        this.#stats.apiTokens.global++;
    }

    /**
     * Handle token deleted event
     * @param {Object} data - Event data
     * @private
     */
    #handleTokenDeleted(data) {
        if (this.#stats.apiTokens.global > 0) {
            this.#stats.apiTokens.global--;
        }
    }

    /**
     * Token Management (Delegated to TokenManager)
     */

    /**
     * Create a new API token
     * @param {Object} options - Token options
     * @returns {Promise<Object>} Created token
     */
    async createToken(options = {}) {
        if (!this.#tokenManager) {
            await this.#ensureTokenManager();
        }
        return this.#tokenManager.createToken(options);
    }

    /**
     * Get a token by ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object>} Token object
     */
    async getToken(tokenId) {
        if (!this.#tokenManager) {
            await this.#ensureTokenManager();
        }
        return this.#tokenManager.getToken(tokenId);
    }

    /**
     * List all tokens or filter by criteria
     * @param {Object} options - Filter options
     * @returns {Promise<Array<Object>>} Array of tokens
     */
    async listTokens(options = {}) {
        if (!this.#tokenManager) {
            await this.#ensureTokenManager();
        }
        return this.#tokenManager.listTokens(options);
    }

    /**
     * Update a token's properties
     * @param {string} tokenId - Token ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<Object>} Updated token
     */
    async updateToken(tokenId, updates = {}) {
        if (!this.#tokenManager) {
            await this.#ensureTokenManager();
        }
        return this.#tokenManager.updateToken(tokenId, updates);
    }

    /**
     * Delete a token
     * @param {string} tokenId - Token ID
     * @returns {Promise<boolean>} True if deleted
     */
    async deleteToken(tokenId) {
        if (!this.#tokenManager) {
            await this.#ensureTokenManager();
        }
        return this.#tokenManager.deleteToken(tokenId);
    }

    /**
     * Update token usage information
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object>} Updated token
     */
    async updateTokenUsage(tokenId) {
        if (!this.#tokenManager) {
            await this.#ensureTokenManager();
        }
        return this.#tokenManager.updateTokenUsage(tokenId);
    }

    /**
     * Ensure the token manager exists and is initialized
     * @private
     */
    async #ensureTokenManager() {
        if (this.#tokenManager) return;

        // Create Config directory if it doesn't exist
        const configDir = path.join(this.#homePath, 'Config');
        if (!existsSync(configDir)) {
            await fs.mkdir(configDir, { recursive: true });
        }

        this.#initializeTokenManager();

        if (!this.#tokenManager) {
            throw new Error(`Failed to initialize token manager for user ${this.#id}`);
        }
    }

    /**
     * Convert user to JSON
     * @returns {Object} User JSON representation
     */
    toJSON() {
        return {
            id: this.#id,
            email: this.#email,
            userType: this.#userType,
            homePath: this.#homePath,
            status: this.#status,
            stats: this.#stats
        };
    }
}

export default User;
