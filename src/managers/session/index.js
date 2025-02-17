// Utils
import EventEmitter from 'eventemitter2';
import debug from 'debug';
const log = debug('canvas:session-manager');

// Includes
import Session from '../prisma/models/Session.js';

/**
 * Session manager
 */

const MAX_SESSIONS = 32;

class SessionManager extends EventEmitter {
    #maxSessions;
    #initialized = false;

    constructor(options = {}) {
        super();
        log('Initializing Session Manager');
        this.#maxSessions = options.maxSessions || MAX_SESSIONS;
    }

    async initialize() {
        if (this.#initialized) {
            return;
        }
        this.#initialized = true;
    }

    async getSession(user, name) {
        return await Session.findByUserIdAndName({ userId: user.id, name });
    }

    async createSession(user, name, sessionOptions = {}) {
        if(!name || name === null) {
            throw new Error('No session name provided');
        }

        log(`Creating session: ${name}`);

        let session = await Session.findByUserIdAndName({ userId: user.id, name });

        if (session) {
            log(`Session name "${name}" already exists in session store`);
            return session;
        }

        session = await Session.create({ ...sessionOptions, name, user: user.id });

        log(`Session name "${name}" created, sessionOptions: ${JSON.stringify(sessionOptions)}`);
        this.emit('session:created', session);

        return session;
    }

    async listSessions(user) {
        return await Session.findMany({ userId: user.id });
    }

    async updateSession(id, data) {
        await Session.update(id, data);
        this.emit('session:updated', id, data);
        return true;
    }

    async deleteSession(user, name) {
        await Session.deleteMany({ userId: user.id, name });
        this.emit('session:deleted', { userId: user.id, name });
        return true;
    }
}

// Create and export a single instance
const sessionManager = new SessionManager();
await sessionManager.initialize();
export default sessionManager;
