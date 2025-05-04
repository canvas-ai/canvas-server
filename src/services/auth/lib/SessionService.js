import jwt from 'jsonwebtoken';
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('canvas:auth:session');

/**
 * Session Service
 *
 * Handles JWT token generation, verification, and cookie management
 */
class SessionService {
    #config;
    #sessionManager;
    #initialized = false;

    /**
     * Create a new SessionService
     * @param {Object} config - Configuration object
     * @param {string} config.jwtSecret - JWT secret
     * @param {string|number} config.jwtLifetime - JWT lifetime (e.g. '7d', 3600)
     * @param {boolean} config.secureCookies - Whether to use secure cookies
     * @param {Object} config.sessionManager - Session manager instance
     */
    constructor(config) {
        this.#config = config;

        if (!config.jwtSecret) {
            throw new Error('JWT secret is required');
        }

        if (!config.jwtLifetime) {
            config.jwtLifetime = '7d'; // Default to 7 days
        }

        if (!config.sessionManager) {
            throw new Error('Session manager is required');
        }

        this.#sessionManager = config.sessionManager;

        debug('Session service created');
        this.#initialized = true;
    }

    /**
     * Stop the session service
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this.#initialized) {
            return;
        }

        debug('Stopping session service');
        this.#initialized = false;
    }

    /**
     * Get JWT secret
     * @returns {string} - JWT secret
     */
    getJwtSecret() {
        return this.#config.jwtSecret;
    }

    /**
     * Generate a JWT token for a user
     * @param {Object} user - User object
     * @param {Object} session - Session object
     * @returns {string} - JWT token
     */
    generateToken(user, session = null) {
        debug(`Generating token for user: ${user.email}`);

        const payload = {
            id: user.id,
            email: user.email,
        };

        // Include session ID if provided
        if (session && session.id) {
            payload.sessionId = session.id;
        }

        return jwt.sign(payload, this.#config.jwtSecret, {
            expiresIn: this.#config.jwtLifetime,
        });
    }

    /**
     * Verify JWT token
     * @param {string} token - JWT token
     * @returns {Object|null} - Decoded token or null
     */
    verifyToken(token) {
        debug('Verifying JWT token');
        try {
            const decoded = jwt.verify(token, this.#config.jwtSecret);
            debug(`Token verified for user ID: ${decoded.id}`);
            debug('Token payload:', decoded);

            // If token has a session ID, verify the session is still valid
            if (decoded.sessionId) {
                debug(`Verifying session: ${decoded.sessionId}`);
                this.#verifySession(decoded.sessionId);
            }

            return decoded;
        } catch (error) {
            debug(`Token verification failed: ${error.message}`);
            debug('Token verification error:', error);
            return null;
        }
    }

    /**
     * Verify a session is valid
     * @param {string} sessionId - Session ID
     * @returns {Promise<boolean>} - Whether the session is valid
     * @private
     */
    async #verifySession(sessionId) {
        try {
            const session = await this.#sessionManager.getSession(sessionId);
            if (session && session.isActive) {
                // Touch the session to update last active time
                await this.#sessionManager.touchSession(sessionId);
                return true;
            }
        } catch (error) {
            debug(`Error verifying session: ${error.message}`);
        }

        return false;
    }

    /**
     * Set token cookie
     * @param {Object} res - Response object
     * @param {string} token - JWT token
     * @param {Object} options - Cookie options
     */
    setCookie(res, token, options = {}) {
        debug('Setting token cookie');
        debug('Cookie options:', options);

        const cookieOptions = {
            httpOnly: true,
            secure: this.#config.secureCookies || process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: this.#getMaxAge(),
            ...options,
        };

        debug('Final cookie options:', cookieOptions);
        res.cookie('token', token, cookieOptions);
        debug('Cookie set successfully');
    }

    /**
     * Clear token cookie
     * @param {Object} res - Response object
     */
    clearCookie(res) {
        debug('Clearing token cookie');
        res.clearCookie('token', {
            httpOnly: true,
            secure: this.#config.secureCookies || process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        });
        debug('Cookie cleared successfully');
    }

    /**
     * Get max age for cookie based on JWT lifetime
     * @returns {number} - Max age in milliseconds
     * @private
     */
    #getMaxAge() {
        const lifetime = this.#config.jwtLifetime;

        if (typeof lifetime === 'number') {
            return lifetime * 1000; // Convert seconds to milliseconds
        }

        // Parse string format like '7d', '24h', etc.
        const match = lifetime.match(/^(\d+)([smhdw])$/);

        if (!match) {
            return 7 * 24 * 60 * 60 * 1000; // Default to 7 days
        }

        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 's':
                return value * 1000; // seconds
            case 'm':
                return value * 60 * 1000; // minutes
            case 'h':
                return value * 60 * 60 * 1000; // hours
            case 'd':
                return value * 24 * 60 * 60 * 1000; // days
            case 'w':
                return value * 7 * 24 * 60 * 60 * 1000; // weeks
            default:
                return 7 * 24 * 60 * 60 * 1000; // Default to 7 days
        }
    }
}

export default SessionService;
