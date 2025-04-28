import express from 'express';
import passport from 'passport';

import logger, { createDebug } from '../../../../utils/log/index.js';
import ResponseObject from '../../../ResponseObject.js';
const debug = createDebug('http:routes:sessions');

export default function sessionsRoutes(options) {
    const router = express.Router();
    const { auth, sessionManager } = options;

    if (!auth) {
        throw new Error('Auth service is required');
    }

    if (!sessionManager) {
        throw new Error('Session manager is required');
    }

    // Middleware to get session from request
    const getSessionMiddleware = async (req, res, next) => {
        try {
            const sessionId = req.params.sessionId;
            if (!sessionId) {
                const response = new ResponseObject().badRequest('Session ID is required');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const session = await sessionManager.getSession(sessionId);
            if (!session) {
                const response = new ResponseObject().notFound(`Session with ID ${sessionId} not found`);
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Check if the user has access to this session
            if (session.userId !== req.user.id && !req.user.isAdmin) {
                const response = new ResponseObject().forbidden('You do not have permission to access this session');
                return res.status(response.statusCode).json(response.getResponse());
            }

            req.session = session;
            next();
        } catch (error) {
            debug(`Error getting session: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    };

    router.get('/', passport.authenticate('api-token', { session: false }), async (req, res) => {
        try {
            const userId = req.query.userId || req.user.id;

            // Check if the user is requesting sessions for another user
            if (userId !== req.user.id && !req.user.isAdmin) {
                const response = new ResponseObject().forbidden('You do not have permission to view sessions for other users');
                return res.status(response.statusCode).json(response.getResponse());
            }

            const sessions = await sessionManager.getUserSessions(userId);

            const response = new ResponseObject().success(
                {
                    sessions,
                    total: sessions.length,
                    limit: sessions.length,
                    offset: 0,
                },
                'Sessions retrieved successfully',
            );

            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error listing sessions: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.post('/', passport.authenticate('api-token', { session: false }), async (req, res) => {
        try {
            const { name, description } = req.body;

            const session = await sessionManager.createSession(req.user.id, {
                name: name || `Session ${new Date().toISOString()}`,
                description: description || 'Created via API',
                initializer: 'api',
            });

            const response = new ResponseObject().created(session, 'Session created successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error creating session: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
        }
    });

    router.get(
        '/:sessionId',
        passport.authenticate('api-token', { session: false }),
        getSessionMiddleware,
        async (req, res) => {
            try {
                const response = new ResponseObject().success(req.session, 'Session retrieved successfully');
                res.status(response.statusCode).json(response.getResponse());
            } catch (error) {
                debug(`Error getting session: ${error.message}`);
                const response = new ResponseObject().serverError(error.message);
                res.status(response.statusCode).json(response.getResponse());
            }
        },
    );

    router.delete(
        '/:sessionId',
        passport.authenticate('api-token', { session: false }),
        getSessionMiddleware,
        async (req, res) => {
            try {
                await sessionManager.endSession(req.session.id);

                const response = new ResponseObject().success(null, 'Session ended successfully');
                res.status(response.statusCode).json(response.getResponse());
            } catch (error) {
                debug(`Error ending session: ${error.message}`);
                const response = new ResponseObject().serverError(error.message);
                res.status(response.statusCode).json(response.getResponse());
            }
        },
    );

    return router;
}
