'use strict';

// Utils
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('manager:session');

/**
 * Session Class
 * Represents a user session in the system
 */
class Session {
    #id;
    #userId;
    #metadata;
    #isActive;
    #createdAt;
    #lastActiveAt;
    #endedAt;

    #store; // Reference to the index store

    /**
     * Create a new Session instance
     * @param {Object} store - JIM index store
     * @param {Object} sessionData - Session data
     */
    constructor(store, sessionData = {}) {
        if (!store) {
            throw new Error('Store is required for Session');
        }

        this.#store = store;
        this.#id = sessionData.id;
        this.#userId = sessionData.userId;

        // Handle metadata - could be a string (from DB) or an object (from code)
        if (typeof sessionData.metadata === 'string') {
            try {
                this.#metadata = JSON.parse(sessionData.metadata);
            } catch (e) {
                this.#metadata = {};
            }
        } else {
            this.#metadata = sessionData.metadata || {};
        }

        this.#isActive = sessionData.isActive !== undefined ? sessionData.isActive : true;
        this.#createdAt = sessionData.createdAt ? new Date(sessionData.createdAt) : new Date();
        this.#lastActiveAt = sessionData.lastActiveAt ? new Date(sessionData.lastActiveAt) : new Date();
        this.#endedAt = sessionData.endedAt ? new Date(sessionData.endedAt) : null;

        debug(`Session instance created: ${this.#id} for user ${this.#userId}`);
    }

    /**
     * Getters
     */
    get id() {
        return this.#id;
    }
    get userId() {
        return this.#userId;
    }
    get metadata() {
        return this.#metadata;
    }
    get isActive() {
        return this.#isActive;
    }
    get createdAt() {
        return this.#createdAt;
    }
    get lastActiveAt() {
        return this.#lastActiveAt;
    }
    get endedAt() {
        return this.#endedAt;
    }

    /**
     * Convert to a plain object for storage
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            id: this.#id,
            userId: this.#userId,
            metadata: JSON.stringify(this.#metadata),
            isActive: this.#isActive,
            createdAt: this.#createdAt.toISOString(),
            lastActiveAt: this.#lastActiveAt.toISOString(),
            endedAt: this.#endedAt ? this.#endedAt.toISOString() : null,
        };
    }

    /**
     * For console.log and JSON.stringify
     */
    [Symbol.for('nodejs.util.inspect.custom')]() {
        return {
            id: this.#id,
            userId: this.#userId,
            metadata: this.#metadata,
            isActive: this.#isActive,
            createdAt: this.#createdAt,
            lastActiveAt: this.#lastActiveAt,
            endedAt: this.#endedAt,
        };
    }

    /**
     * Save the session to the store
     * @returns {Promise<boolean>} Success status
     */
    async save() {
        try {
            this.#store.set(this.#id, this.toJSON());
            return true;
        } catch (error) {
            debug(`Error saving session ${this.#id}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete the session from the store
     * @returns {Promise<boolean>} Success status
     */
    async delete() {
        try {
            this.#store.delete(this.#id);
            return true;
        } catch (error) {
            debug(`Error deleting session ${this.#id}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update the session's last activity timestamp
     */
    touch() {
        this.#lastActiveAt = new Date();
    }

    /**
     * End the session
     */
    end() {
        this.#endedAt = new Date();
        this.#isActive = false;
    }
}

export default Session;
