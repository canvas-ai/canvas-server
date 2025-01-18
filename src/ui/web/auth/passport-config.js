// src/ui/web/auth/passport-config.js
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { findUserByEmail } from '../db/database.js';

export function setupPassport() {
    passport.use(new LocalStrategy({
        usernameField: 'email'
    }, async (email, password, done) => {
        try {
            const user = await findUserByEmail(email);
            if (!user) {
                return done(null, false, { message: 'Incorrect email' });
            }

            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                return done(null, false, { message: 'Incorrect password' });
            }

            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }));

    // Serialize the user by email
    passport.serializeUser((user, done) => {
        done(null, user.email);
    });

    // Deserialize using findUserByEmail
    passport.deserializeUser(async (email, done) => {
        try {
            const user = await findUserByEmail(email);
            done(null, user);
        } catch (err) {
            done(err);
        }
    });
}

export function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}