// Utils
import EventEmitter from 'eventemitter2';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import validator from 'validator';
import { v4 as uuidv4 } from 'uuid';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('user-manager');

// Environment
import env from '../../env.js';

// User
import User from './lib/User.js';

/**
 * User Manager
 * Manages user lifecycle and persistence
 */
class UserManager extends EventEmitter {

    #rootPath;
    #db;
    #activeUsers = new Map();
    #initialized = false;

    constructor(options = {}) {
        super(options.eventEmitterOptions);

        debug('Initializing user manager');
        if (!options.rootPath) {
            throw new Error('Root path required');
        }

        if (!options.db) {
            throw new Error('Database instance required');
        }

        this.#rootPath = options.rootPath;
        this.#db = options.db;

        debug(`User home path: ${this.#rootPath}`);
    }

    /**
     * Get the database instance
     * @returns {Object} Database instance
     */
    get db() {
        return this.#db;
    }

    /**
     * Initialize the user manager
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.#initialized) {
            return;
        }

        // Ensure user root directory exists
        try {
            await fs.mkdir(this.#rootPath, { recursive: true });
            debug(`User root directory created at ${this.#rootPath}`);
        } catch (err) {
            debug(`Error creating user root directory: ${err.message}`);
            throw err;
        }

        // Load users from database
        await this.#loadUsersFromDatabase();

        this.#initialized = true;
        debug('User manager initialized');
    }

    /**
     * Get all active users
     * @returns {Map<string, User>} Map of active users
     */
    get users() {
        return this.#activeUsers;
    }

    /**
     * Create a new user
     * @param {Object} userData - User data
     * @param {string} userData.id - User ID (optional, will be generated if not provided)
     * @param {string} userData.email - User email
     * @param {string} [userData.userType='user'] - User type ('user' or 'admin')
     * @returns {Promise<User>} Created user instance
     */
    async createUser(userData = {}) {
        const id = userData.id || uuidv4();
        const email = userData.email;
        const userType = userData.userType || 'user';

        if (!email) {
            throw new Error('Email address is required');
        }

        if (!validator.isEmail(email)) {
            throw new Error('Invalid email address provided');
        }

        if (await this.getUserByEmail(email)) {
            throw new Error(`User with email ${email} already exists`);
        }

        // Create user home directory
        const userHomePath = await this.createUserHomeDirectory(email, userType);

        // Create user record in database
        const userRecord = {
            id,
            email,
            userType,
            homePath: userHomePath,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
        };

        // Store in database
        await this.#db.put(`user:${id}`, userRecord);

        // Create and activate user instance
        const user = await this.#activateUser(userRecord);

        this.emit('user:created', user);
        debug(`User created: ${email} (${id})`);

        return user;
    }

    /**
     * Get a user by ID - alias for getUserById for backward compatibility
     * @param {string} id - User ID
     * @returns {Promise<User>} User instance
     */
    async getUser(id) {
        return this.getUserById(id);
    }

    /**
     * Get a user by ID
     * @param {string} id - User ID
     * @returns {Promise<User>} User instance
     * @throws {Error} If user not found
     */
    async getUserById(id) {
        // Check active users first
        if (this.#activeUsers.has(id)) {
            return this.#activeUsers.get(id);
        }

        // Try to load from database
        const userRecord = await this.#db.get(`user:${id}`);
        if (!userRecord) {
            throw new Error(`User with ID ${id} not found`);
        }

        // Activate user
        const user = await this.#activateUser(userRecord);
        return user;
    }

    /**
     * Get a user by email
     * @param {string} email - User email
     * @returns {Promise<User|null>} User instance or null if not found
     */
    async getUserByEmail(email) {
        // Check active users first
        for (const user of this.#activeUsers.values()) {
            if (user.email === email) {
                return user;
            }
        }

        // Query database
        try {
            // We need to scan all users since we're querying by email
            // In a production system, we would have a secondary index for email
            for (const entry of this.#db.getRange({ prefix: 'user:' })) {
                // Skip token entries
                if (entry.key.includes(':token:')) {
                    continue;
                }

                if (entry.value && entry.value.email === email) {
                    return await this.#activateUser(entry.value);
                }
            }
        } catch (error) {
            debug(`Error finding user by email: ${error.message}`);
        }

        return null;
    }

