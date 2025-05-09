'use strict';

// Utils
import randomcolor from 'randomcolor';
import path from 'path';
import * as fsPromises from 'fs/promises';
import { existsSync } from 'fs';
import EventEmitter from 'eventemitter2';
import Conf from 'conf';
// import AdmZip from 'adm-zip';

// Logging
import createDebug from 'debug';
const debug = createDebug('workspace-manager');

// Includes
import Workspace from './lib/Workspace.js';

/**
 * Constants
 */

// Workspace ID format: user.id/workspace.name
// Example: user123/my-project
// Example: user@domain.com/my-project
// We need to cleanup the whole implementation!
const WORKSPACE_CONFIG_FILENAME = 'workspace.json';

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

class WorkspaceManager extends EventEmitter {

    #defaultRootPath;   // Default Root path for all user workspaces managed by this instance (e.g., /users)
    #indexStore;        // Persistent index of all workspaces

    // Runtime
    #workspaces = new Map(); // Cache for loaded Workspace instances (key: userEmail/workspaceId -> Workspace)
    #initialized = false; // Add initialized flag

    /**
     * Constructor
     * @param {Object} options - Configuration options
     * @param {string} options.defaultRootPath - Root path where user workspace directories are stored
     * @param {Object} options.indexStore - Initialized Conf instance for the workspace index
     * @param {Object} [options.eventEmitterOptions] - Options for EventEmitter2
     */
    constructor(options = {}) {
        super(options.eventEmitterOptions || {});

        if (!options.defaultRootPath) {
            throw new Error('Workspaces defaultRootPath is required for WorkspaceManager');
        }

        if (!options.indexStore) {
            throw new Error('Index store is required for WorkspaceManager');
        }

        this.#defaultRootPath = path.resolve(options.defaultRootPath); // Ensure absolute path
        this.#indexStore = options.indexStore;

        this.#workspaces = new Map();
        debug(`Initializing WorkspaceManager with default rootPath: ${this.#defaultRootPath}`);
    }

