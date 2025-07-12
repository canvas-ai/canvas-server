'use strict';

// Utils
import randomcolor from 'randomcolor';
import path from 'path';
import * as fsPromises from 'fs/promises';
import { existsSync } from 'fs';
import EventEmitter from 'eventemitter2';
import Conf from 'conf';
import { generateNanoid } from '../../utils/id.js';
// import AdmZip from 'adm-zip';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('workspace-manager');

// Includes
import Workspace from './lib/Workspace.js';

/**
 * Constants
 */

// Workspace ID format: user.id/workspace.id
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
    agents: 'Agents',
    minions: 'Minions',
    roles: 'Roles',
    dotfiles: 'Dotfiles',
    workspaces: 'Workspaces',
};

const WORKSPACE_STATUS_CODES = {
    AVAILABLE: 'available', // Workspace dir exists, config readable
    NOT_FOUND: 'not_found', // Workspace dir/config specified in index not found
    ERROR: 'error', // Config invalid, FS issues, etc.
    ACTIVE: 'active', // Workspace is loaded and started (db connected)
    INACTIVE: 'inactive', // Workspace is loaded but not started
    REMOVED: 'removed', // Marked for removal, ignored on scan
    DESTROYED: 'destroyed', // Workspace dir deleted by user
};

// Default configuration template for a new workspace's workspace.json
// Using token-based ACLs for portable workspace sharing
const DEFAULT_WORKSPACE_CONFIG = {
    id: null, // Set to 12-char nanoid (opaque identifier)
    name: null, // User-defined slug-like name
    owner: null, // User ID (email)
    type: 'workspace', // "workspace" or "universe" (user home directory)
    label: 'Workspace',
    color: null,
    description: '',
    acl: {
        tokens: {} // Token-based ACL: { "sha256:hash": { permissions: [], description: "", createdAt: "", expiresAt: null } }
    },
    created: null,
    updated: null,
};

/**
 * Workspace Manager (Simplified)
 */

class WorkspaceManager extends EventEmitter {

    #defaultRootPath;   // Default Root path for all user workspaces managed by this instance (e.g., /users)
    #indexStore;        // Persistent index of all workspaces (key: workspace.id -> workspace data)
    #nameIndex;         // Secondary index for name lookups (key: userId/workspaceName -> workspace.id)

    // Runtime
    #workspaces = new Map(); // Cache for loaded Workspace instances (key: workspace.id -> Workspace)
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
        this.#nameIndex = new Map(); // In-memory secondary index for name lookups

