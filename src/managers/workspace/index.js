'use strict';

// Utils
import randomcolor from 'randomcolor';
import path from 'path';
import * as fsPromises from 'fs/promises';
import { existsSync } from 'fs';
import Conf from 'conf';
// import AdmZip from 'adm-zip';
// import { v4 as uuidv4 } from 'uuid';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('manager:workspace');

// Includes
import Manager from '../base/Manager.js';
import Workspace from './lib/Workspace.js';

/**
 * Constants
 */

// Workspace ID format: user.id/workspace.name
// Example: user123/my-project

const WORKSPACE_CONFIG_FILENAME = 'workspace.json'; // Name of the config file within the workspace directory

const WORKSPACE_DIRECTORIES = {
    db: 'Db',
    config: 'Config',
    data: 'Data',
    cache: 'Cache',
    home: 'Home',
    apps: 'Apps',
    roles: 'Roles',
    dotfiles: 'Dotfiles',
    workspaces: 'Workspaces',
};

const WORKSPACE_STATUS_CODES = {
    AVAILABLE: 'available', // Workspace dir exists, config readable
    NOT_FOUND: 'path_not_found', // Workspace dir/config specified in index not found
    ERROR: 'error', // Config invalid, FS issues, etc.
    ACTIVE: 'active', // Workspace is loaded and started (db connected)
    INACTIVE: 'inactive', // Workspace is loaded but not started
    REMOVED: 'removed', // Marked for removal, ignored on scan
    DESTROYED: 'destroyed', // Workspace dir deleted by user
};

// Default configuration template for a new workspace's workspace.json
// Keeping things minimal for now
const DEFAULT_WORKSPACE_CONFIG = {
    id: null, // Set to user.id/workspace.name
    name: null,
    owner: null, // User ID (email)
    type: 'workspace', // "workspace" or "universe" (user home directory)
    label: 'Workspace',
    color: null,
    description: '',
    acl: {},
    created: null,
    updated: null,
};

/**
 * Workspace Manager (Simplified)
 */

class WorkspaceManager extends Manager {

    #rootPath; // Root path for all user workspaces managed by this instance (e.g., /users)
    #workspaces = new Map(); // Cache for loaded Workspace instances (id -> Workspace)

    /**
     * Constructor
     * @param {Object} options - Configuration options
     * @param {string} options.rootPath - Root path where user workspace directories are stored (e.g., /canvas/users)
     * @param {Object} options.jim - JSON Index Manager instance
     * @param {Object} [options.userManager] - User Manager instance for user lookup
     * @param {Object} [options.eventEmitterOptions] - Options for EventEmitter2
     */
    constructor(options = {}) {
        super({
            jim: options.jim,
            indexName: 'workspaces', // Index stored in CANVAS_SERVER_DB/workspaces.json
            eventEmitterOptions: options.eventEmitterOptions,
        });

        if (!options.rootPath) {
            throw new Error('Root path is required for WorkspaceManager');
        }

        this.#rootPath = path.resolve(options.rootPath); // Ensure absolute path
        this.#workspaces = new Map();

        if (!this.getConfig('workspaces', {})) {
            this.setConfig('workspaces', {});
        }

        debug(`Initializing WorkspaceManager with rootPath: ${this.#rootPath}`);
    }

