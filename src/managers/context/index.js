'use strict';

// Utils
import Url from './lib/Url.js';
import EventEmitter from 'eventemitter2';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('context-manager');

// Includes
import Context from './lib/Context.js';

/**
 * Context Manager
 */

class ContextManager extends EventEmitter {

    #indexStore;             // Persistent index of all contexts
    #workspaceManager;       // Reference to workspace manager

    // Runtime
    #contexts = new Map();   // In-memory cache of loaded contexts
    #initialized = false;    // Manager initialized flag

    /**
     * Create a new ContextManager
     * @param {Object} options - Manager options
     * @param {Object} options.indexStore - Index store for context data
     * @param {Object} options.workspaceManager - Workspace manager instance
     */
    constructor(options = {}) {
        super(options.eventEmitterOptions || {});

        if (!options.indexStore) {
            throw new Error('Index store is required for ContextManager');
        }
        if (!options.workspaceManager) {
            throw new Error('WorkspaceManager is required for ContextManager');
        }

        this.#indexStore = options.indexStore;
        this.#workspaceManager = options.workspaceManager;

        debug('Context manager created');
    }

    /**
     * Initialize manager
     */
    async initialize() {
        if (this.#initialized) { return this; }
        debug('Initializing context manager: loading stored context IDs...');

        debug(`ContextManager initialized with ${this.#indexStore.size} context(s) in index`);
        this.#initialized = true;
        return this;
    }

    /**
     * Getters
     */

    get contexts() { return Array.from(this.#contexts.values()); }

    /**
     * Context Management API
     */

    /**
     * Create a new context for a user
     * @param {string} userId - User ID
     * @param {string} url - Context URL
     * @param {Object} options - Context options
     * @param {string|number} [options.id] - Custom context ID
     * @returns {Promise<Context>} Created context
     */
    async createContext(userId, url = '/', options = {}) {
        if (!this.#initialized) {
            throw new Error('ContextManager not initialized');
        }
        if (!userId) {
            throw new Error('User ID is required to create a context');
        }

        try {
            // We need to streamline this part, its context ID whatever the user provides
            let contextId = options?.id || options?.name;
            if (contextId === undefined || contextId === null || contextId === '') {
                contextId = 'default';
            }
            const contextKey = `${userId}/${contextId}`;

            if (this.#contexts.has(contextKey) || this.#indexStore.has(contextKey)) {
                throw new Error(`Context with key ${contextKey} already exists`);
            }

            debug(`Creating context with key ${contextKey} and URL: ${url} for user: ${userId}`);
            const parsed = new Url(url);
            if (!parsed.workspaceID) {
                parsed.workspaceID = 'universe';
                debug(`Relative URL provided, defaulting to universe workspace: ${parsed.workspaceID} for user ${userId}`);
            }

            const workspace = await this.#workspaceManager.getWorkspace(userId, parsed.workspaceID, userId);
            if (!workspace) {
                throw new Error(`Workspace not found or not accessible: ${parsed.workspaceID} for user ${userId}`);
            }

            const contextOptions = {
                ...options,
                id: contextId.toString(),
                userId: userId,
                workspace: workspace,
                workspaceId: workspace.id,
                workspaceManager: this.#workspaceManager,
                contextManager: this,
            };

            const context = new Context(parsed.url, contextOptions);
            await context.initialize();

            this.saveContext(userId, context);
            this.emit('context:created', { userId, contextId: context.id, contextKey });

            return context;
        } catch (error) {
            debug(`Error creating context: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get a context by ID for a user
     * @param {string} userId - User ID
     * @param {string|number} contextId - Context ID (or 'default' for the default context)
     * @param {Object} options - Options
     * @param {boolean} [options.autoCreate=false] - Whether to auto-create the context if it doesn't exist
     * @param {string} [options.url='/'] - URL to use when auto-creating
     * @returns {Promise<Context>} Context instance
     */
    async getContext(userId, contextId, options = {}) {
        if (!this.#initialized) {
            throw new Error('ContextManager not initialized');
        }
        if (!userId) {
            throw new Error('User ID is required');
        }

        if (contextId === undefined || contextId === null) {
            contextId = 'default';
        }

        const contextKey = `${userId}/${contextId}`;
        try {
            // Check in-memory cache first
            if (this.#contexts.has(contextKey)) {
                debug(`Returning cached Context instance for ${contextKey}`);
                return this.#contexts.get(contextKey);
            }

            // Try to load from store
            const storedContextData = this.#indexStore.get(contextKey);
            if (storedContextData) {
                debug(`Context with key "${contextKey}" found in store, loading into memory.`);

                // Load workspace
                const workspace = await this.#workspaceManager.getWorkspace(
                    userId, storedContextData.workspaceId, userId
                );

                if (!workspace) {
                    throw new Error(`Failed to load workspace ${storedContextData.workspaceId} for context ${contextKey}`);
                }

                const contextOptions = {
                    ...storedContextData,
                    userId: userId,
                    workspace: workspace,
                    workspaceManager: this.#workspaceManager,
                    contextManager: this,
                };

                const loadedContext = new Context(storedContextData.url, contextOptions);
                await loadedContext.initialize();

                this.#contexts.set(contextKey, loadedContext);
                return loadedContext;
            }

            // Auto-create if enabled
            if (options.autoCreate) {
                debug(`Context with key "${contextKey}" not found, auto-creating`);
                const createOptions = { ...options, id: contextId.toString() };
                return this.createContext(userId, options.url || '/', createOptions);
            }

            throw new Error(`Context with key "${contextKey}" not found for user ${userId}`);
        } catch (error) {
            debug(`Error getting context: ${error.message}`);
            throw error;
        }
    }

    hasContext(userId, contextId) {
        if (!this.#initialized) {
            throw new Error('ContextManager not initialized');
        }

        const contextKey = `${userId}/${contextId}`;
        return this.#contexts.has(contextKey) || this.#indexStore.has(contextKey); 
    }

    /**
     * List all contexts for a user
     * @param {string} userId - User ID
     * @returns {Promise<Array<Object>>} Array of context metadata
     */
    async listUserContexts(userId) {
        if (!this.#initialized) {
            throw new Error('ContextManager not initialized');
        }
        if (!userId) throw new Error('User ID is required');

        try {
            const prefix = `${userId}/`;
            const userContextsArray = [];
            const processedKeys = new Set();

            // Get contexts from in-memory cache
            for (const [key, contextInstance] of this.#contexts) {
                if (key.startsWith(prefix)) {
                    userContextsArray.push(contextInstance.toJSON());
                    processedKeys.add(key);
                }
            }

            // Get additional contexts from store
            const allContextsInStore = this.#indexStore.store;
            for (const key in allContextsInStore) {
                if (key.startsWith(prefix) && !processedKeys.has(key)) {
                    userContextsArray.push(allContextsInStore[key]);
                }
            }

            debug(`Listed ${userContextsArray.length} contexts for user ${userId}`);
            return userContextsArray;
        } catch (error) {
            debug(`Error listing contexts for user ${userId}: ${error.message}`);
            return [];
        }
    }

    /**
     * Remove a context for a user
     * @param {string} userId - User ID
     * @param {string|number} contextId - Context ID
     * @returns {Promise<boolean>} True if context was removed
     */
    async removeContext(userId, contextId) {
        if (!this.#initialized) {
            throw new Error('ContextManager not initialized');
        }

        if (!userId) throw new Error('User ID is required');
        if (!contextId || contextId === undefined || contextId === null) {
            throw new Error('Context ID is required');
        }

        if (contextId === 'default') {
            throw new Error('Default context cannot be removed');
        }

        try {
            const contextKey = `${userId}/${contextId}`;

            if (this.#contexts.has(contextKey)) {
                const context = this.#contexts.get(contextKey);
                await context.destroy();
                this.#contexts.delete(contextKey);
            }

            // Remove from index store if exists (which should be the case)
            if (this.#indexStore.has(contextKey)) {
                this.#indexStore.delete(contextKey);
            }

            this.emit('context:deleted', {
                contextKey: contextKey,
                userId: userId,
                contextId: contextId.toString()
            });
            debug(`Context ${contextKey} removed.`);
            return true;
        } catch (error) {
            debug(`Error removing context for user ${userId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Save a context to memory and persistent store
     * @param {string} userId
     * @param {Context} context - Context instance
     * @private
     */
    saveContext(userId, context) {
        if (!userId || !context || !context.id) {
            throw new Error(`Invalid context data: ${JSON.stringify(context)}`);
        };

        const contextKey = `${userId}/${context.id}`;
        const contextData = context.toJSON();

        // Save to in-memory cache
        this.#contexts.set(contextKey, context);
        this.#indexStore.set(contextKey, contextData);
        debug(`Saved context with key ${contextKey}`);
    }

}

export default ContextManager;
