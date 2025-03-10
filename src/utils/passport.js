import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as CustomStrategy } from 'passport-custom';
import User from '@/prisma/models/User.js';
import AuthToken from '@/prisma/models/AuthToken.js';
import logger, { createDebug } from '@/utils/log/index.js';

const debug = createDebug('canvas:auth:passport');

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
 * @returns {Object} - Configured passport instance
 */
export default function configurePassport(jwtSecret) {
    debug('Configuring passport strategies');

    // Local Strategy for username/password authentication
    passport.use('local', new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',
    }, async (email, password, done) => {
        try {
            debug(`Local strategy authentication attempt for: ${email}`);
            const user = await User.findByEmail(email);

            if (!user) {
                debug(`User not found: ${email}`);
                return done(null, false, { message: 'Incorrect email or password.' });
            }

            const isValid = await user.comparePassword(password);
            if (!isValid) {
                debug(`Invalid password for user: ${email}`);
                return done(null, false, { message: 'Incorrect email or password.' });
            }

            debug(`User authenticated successfully: ${email}`);
            return done(null, user);
        } catch (error) {
            debug(`Error in local strategy: ${error.message}`);
            return done(error);
        }
    }));

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

            const user = await User.findById(payload.id);
            if (!user) {
                debug(`User not found for JWT payload ID: ${payload.id}`);
                return done(null, false);
            }

            // Attach the original token payload to the user object
            user.tokenPayload = payload;

            debug(`JWT authentication successful for user: ${user.email}`);
            return done(null, user);
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

            const token = authHeader.split(' ')[1];
            debug(`API token authentication attempt: ${token.substring(0, 10)}...`);

            // Try to verify as API token
            const result = await AuthToken.verifyToken(token);
            if (!result) {
                debug('Invalid API token');
                return done(null, false);
            }

            debug(`API token authentication successful for user: ${result.user.email}`);

            // Return the user with token info attached
            const user = result.user;
            user.tokenId = result.token.id;
            user.tokenName = result.token.name;

            return done(null, user);
        } catch (err) {
            debug(`Error in API token strategy: ${err.message}`);
            return done(err);
        }
    }));

    debug('Passport strategies configured successfully');
    return passport;
}
