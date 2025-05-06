import auth from './auth.js';
import tokenService from './tokenService.js';

/**
 * Middleware to authenticate requests using either JWT or API token
 */
export async function authenticate(req, res, next) {
    try {
        // Try JWT authentication first
        const session = await auth.getSession(req);
        if (session?.user) {
            req.user = session.user;
            return next();
        }

        // Try API token authentication
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const tokenData = await tokenService.getToken(token);

            if (tokenData) {
                // Update token last used
                await tokenService.updateTokenLastUsed(tokenData.id);

                req.user = {
                    id: tokenData.userId,
                    tokenId: tokenData.id
                };
                return next();
            }
        }

        // No valid authentication found
        res.status(401).json({ error: 'Unauthorized' });
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Middleware to require admin privileges
 */
export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Implement admin check once we add user roles
    // For now, we'll just allow access
    next();
}

/**
 * Middleware to require API token authentication
 */
export async function requireApiToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'API token required' });
    }

    const token = authHeader.substring(7);
    const tokenData = await tokenService.getToken(token);

    if (!tokenData) {
        return res.status(401).json({ error: 'Invalid API token' });
    }

    // Update token last used
    await tokenService.updateTokenLastUsed(tokenData.id);

    req.user = {
        id: tokenData.userId,
        tokenId: tokenData.id
    };
    next();
}
