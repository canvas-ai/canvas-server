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
const debug = createDebug('manager:workspace:new');

// Includes
import Manager from '../base/Manager.js';
import Workspace from './lib/Workspace.js';

/**
 * Constants
 */

// Workspace ID format: user.id/workspace.name
// Example: john.doe@example.com/my-project

const WORKSPACE_CONFIG_FILENAME = 'workspace.json'; // Name of the config file within the workspace directory

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
    // acl: {}, // Simplified: Owner has full access, maybe add later
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

        // Initialize the index if empty
        if (!Array.isArray(this.getConfig('workspaces')))
            this.setConfig('workspaces', []);

        debug(`WorkspaceManager initialized with rootPath: ${this.#rootPath}`);
        this.#performInitialScan();
    }

    /**
     * Getters
     */

    get rootPath() { return this.#rootPath; }
    get index() { return this.getConfig('workspaces', []); }

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
     * @param {string} userId - The User ID (email) of the owner.
     * @param {string} name - The desired name for the workspace.
     * @param {Object} [options={}] - Additional options for workspace config (label, color, description).
     * @returns {Promise<Object>} The index entry of the newly created workspace.
     * @throws {Error} If workspace ID/path conflict, or creation fails.
     */
    async createWorkspace(userId, name, options = {}) {
        if (!userId || !name) {
            throw new Error('UserID and Name are required to create a workspace.');
        }

        const sanitizedName = this.#sanitizeName(name);
        const workspaceId = this.#generateWorkspaceId(userId, sanitizedName);
        const workspaceDir = this.#getWorkspacePathFromComponents(userId, sanitizedName);
        const workspaceConfigPath = path.join(workspaceDir, WORKSPACE_CONFIG_FILENAME);

        debug(`Attempting to create workspace: ID=${workspaceId}, Path=${workspaceDir}`);

        if (this.#findIndexEntry(workspaceId)) {
            throw new Error(`Workspace with ID "${workspaceId}" already exists in the index.`);
        }

        if (existsSync(workspaceDir)) {
            throw new Error(`Workspace directory "${workspaceDir}" already exists.`);
        }

        try {
            await fsPromises.mkdir(workspaceDir, { recursive: true });
            debug(`Created workspace directory: ${workspaceDir}`);
        } catch (err) {
            logger.error(`Failed to create directory ${workspaceDir}: ${err.message}`);
            throw new Error(`Failed to create workspace directory: ${err.message}`);
        }

        const now = new Date().toISOString();
        const configData = {
            ...DEFAULT_WORKSPACE_CONFIG,
            id: workspaceId,
            name: name, // Store original name
            type: options.type || 'workspace',
            owner: userId,
            label: options.label || name.charAt(0).toUpperCase() + name.slice(1), // Default label from name
            color: options.color || randomcolor({ luminosity: 'light', format: 'hex' }),
            description: options.description || '',
            created: now,
            updated: now,
        };

        try {
            const conf = new Conf({ configName: path.basename(workspaceConfigPath, '.json'), cwd: workspaceDir });
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

        // Add to Index
        const indexEntry = {
            id: workspaceId,
            name: name,
            type: configData.type,
            owner: userId,
            path: workspaceConfigPath, // Store path to config file
            status: WORKSPACE_STATUS_CODES.AVAILABLE,
            created: now,
            lastAccessed: null,
        };

        try {
            this.#updateIndex(workspaces => {
                // Final check for duplicates before adding
                if (workspaces.some(ws => ws.id === workspaceId)) {
                    throw new Error(`Index conflict: Workspace ID "${workspaceId}" already exists.`);
                }
                workspaces.push(indexEntry);
                return workspaces;
            });
            debug(`Added workspace ${workspaceId} to index.`);
        } catch (err) {
            logger.error(`Failed to add workspace ${workspaceId} to index: ${err.message}`);
            // Attempt cleanup: Remove config and directory
            await fsPromises.rm(workspaceDir, { recursive: true, force: true }).catch(cleanupErr => {
                logger.error(`Failed to cleanup directory ${workspaceDir} after index update failure: ${cleanupErr.message}`);
            });
            throw new Error(`Failed to update workspace index: ${err.message}`);
        }

        this.emit('workspace:created', { ...indexEntry }); // Emit event
        return { ...indexEntry }; // Return a copy
    }

    /**
     * Ensures a workspace is loaded and then starts its services (e.g., connects DB).
     * Checks for user ownership.
     * @param {string} userId - The User ID (email) starting the workspace.
     * @param {string} workspaceId - The ID of the workspace.
     * @returns {Promise<Workspace|null>} The started Workspace instance, or null on failure.
     */
    async startWorkspace(userId, workspaceId) {
        const workspace = await this.getWorkspace(userId, workspaceId);

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
            // Optionally update status in index here?
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
        // Resolve potential short name to canonical ID
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
     * =================================================================
     * Initialization & Lifecycle
     * =================================================================
     */

    async initialize() {
        if (this.initialized) return true;
        debug('Initializing WorkspaceManager...');
        // Initial scan is done in constructor for now
        return super.initialize();
    }

    /**
     * =================================================================
     * Private Helper Methods
     * =================================================================
     */

    /**
     * Sanitizes a name for use in paths and IDs.
     * Lowercase, replaces spaces/unsafe chars with hyphens, removes leading/trailing hyphens.
     * @param {string} name
     * @returns {string}
     * @private
     */
    #sanitizeName(name) {
        if (!name) return 'untitled';
        return name
            .toString()
            .toLowerCase()
            .replace(/\s+/g, '-') // Replace spaces with -
            .replace(/[^a-z0-9-]/g, '') // Remove all non-alphanumeric or hyphen characters
            .replace(/--+/g, '-') // Replace multiple - with single -
            .replace(/^-+/, '') // Trim - from start of text
            .replace(/-+$/, ''); // Trim - from end of text
    }

    /**
     * Constructs the expected absolute path for a workspace directory.
     * @param {string} userId
     * @param {string} sanitizedName
     * @returns {string} Absolute path (e.g., '/canvas/users/user@example.com/my-project').
     * @private
     */
    #getWorkspacePathFromComponents(userId, sanitizedName) {
        return path.join(this.#rootPath, userId, sanitizedName);
    }

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
    #performInitialScan() {
        debug('Performing initial workspace scan...');
        let requiresUpdate = false;
        const updatedWorkspaces = this.getConfig('workspaces', []).map(entry => {
            if (entry.status === WORKSPACE_STATUS_CODES.REMOVED) {
                return entry; // Skip removed entries
            }

            let currentStatus = entry.status;
            let newStatus = currentStatus;
            let configFilePath = null;

            // 1. Check if path exists
            if (!entry.path || !existsSync(entry.path)) {
                // Path might be missing, or maybe just config file path is missing
                // Let's try constructing the expected path
                const expectedDir = this.#getWorkspacePathFromComponents(entry.owner, this.#sanitizeName(entry.name));
                const expectedConfigPath = path.join(expectedDir, WORKSPACE_CONFIG_FILENAME);

                if (existsSync(expectedConfigPath)) {
                    // Directory & config exist, update index entry path
                    entry.path = expectedConfigPath;
                    configFilePath = expectedConfigPath;
                    newStatus = WORKSPACE_STATUS_CODES.AVAILABLE;
                    debug(`Found workspace ${entry.id} at expected path: ${expectedConfigPath}. Updated index.`);
                } else {
                    debug(`Workspace path/config not found for ${entry.id} at index path ${entry.path} or expected path ${expectedConfigPath}`);
                    newStatus = WORKSPACE_STATUS_CODES.NOT_FOUND;
                }
            } else {
                configFilePath = entry.path;
                newStatus = WORKSPACE_STATUS_CODES.AVAILABLE;
            }

            // 2. If path exists, try reading config (minimal validation)
            if (newStatus === WORKSPACE_STATUS_CODES.AVAILABLE && configFilePath) {
                try {
                    // Minimal check: Can we instantiate Conf?
                    const conf = new Conf({ configName: path.basename(configFilePath, '.json'), cwd: path.dirname(configFilePath) });
                    // TODO: Add deeper validation if needed (e.g., check owner match)
                    if (conf.get('id') !== entry.id || conf.get('owner') !== entry.owner) {
                       logger.warn(`Config mismatch for ${entry.id} at ${configFilePath}. ID/Owner in file does not match index.`);
                       newStatus = WORKSPACE_STATUS_CODES.ERROR; // Config doesn't match index
                    }

                } catch (err) {
                    logger.error(`Error reading/validating config for ${entry.id} at ${configFilePath}: ${err.message}`);
                    newStatus = WORKSPACE_STATUS_CODES.ERROR;
                }
            }

            if (newStatus !== currentStatus) {
                requiresUpdate = true;
                entry.status = newStatus;
                debug(`Updated status for ${entry.id} to ${newStatus}`);
            }
            return entry;
        });

        if (requiresUpdate) {
            this.setConfig('workspaces', updatedWorkspaces);
            debug('Initial workspace scan complete. Index updated.');
        } else {
            debug('Initial workspace scan complete. No index changes required.');
        }
    }

    /**
     * Checks if a workspace exists in the index and belongs to the specified user.
     * @param {string} userId - The User ID (email) to check ownership against.
     * @param {string} workspaceId - The workspace ID (e.g., 'user@example.com/my-project').
     * @returns {boolean} True if the workspace exists and the user is the owner, false otherwise.
     */
    hasWorkspace(userId, workspaceId) {
        if (!userId || !workspaceId) {
            return false;
        }

        // Resolve potential short name to canonical ID
        const canonicalId = this.#resolveWorkspaceId(userId, workspaceId);

        const entry = this.#findIndexEntry(canonicalId);
        // Check entry exists AND owner matches the provided userId
        return !!entry && entry.owner === userId;
    }

    /**
     * Gets a loaded Workspace instance from memory, loading it from disk if necessary.
     * Does NOT start the workspace services.
     * Checks for user ownership.
     * @param {string} userId - The User ID (email) requesting the instance.
     * @param {string} workspaceId - The ID of the workspace.
     * @returns {Promise<Workspace|null>} The loaded Workspace instance, or null if not found, access denied, or load error.
     */
    async openWorkspace(userId, workspaceId) {
        // Resolve potential short name to canonical ID
        const canonicalId = this.#resolveWorkspaceId(userId, workspaceId);

        // 1. Check cache using canonical ID
        if (this.#workspaces.has(canonicalId)) {
            // TODO: Re-verify access here? If ACLs change while cached? For owner-only, it's likely fine.
            debug(`Returning cached Workspace instance for ${canonicalId}`);
            return this.#workspaces.get(canonicalId);
        }

        // 2. Find index entry & check access
        const entry = this.#findIndexEntry(canonicalId);
        if (!entry || !this.#checkAccess(userId, canonicalId, entry)) {
            logger.warn(`openWorkspace failed: Workspace ${canonicalId} not found or access denied for user ${userId}.`);
            return null;
        }

        // 3. Check status and path
        if (!entry.path || ![WORKSPACE_STATUS_CODES.AVAILABLE, WORKSPACE_STATUS_CODES.INACTIVE, WORKSPACE_STATUS_CODES.ACTIVE].includes(entry.status)) {
            logger.warn(`openWorkspace failed: Workspace ${canonicalId} path is missing or status is invalid (${entry.status}).`);
            return null;
        }
        if (!existsSync(entry.path)) {
            logger.warn(`openWorkspace failed: Config file path for ${canonicalId} does not exist: ${entry.path}`);
            // Optionally update status
            return null;
        }

        // 4. Load config
        let conf;
        try {
            const workspaceDir = path.dirname(entry.path);
            const configName = path.basename(entry.path, '.json');
            conf = new Conf({ configName, cwd: workspaceDir });
            // Optional: Deep validation of config content?
        } catch (err) {
            logger.error(`openWorkspace failed: Could not load config for ${canonicalId} from ${entry.path}: ${err.message}`);
            // Optionally update status
            return null;
        }

        // 5. Instantiate Workspace
        try {
            const workspace = new Workspace({
                rootPath: workspaceDir, // Pass the directory containing workspace.json
                configStore: conf,      // Pass the loaded Conf instance
                // Pass other dependencies like jim, eventEmitter if Workspace needs them?
                // For now, assume Workspace only needs path and config.
            });

            // 6. Cache instance
            this.#workspaces.set(canonicalId, workspace);
            debug(`Loaded and cached Workspace instance for ${canonicalId}`);

            // 7. Return instance
            return workspace;

        } catch (err) {
            logger.error(`openWorkspace failed: Could not instantiate Workspace for ${canonicalId}: ${err.message}`);
            // Optionally update status
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
        // Resolve potential short name to canonical ID
        const canonicalId = this.#resolveWorkspaceId(userId, workspaceId);

        // 1. Find entry and check access
        const entry = this.#findIndexEntry(canonicalId);
        if (!entry || !this.#checkAccess(userId, canonicalId, entry)) {
            logger.warn(`stopWorkspace failed: Workspace ${canonicalId} not found or access denied for user ${userId}.`);
            return false;
        }

        // 2. Check if loaded in cache
        const workspace = this.#workspaces.get(canonicalId);
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

        // 3. Check current status of Workspace instance
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

        // 4. Attempt to stop
        debug(`Stopping workspace ${canonicalId}...`);
        try {
            await workspace.stop(); // Assuming workspace.stop() exists and is async

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
     * Removes a workspace from the index and optionally deletes its data from disk.
     * Ensures the workspace is stopped first.
     * Requires ownership.
     * @param {string} userId - The User ID (email) removing the workspace.
     * @param {string} workspaceId - The ID of the workspace to remove.
     * @param {boolean} [destroyData=false] - If true, deletes the workspace directory from disk.
     * @returns {Promise<boolean>} True if removal from index was successful, false otherwise.
     */
    async removeWorkspace(userId, workspaceId, destroyData = false) {
        // Resolve potential short name to canonical ID
        const canonicalId = this.#resolveWorkspaceId(userId, workspaceId);

        // 1. Find entry and check access (using canonical ID)
        const entry = this.#findIndexEntry(canonicalId);
        if (!entry || !this.#checkAccess(userId, canonicalId, entry)) {
            logger.warn(`removeWorkspace failed: Workspace ${canonicalId} not found or access denied for user ${userId}.`);
            return false;
        }

        // 2. Stop Workspace (Idempotent)
        // Pass canonicalId to stopWorkspace as it now expects it
        const stopped = await this.stopWorkspace(userId, canonicalId);
        if (!stopped && this.#workspaces.has(canonicalId)) {
            // If stop failed AND it was actually loaded, we have a problem.
            logger.error(`removeWorkspace failed: Could not stop workspace ${canonicalId} before removal.`);
            return false;
        }

        // 3. Remove from Cache
        if (this.#workspaces.has(canonicalId)) {
            this.#workspaces.delete(canonicalId);
            debug(`Removed workspace ${canonicalId} from memory cache.`);
        }

        let workspaceDir = null;
        if (entry.path) {
             workspaceDir = path.dirname(entry.path);
        }

        // 4. Handle Data Destruction
        let deletionError = null;
        if (destroyData) {
            if (!workspaceDir) {
                logger.warn(`Cannot destroy data for ${canonicalId}: Workspace directory path not found in index.`);
                // Proceed to remove from index anyway?
            } else {
                 // Basic Safety Checks
                if (workspaceDir === this.#rootPath || workspaceDir === '/' || !workspaceDir.includes(entry.owner)) {
                    logger.error(`Safety check failed! Aborting deletion of potentially dangerous path: ${workspaceDir}`);
                    this.emit('workspace:destroy_failed', { id: canonicalId, error: 'Safety check failed' });
                    return false; // Abort dangerous deletion
                }

                debug(`Destroying data for workspace ${canonicalId} at ${workspaceDir}...`);
                try {
                    await fsPromises.rm(workspaceDir, { recursive: true, force: true });
                    debug(`Successfully deleted workspace directory: ${workspaceDir}`);
                } catch (err) {
                    logger.error(`Failed to delete workspace directory ${workspaceDir}: ${err.message}`);
                    deletionError = err;
                    // Proceed to remove from index despite deletion error
                }
            }
        }

        // 5. Remove from Index
        let removedFromIndex = false;
        try {
            this.#updateIndex(workspaces => {
                const initialLength = workspaces.length;
                const filteredWorkspaces = workspaces.filter(ws => ws.id !== canonicalId);
                removedFromIndex = filteredWorkspaces.length < initialLength;
                return filteredWorkspaces;
            });
        } catch (err) {
            logger.error(`Failed to remove workspace ${canonicalId} from index: ${err.message}`);
            // If index update fails, the state is inconsistent.
            // Should we try to re-add if deletion happened? Complex.
            return false; // Indicate failure
        }

        if (!removedFromIndex) {
            // This shouldn't happen if the entry existed initially, but check anyway.
            logger.warn(`Workspace ${canonicalId} was not found in the index during removal update.`);
            // Consider this a success? Or should it be an error?
            // Let's say true, as the end state (not in index) is achieved.
            // removedFromIndex = true;
        }

        // 6. Emit Event
        if (destroyData) {
            if (deletionError) {
                 this.emit('workspace:destroy_failed', { id: canonicalId, error: deletionError.message });
            } else {
                 this.emit('workspace:destroyed', { id: canonicalId });
            }
        } else {
            this.emit('workspace:removed', { id: canonicalId });
        }

        debug(`Workspace ${canonicalId} ${destroyData ? (deletionError ? 'index removed after delete error' : 'destroyed') : 'removed'}.`);
        return true; // Return true if index removal was processed
    }

    /**
     * Resolves a workspace ID to its canonical form.
     * @param {string} userId - User ID (email).
     * @param {string} workspaceId - Original workspace ID.
     * @returns {string} Canonical ID (e.g., 'user@example.com/my-project').
     * @private
     */
    #resolveWorkspaceId(userId, workspaceId) {
        return workspaceId.includes('/')
            ? workspaceId
            : this.#generateWorkspaceId(userId, workspaceId);
    }

    /**
     * Generates the standard workspace ID.
     * @param {string} userId - User ID (email).
     * @param {string} workspaceName - Original workspace name.
     * @returns {string} Composed ID (e.g., 'user@example.com/my-project').
     * @private
     */
    #generateWorkspaceId(userId, workspaceName) {
        if (!userId || !workspaceName) {
            throw new Error('UserID and WorkspaceName are required to generate workspace ID');
        }
        const sanitizedName = this.#sanitizeName(workspaceName);
        return `${userId}/${sanitizedName}`;
    }

    /**
     * Stops a workspace if active and removes it from the memory cache.
     * Updates the index status to INACTIVE.
     * @param {string} userId - The User ID (email) closing the workspace.
     * @param {string} workspaceId - The workspace ID (short name or canonical).
     * @returns {Promise<boolean>} True if closed/removed from cache successfully, false otherwise.
     */
    async closeWorkspace(userId, workspaceId) {
        const canonicalId = this.#resolveWorkspaceId(userId, workspaceId);

        // Check if it's even loaded
        if (!this.#workspaces.has(canonicalId)) {
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
        const deleted = this.#workspaces.delete(canonicalId);
        if (deleted) {
            debug(`closeWorkspace: Removed workspace ${canonicalId} from memory cache.`);
            this.emit('workspace:closed', { id: canonicalId });
            // Status should already be INACTIVE due to stopWorkspace call
        } else {
            // This shouldn't happen if .has(canonicalId) was true earlier
             logger.warn(`closeWorkspace: Failed to delete workspace ${canonicalId} from cache, though it was present.`);
        }

        return deleted;
    }

}

export default WorkspaceManager;
export { WORKSPACE_STATUS_CODES };


