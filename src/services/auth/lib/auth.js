import express from 'express';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { createDebug } from '../../../utils/log/index.js';
import storage from './storage.js';

const debug = createDebug('canvas:auth:authjs');
const router = express.Router();

const JWT_SECRET = process.env.AUTH_SECRET || 'your-secret-key-here';
const JWT_EXPIRY = '30d';

// CSRF token endpoint
router.get('/csrf', (req, res) => {
    const csrfToken = createHash('sha256').update(Math.random().toString()).digest('hex');
    res.cookie('next-auth.csrf-token', `${csrfToken}|${createHash('sha256').update(csrfToken).digest('hex')}`, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
    });
    res.json({ csrfToken });
});

// Signin endpoint
router.post('/signin', async (req, res) => {
    try {
        debug('Processing signin request');
        const { email, password, csrfToken } = req.body;
        debug('Signin data:', { email, csrfToken });

        // Verify CSRF token
        const csrfCookie = req.cookies['next-auth.csrf-token'];
        if (!csrfCookie) {
            debug('No CSRF cookie found');
            return res.status(403).json({
                success: false,
                error: 'Invalid CSRF token'
            });
        }

        const [storedToken] = csrfCookie.split('|');
        if (csrfToken !== storedToken) {
            debug('CSRF token mismatch');
            return res.status(403).json({
                success: false,
                error: 'Invalid CSRF token'
            });
        }

        // Find user
        const keys = await storage.getKeys('user:');
        debug(`Found ${keys.length} users in storage`);

        let foundUser = null;
        for (const key of keys) {
            const user = await storage.getItem(key);
            debug(`Checking user ${key}:`, { ...user, password: '[REDACTED]' });

            const hashedPassword = createHash('sha256').update(password).digest('hex');
            debug(`Hash comparison for ${user.email}:`);
            debug(`  Stored hash:    ${user.password}`);
            debug(`  Generated hash: ${hashedPassword}`);
            debug(`  Match: ${user.password === hashedPassword}`);

            if (user.email === email && user.password === hashedPassword) {
                foundUser = user;
                break;
            }
        }

        if (!foundUser) {
            debug('No matching user found');
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign({
            id: foundUser.id,
            email: foundUser.email,
            userType: foundUser.userType,
            status: foundUser.status
        }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

        // Set session cookie
        res.cookie('next-auth.session-token', token, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: process.env.NODE_ENV === 'production'
        });

        debug('Authentication successful');
        return res.status(200).json({
            success: true,
            user: {
                id: foundUser.id,
                email: foundUser.email,
                userType: foundUser.userType,
                status: foundUser.status
            }
        });
    } catch (error) {
        debug(`Authentication error: ${error.message}`);
        debug('Error stack:', error.stack);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Signout endpoint
router.post('/signout', (req, res) => {
    debug('Processing signout request');
    res.clearCookie('next-auth.session-token');
    return res.status(200).json({ success: true });
});

// Session endpoint
router.get('/session', async (req, res) => {
    try {
        debug('Processing session request');
        const token = req.cookies['next-auth.session-token'];

        if (!token) {
            debug('No session token found');
            return res.status(401).json({
                success: false,
                error: 'No session found'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        debug('Decoded session:', decoded);

        return res.status(200).json({
            success: true,
            session: {
                user: {
                    id: decoded.id,
                    email: decoded.email,
                    userType: decoded.userType,
                    status: decoded.status
                }
            }
        });
    } catch (error) {
        debug(`Session error: ${error.message}`);
        return res.status(401).json({
            success: false,
            error: 'Invalid session'
        });
    }
});

// Middleware to protect routes
const requireAuth = async (req, res, next) => {
    try {
        const token = req.cookies['next-auth.session-token'];
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Invalid session'
        });
    }
};

// Protected routes
router.get('/me', requireAuth, (req, res) => {
    return res.status(200).json({
        success: true,
        user: req.user
    });
});

export default router;
