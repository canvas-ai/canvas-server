// Utils
import EventEmitter from 'eventemitter2';
import debug from 'debug';
const log = debug('canvas:session-manager');

// Includes
import Session from './lib/Session.js';
import SessionStore from './store/index.js';

// Defaults
const MAX_SESSIONS = 32; // 2^5

/**
 * Session manager
 */

class SessionManager extends EventEmitter {
    static #instance = null;
    #maxSessions;
    #initialized = false;

    static async getInstance(options) {
        if (!SessionManager.#instance) {
            SessionManager.#instance = new SessionManager(options);
        }
        await SessionManager.#instance.initialize();
        return SessionManager.#instance;
    }

    constructor(options = {}) {
        if (SessionManager.#instance) {
            throw new Error('SessionManager is a singleton. Use SessionManager.getInstance() instead.');
        }
        super();
        log('Initializing Session Manager');

        this.#maxSessions = options.maxSessions || MAX_SESSIONS;
    }

    async initialize() {
        if (this.#initialized) {
            return;
        }

        this.sessionStore = await SessionStore();
        this.#initialized = true;
    }

    async getSession(user, name, createIfNotFound = false) {
        let session;

        if (!name || name === null) {
            log('No session name provided, initializing a default session');
            throw new Error('No session name provided');
        } else {
            session = await this.sessionStore.getUserSession(user.id, name);
            if (!session && createIfNotFound) {
                session = await this.createSession(user, name);
            }
            if (!session) {
                throw new Error(`Session with name "${name}" not found`);
            }
        }

        if (session.userId !== user.id) {
            throw new Error(`Session with name "${name}" does not belong to the user`);
        }

        return session;
    }

    async createSession(user, name, sessionOptions = {}) {
        if(!name || name === null) {
            throw new Error('No session name provided');
        }

        if (this.sessionStore.size >= this.#maxSessions) { throw new Error('Maximum number of sessions reached'); }

        log(`Creating session: ${name}`);

        const sess = await this.sessionStore.getUserSession(user.id, name);

        if (sess) {
            log(`Session name "${name}" already exists in session store`);
            if (sess.userId !== user.id) {
                throw new Error(`Session with name "${name}" already exists and does not belong to the user`);
            }
            return sess;
        }

        const session = new Session(name, { ...sessionOptions, userId: user.id });
        const dbSession = await this.sessionStore.saveSession(session.toJSON());

        log(`Session name "${name}" created, sessionOptions: ${JSON.stringify(sessionOptions)}`);
        this.emit('session:created', name); // Maybe I should return session instead, we'll see

        return dbSession;
    }

    async listSessions(user) {
        return await this.sessionStore.getUserSessions(user.id);
    }

    async updateSession(id, data) {
        return await this.sessionStore.updateSession(id, data);
    }

    async deleteSession(user, name) {
        return await this.sessionStore.deleteUserSession(user.id, name);
    }
}

export default SessionManager.getInstance;
