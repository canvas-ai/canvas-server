// Utils
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('manager:session');
import EventEmitter from 'eventemitter2';
import { v4 as uuidv4 } from 'uuid';

// Includes
import Session from '@/prisma/models/Session.js';

// Environment
import env from '@/env.js';

/**
 * Session Manager
 * Handles user sessions and authentication
 * Implemented as a singleton
 */

// Singleton instance
let instance = null;

class SessionManager extends EventEmitter {

    #sessions = new Map();
    #config;
    #initialized = false;

    /**
     * Get the singleton instance
     * @param {Object} config - Configuration options
     * @returns {SessionManager} Singleton instance
     */
    static getInstance(config = {}) {
        if (!instance) {
            instance = new SessionManager(config);
        }
        return instance;
    }

    constructor(config = {}) {
        super();
        this.#config = {
            sessionTimeout: 24 * 60 * 60 * 1000, // Default 24 hours
            ...config
        };
        debug('Session Manager initialized');
    }

    /**
     * Initialize the session manager
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.#initialized) {
            return;
        }

        debug('Initializing session manager');

        // Load active sessions from database
        await this.#loadActiveSessions();

        this.#initialized = true;
        debug('Session manager initialized');
    }

    /**
     * Load active sessions from database
     * @private
     */
    async #loadActiveSessions() {
        try {
            const activeSessions = await Session.findMany({ isActive: true });

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
     * @returns {Promise<Object>} Session object
     */
    async createSession(userId, metadata = {}) {
        const sessionId = uuidv4();
        const sessionData = {
            id: sessionId,
            userId,
            metadata: JSON.stringify(metadata),
            createdAt: new Date(),
            lastActiveAt: new Date(),
            isActive: true
        };

        try {
            // Create session in database
            const session = await Session.create(sessionData);

            // Add to in-memory cache
            this.#sessions.set(sessionId, session);

            debug(`Session created for user ${userId}`, { sessionId });
            this.emit('session:created', session);

            return session;
        } catch (error) {
            debug(`Error creating session: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get a session by ID
     * @param {String} sessionId - Session ID
     * @returns {Promise<Object|null>} Session object or null if not found
     */
    async getSession(sessionId) {
        // Check cache first
        if (this.#sessions.has(sessionId)) {
            return this.#sessions.get(sessionId);
        }

        // Try to fetch from database
        try {
            const session = await Session.findById(sessionId);
            if (session && session.isActive) {
                this.#sessions.set(sessionId, session);
                return session;
            }
        } catch (error) {
            debug(`Error fetching session ${sessionId}: ${error.message}`);
        }

        return null;
    }

    /**
     * Get all sessions for a user
     * @param {String} userId - User ID
     * @returns {Promise<Array>} Array of session objects
     */
    async getUserSessions(userId) {
        try {
            const sessions = await Session.findByUserId(userId);

            // Update cache with any active sessions
            sessions.forEach(session => {
                if (session.isActive) {
                    this.#sessions.set(session.id, session);
                }
            });

            return sessions;
        } catch (error) {
            debug(`Error fetching sessions for user ${userId}: ${error.message}`);
            return [];
        }
    }

    /**
     * Update session last active time
     * @param {String} sessionId - Session ID
     * @returns {Promise<Boolean>} Success status
     */
    async touchSession(sessionId) {
        try {
            const session = await this.getSession(sessionId);
            if (!session) return false;

            const lastActiveAt = new Date();

            // Update in database
            await Session.update(sessionId, { lastActiveAt });

            // Update in cache
            session.lastActiveAt = lastActiveAt;

            return true;
        } catch (error) {
            debug(`Error updating session ${sessionId}: ${error.message}`);
            return false;
        }
    }

    /**
     * End a session
     * @param {String} sessionId - Session ID
     * @returns {Promise<Boolean>} Success status
     */
    async endSession(sessionId) {
        try {
            const session = await this.getSession(sessionId);
            if (!session) return false;

            const endedAt = new Date();

            // Update in database
            await Session.update(sessionId, {
                isActive: false,
                endedAt
            });

            // Remove from cache
            this.#sessions.delete(sessionId);

            debug(`Session ended for user ${session.userId}`, { sessionId });
            this.emit('session:ended', session);

            return true;
        } catch (error) {
            debug(`Error ending session ${sessionId}: ${error.message}`);
            return false;
        }
    }

    /**
     * End all sessions for a user
     * @param {String} userId - User ID
     * @returns {Promise<Number>} Number of sessions ended
     */
    async endUserSessions(userId) {
        try {
            const sessions = await this.getUserSessions(userId);
            let count = 0;

            for (const session of sessions) {
                if (session.isActive) {
                    await this.endSession(session.id);
                    count++;
                }
            }

            debug(`Ended ${count} sessions for user ${userId}`);
            return count;
        } catch (error) {
            debug(`Error ending sessions for user ${userId}: ${error.message}`);
            return 0;
        }
    }

    /**
     * Clean up expired sessions
     * @returns {Promise<Number>} Number of sessions cleaned up
     */
    async cleanupExpiredSessions() {
        const now = new Date();
        const sessionTimeout = this.#config.sessionTimeout;
        let count = 0;

        try {
            // Find all active sessions
            const activeSessions = await Session.findMany({ isActive: true });

            for (const session of activeSessions) {
                const lastActive = new Date(session.lastActiveAt);

                if (now - lastActive > sessionTimeout) {
                    await this.endSession(session.id);
                    count++;
                }
            }

            debug(`Cleaned up ${count} expired sessions`);
            return count;
        } catch (error) {
            debug(`Error cleaning up expired sessions: ${error.message}`);
            return 0;
        }
    }
}

// Export the singleton getter
export default SessionManager.getInstance;
