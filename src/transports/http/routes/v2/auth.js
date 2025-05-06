import express from 'express';
import { createDebug } from '../../../../utils/log/index.js';
import authHandler from '../../../../services/auth/lib/auth.js';

const debug = createDebug('canvas:auth:routes');
const router = express.Router();

// ===== Auth.js Routes =====

// Sign in route
router.post('/signin', authHandler);

// Sign out route
router.post('/signout', authHandler);

// Get current user
router.get('/me', authHandler);

// Update password
router.put('/password', authHandler);

// ===== API Token Management Routes =====

// List API tokens
router.get('/tokens', authHandler);

// Generate new API token
router.post('/tokens', authHandler);

// Delete API token
router.delete('/tokens/:tokenId', authHandler);

export default router;