    /**
     * Getters
     */
    get rootPath() { return this.#rootPath; }

    /**
     * Get the full list of workspaces organized by user
     * @returns {Object} Object with user emails as keys and arrays of workspace objects as values
     */
    get index() {
        return this.getConfig('workspaces', {});
    }

    /**
     * Initialization
     */

    async initialize() {
        if (this.initialized) { return true; }
        super.initialize();

        await this.#scanIndexedWorkspaces();
        debug(`WorkspaceManager initialized.`);
    }

    /**
     * Public API
     */

    /**
     * Checks if a workspace instance is currently loaded in memory.
     * Requires prior successful call to openWorkspace (or startWorkspace).
     * @param {string} userId - The User ID (implicitly checked when loaded).
     * @param {string} workspaceId - The workspace ID (short name or canonical).
     * @returns {boolean} True if the workspace instance is in the memory cache.
     */
    isOpen(userId, workspaceId) {
        const canonicalId = this.#resolveWorkspaceId(userId, workspaceId);
        return this.#workspaces.has(`${userId}/${canonicalId}`);
    }

    /**
     * Checks if a workspace instance is currently loaded AND active (started).
     * Requires prior successful call to startWorkspace.
     * @param {string} userId - The User ID (implicitly checked when loaded/started).
     * @param {string} workspaceId - The workspace ID (short name or canonical).
     * @returns {boolean} True if the workspace instance is in cache and its status is ACTIVE.
     */
    isActive(userId, workspaceId) {
        const canonicalId = this.#resolveWorkspaceId(userId, workspaceId);
        const workspace = this.#workspaces.get(`${userId}/${canonicalId}`);
        return !!workspace && workspace.status === WORKSPACE_STATUS_CODES.ACTIVE;
    }

    /**
     * Creates a new workspace directory, config file, and adds it to the index.
     * @param {string} userId - The User ID of the owner.
     * @param {string} name - The desired name for the workspace.
     * @param {Object} [options={}] - Additional options for workspace config (label, color, description).
     * @returns {Promise<Object>} The index entry of the newly created workspace.
     * @throws {Error} If workspace ID/path conflict, or creation fails.
     */
    async createWorkspace(userId, name, options = {}) {
        if (!this.initialized) {
            throw new Error('WorkspaceManager not initialized');
        }

        if (!userId) { throw new Error('UserID required to create a workspace.'); }
        if (!name) { throw new Error('Workspace name required to create a workspace.'); }

        const sanitizedName = WorkspaceManager.sanitizeWorkspaceName(name);
        const workspaceId = this.#generateWorkspaceId(sanitizedName);

        let workspaceDir;
        if (options.rootPath) {
            // Support custom rootPaths
            workspaceDir = path.join(options.rootPath, sanitizedName);
            debug(`Using custom rootPath: ${workspaceDir}`);
        } else if (options.workspacePath) {
            // Support out-of-tree workspaces
            workspaceDir = options.workspacePath;
            debug(`Using provided workspacePath: ${workspaceDir}`);
        } else {
            // Defaults to user's directory
            workspaceDir = path.join(this.#rootPath, userId, WORKSPACE_DIRECTORIES.workspaces, sanitizedName);
            debug(`Using default User rootPath: ${workspaceDir}`);
        }

        const workspaceConfigPath = path.join(workspaceDir, WORKSPACE_CONFIG_FILENAME);
        debug(`Attempting to create workspace for ${userId}/${name} at path ${workspaceDir}`);

        // Check if workspace exists for this user
        const workspaces = this.getConfig('workspaces', {});
        const userWorkspaces = workspaces[userId] || [];
        if (userWorkspaces.some(ws => ws.id === workspaceId)) {
            throw new Error(`Workspace with ID "${workspaceId}" already exists for user ${userId}.`);
        }

        if (existsSync(workspaceDir)) {
            throw new Error(`Workspace directory "${workspaceDir}" already exists.`);
        }

        try {
            await fsPromises.mkdir(workspaceDir, { recursive: true });
            debug(`Created workspace directory: ${workspaceDir}`);
            await this.#createWorkspaceSubdirectories(workspaceDir);
        } catch (err) {
            logger.error(`Failed to create directory ${workspaceDir}: ${err.message}`);
            throw new Error(`Failed to create workspace directory: ${err.message}`);
        }

        // Validate color
        if (options.color && !WorkspaceManager.validateWorkspaceColor(options.color)) {
            logger.warn(`Invalid color value "${options.color}" for workspace ${name}, using a random color instead.`);
            options.color = null;
        }

        const configData = {
            ...DEFAULT_WORKSPACE_CONFIG,
            id: (options.type === 'universe' ? 'universe' : workspaceId),
            name: (options.type === 'universe' ? 'Universe' : sanitizedName),
            label: (options.type === 'universe' ? 'Universe' : options.label || name),
            description: (options.type === 'universe' ? 'And then there was geometry..' : options.description || ''),
            owner: options.owner || userId,
            color: (options.type === 'universe' ? '#000000' : options.color || WorkspaceManager.getRandomColor()),
            type: options.type || 'workspace',
            acl: options.acl || {
                "rw": [userId],
                "ro": []
            },
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
        };

        // Initialize workspace config
        const conf = new Conf({
            configName: path.basename(workspaceConfigPath, '.json'),
            cwd: workspaceDir
        });
        conf.store = configData;
        debug(`Created workspace config file: ${workspaceConfigPath}`);

        // Add to Index using the revised schema
        const indexEntry = {
            id: workspaceId,
            name: sanitizedName,
            type: configData.type,
            label: configData.label,
            description: configData.description,
            color: configData.color,
            owner: userId,
            rootPath: workspaceDir,
            configPath: workspaceConfigPath,
            status: WORKSPACE_STATUS_CODES.AVAILABLE,
            acl: configData.acl,
            created: new Date().toISOString(),
            lastAccessed: null,
        };

        // Update workspaces in the index
        workspaces[userId] = [...userWorkspaces, indexEntry];
        this.setConfig('workspaces', workspaces);

        // Emit event
        this.emit('workspace:created', { userId, workspaceId, name: sanitizedName });
        debug(`Workspace created: ${workspaceId}`);

        return indexEntry;
    }

    /**
     * Lists all workspaces for a given user.
     * @param {string} userId - The User ID to filter workspaces by.
     * @returns {Array<Object>} An array of workspace objects.
     */
    listWorkspaces(userId) {
        if (!this.initialized) {
            throw new Error('WorkspaceManager not initialized');
        }

        debug(`Listing workspaces for user ${userId}`);
        if (!userId) {
            return [];
        }

        // Get user workspaces from the workspaces index
        const workspaces = this.getConfig('workspaces', {});
        const userWorkspaces = workspaces[userId] || [];

        debug(`Found ${userWorkspaces.length} workspaces for user ${userId}`);
        return userWorkspaces;
    }

    /**
     * Gets a loaded Workspace instance from memory, loading it from disk if necessary.
     * Does NOT start the workspace services.
     * Checks for user ownership.
     * @param {string} userId - The User ID requesting the instance.
     * @param {string} workspaceId - The ID of the workspace.
     * @returns {Promise<Workspace|null>} The loaded Workspace instance, or null if not found, access denied, or load error.
     */
    async openWorkspace(userId, workspaceId) {
        const start = Date.now();

        // Handle slash-format workspaceIds
        const simplifiedId = this.#resolveWorkspaceId(userId, workspaceId);

        debug(`Opening workspace: ${userId}/${simplifiedId}`);

        if (!this.hasWorkspace(userId, simplifiedId)) {
            throw new Error(`Workspace ${simplifiedId} not found for user ${userId}`);
        }

        // Check for a user-prefixed ID like "user@example.com/my-project"
        // and extract just the workspace ID portion if present
        const canonicalId = simplifiedId;

        // Check cache using canonical ID
        const cacheKey = `${userId}/${canonicalId}`;
        if (this.#workspaces.has(cacheKey)) {
            debug(`Returning cached Workspace instance for ${cacheKey}`);
            return this.#workspaces.get(cacheKey);
        }

        // Find the workspace in the user's workspaces
        const workspaces = this.getConfig('workspaces', {});
        const userWorkspaces = workspaces[userId] || [];
        const entry = userWorkspaces.find(ws => ws.id === canonicalId);

        if (!entry) {
            logger.warn(`openWorkspace failed: Workspace ${canonicalId} not found for user ${userId}.`);
            return null;
        }

        // Check rootPath and configPath
        if (!entry.rootPath || !existsSync(entry.rootPath)) {
            logger.warn(`openWorkspace failed: Workspace ${canonicalId} rootPath is missing or does not exist: ${entry.rootPath}`);
            return null;
        }

        if (!entry.configPath || !existsSync(entry.configPath)) {
            logger.warn(`openWorkspace failed: Workspace ${canonicalId} configPath is missing or does not exist: ${entry.configPath}`);
            return null;
        }

        // Check status
        if (![WORKSPACE_STATUS_CODES.AVAILABLE, WORKSPACE_STATUS_CODES.INACTIVE, WORKSPACE_STATUS_CODES.ACTIVE].includes(entry.status)) {
            logger.warn(`openWorkspace failed: Workspace ${canonicalId} status is invalid (${entry.status}).`);
            return null;
        }

        // Load config
        let conf;
        try {
            conf = new Conf({
                configName: path.basename(entry.configPath, '.json'),
                cwd: path.dirname(entry.configPath)
            });
        } catch (err) {
            logger.error(`openWorkspace failed: Could not load config for ${canonicalId} from ${entry.configPath}: ${err.message}`);
            return null;
        }

        // Instantiate Workspace
        try {
            const workspace = new Workspace({
                rootPath: entry.rootPath,
                configStore: conf,
            });

            // Insert into cache
            this.#workspaces.set(cacheKey, workspace);
            debug(`Loaded and cached Workspace instance for ${cacheKey}`);

            // Update lastAccessed
            const now = new Date().toISOString();
            entry.lastAccessed = now;
            workspaces[userId] = userWorkspaces.map(ws =>
                ws.id === canonicalId ? entry : ws
            );
            this.setConfig('workspaces', workspaces);

            // Return instance
            return workspace;
        } catch (err) {
            logger.error(`openWorkspace failed: Could not instantiate Workspace for ${canonicalId}: ${err.message}`);
            return null;
        }
    }

    /**
     * Stops a workspace if active and removes it from the memory cache.
     * Updates the index status to INACTIVE.
     * @param {string} userId - The User ID (email) closing the workspace.
     * @param {string} workspaceId - The workspace ID (short name or canonical).
     * @returns {Promise<boolean>} True if closed/removed from cache successfully, false otherwise.
     */
    async closeWorkspace(userId, workspaceId) {
        if (!this.initialized) {
            throw new Error('WorkspaceManager not initialized');
        }

        const canonicalId = this.#resolveWorkspaceId(userId, workspaceId);
        const cacheKey = `${userId}/${canonicalId}`;

        // Check if it's even loaded
        if (!this.#workspaces.has(cacheKey)) {
            debug(`closeWorkspace: Workspace ${canonicalId} is not loaded in memory.`);
            return true; // Already closed
        }

        // Stop it first (checks access internally)
        const stopped = await this.stopWorkspace(userId, canonicalId);
        if (!stopped) {
            logger.warn(`closeWorkspace: Failed to stop workspace ${canonicalId} before closing.`);
            return false;
        }

        // Remove from cache
        const deleted = this.#workspaces.delete(cacheKey);
        if (deleted) {
            debug(`closeWorkspace: Removed workspace ${canonicalId} from memory cache.`);
            this.emit('workspace:closed', { id: canonicalId });
        }

        return deleted;
    }

    /**
     * Ensures a workspace is loaded and then starts its services (e.g., connects DB).
     * Checks for user ownership.
     * @param {string} userId - The User ID (email) starting the workspace.
     * @param {string} workspaceId - The ID of the workspace.
     * @returns {Promise<Workspace|null>} The started Workspace instance, or null on failure.
     */
    async startWorkspace(userId, workspaceId) {
        if (!this.initialized) {
            throw new Error('WorkspaceManager not initialized');
        }

        const workspace = await this.openWorkspace(userId, workspaceId);
        if (!workspace) {
            return null;
        }

        const canonicalId = workspace.id;

        // Check if already active
        if (workspace.status === WORKSPACE_STATUS_CODES.ACTIVE) {
            debug(`Workspace ${canonicalId} is already active.`);
            return workspace;
        }

        debug(`Starting workspace ${canonicalId}...`);
        try {
            await workspace.start();

            // Update status in index
            const workspaces = this.getConfig('workspaces', {});
            const userWorkspaces = workspaces[userId] || [];
            workspaces[userId] = userWorkspaces.map(ws =>
                ws.id === canonicalId ? { ...ws, status: WORKSPACE_STATUS_CODES.ACTIVE, lastAccessed: new Date().toISOString() } : ws
            );
            this.setConfig('workspaces', workspaces);

            debug(`Workspace ${canonicalId} started successfully.`);
            this.emit('workspace:started', workspace);
            return workspace;

        } catch (err) {
            logger.error(`Failed to start workspace ${canonicalId}: ${err.message}`);

            // Update status in index to ERROR
            const workspaces = this.getConfig('workspaces', {});
            const userWorkspaces = workspaces[userId] || [];
            workspaces[userId] = userWorkspaces.map(ws =>
                ws.id === canonicalId ? { ...ws, status: WORKSPACE_STATUS_CODES.ERROR } : ws
            );
            this.setConfig('workspaces', workspaces);

            this.emit('workspace:start_failed', { id: canonicalId, error: err.message });
            return null;
        }
    }

    /**
     * Stops a running workspace's services (e.g., disconnects DB).
     * Checks for user ownership.
     * Does NOT remove the workspace instance from memory cache.
     * @param {string} userId - The User ID (email) stopping the workspace.
     * @param {string} workspaceId - The ID of the workspace.
     * @returns {Promise<boolean>} True if stopped successfully or already stopped, false on failure.
     */
    async stopWorkspace(userId, workspaceId) {
        if (!this.initialized) {
            throw new Error('WorkspaceManager not initialized');
        }

        const canonicalId = this.#resolveWorkspaceId(userId, workspaceId);
        const cacheKey = `${userId}/${canonicalId}`;
        const workspace = this.#workspaces.get(cacheKey);

        if (!workspace) {
            debug(`Workspace ${canonicalId} is not loaded in memory, considered stopped.`);
            return true;
        }

        // Check current status
        if (workspace.status === WORKSPACE_STATUS_CODES.INACTIVE || workspace.status === WORKSPACE_STATUS_CODES.AVAILABLE) {
            debug(`Workspace ${canonicalId} is already stopped (status: ${workspace.status}).`);
            return true;
        }

        debug(`Stopping workspace ${canonicalId}...`);
        try {
            await workspace.stop();

            // Update status in index
            const workspaces = this.getConfig('workspaces', {});
            const userWorkspaces = workspaces[userId] || [];
            workspaces[userId] = userWorkspaces.map(ws =>
                ws.id === canonicalId ? { ...ws, status: WORKSPACE_STATUS_CODES.INACTIVE } : ws
            );
            this.setConfig('workspaces', workspaces);

            debug(`Workspace ${canonicalId} stopped successfully.`);
            this.emit('workspace:stopped', { id: canonicalId });
            return true;

        } catch (err) {
            logger.error(`Failed to stop workspace ${canonicalId}: ${err.message}`);

            // Update status in index to ERROR
            const workspaces = this.getConfig('workspaces', {});
            const userWorkspaces = workspaces[userId] || [];
            workspaces[userId] = userWorkspaces.map(ws =>
                ws.id === canonicalId ? { ...ws, status: WORKSPACE_STATUS_CODES.ERROR } : ws
            );
            this.setConfig('workspaces', workspaces);

            this.emit('workspace:stop_failed', { id: canonicalId, error: err.message });
            return false;
        }
    }

    /**
     * Checks if a workspace exists in the index and belongs to the specified user.
     * @param {string} userId - The User ID to check ownership against.
     * @param {string} workspaceId - The workspace ID (short name).
     * @returns {boolean} True if the workspace exists and the user is the owner.
     */
    hasWorkspace(userId, workspaceId) {
        try {
            // Handle slash-format workspaceIds
            const simplifiedId = this.#resolveWorkspaceId(userId, workspaceId);

            debug(`Checking if workspace exists: ${userId}/${simplifiedId}`);

            const workspaces = this.getConfig('workspaces', {});
            const userWorkspaces = workspaces[userId] || [];
            return userWorkspaces.some(ws => ws.id === simplifiedId);
        } catch (error) {
            logger.error(`Error checking workspace: ${error.message}`);
            return false;
        }
    }

    /**
     * Removes a workspace from the index and optionally deletes its data from disk.
     * Ensures the workspace is stopped first.
     * Requires ownership.
     * @param {string} userId - The User ID removing the workspace.
     * @param {string} workspaceId - The ID of the workspace to remove.
     * @param {boolean} [destroyData=false] - If true, deletes the workspace directory from disk.
     * @returns {Promise<boolean>} True if removal from index was successful, false otherwise.
     */
    async removeWorkspace(userId, workspaceId, destroyData = false) {
        // Handle slash-format workspaceIds
        const simplifiedId = this.#resolveWorkspaceId(userId, workspaceId);

        debug(`Removing workspace: ${userId}/${simplifiedId}, destroyData: ${destroyData}`);

        // Get workspaces
        const workspaces = this.getConfig('workspaces', {});
        const userWorkspaces = workspaces[userId] || [];
        const entry = userWorkspaces.find(ws => ws.id === simplifiedId);

        if (!entry) {
            logger.warn(`removeWorkspace failed: Workspace ${simplifiedId} not found for user ${userId}.`);
            return false;
        }

        // Stop Workspace (Idempotent)
        const stopped = await this.stopWorkspace(userId, simplifiedId);
        if (!stopped && this.#workspaces.has(`${userId}/${simplifiedId}`)) {
            // If stop failed AND it was actually loaded, we have a problem.
            logger.error(`removeWorkspace failed: Could not stop workspace ${simplifiedId} before removal.`);
            return false;
        }

        // Remove from Cache
        const cacheKey = `${userId}/${simplifiedId}`;
        if (this.#workspaces.has(cacheKey)) {
            this.#workspaces.delete(cacheKey);
            debug(`Removed workspace ${simplifiedId} from memory cache.`);
        }

        let workspaceDir = null;
        if (entry.rootPath) {
            workspaceDir = entry.rootPath;
        }

        // Handle Data Destruction
        let deletionError = null;
        if (destroyData && workspaceDir) {
            try {
                debug(`Destroying workspace data at ${workspaceDir}`);
                await fsPromises.rm(workspaceDir, { recursive: true, force: true });
                debug(`Workspace directory deleted: ${workspaceDir}`);
            } catch (error) {
                deletionError = error;
                logger.error(`Failed to delete workspace directory ${workspaceDir}: ${error.message}`);
                // Continue with index removal despite deletion failure
            }
        }

        // Remove from index
        workspaces[userId] = userWorkspaces.filter(ws => ws.id !== simplifiedId);
        this.setConfig('workspaces', workspaces);

        // Emit event
        this.emit('workspace:removed', {
            userId,
            workspaceId: simplifiedId,
            destroyData,
            success: true,
            error: deletionError
        });

        debug(`Workspace ${simplifiedId} removed from index for user ${userId}.`);
        return true;
    }

    /**
     * Retrieves the configuration object from a workspace's workspace.json file.
     * Checks for user ownership before loading.
     * @param {string} userId - The User ID (email) requesting the config.
     * @param {string} workspaceId - The ID of the workspace.
     * @returns {Promise<Object|null>} The workspace configuration object, or null if not found, access denied, or load error.
     */
    async getWorkspaceConfig(userId, workspaceId) {
        const canonicalId = this.#resolveWorkspaceId(userId, workspaceId);
        const entry = this.#findIndexEntry(canonicalId);

        if (!entry || !this.#checkAccess(userId, canonicalId, entry)) {
            logger.warn(`getWorkspaceConfig failed: Workspace ${canonicalId} not found or access denied for user ${userId}.`);
            return null;
        }

        if (!entry.configPath || !existsSync(entry.configPath)) {
            logger.warn(`Config file path in index for ${canonicalId} does not exist: ${entry.configPath}`);
            return null;
        }

        try {
            const conf = new Conf({
                configName: path.basename(entry.configPath, '.json'),
                cwd: path.dirname(entry.configPath)
            });
            return conf.store;
        } catch (err) {
            logger.error(`Failed to load workspace config for ${canonicalId} from ${entry.configPath}: ${err.message}`);
            return null;
        }
    }

    /**
     * Updates specific properties in a workspace's configuration file.
     * Checks for user ownership before updating.
     * @param {string} userId - The User ID (email) performing the update.
     * @param {string} workspaceId - The ID of the workspace to update.
     * @param {Object} updates - An object containing key-value pairs to update in the config.
     * @returns {Promise<boolean>} True if the update was successful, false otherwise.
     */
    async updateWorkspaceConfig(userId, workspaceId, updates) {
        const canonicalId = this.#resolveWorkspaceId(userId, workspaceId);
        const entry = this.#findIndexEntry(canonicalId);

        if (!entry || !this.#checkAccess(userId, canonicalId, entry)) {
            logger.warn(`Update config failed: Workspace ${canonicalId} not found or access denied for user ${userId}.`);
            return false;
        }

        if (!entry.configPath || !existsSync(entry.configPath)) {
            logger.warn(`Update config failed: Config file path for ${canonicalId} not found or does not exist: ${entry.configPath}`);
            return false;
        }

        const disallowedKeys = ['id', 'owner', 'created', 'updated'];
        const updateKeys = Object.keys(updates).filter(key => !disallowedKeys.includes(key));

        if (updateKeys.length === 0) {
            debug(`Update config called for ${canonicalId} with no updates provided.`);
            return true;
        }

        try {
            const conf = new Conf({
                configName: path.basename(entry.configPath, '.json'),
                cwd: path.dirname(entry.configPath)
            });

            // Apply updates
            for (const key of updateKeys) {
                conf.set(key, updates[key]);
            }

            // Update timestamp
            conf.set('updated', new Date().toISOString());

            this.emit('workspace:config:updated', { id: canonicalId, updates });
            return true;

        } catch (err) {
            logger.error(`Failed to load/update workspace config for ${canonicalId} at ${entry.configPath}: ${err.message}`);
            return false;
        }
    }

    /**
     * Sanitizes a workspace name.
     * @param {string} name - The workspace name.
     * @returns {string} The sanitized name.
     * @static
     */
    static sanitizeWorkspaceName(name) {
        if (!name) return 'untitled';
        return name.toString().toLowerCase()
            .replace(/\s+/g, '-')       // Replace spaces with hyphens
            .replace(/[^a-z0-9-@]/g, '')   // Remove non-alphanumeric characters except @ and -
            .replace(/--+/g, '-')         // Replace multiple hyphens with a single hyphen
            .replace(/^-+/, '')           // Trim hyphens from the start
            .replace(/-+$/, '');          // Trim hyphens from the end
    }

    /**
     * Get a random color for workspace
     * @returns {string} Random color
     * @static
     */
    static getRandomColor() {
        return randomcolor({
            luminosity: 'light',
            format: 'hex',
        });
    }

    /**
     * Validate workspace color
     * @param {string} color - Color to validate
     * @returns {boolean} True if color is a valid hex color, false otherwise
     * @static
     */
    static validateWorkspaceColor(color) {
        if (typeof color !== 'string') {
            debug('Workspace color must be a string');
            return false;
        }

        if (!color.match(/^#(?:[0-9a-fA-F]{3}){1,2}$/)) {
            debug('Workspace color must be a valid hex color (e.g., #RRGGBB or #RGB)');
            return false;
        }

        return true;
    }

    /**
     * Pre-creates all subdirectories defined in WORKSPACE_DIRECTORIES.
     * @param {string} workspaceDir - The workspace directory path.
     * @returns {Promise<void>}
     * @private
     */
    async #createWorkspaceSubdirectories(workspaceDir) {
        for (const subdir in WORKSPACE_DIRECTORIES) {
            const subdirPath = path.join(workspaceDir, WORKSPACE_DIRECTORIES[subdir]);
            await fsPromises.mkdir(subdirPath, { recursive: true });
            debug(`Created subdirectory: ${subdirPath}`);
        }
    }

    /**
     * Private Helper Methods
     */

    /**
     * Safely updates the global workspace index.
     * @param {function(Object): Object} updaterFn - Function that takes the current workspaces object and returns the updated one
     * @private
     */
    #updateIndex(updaterFn) {
        const currentWorkspaces = this.getConfig('workspaces', {});
        const updatedWorkspaces = updaterFn(currentWorkspaces);
        if (typeof updatedWorkspaces !== 'object') {
            logger.error('#updateIndex: Updater function did not return an object.');
            throw new Error('Internal error during index update.');
        }
        if (!this.setConfig('workspaces', updatedWorkspaces)) {
            logger.error('#updateIndex: Failed to save updated workspace index.');
            throw new Error('Failed to save workspace index changes.');
        }
        debug('Workspace index updated.');
    }

    /**
     * Finds a workspace entry in the index by its ID.
     * @param {string} workspaceId - The ID to find.
     * @returns {Object|undefined} The found workspace entry or undefined.
     * @private
     */
    #findIndexEntry(workspaceId) {
        const workspaces = this.getConfig('workspaces', {});
        for (const userWorkspaces of Object.values(workspaces)) {
            const entry = userWorkspaces.find(ws => ws.id === workspaceId);
            if (entry) return entry;
        }
        return undefined;
    }

