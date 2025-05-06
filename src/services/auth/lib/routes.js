import express from 'express';
import auth from './auth.js';
import tokenService from './tokenService.js';
import { authenticate, requireApiToken } from './middleware.js';

const router = express.Router();

/**
 * Register a new user
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await auth.createUser({
            email,
            password
        });

        // Create a default API token for the user
        const token = await tokenService.createToken(user.id, 'Default API Token');

        res.status(201).json({
            user: {
                id: user.id,
                email: user.email
            },
            token: token.token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

/**
 * Login with email and password
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const session = await auth.signIn('credentials', {
            email,
            password
        });

        if (!session) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json(session);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

/**
 * Create a new API token
 */
router.post('/tokens', authenticate, async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Token name is required' });
        }

        const token = await tokenService.createToken(req.user.id, name);
        res.status(201).json({
            id: token.id,
            name: token.name,
            token: token.token,
            createdAt: token.createdAt
        });
    } catch (error) {
        console.error('Token creation error:', error);
        res.status(500).json({ error: 'Failed to create token' });
    }
});

/**
 * List user's API tokens
 */
router.get('/tokens', authenticate, async (req, res) => {
    try {
        const tokens = await tokenService.getTokensByUserId(req.user.id);
        res.json(tokens.map(token => ({
            id: token.id,
            name: token.name,
            createdAt: token.createdAt,
            lastUsedAt: token.lastUsedAt
        })));
    } catch (error) {
        console.error('Token list error:', error);
        res.status(500).json({ error: 'Failed to list tokens' });
    }
});

/**
 * Delete an API token
 */
router.delete('/tokens/:id', authenticate, async (req, res) => {
    try {
        const token = await tokenService.getToken(req.params.id);

        if (!token) {
            return res.status(404).json({ error: 'Token not found' });
        }

        if (token.userId !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this token' });
        }

        await tokenService.deleteToken(token.id);
        res.status(204).send();
    } catch (error) {
        console.error('Token deletion error:', error);
        res.status(500).json({ error: 'Failed to delete token' });
    }
});

export default router;
