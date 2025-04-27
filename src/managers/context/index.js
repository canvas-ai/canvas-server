'use strict';

// Utils
import { v4 as uuidv4 } from 'uuid';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('context-manager');

// Base Manager
import Manager from '../base/Manager.js';

// URL parser
import Url from './lib/Url.js';

// Context
import Context from './lib/Context.js';

/**
 * ===========================
 * Context Manager
 * ===========================
 *
 * Global manager for managing user contexts across the system.
 * Stores contexts prefixed by user ID.
 */
class ContextManager extends Manager {

    #workspaceManager;
    #userManager;
    #contextsByUser = new Map(); // Map<userId, Map<contextId, Context>>
    #nextContextIdByUser = new Map(); // Map<userId, number> - tracks next numeric context ID per user

    /**
     * Create a new ContextManager
     * @param {Object} options - Manager options
     * @param {Object} options.jim - JSON Index Manager instance
     * @param {Object} [options.workspaceManager] - Workspace manager reference
     * @param {Object} [options.userManager] - User manager reference
     */
    constructor(options = {}) {
        super({
            jim: options.jim,
            indexName: 'contexts',
            eventEmitterOptions: options.eventEmitterOptions,
        });

        if (!options.workspaceManager) {
            throw new Error('WorkspaceManager is required to create a ContextManager');
        }

        if (!options.userManager) {
            throw new Error('UserManager is required to create a ContextManager');
        }

        this.#workspaceManager = options.workspaceManager;
        this.#userManager = options.userManager;

        debug('Context manager initialized');
    }

    /**
     * Getters/Setters
     */

    get workspaceManager() { return this.#workspaceManager; }
    get userManager() { return this.#userManager; }

    /**
     * Manager Lifecycle
     */

    /**
     * Initialize manager
     * @override
     */
    async initialize() {
        if (this.initialized) {
            return true;
        }

        debug('Initializing context manager');

        // Initialize the contexts index if it doesn't exist
        if (!this.getConfig('contexts')) {
            this.setConfig('contexts', {});
        }

        // Load previously saved context metadata for all users
        await this.#loadStoredContexts();
        return super.initialize();
    }

    /**
     * Context Management API
     */

    /**
     * Create a new context for a user
     * @param {string} userId - User ID
     * @param {string} url - Context URL
     * @param {Object} options - Context options
     * @param {string|number} [options.id] - Custom context ID (if not provided, an auto-incrementing numeric ID will be used)
     * @returns {Promise<Context>} Created context
     */
    async createContext(userId, url = '/', options = {}) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Ensure we have a workspace manager
        if (!this.#workspaceManager) {
            throw new Error('WorkspaceManager is required to create a context');
        }

        let user;
        try {
            // Get user from user manager
            if (this.#userManager) {
                user = await this.#userManager.getUser(userId);
            } else {
                throw new Error('UserManager is required but not set');
            }
        } catch (error) {
            throw new Error(`Failed to get user ${userId}: ${error.message}`);
        }

        // Determine the context ID
        let contextId = options.id || options?.name || 'default';

        // Check if the context already exists for this user
        const userContexts = this.#getUserContexts(userId);
        if (userContexts.has(contextId.toString())) {
            debug(`Context with ID ${contextId} already exists for user ${userId}, returning existing context`);
            return userContexts.get(contextId.toString());
        }

        debug(`Creating context with ID ${contextId} and URL: ${url} for user: ${userId}`);

        // Parse the URL
        const parsed = new Url(url);

        // If URL is relative (no workspace specified), default to universe workspace
        if (!parsed.workspaceID) {
            parsed.workspaceID = 'universe';
            debug(`Relative URL provided, defaulting to universe workspace: ${parsed.workspaceID}`);
        } else {
            debug(`Using workspace ID: ${parsed.workspaceID} from URL: ${url}`);
        }

        // Check if the workspace exists and is initialized
        if (!this.#workspaceManager.hasWorkspace(userId, parsed.workspaceID)) {
            throw new Error(`Workspace not found: ${parsed.workspaceID}`);
        }

        const workspace = await this.#workspaceManager.getWorkspace(userId, parsed.workspaceID);

        // Create the context with the determined ID
        const contextOptions = {
            ...options,
            id: contextId,
            user: user,
            workspace: workspace,
            workspaceManager: this.#workspaceManager,
        };

        const context = new Context(url, contextOptions);

        // Initialize the context (handle any pending URL switch)
        await context.initialize();

        // Add to contexts map for this user
        userContexts.set(contextId.toString(), context);

        // Store context reference globally
        this.#storeContextReference(userId, context);

        // Emit the created event
        this.emit('context:created', { userId, contextId });

        // Return the context
        return context;
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
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Default to the 'default' context if none specified
        if (contextId === undefined || contextId === null) {
            contextId = 'default';
        }

        const userContexts = this.#getUserContexts(userId);
        const context = userContexts.get(contextId.toString());

        debug(`Getting context with id "${contextId}" for user ${userId}, found: ${!!context}`);

        if (!context) {
            // If auto-create is enabled, create the context
            if (options.autoCreate) {
                debug(`Context with id "${contextId}" not found for user ${userId}, auto-creating`);

                // Use the provided options for creation, but ensure the ID is set
                const createOptions = {
                    ...options,
                    id: contextId,
                };

                // Create the context with the provided URL or default to '/'
                return this.createContext(userId, options.url || '/', createOptions);
            }

            throw new Error(`Context with id "${contextId}" not found for user ${userId}`);
        }

        return context;
    }

    /**
     * Get or create the default context for a user
     * @param {string} userId - User ID
     * @param {string} [url='/'] - URL for the context (if created)
     * @returns {Promise<Context>} Default context
     */
    async getDefaultContext(userId, url = '/') {
        return this.getContext(userId, 'default', { autoCreate: true, url, default: true });
    }

    /**
     * List all contexts for a user
     * @param {string} userId - User ID
     * @returns {Array<Object>} Array of context metadata
     */
    listContexts(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const userContexts = this.#getUserContexts(userId);
        const contexts = [];

        userContexts.forEach((context, id) => {
            contexts.push({
                id: context.id,
                url: context.url,
                workspace: context.workspace ? context.workspace.id : null,
                created: context.created,
                updated: context.updated,
            });
        });

        debug(`Listed ${contexts.length} contexts for user ${userId}`);
        return contexts;
    }

    /**
     * List all active contexts across all users (admin function)
     * @returns {Object} Map of user ID to array of context metadata
     */
    listAllContexts() {
        const allContexts = {};

        this.#contextsByUser.forEach((userContexts, userId) => {
            allContexts[userId] = this.listContexts(userId);
        });

