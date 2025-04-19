'use strict';

// Utils
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import validator from 'validator';
import { v4 as uuidv4 } from 'uuid';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('user-manager');

// Includes
import User from './lib/User.js';

// Base Manager
import Manager from '../base/Manager.js';

/**
 * Constants
 */

const USER_TYPES = ['user', 'admin'];
const USER_STATUS = ['active', 'inactive', 'deleted'];

/**
 * User Manager
 */

class UserManager extends Manager {

    #rootPath;
    #users = new Map(); // Initialized User Instances, keeps this implementation as slim as possible
    #workspaceManager; // Reference to workspace manager (injected)

    /**
     * Create a new UserManager
     * @param {Object} options - Manager options
     * @param {string} options.rootPath - Root path for user homes
     * @param {Object} options.jim - JSON Index Manager
     * @param {Object} [options.workspaceManager] - Workspace manager (can be set later)
     */
    constructor(options = {}) {
        super({
            jim: options.jim,
            indexName: 'users',
            eventEmitterOptions: options.eventEmitterOptions
        });

        if (!options.rootPath) {
            throw new Error('Root path is required');
        }

        this.#rootPath = options.rootPath;

        // Optional workspace manager - can be set later if needed
        this.#workspaceManager = options.workspaceManager || null;

        // Initialize the users array in the index if it doesn't exist
        if (!Array.isArray(this.getConfig('users'))) {
            this.setConfig('users', []);
        }

        debug(`UserManager initialized with rootPath: ${this.#rootPath}`);
    }

    /**
     * Getters
     */

