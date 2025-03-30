// Utils
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('manager:session');
import EventEmitter from 'eventemitter2';
import { v4 as uuidv4 } from 'uuid';

// Includes
import Session from './lib/Session.js';

/**
 * Session Manager
 * Handles user sessions and authentication
 */

class SessionManager extends EventEmitter {
    #sessionStore;
    #sessionOptions;
    #sessions = new Map();
    #initialized = false;

    constructor(sessionStore, sessionOptions = {}) {
        super();

        if (!sessionStore) {
            throw new Error('Session store is required');
        }

        this.#sessionStore = sessionStore;
        this.#sessionOptions = {
            sessionTimeout: 7 * 24 * 60 * 60 * 1000, // Default 7 days
            ...sessionOptions,
        };

        debug('Session Manager options', this.#sessionOptions);
    }

    async initialize() {
        if (this.#initialized) {
            return;
        }
        debug('Initializing session manager');

        // Load active sessions from database
        await this.#loadSessionsFromStore();

        this.#initialized = true;
        debug('Session manager initialized');
    }

    /**
     * Create a new session for a user
     * @param {String} userId - User ID
     * @param {Object} metadata - Session metadata (device, app, etc.)
     * @returns {Promise<Object>} Session object
     */
    async createSession(userId, metadata = {}) {
        if (!userId) {
            throw new Error('User ID is required to create a session');
        }

        const sessionId = uuidv4();
        const sessionData = {
            id: sessionId,
            userId,
            metadata,
            createdAt: new Date(),
            lastActiveAt: new Date(),
            isActive: true,
        };

        try {
            // Create session in database
            const session = new Session(this.#sessionStore, sessionData);
            await session.save();

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
        if (!sessionId) {
            return null;
        }

        // Check cache first
        if (this.#sessions.has(sessionId)) {
            const cachedSession = this.#sessions.get(sessionId);

            // Validate the session is still active
            if (this.#isSessionValid(cachedSession)) {
                return cachedSession;
            } else {
                // Remove invalid session from cache
                this.#sessions.delete(sessionId);
            }
        }

        // Try to fetch from database
        try {
            const sessionData = await this.#sessionStore.get(sessionId);
            if (sessionData) {
                const session = new Session(this.#sessionStore, sessionData);

                // Only cache active sessions
                if (session.isActive) {
                    // Validate the session hasn't expired
                    if (this.#isSessionValid(session)) {
                        this.#sessions.set(sessionId, session);
                        return session;
                    } else {
                        // End the session if it's expired
                        await this.endSession(sessionId);
                    }
                }
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
        if (!userId) {
            return [];
        }

        try {
            const allSessions = [];
            // Get all sessions from the store
            for (const entry of this.#sessionStore.getRange()) {
                const sessionData = entry.value;
                if (sessionData && sessionData.userId === userId) {
                    const session = new Session(this.#sessionStore, sessionData);
                    allSessions.push(session);

                    // Update cache with active sessions
                    if (session.isActive && this.#isSessionValid(session)) {
                        this.#sessions.set(session.id, session);
                    }
                }
            }

            return allSessions;
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
            if (!session) {
                return false;
            }

            session.touch();
            await session.save();

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
            if (!session) {
                return false;
            }

            session.end();
            await session.save();

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
    async endAllUserSessions(userId) {
        if (!userId) {
            return 0;
        }

        try {
            const userSessions = await this.getUserSessions(userId);
            const activeSessions = userSessions.filter((session) => session.isActive);

            for (const session of activeSessions) {
                await this.endSession(session.id);
            }

            return activeSessions.length;
        } catch (error) {
            debug(`Error ending all sessions for user ${userId}: ${error.message}`);
            return 0;
        }
    }

    /**
     * Clean up expired sessions
     * @returns {Promise<Number>} Number of sessions cleaned up
     */
    async cleanupExpiredSessions() {
        const now = new Date();
        const sessionTimeout = this.#sessionOptions.sessionTimeout;
        let count = 0;

        try {
            // Find all active sessions
            const activeSessions = [];

            for (const entry of this.#sessionStore.getRange()) {
                const sessionData = entry.value;
                if (sessionData && sessionData.isActive) {
                    const session = new Session(this.#sessionStore, sessionData);
                    activeSessions.push(session);
                }
            }

            for (const session of activeSessions) {
                const lastActive = session.lastActiveAt;
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

    /**
     * Check if a session is valid (not expired)
     * @param {Session} session - Session object
     * @returns {Boolean} Whether the session is valid
     * @private
     */
    #isSessionValid(session) {
        if (!session || !session.isActive) {
            return false;
        }

        const now = new Date();
        const lastActive = session.lastActiveAt;
        const sessionTimeout = this.#sessionOptions.sessionTimeout;

        return now - lastActive <= sessionTimeout;
    }

    /**
     * Load active sessions from database
     * @private
     */
    async #loadSessionsFromStore() {
        try {
            const activeSessions = [];

            // Iterate through all entries in the store
            for (const entry of this.#sessionStore.getRange()) {
                const sessionData = entry.value;
                if (sessionData && sessionData.isActive) {
                    const session = new Session(this.#sessionStore, sessionData);

                    // Only load valid sessions
                    if (this.#isSessionValid(session)) {
                        activeSessions.push(session);
                        this.#sessions.set(session.id, session);
                    } else {
                        // End expired sessions
                        session.end();
                        await session.save();
                    }
                }
            }

            debug(`Loaded ${activeSessions.length} active sessions from database`);
        } catch (error) {
            debug(`Error loading sessions from database: ${error.message}`);
        }
    }
}

// Export the singleton getter
export default SessionManager;
