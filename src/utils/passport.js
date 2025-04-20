import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as CustomStrategy } from 'passport-custom';

import logger, { createDebug } from './log/index.js';
const debug = createDebug('auth:passport');

/**
 * Extract token from various sources
 * @param {Object} req - Request object
 * @returns {string|null} - Token or null
 */
const extractToken = (req) => {
    let token = null;

    // Check Authorization header first (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
        debug('Token extracted from Authorization header');
        return token;
    }

    // Then try cookie
    if (req && req.cookies && req.cookies['token']) {
        token = req.cookies['token'];
        debug('Token extracted from cookie');
        return token;
    }

    // Finally check query parameter (useful for some API clients)
    if (req.query && req.query.token) {
        token = req.query.token;
        debug('Token extracted from query parameter');
        return token;
    }

    debug('No token found in request');
    return null;
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

    // API Token Strategy for token authentication (can handle both JWT and API tokens)
    passport.use(
        'api-token',
        new CustomStrategy(async (req, done) => {
            try {
                const tokenValue = extractToken(req);

                if (!tokenValue) {
                    debug('No token found in request');
                    return done(null, false);
                }

                debug(`Token authentication attempt: ${tokenValue.substring(0, 10)}...`);

                // Lazy-load dependencies if not provided
                if (!authService && req.app && req.app.get('authService')) {
                    authService = req.app.get('authService');
                    debug('Loaded authService from app context');
                }

                if (!userManager && req.app && req.app.get('userManager')) {
                    userManager = req.app.get('userManager');
                    debug('Loaded userManager from app context');
                }

                if (!authService || !userManager) {
                    debug('Auth service or User manager not available');
                    return done(null, false);
                }

                let user = null;
                let tokenInfo = null;

                // Try as API token first - our preferred auth method
                debug(`Validating as API token: ${tokenValue.substring(0, 10)}...`);
                const apiTokenResult = await authService.validateApiToken(tokenValue);

                if (apiTokenResult) {
                    const { userId, tokenId } = apiTokenResult;
                    debug(`API token validated for user ID: ${userId}`);

                    // Get user
                    try {
                        user = await userManager.getUser(userId);

                        if (!user) {
                            debug(`User not found for API token: ${userId}`);
                            return done(null, false);
                        }

                        // Get token details
                        const token = await userManager.getApiToken(userId, tokenId);
                        if (!token) {
                            debug(`Token details not found for token ID: ${tokenId}`);
                            return done(null, false);
                        }

                        // Add token info to user data
                        tokenInfo = {
                            type: 'api',
                            tokenId: tokenId,
                            tokenName: token.name,
                        };
                    } catch (error) {
                        debug(`Error getting user for API token: ${error.message}`);
                        return done(null, false);
                    }
                }
                // Try as JWT token as fallback (for backwards compatibility)
                else if (jwtSecret) {
                    try {
                        debug(`Validating as JWT token: ${tokenValue.substring(0, 10)}...`);
                        const jwtPayload = authService.verifyToken(tokenValue);

                        if (jwtPayload && jwtPayload.id) {
                            debug(`JWT token validated for user ID: ${jwtPayload.id}`);

                            // Get user
                            user = await userManager.getUser(jwtPayload.id);

                            if (!user) {
                                debug(`User not found for JWT token: ${jwtPayload.id}`);
                                return done(null, false);
                            }

                            // Add token info
                            tokenInfo = {
                                type: 'jwt',
                                sessionId: jwtPayload.sessionId,
                                tokenPayload: jwtPayload,
                            };
                        }
                    } catch (jwtError) {
                        debug(`JWT validation failed: ${jwtError.message}`);
                    }
                }

                if (user && tokenInfo) {
                    // Convert user to plain object
                    const userObj = user.toJSON ? user.toJSON() : user;

                    // Return authenticated user with token info
                    const authenticatedUser = {
                        ...userObj,
                        ...tokenInfo,
                    };

                    debug(`Authentication successful for user: ${user.email}`);
                    return done(null, authenticatedUser);
                }

                debug('Invalid token or user not found');
                return done(null, false);
            } catch (err) {
                debug(`Error in token authentication: ${err.message}`);
                return done(err);
            }
        }),
    );

    // Also register the jwt strategy that just delegates to the api-token strategy
    // This is for backward compatibility with any routes still using 'jwt'
    passport.use(
        'jwt',
        new CustomStrategy(async (req, done) => {
            debug('JWT strategy called (delegating to api-token)');
            // Just delegate to the api-token strategy
            return passport.authenticate('api-token', { session: false })(req, {}, () => {})(req, done);
        }),
    );

    debug('Passport strategies configured successfully');
    return passport;
}
