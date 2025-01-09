// Utils
import EventEmitter from 'eventemitter2';
import debug from 'debug';
const log = debug('canvas:session-manager');

// Includes
import Session from './lib/Session.js';
import { indexManager } from '../../Server.js';

// Defaults
const MAX_SESSIONS = 32; // 2^5
const CONTEXT_URL_BASE = '/';

/**
 * Session manager
 */

class SessionManager extends EventEmitter {
    static #instance = null;
    #maxSessions;

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

        // if (!options.sessionStore) {
        //     throw new Error('Session store required');
        // }

        if (!options.contextManager) {
            throw new Error('Context manager required');
        }

        this.contextManager = options.contextManager;

        this.sessionStore = new Map(); // Map-like (sync) interface, at some point we'll need to get rid of it
        this.#maxSessions = options.maxSessions || MAX_SESSIONS;

        // TODO: Refactor to use nested maps and serialize/deserialize to/from the session store
        // sessionID -> Map() which gets forwarede to the session object
        // deviceID -> device object within the session object to track
        // which devices are connected to the session
        this.sessions = new Map();
        
    }

    getSession(id) {
        let session;

        if (!id || id === null) {
            log('No session ID provided, initializing a default session');
            session = this.createSession(SESSION_DEFAULT_ID);
        } else {
            session = this.openSession(id);
            if (!session) {throw new Error(`Session with id "${id}" not found`);}
        }

        return session;
    }

    createSession(id = 'default', sessionOptions = {}) {
        id = (!id || id === null) ? 'default' : id;
        if (this.sessions.size >= this.#maxSessions) { throw new Error('Maximum number of sessions reached'); }

        // TODO: Refactor adhering to the single-responsibility principle

        log(`Creating session: ${id}`);
        // TODO: Add support for updating context/session options
        if (this.#isSessionOpen(id)) {
            log(`Session id "${id}" already exists and is active`);
            return this.sessions.get(id);
        }

        if (this.sessionStore.has(id)) {
            log(`Session id "${id}" already exists in session store`);
            return this.openSession(id);
        }

        const session = new Session(id, sessionOptions, this.contextManager); // ugly, the whole thing but this in particular
        this.sessions.set(id, session);
        this.#saveSessionToDb(session);

        log(`Session id "${id}" created, sessionOptions: ${JSON.stringify(sessionOptions)}`);
        this.emit('session-created', id); // Maybe I should return session instead, we'll see

        return session;
    }

    listActiveSessions() {
        return this.sessions.values();
    }

    async listSessions() {
        // TODO: Implement a combined list of active and stored sessions
        const sessions = await this.sessionStore.values(); // this is an async method
        return sessions;
    }

    openSession(id, autoInitSession = true) {
        if (!id || id === null) {
            log('No session ID provided, returning the default session');
            return this.openSession(SESSION_DEFAULT_ID);
        }

        log(`Trying to open session "${id}"`);
        if (this.#isSessionOpen(id)) {
            log(`Session ID "${id}" found and is active`);
            return this.sessions.get(id);
        }

        if (!this.sessionStore.has(id)) {
            log(`Session ID "${id}" not found in session store`);
            return (autoInitSession) ? this.createSession(id) : false;
        }

        let sessionConfig = this.#loadSessionFromDb(id);
        let session = new Session(id, sessionConfig, this.contextManager);
        this.sessions.set(id, session);

        log(`Session id "${id}" opened`);
        this.emit('session-opened', id);

        return session;
    }

    closeSession(id, autoSave = true) {
        log(`Closing session: ${id}`);
        if (!this.#isSessionOpen(id)) {
            log(`Session id "${id}" not found or already closed`);
            return false;
        }

        if (autoSave) { this.#saveSessionToDb(id); }

        let session = this.sessions.get(id);
        session.close();
        this.sessions.delete(id);

        log(`Session id "${id}" closed`);
        this.emit('session-closed', id);

        return id;
    }

    updateSession(id, sessionOptions) {
        if (!this.#isSessionOpen(id)) {
            log(`Session id "${id}" not found or already closed`);
            return false;
        }

        let session = this.sessions.get(id);
        session.update(sessionOptions);

        return session;
    }

    deleteSession(id) {
        log(`Deleting session: ${id}`);
        
        // we don't have open/close sessions
        // if (this.#isSessionOpen(id)) { // Maybe we should just return false here
        //     log(`Session id "${id}" active, attempting to close it`);
        //     if (this.closeSession(id)) {
        //         throw new Error('Error closing session');
        //     }
        // }

        if (!this.sessionStore.has(id)) {
            log(`Session id "${id}" not found in session store`);
            return false;
        }

        if (!this.#deleteSessionFromDb(id)) {
            throw new Error('Error deleting session from DB');
        }

        log(`Session id "${id}" deleted`);
        this.emit('session-deleted', id);

        return id;
    }

    async saveSessions() {
        for (let session of this.sessions.values()) {
            await this.#saveSessionToDb(session);
        }
    }


    /**
     * Internal methods
     */

    #isSessionOpen(id) {
        return this.sessions.has(id);
    }

    #saveSessionToDb(session) {
        log(`Saving session "${session.id}" to DB`);
        let json = session.toJSON();
        return this.sessionStore.set(session.id, json); // sync
    }

    #loadSessionFromDb(id) {
        log(`Loading session "${id}" from DB`);
        let json = this.sessionStore.get(id);
        if (!json) {
            log(`Session id "${id}" not found in session store`);
            return false;
        }
        return json;
    }

    #deleteSessionFromDb(id) {
        log(`Deleting session "${id}" from DB`);
        return this.sessionStore.delete(id);    // sync
    }
}

export default SessionManager.getInstance;
