import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('canvas:events:user');

/**
 * User Event Handler
 *
 * Handles user-related events like user creation, deletion, etc.
 */
class UserEventHandler {
    #userManager;

    /**
     * Create a new UserEventHandler
     * @param {Object} options - Options
     * @param {Object} options.userManager - User manager instance
     */
    constructor(options = {}) {
        this.#userManager = options.userManager;

        if (!this.#userManager) {
            debug('User manager not provided, event handler will be limited');
        } else {
            this.setupHandlers();
        }

        debug('User event handler created');
    }

    /**
     * Set up event handlers
     */

    setupHandlers() {
        if (this.#userManager && typeof this.#userManager.on === 'function') {
            this.#userManager.on('user:created', this.handleUserCreated.bind(this));
            this.#userManager.on('user:deleted', this.handleUserDeleted.bind(this));
            debug('User event handlers set up');
        } else {
            debug('User manager does not support events, skipping event handlers');
        }
    }

    /**
     * Handle user creation event
     * @param {Object} user - Created user
     */
    async handleUserCreated(user) {
        debug(`User created: ${user.email} (${user.id})`);
    }

    /**
     * Handle user deletion event
     * @param {string} userId - Deleted user ID
     */
    async handleUserDeleted(userId) {
        debug(`User deleted: ${userId}`);
    }
}

export default UserEventHandler;
