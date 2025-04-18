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

// Managers
import workspaceManager from '../../Server.js';
import sessionManager from '../session/index.js';

// Constants


// Includes
import env from '../../env.js';
import User from './lib/User.js';

/**
 * Constants
 */

const USER_TYPES = ['user', 'admin'];
const USER_CONFIG_FILENAME = 'user.json';
const USER_STATUS = ['active', 'inactive', 'deleted'];

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

        debug(`UserManager initialized with rootPath: ${this.#rootPath}`);
    }

    /**
     * Getters
     */

    get rootPath() { return this.#rootPath; }
    get index() { return this.#index.store.users || {}; }
    get users() { return Array.from(this.#users.values()); }

    /**
     * Main API
     */

    async createUser(userData = {}) {
        try {
            this.#validateUserSettings(userData);
            const email = userData.email;
            if (this.hasUser(email)) {
                throw new Error(`User already exists: ${email}`);
            }

            const userID = uuidv4();
            const userHomePath = await this.#createUserHomeDirectory(userID);
            const userWorkspacePath = await this.#createDefaultUserWorkspace(userID);

            const user = this.#initializeUser({
                id: userID,
                email: email,
                homePath: userHomePath,
                userType: userData.userType,
                status: 'active',
            });

            // Update the global index
            this.#index.set(userID, user.toJSON());

            // Initialize the user instance
            this.#initializeUser(user.toJSON());

            return user;

        } catch (error) {
            debug(`Error validating user settings: ${error}`);
            throw error;
        }


    }

    async getUser(id) {
        // Check if a user instance exists in users, if not, check if a user exists in the index
        if (this.#users.has)
    }

    async getUserByEmail(email) {
        const user = this.#index.store.users.find(user => user.email === email);
        if (!user) {
            throw new Error(`User not found: ${email}`);
        }
        return this.#users.get(user.id);
    }

    async hasUser(id) { }

    async hasUserByEmail(email) {
        return this.#index.store.users.some(user => user.email === email);
    }

    async listUsers() { }

    async updateUser(id, userData = {}) { }

    async deleteUser(id) { }


    /**
     * Token management
     */

    // API Tokens are stored in the user's home directory under workspaceManager.workspaceDirectories.config/tokens.json
    // Should we use a Conf instance bound to the User class to manage the tokens?
    async createApiToken(userId, options = {}) { }

    async getApiToken(userId, tokenId) { }

    async listApiTokens(userId, options = {}) { }

    async updateApiToken(userId, tokenId, updates = {}) { }

    async deleteApiToken(userId, tokenId) { }

    async updateApiTokenUsage(userId, tokenId) { }

    /**
     * Utils
     */

    static generateSecurePassword(length = 16) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';
        let password = '';

        // Ensure we have at least one of each character type
        password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
        password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
        password += '0123456789'[Math.floor(Math.random() * 10)]; // digit
        password += '!@#$%^&*()-_=+'[Math.floor(Math.random() * 14)]; // special

        // Fill the rest randomly
        for (let i = 4; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * charset.length);
            password += charset[randomIndex];
        }

        // Shuffle the password characters
        return password
            .split('')
            .sort(() => 0.5 - Math.random())
            .join('');
    }

    /**
     * Private methods
     */

    async #createUserHomeDirectory(userID) {
        const userHomePath = path.join(this.#rootPath, userID);
        debug(`Creating user home directory: ${userHomePath}`);
        if (existsSync(userHomePath)) {
            throw new Error(`User home directory already exists: ${userHomePath}`);
        }

        try {
            await fs.mkdir(userHomePath, { recursive: true });
            debug(`User home directory created: ${userHomePath}`);
            return userHomePath;
        } catch (error) {
            debug(`Error creating user home directory: ${error}`);
            throw error;
        }
    }

    async #createDefaultUserWorkspace(userID) {
        // "Universe" workspace is for now placed in the user's home directory root
        // because at least for now (in a roaming-profile setting) it seems more
        // appropriate(Universe will contain other workspaces)
        const userWorkspacePath = path.join(this.#rootPath, userID);
        debug(`Creating the default user workspace directory (Universe): ${userWorkspacePath}`);
        if (existsSync(userWorkspacePath)) {
            throw new Error(`User workspace directory already exists: ${userWorkspacePath}`);
        }

        try {
            await fs.mkdir(userWorkspacePath, { recursive: true });
            debug(`User workspace directory created: ${userWorkspacePath}`);
            return userWorkspacePath;
        } catch (error) {
            debug(`Error creating user workspace directory: ${error}`);
            throw error;
        }
    }

    /**
     * Private utils
     */

    #getUserFromIndex(id) {
        const userData = this.#index.store.users.find(user => user.id === id);
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

    #validateUserSettings(userSettings) {
        if (!userSettings) {
            throw new Error('User settings are required');
        }

        if (!userSettings.email) {
            throw new Error('User email is required');
        }

        if (!userSettings.userType) {
            throw new Error('User type is required');
        }

        if (!USER_TYPES.includes(userSettings.userType)) {
            throw new Error(`Invalid user type: ${userSettings.userType}`);
        }

        if (!userSettings.homePath) {
            throw new Error('User home path is required');
        }

        if (!userSettings.status) {
            throw new Error('User status is required');
        }

        if (!USER_STATUS.includes(userSettings.status)) {
            throw new Error(`Invalid user status: ${userSettings.status}`);
        }

        if (!validator.isEmail(userSettings.email)) {
            throw new Error('Invalid user email');
        }
    }

}

export default UserManager;
