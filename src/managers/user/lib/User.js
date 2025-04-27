'use strict';

// Utils
import path from 'path';
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('manager:user');
import EventEmitter from 'eventemitter2';

// Managers
import {
    getSessionManager,
    getContextManager,
} from '../../../Server.js';

/**
 * User Class
 */

class User extends EventEmitter {
    // Immutable properties set at construction
    #id;
    #email;
    #userType;
    #homePath;

    // Manager instances
    #workspaceManager;
    #contextManager;
    #sessionManager;

    // Runtime state
    #status = 'inactive'; // inactive, active, disabled, deleted
    #startTime = Date.now();

    // User stats
    #stats = {
        sessions: {
            total: 0,
            active: 0,
        },
        workspaces: {
            total: 0,
            open: 0,
        },
        contexts: {
            total: 0,
            active: 0,
        },
    };


    /**
     * Create a new User instance
     * @param {Object} options - User options
     * @param {string} options.id - User ID
     * @param {string} options.email - User email
     * @param {string} options.homePath - User home path (Universe workspace)
     * @param {string} [options.userType='user'] - User type ('user' or 'admin')
     * @param {string} [options.status='inactive'] - User status
     * @param {Object} options.jim - JSON Index Manager instance
     * @param {Object} [options.workspaceManager] - Workspace manager instance
     * @param {Object} [options.contextManager] - Context manager instance
     * @param {Object} [options.sessionManager] - Session manager instance
     */
    constructor(options = {}) {
        super(options.eventEmitterOptions || {});

        if (!options.id) { throw new Error('User ID is required'); }
        if (!options.email) { throw new Error('Email is required'); }
        if (!options.homePath) { throw new Error('Home path is required'); }

        /**
         * User properties
         */

        this.#id = options.id;
        this.#email = options.email;
        this.#homePath = options.homePath;
        this.#userType = options.userType || 'user';
        this.#status = options.status || 'inactive';

        // Bind manager instances
        this.#workspaceManager = options.workspaceManager;

        // Try to get context manager, but don't throw if not available yet
        try {
            this.#contextManager = options.contextManager || getContextManager();
        } catch (error) {
            debug(`Context manager not available during user creation: ${error.message}`);
            this.#contextManager = null;
        }

        // Try to get session manager, but don't throw if not available yet
        try {
            this.#sessionManager = options.sessionManager || getSessionManager();
        } catch (error) {
            debug(`Session manager not available during user creation: ${error.message}`);
            this.#sessionManager = null;
        }

        debug(`User instance created: ${this.#id} (${this.#email})`);
    }

    /**
     * Getters
     */

    get id() { return this.#id; }
    get email() { return this.#email; }
    get userType() { return this.#userType; }
    get homePath() { return this.#homePath; }
    get status() { return this.#status; }
    get stats() { return this.#stats; }
    get uptime() { return Date.now() - this.#startTime; }
    get configPath() { return path.join(this.#homePath, 'Config'); }

    // Managers
    get workspaceManager() { return this.#workspaceManager; }
    get contextManager() { return this.#contextManager; }
    get sessionManager() { return this.#sessionManager; }

    /**
     * Main User module (abstraction as of now) API
     * "You ain't gonna need it!" so list methods only
     */

    listWorkspaces() {
        if (!this.#workspaceManager) {
            throw new Error('Workspace manager is not set');
        }
        return this.#workspaceManager.listWorkspaces(this.#id);
    }

    listContexts() {
        if (!this.#contextManager) {
            throw new Error('Context manager is not set');
        }
        return this.#contextManager.listContexts(this.#id);
    }

    listSessions() {
        if (!this.#sessionManager) {
            throw new Error('Session manager is not set');
        }
        return this.#sessionManager.listSessions(this.#id);
    }

    /**
     * Utility methods
     */

    isAdmin() {
        return this.#userType === 'admin';
    }

    isActive() {
        return this.#status === 'active';
    }

    /**
     * Convert user to JSON
     * @returns {Object} User JSON representation
     */
    toJSON() {
        return {
            id: this.#id,
            email: this.#email,
            userType: this.#userType,
            homePath: this.#homePath,
            status: this.#status,
            stats: this.#stats,
        };
    }

    /**
     * Sets the context manager instance for this user
     * @param {Object} contextManager - Context manager instance
     */
    setContextManager(contextManager) {
        if (!this.#contextManager && contextManager) {
            this.#contextManager = contextManager;
            debug(`Context manager set for user: ${this.#id}`);
        }
    }

    /**
     * Sets the session manager instance for this user
     * @param {Object} sessionManager - Session manager instance
     */
    setSessionManager(sessionManager) {
        if (!this.#sessionManager && sessionManager) {
            this.#sessionManager = sessionManager;
            debug(`Session manager set for user: ${this.#id}`);
        }
    }

}

export default User;
