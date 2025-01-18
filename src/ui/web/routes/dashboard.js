// src/ui/web/routes/dashboard.js
import express from 'express';
import { isAuthenticated } from '../auth/passport-config.js';
import { createAccessToken, getUserTokens } from '../db/database.js';
import crypto from 'crypto';

const router = express.Router();

// Protect all dashboard routes
router.use(isAuthenticated);

// Dashboard home
router.get('/', async (req, res) => {
    try {
        const tokens = await getUserTokens(req.user.email);
        res.render('dashboard', {
            user: req.user,
            tokens: tokens
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate new access token
router.post('/generate-token', async (req, res) => {
    try {
        const token = await createAccessToken(req.user.email);
        res.json({ token });
    } catch (error) {
        console.error('Token generation error:', error);
        res.status(500).json({ error: 'Error generating token' });
    }
});

// Revoke access token
router.delete('/revoke-token/:token', async (req, res) => {
    try {
        await revokeToken(req.params.token, req.user.email);
        res.json({ success: true });
    } catch (error) {
        console.error('Token revocation error:', error);
        res.status(500).json({ error: 'Error revoking token' });
    }
});

// Get user profile
router.get('/profile', (req, res) => {
    res.json({
        email: req.user.email,
        created_at: req.user.created_at
    });
});

// API endpoint to list all tokens
router.get('/tokens', async (req, res) => {
    try {
        const tokens = await getUserTokens(req.user.email);
        res.json(tokens);
    } catch (error) {
        console.error('Token list error:', error);
        res.status(500).json({ error: 'Error retrieving tokens' });
    }
});

export const dashboardRouter = router;