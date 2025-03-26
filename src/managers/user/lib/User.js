'use strict';

import path from 'path';
import fs from 'fs/promises';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('user');
import EventEmitter from 'eventemitter2';
import { v4 as uuidv4 } from 'uuid';
import Conf from 'conf';

// Managers
import WorkspaceManager from '@/managers/workspace/index.js';
import ContextManager from '@/managers/context/index.js';

// Constants
const USER_DIRECTORIES = {
    config: 'Config',
    home: 'Home',
    data: 'Data',
    db: 'Db',
    dotfiles: 'Dotfiles', // We use Dotfiles.git for the bare-metal repository
    workspaces: 'Workspaces',
};

/**
 * User Class
 * Manages workspaces, contexts, and other user-specific resources
 */
class User extends EventEmitter {
    #id;
    #email;
    #homePath;
    #userType;

    // User environment managers
    #workspaceManager;
    #contextManager;

    // User data storage
    #tokenStore;

    // Runtime state
    #status = 'inactive'; // inactive, activating, active, deactivating
    #startTime;
    #stats = {
        workspaces: {
            total: 0,
            open: 0,
        },
        contexts: {
            total: 0,
            active: 0,
        },
        apiTokens: 0,
    };

    constructor(options = {}) {
        super();

        if (!options.id) {
            throw new Error('User ID is required');
        }

        if (!options.email) {
            throw new Error('Email is required');
        }

        if (!options.homePath) {
            throw new Error('Home path is required');
        }

        /**
         * User properties
         */
        this.#id = options.id;
        this.#email = options.email;
        this.#homePath = options.homePath;
        this.#userType = options.userType || 'user';

        debug(`User instance created: ${this.#id} (${this.#email})`);
    }

    /**
     * Activate the user runtime environment
     * This is similar to the init process (PID1) in Linux
     * @returns {Promise<void>}
     */
    async activate() {
        if (this.#status === 'active') {
            debug(`User already active: ${this.#id}`);
            return;
        }

        this.#status = 'activating';
        debug(`Activating user runtime: ${this.#id}`);

        try {
            // Record start time
            this.#startTime = Date.now();

            // Ensure user home directory exists
            await fs.mkdir(this.#homePath, { recursive: true });
            debug(`Ensured user home directory exists: ${this.#homePath}`);

            // Ensure user directories exist
            for (const dir in USER_DIRECTORIES) {
                const dirPath = path.join(this.#homePath, USER_DIRECTORIES[dir]);
                await fs.mkdir(dirPath, { recursive: true });
            }
            debug(`Ensured user directories exist: ${Object.keys(USER_DIRECTORIES).join(', ')}`);

            // Initialize token store
            this.#initializeTokenStore();
            debug('Token store initialized');

            // TODO: Remove, WM and CM will be initialized centrally in the Server.js

            // Initialize workspace manager
            this.#workspaceManager = new WorkspaceManager({
                rootPath: workspacesPath,
                owner: this.#id,
            });
            await this.#workspaceManager.initialize();
            debug(`Workspace manager initialized for user: ${this.#id}`);

            // Initialize context manager
            this.#contextManager = new ContextManager({
                user: this,
                workspaceManager: this.#workspaceManager,
            });

            if (typeof this.#contextManager.initialize === 'function') {
                await this.#contextManager.initialize();
                debug(`Context manager initialized for user: ${this.#id}`);
            }

            // Create universe workspace if it doesn't exist
            // Check both in-memory index and on disk
            if (!this.#workspaceManager.hasWorkspace('universe') && !this.#workspaceManager.hasWorkspaceOnDisk('universe')) {
                await this.#workspaceManager.createWorkspace('universe', {
                    type: 'universe',
                    label: 'Universe',
                    color: '#fff',
                    owner: this.#id,
                });
                debug(`Created universe workspace for user: ${this.#id}`);
            } else if (
                this.#workspaceManager.hasWorkspaceOnDisk('universe') &&
                !this.#workspaceManager.hasWorkspace('universe')
            ) {
                // If workspace exists on disk but not in memory, load it
                await this.#workspaceManager.loadWorkspace('universe');
                debug(`Loaded existing universe workspace for user: ${this.#id}`);
            }

            // Activate universe workspace
            await this.#workspaceManager.openWorkspace('universe');
            debug(`Activated universe workspace for user: ${this.#id}`);

            // Set up event listeners for workspace and context managers
            this.#setupEventListeners();

            // Update stats
            this.#updateStats();

            // Mark as active
            this.#status = 'active';
            this.emit('activated', this);
            debug(`User runtime activated: ${this.#id}`);
        } catch (err) {
            this.#status = 'inactive';
            debug(`Error activating user runtime: ${err.message}`);
            throw err;
        }
    }

    /**
     * Deactivate the user runtime environment
     * This is similar to shutting down the init process in Linux
     * @returns {Promise<void>}
     */
    async deactivate() {
        if (this.#status !== 'active') {
            debug(`User not active: ${this.#id}`);
            return;
        }

        this.#status = 'deactivating';
        debug(`Deactivating user runtime: ${this.#id}`);

        try {
            // Close all open workspaces
            const openWorkspaces = this.#workspaceManager.listOpenWorkspaces();
            for (const workspace of openWorkspaces) {
                await this.#workspaceManager.closeWorkspace(workspace.id);
                debug(`Closed workspace: ${workspace.id}`);
            }

            // Clean up event listeners
            this.#cleanupEventListeners();

            // Reset stats
            this.#stats = {
                workspaces: {
                    total: 0,
                    open: 0,
                },
                contexts: {
                    total: 0,
                    active: 0,
                },
                apiTokens: 0,
            };

            // Mark as inactive
            this.#status = 'inactive';
            this.emit('deactivated', this.#id);
            debug(`User runtime deactivated: ${this.#id}`);
        } catch (err) {
            // Even if there's an error, we want to mark as inactive
            this.#status = 'inactive';
            debug(`Error deactivating user runtime: ${err.message}`);
            throw err;
        }
    }

    // Getters
    get id() {
        return this.#id;
    }
    get email() {
        return this.#email;
    }
    get homePath() {
        return this.#homePath;
    }
    get userType() {
        return this.#userType;
    }
    get workspaceManager() {
        return this.#workspaceManager;
    }
    get contextManager() {
        return this.#contextManager;
    }
    get status() {
        return this.#status;
    }
    get uptime() {
        if (!this.#startTime) {
            return 0;
        }
        return Date.now() - this.#startTime;
    }
    get stats() {
        return this.#stats;
    }

    // Check if user is an admin
    isAdmin() {
        return this.#userType === 'admin';
    }

    /**
     * Create a new workspace
     * @param {string} workspaceID - Workspace ID
     * @param {Object} options - Workspace options
     * @returns {Promise<Object>} Created workspace
     */
    async createWorkspace(workspaceID, options = {}) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        debug(`Creating workspace: ${workspaceID}`);
        return this.#workspaceManager.createWorkspace(workspaceID, {
            ...options,
            owner: this.#id,
        });
    }

    /**
     * Open a workspace
     * @param {string} workspaceID - Workspace ID
     * @returns {Promise<Object>} Opened workspace
     */
    async openWorkspace(workspaceID) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        debug(`Opening workspace: ${workspaceID}`);
        return this.#workspaceManager.openWorkspace(workspaceID);
    }

    /**
     * Close a workspace
     * @param {string} workspaceID - Workspace ID
     * @returns {Promise<boolean>} Success status
     */
    async closeWorkspace(workspaceID) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        debug(`Closing workspace: ${workspaceID}`);
        return this.#workspaceManager.closeWorkspace(workspaceID);
    }

    /**
     * Delete a workspace (mark as deleted)
     * @param {string} workspaceID - Workspace ID
     * @param {Object} options - Options
     * @returns {Promise<boolean>} Success status
     */
    async deleteWorkspace(workspaceID, options = {}) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        debug(`Deleting workspace: ${workspaceID}`);
        return this.#workspaceManager.deleteWorkspace(workspaceID, options);
    }

    /**
     * Permanently delete a workspace from disk
     * @param {string} workspaceID - Workspace ID
     * @returns {Promise<boolean>} Success status
     */
    async purgeWorkspace(workspaceID) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        debug(`Purging workspace: ${workspaceID}`);
        return this.#workspaceManager.purgeWorkspace(workspaceID);
    }

    /**
     * Get a workspace by ID
     * @param {string} workspaceID - Workspace ID
     * @returns {Object|null} Workspace or null if not found
     */
    getWorkspace(workspaceID) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        return this.#workspaceManager.getWorkspace(workspaceID);
    }

    /**
     * List all workspaces
     * @param {Object} options - Filter options
     * @param {boolean} options.includeDeleted - Whether to include deleted workspaces
     * @returns {Array<Object>} List of workspaces
     */
    listWorkspaces(options = {}) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        const workspaces = this.#workspaceManager.listWorkspaces();

        if (!options.includeDeleted) {
            return workspaces.filter((workspace) => !workspace.isDeleted);
        }

        return workspaces;
    }

    /**
     * List open workspaces
     * @returns {Array<Object>} List of open workspaces
     */
    listOpenWorkspaces() {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        return this.#workspaceManager.listOpenWorkspaces();
    }

    /**
     * Check if a workspace exists
     * @param {string} workspaceID - Workspace ID
     * @returns {boolean} True if workspace exists
     */
    hasWorkspace(workspaceID) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        return this.#workspaceManager.hasWorkspace(workspaceID);
    }

    /**
     * Create a context
     * @param {string} url - Context URL
     * @param {Object} options - Context options
     * @returns {Promise<Object>} Created context
     */
    async createContext(url, options = {}) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        debug(`Creating context: ${url}`);
        return this.#contextManager.createContext(url, options);
    }

    /**
     * Get a context by ID
     * @param {string} id - Context ID
     * @param {Object} options - Options
     * @returns {Object|null} Context or null if not found
     */
    getContext(id, options = {}) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        return this.#contextManager.getContext(id, options);
    }

    /**
     * List all contexts
     * @returns {Array<Object>} List of contexts
     */
    listContexts() {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        return this.#contextManager.listContexts();
    }

    /**
     * Remove a context
     * @param {string} id - Context ID
     * @returns {Promise<boolean>} Success status
     */
    async removeContext(id) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        debug(`Removing context: ${id}`);
        return this.#contextManager.removeContext(id);
    }

    /**
     * Create a new API token
     * @param {Object} options - Token options
     * @param {string} options.name - Token name
     * @param {string} options.description - Token description
     * @param {Array<string>} options.scopes - Token scopes/permissions
     * @param {Date|null} options.expiresAt - Expiration date or null for no expiration
     * @returns {Promise<Object>} Created token with value
     */
    async createApiToken(options = {}) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        const tokenId = uuidv4();
        const tokenValue = uuidv4() + uuidv4(); // Generate a long random token value

        const token = {
            id: tokenId,
            name: options.name || 'API Token',
            description: options.description || '',
            scopes: options.scopes || ['*'],
            createdAt: new Date().toISOString(),
            expiresAt: options.expiresAt ? options.expiresAt.toISOString() : null,
            lastUsedAt: null,
        };

        // Store token in Conf
        const tokens = this.#tokenStore.get('tokens');
        tokens[tokenId] = token;
        this.#tokenStore.set('tokens', tokens);

        // Update stats
        this.#updateStats();

        // Emit event
        this.emit('apiToken:created', { id: tokenId, name: token.name });
        debug(`API token created: ${tokenId} (${token.name})`);

        // Return token with value (value is only returned once)
        return {
            ...token,
            value: tokenValue,
        };
    }

    /**
     * Get an API token by ID
     * @param {string} tokenId - Token ID
     * @returns {Object|null} Token or null if not found
     */
    getApiToken(tokenId) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        const tokens = this.#tokenStore.get('tokens');
        return tokens[tokenId] || null;
    }

    /**
     * List all API tokens
     * @param {Object} options - Filter options
     * @param {boolean} options.includeExpired - Whether to include expired tokens
     * @returns {Array<Object>} List of tokens (without values)
     */
    listApiTokens(options = {}) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        const tokens = this.#tokenStore.get('tokens');
        const tokenList = Object.values(tokens);

        if (!options.includeExpired) {
            const now = new Date().toISOString();
            return tokenList.filter((token) => !token.expiresAt || token.expiresAt > now);
        }

        return tokenList;
    }

    /**
     * Update an API token
     * @param {string} tokenId - Token ID
     * @param {Object} updates - Updates to apply
     * @param {string} updates.name - Token name
     * @param {string} updates.description - Token description
     * @param {Array<string>} updates.scopes - Token scopes/permissions
     * @param {Date|null} updates.expiresAt - Expiration date or null for no expiration
     * @returns {Promise<Object|null>} Updated token or null if not found
     */
    async updateApiToken(tokenId, updates = {}) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        const tokens = this.#tokenStore.get('tokens');
        const token = tokens[tokenId];

        if (!token) {
            debug(`API token not found: ${tokenId}`);
            return null;
        }

        const updatedToken = {
            ...token,
            ...updates,
            updatedAt: new Date().toISOString(),
        };

        // Store updated token
        tokens[tokenId] = updatedToken;
        this.#tokenStore.set('tokens', tokens);

        // Emit event
        this.emit('apiToken:updated', { id: tokenId, name: updatedToken.name });
        debug(`API token updated: ${tokenId} (${updatedToken.name})`);

        return updatedToken;
    }

    /**
     * Delete an API token
     * @param {string} tokenId - Token ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteApiToken(tokenId) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        const tokens = this.#tokenStore.get('tokens');
        const token = tokens[tokenId];

        if (!token) {
            debug(`API token not found: ${tokenId}`);
            return false;
        }

        // Remove token
        delete tokens[tokenId];
        this.#tokenStore.set('tokens', tokens);

        // Update stats
        this.#updateStats();

        // Emit event
        this.emit('apiToken:deleted', { id: tokenId, name: token.name });
        debug(`API token deleted: ${tokenId} (${token.name})`);

        return true;
    }

    /**
     * Update API token last used timestamp
     * @param {string} tokenId - Token ID
     * @returns {Promise<boolean>} Success status
     */
    async updateApiTokenUsage(tokenId) {
        if (this.#status !== 'active') {
            throw new Error('User runtime not active');
        }

        const tokens = this.#tokenStore.get('tokens');
        const token = tokens[tokenId];

        if (!token) {
            debug(`API token not found: ${tokenId}`);
            return false;
        }

        // Update last used timestamp
        token.lastUsedAt = new Date().toISOString();
        tokens[tokenId] = token;
        this.#tokenStore.set('tokens', tokens);

        return true;
    }

    /**
     * Load API tokens from external source
     * @param {Array<Object>} tokensArray - Array of tokens to load
     * @private
     */
    _loadApiTokens(tokensArray = []) {
        if (!this.#tokenStore) {
            this.#initializeTokenStore();
        }

        // Convert array to object with token ID as key
        const tokens = {};
        for (const token of tokensArray) {
            if (token && token.id) {
                tokens[token.id] = token;
            }
        }

        // Store tokens
        this.#tokenStore.set('tokens', tokens);

        // Update stats
        this.#updateStats();
        debug(`Loaded ${tokensArray.length} API tokens`);
    }

    /**
     * Get all API tokens for persistence
     * @returns {Array<Object>} All tokens
     * @private
     */
    _getApiTokensForStorage() {
        if (!this.#tokenStore) {
            return [];
        }

        const tokens = this.#tokenStore.get('tokens');
        return Object.values(tokens);
    }

    /**
     * Get user status information
     * @returns {Object} User status
     */
    getStatus() {
        return {
            id: this.#id,
            email: this.#email,
            status: this.#status,
            uptime: this.uptime,
            stats: this.#stats,
        };
    }

    /**
     * Convert user to JSON
     * @returns {Object} User JSON representation
     */
    toJSON() {
        return {
            id: this.#id,
            email: this.#email,
            homePath: this.#homePath,
            userType: this.#userType,
            status: this.#status,
            uptime: this.uptime,
            stats: this.#stats,
            workspaces:
                this.#status === 'active'
                    ? this.listWorkspaces().map((w) => ({
                          id: w.id,
                          name: w.name,
                          type: w.type,
                          isOpen: this.#workspaceManager.isOpen(w.id),
                      }))
                    : [],
        };
    }

    /**
     * Initialize the token store
     * @private
     */
    #initializeTokenStore() {
        // Create a Conf instance for API tokens
        this.#tokenStore = new Conf({
            configName: 'tokens',
            cwd: this.#homePath,
            defaults: {
                tokens: {},
            },
        });

        debug(`Token store initialized with ${Object.keys(this.#tokenStore.get('tokens')).length} tokens`);
    }

    /**
     * Set up event listeners for workspace and context managers
     * @private
     */
    #setupEventListeners() {
        // Workspace manager events
        if (this.#workspaceManager) {
            this.#workspaceManager.on('workspace:created', this.#handleWorkspaceCreated.bind(this));
            this.#workspaceManager.on('workspace:opened', this.#handleWorkspaceOpened.bind(this));
            this.#workspaceManager.on('workspace:closed', this.#handleWorkspaceClosed.bind(this));
            this.#workspaceManager.on('workspace:deleted', this.#handleWorkspaceDeleted.bind(this));
        }

        // Context manager events
        if (this.#contextManager) {
            this.#contextManager.on('context:created', this.#handleContextCreated.bind(this));
            this.#contextManager.on('context:removed', this.#handleContextRemoved.bind(this));
        }
    }

    /**
     * Clean up event listeners
     * @private
     */
    #cleanupEventListeners() {
        // Workspace manager events
        if (this.#workspaceManager) {
            this.#workspaceManager.removeAllListeners();
        }

        // Context manager events
        if (this.#contextManager) {
            this.#contextManager.removeAllListeners();
        }
    }

    /**
     * Update user stats
     * @private
     */
    #updateStats() {
        if (this.#status !== 'active') {
            return;
        }

        if (this.#workspaceManager) {
            this.#stats.workspaces.total = this.#workspaceManager.listWorkspaces().length;
            this.#stats.workspaces.open = this.#workspaceManager.listOpenWorkspaces().length;
        }

        if (this.#contextManager) {
            this.#stats.contexts.total = this.#contextManager.listContexts().length;
            // We don't have a concept of active contexts yet, so we'll just set it to total for now
            this.#stats.contexts.active = this.#stats.contexts.total;
        }

        if (this.#tokenStore) {
            const tokens = this.#tokenStore.get('tokens');
            this.#stats.apiTokens = Object.keys(tokens).length;
        }
    }

    // Event handlers
    #handleWorkspaceCreated(workspace) {
        this.#updateStats();
        this.emit('workspace:created', workspace);
    }

    #handleWorkspaceOpened(workspace) {
        this.#updateStats();
        this.emit('workspace:opened', workspace);
    }

    #handleWorkspaceClosed(workspace) {
        this.#updateStats();
        this.emit('workspace:closed', workspace);
    }

    #handleWorkspaceDeleted(workspace) {
        this.#updateStats();
        this.emit('workspace:deleted', workspace);
    }

    #handleContextCreated(context) {
        this.#updateStats();
        this.emit('context:created', context);
    }

    #handleContextRemoved(context) {
        this.#updateStats();
        this.emit('context:removed', context);
    }
}

export default User;