    /**
     * Check if a user exists by ID
     * @param {string} id - User ID
     * @returns {Promise<boolean>} True if user exists
     */
    async hasUser(id) {
        if (this.#activeUsers.has(id)) {
            return true;
        }

        return await this.#db.has(`user:${id}`);
    }

    /**
     * List all users
     * @param {Object} options - Options
     * @param {boolean} [options.includeInactive=false] - Include inactive users
     * @returns {Promise<Array<Object>>} Array of user objects
     */
    async listUsers(options = {}) {
        const users = [];

        // Always include active users
        for (const user of this.#activeUsers.values()) {
            users.push(user.toJSON());
        }

        // Include inactive users if requested
        if (options.includeInactive) {
            try {
                for (const entry of this.#db.getRange({ prefix: 'user:' })) {
                    // Skip token entries
                    if (entry.key.includes(':token:')) {
                        continue;
                    }

                    const userData = entry.value;
                    // Skip if already in active users
                    if (userData && !this.#activeUsers.has(userData.id)) {
                        users.push(userData);
                    }
                }
            } catch (error) {
                debug(`Error listing users: ${error.message}`);
            }
        }

        return users;
    }

    /**
     * Delete a user
     * @param {string} id - User ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteUser(id) {
        // Check if user exists
        if (!(await this.hasUser(id))) {
            throw new Error(`User with ID ${id} not found`);
        }

        // Get user if active
        let user = null;
        if (this.#activeUsers.has(id)) {
            user = this.#activeUsers.get(id);
            // Deactivate user
            await this.#deactivateUser(user);
        } else {
            // Load user data from database
            const userData = await this.#db.get(`user:${id}`);
            if (userData) {
                user = userData;
            }
        }

        // Remove from database
        await this.#db.delete(`user:${id}`);

        // We never delete user directories, just mark as deleted in database
        this.emit('user:deleted', id);
        debug(`User deleted: ${id}`);

        return true;
    }

    /**
     * Update a user
     * @param {string} id - User ID
     * @param {Object} userData - User data to update
     * @returns {Promise<User>} Updated user
     */
    async updateUser(id, userData = {}) {
        // Check if user exists
        if (!(await this.hasUser(id))) {
            throw new Error(`User with ID ${id} not found`);
        }

        // Get current user data
        const currentData = await this.#db.get(`user:${id}`);
        if (!currentData) {
            throw new Error(`User data for ${id} not found`);
        }

        // Update user data
        const updatedData = {
            ...currentData,
            ...userData,
            updated: new Date().toISOString(),
        };

        // Store updated data
        await this.#db.put(`user:${id}`, updatedData);

        // If user is active, update the instance
        if (this.#activeUsers.has(id)) {
            // Deactivate and reactivate to apply changes
            await this.#deactivateUser(this.#activeUsers.get(id));
            await this.#activateUser(updatedData);
        }

        this.emit('user:updated', updatedData);
        debug(`User updated: ${id}`);

        return this.#activeUsers.get(id) || updatedData;
    }

