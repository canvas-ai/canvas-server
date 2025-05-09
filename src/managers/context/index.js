'use strict';

// Utils
import Url from './lib/Url.js';
import EventEmitter from 'eventemitter2';

// Logging
import createDebug from 'debug';
const debug = createDebug('context-manager');

// Includes
import Context from './lib/Context.js';

/**
 * Context Manager
 */

class ContextManager extends EventEmitter {

    #indexStore;             // Persistent index of all contexts
    #contexts = new Map();   // In-memory cache of loaded contexts
    #workspaceManager;       // Reference to workspace manager
    #userManager;            // Reference to user manager
    #nextContextIdByUser = new Map(); // User ID to next context ID mapping
    #initialized = false;    // Manager initialized flag

    /**
     * Create a new ContextManager
     * @param {Object} options - Manager options
     * @param {Object} options.indexStore - Index store for context data
     * @param {Object} options.workspaceManager - Workspace manager instance
     * @param {Object} options.userManager - User manager instance
     */
    constructor(options = {}) {
        super(options.eventEmitterOptions || {});

        if (!options.indexStore) {
            throw new Error('Index store is required for ContextManager');
        }
        if (!options.workspaceManager) {
            throw new Error('WorkspaceManager is required for ContextManager');
        }
        if (!options.userManager) {
            throw new Error('UserManager is required for ContextManager');
        }

        this.#indexStore = options.indexStore;
        this.#workspaceManager = options.workspaceManager;
        this.#userManager = options.userManager;

        debug('Context manager created');
    }

