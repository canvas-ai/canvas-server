// Utils
import EventEmitter from 'eventemitter2';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('context-manager');

// Includes
import Context from './lib/Context.js';
import Url from './lib/Url.js';

/**
 * Context Manager
 * Manages contexts for users and workspaces
 */

class ContextManager extends EventEmitter {

    #activeContexts = new Map();

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

        debug('Context manager initialized');
    }

    async createContext(url, options = {}) {
        debug(`Creating context: ${url}`);

        // Parse the URL
        const parsedUrl = new Url(url);

        // If URL has a workspace ID, get the workspace
        let workspace;
        if (parsedUrl.hasWorkspaceId) {
            debug(`URL has workspace ID: ${parsedUrl.workspaceId}`);

            // Get the workspace manager
            const workspaceManager = global.app.getManager('workspace');
            if (!workspaceManager) {
                throw new Error('Workspace manager not available');
            }

            // Open the workspace (this will load it first if needed)
            try {
                workspace = await workspaceManager.open(parsedUrl.workspaceId);
                debug(`Opened workspace: ${workspace.id}`);
            } catch (err) {
                throw new Error(`Failed to open workspace ${parsedUrl.workspaceId}: ${err.message}`);
            }
        }

        // If URL has a session ID, get the session
        let session;
        if (parsedUrl.hasSessionId) {
            debug(`URL has session ID: ${parsedUrl.sessionId}`);

            // Get the session manager
            const sessionManager = global.app.getManager('session');
            if (!sessionManager) {
                throw new Error('Session manager not available');
            }

            // Get the session
            session = await sessionManager.getSession(parsedUrl.sessionId);
            if (!session) {
                throw new Error(`Session not found: ${parsedUrl.sessionId}`);
            }

            debug(`Found session: ${session.id}`);
        }

        // Create the context
        const context = new Context(url, {
            ...options,
            workspace,
            session,
            workspaceManager: global.app.getManager('workspace') // Inject the workspace manager
        });

        // Initialize the context
        await context.initialize();

        // Add to contexts
        this.#activeContexts.set(context.id, context);

        // Return the context
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

    /**
     * Switch a context to a different workspace
     * This replaces the previous cloneContextToWorkspace method with a more accurate implementation
     * @param {string} contextId - Context ID
     * @param {string} workspaceId - Target workspace ID
     * @returns {Promise<Context>} - Updated context with the new workspace
     */
    async switchContextWorkspace(contextId, workspaceId) {
        debug(`Switching context ${contextId} to workspace ${workspaceId}`);

        // Get the context
        const context = this.#activeContexts.get(contextId);
        if (!context) {
            throw new Error(`Context not found: ${contextId}`);
        }

        // Get the workspace manager
        const workspaceManager = global.app.getManager('workspace');
        if (!workspaceManager) {
            throw new Error('Workspace manager not available');
        }

        // Open the target workspace
        const workspace = await workspaceManager.open(workspaceId);
        if (!workspace) {
            throw new Error(`Failed to open workspace: ${workspaceId}`);
        }

        // Switch the context to the new workspace
        await context.switchWorkspace(workspace);

        // Return the updated context
        return context;
    }
}

export default ContextManager;
