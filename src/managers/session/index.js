// Utils
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('session-manager');
import EventEmitter from 'eventemitter2';
import { v4 as uuidv4 } from 'uuid';

// Includes
import Session from '@/prisma/models/Session.js';

/**
 * Session manager
 *
 * Manages user sessions and their associated contexts
 */
const MAX_SESSIONS = 32;

class SessionManager extends EventEmitter {
    #maxSessions;
    #initialized = false;
    #activeSessions = new Map();
    #userManager;

    constructor(options = {}) {
        super();
        debug('Initializing Session Manager');
        this.#maxSessions = options.maxSessions || MAX_SESSIONS;
        this.#userManager = options.userManager;

        if (!this.#userManager) {
            throw new Error('UserManager is required');
        }
    }

    async initialize() {
        if (this.#initialized) {
            return;
        }

        debug('Initializing session manager');

        this.#initialized = true;
    }

    /**
     * Get a session by ID
     * @param {string} id - Session ID
     * @returns {Promise<Object>} - Session object
     */
    async getSessionById(id) {
        // Check active sessions first
        if (this.#activeSessions.has(id)) {
            return this.#activeSessions.get(id);
        }

        // Fetch from database
        const session = await Session.findById(id);

        if (session) {
            this.#activeSessions.set(id, session);
        }

        return session;
    }

    /**
     * Get a session by user ID and name
     * @param {Object} user - User object
     * @param {string} name - Session name
     * @returns {Promise<Object>} - Session object
     */
    async getSession(user, name) {
        // Check if user is a string (ID) or object
        const userId = typeof user === 'string' ? user : user.id;

        // Check active sessions first
        for (const session of this.#activeSessions.values()) {
            if (session.userId === userId && session.name === name) {
                return session;
            }
        }

        // Fetch from database
        const session = await Session.findByUserIdAndName({ userId, name });

        if (session) {
            this.#activeSessions.set(session.id, session);
        }

        return session;
    }

    /**
     * Create a new session
     * @param {Object} user - User object
     * @param {string} name - Session name
     * @param {Object} sessionOptions - Session options
     * @returns {Promise<Object>} - Created session
     */
    async createSession(user, name, sessionOptions = {}) {
        if (!name) {
            throw new Error('No session name provided');
        }

        debug(`Creating session: ${name}`);

        // Check if user is a string (ID) or object
        const userId = typeof user === 'string' ? user : user.id;

        // Check if session already exists
        let session = await this.getSession(userId, name);

        if (session) {
            debug(`Session name "${name}" already exists in session store`);
            return session;
        }

        // Create session in database
        session = await Session.create({
            ...sessionOptions,
            name,
            user: userId,
            initializer: sessionOptions.initializer || 'system'
        });

        // Add to active sessions
        this.#activeSessions.set(session.id, session);

        debug(`Session name "${name}" created, sessionOptions: ${JSON.stringify(sessionOptions)}`);
        this.emit('session:created', session);

        return session;
    }

    /**
     * List sessions for a user
     * @param {Object} user - User object
     * @returns {Promise<Array<Object>>} - Array of session objects
     */
    async listSessions(user) {
        // Check if user is a string (ID) or object
        const userId = typeof user === 'string' ? user : user.id;

        return await Session.findMany({ userId });
    }

    /**
     * Update a session
     * @param {string} id - Session ID
     * @param {Object} data - Session data to update
     * @returns {Promise<boolean>} - True if session was updated
     */
    async updateSession(id, data) {
        const session = await Session.update(id, data);

        if (session && this.#activeSessions.has(id)) {
            this.#activeSessions.set(id, session);
        }

        this.emit('session:updated', id, data);
        return true;
    }

    /**
     * Delete a session
     * @param {Object} user - User object
     * @param {string} name - Session name
     * @returns {Promise<boolean>} - True if session was deleted
     */
    async deleteSession(user, name) {
        // Check if user is a string (ID) or object
        const userId = typeof user === 'string' ? user : user.id;

        // Find session
        const session = await this.getSession(userId, name);

        if (session) {
            // Remove from active sessions
            this.#activeSessions.delete(session.id);

            // Delete from database
            await Session.deleteMany({ userId, name });

            this.emit('session:deleted', { userId, name });
        }

        return true;
    }
}

export default SessionManager;