    /**
     * Initialize manager
     */
    async initialize() {
        if (this.#initialized) { return this; }

        debug('Initializing context manager: loading stored context IDs...');
        await this.#loadStoredContexts();
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
            const user = await this.#userManager.getUser(userId);
            const userEmail = user.email;

            let contextId = options.id || options?.name;
            if (contextId === undefined || contextId === null || contextId === '') {
                contextId = 'default'; // this.#getNextContextId(userId);
            }
            const contextKey = `${userEmail}/${contextId}`;

            if (this.#contexts.has(contextKey) || this.#indexStore.has(contextKey)) {
                debug(`Context with key ${contextKey} already exists, returning existing or loading from store.`);
                if (this.#contexts.has(contextKey)) return this.#contexts.get(contextKey);
                return this.getContext(userId, contextId.toString());
            }

            debug(`Creating context with key ${contextKey} and URL: ${url} for user: ${userId}`);

            const parsed = new Url(url);
            if (!parsed.workspaceID) {
                parsed.workspaceID = 'universe';
                debug(`Relative URL provided, defaulting to universe workspace: ${parsed.workspaceID} for user ${userId}`);
            }

            const workspace = await this.#workspaceManager.getWorkspace(userEmail, parsed.workspaceID, userId);
            if (!workspace) {
                throw new Error(`Workspace not found or not accessible: ${parsed.workspaceID} for user ${userId}`);
            }

            const contextOptions = {
                ...options,
                id: contextId.toString(),
                user: user,
                workspace: workspace,
                workspaceManager: this.#workspaceManager,
            };

            const context = new Context(parsed.url, contextOptions);
            await context.initialize();

            this.#saveContext(userEmail, context);
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
        if (!userId) throw new Error('User ID is required');

        try {
            const user = await this.#userManager.getUser(userId);
            const userEmail = user.email;

            if (contextId === undefined || contextId === null) contextId = 'default';
            const contextKey = `${userEmail}/${contextId}`;

            // Check in-memory cache first
            if (this.#contexts.has(contextKey)) {
                debug(`Returning cached Context instance for ${contextKey}`);
                return this.#contexts.get(contextKey);
            }

            // Try to load from store
            const storedContextData = this.#indexStore.get(contextKey);
            if (storedContextData) {
                debug(`Context with key "${contextKey}" found in store, loading into memory.`);

                const workspace = await this.#workspaceManager.getWorkspace(
                    userEmail, storedContextData.workspaceId, userId
                );

                if (!workspace) {
                    throw new Error(`Failed to load workspace ${storedContextData.workspaceId} for context ${contextKey}`);
                }

                const contextOptions = {
                    id: storedContextData.id,
                    name: storedContextData.name,
                    user: user,
                    workspace: workspace,
                    workspaceManager: this.#workspaceManager,
                    created: storedContextData.created,
                    updated: storedContextData.updated,
                    baseUrl: storedContextData.baseUrl,
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
            const user = await this.#userManager.getUser(userId);
            const userEmail = user.email;
            const prefix = `${userEmail}/`;
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

            debug(`Listed ${userContextsArray.length} contexts for user ${userId} (email: ${userEmail})`);
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
        if (contextId === undefined || contextId === null) throw new Error('Context ID is required');

        try {
            const user = await this.#userManager.getUser(userId);
            const userEmail = user.email;
            const contextKey = `${userEmail}/${contextId}`;

            const context = this.#contexts.get(contextKey);
            let removedFromStore = false;

            // Remove from index store if exists
            if (this.#indexStore.has(contextKey)) {
                this.#indexStore.delete(contextKey);
                removedFromStore = true;
            }

            // If not found anywhere, return false
            if (!context && !removedFromStore) {
                return false;
            }

            // Cleanup context instance if it exists
            if (context) {
                await context.destroy();
                this.#contexts.delete(contextKey);
            }

            this.emit('context:removed', { userId, contextId: contextId.toString(), contextKey });
            debug(`Context ${contextKey} removed.`);
            return true;
        } catch (error) {
            debug(`Error removing context for user ${userId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Remove all contexts for a user
     * @param {string} userId - User ID
     * @returns {Promise<number>} Number of contexts removed
     */
    async removeAllUserContexts(userId) {
        if (!this.#initialized) {
            throw new Error('ContextManager not initialized');
        }
        if (!userId) throw new Error('User ID is required');

        try {
            const user = await this.#userManager.getUser(userId);
            const userEmail = user.email;
            const prefix = `${userEmail}/`;
            let removedCount = 0;

            // Collect all context keys to remove
            const contextKeysToRemove = new Set();

            // From in-memory cache
            for (const key of this.#contexts.keys()) {
                if (key.startsWith(prefix)) {
                    contextKeysToRemove.add(key);
                }
            }

            // From store
            const allContextsFromStore = this.#indexStore.store;
            for (const keyInStore in allContextsFromStore) {
                if (keyInStore.startsWith(prefix)) {
                    contextKeysToRemove.add(keyInStore);
                }
            }

            // Remove each context
            for (const contextKey of contextKeysToRemove) {
                const parts = contextKey.split('/');
                const cId = parts.slice(1).join('/');
                if (await this.removeContext(userId, cId)) {
                    removedCount++;
                }
            }

            // Reset next context ID counter for user
            this.#nextContextIdByUser.delete(userId);

            debug(`Removed ${removedCount} contexts for user ${userId}`);
            return removedCount;
        } catch (error) {
            debug(`Error removing all contexts for user ${userId}: ${error.message}`);
            return 0;
        }
    }

    /**
     * Private methods
     */

    /**
     * Get the next numeric context ID for a user
     * @param {string} userId - User ID
     * @returns {number} Next context ID
     * @private
     */
    #getNextContextId(userId) {
        if (!this.#nextContextIdByUser.has(userId)) {
            this.#nextContextIdByUser.set(userId, 0);
        }

        const nextId = this.#nextContextIdByUser.get(userId);
        this.#nextContextIdByUser.set(userId, nextId + 1);

        return nextId;
    }

    /**
     * Load previously stored contexts from the index
     * @private
     */
    async #loadStoredContexts() {
        try {
            const allContextsFromStore = this.#indexStore.store;
            let usersProcessedForNextId = new Set();

            for (const contextKey in allContextsFromStore) {
                const metadata = allContextsFromStore[contextKey];
                const storedUserId = metadata.userId;

                if (storedUserId && !usersProcessedForNextId.has(storedUserId)) {
                    let highestNumericId = -1;

                    for (const [key, meta] of Object.entries(allContextsFromStore)) {
                        if (meta.userId === storedUserId) {
                            const parts = key.substring(key.indexOf('/') + 1);
                            const numericId = parseInt(parts, 10);
                            if (!isNaN(numericId) && numericId > highestNumericId) {
                                highestNumericId = numericId;
                            }
                        }
                    }

                    if (highestNumericId >= 0) {
                        this.#nextContextIdByUser.set(storedUserId, highestNumericId + 1);
                    }

                    usersProcessedForNextId.add(storedUserId);
                }
            }

            debug(`Processed stored context metadata for ${Object.keys(allContextsFromStore).length} entries, primed nextId counters.`);
        } catch (error) {
            debug(`Error loading stored contexts: ${error.message}`);
        }
    }

    /**
     * Save a context to memory and persistent store
     * @param {string} userEmail - User email
     * @param {Context} context - Context instance
     * @private
     */
    #saveContext(userEmail, context) {
        if (!userEmail || !context || !context.id) return;

        const contextKey = `${userEmail}/${context.id}`;

        // Save to in-memory cache
        this.#contexts.set(contextKey, context);

        // Save to persistent store
        const contextData = {
            id: context.id,
            url: context.url,
            baseUrl: context.baseUrl,
            workspaceId: context.workspace,
            userId: context.user.id,
            created: context.created,
            updated: new Date().toISOString(),
            name: context.name
        };

        this.#indexStore.set(contextKey, contextData);
        debug(`Saved context with key ${contextKey}`);
    }
}

export default ContextManager;
