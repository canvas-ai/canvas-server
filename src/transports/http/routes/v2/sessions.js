import express from 'express';
import passport from 'passport';


import logger, { createDebug } from '../../../../utils/log/index.js';
import ResponseObject from '../../../ResponseObject.js';
const debug = createDebug('http:routes:sessions');

/**
 * @swagger
 * components:
 *   schemas:
 *     Session:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The session ID
 *         userId:
 *           type: string
 *           description: The user ID
 *         contextId:
 *           type: string
 *           description: The context ID
 *         name:
 *           type: string
 *           description: The session name
 *         description:
 *           type: string
 *           description: The session description
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The creation timestamp
 *         lastActiveAt:
 *           type: string
 *           format: date-time
 *           description: The last activity timestamp
 *         isActive:
 *           type: boolean
 *           description: Whether the session is active
 */

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

    /**
     * @swagger
     * /:
     *   get:
     *     summary: List all sessions for the current user
     *     tags: [Sessions]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Sessions retrieved successfully
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /:
     *   post:
     *     summary: Create a new session
     *     tags: [Sessions]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *                 description: The session name
     *               description:
     *                 type: string
     *                 description: The session description
     *     responses:
     *       201:
     *         description: Session created successfully
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /:sessionId:
     *   get:
     *     summary: Get a specific session by ID
     *     tags: [Sessions]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: sessionId
     *         required: true
     *         schema:
     *           type: string
     *         description: The session ID
     *     responses:
     *       200:
     *         description: Session retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Session not found
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /:sessionId:
     *   delete:
     *     summary: End a session
     *     tags: [Sessions]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: sessionId
     *         required: true
     *         schema:
     *           type: string
     *         description: The session ID
     *     responses:
     *       200:
     *         description: Session ended successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Session not found
     *       500:
     *         description: Server error
     */
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
