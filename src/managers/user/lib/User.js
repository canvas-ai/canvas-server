'use strict';

// Utils
import path from 'path';
import fs from 'fs/promises';
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('user');
import EventEmitter from 'eventemitter2';

// Manager singletons
import workspaceManager from '../../../Server.js';
import contextManager from '../../../Server.js';

/**
 * User Class
 * (More of a placeholder for now)
 */

class User extends EventEmitter {

    // Immutable properties set at construction
    #id;
    #email;
    #userType;
    #homePath;

    // User data storage
    #tokenStore;

    // Runtime state
    #status = 'inactive'; // inactive, active, disabled, deleted
    #startTime;

    // User stats
    #stats = {
        workspaces: {
            total: 0,
            open: 0,
        },
        contexts: {
            total: 0,
            active: 0,
        },
        apiTokens: {
            global: 0,
            perWorkspace: 0,
        },
    };

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
    get stats() { return {}; }

    isAdmin() { return this.#userType === 'admin'; }
    isActive() { return this.#status === 'active'; }

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
            stats: {}
        };
    }

}

export default User;
