import express from 'express';
const router = express.Router();
import debugMessage from 'debug';
const debug = debugMessage('canvas:server:rest:sessions');
import SessionManager from '../../../../managers/session/index.js';
import ContextManager from '../../../../managers/context/index.js';

const sessionManager = SessionManager({
  contextManager: new ContextManager({
    indexStore: new Map(),
    db: new Map(),
  }),
});

// List all sessions
router.get('/', async (req, res) => {
    const response = new req.ResponseObject();
    try {
        const sessions = await sessionManager.listSessions(req.user);
        debug('[GET] List sessions');
        res.json(response.success(Array.from(sessions)).getResponse());
    } catch (error) {
        debug(`[GET] List sessions error: ${error}`);
        res.json(response.error('Failed to list sessions: ' + error.message).getResponse());
    }
});

router.post('/', async (req, res) => {
    const response = new req.ResponseObject();
    const { name } = req.body;
    if (!name) {
        return res.json(response.badRequest('Session name is required').getResponse());
    }
    try {
        const session = await sessionManager.createSession(req.user, name);
        res.json(response.success(session).getResponse());
    } catch (error) {
        debug(`[POST] Create session error: ${error}`);
        res.json(response.error('Failed to create session: ' + error.message).getResponse());
    }
});

// Get/create session by session name
router.get('/:name', async (req, res) => {
    const response = new req.ResponseObject();
    const { name } = req.params;

    try {
        debug(`[GET] Get session: ${name}`);
        const session = await sessionManager.getSession(req.user, name, false);
        if (!session) {
            return res.json(response.notFound('Session not found').getResponse());
        }
        res.json(response.success(session).getResponse());
    } catch (error) {
        debug(`[GET] Get session error: ${error}`);
        res.json(response.error('Failed to get session: ' + error.message).getResponse());
    }
});

// Delete session
router.delete('/:name', async (req, res) => {
    const response = new req.ResponseObject();
    const { name } = req.params;

    try {
        debug(`[DELETE] Delete session: ${name}`);
        const result = await sessionManager.deleteSession(req.user, name);
        if (!result) {
            return res.json(response.notFound('Session not found').getResponse());
        }
        res.json(response.success({ message: 'Session deleted successfully' }).getResponse());
    } catch (error) {
        debug(`[DELETE] Delete session error: ${error}`);
        res.json(response.error('Failed to delete session: ' + error.message).getResponse());
    }
});

export default router;