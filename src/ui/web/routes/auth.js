// src/ui/web/routes/auth.js
import express from 'express';
import passport from 'passport';
import { createUser, findUserByEmail } from '../db/database.js';
import { isAuthenticated } from '../auth/passport-config.js';

const router = express.Router();

// Login routes
router.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    res.render('login');
});

router.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/auth/login',
    failureFlash: true
}));

// Registration routes
router.get('/register', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    res.render('register');
});

router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if user already exists
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new user
        await createUser(email, password);

        // Log in the new user automatically
        req.login({ email }, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Error logging in after registration' });
            }
            res.redirect('/dashboard');
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout route
router.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/auth/login');
    });
});

export const authRouter = router;