    /**
     * Initialization
     */
    async initialize() {
        if (this.#initialized) { return true; }

        // Scan the index for all workspaces
        await this.#scanIndexedWorkspaces();

        // We are OK to go
        this.#initialized = true;
        debug(`WorkspaceManager initialized with ${this.#indexStore.size} workspace(s) in index`);

        // Return the instance
        return this;
    }

    /**
     * Public API - Workspace Lifecycle & Management
     */

    /**
     * Creates a new workspace directory, config file, and adds it to the index.
     * @param {string} userId - The identifier used for key prefix (e.g., userEmail).
     * @param {string} name - The desired name for the workspace.
     * @param {Object} options - Additional options for workspace config.
     * @param {string} options.owner - The ULID of the user who owns this workspace.
     * @param {string} [options.rootPath] - Custom root for this workspace path.
     * @param {string} [options.workspacePath] - Absolute path for out-of-tree workspace.
     * @param {string} [options.type='workspace'] - Type of workspace.
     * @returns {Promise<Object>} The index entry of the newly created workspace.
     */
    async createWorkspace(userId, name, options = {}) {
        if (!this.#initialized) throw new Error('WorkspaceManager not initialized');
        if (!userId) throw new Error('userId (e.g. userEmail) required to create a workspace.');
        if (!name) throw new Error('Workspace name required to create a workspace.');

        // Check if the user already has a universe workspace
        if (options.type === 'universe') {
            const universeWorkspaceKey = `${userId}/universe`;
            if (this.#indexStore.has(universeWorkspaceKey)) {
                throw new Error(`User ${userId} already has a universe workspace. Only one universe workspace is allowed per user.`);
            }
        }

        const sanitizedName = WorkspaceManager.sanitizeWorkspaceName(name);
        const workspaceId = (options.type === 'universe') ? 'universe' : sanitizedName;
        const workspaceKey = `${userId}/${workspaceId}`;

        // Determine workspace directory path
        const workspaceDir = options.workspacePath ||
                            (options.rootPath ? path.join(options.rootPath, sanitizedName) :
                            path.join(this.#defaultRootPath, userId, WORKSPACE_DIRECTORIES.workspaces, sanitizedName));
        debug(`Using workspace path: ${workspaceDir}`);

        // Validate and create workspace
        if (this.#indexStore.has(workspaceKey)) {
            throw new Error(`Workspace with key "${workspaceKey}" already exists.`);
        }
        if (existsSync(workspaceDir)) {
            console.warn(`Workspace directory "${workspaceDir}" already exists.`);
        }

        try {
            await fsPromises.mkdir(workspaceDir, { recursive: true });
            await this.#createWorkspaceSubdirectories(workspaceDir);
            debug(`Created workspace directory and subdirectories: ${workspaceDir}`);
        } catch (err) {
            throw new Error(`Failed to create workspace directory: ${err.message}`);
        }

        // Create workspace configuration
        const workspaceConfigPath = path.join(workspaceDir, WORKSPACE_CONFIG_FILENAME);
        const isUniverse = options.type === 'universe';
        const configData = {
            ...DEFAULT_WORKSPACE_CONFIG,
            id: workspaceId,
            name: isUniverse ? 'Universe' : sanitizedName,
            label: isUniverse ? 'Universe' : options.label || name,
            description: isUniverse ? 'And then there was geometry..' : options.description || '',
            owner: userId,
            color: isUniverse ? '#FFFFFF' : options.color || WorkspaceManager.getRandomColor(),
            type: options.type || 'workspace',
            acl: options.acl || { "rw": [userId], "ro": [] },
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
        };

        new Conf({ configName: path.basename(workspaceConfigPath, '.json'), cwd: workspaceDir }).store = configData;
        debug(`Created workspace config file: ${workspaceConfigPath}`);

        // Create index entry
        const indexEntry = { ...configData, rootPath: workspaceDir, configPath: workspaceConfigPath, status: WORKSPACE_STATUS_CODES.AVAILABLE, lastAccessed: null };
        this.#indexStore.set(workspaceKey, indexEntry);
        this.emit('workspace:created', { userId, workspaceId, name: sanitizedName, workspaceKey, workspace: indexEntry });
        debug(`Workspace created: ${workspaceKey}`);
        return indexEntry;
    }

    /**
     * Opens a workspace, loading it into memory if not already loaded.
     * @param {string} userId - The owner identifier (e.g., userEmail).
     * @param {string} workspaceId - The short ID/name of the workspace.
     * @param {string} requestingUserId - The ULID of the user making the request (for ownership check).
     * @returns {Promise<Workspace|null>} The loaded Workspace instance.
     */
    async openWorkspace(userId, workspaceId, requestingUserId) {
        if (!this.#initialized) {
            throw new Error('WorkspaceManager not initialized. Cannot open workspace.');
        }
        if (!userId || !workspaceId) {
            throw new Error('userId, workspaceId, and requestingUserId are required to open a workspace.');
        }
        // This is not the brightest idea but convenient for now
        if (!requestingUserId) {
            requestingUserId = userId;
        }

        const workspaceKey = `${userId}/${workspaceId}`;
        debug(`Opening workspace: ${workspaceKey} for requestingUser: ${requestingUserId}`);

        // Return from cache if available and owner matches
        if (this.#workspaces.has(workspaceKey)) {
            debug(`Returning cached Workspace instance for ${workspaceKey}`);
            const cachedWs = this.#workspaces.get(workspaceKey);
            if (cachedWs.owner !== requestingUserId) {
                console.error(`Ownership mismatch for cached workspace ${workspaceKey}. Owner: ${cachedWs.owner}, Requester: ${requestingUserId}`);
                return null;
            }
            return cachedWs;
        }

        // Load from index
        const entry = this.#indexStore.get(workspaceKey);
        if (!this.#validateWorkspaceEntryForOpen(entry, workspaceKey, requestingUserId)) {
            return null; // Validation failed, details logged in helper
        }

        try {
            const conf = new Conf({
                configName: path.basename(entry.configPath, '.json'),
                cwd: path.dirname(entry.configPath)
            });

            const workspace = new Workspace({
                rootPath: entry.rootPath,
                configStore: conf,
            });

            this.#workspaces.set(workspaceKey, workspace);
            debug(`Loaded and cached Workspace instance for ${workspaceKey}`);
            this.#updateWorkspaceIndexEntry(workspaceKey, { lastAccessed: new Date().toISOString() });
            return workspace;
        } catch (err) {
            console.error(`openWorkspace failed: Could not load config or instantiate Workspace for ${workspaceKey}: ${err.message}`);
            return null;
        }
    }

    /**
     * Closes a workspace, removing it from the memory cache after stopping it.
     * @param {string} userId - The owner identifier.
     * @param {string} workspaceId - The workspace ID.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @returns {Promise<boolean>} True if closed or not loaded, false on failure to stop.
     */
    async closeWorkspace(userId, workspaceId, requestingUserId) {
        if (!this.#initialized) throw new Error('WorkspaceManager not initialized');
        this.#ensureRequiredParams({ userId, workspaceId, requestingUserId }, 'closeWorkspace');

        const workspaceKey = `${userId}/${workspaceId}`;

        if (!this.#workspaces.has(workspaceKey)) {
            debug(`closeWorkspace: Workspace ${workspaceKey} is not loaded in memory.`);
            return true;
        }

        const stopped = await this.stopWorkspace(userId, workspaceId, requestingUserId);
        if (!stopped) {
            // stopWorkspace logs details, but we might want to indicate failure here too
            console.warn(`closeWorkspace: Failed to stop workspace ${workspaceKey} before closing. It might still be in memory.`);
            // Depending on desired behavior, we might not delete from cache if stop failed.
            // For now, we proceed with deletion from cache.
        }

        const deleted = this.#workspaces.delete(workspaceKey);
        if (deleted) {
            debug(`closeWorkspace: Removed workspace ${workspaceKey} from memory cache.`);
            this.emit('workspace:closed', { workspaceKey, userId, workspaceId });
        }
        return deleted; // Or perhaps return `stopped && deleted`
    }

    /**
     * Starts an opened workspace.
     * @param {string} userId - The owner identifier.
     * @param {string} workspaceId - The workspace ID.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @returns {Promise<Workspace|null>} The started Workspace instance or null on failure.
     */
    async startWorkspace(userId, workspaceId, requestingUserId) {
        if (!this.#initialized) throw new Error('WorkspaceManager not initialized');
        if (!requestingUserId) {
            requestingUserId = userId;
        }
        this.#ensureRequiredParams({ userId, workspaceId, requestingUserId }, 'startWorkspace');

        const workspaceKey = `${userId}/${workspaceId}`;
        let workspace = this.#workspaces.get(workspaceKey);

        // If workspace is not in memory, try to load it
        if (!workspace) {
            workspace = await this.openWorkspace(userId, workspaceId, requestingUserId);
            if (!workspace) {
                debug(`startWorkspace: Could not open workspace ${userId}/${workspaceId}.`);
                return null;
            }
        }

        if (workspace.status === WORKSPACE_STATUS_CODES.ACTIVE) {
            debug(`Workspace ${workspaceKey} is already active.`);
            return workspace;
        }

        debug(`Starting workspace ${workspaceKey}...`);
        try {
            await workspace.start();
            this.#updateWorkspaceIndexEntry(workspaceKey, { status: WORKSPACE_STATUS_CODES.ACTIVE, lastAccessed: new Date().toISOString() });
            debug(`Workspace ${workspaceKey} started successfully.`);
            this.emit('workspace:started', { workspaceKey, workspace: workspace.toJSON() });
            return workspace;
        } catch (err) {
            console.error(`Failed to start workspace ${workspaceKey}: ${err.message}`);
            this.#updateWorkspaceIndexEntry(workspaceKey, { status: WORKSPACE_STATUS_CODES.ERROR });
            this.emit('workspace:start_failed', { workspaceKey, error: err.message });
            return null;
        }
    }

    /**
     * Stops a loaded and active workspace.
     * @param {string} userId - The owner identifier.
     * @param {string} workspaceId - The workspace ID.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @returns {Promise<boolean>} True if stopped or already inactive/not loaded, false on failure.
     */
    async stopWorkspace(userId, workspaceId, requestingUserId) {
        if (!this.#initialized) throw Error('WorkspaceManager not initialized');
        if (!requestingUserId) {
            requestingUserId = userId;
        }
        this.#ensureRequiredParams({ userId, workspaceId, requestingUserId }, 'stopWorkspace');

        const workspaceKey = `${userId}/${workspaceId}`;
        const workspace = this.#workspaces.get(workspaceKey);

        if (!workspace) {
            debug(`Workspace ${workspaceKey} is not loaded in memory, considered stopped.`);
            // Potentially update index if it was marked ACTIVE but not in memory (e.g. after a crash)
            const entry = this.#indexStore.get(workspaceKey);
            if (entry && entry.owner === requestingUserId && entry.status === WORKSPACE_STATUS_CODES.ACTIVE) {
                this.#updateWorkspaceIndexEntry(workspaceKey, { status: WORKSPACE_STATUS_CODES.INACTIVE });
                debug(`Marked workspace ${workspaceKey} (not in memory) as INACTIVE in index.`);
            }
            return true;
        }

        if (workspace.owner !== requestingUserId) {
            console.error(`stopWorkspace: User ${requestingUserId} not owner of ${workspaceKey}. Workspace owner: ${workspace.owner}`);
            return false;
        }

        if ([WORKSPACE_STATUS_CODES.INACTIVE, WORKSPACE_STATUS_CODES.AVAILABLE].includes(workspace.status)) {
            debug(`Workspace ${workspaceKey} is already stopped (status: ${workspace.status}).`);
            return true;
        }

        debug(`Stopping workspace ${workspaceKey}...`);
        try {
            await workspace.stop();
            this.#updateWorkspaceIndexEntry(workspaceKey, { status: WORKSPACE_STATUS_CODES.INACTIVE }, requestingUserId);
            debug(`Workspace ${workspaceKey} stopped successfully.`);
            this.emit('workspace:stopped', { workspaceKey });
            return true;
        } catch (err) {
            console.error(`Failed to stop workspace ${workspaceKey}: ${err.message}`);
            this.#updateWorkspaceIndexEntry(workspaceKey, { status: WORKSPACE_STATUS_CODES.ERROR }, requestingUserId);
            this.emit('workspace:stop_failed', { workspaceKey, error: err.message });
            return false;
        }
    }

    /**
     * Removes a workspace from the index and optionally deletes its data.
     * @param {string} userId - The owner identifier.
     * @param {string} workspaceId - The workspace ID.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @param {boolean} [destroyData=false] - Whether to delete the workspace directory.
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async removeWorkspace(userId, workspaceId, requestingUserId, destroyData = false) {
        if (!this.#initialized) throw new Error('WorkspaceManager not initialized');
        if (!requestingUserId) {
            requestingUserId = userId;
        }
        this.#ensureRequiredParams({ userId, workspaceId, requestingUserId }, 'removeWorkspace');

        const workspaceKey = `${userId}/${workspaceId}`;
        debug(`Removing workspace: ${workspaceKey}, destroyData: ${destroyData}, requested by ${requestingUserId}`);

        // Prevent removal of universe workspace
        if (this.#isUniverseWorkspace(workspaceKey)) {
            throw new Error('Cannot remove the universe workspace');
        }

        const entry = this.#indexStore.get(workspaceKey);
        if (!entry) {
            console.warn(`removeWorkspace failed: Workspace ${workspaceKey} not found in index.`);
            return false;
        }
        if (entry.owner !== requestingUserId) {
            console.error(`removeWorkspace failed: User ${requestingUserId} is not the owner of ${workspaceKey}. Owner: ${entry.owner}`);
            return false;
        }

        // Attempt to stop and remove from cache first
        if (this.#workspaces.has(workspaceKey)) {
            const stopped = await this.stopWorkspace(userId, workspaceId, requestingUserId);
            if (!stopped) {
                console.error(`removeWorkspace: Could not stop workspace ${workspaceKey} before removal. Proceeding with index removal.`);
                // Decide if we should abort or continue. For now, continue.
            }
            this.#workspaces.delete(workspaceKey);
            debug(`Removed workspace ${workspaceKey} from memory cache during removal process.`);
        }

        let deletionError = null;
        if (destroyData && entry.rootPath) {
            try {
                debug(`Destroying workspace data at ${entry.rootPath}`);
                if (existsSync(entry.rootPath)) {
                    await fsPromises.rm(entry.rootPath, { recursive: true, force: true });
                    debug(`Workspace directory deleted: ${entry.rootPath}`);
                } else {
                    debug(`Workspace directory ${entry.rootPath} not found for destruction.`);
                }
            } catch (error) {
                deletionError = error;
                console.error(`Failed to delete workspace directory ${entry.rootPath}: ${error.message}`);
                // Do not re-throw yet, ensure index is cleaned up.
            }
        }

        this.#indexStore.delete(workspaceKey);
        this.emit('workspace:removed', {
            userId,
            workspaceId,
            workspaceKey,
            requestingUserId,
            destroyData,
            success: !deletionError, // Success is true if data destruction didn't fail (or wasn't attempted)
            error: deletionError ? deletionError.message : null
        });
        debug(`Workspace ${workspaceKey} removed from index for owner ${userId}.`);
        return !deletionError; // Return based on data destruction outcome if attempted
    }

    /**
     * Public API - Workspace Information & Configuration
     */

    /**
     * Checks if a workspace instance is currently loaded in memory.
     * @param {string} ownerId - The owner identifier (e.g., userEmail) used for key construction.
     * @param {string} workspaceId - The workspace ID (short name).
     * @param {string} requestingUserId - The ULID of the user making the request (for ownership check).
     * @returns {Promise<boolean>} True if the workspace instance is in the memory cache and owned by the requesting user.
     */
    async isOpen(ownerId, workspaceId, requestingUserId) {
        if (!requestingUserId) {
            requestingUserId = userId;
        }
        this.#ensureRequiredParams({ ownerId, workspaceId, requestingUserId }, 'isOpen');
        const workspaceKey = `${ownerId}/${workspaceId}`;
        const ws = this.#workspaces.get(workspaceKey);
        return !!ws && ws.owner === requestingUserId; // Check against the stored ULID owner
    }

    /**
     * Checks if a workspace instance is currently loaded AND active (started).
     * @param {string} ownerId - The owner identifier (e.g., userEmail) used for key construction.
     * @param {string} workspaceId - The workspace ID (short name).
     * @param {string} requestingUserId - The ULID of the user making the request (for ownership check).
     * @returns {Promise<boolean>} True if the workspace instance is in cache, active, and owned by the user.
     */
    async isActive(ownerId, workspaceId, requestingUserId) {
        if (!requestingUserId) {
            requestingUserId = userId;
        }
        this.#ensureRequiredParams({ ownerId, workspaceId, requestingUserId }, 'isActive');
        const workspaceKey = `${ownerId}/${workspaceId}`;
        const workspace = this.#workspaces.get(workspaceKey);
        return !!workspace && workspace.owner === requestingUserId && workspace.status === WORKSPACE_STATUS_CODES.ACTIVE;
    }

    /**
     * Lists all workspaces for a given userId (e.g., userEmail).
     * @param {string} userId - The owner identifier (e.g., userEmail) used for key prefixing.
     * @returns {Promise<Array<Object>>} An array of workspace index entry objects.
     */
    async listUserWorkspaces(userId) {
        if (!this.#initialized) throw new Error('WorkspaceManager not initialized');
        if (!userId) return [];

        const prefix = `${userId}/`;
        debug(`Listing workspaces for userId ${userId}`);

        const allWorkspaces = this.#indexStore.store;
        const userWorkspaceEntries = [];
        // Assuming accessPropertiesByDotNotation is false, keys are literal.
        // If it were true, iterating `allWorkspaces` and checking prefix would be fine.
        // With it false, this direct check is also fine.
        for (const key in allWorkspaces) {
            if (key.startsWith(prefix)) {
                // We also need to ensure the value is a valid workspace entry, not some other data
                // if the indexStore is shared or has a flat structure with non-workspace items.
                // For now, assume all keys starting with prefix are workspace entries.
                if (allWorkspaces[key] && typeof allWorkspaces[key] === 'object' && allWorkspaces[key].id) {
                    userWorkspaceEntries.push(allWorkspaces[key]);
                }
            }
        }
        debug(`Found ${userWorkspaceEntries.length} workspaces for userId ${userId}`);
        return userWorkspaceEntries;
    }

    /**
     * Gets a loaded Workspace instance from memory. Alias for openWorkspace.
     * @param {string} userId - The owner identifier.
     * @param {string} workspaceId - The workspace ID.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @returns {Promise<Workspace|null>} The loaded Workspace instance.
     */
    async getWorkspace(userId, workspaceId, requestingUserId) {
        // This is a convenience method, we gonna refactor it eventually
        // No try..catch here as both implementations throw like crazy :)
        const workspace = await this.openWorkspace(userId, workspaceId, requestingUserId);
        if (!workspace) {
            debug(`getWorkspace failed: Could not open workspace ${userId}/${workspaceId}.`);
            return null;
        }

        // Lets try to start that thing
        await this.startWorkspace(userId, workspaceId, requestingUserId);
        return workspace;
    }

    /**
     * Checks if a workspace exists in the index for the given owner and user.
     * @param {string} userId - The owner identifier.
     * @param {string} workspaceId - The workspace ID.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @returns {Promise<boolean>} True if the workspace exists and is owned by the user.
     */
    async hasWorkspace(userId, workspaceId, requestingUserId) {
        if (!this.#initialized) { throw new Error('WorkspaceManager not initialized'); }
        if (!requestingUserId) {
            requestingUserId = userId;
        }
        this.#ensureRequiredParams({ userId, workspaceId, requestingUserId }, 'hasWorkspace', false); // Allow missing requestingUserId for a general check if needed, but enforce for ownership check

        try {
            const workspaceKey = `${userId}/${workspaceId}`;
            debug(`Checking if workspace exists: ${workspaceKey} for user ${requestingUserId}`);
            const entry = this.#indexStore.get(workspaceKey);
            return !!entry && (!requestingUserId || entry.owner === requestingUserId); // If requestingUserId is provided, check ownership
        } catch (error) {
            console.error(`Error checking workspace: ${error.message}`);
            return false;
        }
    }

    /**
     * Retrieves the configuration object for a workspace from its config file.
     * @param {string} userId - The owner identifier.
     * @param {string} workspaceId - The workspace ID.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @returns {Promise<Object|null>} The workspace configuration object or null.
     */
    async getWorkspaceConfig(userId, workspaceId, requestingUserId) {
        if (!this.#initialized) { throw new Error('WorkspaceManager not initialized'); }
        if (!requestingUserId) {
            requestingUserId = userId;
        }
        this.#ensureRequiredParams({ userId, workspaceId, requestingUserId }, 'getWorkspaceConfig');

        const workspaceKey = `${userId}/${workspaceId}`;
        const entry = this.#indexStore.get(workspaceKey);

        if (!entry) {
            console.warn(`getWorkspaceConfig failed: Workspace ${workspaceKey} not found in index.`);
            return null;
        }
        if (entry.owner !== requestingUserId) {
             console.warn(`getWorkspaceConfig failed: User ${requestingUserId} not owner of ${workspaceKey}.`);
             return null;
        }
        if (!entry.configPath || !existsSync(entry.configPath)) {
            console.warn(`Config file path in index for ${workspaceKey} does not exist: ${entry.configPath}`);
            return null;
        }
        try {
            const conf = new Conf({
                configName: path.basename(entry.configPath, '.json'),
                cwd: path.dirname(entry.configPath)
            });
            return conf.store;
        } catch (err) {
            console.error(`Failed to load workspace config for ${workspaceKey} from ${entry.configPath}: ${err.message}`);
            return null;
        }
    }

    /**
     * Updates the configuration file of a workspace and its index entry.
     * @param {string} userId - The owner identifier.
     * @param {string} workspaceId - The workspace ID.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @param {Object} updates - An object containing keys and values to update.
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async updateWorkspaceConfig(userId, workspaceId, requestingUserId, updates) {
        if (!this.#initialized) { throw new Error('WorkspaceManager not initialized'); }
        if (!requestingUserId) {
            requestingUserId = userId;
        }
        this.#ensureRequiredParams({ userId, workspaceId, requestingUserId, updates }, 'updateWorkspaceConfig');

        const workspaceKey = `${userId}/${workspaceId}`;
        const entry = this.#indexStore.get(workspaceKey);

        if (!entry) {
            console.warn(`Update config failed: Workspace ${workspaceKey} not found in index.`);
            return false;
        }
        if (entry.owner !== requestingUserId) {
            console.warn(`Update config failed: User ${requestingUserId} not owner of ${workspaceKey}.`);
            return false;
        }
        if (!entry.configPath || !existsSync(entry.configPath)) {
            console.warn(`Update config failed: Config file path for ${workspaceKey} not found or does not exist: ${entry.configPath}`);
            return false;
        }

        const disallowedKeys = ['id', 'owner', 'userId', 'created', 'rootPath', 'configPath', 'type']; // type should be immutable after creation ideally
        const validUpdates = {};
        let hasValidUpdates = false;
        for (const key in updates) {
            if (!disallowedKeys.includes(key)) {
                validUpdates[key] = updates[key];
                hasValidUpdates = true;
            } else {
                console.warn(`Update config for ${workspaceKey}: Disallowed key "${key}" was ignored.`);
            }
        }

        if (!hasValidUpdates) {
            debug(`Update config called for ${workspaceKey} with no valid updates provided.`);
            return true; // No valid updates, but not an error.
        }

        try {
            const conf = new Conf({
                configName: path.basename(entry.configPath, '.json'),
                cwd: path.dirname(entry.configPath)
            });

            let changed = false;
            for (const key in validUpdates) {
                // Special handling for color validation if it's being updated
                if (key === 'color' && !WorkspaceManager.validateWorkspaceColor(validUpdates[key])) {
                    console.warn(`Invalid color "${validUpdates[key]}" for workspace ${workspaceKey} during update. Ignoring color update.`);
                    continue; // Skip this update
                }
                if (conf.get(key) !== validUpdates[key]) {
                    conf.set(key, validUpdates[key]);
                    changed = true;
                }
            }

            if (changed) {
                conf.set('updated', new Date().toISOString());

                // Update relevant fields in the index entry
                const indexUpdates = { lastAccessed: new Date().toISOString() };
                if (validUpdates.label !== undefined) indexUpdates.label = validUpdates.label;
                if (validUpdates.color !== undefined && WorkspaceManager.validateWorkspaceColor(validUpdates.color)) indexUpdates.color = validUpdates.color;
                if (validUpdates.description !== undefined) indexUpdates.description = validUpdates.description;
                if (validUpdates.acl !== undefined) indexUpdates.acl = validUpdates.acl; // Assuming ACL structure is validated elsewhere or trusted

                this.#updateWorkspaceIndexEntry(workspaceKey, indexUpdates);
                this.emit('workspace:config:updated', { workspaceKey, updates: validUpdates });
                debug(`Workspace config updated for ${workspaceKey}`);
            }
            return true;
        } catch (err) {
            console.error(`Failed to load/update workspace config for ${workspaceKey} at ${entry.configPath}: ${err.message}`);
            return false;
        }
    }

    /**
     * Static Utility Methods
     */

    /**
     * Sanitizes a workspace name.
     * @param {string} name - The workspace name.
     * @returns {string} The sanitized name.
     * @static
     */
    static sanitizeWorkspaceName(name) {
        if (!name) return 'untitled';
        return name.toString().toLowerCase()
            .replace(/\s+/g, '-')           // Replace spaces with hyphens
            .replace(/[^a-z0-9-]/g, '')    // Remove characters not a-z, 0-9, or hyphen
            .replace(/--+/g, '-')          // Replace multiple hyphens with single
            .replace(/^-+/, '')             // Trim hyphens from start
            .replace(/-+$/, '');            // Trim hyphens from end
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
        // Basic hex color regex (allows #rgb, #rrggbb, #rgba, #rrggbbaa)
        // For this context, let's stick to #rgb or #rrggbb
        if (!color.match(/^#(?:[0-9a-fA-F]{3}){1,2}$/)) {
            debug(`Workspace color must be a valid hex color (e.g., #RRGGBB or #RGB). Received: ${color}`);
            return false;
        }
        return true;
    }

    /**
     * Private Helper Methods
     */

    /**
     * Pre-creates all subdirectories defined in WORKSPACE_DIRECTORIES.
     * @param {string} workspaceDir - The workspace directory path.
     * @returns {Promise<void>}
     * @private
     */
    async #createWorkspaceSubdirectories(workspaceDir) {
        debug(`Creating subdirectories for workspace at ${workspaceDir}`);
        for (const subdirKey in WORKSPACE_DIRECTORIES) {
            // Avoid creating 'workspaces' subdir inside a workspace dir itself.
            if (subdirKey === 'workspaces') continue;

            const subdirPath = path.join(workspaceDir, WORKSPACE_DIRECTORIES[subdirKey]);
            try {
                await fsPromises.mkdir(subdirPath, { recursive: true });
                debug(`Created subdirectory: ${subdirPath}`);
            } catch (err) {
                // Log error but don't necessarily fail the whole workspace creation
                console.error(`Failed to create subdirectory ${subdirPath}: ${err.message}`);
            }
        }
    }

    /**
     * Performs the initial scan of workspaces listed in the index.
     * Updates statuses (NOT_FOUND, ERROR, AVAILABLE).
     * Does NOT load workspaces into memory.
     * @private
     */
    async #scanIndexedWorkspaces() {
        debug('Performing initial workspace scan...');
        const allWorkspaces = this.#indexStore.store;
        let requiresSave = false; // To track if any changes were made to the index

        for (const workspaceKey in allWorkspaces) {
            const workspaceEntry = allWorkspaces[workspaceKey];
            // Basic validation of the entry structure
            if (!workspaceEntry || typeof workspaceEntry !== 'object' || !workspaceEntry.id) {
                debug(`Skipping invalid or incomplete workspace entry for key: ${workspaceKey}`);
                continue;
            }

            debug(`Scanning workspace ${workspaceKey} (ID: ${workspaceEntry.id}, Owner: ${workspaceEntry.owner})`);
            let currentStatus = workspaceEntry.status;
            let newStatus = currentStatus;

            // Skip already processed states unless we need to re-validate
            if ([WORKSPACE_STATUS_CODES.REMOVED, WORKSPACE_STATUS_CODES.DESTROYED].includes(currentStatus)) {
                debug(`Workspace ${workspaceKey} is in status ${currentStatus}, skipping.`);
                continue;
            }

            if (!workspaceEntry.rootPath || !existsSync(workspaceEntry.rootPath)) {
                debug(`Workspace path not found for ${workspaceKey} at path ${workspaceEntry.rootPath}, marking as NOT_FOUND`);
                newStatus = WORKSPACE_STATUS_CODES.NOT_FOUND;
            } else if (!workspaceEntry.configPath || !existsSync(workspaceEntry.configPath)) {
                debug(`Workspace config not found for ${workspaceKey} at path ${workspaceEntry.configPath}, marking as ERROR`);
                newStatus = WORKSPACE_STATUS_CODES.ERROR;
            } else if (![WORKSPACE_STATUS_CODES.ACTIVE, WORKSPACE_STATUS_CODES.INACTIVE, WORKSPACE_STATUS_CODES.ERROR, WORKSPACE_STATUS_CODES.NOT_FOUND].includes(currentStatus)) {
                // If it's not in a definitive error/active/inactive state, mark as available (implies it passed path checks)
                newStatus = WORKSPACE_STATUS_CODES.AVAILABLE;
            } else if (newStatus === WORKSPACE_STATUS_CODES.ERROR && existsSync(workspaceEntry.rootPath) && existsSync(workspaceEntry.configPath)){
                // If it was in ERROR but paths are now fine, it could become AVAILABLE (unless it's meant to be ACTIVE/INACTIVE)
                 if (![WORKSPACE_STATUS_CODES.ACTIVE, WORKSPACE_STATUS_CODES.INACTIVE].includes(workspaceEntry.status)) {
                    newStatus = WORKSPACE_STATUS_CODES.AVAILABLE;
                 }
            }


            if (newStatus !== currentStatus) {
                this.#updateWorkspaceIndexEntry(workspaceKey, { status: newStatus });
                requiresSave = true; // Conf usually saves on set, but this flag is for conceptual grouping.
                debug(`Updated status for ${workspaceKey} from ${currentStatus} to ${newStatus}`);
            }
        }

        if (requiresSave) {
             debug('Workspace scan complete. Index potentially updated.');
        } else {
            debug('Workspace scan complete. No changes required to the index.');
        }
    }

    /**
     * Validates a workspace index entry for opening.
     * @param {Object} entry - The workspace index entry.
     * @param {string} workspaceKey - The key for the workspace.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @returns {boolean} True if valid, false otherwise.
     * @private
     */
    #validateWorkspaceEntryForOpen(entry, workspaceKey, requestingUserId) {
        if (!entry) {
            debug(`openWorkspace failed: Workspace ${workspaceKey} not found in index.`);
            return false;
        }
        if (entry.owner !== requestingUserId) {
            console.warn(`openWorkspace failed: User ${requestingUserId} is not the owner of workspace ${workspaceKey}. Stored owner: ${entry.owner}`);
            return false;
        }
        if (!entry.rootPath || !existsSync(entry.rootPath)) {
            console.warn(`openWorkspace failed: Workspace ${workspaceKey} rootPath is missing or does not exist: ${entry.rootPath}`);
            this.#updateWorkspaceIndexEntry(workspaceKey, { status: WORKSPACE_STATUS_CODES.NOT_FOUND });
            return false;
        }
        if (!entry.configPath || !existsSync(entry.configPath)) {
            console.warn(`openWorkspace failed: Workspace ${workspaceKey} configPath is missing or does not exist: ${entry.configPath}`);
            this.#updateWorkspaceIndexEntry(workspaceKey, { status: WORKSPACE_STATUS_CODES.ERROR });
            return false;
        }
        const validOpenStatuses = [
            WORKSPACE_STATUS_CODES.AVAILABLE,
            WORKSPACE_STATUS_CODES.INACTIVE,
            WORKSPACE_STATUS_CODES.ACTIVE, // Can re-open an active one (returns from cache or re-validates)
            // WORKSPACE_STATUS_CODES.ERROR, // Should we allow opening an errored workspace? Perhaps if paths are now valid.
        ];
        if (!validOpenStatuses.includes(entry.status)) {
            console.warn(`openWorkspace failed: Workspace ${workspaceKey} status is invalid (${entry.status}). Must be one of: ${validOpenStatuses.join(', ')}.`);
            // Don't change status here, as it might be a temporary issue or a state we don't want to override.
            return false;
        }
        return true;
    }

    /**
     * Helper to update a workspace's entry in the index store.
     * Ensures owner check if requestingUserId is provided for sensitive updates.
     * @param {string} workspaceKey - The key of the workspace in the index.
     * @param {Object} updates - Key-value pairs to update in the index entry.
     * @param {string} [requestingUserId] - Optional. If provided, validates ownership before certain updates.
     * @private
     */
    #updateWorkspaceIndexEntry(workspaceKey, updates, requestingUserId = null) {
        const currentEntry = this.#indexStore.get(workspaceKey);
        if (!currentEntry) {
            debug(`Cannot update index for ${workspaceKey}: entry not found.`);
            return;
        }

        // If requestingUserId is provided (typically for status changes like stop/start),
        // ensure the action is performed by the owner.
        if (requestingUserId && currentEntry.owner !== requestingUserId) {
            console.error(`Index update for ${workspaceKey} denied: User ${requestingUserId} is not the owner. Owner: ${currentEntry.owner}`);
            return;
        }

        const updatedEntry = { ...currentEntry, ...updates, updated: new Date().toISOString() };
        this.#indexStore.set(workspaceKey, updatedEntry);
        debug(`Updated index entry for ${workspaceKey} with: ${JSON.stringify(updates)}`);
    }

    /**
     * Ensures that all required parameters are provided for a method.
     * @param {Object} params - An object where keys are param names and values are their values.
     * @param {string} methodName - The name of the method calling this helper (for error messages).
     * @param {boolean} [allRequired=true] - Whether all params in the object are required.
     * @throws {Error} if any required parameter is missing.
     * @private
     */
    #ensureRequiredParams(params, methodName, allRequired = true) {
        for (const paramName in params) {
            const value = params[paramName];
            if (allRequired || value !== undefined) { // If not allRequired, only check if value is explicitly undefined
                 if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
                    if (paramName === 'updates' && typeof value === 'object' && Object.keys(value).length > 0) continue; // Allow empty updates object if not strictly required
                    throw new Error(`${methodName} requires ${paramName}.`);
                }
            }
        }
    }

    #validateWorkspaceConfig(config) {
        if (!config) {
            throw new Error('Workspace config is required');
        }

        if (!config.id) {
            throw new Error('Workspace config must have an id.');
        }

        if (config.color && !WorkspaceManager.validateWorkspaceColor(config.color)) {
            console.warn(`Invalid color value "${config.color}" for workspace ${config.id}.`);
        }

    }

    /**
     * Checks if a workspace is the universe workspace
     * @param {string} workspaceKey - The workspace key to check
     * @returns {boolean} True if the workspace is the universe workspace
     * @private
     */
    #isUniverseWorkspace(workspaceKey) {
        const entry = this.#indexStore.get(workspaceKey);
        return entry && entry.type === 'universe';
    }
}

export default WorkspaceManager;
export {
    WORKSPACE_STATUS_CODES,
    WORKSPACE_DIRECTORIES,
};


