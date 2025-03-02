// Utils
import EventEmitter from 'eventemitter2';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

// Logging
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('user-manager');

// Environment
import env from '@/env.js';

// Includes
import User from '@/prisma/models/User.js';


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
     * Check if any users exist in the database
     * @returns {Promise<boolean>} - True if users exist, false otherwise
     */
    async hasUsers() {
        debug('Checking if any users exist');
        const count = await User.prisma.user.count();
        return count > 0;
    }

    /**
     * Create initial admin user if no users exist
     * @param {Object} adminData - Admin user data
     * @param {string} adminData.email - Admin email
     * @param {string} adminData.password - Admin password
     * @returns {Promise<Object|null>} - Created admin user or null if users already exist
     */
    async createInitialAdminUser(adminData) {
        debug('Checking if initial admin user needs to be created');

        // Check if any users exist
        const hasExistingUsers = await this.hasUsers();
        if (hasExistingUsers) {
            debug('Users already exist, skipping initial admin creation');
            return null;
        }

        // Create admin user
        debug(`Creating initial admin user with email: ${adminData.email}`);
        const adminUser = await this.registerUser({
            email: adminData.email,
            password: adminData.password,
            userType: 'admin'
        });

        logger.info(`Initial admin user created with email: ${adminData.email}`);
        this.emit('admin:created', adminUser);

        return adminUser;
    }

    /**
     * Register a new user
     * @param {Object} userData - User data
     * @param {string} userData.email - User email
     * @param {string} userData.password - User password
     * @param {string} [userData.userType='user'] - User type ('user' or 'admin')
     * @returns {Promise<Object>} - Created user
     */
    async registerUser(userData) {
        debug(`Registering new user with email: ${userData.email}`);

        // Create user in database
        const hashedPassword = await User.hashPassword(userData.password);
        const user = await User.create({
            email: userData.email,
            password: hashedPassword,
            userType: userData.userType || 'user',
        });

        // Create user home directory
        const userHomePath = path.join(this.#userHome, userData.email);
        await this.createUserHomeDirectory(userData.email, userData.userType || 'user');

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
     * @param {string} [userType='user'] - User type ('user' or 'admin')
     * @returns {Promise<string>} - Path to user home directory
     */
    async createUserHomeDirectory(email, userType = 'user') {
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
                userType,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
            };

            await fs.writeFile(
                path.join(userHomePath, 'user.json'),
                JSON.stringify(userConfig, null, 2),
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

    /**
     * Update a user
     * @param {string} userId - User ID to update
     * @param {Object} userData - User data to update
     * @param {string} [userData.userType] - User type ('user' or 'admin')
     * @param {string} [userData.email] - User email
     * @param {string} [userData.password] - User password
     * @returns {Promise<Object>} - Updated user
     * @throws {Error} - If user not found
     */
    async updateUser(userId, userData) {
        debug(`Updating user ${userId}`);

        // Get the user
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found`);
        }

        // Process password separately if provided
        let hashedPassword;
        if (userData.password) {
            hashedPassword = await User.hashPassword(userData.password);
        }

        // Prepare data for database update
        const updateData = { ...userData };
        if (hashedPassword) {
            updateData.password = hashedPassword;
            delete updateData.currentPassword; // Remove if present
        }

        // Update user in database
        const updatedUser = await User.update(userId, updateData);

        // Update user config file if userType changed
        if (userData.userType && userData.userType !== user.userType) {
            const userHomePath = this.getUserHomePath(user.email);
            const userConfigPath = path.join(userHomePath, 'user.json');

            try {
                if (existsSync(userConfigPath)) {
                    const userConfig = JSON.parse(await fs.readFile(userConfigPath, 'utf8'));
                    userConfig.userType = userData.userType;
                    userConfig.updated = new Date().toISOString();

                    await fs.writeFile(
                        userConfigPath,
                        JSON.stringify(userConfig, null, 2)
                    );

                    debug(`Updated user config for ${user.email} to ${userData.userType}`);
                }
            } catch (err) {
                debug(`Error updating user config: ${err.message}`);
                // Continue even if config update fails
            }

            // Emit appropriate event based on userType change
            if (userData.userType === 'admin') {
                this.emit('user:promoted', updatedUser);
                debug(`User ${user.email} promoted to admin`);
            } else if (userData.userType === 'user' && user.userType === 'admin') {
                this.emit('user:demoted', updatedUser);
                debug(`Admin ${user.email} demoted to regular user`);
            }
        }

        // Update cache
        if (this.users.has(userId)) {
            this.users.set(userId, updatedUser);
        }

        this.emit('user:updated', updatedUser);
        debug(`User ${user.email} updated`);

        return updatedUser;
    }

    /**
     * Get all users
     * @returns {Promise<Array>} - Array of all users
     */
    async getAllUsers() {
        debug('Getting all users');

        try {
            const users = await User.findMany();
            return users;
        } catch (err) {
            debug(`Error getting all users: ${err.message}`);
            throw err;
        }
    }
}

export default UserManager;
