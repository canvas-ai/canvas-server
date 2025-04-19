'use strict';

// Base Manager
import Manager from '../base/Manager.js';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('manager:context');

// Includes
import Context from './lib/Context.js';
import Url from './lib/Url.js';

/**
 * Context Manager
 * Manages active contexts that define user views of workspaces
 */

class ContextManager extends Manager {

    #user;
    #workspaceManager;
    #activeContexts = new Map();

    /**
     * Create a new ContextManager
     * @param {Object} options - Manager options
     * @param {Object} options.jim - JSON Index Manager instance
     * @param {Object} options.user - User instance
     * @param {Object} [options.workspaceManager] - Workspace manager reference
     */
    constructor(options = {}) {
        super({
            jim: options.jim,
            indexName: 'contexts',
            eventEmitterOptions: options.eventEmitterOptions
        });

        if (!options.user) {
            throw new Error('User instance is required');
        }

        this.#user = options.user;
        this.#workspaceManager = options.workspaceManager || null;

        debug('Context manager initialized');
    }

    /**
     * Getters
     */
    get user() { return this.#user; }
    get workspaceManager() { return this.#workspaceManager; }

    /**
     * Set the workspace manager reference
     * This allows for lazy dependency injection
     * @param {Object} workspaceManager - Workspace manager instance
     */
    setWorkspaceManager(workspaceManager) {
        if (!workspaceManager) {
            throw new Error('Workspace manager is required');
        }
        this.#workspaceManager = workspaceManager;
        debug('Workspace manager reference set');
    }

    /**
     * Initialize manager
     * @override
     */
    async initialize() {
        if (this.initialized) {
            return true;
        }

        debug('Initializing context manager');

        // Load active contexts for the user
        await this.#loadActiveContexts();

        return super.initialize();
    }

    /**
     * Context Manager API
     */

    /**
     * Create a new context
     * @param {string} url - Context URL
     * @param {Object} options - Context options
     * @returns {Promise<Context>} Created context
     */
    async createContext(url = '/', options = {}) {
        // Check if a specific context ID was provided and if it already exists
        if (options.id && this.#activeContexts.has(options.id)) {
            debug(`Context with ID ${options.id} already exists, returning existing context`);
            return this.#activeContexts.get(options.id);
        }

        // Ensure we have a workspace manager
        if (!this.#workspaceManager) {
            throw new Error('WorkspaceManager is required to create a context');
        }

        // Parse the URL
        const parsed = new Url(url);
        debug(`Creating context with URL: ${parsed.url} for user: ${this.#user.email}`);

        // If URL is relative (no workspace specified), default to universe workspace
        if (!parsed.workspaceID) {
            parsed.workspaceID = 'universe';
            debug(`Relative URL provided, defaulting to universe workspace: ${parsed.workspaceID}`);
        }

        // Check if the workspace exists for the user
        if (!this.#workspaceManager.hasWorkspace(this.#user.id, parsed.workspaceID)) {
            throw new Error(`Workspace not found: ${parsed.workspaceID}`);
        }

        // Open the workspace
        const workspace = await this.#workspaceManager.openWorkspace(this.#user.id, parsed.workspaceID);
        if (!workspace) {
            throw new Error(`Failed to open workspace: ${parsed.workspaceID}`);
        }
        debug(`Opened workspace: ${workspace.name}`);

        // Create the context with a specific ID if provided
        const contextOptions = {
            ...options,
            workspace: workspace,
            workspaceManager: this.#workspaceManager,
            user: this.#user
        };

        const context = new Context(url, contextOptions);

        // Initialize the context (handle any pending URL switch)
        await context.initialize();

        // Add to contexts
        this.#activeContexts.set(context.id, context);

        // Store context reference in the index
        this.#storeContextReference(context);

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
     * @returns {Promise<Context>} Context instance
     */
    async getContext(id, options = {}) {
        debug(`Getting context with id "${id}", options: ${JSON.stringify(options)}`);
        const context = this.#activeContexts.get(id);

        if (!context) {
            // If auto-create is enabled, create the context
            if (options.autoCreate) {
                debug(`Context with id "${id}" not found, auto-creating`);

                // Use the provided options for creation, but ensure the ID is set
                const createOptions = {
                    ...options,
                    id: id,
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
     * @returns {Array<Object>} Array of context metadata
     */
    listContexts() {
        debug(`Listing ${this.#activeContexts.size} active contexts`);
        const contexts = [];
        Array.from(this.#activeContexts.values()).forEach((context) => {
            contexts.push({
                id: context.id,
                url: context.url,
                workspace: context.workspace,
                created: context.created,
                updated: context.updated,
            });
        });

        return contexts;
    }

    /**
     * Remove a context
     * @param {string} id - Context ID
     * @returns {Promise<boolean>} True if context was removed
     */
    async removeContext(id) {
        const context = this.#activeContexts.get(id);

        if (!context) {
            return false;
        }

        await context.destroy();
        this.#activeContexts.delete(id);

        // Remove the context reference from the index
        this.#removeContextReference(id);

        this.emit('context:removed', id);
        return true;
    }

    /**
     * Private methods
     */

    /**
     * Load active contexts for the user
     * @private
     */
    async #loadActiveContexts() {
        try {
            // Get user-specific contexts from the index
            const userContexts = this.getConfig(`users.${this.#user.id}.contexts`, {});

            debug(`Found ${Object.keys(userContexts).length} contexts for user ${this.#user.id}`);

            // We don't actually load the contexts here, they will be loaded on-demand
            // This is just to initialize any needed structures

        } catch (error) {
            debug(`Error loading active contexts: ${error.message}`);
        }
    }

    /**
     * Store a context reference in the index
     * @param {Context} context - Context instance
     * @private
     */
    #storeContextReference(context) {
        if (!context || !context.id) return;

        // Get existing contexts for the user
        const userContexts = this.getConfig(`users.${this.#user.id}.contexts`, {});

        // Add/update the context reference
        userContexts[context.id] = {
            id: context.id,
            url: context.url,
            workspace: context.workspace,
            created: context.created,
            updated: context.updated
        };

        // Update the index
        this.setConfig(`users.${this.#user.id}.contexts`, userContexts);
        debug(`Stored context reference for ${context.id}`);
    }

    /**
     * Remove a context reference from the index
     * @param {string} contextId - Context ID
     * @private
     */
    #removeContextReference(contextId) {
        if (!contextId) return;

        // Get existing contexts for the user
        const userContexts = this.getConfig(`users.${this.#user.id}.contexts`, {});

        // Remove the context reference
        if (userContexts[contextId]) {
            delete userContexts[contextId];

            // Update the index
            this.setConfig(`users.${this.#user.id}.contexts`, userContexts);
            debug(`Removed context reference for ${contextId}`);
        }
    }
}

export default ContextManager;
