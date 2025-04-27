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
    #userManager; // Reference to the UserManager

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
        this.#userManager = options.userManager;

        // Initialize the index if needed
        if (!this.getConfig('users')) {
            this.setConfig('users', {});
        }

        debug(`Initializing WorkspaceManager with rootPath: ${this.#rootPath}`);
    }

    /**
     * Getters
     */
    get rootPath() { return this.#rootPath; }

    /**
     * Get the full list of workspaces for all users
     * @returns {Array} Array of all workspace entries
     */
    get index() {
        const users = this.getConfig('users', {});
        // Flatten all user workspaces into a single array
        return Object.values(users).reduce((allWorkspaces, userData) => {
            return allWorkspaces.concat(Object.values(userData.workspaces || {}));
        }, []);
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
        // Access is checked when loading, so just check presence in cache
        return this.#workspaces.has(canonicalId);
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
        const workspace = this.#workspaces.get(canonicalId);
        // Check cache presence AND internal status of the Workspace instance
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

        // Resolve user email if userManager is available
        let userEmail = userId;
        if (this.#userManager) {
            const user = await this.#userManager.getUser(userId);
            if (user) {
                userEmail = user.email;
            }
        }

        const sanitizedName = WorkspaceManager.sanitizeWorkspaceName(name);
        const workspaceId = this.#generateWorkspaceId(sanitizedName);

        let workspaceDir;
        if (options.rootPath) {
            // Support custom rootPaths
            workspaceDir = path.join(options.rootPath, sanitizedName);
        } else if (options.workspacePath) {
            // Support out-of-tree workspaces
            workspaceDir = options.workspacePath;
        } else {
            // Defaults to user's directory
            workspaceDir = path.join(this.#rootPath, userEmail, WORKSPACE_DIRECTORIES.workspaces, sanitizedName);
        }

        const workspaceConfigPath = path.join(workspaceDir, WORKSPACE_CONFIG_FILENAME);

        debug(`Attempting to create workspace for ${userId}/${name} at path ${workspaceDir}`);

        // Check if workspace exists for this user
        const userWorkspaces = this.getConfig(`users.${userId}.workspaces`, {});
        if (userWorkspaces[workspaceId]) {
            throw new Error(`Workspace with ID "${workspaceId}" already exists for user ${userId}.`);
        }

        if (existsSync(workspaceDir)) {
            throw new Error(`Workspace directory "${workspaceDir}" already exists.`);
        }

        try {
            await fsPromises.mkdir(workspaceDir, { recursive: true });
            debug(`Created workspace directory: ${workspaceDir}`);
            await this.#createWorkspaceSubdirectories(workspaceDir); // Pre-create all subdirectories defined in WORKSPACE_DIRECTORIES
        } catch (err) {
            logger.error(`Failed to create directory ${workspaceDir}: ${err.message}`);
            throw new Error(`Failed to create workspace directory: ${err.message}`);
        }

        const now = new Date().toISOString();
        const colorValue = options.color || WorkspaceManager.getRandomColor();

        // Validate color
        if (!WorkspaceManager.validateWorkspaceColor(colorValue)) {
            logger.warn(`Invalid color value "${colorValue}" for workspace ${name}, using a random color instead.`);
            colorValue = WorkspaceManager.getRandomColor();
        }

        const configData = {
            ...DEFAULT_WORKSPACE_CONFIG,
            id: workspaceId,
            name: sanitizedName,
            label: options.label || name,
            description: options.description || '',
            owner: userId,
            color: colorValue,
            type: options.type || 'workspace',
            created: now,
            updated: now,
        };

        try {
            const conf = new Conf({
                configName: path.basename(workspaceConfigPath, '.json'),
                cwd: workspaceDir
            });
            conf.store = configData; // Set the entire store directly
            debug(`Created workspace config file: ${workspaceConfigPath}`);
        } catch (err) {
            logger.error(`Failed to write config file ${workspaceConfigPath}: ${err.message}`);
            // Attempt cleanup: Remove directory
            await fsPromises.rm(workspaceDir, { recursive: true, force: true }).catch(cleanupErr => {
                logger.error(`Failed to cleanup directory ${workspaceDir} after config write failure: ${cleanupErr.message}`);
            });
            throw new Error(`Failed to create workspace config file: ${err.message}`);
        }

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
            created: now,
            lastAccessed: null,
        };

        // Update user workspaces in the index
        const updatedWorkspaces = { ...userWorkspaces, [workspaceId]: indexEntry };
        this.setConfig(`users.${userId}.workspaces`, updatedWorkspaces);

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

        // Get user workspaces from the revised schema
        const userWorkspaces = this.getConfig(`users.${userId}.workspaces`, {});
        const result = Object.values(userWorkspaces);

        debug(`Found ${result.length} workspaces for user ${userId}`);
        return result;
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
        const userWorkspaces = this.getConfig(`users.${userId}.workspaces`, {});
        const entry = userWorkspaces[canonicalId];

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
            userWorkspaces[canonicalId].lastAccessed = now;
            this.setConfig(`users.${userId}.workspaces`, userWorkspaces);

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

        // Create the cacheKey in the same format as openWorkspace
        const cacheKey = `${userId}/${canonicalId}`;

        // Check if it's even loaded
        if (!this.#workspaces.has(cacheKey)) {
            debug(`closeWorkspace: Workspace ${canonicalId} is not loaded in memory.`);
            // Update index status just in case? No, stopWorkspace handles that if needed.
            return true; // Already closed
        }

        // Stop it first (checks access internally)
        const stopped = await this.stopWorkspace(userId, canonicalId);
        if (!stopped) {
            logger.warn(`closeWorkspace: Failed to stop workspace ${canonicalId} before closing. Aborting close.`);
            return false;
        }

        // Remove from cache
        const deleted = this.#workspaces.delete(cacheKey);
        if (deleted) {
            debug(`closeWorkspace: Removed workspace ${canonicalId} from memory cache.`);
            this.emit('workspace:closed', { id: canonicalId });
            // Status should already be INACTIVE due to stopWorkspace call
        } else {
            // This shouldn't happen if .has(cacheKey) was true earlier
             logger.warn(`closeWorkspace: Failed to delete workspace ${canonicalId} from cache, though it was present.`);
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
            // getWorkspace logs the reason
            return null;
        }

        // Resolve potential short name to canonical ID
        // Note: getWorkspace already resolved it, but we need the ID for index updates.
        // We could potentially return the canonicalId from getWorkspace or retrieve it from workspace.id
        const canonicalId = workspace.id; // Assuming Workspace instance stores the canonical ID

        // Check internal status of the Workspace instance
        // Assuming Workspace class has a status getter like WORKSPACE_STATUS_CODES
        if (workspace.status === WORKSPACE_STATUS_CODES.ACTIVE) {
            debug(`Workspace ${canonicalId} is already active.`);
            return workspace;
        }

        debug(`Starting workspace ${canonicalId}...`);
        try {
            await workspace.start(); // Assuming workspace.start() exists and is async

            // Update status in global index
            this.#updateIndex(workspaces => workspaces.map(ws =>
                ws.id === canonicalId ? { ...ws, status: WORKSPACE_STATUS_CODES.ACTIVE, lastAccessed: new Date().toISOString() } : ws
            ));

            debug(`Workspace ${canonicalId} started successfully.`);
            this.emit('workspace:started', workspace);
            return workspace;

        } catch (err) {
            logger.error(`Failed to start workspace ${canonicalId}: ${err.message}`);

            // Update status in global index to ERROR
            this.#updateIndex(workspaces => workspaces.map(ws =>
                ws.id === canonicalId ? { ...ws, status: WORKSPACE_STATUS_CODES.ERROR } : ws
            ));

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

        // Resolve potential short name to canonical ID
        const canonicalId = this.#resolveWorkspaceId(userId, workspaceId);
        const entry = this.#findIndexEntry(canonicalId);
        if (!entry || !this.#checkAccess(userId, canonicalId, entry)) {
            logger.warn(`stopWorkspace failed: Workspace ${canonicalId} not found or access denied for user ${userId}.`);
            return false;
        }

        // Create the cache key in the same format as openWorkspace
        const cacheKey = `${userId}/${canonicalId}`;

        // Check if loaded in cache
        const workspace = this.#workspaces.get(cacheKey);
        if (!workspace) {
            debug(`Workspace ${canonicalId} is not loaded in memory, considered stopped.`);
            // Ensure index status reflects this
            if (entry.status !== WORKSPACE_STATUS_CODES.INACTIVE && entry.status !== WORKSPACE_STATUS_CODES.AVAILABLE) {
                 this.#updateIndex(workspaces => workspaces.map(ws =>
                     ws.id === canonicalId ? { ...ws, status: WORKSPACE_STATUS_CODES.INACTIVE } : ws
                 ));
            }
            return true;
        }

        // Check current status of Workspace instance
        if (workspace.status === WORKSPACE_STATUS_CODES.INACTIVE || workspace.status === WORKSPACE_STATUS_CODES.AVAILABLE) {
             debug(`Workspace ${canonicalId} is already stopped (status: ${workspace.status}).`);
             // Ensure index status reflects this
             if (entry.status !== workspace.status) {
                  this.#updateIndex(workspaces => workspaces.map(ws =>
                      ws.id === canonicalId ? { ...ws, status: workspace.status } : ws
                  ));
             }
             return true;
        }

        // Attempt to stop
        debug(`Stopping workspace ${canonicalId}...`);
        try {
            await workspace.stop();

            // Update status in global index
            this.#updateIndex(workspaces => workspaces.map(ws =>
                ws.id === canonicalId ? { ...ws, status: WORKSPACE_STATUS_CODES.INACTIVE } : ws
            ));

            debug(`Workspace ${canonicalId} stopped successfully.`);
            this.emit('workspace:stopped', { id: canonicalId });
            return true;

        } catch (err) {
            logger.error(`Failed to stop workspace ${canonicalId}: ${err.message}`);

            // Update status in global index to ERROR
            this.#updateIndex(workspaces => workspaces.map(ws =>
                ws.id === canonicalId ? { ...ws, status: WORKSPACE_STATUS_CODES.ERROR } : ws
            ));

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

            const userWorkspaces = this.getConfig(`users.${userId}.workspaces`, {});
            return !!userWorkspaces[simplifiedId];
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

        // Get user workspaces
        const userWorkspaces = this.getConfig(`users.${userId}.workspaces`, {});
        const entry = userWorkspaces[simplifiedId];

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
        const { [simplifiedId]: removed, ...remainingWorkspaces } = userWorkspaces;
        this.setConfig(`users.${userId}.workspaces`, remainingWorkspaces);

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
        // Resolve potential short name to canonical ID
        const canonicalId = this.#resolveWorkspaceId(userId, workspaceId);
        const entry = this.#findIndexEntry(canonicalId);

        if (!entry || !this.#checkAccess(userId, canonicalId, entry)) {
            // Not found or access denied
            logger.warn(`getWorkspaceConfig failed: Workspace ${canonicalId} not found or access denied for user ${userId}.`);
            return null;
        }

        // Check status? Should we allow getting config of NOT_FOUND/ERROR?
        // For now, let's allow it if the path exists in the index entry.
        if (!entry.path) {
            logger.warn(`Cannot get config for ${canonicalId}: Path missing in index entry.`);
            return null;
        }

        // Ensure the config file itself exists before trying to load
        if (!existsSync(entry.path)) {
             logger.warn(`Config file path in index for ${canonicalId} does not exist: ${entry.path}`);
             // Optionally update status in index here?
             return null;
        }

        try {
            const configDir = path.dirname(entry.path);
            const configName = path.basename(entry.path, '.json');
            const conf = new Conf({ configName, cwd: configDir });
            return conf.store; // Return the plain config object
        } catch (err) {
            logger.error(`Failed to load workspace config for ${canonicalId} from ${entry.path}: ${err.message}`);
            // TODO: Update status in index to ERROR
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

        if (!entry.path || !existsSync(entry.path)) {
             logger.warn(`Update config failed: Config file path for ${canonicalId} not found or does not exist: ${entry.path}`);
             return false;
        }

        const disallowedKeys = ['id', 'owner', 'created', 'updated']; // Cannot change these directly
        const updateKeys = Object.keys(updates);

        if (updateKeys.some(key => disallowedKeys.includes(key))) {
            logger.warn(`Update config failed: Attempted to modify disallowed key(s) (${disallowedKeys.filter(k => updateKeys.includes(k)).join(', ')}) for ${canonicalId}.`);
            return false;
        }

        if (updateKeys.length === 0) {
            debug(`Update config called for ${canonicalId} with no updates provided.`);
            return true; // Nothing to update
        }

        // TODO: Add validation for specific keys like color, label format, etc. if needed
        try {
            const configDir = path.dirname(entry.path);
            const configName = path.basename(entry.path, '.json');
            const conf = new Conf({ configName, cwd: configDir });

            // Apply updates
            for (const key in updates) {
                if (updates.hasOwnProperty(key)) {
                    conf.set(key, updates[key]);
                }
            }

            // Update timestamp
            const now = new Date().toISOString();
            conf.set('updated', now);

            // Conf saves automatically on set
            debug(`Successfully updated config for ${canonicalId}. Changed keys: ${updateKeys.join(', ')}`);

            // Update index entry's updated timestamp? No, keep index light.
            // Maybe update name in index if name changed? Let's keep it simple for now.

            this.emit('workspace:config:updated', { id: canonicalId, updates });
            return true;

        } catch (err) {
            logger.error(`Failed to load/update workspace config for ${canonicalId} at ${entry.path}: ${err.message}`);
            return false;
        }
    }

    /**
     * Private Helper Methods
     */

    /**
     * Safely updates the global workspace index array.
     * @param {function(Array<Object>): Array<Object>} updaterFn
     * @private
     */
    #updateIndex(updaterFn) {
        const currentWorkspaces = this.getConfig('workspaces', []);
        const updatedWorkspaces = updaterFn(currentWorkspaces);
        if (!Array.isArray(updatedWorkspaces)) {
            logger.error('#updateIndex: Updater function did not return an array.');
            throw new Error('Internal error during index update.');
        }
        if (!this.setConfig('workspaces', updatedWorkspaces)) {
            logger.error('#updateIndex: Failed to save updated workspace index.');
            throw new Error('Failed to save workspace index changes.');
        }
        debug('Workspace index updated.');
    }

    /**
     * Finds a workspace entry in the index array by its ID.
     * @param {string} workspaceId - The ID to find.
     * @returns {Object|undefined} The found index entry or undefined.
     * @private
     */
    #findIndexEntry(workspaceId) {
        const workspaces = this.getConfig('workspaces', []);
        return workspaces.find((ws) => ws.id === workspaceId);
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

        let requiresUpdate = false;
        const workspaces = this.getConfig('workspaces', []);
        debug(`Found ${workspaces.length} workspaces in index`);

        const updatedWorkspaces = []; // Build a new array

        for (const entry of workspaces) {
            let updatedEntry = { ...entry }; // Create a copy to modify

            if (updatedEntry.status === WORKSPACE_STATUS_CODES.REMOVED ||
                updatedEntry.status === WORKSPACE_STATUS_CODES.DESTROYED
            ) {
                debug(`Skipping removed/destroyed workspace ${JSON.stringify(updatedEntry)}`);
                updatedWorkspaces.push(updatedEntry); // Keep the original entry
                continue; // Skip to the next entry
            }

            debug(`Processing workspace ID: ${updatedEntry.id} (${updatedEntry.name})`);
            let currentStatus = updatedEntry.status;
            let newStatus = currentStatus;

            // Check if stored workspace path exists
            if (!updatedEntry.rootPath || !existsSync(updatedEntry.rootPath)) {
                debug(`Workspace path not found for ${updatedEntry.id} at path ${updatedEntry.rootPath}, marking as NOT_FOUND`);
                newStatus = WORKSPACE_STATUS_CODES.NOT_FOUND;
                // Keep the original entry if status changed
                if (newStatus !== currentStatus) {
                    requiresUpdate = true;
                    updatedEntry.status = newStatus;
                    debug(`Updated status for ${updatedEntry.id} to ${newStatus}`);
                }
                updatedWorkspaces.push(updatedEntry);
                continue; // Skip further checks for this entry
            }

            // Check if config file exists
            if (!updatedEntry.configPath || !existsSync(updatedEntry.configPath)) {
                debug(`Workspace config not found for ${updatedEntry.id} at path ${updatedEntry.configPath}, marking as ERROR`);
                newStatus = WORKSPACE_STATUS_CODES.ERROR;
                // Keep the original entry if status changed
                if (newStatus !== currentStatus) {
                    requiresUpdate = true;
                    updatedEntry.status = newStatus;
                    debug(`Updated status for ${updatedEntry.id} to ${newStatus}`);
                }
                updatedWorkspaces.push(updatedEntry);
                continue; // Skip further checks for this entry
            }

            // Attempt to open workspace to validate config and structure implicitly
            try {
                const workspace = await this.openWorkspace(updatedEntry.owner, updatedEntry.id);
                if (!workspace) {
                    debug(`Workspace ${updatedEntry.id} failed to open, marking as ERROR`);
                    newStatus = WORKSPACE_STATUS_CODES.ERROR;
                } else {
                    // If open succeeds, ensure status is AVAILABLE (if not already active/inactive)
                    if (![WORKSPACE_STATUS_CODES.ACTIVE, WORKSPACE_STATUS_CODES.INACTIVE].includes(currentStatus)) {
                        newStatus = WORKSPACE_STATUS_CODES.AVAILABLE;
                    }
                }
            } catch (err) {
                logger.error(`Error during openWorkspace validation for ${updatedEntry.id} at ${updatedEntry.configPath}: ${err.message}`);
                newStatus = WORKSPACE_STATUS_CODES.ERROR;
            }

            if (newStatus !== currentStatus) {
                requiresUpdate = true;
                updatedEntry.status = newStatus;
                debug(`Updated status for ${updatedEntry.id} to ${newStatus}`);
            }

            updatedWorkspaces.push(updatedEntry);
        }

        if (requiresUpdate) {
            debug(`Updating index with ${updatedWorkspaces.length} workspaces`);
            this.setConfig('workspaces', updatedWorkspaces); // Save the new array
            debug('Initial workspace scan complete. Index updated.');
        } else {
            debug('Initial workspace scan complete. No index changes required.');
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

}

export default WorkspaceManager;
export {
    WORKSPACE_STATUS_CODES,
    WORKSPACE_DIRECTORIES,
};


