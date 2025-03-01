// Utils
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('manager:session');
import EventEmitter from 'eventemitter2';
import { v4 as uuidv4 } from 'uuid';

// Includes
import Session from '@/prisma/models/Session.js';

/**
 * Session Manager
 * Handles user sessions and authentication
 */

class SessionManager extends EventEmitter {

    #sessions = new Map();
    #config;
    #userManager;

    constructor(config = {}) {
        super();
        this.#config = config;
        debug('Session Manager initialized');
    }

    /**
     * Initialize with external dependencies
     * @param {Object} dependencies - External dependencies
     */
    initialize(dependencies) {
        const { userManager } = dependencies;
        this.#userManager = userManager;
        debug('Session Manager dependencies initialized');
    }

    /**
     * Create a new session for a user
     * @param {String} userId - User ID
     * @param {Object} metadata - Session metadata (device, app, etc.)
     * @returns {Object} Session object
     */
    createSession(userId, metadata = {}) {
        const sessionId = uuidv4();
        const session = {
            id: sessionId,
            userId,
            metadata,
            createdAt: new Date(),
            lastActiveAt: new Date(),
            isActive: true
        };

        this.#sessions.set(sessionId, session);
        debug(`Session created for user ${userId}`, { sessionId });

        return session;
    }

    /**
     * Get a session by ID
     * @param {String} sessionId - Session ID
     * @returns {Object|null} Session object or null if not found
     */
    getSession(sessionId) {
        return this.#sessions.get(sessionId) || null;
    }

    /**
     * Get all sessions for a user
     * @param {String} userId - User ID
     * @returns {Array} Array of session objects
     */
    getUserSessions(userId) {
        const userSessions = [];

        for (const session of this.#sessions.values()) {
            if (session.userId === userId) {
                userSessions.push(session);
            }
        }

        return userSessions;
    }

    /**
     * Update session last active time
     * @param {String} sessionId - Session ID
     * @returns {Boolean} Success status
     */
    touchSession(sessionId) {
        const session = this.#sessions.get(sessionId);
        if (!session) return false;

        session.lastActiveAt = new Date();
        return true;
    }

    /**
     * End a session
     * @param {String} sessionId - Session ID
     * @returns {Boolean} Success status
     */
    endSession(sessionId) {
        const session = this.#sessions.get(sessionId);
        if (!session) return false;

        session.isActive = false;
        session.endedAt = new Date();

        // Optionally remove from active sessions map
        this.#sessions.delete(sessionId);

        debug(`Session ended for user ${session.userId}`, { sessionId });
        return true;
    }

    /**
     * End all sessions for a user
     * @param {String} userId - User ID
     * @returns {Number} Number of sessions ended
     */
    endUserSessions(userId) {
        let count = 0;

        for (const [sessionId, session] of this.#sessions.entries()) {
            if (session.userId === userId) {
                this.endSession(sessionId);
                count++;
            }
        }

        debug(`Ended ${count} sessions for user ${userId}`);
        return count;
    }
}

export default SessionManager;
