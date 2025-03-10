// Utils
import EventEmitter from 'eventemitter2';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('context-manager');

// Includes
import Context from './lib/Context.js';
import Url from './lib/Url.js';

/**
 * Context Manager
 * Manages contexts for users across workspaces
 */

class ContextManager extends EventEmitter {

    #activeContexts = new Map();
    #workspaceManager;

    constructor(options = {}) {
        super(); // EventEmitter

        debug('Initializing context manager');
        this.#workspaceManager = options.workspaceManager;
        if (!this.#workspaceManager) {
            throw new Error('WorkspaceManager is required');
        }

        debug('Context manager initialized');
    }

    async createContext(url, options = {}) {
        const parsed = new Url(url);
        const userID = options.user?.email;
        debug(`Creating context with URL: ${parsed.url} for user: ${userID}`);

        if (!userID) {
            throw new Error('User is required to create a context');
        }

        if (!parsed.workspaceID) {
            parsed.workspaceID = 'universe';
        }

        // Check if the workspace exists for the user
        if (!this.#workspaceManager.hasWorkspace(userID, parsed.workspaceID)) {
            throw new Error(`Workspace not found: ${parsed.workspaceID}`);
        }

        const workspace = await this.#workspaceManager.openWorkspace(userID, parsed.workspaceID);
        debug(`Opened workspace: ${workspace.name}`);

        // Create the context
        const context = new Context(url, {
            ...options,
            workspace: workspace,
            workspaceManager: this.#workspaceManager // Inject the workspace manager
        });

        // Initialize the context (handle any pending URL switch)
        await context.initialize();

        // Add to contexts
        this.#activeContexts.set(context.id, context);

        // Emit the created event
        this.emit('context:created', context.id);

        // Return the context
        return context;
    }

    /**
     * Get a context by ID
     * @param {string} id - Context ID
     * @returns {Context} - Context instance
     */
    getContext(id) {
        const context = this.#activeContexts.get(id);

        if (!context) {
            throw new Error(`Context with id "${id}" not found`);
        }

        return context;
    }

    /**
     * List all active contexts
     * @returns {Array<Context>} - Array of context instances
     */
    listContexts() {
        return Array.from(this.#activeContexts.values());
    }

    /**
     * Remove a context
     * @param {string} id - Context ID
     * @returns {boolean} - True if context was removed
     */
    async removeContext(id) {
        const context = this.#activeContexts.get(id);

        if (!context) {
            return false;
        }

        await context.destroy();
        this.#activeContexts.delete(id);

        this.emit('context:removed', id);
        return true;
    }

}

export default ContextManager;
