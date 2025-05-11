'use strict';

// Utils
import path from 'path';
import EventEmitter from 'eventemitter2';
import { generateULID } from '../../../utils/id.js';

// Logging
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('user-manager:user');

// Constants
import { USER_STATUS_CODES } from '../index.js';

/**
 * User Class
 */

class User extends EventEmitter {

    #id;
    #email;
    #userType;
    #homePath;

    // Runtime state
    #status = 'inactive'; // inactive, active, disabled, deleted
    #startTime = Date.now(); // User container start time

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

        // Validate required options
        if (!options.id) { throw new Error('ID is required'); }
        if (!options.email) { throw new Error('Email is required'); }
        if (!options.homePath) { throw new Error('Home path is required'); }

        /**
         * User properties
         */

        this.#id = options.id || generateULID(12, 'lower');
        this.#email = options.email;
        this.#homePath = path.resolve(options.homePath); // Ensure absolute path
        this.#userType = options.userType || 'user';
        this.#status = options.status || 'inactive';
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
    get uptime() { return Date.now() - this.#startTime; }

    /**
     * Setters
     */

    set status(status) {
        if (!USER_STATUS_CODES.includes(status)) {
            throw new Error(`Invalid status: ${status}`);
        }
        this.#status = status;
        this.emit('update', {
            id: this.#id,
            email: this.#email,
            status: this.#status
        });
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
            status: this.#status
        };
    }

}

export default User;
