'use strict';

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { env } from '../../env.js';
import SecurityUtils from '../utils/security.js';
import emailService from '../services/email-service.js';

// Import jim from Server.js
import { jim } from '../../Server.js';

// Constants
const TOKEN_TYPES = {
  API: 'api',
  REFRESH: 'refresh',
  VERIFICATION: 'verification',
  PASSWORD_RESET: 'password_reset'
};

/**
 * AuthService - Handles authentication, token management and password operations
 */
class AuthService {
  #tokensStore;
  #passwordsStore;
  #initialized = false;
  #defaultSaltRounds = 12; // Increased from 10 for better security
  #tokenCreationLock = new Map();
  #securityConfig = null;

  constructor() {
    // Init happens in initialize() to ensure env is loaded
  }

  /**
   * Ensure auth configuration exists with default values
   * @private
   */
  #ensureAuthConfig() {
    const configPath = path.join(process.cwd(), 'server/config/auth.json'); // TODO: Move to a common config module

    // Create default auth configuration if it doesn't exist
    if (!fs.existsSync(configPath)) {
      console.log('[AuthService] Auth configuration file not found, creating default configuration...');

      // Ensure the config directory exists
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Create default configuration with all supported strategies
      const defaultConfig = {
        strategies: {
          local: {
            enabled: true
          },
          imap: {
            enabled: false,
            domains: {
              "acmedomain.tld": {
                "host": "mail.acmedomain.tld",
                "port": "465",
                "secure": true
              }
            },
            defaultUserType: 'user',
            defaultStatus: 'active'
          }
          // Future strategies like OAuth can be added here
          // oauth: {
          //   enabled: false,
          //   providers: {}
          // }
        }
      };

      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      console.log('[AuthService] Default auth configuration created at:', configPath);
    }
  }

  /**
   * Initialize the auth service
   */
  async initialize() {
    if (this.#initialized) return;

    // Ensure auth configuration exists with defaults
    this.#ensureAuthConfig();

    // Load security configuration
    this.#securityConfig = SecurityUtils.loadSecurityConfig();

    // Initialize storage for tokens and passwords using jim
    this.#tokensStore = jim.createIndex('tokens');
    this.#passwordsStore = jim.createIndex('passwords');

    // Initialize email service
    await emailService.initialize();

    this.#initialized = true;
  }

  /**
   * Helper to ensure service is initialized
   */
  #ensureInitialized() {
    if (!this.#initialized) {
      throw new Error('AuthService not initialized');
    }
  }

  /**
   * Hash a password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  async hashPassword(password) {
    return bcrypt.hash(password, this.#defaultSaltRounds);
  }

  /**
   * Compare a password with a hash
   * @param {string} password - Plain text password to check
   * @param {string} hash - Stored hash to compare against
   * @returns {Promise<boolean>} - Whether the password matches
   */
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a secure random password
   * @param {number} length - Password length
   * @returns {string} - Generated password
   */
  generateSecurePassword(length = 12) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?@%&*()_+-';
    let password = '';
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      const index = randomBytes[i] % chars.length;
      password += chars[index];
    }

    return password;
  }

  /**
   * Create a new token for a user
   * @param {string} userId - User ID
   * @param {Object} options - Token options
   * @returns {Promise<Object>} - The created token
   */
  async createToken(userId, options = {}) {
    this.#ensureInitialized();

    // Check if there's already a token creation in progress for this user
    if (this.#tokenCreationLock.has(userId)) {
      throw new Error('Token creation already in progress for this user');
    }

    try {
      // Set lock
      this.#tokenCreationLock.set(userId, true);

      const tokenType = options.type || TOKEN_TYPES.API;
      const tokenId = options.id || uuidv4();
      const name = options.name || `${tokenType} token`;
      const description = options.description || '';
      const expiresIn = options.expiresIn || null; // null means no expiration

      // Load existing tokens
      const tokensJson = this.#tokensStore.get(userId) || {};

      // Check for duplicate token names
      const existingTokens = Object.values(tokensJson);
      const hasDuplicateName = existingTokens.some(token =>
        token.name === name && token.type === tokenType
      );

      if (hasDuplicateName) {
        throw new Error(`A token with the name "${name}" already exists`);
      }

      // Generate token value with canvas- prefix
      const randomPart = crypto.randomBytes(24).toString('hex');
      const tokenValue = `canvas-${randomPart}`;
      const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

      const token = {
        id: tokenId,
        userId,
        type: tokenType,
        name,
        description,
        hash: tokenHash,
        createdAt: new Date().toISOString(),
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn).toISOString() : null,
        lastUsedAt: null
      };

      // Add new token
      tokensJson[tokenId] = token;

      // Save tokens
      this.#tokensStore.set(userId, tokensJson);

      // Return token with value (only returned on creation)
      return {
        ...token,
        value: tokenValue
      };
    } finally {
      // Always release the lock
      this.#tokenCreationLock.delete(userId);
    }
  }

  /**
   * Update an existing token
   * @param {string} userId - User ID
   * @param {string} tokenId - Token ID
   * @param {Object} updates - Properties to update
   * @returns {Promise<Object>} - Updated token
   */
  async updateToken(userId, tokenId, updates = {}) {
    this.#ensureInitialized();

    const tokensJson = this.#tokensStore.get(userId) || {};

    // Verify token exists
    if (!tokensJson[tokenId]) {
      throw new Error('Token not found');
    }

    const token = tokensJson[tokenId];

    // Apply updates (only allow updating name and description)
    if (updates.name) token.name = updates.name;
    if (updates.description) token.description = updates.description;

    // Save tokens
    this.#tokensStore.set(userId, tokensJson);

    return token;
  }

  /**
   * Delete a token
   * @param {string} userId - User ID
   * @param {string} tokenId - Token ID to delete
   * @returns {Promise<boolean>} - True if deleted
   */
  async deleteToken(userId, tokenId) {
    this.#ensureInitialized();

    const tokensJson = this.#tokensStore.get(userId) || {};

    // Verify token exists
    if (!tokensJson[tokenId]) {
      return false;
    }

    // Delete token
    delete tokensJson[tokenId];

    // Save tokens (or delete if empty)
    if (Object.keys(tokensJson).length === 0) {
      this.#tokensStore.delete(userId);
    } else {
      this.#tokensStore.set(userId, tokensJson);
    }

    return true;
  }

  /**
   * List all tokens for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of token objects
   */
  async listTokens(userId) {
    this.#ensureInitialized();

    const tokensJson = this.#tokensStore.get(userId) || {};

    return Object.values(tokensJson).map(token => {
      // Never return the hash
      const { hash, ...tokenWithoutHash } = token;
      return tokenWithoutHash;
    });
  }

  /**
   * Verify an API token
   * @param {string} tokenValue - The API token to verify
   * @returns {Promise<Object|null>} - User ID if valid, null otherwise
   */
  async verifyApiToken(tokenValue) {
    this.#ensureInitialized();

    if (!tokenValue) return null;

    // Hash the provided token value
    const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

    // Check all users' tokens
    const userIds = this.#tokensStore.store ? Object.keys(this.#tokensStore.store) : [];

    for (const userId of userIds) {
      const userTokens = this.#tokensStore.get(userId) || {};

      for (const tokenId in userTokens) {
        const token = userTokens[tokenId];

        // Skip non-API tokens
        if (token.type !== TOKEN_TYPES.API) continue;

        // Check if token is expired
        if (token.expiresAt && new Date(token.expiresAt) < new Date()) continue;

        // Compare hash
        if (token.hash === tokenHash) {
          // Update last used
          token.lastUsedAt = new Date().toISOString();
          this.#tokensStore.set(userId, userTokens);

          return { userId, tokenId };
        }
      }
    }

    return null;
  }

  /**
   * Verify a one-time token (password reset, email verification)
   * @param {string} tokenValue - Token value to verify
   * @param {string} type - Token type to verify
   * @returns {Promise<Object|null>} - Token data if valid
   */
  async verifyOneTimeToken(tokenValue, type) {
    this.#ensureInitialized();

    if (!tokenValue) return null;

    // Hash the provided token value
    const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

    // Check all users' tokens
    const userIds = this.#tokensStore.store ? Object.keys(this.#tokensStore.store) : [];

    for (const userId of userIds) {
      const userTokens = this.#tokensStore.get(userId) || {};
      let tokenFound = false;
      let tokenId;

      for (const id in userTokens) {
        const token = userTokens[id];

        // Skip tokens of wrong type
        if (token.type !== type) continue;

        // Check if token is expired
        if (token.expiresAt && new Date(token.expiresAt) < new Date()) continue;

        // Compare hash
        if (token.hash === tokenHash) {
          tokenFound = true;
          tokenId = id;
          // One-time tokens should be deleted after use
          delete userTokens[id];
          break;
        }
      }

      if (tokenFound) {
        // Save tokens (or delete if empty)
        if (Object.keys(userTokens).length === 0) {
          this.#tokensStore.delete(userId);
        } else {
          this.#tokensStore.set(userId, userTokens);
        }

        return { userId, tokenId };
      }
    }

    return null;
  }

  /**
   * Create a password reset token
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @returns {Promise<Object>} - Reset token
   */
  async createPasswordResetToken(userId, email) {
    return this.createToken(userId, {
      type: TOKEN_TYPES.PASSWORD_RESET,
      name: 'Password Reset',
      description: `Password reset for ${email}`,
      expiresIn: 1000 * 60 * 60 * 24 // 24 hours
    });
  }

  /**
   * Create an email verification token
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @returns {Promise<Object>} - Verification token
   */
  async createEmailVerificationToken(userId, email) {
    return this.createToken(userId, {
      type: TOKEN_TYPES.VERIFICATION,
      name: 'Email Verification',
      description: `Email verification for ${email}`,
      expiresIn: 1000 * 60 * 60 * 48 // 48 hours
    });
  }

  /**
   * Set a user's password
   * @param {string} userId - User ID
   * @param {string} password - New password
   * @returns {Promise<boolean>} - Success
   */
  async setPassword(userId, password) {
    this.#ensureInitialized();

    if (!userId || !password) {
      throw new Error('User ID and password are required');
    }

    // Validate password against security policy
    const passwordPolicy = this.#securityConfig?.strategies?.local?.passwordPolicy;
    if (passwordPolicy) {
      const validation = SecurityUtils.validatePassword(password, passwordPolicy);
      if (!validation.valid) {
        throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
      }
    }

    const passwordHash = await this.hashPassword(password);

    // Store password
    this.#passwordsStore.set(userId, {
      hash: passwordHash,
      updatedAt: new Date().toISOString()
    });

    return true;
  }

  /**
   * Verify a user's password
   * @param {string} userId - User ID
   * @param {string} password - Password to verify
   * @returns {Promise<boolean>} - True if password matches
   */
  async verifyPassword(userId, password) {
    this.#ensureInitialized();

    if (!userId || !password) return false;

    // Check if user has a password
    const passwordData = this.#passwordsStore.get(userId);
    if (!passwordData || !passwordData.hash) {
      return false;
    }

    // Compare password
    return this.comparePassword(password, passwordData.hash);
  }

  /**
   * Generate a JWT token for a user
   * @param {Object} user - User object
   * @param {Object} options - JWT options
   * @returns {string} - JWT token
   */
  generateJWT(user, options = {}) {
    const jwtSecret = this.#securityConfig?.jwt?.secret || env.auth.jwtSecret;
    
    if (!jwtSecret) {
      throw new Error('JWT secret key is not configured');
    }

    // Check if JWT secret is secure
    if (!SecurityUtils.isSecureJwtSecret(jwtSecret)) {
      console.warn('[AuthService] JWT secret is not secure - consider changing it in production');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      userType: user.userType
    };

    // Only add version if user has an updated or created timestamp
    if (user.updatedAt || user.createdAt) {
      payload.ver = user.updatedAt || user.createdAt;
    }

    const expiresIn = options.expiresIn || this.#securityConfig?.jwt?.expiresIn || '1d';

    return jwt.sign(
      payload,
      jwtSecret,
      {
        expiresIn: expiresIn
      }
    );
  }

  /**
   * Verify a JWT or API token
   * @param {string} token - The token to verify
   * @returns {Promise<Object>} - Result of verification with user data if valid
   */
  async verifyToken(token) {
    this.#ensureInitialized();

    if (!token) {
      return { valid: false, message: 'No token provided' };
    }

    try {
      // If it's an API token (starts with canvas-)
      if (token.startsWith('canvas-')) {
        const tokenResult = await this.verifyApiToken(token);
        if (!tokenResult) {
          return { valid: false, message: 'Invalid API token' };
        }

        // Get user from the database or storage
        const userIndex = jim.createIndex('users');
        const user = userIndex.get(tokenResult.userId);

        if (!user) {
          return { valid: false, message: 'User not found' };
        }

        return {
          valid: true,
          user: {
            id: user.id,
            name: user.name || user.email,
            email: user.email,
            userType: user.userType || 'user',
            status: user.status || 'active'
          },
          tokenType: 'api'
        };
      }

      // If it's a JWT token
      else {
        const jwtSecret = this.#securityConfig?.jwt?.secret || env.auth.jwtSecret;
        
        if (!jwtSecret) {
          return { valid: false, message: 'JWT secret not configured' };
        }

        const decoded = jwt.verify(token, jwtSecret);

        // Get user from the database
        const userIndex = jim.createIndex('users');
        const user = userIndex.get(decoded.sub);

        if (!user) {
          return { valid: false, message: 'User not found' };
        }

        // Check user status
        if (user.status !== 'active') {
          return { valid: false, message: 'User account is not active' };
        }

        // Check token version if available
        if (decoded.ver && (user.updatedAt || user.createdAt)) {
          const userVersion = user.updatedAt || user.createdAt;
          if (decoded.ver !== userVersion) {
            return { valid: false, message: 'Token version mismatch' };
          }
        }

        return {
          valid: true,
          user: {
            id: user.id,
            name: user.name || user.email,
            email: user.email,
            userType: user.userType || 'user',
            status: user.status || 'active'
          },
          tokenType: 'jwt'
        };
      }
    } catch (error) {
      return { valid: false, message: error.message };
    }
  }
}

// Export a singleton instance
export const authService = new AuthService();
export default authService;