    get rootPath() { return this.#rootPath; }
    get users() { return Array.from(this.#users.values()); }
    get usersList() { return this.getConfig('users', []); }
    get workspaceManager() { return this.#workspaceManager; }

    /**
     * Set the workspace manager reference
     * This allows for lazy dependency injection
     * @param {Object} workspaceManager - Workspace manager instance
     */
    setWorkspaceManager(workspaceManager) {
        if (!workspaceManager) {
            throw new Error('Workspace manager is required');
        }
        this.#workspaceManager = workspaceManager;
        debug('Workspace manager reference set');
    }

    /**
     * Initialize manager
     * @override
     */
    async initialize() {
        if (this.initialized) {
            return true;
        }

        debug('Initializing UserManager');

        // Any additional initialization logic can go here

        // Call the parent initialize to mark as initialized
        return super.initialize();
    }

    /**
     * User Manager API
     */

    /**
     * Create a new user with a Universe workspace
     * @param {Object} userData - User data
     * @param {string} userData.email - User email (required)
     * @param {string} [userData.userType='user'] - User type: 'user' or 'admin'
     * @param {string} [userData.status='active'] - User status
     * @returns {Promise<User>} Newly created user
     */
    async createUser(userData = {}) {
        try {
            this.#validateUserSettings(userData);
            const email = userData.email;

            // Always perform a case-insensitive email check to ensure uniqueness
            const lowerCaseEmail = email.toLowerCase();
            const existingUser = this.usersList.find(
                user => user.email.toLowerCase() === lowerCaseEmail
            );

            if (existingUser) {
                throw new Error(`User already exists with email: ${email}`);
            }

            const userID = uuidv4();

            // Create the user's Universe workspace
            const userHomePath = await this.createUserHome(userID, email);

            const user = this.#initializeUser({
                id: userID,
                email: email,
                homePath: userHomePath,
                userType: userData.userType || 'user',
                status: 'active',
            });

            // Update the global index
            const userList = [...this.usersList];
            userList.push(user.toJSON());
            this.setConfig('users', userList);

            // Create a generic API token for the user
            const tokenName = 'default-token';
            const tokenOptions = {
                name: tokenName,
                description: `Default API token for ${email}`,
                expiresAt: null // No expiration
            };

            const apiToken = await user.createToken(tokenOptions);
            debug(`Created default API token for user ${email}`);

            // For admin users, log the token to console
            if (userData.userType === 'admin') {
                console.log('\n' + '='.repeat(80));
                console.log('Canvas Admin User API Token');
                console.log('='.repeat(80));
                console.log(`Token: ${apiToken.value}`);
                console.log('='.repeat(80) + '\n');
            }

            this.emit('user:created', { id: userID, email });
            return user;

        } catch (error) {
            debug(`Error creating user: ${error}`);
            throw error;
        }
    }

    /**
     * Create a user's home structure as a Universe workspace
     * @param {string} userId - User ID
     * @param {string} userEmail - User email
     * @returns {Promise<string>} Path to the user's home
     */
    async createUserHome(userId, userEmail) {
        if (!this.#workspaceManager) {
            throw new Error('WorkspaceManager is required to create a user home');
        }

        const userHomePath = path.join(this.#rootPath, userEmail);
        debug(`Creating user home (Universe workspace) at: ${userHomePath}`);

        try {
            // Use a namespaced ID for the workspace to ensure uniqueness
            // Format: user-{userId}-universe
            const namespaceWorkspaceId = `user-${userId.substring(0, 8)}-universe`;

            // Create Universe workspace for the user with namespaced ID
            await this.#workspaceManager.createWorkspace('universe', userId, {
                id: namespaceWorkspaceId,
                rootPath: userHomePath,
                type: 'universe',
                description: `Default universe workspace for ${userEmail}`,
                owner: userId
            });

            debug(`Universe workspace created for user: ${userId}`);
            return userHomePath;
        } catch (error) {
            debug(`Error creating user home: ${error}`);
            // Clean up directory if workspace creation failed
            if (existsSync(userHomePath)) {
                try {
                    await fs.rm(userHomePath, { recursive: true, force: true });
                } catch (cleanupError) {
                    debug(`Failed to clean up user home directory: ${cleanupError}`);
                }
            }
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
        const userData = this.usersList.find(user => user.id === id);
        if (!userData) {
            throw new Error(`User not found: ${id}`);
        }

        return this.#initializeUser(userData);
    }

    /**
     * Get a user by ID (wrapper for async getUser)
     * @param {string} id - User ID
     * @returns {Promise<User>} User instance
     */
    getUserById(id) {
        return this.getUser(id);
    }

    /**
     * Get a user by email
     * @param {string} email - User email
     * @returns {Promise<User>} User instance
     */
    async getUserByEmail(email) {
        const userData = this.usersList.find(user => user.email === email);
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
     * Check if user exists by ID and verify home directory
     * @param {string} id - User ID
     * @returns {Promise<boolean>} True if user exists with valid home directory
     */
    async hasUser(id) {
        // First check if user exists in memory or index
        const userInMemory = this.#users.has(id);
        const userInIndex = this.usersList.some(user => user.id === id);

        if (!userInMemory && !userInIndex) {
            return false; // User doesn't exist at all
        }

        // Get user data to check home path
        let userData;
        if (userInMemory) {
            userData = this.#users.get(id);
        } else {
            userData = this.usersList.find(user => user.id === id);
        }

        // Check if home directory exists
        if (userData && userData.homePath) {
            const homeExists = existsSync(userData.homePath);

            // If user exists in index but home doesn't exist, mark user as having issues
            if (!homeExists && userInIndex) {
                debug(`User ${id} exists in index but home directory ${userData.homePath} is missing`);

                // Update user status in the index to indicate missing home
                try {
                    const userList = [...this.usersList];
                    const userIndex = userList.findIndex(user => user.id === id);
                    if (userIndex !== -1) {
                        userList[userIndex] = {
                            ...userList[userIndex],
                            status: 'error',
                            error: 'Home directory missing',
                            updated: new Date().toISOString()
                        };
                        this.setConfig('users', userList);
                        debug(`User ${id} marked as having error in index`);
                    }
                } catch (error) {
                    logger.error(`Failed to update user status for ${id}: ${error.message}`);
                }
            }

            return homeExists;
        }

        return false; // No home path in user data
    }

    /**
     * Check if user exists by email and verify home directory
     * @param {string} email - User email
     * @returns {Promise<boolean>} True if user exists with valid home directory
     */
    async hasUserByEmail(email) {
        // Always perform a case-insensitive email check
        const lowerCaseEmail = email.toLowerCase();

        // Check if user exists in index
        const userData = this.usersList.find(user => user.email.toLowerCase() === lowerCaseEmail);

        if (!userData) {
            return false; // User doesn't exist
        }

        // Check if home directory exists
        if (userData.homePath) {
            const homeExists = existsSync(userData.homePath);

            // If user exists in index but home doesn't exist, mark user as having issues
            if (!homeExists) {
                debug(`User with email ${email} exists in index but home directory ${userData.homePath} is missing`);

                // Update user status in the index to indicate missing home
                try {
                    const userList = [...this.usersList];
                    const userIndex = userList.findIndex(user => user.id === userData.id);
                    if (userIndex !== -1) {
                        userList[userIndex] = {
                            ...userList[userIndex],
                            status: 'error',
                            error: 'Home directory missing',
                            updated: new Date().toISOString()
                        };
                        this.setConfig('users', userList);
                        debug(`User ${userData.id} marked as having error in index`);
                    }
                } catch (error) {
                    logger.error(`Failed to update user status for ${userData.id}: ${error.message}`);
                }
            }

            return homeExists;
        }

        return false; // No home path in user data
    }

    /**
     * List all users
     * @param {Object} options - Filtering options
     * @param {string} [options.status] - Filter by status
     * @param {string} [options.userType] - Filter by user type
     * @returns {Promise<Array<Object>>} Array of user objects (JSON representation)
     */
    async listUsers(options = {}) {
        let users = this.usersList;

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

        const userList = this.usersList;
        const userIndex = userList.findIndex(user => user.id === id);

        if (userIndex === -1) {
            throw new Error(`User not found: ${id}`);
        }

        // Get current user data
        const currentUser = userList[userIndex];

        // For email updates, check if it's already in use by another user (case-insensitive check)
        if (userData.email && userData.email.toLowerCase() !== currentUser.email.toLowerCase()) {
            const lowerCaseNewEmail = userData.email.toLowerCase();

            if (userList.some(user =>
                user.email.toLowerCase() === lowerCaseNewEmail &&
                user.id !== id
            )) {
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
        const users = [...userList];
        users[userIndex] = updatedUserData;
        this.setConfig('users', users);

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

        const userList = this.usersList;
        const userIndex = userList.findIndex(user => user.id === id);

        if (userIndex === -1) {
            throw new Error(`User not found: ${id}`);
        }

        // Get user for home path
        const user = userList[userIndex];
        const userHomePath = user.homePath;

        // Remove from index
        const users = userList.filter(user => user.id !== id);
        this.setConfig('users', users);

        // Remove from memory if loaded
        if (this.#users.has(id)) {
            this.#users.delete(id);
        }

        // Try to clean up user home directory
        try {
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
     * Token management - delegated to User instance
     */

    async createApiToken(userId, options = {}) {
        if (!userId) throw new Error('User ID is required');
        if (!options.name) throw new Error('Token name is required');

        // Get User instance
        const user = await this.getUser(userId);
        const token = await user.createToken(options);
        this.emit('user:token:created', { userId, tokenId: token.id });
        return token;
    }

    async getApiToken(userId, tokenId) {
        if (!userId) throw new Error('User ID is required');
        if (!tokenId) throw new Error('Token ID is required');
        const user = await this.getUser(userId);
        return user.getToken(tokenId);
    }

    async listApiTokens(userId, options = {}) {
        if (!userId) throw new Error('User ID is required');
        const user = await this.getUser(userId);
        return user.listTokens(options);
    }

    async updateApiToken(userId, tokenId, updates = {}) {
        if (!userId) throw new Error('User ID is required');
        if (!tokenId) throw new Error('Token ID is required');
        if (Object.keys(updates).length === 0) {
            throw new Error('No updates provided');
        }

        const user = await this.getUser(userId);
        const updatedToken = await user.updateToken(tokenId, updates);
        this.emit('user:token:updated', { userId, tokenId, updates: Object.keys(updates) });
        return updatedToken;
    }

    async deleteApiToken(userId, tokenId) {
        if (!userId) throw new Error('User ID is required');
        if (!tokenId) throw new Error('Token ID is required');
        const user = await this.getUser(userId);
        const result = await user.deleteToken(tokenId);
        if (result) {
            this.emit('user:token:deleted', { userId, tokenId });
        }
        return result;
    }

    async updateApiTokenUsage(userId, tokenId) {
        if (!userId) throw new Error('User ID is required');
        if (!tokenId) throw new Error('Token ID is required');
        const user = await this.getUser(userId);
        return user.updateTokenUsage(tokenId);
    }

    /**
     * Find an API token by its raw value
     * @param {string} userId - User ID
     * @param {string} tokenValue - Token value to find
     * @returns {Promise<Object|null>} Token details with tokenId and userId if found, null otherwise
     */
    async findApiTokenByValue(userId, tokenValue) {
        if (!userId) throw new Error('User ID is required');
        if (!tokenValue) throw new Error('Token value is required');

        try {
            const user = await this.getUser(userId);
            const result = await user.findTokenByValue(tokenValue);
            return result;
        } catch (error) {
            debug(`Error finding token by value for user ${userId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Private methods
     */

    #initializeUser(userData) {
        const user = new User({
            id: userData.id,
            email: userData.email,
            homePath: userData.homePath,
            userType: userData.userType,
            status: userData.status,
            jim: this.jim  // Pass JIM to User instance for token management
        });

        // Set reference to this user manager in the JIM instance
        this.setJimParentManager(this);

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

    /**
     * Get the workspace manager reference
     * @returns {Object} - Workspace manager instance
     */
    getWorkspaceManager() {
        return this.#workspaceManager;
    }
}

export default UserManager;
