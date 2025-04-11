'use strict';

// Use console for logging in this simple service
const logPrefix = '[WorkspaceAuth]';
const debug = (...args) => console.debug(logPrefix, ...args);
const error = (...args) => console.error(logPrefix, ...args);

export default function authenticateToken(expectedToken) {
    if (!expectedToken) {
        error('Auth token was not provided to authenticateToken middleware setup');
        // Block all requests if no token is configured for security.
        return (req, res, next) => {
            res.status(500).json({ success: false, message: 'Server authentication not configured' });
        };
    }

    return (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        if (token === null) {
            debug('Auth token missing from request');
            return res.status(401).json({ success: false, message: 'Authentication token required' });
        }

        // Simple string comparison. Use bcrypt or similar for production tokens.
        if (token !== expectedToken) {
            debug('Invalid auth token received');
            return res.status(403).json({ success: false, message: 'Invalid authentication token' });
        }

        debug('Auth token validated successfully');
        // Optional: Attach minimal auth info if needed by routes later
        // req.auth = { type: 'token' };
        next();
    };
}