        debug(`Initializing WorkspaceManager with default rootPath: ${this.#defaultRootPath}`);
    }

    /**
     * Initialization
     */
    async initialize() {
        if (this.#initialized) { return true; }

        // Rebuild name index from existing workspaces
        await this.#rebuildNameIndex();

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
     * @param {string} userId - The identifier used for key prefix
     * @param {string} workspaceName - The desired workspace name (slug-like identifier).
     * @param {Object} options - Additional options for workspace config.
     * @param {string} options.owner - The ULID of the user who owns this workspace.
     * @param {string} [options.rootPath] - Custom root for this workspace path.
     * @param {string} [options.workspacePath] - Absolute path for out-of-tree workspace.
     * @param {string} [options.type='workspace'] - Type of workspace.
     * @returns {Promise<Object>} The index entry of the newly created workspace.
     */
    async createWorkspace(userId, workspaceName, options = {}) {
        if (!this.#initialized) throw new Error('WorkspaceManager not initialized');
        if (!userId) throw new Error('userId required to create a workspace.');
        if (!workspaceName) throw new Error('Workspace name required to create a workspace.');

        // Sanitize the workspace name
        workspaceName = this.#sanitizeWorkspaceName(workspaceName);

        // Generate unique workspace ID
        const workspaceId = generateNanoid(12);

        // Check if workspace name already exists for this user
        const nameKey = `${userId}/${workspaceName}`;
        if (this.#nameIndex.has(nameKey)) {
            throw new Error(`Workspace with name "${workspaceName}" already exists for user ${userId}.`);
        }

        // Determine workspace directory path (using name for filesystem)
        const workspaceDir = options.workspacePath ||
                            (options.rootPath ? path.join(options.rootPath, workspaceName) :
                            path.join(this.#defaultRootPath, userId, WORKSPACE_DIRECTORIES.workspaces, workspaceName));
        debug(`Using workspace path: ${workspaceDir} for workspace ${workspaceId}`);

        // Validate and create workspace
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
            id: isUniverse ? 'universe' : workspaceId,
            name: isUniverse ? 'universe' : workspaceName,
            label: isUniverse ? 'Universe' : (options.label || workspaceName),
            description: isUniverse ? 'And then there was geometry..' : options.description || '',
            owner: userId,
            color: isUniverse ? '#ffffff' : options.color || WorkspaceManager.getRandomColor(),
            type: options.type || 'workspace',
            acl: options.acl || { tokens: {} }, // Token-based ACL (owner has implicit admin access)
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
        };

        new Conf({ configName: path.basename(workspaceConfigPath, '.json'), cwd: workspaceDir }).store = configData;
        debug(`Created workspace config file: ${workspaceConfigPath}`);

        // Create index entry
        const indexEntry = { ...configData, rootPath: workspaceDir, configPath: workspaceConfigPath, status: WORKSPACE_STATUS_CODES.AVAILABLE, lastAccessed: null };

        // Use workspace.id as primary key
        this.#indexStore.set(workspaceId, indexEntry);

        // Add to name index for lookups
        this.#nameIndex.set(nameKey, workspaceId);

        this.emit('workspace.created', { userId, workspaceId, workspaceName, workspace: indexEntry });
        debug(`Workspace created: ${workspaceId} (name: ${workspaceName}) for user ${userId}`);
        return indexEntry;
    }

    /**
     * Opens a workspace, loading it into memory if not already loaded.
     * @param {string} userId - The owner identifier
     * @param {string} workspaceIdentifier - The workspace ID or name.
     * @param {string} requestingUserId - The ULID of the user making the request (for ownership check).
     * @returns {Promise<Workspace|null>} The loaded Workspace instance.
     */
    async openWorkspace(userId, workspaceIdentifier, requestingUserId) {
        if (!this.#initialized) {
            throw new Error('WorkspaceManager not initialized. Cannot open workspace.');
        }
        if (!userId || !workspaceIdentifier) {
            throw new Error(`userId and workspaceIdentifier are required to open a workspace, got userId: ${userId}, workspaceIdentifier: ${workspaceIdentifier}`);
        }

        if (!requestingUserId) {
            requestingUserId = userId;
        }

        // Resolve workspace identifier to ID
        let workspaceId;
        const isWorkspaceId = workspaceIdentifier.length === 12 && /^[a-zA-Z0-9]+$/.test(workspaceIdentifier);

        if (isWorkspaceId) {
            workspaceId = workspaceIdentifier;
        } else {
            workspaceId = this.resolveWorkspaceId(userId, workspaceIdentifier);
            if (!workspaceId) {
                debug(`openWorkspace failed: No workspace found with name "${workspaceIdentifier}" for user ${userId}`);
                return null;
            }
        }

        debug(`Opening workspace: ${workspaceId} (identifier: ${workspaceIdentifier}) for requestingUser: ${requestingUserId}`);

        // Return from cache if available and owner matches
        if (this.#workspaces.has(workspaceId)) {
            debug(`Returning cached Workspace instance for ${workspaceId}`);
            const cachedWs = this.#workspaces.get(workspaceId);
            if (cachedWs.owner !== requestingUserId) {
                console.error(`Ownership mismatch for cached workspace ${workspaceId}. Owner: ${cachedWs.owner}, Requester: ${requestingUserId}`);
                return null;
            }
            return cachedWs;
        }

        // Load from index using workspace ID
        const entry = this.#indexStore.get(workspaceId);
        if (!this.#validateWorkspaceEntryForOpen(entry, workspaceId, requestingUserId)) {
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

            this.#workspaces.set(workspaceId, workspace);
            debug(`Loaded and cached Workspace instance for ${workspaceId}`);
            this.#updateWorkspaceIndexEntry(workspaceId, { lastAccessed: new Date().toISOString() });
            return workspace;
        } catch (err) {
            console.error(`openWorkspace failed: Could not load config or instantiate Workspace for ${workspaceId}: ${err.message}`);
            return null;
        }
    }

    /**
     * Closes a workspace, removing it from the memory cache after stopping it.
     * @param {string} userId - The owner identifier.
     * @param {string} workspaceIdentifier - The workspace ID or name.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @returns {Promise<boolean>} True if closed or not loaded, false on failure to stop.
     */
    async closeWorkspace(userId, workspaceIdentifier, requestingUserId) {
        if (!this.#initialized) throw new Error('WorkspaceManager not initialized');
        this.#ensureRequiredParams({ userId, workspaceIdentifier: workspaceIdentifier, requestingUserId }, 'closeWorkspace');

        // Resolve workspace identifier to ID
        let workspaceId;
        const isWorkspaceId = workspaceIdentifier.length === 12 && /^[a-zA-Z0-9]+$/.test(workspaceIdentifier);

        if (isWorkspaceId) {
            workspaceId = workspaceIdentifier;
        } else {
            workspaceId = this.resolveWorkspaceId(userId, workspaceIdentifier);
            if (!workspaceId) {
                debug(`closeWorkspace: No workspace found with name "${workspaceIdentifier}" for user ${userId}`);
                return false;
            }
        }

        if (!this.#workspaces.has(workspaceId)) {
            debug(`closeWorkspace: Workspace ${workspaceId} is not loaded in memory.`);
            return true;
        }

        const stopped = await this.stopWorkspace(userId, workspaceIdentifier, requestingUserId);
        if (!stopped) {
            // stopWorkspace logs details, but we might want to indicate failure here too
            console.warn(`closeWorkspace: Failed to stop workspace ${workspaceId} before closing. It might still be in memory.`);
            // Depending on desired behavior, we might not delete from cache if stop failed.
            // For now, we proceed with deletion from cache.
        }

        const deleted = this.#workspaces.delete(workspaceId);
        if (deleted) {
            debug(`closeWorkspace: Removed workspace ${workspaceId} from memory cache.`);
            this.emit('workspace.closed', { workspaceId, userId, workspaceIdentifier });
        }
        return deleted; // Or perhaps return `stopped && deleted`
    }

    /**
     * Starts an opened workspace.
     * @param {string} userId - The owner identifier.
     * @param {string} workspaceIdentifier - The workspace ID or name.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @returns {Promise<Workspace|null>} The started Workspace instance or null on failure.
     */
    async startWorkspace(userId, workspaceIdentifier, requestingUserId) {
        if (!this.#initialized) throw new Error('WorkspaceManager not initialized');
        if (!requestingUserId) {
            requestingUserId = userId;
        }

        this.#ensureRequiredParams({ userId, workspaceIdentifier: workspaceIdentifier, requestingUserId }, 'startWorkspace');

        // Resolve workspace identifier to ID
        let workspaceId;
        const isWorkspaceId = workspaceIdentifier.length === 12 && /^[a-zA-Z0-9]+$/.test(workspaceIdentifier);

        if (isWorkspaceId) {
            workspaceId = workspaceIdentifier;
        } else {
            workspaceId = this.resolveWorkspaceId(userId, workspaceIdentifier);
            if (!workspaceId) {
                debug(`startWorkspace: No workspace found with name "${workspaceIdentifier}" for user ${userId}`);
                return null;
            }
        }

        debug(`Starting workspace ${workspaceId} (identifier: ${workspaceIdentifier}) for requestingUserId: ${requestingUserId}`);
        let workspace = this.#workspaces.get(workspaceId);

        if (!workspace) {
            debug(`startWorkspace: Workspace ${workspaceId} not found in memory, attempting to open...`);
            workspace = await this.openWorkspace(userId, workspaceIdentifier, requestingUserId);
            if (!workspace) {
                debug(`startWorkspace: Could not open workspace ${workspaceIdentifier} for user ${userId}.`);
                return null;
            }
        }

        if (workspace.status === WORKSPACE_STATUS_CODES.ACTIVE) {
            debug(`Workspace ${workspaceId} is already active.`);
            return workspace;
        }

        debug(`Starting workspace ${workspaceId}...`);
        try {
            await workspace.start();
            this.#updateWorkspaceIndexEntry(workspaceId, { status: WORKSPACE_STATUS_CODES.ACTIVE, lastAccessed: new Date().toISOString() });
            debug(`Workspace ${workspaceId} started successfully.`);
            this.emit('workspace.started', { workspaceId, workspace: workspace.toJSON() });
            return workspace;
        } catch (err) {
            console.error(`Failed to start workspace ${workspaceId}: ${err.message}`);
            this.#updateWorkspaceIndexEntry(workspaceId, { status: WORKSPACE_STATUS_CODES.ERROR });
            this.emit('workspace.startFailed', { workspaceId, error: err.message });
            return null;
        }
    }

    /**
     * Stops a loaded and active workspace.
     * @param {string} userId - The owner identifier.
     * @param {string} workspaceIdentifier - The workspace ID or name.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @returns {Promise<boolean>} True if stopped or already inactive/not loaded, false on failure.
     */
    async stopWorkspace(userId, workspaceIdentifier, requestingUserId) {
        if (!this.#initialized) throw Error('WorkspaceManager not initialized');
        if (!requestingUserId) {
            requestingUserId = userId;
        }
        this.#ensureRequiredParams({ userId, workspaceIdentifier: workspaceIdentifier, requestingUserId }, 'stopWorkspace');

        // Resolve workspace identifier to ID
        let workspaceId;
        const isWorkspaceId = workspaceIdentifier.length === 12 && /^[a-zA-Z0-9]+$/.test(workspaceIdentifier);

        if (isWorkspaceId) {
            workspaceId = workspaceIdentifier;
        } else {
            workspaceId = this.resolveWorkspaceId(userId, workspaceIdentifier);
            if (!workspaceId) {
                debug(`stopWorkspace: No workspace found with name "${workspaceIdentifier}" for user ${userId}`);
                return false;
            }
        }

        const workspace = this.#workspaces.get(workspaceId);

        if (!workspace) {
            debug(`Workspace ${workspaceId} is not loaded in memory, considered stopped.`);
            // Potentially update index if it was marked ACTIVE but not in memory (e.g. after a crash)
            const entry = this.#indexStore.get(workspaceId);
            if (entry && entry.owner === requestingUserId && entry.status === WORKSPACE_STATUS_CODES.ACTIVE) {
                this.#updateWorkspaceIndexEntry(workspaceId, { status: WORKSPACE_STATUS_CODES.INACTIVE });
                debug(`Marked workspace ${workspaceId} (not in memory) as INACTIVE in index.`);
            }
            return true;
        }

        if (workspace.owner !== requestingUserId) {
            console.error(`stopWorkspace: User ${requestingUserId} not owner of ${workspaceId}. Workspace owner: ${workspace.owner}`);
            return false;
        }

        if ([WORKSPACE_STATUS_CODES.INACTIVE, WORKSPACE_STATUS_CODES.AVAILABLE].includes(workspace.status)) {
            debug(`Workspace ${workspaceId} is already stopped (status: ${workspace.status}).`);
            return true;
        }

        debug(`Stopping workspace ${workspaceId}...`);
        try {
            await workspace.stop();
            this.#updateWorkspaceIndexEntry(workspaceId, { status: WORKSPACE_STATUS_CODES.INACTIVE }, requestingUserId);
            debug(`Workspace ${workspaceId} stopped successfully.`);
            this.emit('workspace.stopped', { workspaceId });
            return true;
        } catch (err) {
            console.error(`Failed to stop workspace ${workspaceId}: ${err.message}`);
            this.#updateWorkspaceIndexEntry(workspaceId, { status: WORKSPACE_STATUS_CODES.ERROR }, requestingUserId);
            this.emit('workspace.stopFailed', { workspaceId, error: err.message });
            return false;
        }
    }

    /**
     * Removes a workspace from the index and optionally deletes its data.
     * @param {string} userId - The owner identifier.
     * @param {string} workspaceIdentifier - The workspace ID or name.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @param {boolean} [destroyData=false] - Whether to delete the workspace directory.
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async removeWorkspace(userId, workspaceIdentifier, requestingUserId, destroyData = false) {
        if (!this.#initialized) throw new Error('WorkspaceManager not initialized');
        if (!requestingUserId) {
            requestingUserId = userId;
        }
        this.#ensureRequiredParams({ userId, workspaceIdentifier: workspaceIdentifier, requestingUserId }, 'removeWorkspace');

        // Resolve workspace identifier to ID
        let workspaceId;
        const isWorkspaceId = workspaceIdentifier.length === 12 && /^[a-zA-Z0-9]+$/.test(workspaceIdentifier);

        if (isWorkspaceId) {
            workspaceId = workspaceIdentifier;
        } else {
            workspaceId = this.resolveWorkspaceId(userId, workspaceIdentifier);
            if (!workspaceId) {
                debug(`removeWorkspace: No workspace found with name "${workspaceIdentifier}" for user ${userId}`);
                return false;
            }
        }

        debug(`Removing workspace: ${workspaceId} (identifier: ${workspaceIdentifier}), destroyData: ${destroyData}, requested by ${requestingUserId}`);

        // Prevent removal of universe workspace
        if (this.#isUniverseWorkspace(workspaceId)) {
            throw new Error('Cannot remove the universe workspace');
        }

        const entry = this.#indexStore.get(workspaceId);
        if (!entry) {
            console.warn(`removeWorkspace failed: Workspace ${workspaceId} not found in index.`);
            return false;
        }
        if (entry.owner !== requestingUserId) {
            console.error(`removeWorkspace failed: User ${requestingUserId} is not the owner of ${workspaceId}. Owner: ${entry.owner}`);
            return false;
        }

        // Attempt to stop and remove from cache first
        if (this.#workspaces.has(workspaceId)) {
            const stopped = await this.stopWorkspace(userId, workspaceIdentifier, requestingUserId);
            if (!stopped) {
                console.error(`removeWorkspace: Could not stop workspace ${workspaceId} before removal. Proceeding with index removal.`);
                // Decide if we should abort or continue. For now, continue.
            }
            this.#workspaces.delete(workspaceId);
            debug(`Removed workspace ${workspaceId} from memory cache during removal process.`);
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

        // Remove from name index
        const nameKey = `${userId}/${entry.name}`;
        this.#nameIndex.delete(nameKey);

        this.#indexStore.delete(workspaceId);
        this.emit('workspace.removed', {
            userId,
            workspaceId,
            workspaceIdentifier,
            requestingUserId,
            destroyData,
            success: !deletionError, // Success is true if data destruction didn't fail (or wasn't attempted)
            error: deletionError ? deletionError.message : null
        });
        debug(`Workspace ${workspaceId} removed from index for owner ${userId}.`);
        return !deletionError; // Return based on data destruction outcome if attempted
    }

    /**
     * Public API - Workspace Information & Configuration
     */

    /**
     * Gets all workspace entries from the index (for internal use)
     * @returns {Object} All workspace entries from the index store
     */
    getAllWorkspaces() {
        return this.#indexStore?.store || {};
    }

    /**
     * Resolves a workspace ID from a workspace name and user ID
     * @param {string} userId - The user ID
     * @param {string} workspaceName - The workspace name
     * @returns {string|null} The workspace ID if found, null otherwise
     */
    resolveWorkspaceId(userId, workspaceName) {
        const nameKey = `${userId}/${workspaceName}`;
        return this.#nameIndex.get(nameKey) || null;
    }

    /**
     * Gets a workspace by ID directly
     * @param {string} workspaceId - The workspace ID
     * @param {string} requestingUserId - The ULID of the user making the request
     * @returns {Promise<Workspace|null>} The loaded Workspace instance
     */
    async getWorkspaceById(workspaceId, requestingUserId) {
        if (!this.#initialized) {
            throw new Error('WorkspaceManager not initialized. Cannot get workspace by ID.');
        }
        if (!workspaceId) {
            throw new Error('workspaceId is required to get workspace by ID');
        }

        // Check if workspace exists in index
        const entry = this.#indexStore.get(workspaceId);
        if (!entry) {
            debug(`getWorkspaceById: Workspace ${workspaceId} not found in index`);
            return null;
        }

        // Check ownership if requesting user is provided
        if (requestingUserId && entry.owner !== requestingUserId) {
            debug(`getWorkspaceById: User ${requestingUserId} is not the owner of workspace ${workspaceId}`);
            return null;
        }

        // Return from cache if available
        if (this.#workspaces.has(workspaceId)) {
            debug(`Returning cached Workspace instance for ${workspaceId}`);
            return this.#workspaces.get(workspaceId);
        }

        // Load workspace
        try {
            const conf = new Conf({
                configName: path.basename(entry.configPath, '.json'),
                cwd: path.dirname(entry.configPath)
            });

            const workspace = new Workspace({
                rootPath: entry.rootPath,
                configStore: conf,
            });

            this.#workspaces.set(workspaceId, workspace);
            debug(`Loaded and cached Workspace instance for ${workspaceId}`);
            this.#updateWorkspaceIndexEntry(workspaceId, { lastAccessed: new Date().toISOString() });
            return workspace;
        } catch (err) {
            console.error(`getWorkspaceById failed: Could not load config or instantiate Workspace for ${workspaceId}: ${err.message}`);
            return null;
        }
    }

    /**
     * Gets a workspace by name (resolves to ID first)
     * @param {string} userId - The user ID
     * @param {string} workspaceName - The workspace name
     * @param {string} requestingUserId - The ULID of the user making the request
     * @returns {Promise<Workspace|null>} The loaded Workspace instance
     */
    async getWorkspaceByName(userId, workspaceName, requestingUserId) {
        if (!this.#initialized) {
            throw new Error('WorkspaceManager not initialized. Cannot get workspace by name.');
        }
        if (!userId || !workspaceName) {
            throw new Error('userId and workspaceName are required to get workspace by name');
        }

        // Resolve workspace ID from name
        const workspaceId = this.resolveWorkspaceId(userId, workspaceName);
        if (!workspaceId) {
            debug(`getWorkspaceByName: No workspace found with name "${workspaceName}" for user ${userId}`);
            return null;
        }

        // Get workspace by ID
        return this.getWorkspaceById(workspaceId, requestingUserId || userId);
    }

    /**
     * Checks if a workspace instance is currently loaded in memory.
     * @param {string} ownerId - The owner identifier (e.g., userId) used for key construction.
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
     * @param {string} ownerId - The owner identifier (e.g., userId) used for key construction.
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
     * Lists all workspaces for a given userId (e.g., userId).
     * @param {string} userId - The owner identifier (e.g., userId) used for key prefixing.
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
     * TODO: This method has to be renamed
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
                this.emit('workspace.config.updated', { workspaceKey, updates: validUpdates });
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
     * Parse remote workspace reference format: user.email@host:workspace.name
     * @param {string} remoteRef - Remote workspace reference
     * @returns {Object|null} Parsed remote workspace info or null if invalid
     * @static
     */
    static parseRemoteWorkspaceRef(remoteRef) {
        if (!remoteRef || typeof remoteRef !== 'string') {
            return null;
        }

        // Format: user.email@host:workspace.name
        const match = remoteRef.match(/^([^@]+)@([^:]+):(.+)$/);
        if (!match) {
            return null;
        }

        const [, userEmail, host, workspaceName] = match;

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userEmail)) {
            return null;
        }

        return {
            userEmail,
            host,
            workspaceName,
            original: remoteRef
        };
    }

    /**
     * Resolve remote workspace reference to internal format
     * @param {string} remoteRef - Remote workspace reference
     * @param {Function} userResolver - Function to resolve user.email to user.id
     * @param {Function} workspaceResolver - Function to resolve workspace.name to workspace.id
     * @returns {Promise<Object|null>} Resolved remote workspace info or null if invalid
     * @static
     */
    static async resolveRemoteWorkspaceRef(remoteRef, userResolver, workspaceResolver) {
        const parsed = WorkspaceManager.parseRemoteWorkspaceRef(remoteRef);
        if (!parsed) {
            return null;
        }

        try {
            // Resolve user email to user ID
            const userId = await userResolver(parsed.userEmail);
            if (!userId) {
                debug(`Failed to resolve user email to ID: ${parsed.userEmail}`);
                return null;
            }

            // Resolve workspace name to workspace ID
            const workspaceId = await workspaceResolver(userId, parsed.workspaceName);
            if (!workspaceId) {
                debug(`Failed to resolve workspace name to ID: ${parsed.workspaceName} for user ${userId}`);
                return null;
            }

            return {
                ...parsed,
                userId,
                workspaceId,
                resolved: `${userId}@${parsed.host}:${workspaceId}`
            };
        } catch (error) {
            debug(`Error resolving remote workspace reference: ${error.message}`);
            return null;
        }
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
     * Private Methods
     */

    /**
     * Rebuilds the name index from existing workspaces in the index store
     * @private
     */
    async #rebuildNameIndex() {
        this.#nameIndex.clear();
        const allWorkspaces = this.#indexStore.store;

        for (const [workspaceId, workspaceEntry] of Object.entries(allWorkspaces)) {
            if (workspaceEntry && workspaceEntry.name && workspaceEntry.owner) {
                const nameKey = `${workspaceEntry.owner}/${workspaceEntry.name}`;
                this.#nameIndex.set(nameKey, workspaceId);
            }
        }

        debug(`Rebuilt name index with ${this.#nameIndex.size} workspace name mappings`);
    }

    #sanitizeWorkspaceName(workspaceName) {
        if (!workspaceName) return 'untitled';
        let sanitized = workspaceName.toString().toLowerCase().trim();

        // Remove all special characters except "_", "-"
        sanitized = sanitized.replace(/[^a-z0-9-_]/g, '');

        // Replace spaces with hyphens
        sanitized = sanitized.replace(/\s+/g, '-');

        // Return the sanitized workspaceName
        return sanitized;
    }



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

        for (const workspaceId in allWorkspaces) {
            const workspaceEntry = allWorkspaces[workspaceId];
            // Basic validation of the entry structure
            if (!workspaceEntry || typeof workspaceEntry !== 'object' || !workspaceEntry.id) {
                debug(`Skipping invalid or incomplete workspace entry for ID: ${workspaceId}`);
                continue;
            }

            debug(`Scanning workspace ${workspaceId} (Name: ${workspaceEntry.name}, Owner: ${workspaceEntry.owner})`);
            let currentStatus = workspaceEntry.status;
            let newStatus = currentStatus;

            // Skip already processed states unless we need to re-validate
            if ([WORKSPACE_STATUS_CODES.REMOVED, WORKSPACE_STATUS_CODES.DESTROYED].includes(currentStatus)) {
                debug(`Workspace ${workspaceId} is in status ${currentStatus}, skipping.`);
                continue;
            }

            if (!workspaceEntry.rootPath || !existsSync(workspaceEntry.rootPath)) {
                debug(`Workspace path not found for ${workspaceId} at path ${workspaceEntry.rootPath}, marking as NOT_FOUND`);
                newStatus = WORKSPACE_STATUS_CODES.NOT_FOUND;
            } else if (!workspaceEntry.configPath || !existsSync(workspaceEntry.configPath)) {
                debug(`Workspace config not found for ${workspaceId} at path ${workspaceEntry.configPath}, marking as ERROR`);
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
                this.#updateWorkspaceIndexEntry(workspaceId, { status: newStatus });
                requiresSave = true; // Conf usually saves on set, but this flag is for conceptual grouping.
                debug(`Updated status for ${workspaceId} from ${currentStatus} to ${newStatus}`);
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
     * @param {string} workspaceId - The ID of the workspace.
     * @param {string} requestingUserId - The ULID of the user making the request.
     * @returns {boolean} True if valid, false otherwise.
     * @private
     */
    #validateWorkspaceEntryForOpen(entry, workspaceId, requestingUserId) {
        if (!entry) {
            debug(`openWorkspace failed: Workspace ${workspaceId} not found in index.`);
            return false;
        }
        if (entry.owner !== requestingUserId) {
            console.warn(`openWorkspace failed: User ${requestingUserId} is not the owner of workspace ${workspaceId}. Stored owner: ${entry.owner}`);
            return false;
        }
        if (!entry.rootPath || !existsSync(entry.rootPath)) {
            console.warn(`openWorkspace failed: Workspace ${workspaceId} rootPath is missing or does not exist: ${entry.rootPath}`);
            this.#updateWorkspaceIndexEntry(workspaceId, { status: WORKSPACE_STATUS_CODES.NOT_FOUND });
            return false;
        }
        if (!entry.configPath || !existsSync(entry.configPath)) {
            console.warn(`openWorkspace failed: Workspace ${workspaceId} configPath is missing or does not exist: ${entry.configPath}`);
            this.#updateWorkspaceIndexEntry(workspaceId, { status: WORKSPACE_STATUS_CODES.ERROR });
            return false;
        }
        const validOpenStatuses = [
            WORKSPACE_STATUS_CODES.AVAILABLE,
            WORKSPACE_STATUS_CODES.INACTIVE,
            WORKSPACE_STATUS_CODES.ACTIVE, // Can re-open an active one (returns from cache or re-validates)
            // WORKSPACE_STATUS_CODES.ERROR, // Should we allow opening an errored workspace? Perhaps if paths are now valid.
        ];
        if (!validOpenStatuses.includes(entry.status)) {
            console.warn(`openWorkspace failed: Workspace ${workspaceId} status is invalid (${entry.status}). Must be one of: ${validOpenStatuses.join(', ')}.`);
            // Don't change status here, as it might be a temporary issue or a state we don't want to override.
            return false;
        }
        return true;
    }

    /**
     * Helper to update a workspace's entry in the index store.
     * Ensures owner check if requestingUserId is provided for sensitive updates.
     * @param {string} workspaceId - The ID of the workspace in the index.
     * @param {Object} updates - Key-value pairs to update in the index entry.
     * @param {string} [requestingUserId] - Optional. If provided, validates ownership before certain updates.
     * @private
     */
    #updateWorkspaceIndexEntry(workspaceId, updates, requestingUserId = null) {
        const currentEntry = this.#indexStore.get(workspaceId);
        if (!currentEntry) {
            debug(`Cannot update index for ${workspaceId}: entry not found.`);
            return;
        }

        // If requestingUserId is provided (typically for status changes like stop/start),
        // ensure the action is performed by the owner.
        if (requestingUserId && currentEntry.owner !== requestingUserId) {
            console.error(`Index update for ${workspaceId} denied: User ${requestingUserId} is not the owner. Owner: ${currentEntry.owner}`);
            return;
        }

        const updatedEntry = { ...currentEntry, ...updates, updated: new Date().toISOString() };
        this.#indexStore.set(workspaceId, updatedEntry);
        debug(`Updated index entry for ${workspaceId} with: ${JSON.stringify(updates)}`);
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

    /**
     * Checks if a workspace is the universe workspace
     * @param {string} workspaceId - The workspace ID to check
     * @returns {boolean} True if the workspace is the universe workspace
     * @private
     */
    #isUniverseWorkspace(workspaceId) {
        const entry = this.#indexStore.get(workspaceId);
        return entry && entry.type === 'universe';
    }
}

export default WorkspaceManager;
export {
    WORKSPACE_STATUS_CODES,
    WORKSPACE_DIRECTORIES,
};