    /**
     * Create user home directory
     * @param {string} email - User email
     * @param {string} [userType='user'] - User type ('user' or 'admin')
     * @returns {Promise<string>} Path to user home directory
     */
    async createUserHomeDirectory(email, userType = 'user') {
        const userHomePath = path.join(this.#rootPath, email);
        const workspacesPath = path.join(userHomePath, 'workspaces');

        try {
            // Create user home directory
            await fs.mkdir(userHomePath, { recursive: true });
            debug(`Created user home directory at ${userHomePath}`);

            // Create workspaces directory
            await fs.mkdir(workspacesPath, { recursive: true });
            debug(`Created workspaces directory at ${workspacesPath}`);

            // Create user.json config file
            const userConfig = {
                email,
                userType,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
            };

            await fs.writeFile(path.join(userHomePath, 'user.json'), JSON.stringify(userConfig, null, 2));

            return userHomePath;
        } catch (err) {
            debug(`Error creating user home directory: ${err.message}`);
            throw err;
        }
    }

    /**
     * Get user home path
     * @param {string} email - User email
     * @returns {string} Path to user home directory
     */
    getUserHomePath(email) {
        return path.join(this.#rootPath, email);
    }

    /**
     * Create an API token for a user
     * @param {string} userId - User ID
     * @param {Object} options - Token options
     * @returns {Promise<Object>} Created token with value
     */
    async createApiToken(userId, options = {}) {
        const user = await this.getUserById(userId);
        return user.createApiToken(options);
    }

    /**
     * Get an API token by ID
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object|null>} Token or null if not found
     */
    async getApiToken(userId, tokenId) {
        const user = await this.getUserById(userId);
        return user.getApiToken(tokenId);
    }

    /**
     * List all API tokens for a user
     * @param {string} userId - User ID
     * @param {Object} options - Filter options
     * @returns {Promise<Array<Object>>} List of tokens
     */
    async listApiTokens(userId, options = {}) {
        const user = await this.getUserById(userId);
        return user.listApiTokens(options);
    }

    /**
     * Update an API token
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<Object|null>} Updated token or null if not found
     */
    async updateApiToken(userId, tokenId, updates = {}) {
        const user = await this.getUserById(userId);
        return user.updateApiToken(tokenId, updates);
    }

    /**
     * Delete an API token
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteApiToken(userId, tokenId) {
        const user = await this.getUserById(userId);
        return user.deleteApiToken(tokenId);
    }

    /**
     * Update API token usage
     * @param {string} userId - User ID
     * @param {string} tokenId - Token ID
     * @returns {Promise<boolean>} Success status
     */
    async updateApiTokenUsage(userId, tokenId) {
        const user = await this.getUserById(userId);
        return user.updateApiTokenUsage(tokenId);
    }

    /**
     * Activate a user
     * @param {Object} userConfig - User configuration
     * @returns {Promise<User>} Activated user instance
     * @private
     */
    async #activateUser(userConfig) {
        debug(`Activating user container: ${userConfig.id} (${userConfig.email})`);

        // Create user instance
        const user = new User(userConfig);

        try {
            // Activate user runtime
            await user.activate();

            // Add to active users
            this.#activeUsers.set(user.id, user);

            this.emit('user:activated', user);
            debug(`User activated: ${user.id} (${user.email})`);

            return user;
        } catch (err) {
            debug(`Error activating user: ${err.message}`);
            throw err;
        }
    }

    /**
     * Deactivate a user
     * @param {User} user - User instance
     * @returns {Promise<boolean>} Success status
     * @private
     */
    async #deactivateUser(user) {
        if (!this.#activeUsers.has(user.id)) {
            debug(`User not active: ${user.id}`);
            return false;
        }

        debug(`Deactivating user: ${user.id} (${user.email})`);

        try {
            // Deactivate user runtime
            await user.deactivate();

            // Remove from active users
            this.#activeUsers.delete(user.id);

            this.emit('user:deactivated', user.id);
            debug(`User deactivated: ${user.id} (${user.email})`);

            return true;
        } catch (err) {
            debug(`Error deactivating user: ${err.message}`);
            throw err;
        }
    }

    /**
     * Load users from database
     * @returns {Promise<void>}
     * @private
     */
    async #loadUsersFromDatabase() {
        debug('Loading users from database');

        try {
            // Get all user records from database
            for (const entry of this.#db.getRange({ prefix: 'user:' })) {
                // Skip token entries
                if (entry.key.includes(':token:')) {
                    continue;
                }

                const userData = entry.value;
                if (userData) {
                    debug(`Fetched user: ${userData.id} (${userData.email}) from database`);
                    try {
                        // Activate user
                        await this.#activateUser(userData);
                    } catch (error) {
                        debug(`Error activating user ${userData.id}: ${error.message}`);
                        // Continue with next user
                    }
                }
            }

            debug(`Loaded ${this.#activeUsers.size} users from database`);
        } catch (error) {
            debug(`Error loading users from database: ${error.message}`);
            // Don't throw, just log the error
        }
    }
}

export default UserManager;