        return allContexts;
    }

    /**
     * Remove a context for a user
     * @param {string} userId - User ID
     * @param {string|number} contextId - Context ID
     * @returns {Promise<boolean>} True if context was removed
     */
    async removeContext(userId, contextId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        if (contextId === undefined || contextId === null) {
            throw new Error('Context ID is required');
        }

        const userContexts = this.#getUserContexts(userId);
        const context = userContexts.get(contextId.toString());

        if (!context) {
            return false;
        }

        // Destroy the context
        await context.destroy();

        // Remove from memory
        userContexts.delete(contextId.toString());

        // Remove from storage
        this.#removeContextReference(userId, contextId);

        this.emit('context:removed', { userId, contextId });
        return true;
    }

    /**
     * Remove all contexts for a user
     * @param {string} userId - User ID
     * @returns {Promise<number>} Number of contexts removed
     */
    async removeAllUserContexts(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const userContexts = this.#getUserContexts(userId);
        const contextIds = Array.from(userContexts.keys());
        let removedCount = 0;

        for (const contextId of contextIds) {
            if (await this.removeContext(userId, contextId)) {
                removedCount++;
            }
        }

        // Clear the next context ID counter for this user
        this.#nextContextIdByUser.delete(userId);

        debug(`Removed ${removedCount} contexts for user ${userId}`);
        return removedCount;
    }

    /**
     * ===========================
     * Private Methods
     * ===========================
     */

    /**
     * Get the contexts map for a user, creating it if it doesn't exist
     * @param {string} userId - User ID
     * @returns {Map<string, Context>} Map of context ID to Context
     * @private
     */
    #getUserContexts(userId) {
        if (!this.#contextsByUser.has(userId)) {
            this.#contextsByUser.set(userId, new Map());
        }
        return this.#contextsByUser.get(userId);
    }

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
            const contextsByUser = this.getConfig('contexts', {});

            // Initialize counters for next context ID
            Object.entries(contextsByUser).forEach(([userId, userContexts]) => {
                // Find highest numeric context ID to set the next ID counter
                let highestNumericId = -1;

                Object.keys(userContexts).forEach(contextId => {
                    const numericId = parseInt(contextId, 10);
                    if (!isNaN(numericId) && numericId > highestNumericId) {
                        highestNumericId = numericId;
                    }
                });

                // Set next ID to one higher than the highest found
                if (highestNumericId >= 0) {
                    this.#nextContextIdByUser.set(userId, highestNumericId + 1);
                }
            });

            debug(`Loaded context metadata for ${Object.keys(contextsByUser).length} users`);
        } catch (error) {
            debug(`Error loading stored contexts: ${error.message}`);
        }
    }

    /**
     * Store a context reference in the index
     * @param {string} userId - User ID
     * @param {Context} context - Context instance
     * @private
     */
    #storeContextReference(userId, context) {
        if (!userId || !context || !context.id) return;

        // Get all contexts
        const contexts = this.getConfig('contexts', {});

        // Ensure user section exists
        if (!contexts[userId]) {
            contexts[userId] = {};
        }

        // Add/update the context reference
        contexts[userId][context.id] = {
            id: context.id,
            url: context.url,
            workspace: context.workspace ? context.workspace.id : null,
            created: context.created,
            updated: new Date().toISOString(),
        };

        // Update the index
        this.setConfig('contexts', contexts);
        debug(`Stored context reference for user ${userId}, context ${context.id}`);
    }

    /**
     * Remove a context reference from the index
     * @param {string} userId - User ID
     * @param {string|number} contextId - Context ID
     * @private
     */
    #removeContextReference(userId, contextId) {
        if (!userId || contextId === undefined || contextId === null) return;

        // Get all contexts
        const contexts = this.getConfig('contexts', {});

        // Check if user section exists
        if (!contexts[userId]) {
            return;
        }

        // Remove the context reference
        if (contexts[userId][contextId]) {
            delete contexts[userId][contextId];

            // Clean up empty user section
            if (Object.keys(contexts[userId]).length === 0) {
                delete contexts[userId];
            }

            // Update the index
            this.setConfig('contexts', contexts);
            debug(`Removed context reference for user ${userId}, context ${contextId}`);
        }
    }
}

export default ContextManager;
