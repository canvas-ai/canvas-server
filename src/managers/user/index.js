'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import validator from 'validator';
import { v4 as uuidv4 } from 'uuid';
import Jim from '../../utils/jim/index.js';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('user-manager');

// Includes
import env from '../../env.js';
import User from './lib/User.js';

/**
 * Constants
 */

const USER_TYPES = ['user', 'admin'];
const USER_STATUS = ['active', 'inactive', 'deleted'];
const USER_CONFIG_FILENAME = 'user.json';

/**
 * User Manager
 */

class UserManager extends EventEmitter {

    #rootPath;
    #index;

    #users = new Map(); // Initialized User Instances, lets keep this implementation as slim as possible

    constructor(options = {}) {
        super(options.eventEmitterOptions || {});

        if (!options.rootPath) { throw new Error('Root path is required'); }
        if (!options.index) { throw new Error('Index instance is required'); }

        this.#rootPath = options.rootPath;
        this.#index = options.index;

        if (!Array.isArray(this.#index.get('workspaces'))) {
            this.#index.set('workspaces', []);
        }

        if (!Array.isArray(this.#index.get('users'))) {
            this.#index.set('users', []);
        }

        debug(`UserManager initialized with rootPath: ${this.#rootPath}`);
    }

    /**
     * Getters
     */

    get rootPath() { return this.#rootPath; }
    get index() { return this.#index.get('users', []); }
    get users() { return Array.from(this.#users.values()); }

    /**
     * Initialize manager
     */

    async initialize() {
        return true;
    }

    /**
     * User Manager API
     */

    async createUser(userData = {}) {
        try {
            this.#validateUserSettings(userData);
            const email = userData.email;
            if (await this.hasUserByEmail(email)) {
                throw new Error(`User already exists: ${email}`);
            }

            const userID = uuidv4();
            const userHomePath = await this.#createUserHomeDirectory(userID);

            const user = this.#initializeUser({
                id: userID,
                email: email,
                homePath: userHomePath,
                userType: userData.userType || 'user',
                status: 'active',
            });

            // Update the global index
            const userList = this.#index.get('users', []);
            userList.push(user.toJSON());
            this.#index.set('users', userList);

            this.emit('user:created', { id: userID, email });
            return user;

        } catch (error) {
            debug(`Error creating user: ${error}`);
            throw error;
        }
    }

    /**
     * Get a user by ID
     * @param {string} id - User ID
     * @returns {Promise<User>} User instance
     */
    async getUser(id) {
        // Check if a user instance exists in memory first
        if (this.#users.has(id)) {
            return this.#users.get(id);
        }

        // Otherwise, try to find the user in the index and initialize it
        const userData = this.index.find(user => user.id === id);
        if (!userData) {
            throw new Error(`User not found: ${id}`);
        }

        return this.#initializeUser(userData);
    }

    /**
     * Get a user by email
     * @param {string} email - User email
     * @returns {Promise<User>} User instance
     */
    async getUserByEmail(email) {
        const userData = this.index.find(user => user.email === email);
        if (!userData) {
            throw new Error(`User not found: ${email}`);
        }

        // Check if already loaded in memory
        if (this.#users.has(userData.id)) {
            return this.#users.get(userData.id);
        }

        // Initialize if not in memory
        return this.#initializeUser(userData);
    }

    /**
     * Check if user exists by ID
     * @param {string} id - User ID
     * @returns {Promise<boolean>} True if user exists
     */
    async hasUser(id) {
        if (this.#users.has(id)) return true;
        return this.index.some(user => user.id === id);
    }

    /**
     * Check if user exists by email
     * @param {string} email - User email
     * @returns {Promise<boolean>} True if user exists
     */
    async hasUserByEmail(email) {
        return this.index.some(user => user.email === email);
    }

    /**
     * List all users
     * @param {Object} options - Filtering options
     * @param {string} [options.status] - Filter by status
     * @param {string} [options.userType] - Filter by user type
     * @returns {Promise<Array<Object>>} Array of user objects (JSON representation)
     */
    async listUsers(options = {}) {
        let users = this.index;

        // Apply filters if provided
        if (options.status && USER_STATUS.includes(options.status)) {
            users = users.filter(user => user.status === options.status);
        }

        if (options.userType && USER_TYPES.includes(options.userType)) {
            users = users.filter(user => user.userType === options.userType);
        }

        return users;
    }

    /**
     * Update user properties
     * @param {string} id - User ID
     * @param {Object} userData - User data to update
     * @returns {Promise<User>} Updated user instance
     */
    async updateUser(id, userData = {}) {
        if (!id) throw new Error('User ID is required');

        const userIndex = this.index.findIndex(user => user.id === id);
        if (userIndex === -1) {
            throw new Error(`User not found: ${id}`);
        }

        // Get current user data
        const currentUser = this.index[userIndex];

        // For email updates, check if it's already in use by another user
        if (userData.email && userData.email !== currentUser.email) {
            if (this.index.some(user => user.email === userData.email && user.id !== id)) {
                throw new Error(`Email already in use: ${userData.email}`);
            }
        }

        // Prepare the update data
        const updateData = {
            ...userData,
            homePath: currentUser.homePath // Ensure homePath remains unchanged
        };

        // Validate the update data
        try {
            this.#validateUserSettings(updateData, true);
        } catch (error) {
            throw new Error(`Invalid user data: ${error.message}`);
        }

        // Update user data
        const updatedUserData = {
            ...currentUser,
            ...updateData,
            updated: new Date().toISOString()
        };

        // Update in index
        const users = [...this.index];
        users[userIndex] = updatedUserData;
        this.#index.set('users', users);

        // Update in memory if loaded
        if (this.#users.has(id)) {
            this.#users.delete(id);
            const updatedUser = this.#initializeUser(updatedUserData);
            this.emit('user:updated', { id, updates: userData });
            return updatedUser;
        }

        this.emit('user:updated', { id, updates: userData });
        return this.#initializeUser(updatedUserData);
    }

    /**
     * Delete a user
     * @param {string} id - User ID
     * @returns {Promise<boolean>} True if user was deleted
     */
    async deleteUser(id) {
        if (!id) throw new Error('User ID is required');

        const userIndex = this.index.findIndex(user => user.id === id);
        if (userIndex === -1) {
            throw new Error(`User not found: ${id}`);
        }

        // Remove from index
        const users = this.index.filter(user => user.id !== id);
        this.#index.set('users', users);

        // Remove from memory if loaded
        if (this.#users.has(id)) {
            this.#users.delete(id);
        }

        // Try to clean up user home directory
        try {
            const userHomePath = path.join(this.#rootPath, id);
            if (existsSync(userHomePath)) {
                await fs.rm(userHomePath, { recursive: true, force: true });
                debug(`Deleted user home directory: ${userHomePath}`);
            }
        } catch (error) {
            logger.error(`Failed to delete user home directory for ${id}: ${error.message}`);
            // Continue with deletion even if directory cleanup fails
        }

        this.emit('user:deleted', { id });
        return true;
    }


    /**
     * Token management
     */

    /**
     * Create a new API token for a user
     * @param {string} userId - User ID
     * @param {Object} options - Token options
     * @param {string} options.name - Token name
     * @param {string} options.description - Token description
     * @param {Date|string} [options.expiresAt] - Expiration date (ISO string or Date object)
     * @param {Array<string>} [options.scopes] - Token scopes
     * @returns {Promise<Object>} Created token object
     */
    async createApiToken(userId, options = {}) {
        if (!userId) throw new Error('User ID is required');
        if (!options.name) throw new Error('Token name is required');

        // Get User instance
        const user = await this.getUser(userId);

        // Delegate token creation to User instance
        const token = await user.createToken(options);

        this.emit('user:token:created', { userId, tokenId: token.id });
        return token;
    }

    /**
     * Get an API token by ID
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object>} Token object
     */
    async getApiToken(userId, tokenId) {
        if (!userId) throw new Error('User ID is required');
        if (!tokenId) throw new Error('Token ID is required');

        // Get User instance
        const user = await this.getUser(userId);

        // Delegate token retrieval to User instance
        return user.getToken(tokenId);
    }

    /**
     * List API tokens for a user
     * @param {string} userId - User ID
     * @param {Object} options - Filtering options
     * @param {string} [options.status] - Filter by status
     * @param {Array<string>} [options.scopes] - Filter by scopes
     * @returns {Promise<Array<Object>>} Array of token objects
     */
    async listApiTokens(userId, options = {}) {
        if (!userId) throw new Error('User ID is required');

        // Get User instance
        const user = await this.getUser(userId);

        // Delegate token listing to User instance
        return user.listTokens(options);
    }

    /**
     * Update an API token
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @param {Object} updates - Updates to apply
     * @param {string} [updates.name] - New token name
     * @param {string} [updates.description] - New token description
     * @param {string} [updates.status] - New token status
     * @param {Array<string>} [updates.scopes] - New token scopes
     * @param {Date|string} [updates.expiresAt] - New expiration date
     * @returns {Promise<Object>} Updated token object
     */
    async updateApiToken(userId, tokenId, updates = {}) {
        if (!userId) throw new Error('User ID is required');
        if (!tokenId) throw new Error('Token ID is required');
        if (Object.keys(updates).length === 0) {
            throw new Error('No updates provided');
        }

        // Get User instance
        const user = await this.getUser(userId);

        // Delegate token update to User instance
        const updatedToken = await user.updateToken(tokenId, updates);

        this.emit('user:token:updated', { userId, tokenId, updates: Object.keys(updates) });
        return updatedToken;
    }

    /**
     * Delete an API token
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<boolean>} True if token was deleted
     */
    async deleteApiToken(userId, tokenId) {
        if (!userId) throw new Error('User ID is required');
        if (!tokenId) throw new Error('Token ID is required');

        // Get User instance
        const user = await this.getUser(userId);

        // Delegate token deletion to User instance
        const result = await user.deleteToken(tokenId);

        if (result) {
            this.emit('user:token:deleted', { userId, tokenId });
        }

        return result;
    }

    /**
     * Update token usage information
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object>} Updated token object
     */
    async updateApiTokenUsage(userId, tokenId) {
        if (!userId) throw new Error('User ID is required');
        if (!tokenId) throw new Error('Token ID is required');

        // Get User instance
        const user = await this.getUser(userId);

        // Delegate token usage update to User instance
        return user.updateTokenUsage(tokenId);
    }

    /**
     * Utils
     */

    /**
     * Private methods
     */

    async #createUserHomeDirectory(userID) {
        const userHomePath = path.join(this.#rootPath, userID);
        debug(`Creating user home directory: ${userHomePath}`);

        try {
            // First create the basic user home directory
            if (!existsSync(userHomePath)) {
                await fs.mkdir(userHomePath, { recursive: true });
                debug(`User home directory created: ${userHomePath}`);
            }

            // Create Config directory for tokens
            const configDir = path.join(userHomePath, 'Config');
            if (!existsSync(configDir)) {
                await fs.mkdir(configDir, { recursive: true });
                debug(`User config directory created: ${configDir}`);
            }

            // Create the universe workspace for the user using the workspace manager
            try {
                await workspaceManager.createWorkspace('universe', userID, {
                    type: 'universe',
                    description: 'Default user workspace'
                });
                debug(`Universe workspace created for user: ${userID}`);
            } catch (wsError) {
                // If workspace already exists, just log it
                if (wsError.message && wsError.message.includes('already exists')) {
                    debug(`Universe workspace already exists for user: ${userID}`);
                } else {
                    throw wsError;
                }
            }

            return userHomePath;
        } catch (error) {
            debug(`Error creating user home directory: ${error}`);
            throw error;
        }
    }

    /**
     * Private utils
     */

    #getUserFromIndex(id) {
        const userData = this.index.find(user => user.id === id);
        if (!userData) {
            throw new Error(`User not found in the global index: ${id}`);
        }

        return this.#initializeUser(userData);
    }

    #initializeUser(userData) {
        const user = new User({
            id: userData.id,
            email: userData.email,
            homePath: userData.homePath,
            userType: userData.userType,
            status: userData.status,
        });

        this.#users.set(user.id, user);
        return user;
    }

    /**
     * Validate user settings for creation or updates
     * @param {Object} userSettings - User settings to validate
     * @param {boolean} [isUpdate=false] - If true, treat as an update validation (fewer required fields)
     * @throws {Error} If validation fails
     * @private
     */
    #validateUserSettings(userSettings, isUpdate = false) {
        if (!userSettings) {
            throw new Error('User settings are required');
        }

        // Email is required for new users, and must be valid if provided
        if (!isUpdate && !userSettings.email) {
            throw new Error('User email is required');
        }

        if (userSettings.email && !validator.isEmail(userSettings.email)) {
            throw new Error('Invalid user email');
        }

        // Validate user type if provided
        if (userSettings.userType && !USER_TYPES.includes(userSettings.userType)) {
            throw new Error(`Invalid user type: ${userSettings.userType}`);
        }

        // Validate status if provided
        if (userSettings.status && !USER_STATUS.includes(userSettings.status)) {
            throw new Error(`Invalid user status: ${userSettings.status}`);
        }
    }

}

export default UserManager;
