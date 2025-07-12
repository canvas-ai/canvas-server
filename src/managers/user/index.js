'use strict';

// Utils
import path from 'path';
import { existsSync } from 'fs';
import EventEmitter from 'eventemitter2';
import validator from 'validator';
import { generateNanoid } from '../../utils/id.js';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('user-manager');

// Includes
import User from './lib/User.js';

/**
 * Constants
 */

const USER_TYPES = ['user', 'admin'];
const USER_STATUS_CODES = ['active', 'inactive', 'pending', 'deleted'];

/**
 * User Manager
 */

class UserManager extends EventEmitter {

    #rootPath;      // User $home directory
    #indexStore;    // User index store

    // Runtime
    #users = new Map();     // Initialized User Instances, keeps this implementation as slim as possible
    #workspaceManager;      // Workspace manager
    #contextManager;        // Context manager
    #initialized = false;   // Manager initialized flag

    /**
     * Create a new UserManager
     * @param {Object} options - Manager options
     * @param {string} options.rootPath - Root path for user homes
     * @param {Object} [options.workspaceManager] - Workspace manager (can be set later)
     * @param {Object} [options.authManager] - Auth manager (can be set later)
     */
    constructor(options = {}) {
        super(options.eventEmitterOptions || {});

        if (!options.rootPath) {
            throw new Error('User home root path is required');
        }
        if (!options.indexStore) {
            throw new Error('Index store is required for UserManager');
        }

        this.#rootPath = options.rootPath;
        this.#indexStore = options.indexStore;
        this.#workspaceManager = options.workspaceManager; // Can be initially undefined
        this.#contextManager = options.contextManager; // Can be initially undefined

        debug(`Initializing UserManager with user home directory rootPath: ${this.#rootPath}`);
    }

