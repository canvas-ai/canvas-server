import validator from 'validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('auth-service');

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
      sessionManager: this.#sessionManager
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
   * Register a new user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} - User and token
   */
  async register(email, password) {
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
      password
    });

    // Create default session
    const session = await this.#sessionManager.createSession(user, 'default', {
      initializer: 'registration'
    });

    // Generate token
    const token = this.#sessionService.generateToken(user);

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

    // Get or create default session
    let session = await this.#sessionManager.getSession(user, 'default');

    if (!session) {
      session = await this.#sessionManager.createSession(user, 'default', {
        initializer: 'login'
      });
    }

    // Generate token
    const token = this.#sessionService.generateToken(user);

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
    this.#sessionService.clearCookie(res);
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
      device
    });

    return context;
  }
}

export default AuthService;
