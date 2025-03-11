import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as CustomStrategy } from 'passport-custom';
import logger, { createDebug } from '@/utils/log/index.js';

const debug = createDebug('auth:passport');

/**
 * Extract JWT token from cookie
 * @param {Object} req - Request object
 * @returns {string|null} - JWT token or null
 */
const cookieExtractor = (req) => {
    let token = null;
    if (req && req.cookies) {
        token = req.cookies['token'];
    }
    debug(`Cookie token extracted: ${token ? 'Found' : 'Not found'}`);
    return token;
};

/**
 * Configure passport strategies
 * @param {string} jwtSecret - JWT secret
 * @param {Object} options - Options
 * @param {Object} options.userManager - User manager instance
 * @param {Object} options.authService - Auth service instance
 * @returns {Object} - Configured passport instance
 */
export default function configurePassport(jwtSecret, options = {}) {
    debug('Configuring passport strategies');

    // Store dependencies for later use
    let userManager = options.userManager;
    let authService = options.authService;

    // JWT Strategy for token-based authentication
    passport.use('jwt', new JwtStrategy({
        jwtFromRequest: ExtractJwt.fromExtractors([
            ExtractJwt.fromAuthHeaderAsBearerToken(),
            cookieExtractor,
        ]),
        secretOrKey: jwtSecret,
        passReqToCallback: true,
    }, async (req, payload, done) => {
        try {
            debug(`JWT strategy verification for user ID: ${payload.id}`);

            // Lazy-load userManager if not provided
            if (!userManager && req.app && req.app.get('userManager')) {
                userManager = req.app.get('userManager');
            }

            if (!userManager) {
                debug('User manager not available');
                return done(null, false);
            }

            // Get user from UserManager
            try {
                const user = await userManager.getUserById(payload.id);

                if (!user) {
                    debug(`User not found for JWT payload ID: ${payload.id}`);
                    return done(null, false);
                }

                // Attach the original token payload to the user object
                const userWithPayload = {
                    ...user.toJSON(),
                    tokenPayload: payload
                };

                debug(`JWT authentication successful for user: ${user.email}`);
                return done(null, userWithPayload);
            } catch (error) {
                debug(`User not found for JWT payload ID: ${payload.id}: ${error.message}`);
                return done(null, false);
            }
        } catch (error) {
            debug(`Error in JWT strategy: ${error.message}`);
            return done(error);
        }
    }));

    // API Token Strategy for custom token authentication
    passport.use('api-token', new CustomStrategy(async (req, done) => {
        try {
            // Check for API token in Authorization header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                debug('No Bearer token found in Authorization header');
                return done(null, false);
            }

            const tokenValue = authHeader.split(' ')[1];
            debug(`API token authentication attempt: ${tokenValue.substring(0, 10)}...`);

            // Lazy-load dependencies if not provided
            if (!authService && req.app && req.app.get('authService')) {
                authService = req.app.get('authService');
            }

            if (!userManager && req.app && req.app.get('userManager')) {
                userManager = req.app.get('userManager');
            }

            if (!authService || !userManager) {
                debug('Auth service or User manager not available');
                return done(null, false);
            }

            // Try to verify as API token
            const result = await authService.validateApiToken(tokenValue);
            if (!result) {
                debug('Invalid API token');
                return done(null, false);
            }

            const { userId, tokenId } = result;

            // Get user from UserManager
            try {
                const user = await userManager.getUserById(userId);

                if (!user) {
                    debug(`User not found for API token: ${userId}`);
                    return done(null, false);
                }

                // Get token details
                const token = await authService.getApiToken(userId, tokenId);

                // Return the user with token info attached
                const userWithToken = {
                    ...user.toJSON(),
                    tokenId: tokenId,
                    tokenName: token ? token.name : 'Unknown Token'
                };

                debug(`API token authentication successful for user: ${user.email}`);
                return done(null, userWithToken);
            } catch (error) {
                debug(`User not found for API token: ${error.message}`);
                return done(null, false);
            }
        } catch (err) {
            debug(`Error in API token strategy: ${err.message}`);
            return done(err);
        }
    }));

    debug('Passport strategies configured successfully');
    return passport;
}
