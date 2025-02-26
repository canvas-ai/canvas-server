// Utils
import EventEmitter from 'eventemitter2';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('context-manager');
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Includes
import Context from './lib/Context.js';
import Url from './lib/Url.js';
import LayerIndex from '../tree/layers/index.js';
import Tree from '../tree/lib/Tree.js';

// Module defaults
const MAX_CONTEXTS = 1024; // 2^10
const CONTEXT_URL_PROTO = 'universe';
const CONTEXT_URL_BASE = '/';

/**
 * Context Manager
 *
 * Manages contexts for users and workspaces
 */
class ContextManager extends EventEmitter {
    #tree;
    #layers;
    #activeContexts = new Map();
    #initialized = false;
    #workspaceManager;
    #sessionManager;

    constructor(options = {}) {
        super(); // EventEmitter

        debug('Initializing context manager');

        this.#workspaceManager = options.workspaceManager;
        this.#sessionManager = options.sessionManager;

        if (!this.#workspaceManager) {
            throw new Error('WorkspaceManager is required');
        }

        if (!this.#sessionManager) {
            throw new Error('SessionManager is required');
        }
    }

    async initialize() {
        if (this.#initialized) {
            return;
        }

        debug('Initializing context manager');

        this.#initialized = true;
    }

    /**
     * Create a new context
     * @param {string} url - Context URL (format: sessionId@workspaceId://path)
     * @param {Object} options - Context options
     * @returns {Context} - Created context
     */
    async createContext(url, options = {}) {
        if (this.#activeContexts.size >= MAX_CONTEXTS) {
            throw new Error('Maximum number of contexts reached');
        }

        // Parse the URL
        const parsedUrl = new Url(url);

        // If a context with the same id already exists, return it
        if (options.id && this.#activeContexts.has(options.id)) {
            const context = this.#activeContexts.get(options.id);
            // Change the url if a url is supplied
            if (url !== context.url) {
                context.setUrl(url);
            }
            return context;
        }

        // Get the session
        const sessionId = parsedUrl.sessionId;
        const session = await this.#sessionManager.getSession(sessionId);

        if (!session) {
            throw new Error(`Session with id "${sessionId}" not found`);
        }

        // Get the workspace
        const workspaceId = parsedUrl.workspaceId;
        const workspace = this.#workspaceManager.getWorkspace(workspaceId);

        if (!workspace) {
            throw new Error(`Workspace with id "${workspaceId}" not found`);
        }

        // Create context options
        const contextOptions = {
            id: options.id || uuidv4(),
            session: session,
            workspace: workspace,
            path: parsedUrl.path,
            ...options
        };

        // Create the context
        const context = new Context(url, contextOptions);

        // Initialize the context
        await context.initialize();

        // Add to active contexts
        this.#activeContexts.set(context.id, context);

        this.emit('context:created', context);

        return context;
    }

    /**
     * Get a context by ID
     * @param {string} id - Context ID
     * @returns {Context} - Context instance
     */
    getContext(id) {
        if (!id) {
            // Return the first context if no ID is provided
            if (this.#activeContexts.size > 0) {
                return this.#activeContexts.values().next().value;
            }

            throw new Error('No active contexts found');
        }

        const context = this.#activeContexts.get(id);

        if (!context) {
            throw new Error(`Context with id "${id}" not found`);
        }

        return context;
    }

    /**
     * Get a context by URL
     * @param {string} url - Context URL
     * @returns {Context} - Context instance
     */
    getContextByUrl(url) {
        const parsedUrl = new Url(url);

        for (const context of this.#activeContexts.values()) {
            if (context.url === url) {
                return context;
            }
        }

        return null;
    }

    /**
     * List all active contexts
     * @returns {Array<Context>} - Array of context instances
     */
    listContexts() {
        return Array.from(this.#activeContexts.values());
    }

    /**
     * List contexts for a session
     * @param {string} sessionId - Session ID
     * @returns {Array<Context>} - Array of context instances
     */
    listSessionContexts(sessionId) {
        return Array.from(this.#activeContexts.values())
            .filter(context => context.session.id === sessionId);
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

    /**
     * Parse a context ID
     * @param {string} id - Context ID
     * @returns {string} - Parsed context ID
     */
    #parseContextId(id) {
        // Remove all non-alphanumeric characters except dot, underscore and dash
        id = id.replace(/[^a-zA-Z0-9_.-]/g, '');
        if (id.length === 0) {
            throw new Error('Invalid Context ID');
        }

        return id;
    }
}

export default ContextManager;
