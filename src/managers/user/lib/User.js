'use strict';

// Utils
import path from 'path';
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('manager:user');
import EventEmitter from 'eventemitter2';

// User-instantiated managers
import ContextManager from '../../../managers/context/index.js';

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
     */
    constructor(options = {}) {
        super(options.eventEmitterOptions || {});

        if (!options.id) { throw new Error('User ID is required'); }
        if (!options.email) { throw new Error('Email is required'); }
        if (!options.homePath) { throw new Error('Home path is required'); }
        if (!options.workspaceManager) { throw new Error('WorkspaceManager is required'); }

        /**
         * User properties
         */

        this.#id = options.id;
        this.#email = options.email;
        this.#homePath = path.resolve(options.homePath); // Ensure absolute path
        this.#userType = options.userType || 'user';
        this.#status = options.status || 'inactive';

        // Bind manager instances
        this.#workspaceManager = options.workspaceManager;
        this.#contextManager = options.contextManager || new ContextManager({
            user: this,
            workspaceManager: this.#workspaceManager,
            eventEmitterOptions: options.eventEmitterOptions,
            homePath: this.#homePath,
            jim: this.#workspaceManager.jim // Pass the JIM instance from workspace manager
        });

        debug(`User instance created: ${this.#id} (${this.#email}) with home path: ${this.#homePath}`);
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

}

export default User;
