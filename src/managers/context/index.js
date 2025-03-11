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

    #user;
    #workspaceManager;
    #activeContexts = new Map();

    constructor(options = {}) {
        super(); // EventEmitter
        debug('Context manager initialized');
        this.#user = options.user;
        this.#workspaceManager = options.workspaceManager;
    }

    async createContext(url = '/', options = {}) {
        // Check if a specific context ID was provided and if it already exists
        if (options.id && this.#activeContexts.has(options.id)) {
            debug(`Context with ID ${options.id} already exists, returning existing context`);
            return this.#activeContexts.get(options.id);
        }

        const parsed = new Url(url);
        const userID = options.user?.email;
        debug(`Creating context with URL: ${parsed.url} for user: ${userID}`);

        if (!userID) {
            throw new Error('User is required to create a context');
        }

        // If URL is relative (no workspace specified), default to universe workspace
        if (!parsed.workspaceID) {
            parsed.workspaceID = 'universe';
            debug(`Relative URL provided, defaulting to universe workspace: ${parsed.workspaceID}`);
        }

        // Check if the workspace exists for the user
        if (!this.#workspaceManager.hasWorkspace(userID, parsed.workspaceID)) {
            throw new Error(`Workspace not found: ${parsed.workspaceID}`);
        }

        const workspace = await this.#workspaceManager.openWorkspace(userID, parsed.workspaceID);
        debug(`Opened workspace: ${workspace.name}`);

        // Create the context with a specific ID if provided
        const contextOptions = { ...options, workspace: workspace, workspaceManager: this.#workspaceManager };
        const context = new Context(url, contextOptions);

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
     * @param {Object} options - Options
     * @param {boolean} options.autoCreate - Whether to auto-create the context if it doesn't exist
     * @param {string} options.url - URL to use when auto-creating (defaults to '/')
     * @param {Object} options.user - User object to use when auto-creating
     * @returns {Context} - Context instance
     */
    getContext(id, options = {}) {
        debug(`Getting context with id "${id}", options: ${JSON.stringify(options)}`);
        const context = this.#activeContexts.get(id);

        if (!context) {
            // If auto-create is enabled and we have a user, create the context
            if (options.autoCreate) {
                debug(`Context with id "${id}" not found, auto-creating`);

                // Use the provided options for creation, but ensure the ID is set
                const createOptions = {
                    ...options,
                    id: id
                };

                // Create the context with the provided URL or default to '/'
                return this.createContext(options.url || '/', createOptions);
            }

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
