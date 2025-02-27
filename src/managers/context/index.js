// Utils
import EventEmitter from 'eventemitter2';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('context-manager');
import { v4 as uuidv4 } from 'uuid';

// Includes
import Context from './lib/Context.js';
import Url from './lib/Url.js';

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
     * @param {string} url - Context URL (formats: sessionId@workspaceId://path, workspaceId://path, or /path)
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
                await context.setUrl(url);
            }
            return context;
        }

        // Get the session
        let session = null;
        if (parsedUrl.hasSessionId) {
            // If URL has a session ID, get the session
            const sessionId = parsedUrl.sessionId;
            session = await this.#sessionManager.getSession(sessionId);

            if (!session) {
                throw new Error(`Session with id "${sessionId}" not found`);
            }
        } else if (options.session) {
            // If URL doesn't have a session ID but a session is provided in options, use it
            session = options.session;
        } else if (options.user) {
            // If URL doesn't have a session ID and no session is provided, but a user is provided,
            // try to get the user's active session
            const userSessions = await this.#sessionManager.getUserSessions(options.user.id);
            if (userSessions.length > 0) {
                // Use the first active session
                session = userSessions[0];
            }
        }

        if (!session) {
            throw new Error('No session available for context creation');
        }

        // Get the workspace
        let workspace = null;
        if (parsedUrl.hasWorkspaceId) {
            // If URL has a workspace ID, get the workspace
            const workspaceId = parsedUrl.workspaceId;
            workspace = await this.#workspaceManager.getWorkspace(workspaceId);

            if (!workspace) {
                throw new Error(`Workspace with id "${workspaceId}" not found`);
            }
        } else if (options.workspace) {
            // If URL doesn't have a workspace ID but a workspace is provided in options, use it
            workspace = options.workspace;
        } else if (options.user) {
            // If URL doesn't have a workspace ID and no workspace is provided, but a user is provided,
            // try to get the user's default workspace
            workspace = await this.#workspaceManager.getUserDefaultWorkspace(options.user.id);
        }

        if (!workspace) {
            throw new Error('No workspace available for context creation');
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
            const contextParsedUrl = context.parsedUrl;

            // Compare paths
            if (contextParsedUrl.path === parsedUrl.path) {
                // If both URLs have workspace IDs, compare them
                if (contextParsedUrl.hasWorkspaceId && parsedUrl.hasWorkspaceId) {
                    if (contextParsedUrl.workspaceId === parsedUrl.workspaceId) {
                        // If both URLs have session IDs, compare them
                        if (contextParsedUrl.hasSessionId && parsedUrl.hasSessionId) {
                            if (contextParsedUrl.sessionId === parsedUrl.sessionId) {
                                return context;
                            }
                        } else {
                            // If one URL doesn't have a session ID, it's still a match
                            return context;
                        }
                    }
                } else if (!contextParsedUrl.hasWorkspaceId && !parsedUrl.hasWorkspaceId) {
                    // If neither URL has a workspace ID, it's a match based on path
                    return context;
                }
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
