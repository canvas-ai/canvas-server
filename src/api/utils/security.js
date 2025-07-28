'use strict';

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Security utilities for authentication and authorization
 */
export class SecurityUtils {
  /**
   * Validate password against security policy
   * @param {string} password - Password to validate
   * @param {Object} policy - Password policy configuration
   * @returns {Object} - Validation result with success and errors
   */
  static validatePassword(password, policy = {}) {
    const errors = [];
    
    // Default policy
    const defaultPolicy = {
      minLength: 8,
      requireUppercase: false,
      requireLowercase: false,
      requireNumbers: false,
      requireSpecialChars: false,
      maxLength: 128
    };

    const finalPolicy = { ...defaultPolicy, ...policy };

    // Check minimum length
    if (password.length < finalPolicy.minLength) {
      errors.push(`Password must be at least ${finalPolicy.minLength} characters long`);
    }

    // Check maximum length
    if (password.length > finalPolicy.maxLength) {
      errors.push(`Password must be no more than ${finalPolicy.maxLength} characters long`);
    }

    // Check for uppercase letters
    if (finalPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check for lowercase letters
    if (finalPolicy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check for numbers
    if (finalPolicy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check for special characters (safe regex)
    if (finalPolicy.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const weakPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];
    
    if (weakPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common, please choose a stronger password');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Generate a secure random token
   * @param {number} length - Token length in bytes
   * @returns {string} - Hex-encoded token
   */
  static generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a secure JWT secret
   * @returns {string} - Base64-encoded secret
   */
  static generateJwtSecret() {
    return crypto.randomBytes(64).toString('base64');
  }

  /**
   * Hash a string using SHA-256
   * @param {string} input - String to hash
   * @returns {string} - Hex-encoded hash
   */
  static hashString(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Validate email format (ReDoS-safe)
   * @param {string} email - Email to validate
   * @returns {boolean} - Whether email is valid
   */
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // Basic length checks to prevent ReDoS
    if (email.length > 254 || email.length < 5) {
      return false;
    }

    // Check for @ symbol and basic structure
    const atIndex = email.indexOf('@');
    if (atIndex === -1 || atIndex === 0 || atIndex === email.length - 1) {
      return false;
    }

    // Check for domain separator
    const lastDotIndex = email.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex <= atIndex || lastDotIndex === email.length - 1) {
      return false;
    }

    // Check local part (before @)
    const localPart = email.substring(0, atIndex);
    if (localPart.length > 64 || localPart.length === 0) {
      return false;
    }

    // Check domain part (after @)
    const domainPart = email.substring(atIndex + 1);
    if (domainPart.length > 253 || domainPart.length === 0) {
      return false;
    }

    // Basic character validation (safe regex patterns)
    const validLocalChars = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
    const validDomainChars = /^[a-zA-Z0-9.-]+$/;

    if (!validLocalChars.test(localPart) || !validDomainChars.test(domainPart)) {
      return false;
    }

    // Check for consecutive dots
    if (localPart.includes('..') || domainPart.includes('..')) {
      return false;
    }

    // Check for dots at start/end of local part
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      return false;
    }

    return true;
  }

  /**
   * Sanitize email address
   * @param {string} email - Email to sanitize
   * @returns {string} - Sanitized email
   */
  static sanitizeEmail(email) {
    if (!email) return '';
    return email.trim().toLowerCase();
  }

  /**
   * Validate username format
   * @param {string} username - Username to validate
   * @returns {Object} - Validation result
   */
  static validateUsername(username) {
    const errors = [];
    
    if (!username) {
      errors.push('Username is required');
      return { valid: false, errors };
    }

    if (username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }

    if (username.length > 39) {
      errors.push('Username must be no more than 39 characters long');
    }

    // Only allow lowercase letters, numbers, underscores, hyphens, and dots (safe regex)
    if (!/^[a-z0-9._-]+$/.test(username)) {
      errors.push('Username can only contain lowercase letters, numbers, underscores, hyphens, and dots');
    }

    // Check for reserved names
    const reservedNames = [
      'admin', 'administrator', 'root', 'system', 'support', 'help',
      'api', 'www', 'mail', 'ftp', 'localhost', 'test', 'demo',
      'canvas', 'universe', 'workspace', 'context', 'user', 'users'
    ];

    if (reservedNames.includes(username.toLowerCase())) {
      errors.push('Username is reserved and cannot be used');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Rate limiting utility
   */
  static createRateLimiter() {
    const attempts = new Map();
    
    return {
      /**
       * Check if request is allowed
       * @param {string} key - Rate limit key (e.g., IP, user ID)
       * @param {number} maxAttempts - Maximum attempts allowed
       * @param {number} windowMs - Time window in milliseconds
       * @returns {boolean} - Whether request is allowed
       */
      isAllowed(key, maxAttempts, windowMs) {
        const now = Date.now();
        const userAttempts = attempts.get(key) || [];
        
        // Remove expired attempts
        const validAttempts = userAttempts.filter(timestamp => now - timestamp < windowMs);
        
        if (validAttempts.length >= maxAttempts) {
          return false;
        }
        
        // Add current attempt
        validAttempts.push(now);
        attempts.set(key, validAttempts);
        
        return true;
      },

      /**
       * Get remaining attempts
       * @param {string} key - Rate limit key
       * @param {number} maxAttempts - Maximum attempts allowed
       * @param {number} windowMs - Time window in milliseconds
       * @returns {number} - Remaining attempts
       */
      getRemainingAttempts(key, maxAttempts, windowMs) {
        const now = Date.now();
        const userAttempts = attempts.get(key) || [];
        const validAttempts = userAttempts.filter(timestamp => now - timestamp < windowMs);
        
        return Math.max(0, maxAttempts - validAttempts.length);
      },

      /**
       * Clear attempts for a key
       * @param {string} key - Rate limit key
       */
      clear(key) {
        attempts.delete(key);
      }
    };
  }

  /**
   * Load security configuration
   * @returns {Object} - Security configuration
   */
  static loadSecurityConfig() {
    try {
      const configPath = path.join(process.cwd(), 'server/config/auth.json');
      if (!fs.existsSync(configPath)) {
        return null;
      }

      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('[SecurityUtils] Failed to load security config:', error.message);
      return null;
    }
  }

  /**
   * Check if JWT secret is secure
   * @param {string} secret - JWT secret to check
   * @returns {boolean} - Whether secret is secure
   */
  static isSecureJwtSecret(secret) {
    if (!secret) return false;
    if (secret === 'canvas-jwt-secret-change-in-production') return false;
    if (secret.length < 32) return false;
    return true;
  }
}

export default SecurityUtils;