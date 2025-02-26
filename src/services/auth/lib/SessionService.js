import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import logger, { createDebug } from '@/utils/log/index.js';
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
        req => req.query && req.query.token
      ]),
      secretOrKey: this.#config.jwtSecret,
      passReqToCallback: true
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
        debug(`Error authenticating user: ${err.message}`);
        return done(err, false);
      }
    }));

    this.#initialized = true;
  }

  /**
   * Generate a JWT token for a user
   * @param {Object} user - User object
   * @returns {string} - JWT token
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email
      },
      this.#config.jwtSecret,
      {
        expiresIn: this.#config.jwtLifetime
      }
    );
  }

  /**
   * Verify a JWT token
   * @param {string} token - JWT token
   * @returns {Object|null} - Decoded token or null
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.#config.jwtSecret);
    } catch (error) {
      debug(`Error verifying token: ${error.message}`);
      return null;
    }
  }

  /**
   * Get authentication middleware
   * @returns {Function} - Authentication middleware
   */
  getAuthMiddleware() {
    return passport.authenticate('jwt', { session: false });
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
      ...options
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