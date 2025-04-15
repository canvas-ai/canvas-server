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

    #users = new Map(); // Initialized User Instances

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

    }

    async getUser(id) { }

    async getUserByEmail(email) { }

    async hasUser(id) { }

    async listUsers() { }

    async updateUser(id, userData = {}) { }

    async deleteUser(id) { }


    /**
     * Token management
     */

    async createApiToken(userId, options = {}) { }

    async getApiToken(userId, tokenId) { }

    async listApiTokens(userId, options = {}) { }

    async updateApiToken(userId, tokenId, updates = {}) { }

    async deleteApiToken(userId, tokenId) { }

    async updateApiTokenUsage(userId, tokenId) { }

    /**
     * Private methods
     */

    async #createUserHomeDirectory(userID) {
        const userHomePath = path.join(this.#rootPath, userID);
        if (existsSync(userHomePath)) {
            throw new Error(`User home directory already exists: ${userHomePath}`);
        }

        await fs.mkdir(userHomePath, { recursive: true });
    }

    async #createUserConfig(userID) {
        const userConfigPath = path.join(this.#rootPath, userID, 'Config');
        if (existsSync(userConfigPath)) {
            throw new Error(`User config directory already exists: ${userConfigPath}`);
        }

        await fs.mkdir(userConfigPath, { recursive: true });
    }

}

export default UserManager;
