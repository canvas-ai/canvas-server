import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as ApiTokenStrategy } from 'passport-http-bearer';

import logger, { createDebug } from './log/index.js';
const debug = createDebug('auth:passport');

/**
 * Configure passport strategies
 * @param {string} jwtSecret - JWT secret
 * @param {Object} options - Options
 * @param {Object} options.userManager - User manager instance
 * @returns {Object} - Configured passport instance
 */
export default function configurePassport(jwtSecret, options = {}) {
    debug('Configuring passport strategies');

    const { userManager } = options;

    if (!userManager) {
        throw new Error('User manager is required for passport configuration');
    }

    // JWT Strategy
    passport.use(
        'jwt',
        new JwtStrategy(
            {
                jwtFromRequest: ExtractJwt.fromExtractors([
                    ExtractJwt.fromAuthHeaderAsBearerToken(),
                    ExtractJwt.fromUrlQueryParameter('token'),
                    ExtractJwt.fromBodyField('token'),
                ]),
                secretOrKey: jwtSecret,
            },
            async (jwtPayload, done) => {
                try {
                    const user = await userManager.getUser(jwtPayload.id);
                    if (!user) {
                        return done(null, false);
                    }

                    // Add token info to user
                    const userObj = user.toJSON ? user.toJSON() : user;
                    userObj.type = 'jwt';
                    userObj.sessionId = jwtPayload.sessionId;

                    return done(null, userObj);
                } catch (error) {
                    debug(`JWT authentication error: ${error.message}`);
                    return done(error);
                }
            },
        ),
    );

    // API Token Strategy
    passport.use(
        'api-token',
        new ApiTokenStrategy(async (token, done) => {
            try {
                // Find user by API token
                const result = await userManager.findUserByApiTokenValue(token);
                if (!result) {
                    return done(null, false);
                }

                const { userId, tokenId } = result;

                // Get user
                const user = await userManager.getUser(userId);
                if (!user) {
                    return done(null, false);
                }

                // Get token details
                const tokenDetails = await userManager.getApiToken(userId, tokenId);
                if (!tokenDetails) {
                    return done(null, false);
                }

                // Add token info to user
                const userObj = user.toJSON ? user.toJSON() : user;
                userObj.type = 'api';
                userObj.tokenId = tokenId;
                userObj.tokenName = tokenDetails.name;

                return done(null, userObj);
            } catch (error) {
                debug(`API token authentication error: ${error.message}`);
                return done(error);
            }
        }),
    );

    // Serialize user
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await userManager.getUser(id);
            done(null, user);
        } catch (error) {
            done(error);
        }
    });

    debug('Passport strategies configured successfully');
    return passport;
}
