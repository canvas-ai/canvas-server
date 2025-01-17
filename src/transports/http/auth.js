import express from 'express';
const router = express.Router();
import debugMessage from 'debug';
const debug = debugMessage('canvas:server:rest:auth');

export default function(authService) {
    // Register new user
    router.post('/register', async (req, res) => {
        const { email, password } = req.body;
        try {
            const { user, token } = await authService.register(email, password);
            authService.sessionService.setCookie(res, token);
            res.status(201).json({ token });
        } catch (error) {
            res.status(409).json({ error: error.message });
        }
    });

    // Login user
    router.post('/login', async (req, res) => {
        const { email, password } = req.body;
        try {
            const { user, token } = await authService.login(email, password);
            authService.sessionService.setCookie(res, token);
            res.json({ token });
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    });

    // Logout user
    router.post('/logout', (req, res) => {
        authService.logout(res);
        res.json({ message: 'Logged out successfully' });
    });

    return router;
}