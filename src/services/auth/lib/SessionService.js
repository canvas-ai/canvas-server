import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as CustomStrategy } from 'passport-custom';
import logger, { createDebug } from '@/utils/log/index.js';
import AuthToken from '@/prisma/models/AuthToken.js';
const debug = createDebug('session-service');

/**
 * Session Service
 *
 * Handles JWT token generation, verification, and authentication middleware
 */
class SessionService {
    #config;
    #initialized = false;

    constructor(config) {
        this.#config = config;

        if (!config.jwtSecret) {
            throw new Error('JWT secret is required');
        }

        if (!config.jwtLifetime) {
            config.jwtLifetime = '7d'; // Default to 7 days
        }

        this.initialize();
    }

    initialize() {
        if (this.#initialized) {
            return;
        }

        debug('Initializing session service');

        // Configure passport with JWT strategy
        const jwtOptions = {
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                req => req.cookies && req.cookies.token,
                req => req.query && req.query.token,
            ]),
            secretOrKey: this.#config.jwtSecret,
            passReqToCallback: true,
        };

        passport.use(new JwtStrategy(jwtOptions, async (req, payload, done) => {
            try {
                // The payload should contain the user ID
                if (!payload || !payload.id) {
                    return done(null, false);
                }

                // Store the payload in the request
                req.user = payload;

                return done(null, payload);
            } catch (err) {
                return done(err, false);
            }
        }));

        // Add custom middleware to check for API tokens
        passport.use('api-token', new CustomStrategy(async (req, done) => {
            try {
                // Check for API token in Authorization header
                const authHeader = req.headers.authorization;
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return done(null, false);
                }

                const token = authHeader.split(' ')[1];

                // First try to verify as JWT token
                const jwtPayload = this.verifyToken(token);
                if (jwtPayload) {
                    return done(null, jwtPayload);
                }

                // If not a JWT token, try as API token
                const result = await AuthToken.verifyToken(token);
                if (!result) {
                    return done(null, false);
                }

                // Store the user in the request
                const user = {
                    id: result.user.id,
                    email: result.user.email,
                    tokenId: result.token.id
                };

                return done(null, user);
            } catch (err) {
                return done(err, false);
            }
        }));

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

        // No active resources to clean up, but we could add them here if needed

        this.#initialized = false;
    }

    /**
   * Generate a JWT token for a user
   * @param {Object} user - User object
   * @param {Object} session - Session object
   * @returns {string} - JWT token
   */
    generateToken(user, session = null) {
        const payload = {
            id: user.id,
            email: user.email,
        };

        // Include session ID if provided
        if (session && session.id) {
            payload.sessionId = session.id;
        }

        return jwt.sign(
            payload,
            this.#config.jwtSecret,
            {
                expiresIn: this.#config.jwtLifetime,
            },
        );
    }

    /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object|null} - Decoded token or null
   */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.#config.jwtSecret);
        } catch (error) {
            return null;
        }
    }

    /**
   * Get authentication middleware
   * @returns {Function} - Authentication middleware
   */
    getAuthMiddleware() {
        return (req, res, next) => {
            // Use the api-token strategy which handles both JWT and API tokens
            passport.authenticate('api-token', { session: false }, (err, user, info) => {
                if (err) {
                    return next(err);
                }

                if (!user) {
                    return res.status(401).json({
                        success: false,
                        message: 'Unauthorized: Invalid token'
                    });
                }

                req.user = user;
                next();
            })(req, res, next);
        };
    }

    /**
   * Set token cookie
   * @param {Object} res - Response object
   * @param {string} token - JWT token
   * @param {Object} options - Cookie options
   */
    setCookie(res, token, options = {}) {
        const cookieOptions = {
            httpOnly: true,
            secure: this.#config.secureCookies || process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: this.#getMaxAge(),
            ...options,
        };

        res.cookie('token', token, cookieOptions);
    }

    /**
   * Clear token cookie
   * @param {Object} res - Response object
   */
    clearCookie(res) {
        res.clearCookie('token');
    }

    /**
   * Get max age for cookie based on JWT lifetime
   * @returns {number} - Max age in milliseconds
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
            case 's': return value * 1000; // seconds
            case 'm': return value * 60 * 1000; // minutes
            case 'h': return value * 60 * 60 * 1000; // hours
            case 'd': return value * 24 * 60 * 60 * 1000; // days
            case 'w': return value * 7 * 24 * 60 * 60 * 1000; // weeks
            default: return 7 * 24 * 60 * 60 * 1000; // Default to 7 days
        }
    }
}

export default SessionService;
