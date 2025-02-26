// Utils
import EventEmitter from 'eventemitter2';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Logging
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('user-manager');

// Environment
import env from '@/env.js';

// Includes
import User from '@/prisma/models/User.js';
import WorkspaceManager from '@/managers/workspace/index.js';

/**
 * User Manager
 */
class UserManager extends EventEmitter {
    #userHome;
    #workspaceManager;
    #initialized = false;

    constructor(options = {}) {
        super();

        debug('Initializing user manager');
        this.#userHome = options.userHome ?? env.CANVAS_USER_HOME;
        this.#workspaceManager = options.workspaceManager;

        this.users = new Map(); // Cache active users
    }

    async initialize() {
        if (this.#initialized) {
            return;
        }

        debug('Initializing user manager');

        // Ensure user home directory exists
        try {
            await fs.mkdir(this.#userHome, { recursive: true });
            debug(`User home directory created at ${this.#userHome}`);
        } catch (err) {
            debug(`Error creating user home directory: ${err.message}`);
            throw err;
        }

        this.#initialized = true;
    }

    /**
     * Register a new user
     * @param {Object} userData - User data
     * @param {string} userData.email - User email
     * @param {string} userData.password - User password
     * @returns {Promise<Object>} - Created user
     */
    async registerUser(userData) {
        debug(`Registering new user with email: ${userData.email}`);

        // Create user in database
        const hashedPassword = await User.hashPassword(userData.password);
        const user = await User.create({
            email: userData.email,
            password: hashedPassword
        });

        // Create user home directory
        const userHomePath = path.join(this.#userHome, userData.email);
        await this.createUserHomeDirectory(userData.email);

        // Create default workspace
        if (this.#workspaceManager) {
            const workspace = await this.#workspaceManager.createWorkspace(userData.email, 'universe');
            debug(`Created default workspace for user ${userData.email}`);
        }

        this.emit('user:created', user);
        return user;
    }

    /**
     * Create user home directory
     * @param {string} email - User email
     * @returns {Promise<string>} - Path to user home directory
     */
    async createUserHomeDirectory(email) {
        const userHomePath = path.join(this.#userHome, email);
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
                created: new Date().toISOString(),
                updated: new Date().toISOString()
            };

            await fs.writeFile(
                path.join(userHomePath, 'user.json'),
                JSON.stringify(userConfig, null, 2)
            );

            return userHomePath;
        } catch (err) {
            debug(`Error creating user home directory: ${err.message}`);
            throw err;
        }
    }

    /**
     * Get user by ID
     * @param {string} id - User ID
     * @returns {Promise<Object>} - User object
     */
    async getUserById(id) {
        // Check cache first
        if (this.users.has(id)) {
            return this.users.get(id);
        }

        // Fetch from database
        const user = await User.findById(id);
        if (user) {
            this.users.set(id, user);
        }

        return user;
    }

    /**
     * Get user by email
     * @param {string} email - User email
     * @returns {Promise<Object>} - User object
     */
    async getUserByEmail(email) {
        // Fetch from database
        const user = await User.findByEmail(email);
        if (user) {
            this.users.set(user.id, user);
        }

        return user;
    }

    /**
     * Authenticate user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} - User object if authentication successful
     */
    async authenticateUser(email, password) {
        const user = await this.getUserByEmail(email);

        if (!user) {
            throw new Error('User not found');
        }

        const isValid = await user.comparePassword(password);
        if (!isValid) {
            throw new Error('Invalid password');
        }

        return user;
    }

    /**
     * Get user home path
     * @param {string} email - User email
     * @returns {string} - Path to user home directory
     */
    getUserHomePath(email) {
        return path.join(this.#userHome, email);
    }
}

export default UserManager;
