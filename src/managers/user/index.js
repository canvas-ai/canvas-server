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

    #workspaceManager;

    /**
     * Create a new UserManager
     * @param {Object} options - Manager options
     * @param {string} options.rootPath - Root path for user homes
     * @param {Object} options.jim - JSON Index Manager
     * @param {Object} [options.workspaceManager] - Workspace manager (can be set later)
     * @param {Object} [options.authManager] - Auth manager (can be set later)
     */
    constructor(options = {}) {
        super({
            jim: options.jim,
            indexName: 'users',
            eventEmitterOptions: options.eventEmitterOptions,
        });

        if (!options.rootPath) {
            throw new Error('Root path is required');
        }
        this.#rootPath = options.rootPath;

        if (!options.workspaceManager) {
            throw new Error('Workspace manager is required');
        }
        this.#workspaceManager = options.workspaceManager;

        // Initialize the users array in the index if it doesn't exist
        if (!Array.isArray(this.getConfig('users'))) {
            this.setConfig('users', []);
        }

        debug(`UserManager initialized with user home rootPath: ${this.#rootPath}`);
    }

    /**
     * Getters
     */

    get rootPath() {
        return this.#rootPath;
    }

    get users() {
        return Array.from(this.#users.values());
    }

    get usersList() {
        return this.getConfig('users', []);
    }

    get workspaceManager() {
        return this.#workspaceManager;
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

        // Initialize base manager
        await super.initialize();

        // Initialize token storage if it doesn't exist
        if (!this.getConfig('auth:tokens')) {
            this.setConfig('auth:tokens', {});
        }

        return true;
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
     * @param {boolean} [userData.createToken=true] - Whether to create a default API token
     * @returns {Promise<User>} Created user
     */
    async createUser(userData = {}) {
        try {
            this.#validateUserSettings(userData);
            const email = userData.email;

            // Always perform a case-insensitive email check to ensure uniqueness
            const lowerCaseEmail = email.toLowerCase();
            const existingUser = this.usersList.find((user) => user.email.toLowerCase() === lowerCaseEmail);

            if (existingUser) {
                throw new Error(`User already exists with email: ${email}`);
            }

            const userID = super.generateId('u', 8, '');
            const userHomePath = userData.homePath || path.join(this.#rootPath, email);

            // Create user home directory with the correct user ID
            await this.createUserHome(userHomePath, userID, email);

            // Initialize user with all required options
            const user = this.#initializeUser({
                id: userID,
                email: email,
                homePath: userHomePath,
                userType: userData.userType || 'user',
                status: userData.status || 'active',
                workspaceManager: this.#workspaceManager,
                eventEmitterOptions: this.eventEmitterOptions
            });

            // Update the global index
            const userList = [...this.usersList];
            userList.push(user.toJSON());
            this.setConfig('users', userList);
            this.emit('user:created', { id: userID, email });
            return user;
        } catch (error) {
            debug(`Error creating user: ${error}`);
            throw error;
        }
    }

    /**
     * Create a user's home structure as a Universe workspace
     * @param {string} homePath - Path to the user's home
     * @param {string} userId - User ID
     * @param {string} userEmail - User email
     * @returns {Promise<string>} Path to the user's home
     */
    async createUserHome(homePath, userId, userEmail) {
        if (!this.#workspaceManager) {
            throw new Error('WorkspaceManager is required to create a user home');
        }

        const userHomePath = path.resolve(homePath);
        debug(`Creating user home (Universe workspace) at: ${userHomePath}`);

        try {
            await this.#workspaceManager.createWorkspace(userEmail, 'universe', {
                workspacePath: userHomePath,
                type: 'universe',
                color: '#fff',
                description: 'And then there was geometry...',
                owner: userEmail,
            });

            debug(`Universe workspace created for user: ${userEmail} (${userId})`);
            return userHomePath;
        } catch (error) {
            debug(`Error creating user home: ${error}`);
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
        const userData = this.usersList.find((user) => user.id === id);
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
        const userData = this.usersList.find((user) => user.email === email);
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
        const userInIndex = this.usersList.some((user) => user.id === id);

        if (!userInMemory && !userInIndex) {
            return false; // User doesn't exist at all
        }

        // Get user data to check home path
        let userData;
        if (userInMemory) {
            userData = this.#users.get(id);
        } else {
            userData = this.usersList.find((user) => user.id === id);
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
                    const userIndex = userList.findIndex((user) => user.id === id);
                    if (userIndex !== -1) {
                        userList[userIndex] = {
                            ...userList[userIndex],
                            status: 'error',
                            error: 'Home directory missing',
                            updated: new Date().toISOString(),
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
        const userData = this.usersList.find((user) => user.email.toLowerCase() === lowerCaseEmail);

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
                    const userIndex = userList.findIndex((user) => user.id === userData.id);
                    if (userIndex !== -1) {
                        userList[userIndex] = {
                            ...userList[userIndex],
                            status: 'error',
                            error: 'Home directory missing',
                            updated: new Date().toISOString(),
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
            users = users.filter((user) => user.status === options.status);
        }

        if (options.userType && USER_TYPES.includes(options.userType)) {
            users = users.filter((user) => user.userType === options.userType);
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
        const userIndex = userList.findIndex((user) => user.id === id);

        if (userIndex === -1) {
            throw new Error(`User not found: ${id}`);
        }

        // Get current user data
        const currentUser = userList[userIndex];

        // For email updates, check if it's already in use by another user (case-insensitive check)
        if (userData.email && userData.email.toLowerCase() !== currentUser.email.toLowerCase()) {
            const lowerCaseNewEmail = userData.email.toLowerCase();

            if (userList.some((user) => user.email.toLowerCase() === lowerCaseNewEmail && user.id !== id)) {
                throw new Error(`Email already in use: ${userData.email}`);
            }
        }

        // Prepare the update data
        const updateData = {
            ...userData,
            homePath: currentUser.homePath, // Ensure homePath remains unchanged
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
            updated: new Date().toISOString(),
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
        const userIndex = userList.findIndex((user) => user.id === id);

        if (userIndex === -1) {
            throw new Error(`User not found: ${id}`);
        }

        // Get user for home path
        const user = userList[userIndex];
        const userHomePath = user.homePath;

        // Remove from index
        const users = userList.filter((user) => user.id !== id);
        this.setConfig('users', users);

        // Remove from memory if loaded
        if (this.#users.has(id)) {
            this.#users.delete(id);
        }

        console.log(`User home directory left in place: ${userHomePath}`);
        this.emit('user:deleted', { id });
        return true;
    }

    /**
     * Token management - delegated to AuthService
     * These methods are kept for backward compatibility
     */

    async createApiToken(userId, options = {}) {
        if (!userId) throw new Error('User ID is required');
        if (!options.name) throw new Error('Token name is required');

        // Get auth service from the server (if available)
        const authService = this.server?.services?.get('auth');

        if (authService) {
            return authService.createToken(userId, options);
        } else {
            throw new Error('Auth service is not available for token management');
        }
    }

    async getApiToken(userId, tokenId) {
        if (!userId) throw new Error('User ID is required');
        if (!tokenId) throw new Error('Token ID is required');

        // Get auth service from the server (if available)
        const authService = this.server?.services?.get('auth');

        if (authService) {
            const token = await authService.getToken(tokenId);
            // Verify token belongs to user
            if (token.userId !== userId) {
                throw new Error(`Token ${tokenId} does not belong to user ${userId}`);
            }
            return token;
        } else {
            throw new Error('Auth service is not available for token management');
        }
    }

    async listApiTokens(userId, options = {}) {
        if (!userId) throw new Error('User ID is required');

        // Get auth service from the server (if available)
        const authService = this.server?.services?.get('auth');

        if (authService) {
            return authService.listTokens(userId, options);
        } else {
            throw new Error('Auth service is not available for token management');
        }
    }

    async updateApiToken(userId, tokenId, updates = {}) {
        if (!userId) throw new Error('User ID is required');
        if (!tokenId) throw new Error('Token ID is required');
        if (Object.keys(updates).length === 0) {
            throw new Error('No updates provided');
        }

        // Get auth service from the server (if available)
        const authService = this.server?.services?.get('auth');

        if (authService) {
            // Verify token belongs to user
            const token = await authService.getToken(tokenId);
            if (token.userId !== userId) {
                throw new Error(`Token ${tokenId} does not belong to user ${userId}`);
            }

            return authService.updateToken(tokenId, updates);
        } else {
            throw new Error('Auth service is not available for token management');
        }
    }

    async deleteApiToken(userId, tokenId) {
        if (!userId) throw new Error('User ID is required');
        if (!tokenId) throw new Error('Token ID is required');

        // Get auth service from the server (if available)
        const authService = this.server?.services?.get('auth');

        if (authService) {
            // Verify token belongs to user
            try {
                const token = await authService.getToken(tokenId);
                if (token.userId !== userId) {
                    throw new Error(`Token ${tokenId} does not belong to user ${userId}`);
                }
            } catch (error) {
                if (error.message.includes('not found')) {
                    return false; // Token doesn't exist
                }
                throw error;
            }

            return authService.deleteToken(tokenId);
        } else {
            throw new Error('Auth service is not available for token management');
        }
    }

    async updateApiTokenUsage(userId, tokenId) {
        if (!userId) throw new Error('User ID is required');
        if (!tokenId) throw new Error('Token ID is required');

        // Get auth service from the server (if available)
        const authService = this.server?.services?.get('auth');

        if (authService) {
            // Verify token belongs to user
            const token = await authService.getToken(tokenId);
            if (token.userId !== userId) {
                throw new Error(`Token ${tokenId} does not belong to user ${userId}`);
            }

            return authService.updateTokenUsage(tokenId);
        } else {
            throw new Error('Auth service is not available for token management');
        }
    }

    /**
     * Finds a user by the raw API token value
     * @param {string} tokenValue - The raw API token value provided by the client.
     * @returns {Promise<{userId: string, tokenId: string}|null>} Object with userId and tokenId if found and valid, otherwise null.
     */
    async findUserByApiTokenValue(tokenValue) {
        if (!tokenValue) {
            debug('findUserByApiTokenValue called with empty tokenValue.');
            return null;
        }

        // Get auth service from the server (if available)
        const authService = this.server?.services?.get('auth');

        if (authService) {
            return authService.validateApiToken(tokenValue);
        } else {
            debug('Auth service not available for token validation.');
            return null;
        }
    }

    /**
     * Set server reference
     * @param {Object} server - Server instance
     */
    setServer(server) {
        this.server = server;

        // If the context manager is available from the server, set it on all users
        if (server && server.contextManager) {
            this.#setupDependencies();
        }
    }

    /**
     * Setup dependencies for all users
     * This is called when the server is set or when the context manager becomes available
     * @private
     */
    #setupDependencies() {
        if (!this.server) return;

        const contextManager = this.server.contextManager;
        const sessionManager = this.server.sessionManager;

        if (contextManager || sessionManager) {
            debug('Setting up dependencies for all users');

            // Update all user instances with the context manager
            this.#users.forEach(user => {
                if (contextManager) {
                    user.setContextManager(contextManager);
                }

                if (sessionManager) {
                    user.setSessionManager(sessionManager);
                }
            });
        }
    }

    /**
     * Private methods
     */

    #initializeUser(userData) {
        debug(`Initializing user: ${userData.email}`);

        if (!userData.id) { throw new Error('User ID is required'); }
        if (!userData.email) { throw new Error('Email is required'); }
        if (!userData.homePath) { throw new Error('Home path is required'); }
        if (!this.#workspaceManager) { throw new Error('WorkspaceManager is required'); }

        // Create user instance with all required options
        const user = new User({
            id: userData.id,
            email: userData.email,
            homePath: userData.homePath,
            userType: userData.userType || 'user',
            status: userData.status || 'active',
            workspaceManager: this.#workspaceManager,
            eventEmitterOptions: this.eventEmitterOptions
        });

        // Store user instance in memory
        this.#users.set(user.id, user);

        debug(`User initialized: ${userData.email} (${userData.id})`);
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
