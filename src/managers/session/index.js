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
    #db;

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
        const { db } = dependencies;
        this.#db = db;
        debug('Session Manager dependencies initialized');

        // Load active sessions from database if available
        this.#loadActiveSessions();
    }

    /**
     * Load active sessions from database
     * @private
     */
    async #loadActiveSessions() {
        if (!this.#db) return;

        try {
            const activeSessions = await Session.findActive();

            if (activeSessions && activeSessions.length > 0) {
                activeSessions.forEach(session => {
                    this.#sessions.set(session.id, session);
                });
                debug(`Loaded ${activeSessions.length} active sessions from database`);
            }
        } catch (error) {
            debug(`Error loading active sessions: ${error.message}`);
        }
    }

    /**
     * Create a new session for a user
     * @param {String} userId - User ID
     * @param {Object} metadata - Session metadata (device, app, etc.)
     * @returns {Object} Session object
     */
    async createSession(userId, metadata = {}) {
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

        // Save to database if available
        if (this.#db) {
            try {
                await Session.create(session);
                debug(`Session saved to database: ${sessionId}`);
            } catch (error) {
                debug(`Error saving session to database: ${error.message}`);
            }
        }

        this.emit('session:created', session);
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

        // Update in database if available
        if (this.#db) {
            try {
                Session.update(sessionId, { lastActiveAt: session.lastActiveAt });
                debug(`Session updated in database: ${sessionId}`);
            } catch (error) {
                debug(`Error updating session in database: ${error.message}`);
            }
        }

        return true;
    }

    /**
     * End a session
     * @param {String} sessionId - Session ID
     * @returns {Boolean} Success status
     */
    async endSession(sessionId) {
        const session = this.#sessions.get(sessionId);
        if (!session) return false;

        session.isActive = false;
        session.endedAt = new Date();

        // Update in database if available
        if (this.#db) {
            try {
                await Session.update(sessionId, {
                    isActive: false,
                    endedAt: session.endedAt
                });
                debug(`Session ended in database: ${sessionId}`);
            } catch (error) {
                debug(`Error ending session in database: ${error.message}`);
            }
        }

        // Remove from active sessions map
        this.#sessions.delete(sessionId);

        debug(`Session ended for user ${session.userId}`, { sessionId });
        this.emit('session:ended', session);

        return true;
    }

    /**
     * End all sessions for a user
     * @param {String} userId - User ID
     * @returns {Number} Number of sessions ended
     */
    async endUserSessions(userId) {
        let count = 0;
        const sessionIds = [];

        for (const [sessionId, session] of this.#sessions.entries()) {
            if (session.userId === userId) {
                sessionIds.push(sessionId);
            }
        }

        // End each session
        for (const sessionId of sessionIds) {
            await this.endSession(sessionId);
            count++;
        }

        debug(`Ended ${count} sessions for user ${userId}`);
        return count;
    }

    /**
     * Clean up expired sessions
     * @returns {Number} Number of sessions cleaned up
     */
    async cleanupExpiredSessions() {
        const now = new Date();
        let count = 0;
        const expiredSessionIds = [];

        // Find expired sessions
        for (const [sessionId, session] of this.#sessions.entries()) {
            const lastActive = new Date(session.lastActiveAt);
            const sessionTimeout = this.#config.sessionTimeout || 24 * 60 * 60 * 1000; // Default 24 hours

            if (now - lastActive > sessionTimeout) {
                expiredSessionIds.push(sessionId);
            }
        }

        // End each expired session
        for (const sessionId of expiredSessionIds) {
            await this.endSession(sessionId);
            count++;
        }

        debug(`Cleaned up ${count} expired sessions`);
        return count;
    }
}

export default SessionManager;
