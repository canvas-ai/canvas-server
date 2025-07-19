'use strict';

// Utils
import Url from './lib/Url.js';
import EventEmitter from 'eventemitter2';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('context-manager');

// Includes
import Context from './lib/Context.js';

// Constants
const DEFAULT_WORKSPACE_ID = 'universe';

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
        // Ensure wildcard events are enabled so WebSocket bridge can listen to "**"
        // Provide default delimiter "." to match our dot-notation events
        super({
            wildcard: true,
            delimiter: '.',
            newListener: false,
            maxListeners: 100,
            ...(options.eventEmitterOptions || {})
        });

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

        // Log the number of items directly from the store if possible, or after loading.
        // For a simple Map-like store, size might be available.
        // If indexStore is more complex, this log might need adjustment.
        const initialContextCount = typeof this.#indexStore.size === 'function' ? this.#indexStore.size() : (this.#indexStore.store ? Object.keys(this.#indexStore.store).length : 'N/A');
        debug(`ContextManager initialized with ${initialContextCount} context(s) in index`);
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

        if (!options.id) {
            throw new Error('Context ID is required to create a context');
        }

        try {
            let contextId = options.id;
            contextId = this.#sanitizeContextId(contextId);

            // Lets get the context key
            const contextKey = this.#constructContextKey(userId, contextId);

            if (this.#contexts.has(contextKey) || this.#indexStore.has(contextKey)) {
                throw new Error(`Context with key ${contextKey} already exists`);
            }

            debug(`Creating context with key ${contextKey} and URL: ${url} for user: ${userId}`);
            const parsed = new Url(url);
            if (!parsed.workspaceID) {
                parsed.workspaceID = DEFAULT_WORKSPACE_ID;
                debug(`Relative URL provided, using default workspace: ${parsed.workspaceID} for user ${userId}`);
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

            // Emit the context.created event with a consistent payload structure including id
            const contextData = context.toJSON();
            this.emit('context.created', { id: context.id, ...contextData });
            debug(`Context created with ID ${context.id} and emitted context.created event`);

            return context;
        } catch (error) {
            debug(`Error creating context: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get a context by ID for a user
     * @param {string} userId - User ID of the person trying to access the context
     * @param {string|number} contextIdOrFullIdentifier - Context ID (e.g., 'default', 'myContext') or a full identifier for a shared context (e.g., 'owner@email.com/contextName').
     * @param {Object} options - Options
     * @param {boolean} [options.autoCreate=false] - Whether to auto-create the context if it doesn't exist. This only applies if the context is for the accessing userId.
     * @param {string} [options.url='/'] - URL to use when auto-creating
     * @returns {Promise<Context>} Context instance
     */
    async getContext(userId, contextIdOrFullIdentifier, options = {}) {
        if (!this.#initialized) {
            throw new Error('ContextManager not initialized');
        }
        if (!userId) {
            throw new Error('User ID (accessing user) is required');
        }

        const { ownerUserId, contextId } = this.#parseContextIdentifier(contextIdOrFullIdentifier, userId);

        // Auto-creation should only happen if the accessing user is the owner.
        // And if the contextId is not a shared context identifier.
        const canAutoCreate = options.autoCreate
            && ownerUserId === userId &&
            !contextIdOrFullIdentifier.toString().includes('/');

        const contextKey = this.#constructContextKey(ownerUserId, contextId);
        try {
            let contextInstance = null;
            // Check in-memory cache first
            if (this.#contexts.has(contextKey)) {
                debug(`Returning cached Context instance for ${contextKey}`);
                contextInstance = this.#contexts.get(contextKey);
            } else {
                // Try to load from store
                const storedContextData = this.#indexStore.get(contextKey);
                if (storedContextData) {
                    debug(`Context with key "${contextKey}" found in store, loading into memory.`);
                    if (storedContextData.userId !== ownerUserId) {
                        // This should ideally not happen if contextKey is correct, but good for sanity.
                        throw new Error(`Mismatch in owner user ID. Expected ${ownerUserId}, found ${storedContextData.userId} in stored data for key ${contextKey}`);
                    }

                    const workspace = await this.#workspaceManager.getWorkspace(
                        ownerUserId, // Use ownerUserId to load the workspace
                        storedContextData.workspaceId,
                        ownerUserId  // And ownerUserId for permission to access the workspace
                    );

                    if (!workspace) {
                        throw new Error(`Failed to load workspace ${storedContextData.workspaceId} for context ${contextKey}`);
                    }

                    const contextOptions = {
                        ...storedContextData,
                        // userId here refers to the owner of the context.
                        userId: ownerUserId,
                        workspace: workspace,
                        workspaceManager: this.#workspaceManager,
                        contextManager: this,
                    };

                    const loadedContext = new Context(storedContextData.url, contextOptions);
                    await loadedContext.initialize();

                    // Set up event forwarding by saving the context (this ensures events are forwarded)
                    // We need to temporarily add to cache first, then save to avoid duplicate cache entry
                    this.#contexts.set(contextKey, loadedContext);

                    // Set up event forwarding manually to avoid redundant cache/store operations
                    if (!loadedContext._eventsForwarded) {
                        debug(`📋 ContextManager: Setting up *wildcard* event forwarding for loaded context ${loadedContext.id}`);

                        const manager = this; // capture
                        const wildcardForwarder = function (payload = {}) {
                            const eventName = this.event;
                            const enriched = { ...payload, contextId: loadedContext.id };
                            manager.emit(eventName, enriched);
                            debug(`📋 ContextManager: ➡️  forwarded ${eventName} for loaded context ${loadedContext.id}`);
                        };

                        loadedContext.on('**', wildcardForwarder);
                        loadedContext._eventsForwarded = true;
                        debug(`📋 ContextManager: ✅ Wildcard forwarding active for loaded context ${loadedContext.id}`);
                    }

                    contextInstance = loadedContext;
                }
            }

            if (contextInstance) {
                // Permission check: if accessing user is not the owner, check ACL
                if (userId !== contextInstance.userId) { // contextInstance.userId is the owner
                    // For getContext, 'documentRead' is a sensible default required permission
                    if (!contextInstance.checkPermission(userId, 'documentRead')) {
                        throw new Error(`Access denied. User ${userId} does not have sufficient permission for context ${contextKey}.`);
                    }
                    debug(`User ${userId} granted access to context ${contextKey} owned by ${contextInstance.userId}`);
                }
                return contextInstance;
            }


            // Auto-create if enabled and applicable
            if (canAutoCreate) {
                debug(`Context with key "${contextKey}" not found for owner ${ownerUserId}, auto-creating as ${userId}`);
                // When auto-creating, the 'id' option should be the plain contextId, not the full identifier
                const createOptions = { ...options, id: contextId.toString() };
                return this.createContext(userId, options.url || '/', createOptions);
            }

            throw new Error(`Context with key "${contextKey}" not found for user ${ownerUserId}`);
        } catch (error) {
            debug(`Error getting context ${contextKey} for accessing user ${userId}: ${error.message}`);
            throw error;
        }
    }

    hasContext(userId, contextIdOrFullIdentifier) {
        if (!this.#initialized) {
            throw new Error('ContextManager not initialized');
        }
        const { ownerUserId, contextId } = this.#parseContextIdentifier(contextIdOrFullIdentifier, userId);
        const contextKey = this.#constructContextKey(ownerUserId, contextId);
        // This check doesn't verify permissions, just existence.
        // For a true "has access" check, getContext would be needed.
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
            const accessingUserId = userId; // Alias for clarity
            const userContextsArray = [];
            const processedKeys = new Set();

            // 1. Get contexts owned by the accessingUserId from in-memory cache
            const ownedPrefix = `${accessingUserId}/`;
            for (const [key, contextInstance] of this.#contexts) {
                if (key.startsWith(ownedPrefix)) {
                    // Resolve owner ID to user email
                    try {
                        const ownerUser = await this.#workspaceManager.userManager.getUser(contextInstance.userId);
                        const contextWithOwnerEmail = {
                            ...contextInstance.toJSON(),
                            ownerEmail: ownerUser.email
                        };
                        userContextsArray.push(contextWithOwnerEmail);
                    } catch (error) {
                        debug(`Failed to resolve owner email for in-memory context ${contextInstance.id}: ${error.message}`);
                        // Fallback to original entry if user resolution fails
                        userContextsArray.push(contextInstance.toJSON());
                    }
                    processedKeys.add(key);
                }
            }

            // 2. Get contexts from the persistent store
            const allContextsInStore = this.#indexStore.store; // Assuming .store gives access to the raw data
            if (allContextsInStore && typeof allContextsInStore === 'object') {
                for (const key in allContextsInStore) {
                    if (processedKeys.has(key)) {
                        continue; // Already processed from in-memory cache
                    }

                    const storedContextData = allContextsInStore[key];
                    if (!storedContextData || typeof storedContextData !== 'object') {
                        debug(`Skipping invalid stored data for key: ${key}`);
                        continue;
                    }

                    // Check if it's an owned context (not already in memory)
                    if (key.startsWith(ownedPrefix)) {
                        // Resolve owner ID to user email
                        try {
                            const ownerUser = await this.#workspaceManager.userManager.getUser(storedContextData.userId);
                            const contextWithOwnerEmail = {
                                ...storedContextData,
                                ownerEmail: ownerUser.email
                            };
                            userContextsArray.push(contextWithOwnerEmail);
                        } catch (error) {
                            debug(`Failed to resolve owner email for context ${storedContextData.id}: ${error.message}`);
                            // Fallback to original entry if user resolution fails
                            userContextsArray.push(storedContextData);
                        }
                        processedKeys.add(key);
                    } else {
                        // 3. Check if it's a context shared with the accessingUserId
                        // The storedContextData.userId is the owner of this context.
                        // We need to check storedContextData.acl for the accessingUserId.
                        if (storedContextData.acl && typeof storedContextData.acl === 'object' && storedContextData.acl[accessingUserId]) {
                            // The accessingUserId has some level of access to this context.
                            // We can add a flag or modify the data slightly if needed to indicate it's a shared context.
                            // For now, just add the raw data.
                            try {
                                const ownerUser = await this.#workspaceManager.userManager.getUser(storedContextData.userId);
                                const contextWithOwnerEmail = {
                                    ...storedContextData,
                                    ownerEmail: ownerUser.email,
                                    isShared: true, // Indicate that this context is accessed via a share
                                    sharedVia: storedContextData.acl[accessingUserId] // Optionally show the permission level
                                };
                                userContextsArray.push(contextWithOwnerEmail);
                            } catch (error) {
                                debug(`Failed to resolve owner email for shared context ${storedContextData.id}: ${error.message}`);
                                // Fallback to original entry if user resolution fails
                                userContextsArray.push({
                                    ...storedContextData,
                                    isShared: true, // Indicate that this context is accessed via a share
                                    sharedVia: storedContextData.acl[accessingUserId] // Optionally show the permission level
                                });
                            }
                            processedKeys.add(key); // Mark as processed to avoid duplicates if logic changes
                        }
                    }
                }
            }

            debug(`Listed ${userContextsArray.length} contexts for user ${accessingUserId} (owned and shared)`);
            return userContextsArray;
        } catch (error) {
            debug(`Error listing contexts for user ${userId}: ${error.message}`);
            return []; // Or rethrow, depending on desired error handling
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
        // For removeContext, contextId should be a simple ID, not a shared one,
        // as you can only remove your own contexts.
        if (!contextId || contextId === undefined || contextId === null || contextId.toString().includes('/')) {
            throw new Error('Valid Context ID is required and cannot be a shared context identifier.');
        }

        if (contextId === 'default') {
            throw new Error('Default context cannot be removed');
        }

        try {
            const contextKey = this.#constructContextKey(userId, contextId);
            let contextWasRemoved = false;

            if (this.#contexts.has(contextKey)) {
                const context = this.#contexts.get(contextKey);
                await context.destroy();
                this.#contexts.delete(contextKey);
                contextWasRemoved = true;
            }

            // Remove from index store if exists (which should be the case)
            if (this.#indexStore.has(contextKey)) {
                this.#indexStore.delete(contextKey);
                contextWasRemoved = true;
            }

            // Only emit event and log if something was actually removed
            if (contextWasRemoved) {
                this.emit('context.deleted', {
                    contextKey: contextKey,
                    userId: userId,
                    contextId: contextId.toString()
                });
                debug(`Context ${contextKey} removed.`);
                return true;
            } else {
                debug(`Context ${contextKey} not found, nothing to remove.`);
                return false;
            }
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

        const contextKey = this.#constructContextKey(userId, context.id);
        const contextData = context.toJSON();

        // Save to in-memory cache
        this.#contexts.set(contextKey, context);
        this.#indexStore.set(contextKey, contextData);
        debug(`Saved context with key ${contextKey}`);

        // Forward all events from the context instance to the manager using a wildcard listener
        if (!context._eventsForwarded) {
            debug(`📋 ContextManager: Setting up *wildcard* event forwarding for context ${context.id}`);

            const manager = this; // capture for closure
            const wildcardForwarder = function (payload = {}) {
                const eventName = this.event; // EventEmitter2 provides the emitted event name
                const enriched = { ...payload, contextId: context.id };
                debug(`📋 ContextManager: 🎯 Forwarding event "${eventName}" from context ${context.id}`);
                debug(`📋 ContextManager: 🎯 Event payload:`, JSON.stringify(enriched, null, 2));
                manager.emit(eventName, enriched);
                debug(`📋 ContextManager: ➡️  forwarded ${eventName} for context ${context.id}`);
            };

            context.on('**', wildcardForwarder);
            context._eventsForwarded = true;
            debug(`📋 ContextManager: ✅ Wildcard event forwarding active for context ${context.id}`);
        }
    }

    /**
     * Private methods
     */

    #sanitizeContextId(contextId) {
        if (contextId === undefined || contextId === null || contextId === '') {
            contextId = 'default';
        }

        // Remove all special characters
        contextId = contextId.replace(/[^a-zA-Z0-9]/g, '');

        // Limit to 16 characters
        contextId = contextId.substring(0, 16);

        // Ensure it's a string
        return contextId.toString().trim();
    }

    #constructContextKey(userId, contextId) {
        return `${userId}/${this.#sanitizeContextId(contextId.toString())}`; // Ensure contextId is sanitized here
    }

    #parseContextIdentifier(identifier, defaultUserId) {
        const idStr = identifier.toString();
        if (idStr.includes('/')) {
            const parts = idStr.split('/');
            if (parts.length === 2 && parts[0] && parts[1]) {
                // Simple user/resource format: user.name/context.name or user.id/context.id
                return { ownerUserId: parts[0], contextId: this.#sanitizeContextId(parts[1]) };
            } else {
                throw new Error(`Invalid context identifier format: ${idStr}. Expected 'user.name/context.name' or simple 'contextId'.`);
            }
        }
        // If no '/', it's a simple contextId, owner is the defaultUserId (usually the accessing user)
        return { ownerUserId: defaultUserId, contextId: this.#sanitizeContextId(idStr) };
    }

        /**
     * Resolves a context ID from a simple context identifier
     * @param {string} contextIdentifier - Simple identifier in format user.name/context.name
     * @returns {Promise<string|null>} The context ID if found, null otherwise
     */
    async resolveContextIdFromSimpleIdentifier(contextIdentifier) {
        try {
            const { ownerUserId, contextId } = this.#parseContextIdentifier(contextIdentifier, null);

            // If no ownerUserId was parsed (simple contextId), return null as this method is for user/context format
            if (!ownerUserId) {
                return null;
            }

            // Resolve the user identifier to a user ID if needed
            const resolvedUserId = await this.#workspaceManager.userManager.resolveToUserId(ownerUserId);
            if (!resolvedUserId) {
                return null;
            }

            // Check if context exists
            const contextKey = this.#constructContextKey(resolvedUserId, contextId);
            if (this.#contexts.has(contextKey) || this.#indexStore.has(contextKey)) {
                return contextId;
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Construct a simple resource address from context data
     * @param {Object} context - Context object with userId and id
     * @returns {Promise<string|null>} Resource address in format user.name/context.id
     */
    async constructResourceAddress(context) {
        if (!context || !context.userId || !context.id) {
            return null;
        }

        try {
            // Get user info to construct the address
            const user = await this.#workspaceManager.userManager.getUser(context.userId);
            if (!user || !user.name) {
                return null;
            }

            return `${user.name}/${context.id}`;
        } catch (error) {
            return null;
        }
    }

    async grantContextAccess(requestingUserId, targetContextIdentifier, sharedWithUserId, accessLevel) {
        if (!this.#initialized) throw new Error('ContextManager not initialized');
        if (!requestingUserId) throw new Error('Requesting User ID is required.');
        if (!targetContextIdentifier) throw new Error('Target Context Identifier is required.');
        if (!sharedWithUserId) throw new Error('User ID to share with is required.');
        if (!accessLevel) throw new Error('Access level is required.');

        const { ownerUserId, contextId: actualContextId } = this.#parseContextIdentifier(targetContextIdentifier, requestingUserId);

        if (requestingUserId !== ownerUserId) {
            throw new Error(`Access denied: User ${requestingUserId} is not the owner of context ${targetContextIdentifier}.`);
        }

        try {
            // Get the context - this uses the owner's ID to fetch
            const context = await this.getContext(ownerUserId, actualContextId); // Pass ownerUserId as accessing user for this internal step
            await context.grantAccess(sharedWithUserId, accessLevel);
            debug(`Access granted to ${sharedWithUserId} for context ${targetContextIdentifier} with level ${accessLevel} by ${requestingUserId}`);
            return true;
        } catch (error) {
            debug(`Error granting access to context ${targetContextIdentifier}: ${error.message}`);
            throw error;
        }
    }

    async revokeContextAccess(requestingUserId, targetContextIdentifier, sharedWithUserId) {
        if (!this.#initialized) throw new Error('ContextManager not initialized');
        if (!requestingUserId) throw new Error('Requesting User ID is required.');
        if (!targetContextIdentifier) throw new Error('Target Context Identifier is required.');
        if (!sharedWithUserId) throw new Error('User ID to revoke access from is required.');

        const { ownerUserId, contextId: actualContextId } = this.#parseContextIdentifier(targetContextIdentifier, requestingUserId);

        if (requestingUserId !== ownerUserId) {
            throw new Error(`Access denied: User ${requestingUserId} is not the owner of context ${targetContextIdentifier}.`);
        }

        try {
            // Get the context - this uses the owner's ID to fetch
            const context = await this.getContext(ownerUserId, actualContextId); // Pass ownerUserId as accessing user for this internal step
            await context.revokeAccess(sharedWithUserId);
            debug(`Access revoked from ${sharedWithUserId} for context ${targetContextIdentifier} by ${requestingUserId}`);
            return true;
        } catch (error) {
            debug(`Error revoking access from context ${targetContextIdentifier}: ${error.message}`);
            throw error;
        }
    }

}

export default ContextManager;
