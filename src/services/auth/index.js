import validator from 'validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('service:auth');

import SessionService from './lib/SessionService.js';
import UserEventHandler from '../events/UserEventHandler.js';
import User from '@/prisma/models/User.js';
import Session from '@/prisma/models/Session.js';

/**
 * Auth Service
 *
 * Handles user authentication, registration, and session management
 */
class AuthService {
    #userManager;
    #workspaceManager;
    #sessionManager;
    #deviceManager;
    #contextManager;
    #sessionService;
    #userEventHandler;
    #config;
    #initialized = false;
    #started = false;

    constructor(config, options = {}) {
        this.#config = config;
        this.#userManager = options.userManager;
        this.#workspaceManager = options.workspaceManager;
        this.#sessionManager = options.sessionManager;
        this.#deviceManager = options.deviceManager;
        this.#contextManager = options.contextManager;

        if (!this.#userManager) {
            throw new Error('UserManager is required');
        }

        if (!this.#workspaceManager) {
            throw new Error('WorkspaceManager is required');
        }

        if (!this.#sessionManager) {
            throw new Error('SessionManager is required');
        }

        this.#sessionService = new SessionService(config);

        this.#userEventHandler = new UserEventHandler({
            auth: this,
            userManager: this.#userManager,
            workspaceManager: this.#workspaceManager,
            sessionManager: this.#sessionManager,
        });
    }

    async initialize() {
        if (this.#initialized) {
            return;
        }

        debug('Initializing auth service');

        this.#initialized = true;
    }

    /**
     * Start the auth service
     * @returns {Promise<void>}
     */
    async start() {
        if (this.#started) {
            return;
        }

        if (!this.#initialized) {
            await this.initialize();
        }

        debug('Starting auth service');

        // Any startup tasks can go here

        this.#started = true;
        debug('Auth service started');
    }

    /**
     * Register a new user
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {string} [userType='user'] - User type ('user' or 'admin')
     * @returns {Promise<Object>} - User and token
     */
    async register(email, password, userType = 'user') {
        debug(`Registering user with email: ${email}`);

        if (!validator.isEmail(email)) {
            throw new Error('Invalid email format');
        }

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            throw new Error('Email already exists');
        }

        // Register user
        const user = await this.#userManager.registerUser({
            email,
            password,
            userType,
        });

        // Create default session
        const session = await this.#sessionManager.createSession(user.id, {
            initializer: 'registration',
        });

        // Generate token
        const token = this.#sessionService.generateToken(user, session);

        debug(`User registered: ${email}`);

        return { user, token, session };
    }

    /**
     * Login a user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} - User and token
     */
    async login(email, password) {
        debug(`Login attempt for user: ${email}`);

        if (!validator.isEmail(email)) {
            throw new Error('Invalid email format');
        }

        // Authenticate user
        const user = await this.#userManager.authenticateUser(email, password);

        // Create a new session
        const session = await this.#sessionManager.createSession(user.id, {
            initializer: 'login',
        });

        // Generate token
        const token = this.#sessionService.generateToken(user, session);

        debug(`User logged in: ${email}`);

        return { user, token, session };
    }

    /**
     * Logout a user
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    logout(req, res) {
        debug('User logout');

        // End the session if available
        if (req.session && req.session.id) {
            this.#sessionManager.endSession(req.session.id);
        }

        // Clear the cookie
        this.#sessionService.clearCookie(res);
    }

    /**
     * Verify a session by token
     * @param {string} token - JWT token
     * @returns {Promise<Object|null>} - Session data or null if invalid
     */
    async verifySession(token) {
        // First, verify the token
        const payload = this.#sessionService.verifyToken(token);
        if (!payload) {
            debug('Invalid token');
            return null;
        }

        // Get the user
        const user = await this.#userManager.getUserById(payload.id);
        if (!user) {
            debug(`User not found: ${payload.id}`);
            return null;
        }

        // If we have a session ID in the payload, verify it
        if (payload.sessionId) {
            const session = this.#sessionManager.getSession(payload.sessionId);
            if (!session || !session.isActive) {
                debug(`Invalid or inactive session: ${payload.sessionId}`);
                return null;
            }

            // Update last active time
            this.#sessionManager.touchSession(payload.sessionId);

            return { user, session };
        }

        // If no session ID in payload, create or get a default session
        const session = await this.#sessionManager.createSession(user.id, {
            initializer: 'token_verification',
        });

        return { user, session };
    }

    /**
     * Get authentication middleware
     * @returns {Function} - Authentication middleware
     */
    getAuthMiddleware() {
        return this.#sessionService.getAuthMiddleware();
    }

    /**
     * Verify a token
     * @param {string} token - JWT token
     * @returns {Object|null} - Decoded token or null
     */
    verifyToken(token) {
        return this.#sessionService.verifyToken(token);
    }

    /**
     * Get user from request
     * @param {Object} req - Request object
     * @returns {Promise<Object>} - User object
     */
    async getUserFromRequest(req) {
        if (!req.user || !req.user.id) {
            return null;
        }

        return await this.#userManager.getUserById(req.user.id);
    }

    /**
     * Create a context for a user
     * @param {Object} user - User object
     * @param {string} sessionName - Session name
     * @param {string} workspaceName - Workspace name
     * @param {string} contextPath - Context path
     * @returns {Promise<Object>} - Created context
     */
    async createUserContext(user, sessionName, workspaceName, contextPath = '/') {
    // Get session
        const session = await this.#sessionManager.getSession(user, sessionName);

        if (!session) {
            throw new Error(`Session "${sessionName}" not found`);
        }

        // Get workspace
        const workspaceId = `${user.email}/${workspaceName}`;
        const workspace = this.#workspaceManager.getWorkspace(workspaceId);

        if (!workspace) {
            throw new Error(`Workspace "${workspaceName}" not found`);
        }

        // Get current device
        const device = this.#deviceManager.getCurrentDevice();

        // Create context URL
        const contextUrl = `${session.id}@${workspaceId}://${contextPath}`;

        // Create context
        const context = await this.#contextManager.createContext(contextUrl, {
            user,
            session,
            workspace,
            device,
        });

        return context;
    }

    /**
     * Update a user
     * @param {string} userId - User ID to update
     * @param {Object} userData - User data to update
     * @param {Object} requestingUser - User making the request
     * @returns {Promise<Object>} - Updated user
     * @throws {Error} - If validation fails or permissions are insufficient
     */
    async updateUser(userId, userData, requestingUser) {
        debug(`User ${requestingUser.email} attempting to update user ${userId}`);

        // Check permissions
        const isSelf = userId === requestingUser.id;
        const isAdmin = requestingUser.isAdmin();

        // Only admins can change userType
        if (userData.userType !== undefined && !isAdmin) {
            throw new Error('Only admins can change user types');
        }

        // Prevent admins from demoting themselves
        if (isSelf && userData.userType === 'user' && isAdmin) {
            throw new Error('Admins cannot demote themselves');
        }

        // Non-admins can only update their own account
        if (!isAdmin && !isSelf) {
            throw new Error('You can only update your own account');
        }

        // Update the user
        const updatedUser = await this.#userManager.updateUser(userId, userData);

        debug(`User ${updatedUser.email} updated by ${requestingUser.email}`);
        return updatedUser;
    }

    /**
     * Update user password
     * @param {string} userId - User ID
     * @param {string} currentPassword - Current password (required for non-admins)
     * @param {string} newPassword - New password
     * @param {Object} requestingUser - User making the request
     * @returns {Promise<Object>} - Updated user
     * @throws {Error} - If validation fails or permissions are insufficient
     */
    async updatePassword(userId, currentPassword, newPassword, requestingUser) {
        debug(`User ${requestingUser.email} attempting to update password for user ${userId}`);

        // Check permissions
        const isSelf = userId === requestingUser.id;
        const isAdmin = requestingUser.isAdmin();

        // Non-admins can only update their own password
        if (!isAdmin && !isSelf) {
            throw new Error('You can only update your own password');
        }

        // Non-admins must provide current password
        if (!isAdmin && isSelf && currentPassword) {
            // Verify current password
            const user = await this.#userManager.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const isValid = await user.comparePassword(currentPassword);
            if (!isValid) {
                throw new Error('Current password is incorrect');
            }
        }

        // Update the password
        const updatedUser = await this.#userManager.updateUser(userId, { password: newPassword });

        debug(`Password updated for user ${updatedUser.email}`);
        return updatedUser;
    }
}

export default AuthService;