    /**
     * Initialize manager
     * @override
     */
    async initialize() {
        if (this.#initialized) { return true; }

        debug(`UserManager initialized with ${this.#indexStore.size} user(s) in index`);
        this.#initialized = true;
        return this;
    }

    /**
     * Getters
     */

    get rootPath() { return this.#rootPath; }
    get users() { return Array.from(this.#users.values()); }
    get workspaceManager() { return this.#workspaceManager; }

    /**
     * Setters for late dependency injection to solve circular dependencies.
     */
    setWorkspaceManager(manager) {
        if (!this.#workspaceManager) {
            this.#workspaceManager = manager;
        }
    }

    setContextManager(manager) {
        if (!this.#contextManager) {
            this.#contextManager = manager;
        }
    }

    /**
     * User Manager API
     */

    /**
     * Resolve a user identifier (ID, email, or name) to a user ID.
     * @param {string} identifier - The user ID, email, or name.
     * @returns {Promise<string|null>} The user ID if found, otherwise null.
     */
    async resolveToUserId(identifier) {
        if (!this.#initialized) throw new Error('UserManager not initialized');
        if (!identifier) return null;

        // Check if it's an ID
        if (await this.hasUser(identifier)) {
            return identifier;
        }

        // Check if it's an email
        if (validator.isEmail(identifier)) {
            const userIdByEmail = this.#findUserIdByEmail(identifier);
            if (userIdByEmail) return userIdByEmail;
        }

        // Check if it's a name
        const userIdByName = this.#findUserIdByName(identifier);
        if (userIdByName) return userIdByName;

        return null;
    }

    /**
     * Create a new user with a Universe workspace
     * @param {Object} userData - User data
     * @param {string} userData.name - User nickname/display name (required)
     * @param {string} userData.email - User email (required)
     * @param {string} [userData.id] - User ID (if not provided, generates 8-char lowercase nanoid)
     * @param {string} [userData.userType='user'] - User type: 'user' or 'admin'
     * @param {string} [userData.status='active'] - User status
     * @returns {Promise<User>} Created user
     */
    async createUser(userData = {}) {
        if (!this.#initialized) throw new Error('UserManager not initialized');

        debug(`createUser: Creating user with data: ${JSON.stringify(userData)}`);
        const id = userData.id || generateNanoid(8);

        try {
            this.#validateUserSettings(userData);

            const email = userData.email.toLowerCase();
            const name = userData.name;
            const userHomePath = userData.homePath || path.join(this.#rootPath, email);

            if (await this.hasUser(id)) throw new Error(`User already exists with ID: ${id}`);
            if (await this.hasUserByEmail(email)) throw new Error(`User already exists with email: ${email} (ID: ${id})`);

            // Pre-register user in index so workspace creation can resolve the ID
            const preliminaryUserData = {
                id,
                name,
                email,
                homePath: userHomePath,
                userType: userData.userType || 'user',
                status: 'pending', // Mark as pending until fully created
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.#indexStore.set(id, preliminaryUserData);
            debug(`Pre-registered user in index: ${id}`);

            await this.#createHomeDirectory(userHomePath, id, email);

            const user = await this.#initializeUser({
                id,
                name,
                email,
                homePath: userHomePath,
                userType: userData.userType || 'user',
                status: userData.status || 'active',
            });

            // Create a default context for the user
            await this.#contextManager.createContext(user.id, '/', {
                id: 'default',
            });

            this.#setupUserEventListeners(user);
            this.emit('user.created', { id, name, email });
            debug(`User created: ${user.name} (${user.email}) (ID: ${user.id})`);
            return user;
        } catch (error) {
            // Rollback pre-registration if creation fails
            if (this.#indexStore.has(id)) {
                const storedData = this.#indexStore.get(id);
                if (storedData?.status === 'pending') {
                    this.#indexStore.delete(id);
                    debug(`Rolled back pre-registration for user: ${id}`);
                }
            }
            debug(`Error creating user: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get a user by ID
     * @param {string} id - User ID
     * @returns {Promise<User>} User instance
     */
    async getUser(id) {
        if (!this.#initialized) { // Added check - important for store access
            throw new Error('UserManager not initialized');
        }
        if (this.#users.has(id)) {
            return this.#users.get(id);
        }
        // Get specific user by ID from the flat store
        const userDataFromIndex = this.#indexStore.get(id);
        if (!userDataFromIndex) {
            throw new Error(`User not found in index: ${id}`);
        }
        return await this.#initializeUser({
            ...userDataFromIndex,
            workspaceManager: this.#workspaceManager,
        });
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
        if (!this.#initialized) {
            throw new Error('UserManager not initialized');
        }
        const id = this.#findUserIdByEmail(email);
        if (!id) {
            throw new Error(`User not found by email: ${email}`);
        }
        return this.getUser(id);
    }

    /**
     * Get a user by name
     * @param {string} name - User name
     * @returns {Promise<User>} User instance
     */
    async getUserByName(name) {
        if (!this.#initialized) {
            throw new Error('UserManager not initialized');
        }
        const id = this.#findUserIdByName(name);
        if (!id) {
            throw new Error(`User not found by name: ${name}`);
        }
        return this.getUser(id);
    }

    /**
     * Check if user exists by ID
     * @param {string} id - User ID
     * @returns {Promise<boolean>} True if user exists (in memory or index)
     */
    async hasUser(id) {
        if (!this.#initialized) throw new Error('UserManager not initialized');
        return this.#users.has(id) || this.#indexStore.has(id);
    }

    /**
     * Check if user exists by email and verify home directory
     * @param {string} email - User email
     * @returns {Promise<boolean>} True if user exists with valid home directory
     */
    async hasUserByEmail(email) {
        return !!this.#findUserIdByEmail(email);
    }

    /**
     * List all users
     * @param {Object} options - Filtering options
     * @param {string} [options.status] - Filter by status
     * @param {string} [options.userType] - Filter by user type
     * @returns {Promise<Array<Object>>} Array of user objects (JSON representation from index)
     */
    async listUsers(options = {}) {
        if (!this.#initialized) { // Added check
            throw new Error('UserManager not initialized');
        }
        const allUsersInStore = this.#indexStore.store;
        let usersArray = Object.values(allUsersInStore);

        if (options.status && USER_STATUS_CODES.includes(options.status)) {
            usersArray = usersArray.filter((user) => user.status === options.status);
        }
        if (options.userType && USER_TYPES.includes(options.userType)) {
            usersArray = usersArray.filter((user) => user.userType === options.userType);
        }
        return usersArray;
    }

    /**
     * Update user properties
     * @param {string} id - User ID
     * @param {Object} userData - User data to update
     * @returns {Promise<User>} Updated user instance
     */
    async updateUser(id, userData = {}) {
        if (!this.#initialized) {
            throw new Error('UserManager not initialized');
        }
        if (!id) throw new Error('User ID is required');

        const currentUserDataFromIndex = this.#indexStore.get(id);
        if (!currentUserDataFromIndex) {
            throw new Error(`User not found in index: ${id}`);
        }

        if (userData.email && userData.email.toLowerCase() !== currentUserDataFromIndex.email.toLowerCase()) {
            const lowerCaseNewEmail = userData.email.toLowerCase();
            const allUsersInStore = this.#indexStore.store;
            for (const userIdInIdx in allUsersInStore) {
                if (allUsersInStore[userIdInIdx].email.toLowerCase() === lowerCaseNewEmail && userIdInIdx !== id) {
                    throw new Error(`Email already in use: ${userData.email}`);
                }
            }
        }

        const updateDataForValidation = {
            ...userData,
            homePath: currentUserDataFromIndex.homePath,
            originalName: currentUserDataFromIndex.name,
        };
        try {
            this.#validateUserSettings(updateDataForValidation, true);
        } catch (error) {
            throw new Error(`Invalid user data: ${error.message}`);
        }

        const updatedUserDataToStore = {
            ...currentUserDataFromIndex,
            ...userData,
            updatedAt: new Date().toISOString(),
        };
        this.#indexStore.set(id, updatedUserDataToStore);

        const updatedUserInstance = await this.#initializeUser({
            ...updatedUserDataToStore,
            workspaceManager: this.#workspaceManager,
        });
        this.emit('user.updated', { id, updates: userData });
        return updatedUserInstance;
    }

    /**
     * Delete a user
     * @param {string} id - User ID
     * @returns {Promise<boolean>} True if user was deleted
     */
    async deleteUser(id) {
        if (!this.#initialized) { // Added check
            throw new Error('UserManager not initialized');
        }
        if (!id) throw new Error('User ID is required');

        if (!this.#indexStore.has(id)) {
            if (this.#users.has(id)) { // Should not happen if store is source of truth
                this.#users.delete(id);
                this.emit('user.deleted', { id });
                debug(`User ${id} deleted from memory (was not in index).`);
                return true;
            }
            throw new Error(`User not found in index: ${id}`);
        }
        const userToDeleteData = this.#indexStore.get(id);
        const userHomePath = userToDeleteData.homePath;
        this.#indexStore.delete(id);

        if (this.#users.has(id)) {
            this.#users.delete(id);
        }
        console.log(`User ${id} deleted. Home directory left in place: ${userHomePath}`);
        this.emit('user.deleted', { id });
        return true;
    }

    /**
     * Utils
     */

    async ensureUserUniverseWorkspaceIsRunning(userId) {
        if (!this.#initialized) {
            throw new Error('UserManager not initialized');
        }

        const user = await this.getUser(userId);
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }

        const universeWorkspace = await this.#workspaceManager.getWorkspace(user.id, 'universe', user.id);
        if (!universeWorkspace) {
            throw new Error(`Universe workspace not found for user: ${user.email}`);
        }

        // This is handled by our stupid to-be-refactored/renamed getWorkspace method
        if (universeWorkspace.status !== 'running') {
            await this.#workspaceManager.startWorkspace(user.id, 'universe', user.id);
        }

        return true;
    }

    async ensureDefaultUserContextExists(userId) {
        if (!this.#initialized) {
            throw new Error('UserManager not initialized');
        }

        const user = await this.getUser(userId);
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }

        if (this.#contextManager.hasContext(userId, 'default')) {
            return true;
        }

        // Create a default context for the user if it doesn't exist
        await this.#contextManager.createContext(userId, '/', {
            id: 'default',
            autoCreate: true,
        });

        return true;
    }

    /**
     * Private methods
     */

    async #createHomeDirectory(homePath, userId, userEmail) {
        if (!this.#initialized) {
            throw new Error('UserManager not initialized');
        }

        if (!this.#workspaceManager) {
            throw new Error('UserManager is not fully configured (missing WorkspaceManager).');
        }

        // Resolve home path
        const userHomePath = path.resolve(homePath);
        debug(`Creating user home (Universe workspace) at: ${userHomePath} for userID: ${userId}, email: ${userEmail}`);

        // Check if home path exists
        if (existsSync(userHomePath)) {
            throw new Error(`User home directory already exists: ${userHomePath}`);
        }

        try {
            await this.#workspaceManager.createWorkspace(userId, 'universe', {
                workspacePath: userHomePath,
                type: 'universe',
                owner: userId,
            });

            debug(`User Home Directory created for user: ${userEmail} (ID: ${userId})`);
            return userHomePath;
        } catch (error) {
            debug(`Error creating user home: ${error.message}`);
            throw error;
        }
    }

    async #initializeUser(userData) {
        debug(`Initializing user: ${userData.name} (${userData.email}) (ID: ${userData.id})`);

        if (!userData.id) { throw new Error('User ID is required for #initializeUser'); }
        if (!userData.name) { throw new Error('Name is required for #initializeUser'); }
        if (!userData.email) { throw new Error('Email is required for #initializeUser'); }
        if (!userData.homePath) { throw new Error('Home path is required for #initializeUser'); }

        const userOptions = {
            ...userData, // This has id, name, email, homePath, userType, status
            eventEmitterOptions: this.eventEmitterOptions
        };

        // Create and initialize the User instance
        const user = new User(userOptions);

        // Store the user instance first
        this.#saveEntry(user.id, user);

        // Start the universe workspace - this is critical for user functionality
        debug(`Starting universe workspace for user ${user.name} (${user.email})`);

        const workspace = await this.#workspaceManager.startWorkspace(user.id, 'universe', user.id);
        if (!workspace) {
            throw new Error(`Failed to start universe workspace for user ${user.name} (${user.email})`);
        }

        debug(`Universe workspace started successfully for user ${user.name} (${user.email})`);

        // Setup event listeners after workspace is started
        this.#setupUserEventListeners(user);

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

        // Name and email are required for new users, and must be valid if provided
        if (!isUpdate && !userSettings.name) {
            throw new Error('User name is required');
        }

        if (!isUpdate && !userSettings.email) {
            throw new Error('User email is required');
        }

        if (userSettings.name) {
            if (typeof userSettings.name !== 'string') {
                throw new Error('User name must be a string');
            }

            if (userSettings.name.trim().length === 0) {
                throw new Error('User name cannot be empty');
            }

            // GitHub-style username validation
            const username = userSettings.name.toLowerCase().trim();
            const usernameRegex = /^[a-z0-9_-]+$/;

            if (!usernameRegex.test(username)) {
                throw new Error('User name can only contain lowercase letters, numbers, underscores, and hyphens');
            }

            if (username.length < 3) {
                throw new Error('User name must be at least 3 characters long');
            }

            if (username.length > 39) {
                throw new Error('User name cannot be longer than 39 characters');
            }

            // Check for reserved names (GitHub-style)
            const reservedNames = [
                'admin', 'administrator', 'root', 'system', 'support', 'help',
                'api', 'www', 'mail', 'ftp', 'localhost', 'test', 'demo',
                'canvas', 'universe', 'workspace', 'context', 'user', 'users'
            ];

            if (reservedNames.includes(username)) {
                // Allow 'admin' username only for admin user type
                if (username === 'admin' && userSettings.userType === 'admin') {
                    // Allow admin username for admin user type
                } else {
                    throw new Error(`User name '${username}' is reserved and cannot be used`);
                }
            }

            // Check for uniqueness (only for new users or name changes)
            if (!isUpdate || (isUpdate && userSettings.name !== userSettings.originalName)) {
                this.#validateUsernameUniqueness(username, userSettings.id);
            }

            // Update the name to the validated format
            userSettings.name = username;
        }

        if (userSettings.email && !validator.isEmail(userSettings.email)) {
            throw new Error('Invalid user email');
        }

        // Validate user type if provided
        if (userSettings.userType && !USER_TYPES.includes(userSettings.userType)) {
            throw new Error(`Invalid user type: ${userSettings.userType}`);
        }

        // Validate status if provided
        if (userSettings.status && !USER_STATUS_CODES.includes(userSettings.status)) {
            throw new Error(`Invalid user status: ${userSettings.status}`);
        }
    }

    /**
     * Validate that a username is unique across all users
     * @param {string} username - Username to validate
     * @param {string} [excludeUserId] - User ID to exclude from uniqueness check (for updates)
     * @throws {Error} If username is not unique
     * @private
     */
    #validateUsernameUniqueness(username, excludeUserId = null) {
        // Check in-memory users first
        for (const user of this.#users.values()) {
            if (excludeUserId && user.id === excludeUserId) {
                continue; // Skip the user being updated
            }
            if (user.name === username) {
                throw new Error(`User name '${username}' is already taken`);
            }
        }

        // Check in the index store
        for (const [id, userData] of Object.entries(this.#indexStore.store || {})) {
            if (excludeUserId && id === excludeUserId) {
                continue; // Skip the user being updated
            }
            if (userData?.name === username) {
                throw new Error(`User name '${username}' is already taken`);
            }
        }
    }

    /**
     * Find a user ID by email in memory or store
     * @param {string} email - User email
     * @returns {string|null} User ID if found, otherwise null
     * @private
     */
    #findUserIdByEmail(email) {
        const lower = email.toLowerCase();
        for (const user of this.#users.values()) {
            if (user.email.toLowerCase() === lower) return user.id;
        }
        for (const [id, data] of Object.entries(this.#indexStore.store || {})) {
            if (data?.email?.toLowerCase() === lower) return id;
        }
        return null;
    }

    /**
     * Find a user ID by name in memory or store
     * @param {string} name - User name
     * @returns {string|null} User ID if found, otherwise null
     * @private
     */
    #findUserIdByName(name) {
        const lower = name.toLowerCase();
        for (const user of this.#users.values()) {
            if (user.name.toLowerCase() === lower) return user.id;
        }
        for (const [id, data] of Object.entries(this.#indexStore.store || {})) {
            if (data?.name?.toLowerCase() === lower) return id;
        }
        return null;
    }

    #setupUserEventListeners(user) {
        user.on('create', (data) => {
            debug(`User created: ${data.email} (ID: ${data.id})`, data);
            this.#saveEntry(data.id, data);
        });

        user.on('update', (data) => {
            debug(`User updated: ${data.email} (ID: ${data.id})`, data);
            const updatedUser = this.#users.get(data.id);
            if (updatedUser) {
                this.#saveEntry(data.id, updatedUser.toJSON());
            }
        });
    }

    #saveEntry(id, data) {
        this.#users.set(id, data);
        this.#indexStore.set(id, data);
    }
}

export default UserManager;
export {
    USER_TYPES,
    USER_STATUS_CODES
};
