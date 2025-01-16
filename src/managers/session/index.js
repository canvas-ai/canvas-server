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
    #user;

    static getInstance(options) {
        if (!SessionManager.#instance) {
            SessionManager.#instance = new SessionManager(options);
        }
        return SessionManager.#instance;
    }

    constructor(options = {}) {
        if (SessionManager.#instance) {
            throw new Error('SessionManager is a singleton. Use SessionManager.getInstance() instead.');
        }
        super();
        log('Initializing Session Manager');

        if (!options.contextManager) {
            throw new Error('Context manager required');
        }

        this.contextManager = options.contextManager;

        this.sessionStore = SessionStore();
        this.#maxSessions = options.maxSessions || MAX_SESSIONS;

        // TODO: Refactor to use nested maps and serialize/deserialize to/from the session store
        // sessionID -> Map() which gets forwarede to the session object
        // deviceID -> device object within the session object to track
        // which devices are connected to the session
        // this.sessions = new Map();
        
    }

    getSession(user, id, createIfNotFound = false) {
        let session;

        if (!id || id === null) {
            log('No session ID provided, initializing a default session');
            throw new Error('No session ID provided');
        } else {
            session = this.sessionStore.get(id);
            if (!session && createIfNotFound) {
                session = this.createSession(user, id);
            }
            if (!session) {
                throw new Error(`Session with id "${id}" not found`);
            }
        }

        if (session.userId !== user.id) {
            throw new Error(`Session with id "${id}" does not belong to the user`);
        }

        return session;
    }

    createSession(user, id, sessionOptions = {}) {
        if(!id || id === null) {
            throw new Error('No session ID provided');
        }

        if (this.sessionStore.size >= this.#maxSessions) { throw new Error('Maximum number of sessions reached'); }

        log(`Creating session: ${id}`);

        if (this.sessionStore.has(id)) {
            log(`Session id "${id}" already exists in session store`);
            const session = this.sessionStore.get(id);
            if (session.userId !== user.id) {
                throw new Error(`Session with id "${id}" already exists and does not belong to the user`);
            }
            return session;
        }

        const session = new Session(id, { ...sessionOptions, userId: user.id }, this.contextManager);
        this.sessionStore.setSync(id, session.toJSON());
        this.#saveSessionToDb(session);

        log(`Session id "${id}" created, sessionOptions: ${JSON.stringify(sessionOptions)}`);
        this.emit('session-created', id); // Maybe I should return session instead, we'll see

        return session;
    }

    async listSessions(user) {
        const sessions = this.sessionStore.values();
        return Array.from(sessions).filter(session => session.userId === user.id);
    }

    deleteSession(user, id) {
        log(`Deleting session: ${id}`);

        if (!this.sessionStore.has(id)) {
            log(`Session id "${id}" not found in session store`);
            return false;
        }

        const session = this.sessionStore.get(id);
        if (session.userId !== user.id) {
            throw new Error(`Session with id "${id}" does not belong to the user`);
        }

        if (!this.#deleteSessionFromDb(id)) {
            throw new Error('Error deleting session from DB');
        }

        log(`Session id "${id}" deleted`);
        this.emit('session-deleted', id);

        return id;
    }

    async saveSessions() {
        for (let session of this.sessionStore.values()) {
            await this.#saveSessionToDb(session);
        }
    }
    
    #saveSessionToDb(session) {
        if(!session.userId) {
            throw new Error('Session user ID is required');
        }
        log(`Saving session "${session.id}" to DB`);
        let json = session.toJSON();
        return this.sessionStore.setSync(session.id, json); // sync
    }

    #deleteSessionFromDb(id) {
        log(`Deleting session "${id}" from DB`);
        return this.sessionStore.deleteSync(id);    // sync
    }
}

export default SessionManager.getInstance;