    /**
     * Checks if a user has access to a given workspace (based on owner).
     * @param {string} userId
     * @param {string} workspaceId
     * @param {Object} [indexEntry] Optional pre-fetched index entry.
     * @returns {boolean} True if user is the owner.
     * @private
     */
    #checkAccess(userId, workspaceId, indexEntry = null) {
        if (!userId || !workspaceId) return false;

        const entry = indexEntry || this.#findIndexEntry(workspaceId);

        if (!entry) {
            debug(`Access check failed: Workspace ${workspaceId} not found in index.`);
            return false;
        }

        const hasAccess = entry.owner === userId;
        if (!hasAccess) {
            debug(`Access check failed: User ${userId} is not owner of ${workspaceId} (Owner: ${entry.owner})`);
        }
        return hasAccess;
    }

    /**
     * Performs the initial scan of workspaces listed in the index.
     * Updates statuses (NOT_FOUND, ERROR, AVAILABLE).
     * Does NOT load workspaces into memory.
     * @private
     */
    async #scanIndexedWorkspaces() {
        debug('Performing initial workspace scan...');
        const workspaces = this.getConfig('workspaces', {});
        let requiresUpdate = false;

        // Process each user's workspaces
        for (const [userId, userWorkspaces] of Object.entries(workspaces)) {
            debug(`Scanning workspaces for user ${userId}`);
            const updatedWorkspaces = [];

            for (const workspace of userWorkspaces) {
                debug(`Scanning workspace ${workspace.id}`);
                let newStatus = workspace.status;

                // Check if workspace directory exists
                if (!workspace.rootPath || !existsSync(workspace.rootPath)) {
                    debug(`Workspace path not found for ${workspace.id} at path ${workspace.rootPath}, marking as NOT_FOUND`);
                    newStatus = WORKSPACE_STATUS_CODES.NOT_FOUND;
                }
                // Check if config file exists
                else if (!workspace.configPath || !existsSync(workspace.configPath)) {
                    debug(`Workspace config not found for ${workspace.id} at path ${workspace.configPath}, marking as ERROR`);
                    newStatus = WORKSPACE_STATUS_CODES.ERROR;
                }
                // If both exist, ensure status is AVAILABLE (if not already active/inactive)
                else if (![WORKSPACE_STATUS_CODES.ACTIVE, WORKSPACE_STATUS_CODES.INACTIVE].includes(workspace.status)) {
                    newStatus = WORKSPACE_STATUS_CODES.AVAILABLE;
                }

                // Update status if changed
                if (newStatus !== workspace.status) {
                    requiresUpdate = true;
                    workspace.status = newStatus;
                    debug(`Updated status for ${workspace.id} to ${newStatus}`);
                }

                updatedWorkspaces.push(workspace);
            }

            // Update user's workspaces if any changes were made
            if (requiresUpdate) {
                workspaces[userId] = updatedWorkspaces;
            }
        }

        // Save changes if any were made
        if (requiresUpdate) {
            this.setConfig('workspaces', workspaces);
            debug('Workspace scan complete. Index updated.');
        } else {
            debug('Workspace scan complete. No changes required.');
        }
    }

    /**
     * Resolves a workspace ID to its canonical form for backward compatibility.
     * @param {string} userId - User ID.
     * @param {string} workspaceId - Original workspace ID.
     * @returns {string} Canonical ID (e.g., 'my-project').
     * @private
     */
    #resolveWorkspaceId(userId, workspaceId) {
        // Check if the workspaceId includes a slash (/) which separates userId from workspace name
        if (workspaceId.includes('/')) {
            // Split at the last slash to handle email addresses correctly
            const lastSlashIndex = workspaceId.lastIndexOf('/');
            return workspaceId.substring(lastSlashIndex + 1);
        }

        // If the workspaceId is an email-like format (has @ but no /),
        // it should not be further processed as it's already a workspaceId
        return workspaceId;
    }

    /**
     * Generates a standardized workspace ID (just the name).
     * @param {string} workspaceName - Original workspace name.
     * @returns {string} Sanitized name as ID.
     * @private
     */
    #generateWorkspaceId(workspaceName) {
        if (!workspaceName) {
            throw new Error('WorkspaceName is required to generate workspace ID');
        }
        return WorkspaceManager.sanitizeWorkspaceName(workspaceName);
    }

}

export default WorkspaceManager;
export {
    WORKSPACE_STATUS_CODES,
    WORKSPACE_DIRECTORIES,
};


