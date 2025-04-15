'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import randomcolor from 'randomcolor';
import path from 'path';
import * as fsPromises from 'fs/promises';
import { existsSync } from 'fs';
import Conf from 'conf';
import AdmZip from 'adm-zip';
import os from 'os';
import pm2 from 'pm2';
import { promisify } from 'util';
import fs from 'fs';
import Jim from '../../utils/jim/index.js';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('workspace-manager');

// Promisify PM2 functions
const pm2Connect = promisify(pm2.connect).bind(pm2);
const pm2Disconnect = promisify(pm2.disconnect).bind(pm2);
const pm2List = promisify(pm2.list).bind(pm2);
const pm2Start = promisify(pm2.start).bind(pm2);
const pm2Stop = promisify(pm2.stop).bind(pm2);
const pm2Delete = promisify(pm2.delete).bind(pm2);
const pm2Describe = promisify(pm2.describe).bind(pm2);

// Includes
import env from '../../env.js';
import Workspace from './lib/Workspace.js';

/**
 * Constants
 */

const WORKSPACE_TYPES = [
    'universe',
    'workspace'
];

// Constants for workspace files
const WORKSPACE_CONFIG_FILENAME = 'workspace.json';

// Default configuration template for a new workspace's workspace.json
const WORKSPACE_CONFIG_TEMPLATE = {
    id: null,
    name: null,
    type: 'workspace',
    label: 'Workspace',
    color: null,
    description: 'Canvas Workspace',
    owner: null,
    // path is set dynamically
    restApi: { // Configuration for the optional dedicated REST API
        port: null, // Port number
        token: null // Auth token (store hash in production!)
    },
    locked: true,
    acl: {},
    created: null, // Set during creation
    updated: null, // Set during creation and updates
    status: 'new', // Tracks status within workspace.json, manager uses global index
};

const WORKSPACE_STATUS = {
    AVAILABLE: 'available', // Workspace is available on disk
    NOT_FOUND: 'path_not_found', // Workspace is not found on disk
    ERROR: 'error', // Workspace is in an error state
    ACTIVE: 'active', // Workspace is active and running
    INACTIVE: 'inactive', // Workspace is inactive and not running
    REMOVED: 'removed', // Workspace is removed from auto-load list
};

const WORKSPACE_API_STATUS = {
    RUNNING: 'running',
    STOPPED: 'stopped',
    STARTING: 'starting',
    STOPPING: 'stopping',
    ERROR: 'error',
};

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

/**
 * Workspace Manager
 */

class WorkspaceManager extends EventEmitter {

    #rootPath;  // Root path for all user workspaces managed by this instance
    #index;     // Conf instance for the global workspaces.json index

    #workspaces = new Map(); // Initialized Workspace Instances

    /**
     * Constructor - Initializes the manager, loads the index, and performs initial scan/validation.
     * @param {Object} options - Configuration options
     * @param {string} options.workspaceRootPath - Root path where workspace directories are stored.
     * @param {string} options.configPath - Path to the configuration file (workspaces.json) for the index.
     * @param {object} [options.eventEmitterOptions] - Options for EventEmitter2.
     */
    constructor(options = {}) {
        super(options.eventEmitterOptions || {});

        if (!options.rootPath) {
            throw new Error('Root path is required');
        }

        if (!options.index) {
            throw new Error('Index instance is required');
        }

        this.#rootPath = options.rootPath;
        this.#index = options.index;

        // Perform initial scan and load valid workspaces listed in the index
        if (!Array.isArray(this.#index.get('workspaces'))) {
            this.#index.set('workspaces', []);
        }

        this.#performInitialScan();
    }

    /**
     * Async initialization tasks (if any).
     * Called by Server.js after constructor.
     */
    async initialize() {
         // Currently, all essential setup is done in the constructor (#performInitialScan).
         // This method is here to fulfill the interface expected by Server.js.
         // Add any future async initialization steps here.
         // Example: Load workspaces marked for auto-start?
        // await this.startAutoStartWorkspaces();
        debug(`WorkspaceManager initialized with rootPath: ${this.#rootPath}`);
    }

    /**
     * Getters
     */

    get rootPath() { return this.#rootPath; }
    // Updated getter for the index to return the array
    get index() { return this.#getWorkspacesArrayIndex(); }
    get workspaces() { return Array.from(this.#workspaces.values()); }
    get activeWorkspaces() {
        return this.workspaces.filter(ws => ws.status === WORKSPACE_STATUS.ACTIVE);
    }

    /**
     * Simplified Workspace Manager API
     */

    async createWorkspace(name, owner, options = {}) {
        const workspaceRootPath = options.workspaceRootPath || this.#rootPath;

        if (!workspaceRootPath) {
            throw new Error('Workspace rootPath is required to create a workspace. Either provide it in options or ensure the manager has a default rootPath.');
        }

        if (!name || typeof name !== 'string') {
            throw new Error('Workspace name (string) is required');
        }

        if (!owner || typeof owner !== 'string') {
            throw new Error('Workspace owner (string) is required');
        }

        const workspaceID = this.#sanitizeWorkspaceName(name);
        const workspacePath = path.join(workspaceRootPath, owner, workspaceID);

        // Check for conflicts using the new index structure (array)
        const existingWorkspaces = this.index; // Use getter which calls #getWorkspacesArrayIndex()
        if (existingWorkspaces.some(ws => ws.id === workspaceID)) {
            throw new Error(`Workspace ID "${workspaceID}" already registered.`);
        }
        if (existingWorkspaces.some(ws => ws.rootPath === workspacePath)) {
            throw new Error(`Workspace path "${workspacePath}" is already in use.`);
        }

        // If workspacePath exists on disk (but not indexed), throw an error
        if (existsSync(workspacePath)) {
            throw new Error(`Workspace path "${workspacePath}" already exists.`);
        }

        // Use Object.values on the index getter to check metadata
        if (Object.values(this.index).some(ws => ws.rootPath === workspacePath)) {
            throw new Error(`Workspace path "${workspacePath}" is already in use.`);
        }

        // Prepare configuration for workspace.json
        const creationTime = new Date().toISOString();
        // Remove workspaceRootPath from options before passing to parser
        const creationOptions = { ...options };
        delete creationOptions.workspaceRootPath;

        let workspaceConfigData = this.#parseWorkspaceOptions({ // Use helper to merge defaults
            id: workspaceID,
            name: name, // Keep original name for display?
            owner: owner, // Explicitly pass owner
            ...creationOptions, // User options override defaults
            // Ensure crucial fields are set
            created: creationTime,
            updated: creationTime,
            status: WORKSPACE_STATUS.AVAILABLE, // Initial status in workspace.json
            // Ensure restApi structure exists if not provided in options
            restApi: options?.restApi || { port: null, token: null },
        });

        // Validate the final config data *before* creating files
        if (!this.#validateWorkspaceConfig(workspaceConfigData)) {
            throw new Error('Invalid workspace configuration options provided.');
        }

        // Create workspace directory and standard subdirectories
        await this.#ensureDirectoryExists(workspacePath);
        for (const dirName of Object.values(WORKSPACE_DIRECTORIES)) {
            await this.#ensureDirectoryExists(path.join(workspacePath, dirName));
        }

        // Create the workspace's own config file (workspace.json)
        const workspaceConfigFile = path.join(workspacePath, WORKSPACE_CONFIG_FILENAME);
        try {
            // Instantiate Conf - this will create the file with the data if it doesn't exist
            const configDir = path.dirname(workspaceConfigFile);
            const configName = path.basename(workspaceConfigFile, '.json');
            const workspaceConf = new Conf({ configName: configName, cwd: configDir });

            // Set all properties at once using the validated config data
            for (const key in workspaceConfigData) {
                 workspaceConf.set(key, workspaceConfigData[key]);
            }

            debug(`Created workspace config via Conf at: ${workspaceConf.path}`); // Conf.path gives the full path
        } catch (err) {
            // Clean up created directories if config write fails?
            logger.error(`Failed to write workspace config file via Conf for ${workspaceID}: ${err.message}`);
            // Attempt cleanup
            try {
                await fsPromises.rm(workspacePath, { recursive: true, force: true });
            } catch (cleanupErr) {
                logger.error(`Failed to clean up temp workspace directory ${workspacePath}: ${cleanupErr.message}`);
            }
            throw new Error(`Failed to write workspace config file via Conf for ${workspaceID}: ${err.message}`);
        }

        // Add entry to the global index (workspaces array)
        const indexEntry = {
            id: workspaceID,
            rootPath: workspacePath, // Standardize on rootPath for the index entry
            status: WORKSPACE_STATUS.AVAILABLE, // Set to available after successful import/copy
            indexed: new Date().toISOString(),
            lastAccessed: null,
            restApiStatus: WORKSPACE_API_STATUS.STOPPED,
            pm2Name: null,
        };

        this.#addIndexEntry(indexEntry);
        debug(`Added workspace "${workspaceID}" to global index array.`);

        this.emit('workspace:created', indexEntry);
        return indexEntry; // Return the metadata added to the index
    }

    /**
     * Get the loaded Workspace instance from memory.
     * Returns undefined if the workspace is not currently loaded or if the user lacks access.
     * Use `openWorkspace(id)` first to ensure the workspace is loaded.
     * @param {string} userID The ID of the user requesting access.
     * @param {string} workspaceID The ID of the workspace.
     * @returns {Workspace|undefined} The loaded Workspace instance or undefined.
     */
    getWorkspace(userID, workspaceID) {
        if (!userID) {
            throw new Error('UserID is required to get a workspace.');
        }
        if (!this.#checkAccess(workspaceID, userID)) {
            // Access denied message logged within #checkAccess
            return undefined;
        }
        // Returns the loaded Workspace instance if available in memory and accessible
        return this.#workspaces.get(workspaceID);
    }

    /**
     * List workspace metadata from the index for workspaces the user can access,
     * optionally filtering by status.
     * @param {string} userID The ID of the user requesting the list.
     * @param {string} [status] - Optional status (from WORKSPACE_STATUS) to filter by.
     * @returns {Array<Object>} Array of accessible workspace metadata objects.
     */
    listWorkspaces(userID, status = null) {
        if (!userID) {
            throw new Error('UserID is required to list workspaces.');
        }
        // Use Object.values to get an array of metadata objects from the index
        const allWorkspacesMetadata = this.index;

        // Filter by accessibility first
        const accessibleWorkspaces = allWorkspacesMetadata.filter(ws =>
             this.#checkAccess(ws.id, userID, 'read', ws) // Pass metadata for efficiency
        );

        if (!status) {
            return accessibleWorkspaces;
        }

        if (!Object.values(WORKSPACE_STATUS).includes(status)) {
            debug('Invalid status filter: ' + status);
            return []; // Return empty array for invalid status
        }

        return accessibleWorkspaces.filter(workspace => workspace.status === status);
    }

    /**
     * (legacy API) List all currently open (loaded) Workspace instances accessible to the user.
     * @param {string} userID The ID of the user requesting the list.
     * @returns {Array<Workspace>} Array of open (loaded) Workspace instances.
     */
    listOpenWorkspaces(userID) {
        // Note: No explicit userID check here as it delegates to listLoadedWorkspaces
        return this.listLoadedWorkspaces(userID);
    }

    /**
     * List all currently loaded (in-memory) Workspace instances accessible to the user.
     * @param {string} userID The ID of the user requesting the list.
     * @returns {Array<Workspace>} Array of loaded Workspace instances.
     */
    listLoadedWorkspaces(userID) {
        if (!userID) {
            throw new Error('UserID is required to list loaded workspaces.');
        }
        return Array.from(this.#workspaces.values()).filter(ws =>
            this.#checkAccess(ws.id, userID, 'read', ws.config) // Use loaded config
        );
    }

    /**
     * List all currently active (loaded and started) Workspace instances accessible to the user.
     * @param {string} userID The ID of the user requesting the list.
     * @returns {Array<Workspace>} Array of active Workspace instances.
     */
    listActiveWorkspaces(userID) {
        if (!userID) {
            throw new Error('UserID is required to list active workspaces.');
        }
        return this.listLoadedWorkspaces(userID).filter(ws => ws.status === WORKSPACE_STATUS.ACTIVE);
    }

    /**
     * Checks if a workspace exists in the index AND the user has access.
     * @param {string} userID The ID of the user checking.
     * @param {string} workspaceID The ID of the workspace.
     * @returns {boolean} True if the workspace exists and the user has access.
     */
    hasWorkspace(userID, workspaceID) {
        if (!userID) {
            throw new Error('UserID is required to check if workspace exists.');
        }
        // Check if an entry with the ID exists in the index array AND user has access
        return this.#findIndexEntry(workspaceID) !== undefined && this.#checkAccess(workspaceID, userID);
    }

    /**
     * Checks if a workspace is loaded in memory AND the user has access.
     * @param {string} userID The ID of the user checking.
     * @param {string} workspaceID The ID of the workspace.
     * @returns {boolean} True if loaded and accessible.
     */
    isLoaded(userID, workspaceID) {
        if (!userID) {
            throw new Error('UserID is required to check if workspace is loaded.');
        }
        return this.#workspaces.has(workspaceID) && this.#checkAccess(workspaceID, userID);
    }

    /**
     * Checks if a workspace is active (loaded and started) AND the user has access.
     * @param {string} userID The ID of the user checking.
     * @param {string} workspaceID The ID of the workspace.
     * @returns {boolean} True if active and accessible.
     */
    isActive(userID, workspaceID) {
        if (!userID) {
            throw new Error('UserID is required to check if workspace is active.');
        }
        const ws = this.#workspaces.get(workspaceID);
        return ws && ws.status === WORKSPACE_STATUS.ACTIVE && this.#checkAccess(workspaceID, userID);
    }

    /**
     * Open a workspace: Loads configuration, validates it, and creates the Workspace instance in memory.
     * Does NOT start the workspace (i.e., connect to DB).
     * Requires 'read' access.
     * Updates index status if errors are found (NOT_FOUND, ERROR).
     * @param {string} userID The ID of the user attempting to open the workspace.
     * @param {string} workspaceID The ID of the workspace to open.
     * @returns {Promise<Workspace|null>} The loaded Workspace instance or null if opening failed or access denied.
     */
    async openWorkspace(userID, workspaceID) {
        if (!userID) {
            throw new Error('UserID is required to open a workspace.');
        }
        // Access Check: Requires read access
        if (!this.#checkAccess(workspaceID, userID, 'read')) {
            // No warning log here, just return null as if not found/accessible
            debug(`User ${userID} denied read access to open workspace ${workspaceID}.`);
            return null;
        }

        debug(`Attempting to open workspace ${workspaceID}...`);

        // 1. Check if already loaded (access check already done)
        if (this.#workspaces.has(workspaceID)) {
            debug(`Workspace "${workspaceID}" is already loaded.`);
            return this.#workspaces.get(workspaceID);
        }

        // 2. Get index entry from array
        const indexEntry = this.#findIndexEntry(workspaceID);
        if (!indexEntry) { // Should not happen if #checkAccess passed and index is consistent
             logger.error(`Workspace "${workspaceID}" not found in index array after access check. Inconsistency?`);
             return null;
        }

        const workspacePath = indexEntry.rootPath;
        let newStatus = indexEntry.status;

        // Don't try to open if known bad state (checkAccess doesn't prevent this)
        if (newStatus === WORKSPACE_STATUS.NOT_FOUND || newStatus === WORKSPACE_STATUS.ERROR) {
            logger.warn(`Attempted to open workspace "${workspaceID}" with status ${newStatus}. Aborting.`);
            return null;
        }
        // Don't try to open if REMOVED
         if (newStatus === WORKSPACE_STATUS.REMOVED) {
            logger.warn(`Attempted to open workspace "${workspaceID}" which is marked as REMOVED. Aborting.`);
            return null;
        }

        // 3. Check path existence
        if (!existsSync(workspacePath)) {
            debug(`Workspace path not found for ${workspaceID}: ${workspacePath}`);
            newStatus = WORKSPACE_STATUS.NOT_FOUND;
        } else {
            // 4. Try Reading/Validating Config and Instantiating
            let configStore;
            try {
                // Find the actual config file path
                const configFilePath = this.#findWorkspaceConfigPath(workspacePath);
                if (!configFilePath) {
                     throw new Error('Workspace config file not found in standard locations.');
                }
                const configDir = path.dirname(configFilePath);
                const configName = path.basename(configFilePath, '.json');
                configStore = new Conf({ configName: configName, cwd: configDir });
                const configData = configStore.store;
                // Validate config (implicitly checks owner existence etc.)
                if (!this.#validateWorkspaceConfig(configData)) {
                    throw new Error('Workspace configuration validation failed.');
                }
                // Config valid, try instantiating
                const workspace = new Workspace({
                    rootPath: workspacePath, // Pass rootPath to constructor
                    configStore: configStore,
                });
                this.#workspaces.set(workspaceID, workspace); // Add to loaded map
                newStatus = WORKSPACE_STATUS.AVAILABLE; // Or INACTIVE? AVAILABLE seems better after load
                debug(`Workspace instance loaded successfully for ${workspaceID}.`);
                // Update index status if it changed (e.g., from IMPORTED)
                if (newStatus !== indexEntry.status && indexEntry.status !== WORKSPACE_STATUS.ACTIVE) { // Don't override ACTIVE status
                     // this.#index.set(`workspaces.${workspaceID}.status`, newStatus);
                     this.#updateIndexEntry(workspaceID, { status: newStatus });
                }
                this.emit('workspace:opened', workspace);
                return workspace; // Success!

            } catch (err) {
                logger.error(`Failed to load/validate/instantiate workspace ${workspaceID}: ${err.message}`);
                newStatus = WORKSPACE_STATUS.ERROR;
            }
        }

        // 5. Update index if status changed to NOT_FOUND or ERROR
        if (newStatus !== indexEntry.status) {
            // this.#index.set(`workspaces.${workspaceID}.status`, newStatus);
            this.#updateIndexEntry(workspaceID, { status: newStatus });
            debug(`Updated status for ${workspaceID} to ${newStatus} during open attempt.`);
        }

        // If we reached here, opening failed
        return null;
    }

    /**
     * Close a workspace: Stops it if active, and removes the instance from memory.
     * Requires 'write' access (owner only).
     * @param {string} userID The ID of the user attempting to close the workspace.
     * @param {string} workspaceID The ID of the workspace to close.
     * @returns {Promise<boolean>} True if closed successfully or already closed, false on error or access denied.
     */
    async closeWorkspace(userID, workspaceID) {
        if (!userID) {
            throw new Error('UserID is required to close a workspace.');
        }
        // Access Check: Requires write access
        if (!this.#checkAccess(workspaceID, userID, 'write')) {
            logger.warn(`User ${userID} denied write access to close workspace ${workspaceID}.`);
            return false;
        }

        debug(`Attempting to close workspace ${workspaceID}...`);
        const workspace = this.#workspaces.get(workspaceID);

        if (!workspace) {
            debug(`Workspace "${workspaceID}" is not loaded. Cannot close.`);
            return true; // Already closed / not loaded
        }

        // Stop the workspace if it is active
        if (workspace.status === WORKSPACE_STATUS.ACTIVE) {
            debug(`Workspace "${workspaceID}" is active. Stopping before closing...`);
            // stopWorkspace already checks access, but call it anyway
            const stopped = await this.stopWorkspace(userID, workspaceID);
            if (!stopped) {
                logger.error(`Failed to stop workspace "${workspaceID}" during close operation. Aborting close.`);
                // Should we still remove from map if stop failed? Probably not.
                return false;
            }
        }

        // Remove from the loaded map
        this.#workspaces.delete(workspaceID);
        debug(`Removed workspace "${workspaceID}" from loaded map.`);

        // Ensure index status is INACTIVE (stopWorkspace should handle this, but good safety check)
        const indexEntry = this.#findIndexEntry(workspaceID);
        if (indexEntry && indexEntry.status !== WORKSPACE_STATUS.REMOVED) { // Avoid overwriting REMOVED status
             // Ensure status is INACTIVE after successful close/stop
            if (indexEntry.status !== WORKSPACE_STATUS.INACTIVE) {
                 // this.#index.set(`workspaces.${workspaceID}.status`, WORKSPACE_STATUS.INACTIVE);
                 this.#updateIndexEntry(workspaceID, { status: WORKSPACE_STATUS.INACTIVE });
                 debug(`Ensured index status is INACTIVE for closed workspace ${workspaceID}.`);
            }
        }

        this.emit('workspace:closed', { id: workspaceID });
        return true;
    }

    /**
     * Starts a workspace: Ensures it's loaded, calls its start() method (connects DB, etc.).
     * Updates index status to ACTIVE.
     * Requires 'write' access (owner only).
     * @param {string} userID - The ID of the user attempting to start the workspace.
     * @param {string} workspaceID - The ID of the workspace to start.
     * @returns {Promise<Workspace|null>} The active Workspace instance, or null if starting failed or access denied.
     */
    async startWorkspace(userID, workspaceID) {
        if (!userID) {
            throw new Error('UserID is required to start a workspace.');
        }
        // Access Check: Requires write access (owner only for now)
        if (!this.#checkAccess(workspaceID, userID, 'write')) {
            logger.warn(`User ${userID} denied write access to start workspace ${workspaceID}.`);
            return null;
        }

        let workspace = this.#workspaces.get(workspaceID);

        // If already loaded and active, return it
        if (workspace && workspace.status === WORKSPACE_STATUS.ACTIVE) {
            debug(`Workspace "${workspaceID}" is already active.`);
            return workspace;
        }

        // If not loaded, try to open (load) it first (requires read access, implicitly checked by #checkAccess above)
        if (!workspace) {
            debug(`Workspace "${workspaceID}" is not loaded. Attempting to open...`);
            workspace = await this.openWorkspace(userID, workspaceID); // Pass userID
            if (!workspace) {
                 // openWorkspace failed (logged error within method or access denied)
                 return null;
            }
             // If openWorkspace succeeded, the instance is now in #workspaces
        }

        // Now we have a loaded workspace instance (either pre-existing or just loaded)
        // Check its status before trying to start (openWorkspace should handle bad states, but double-check)
        if (workspace.status === WORKSPACE_STATUS.ERROR || workspace.status === WORKSPACE_STATUS.NOT_FOUND || workspace.status === WORKSPACE_STATUS.REMOVED) {
             logger.error(`Cannot start workspace "${workspaceID}" due to its status: ${workspace.status}`);
             return null;
        }

        // Start the workspace's internal resources (DB, etc.)
        try {
            await workspace.start(); // Workspace handles its internal status and persists ACTIVE
            debug(`Workspace "${workspaceID}" instance started successfully.`);
        } catch (err) {
            // workspace.start() should log its own errors
             logger.error(`Failed to start workspace "${workspaceID}" instance: ${err.message}`);
             // Update index to ERROR state? Or rely on persisted status set by Workspace.start() error handling?
             // Let's explicitly set index to ERROR for clarity from manager perspective.
             // this.#index.set(`workspaces.${workspaceID}.status`, WORKSPACE_STATUS.ERROR);
             this.#updateIndexEntry(workspaceID, { status: WORKSPACE_STATUS.ERROR });
             return null; // Starting failed
        }

        // Update global index status to ACTIVE and last accessed time
        // Workspace.start() should persist ACTIVE to its own file, this updates the global index.
        // this.#index.set(`workspaces.${workspaceID}.status`, WORKSPACE_STATUS.ACTIVE);
        // this.#index.set(`workspaces.${workspaceID}.lastAccessed`, new Date().toISOString());
        this.#updateIndexEntry(workspaceID, {
            status: WORKSPACE_STATUS.ACTIVE,
            lastAccessed: new Date().toISOString(),
        });
        debug(`Updated global index for active workspace "${workspaceID}".`);

        // Emit event (already emitted by Workspace.start, is this needed here? Maybe for manager level)
        // this.emit('workspace:started', workspace);
        return workspace;
    }

    /**
     * Stops an active workspace: Calls its stop() method.
     * Requires 'write' access (owner only).
     * Note: Does not remove the instance from memory, use closeWorkspace for that.
     * @param {string} userID - The ID of the user attempting to stop the workspace.
     * @param {string} workspaceID - The ID of the workspace to stop.
     * @returns {Promise<boolean>} True if stopped successfully, false if not found, not active, or access denied.
     */
    async stopWorkspace(userID, workspaceID) {
        if (!userID) {
            throw new Error('UserID is required to stop a workspace.');
        }
        // Access Check: Requires write access
        if (!this.#checkAccess(workspaceID, userID, 'write')) {
            logger.warn(`User ${userID} denied write access to stop workspace ${workspaceID}.`);
            return false;
        }

        const workspace = this.#workspaces.get(workspaceID);
        if (!workspace) {
            // If not in the map, it's not loaded or already stopped/closed
            debug(`Workspace "${workspaceID}" is not loaded or already stopped/closed.`);
            // Ensure index status reflects inactivity if it exists and user had access
            const indexEntry = this.#findIndexEntry(workspaceID);
            if (indexEntry && indexEntry.status === WORKSPACE_STATUS.ACTIVE) {
                 // Only update index if user actually had write access to the workspace ID
                // this.#index.set(`workspaces.${workspaceID}.status`, WORKSPACE_STATUS.INACTIVE);
                this.#updateIndexEntry(workspaceID, { status: WORKSPACE_STATUS.INACTIVE });
                debug(`Set index status to INACTIVE for non-loaded workspace "${workspaceID}".`);
            }
            return true; // Considered success if not active/loaded
        }

        try {
            await workspace.stop(); // Workspace handles its internal status
            debug(`Workspace "${workspaceID}" instance stopped successfully.`);
        } catch (err) {
            // Log the error but continue cleanup
            logger.error(`Error stopping workspace "${workspaceID}" instance: ${err.message}`);
            // Decide if we should re-throw or just log - returning false indicates failure
            return false;
        }

        // Workspace.stop() now handles setting internal and persisted status to INACTIVE.
        // We just need to ensure the index reflects this if the stop was successful (or attempted).
        // No need to remove from #workspaces map here, closeWorkspace will do that.
        // if (this.index[workspaceID]) { // Check replaced by findIndexEntry
        const indexEntry = this.#findIndexEntry(workspaceID);
        if (indexEntry) {
             // this.#index.set(`workspaces.${workspaceID}.status`, WORKSPACE_STATUS.INACTIVE);
             this.#updateIndexEntry(workspaceID, { status: WORKSPACE_STATUS.INACTIVE });
             debug(`Updated global index status to INACTIVE for workspace "${workspaceID}".`);
        }

        this.emit('workspace:stopped', { id: workspaceID });

        // Stop the associated REST API if it exists
        await this.stopRestApi(userID, workspaceID); // Pass userID

        // Previously, stopWorkspace called closeWorkspace implicitly.
        // This caused issues. Now stop only stops, close only closes.
        // If the intention was to stop AND close, the caller should call both.
        // Example: destroyWorkspace calls stopWorkspace then closeWorkspace.

        // Stop and close the workspace if it's loaded
        // if (this.#workspaces.has(workspaceID)) {
        //     debug(`Workspace "${workspaceID}" is loaded. Closing before removing from index.`);
        //     await this.closeWorkspace(workspaceID); // Stop and remove from map
        // }

        return true;
    }

    /**
     * Remove a workspace from the global index. Stops it if active.
     * Does NOT delete files from disk.
     * Requires 'write' access (owner only).
     * @param {string} userID - The ID of the user attempting to remove the workspace.
     * @param {string} workspaceID - Workspace ID/name to remove.
     * @returns {Promise<boolean>} True if removed, false if not found or access denied.
     */
    async removeWorkspace(userID, workspaceID) {
        if (!userID) {
            throw new Error('UserID is required to remove a workspace.');
        }
        // Access Check: Requires write access
        if (!this.#checkAccess(workspaceID, userID, 'write')) {
            logger.warn(`User ${userID} denied write access to remove workspace ${workspaceID}.`);
            return false;
        }

        debug(`Attempting to remove workspace ${workspaceID} from index by user ${userID}...`);
        const indexEntry = this.#findIndexEntry(workspaceID);
        if (!indexEntry) {
            debug(`Workspace "${workspaceID}" not found in index. Cannot remove.`);
            return false;
        }

        // Stop the REST API service if it's running
        await this.stopRestApi(userID, workspaceID); // Pass userID

        // Stop and close the workspace if it's loaded
        if (this.#workspaces.has(workspaceID)) {
            debug(`Workspace "${workspaceID}" is loaded. Stopping and closing before removing from index.`);
            await this.stopWorkspace(userID, workspaceID);
            await this.closeWorkspace(userID, workspaceID); // Close also removes from map
        }

        // Remove from the global index
        // this.#index.delete(`workspaces.${workspaceID}`);
        const removed = this.#removeIndexEntry(workspaceID);
        if (removed) {
            debug(`Removed workspace "${workspaceID}" from global index array.`);
        } else {
            debug(`Workspace "${workspaceID}" not found in index array for removal.`);
            // Should we return false here? The check earlier should have caught it.
            // Let's assume if we reach here, the earlier check passed, so removal should succeed or indicates inconsistency.
            logger.warn(`Inconsistency: Workspace ${workspaceID} found initially but not during removal.`);
        }

        this.emit('workspace:removed', { id: workspaceID });
        return removed; // Return true/false based on removal success
    }

    /**
     * Destroy a workspace: Stops it if active, closes it, removes it from the index,
     * and deletes its directory from the filesystem.
     * Requires 'write' access (owner only).
     * @param {string} userID - The ID of the user attempting to destroy the workspace.
     * @param {string} workspaceID - Workspace ID/name to destroy.
     * @param {boolean} [forceDestroy=false] - Skip checks and force deletion (use with caution, still checks ownership).
     * @returns {Promise<boolean>} True if destroyed, false if not found or access denied.
     */
    async destroyWorkspace(userID, workspaceID, forceDestroy = false) {
        if (!userID) {
            throw new Error('UserID is required to destroy a workspace.');
        }
         // Access Check: Requires write access, even if forcing
         if (!this.#checkAccess(workspaceID, userID, 'write')) {
            logger.warn(`User ${userID} denied write access to destroy workspace ${workspaceID}.`);
            return false;
        }

        debug(`Attempting to destroy workspace ${workspaceID} by user ${userID}...`);
        const indexEntry = this.#findIndexEntry(workspaceID);
        if (!indexEntry) {
            debug(`Workspace "${workspaceID}" not found in index. Cannot destroy.`);
            return false;
        }

        // Stop the REST API service first
        await this.stopRestApi(userID, workspaceID); // Pass userID

        const workspacePath = indexEntry.rootPath;

        // Stop and close the workspace if it's loaded
        if (this.#workspaces.has(workspaceID)) {
             debug(`Workspace "${workspaceID}" is loaded. Stopping and closing before destroying.`);
             await this.stopWorkspace(userID, workspaceID);
             await this.closeWorkspace(userID, workspaceID); // Close also removes from map
        }

        // Remove from the global index *before* deleting files
        // this.#index.delete(`workspaces.${workspaceID}`);
        const removed = this.#removeIndexEntry(workspaceID);
        if (removed) {
            debug(`Removed workspace "${workspaceID}" from global index array before deletion.`);
        } else {
            // This shouldn't happen if indexEntry was found earlier
             logger.error(`Failed to remove workspace ${workspaceID} from index during destroy operation.`);
             return false; // Cannot proceed with deletion if removal failed
        }

        // Delete the workspace directory
        try {
            debug(`Attempting to delete workspace directory: ${workspacePath}`);
            await fsPromises.rm(workspacePath, { recursive: true, force: true }); // Use force: true cautiously
            debug(`Successfully deleted workspace directory: ${workspacePath}`);
        } catch (err) {
            // Log the error, but the index entry is already removed.
            // Consider if the index entry should be restored or marked as 'delete_failed'?
            logger.error(`Failed to delete workspace directory "${workspacePath}": ${err.message}`);
            // Re-add to index with error status?
            // this.#index.set(`workspaces.${workspaceID}`, { ...indexEntry, status: WORKSPACE_STATUS.ERROR, error: `Deletion failed: ${err.message}` });
            // Re-add the original entry (might be slightly stale if stop/close changed status)
            // but mark it as ERROR
            this.#addIndexEntry({ ...indexEntry, status: WORKSPACE_STATUS.ERROR, error: `Deletion failed: ${err.message}` });
            this.emit('workspace:destroy_failed', { id: workspaceID, error: err.message });
            return false;
        }

        this.emit('workspace:destroyed', { id: workspaceID });
        return true;
    }

    /**
     * Import a workspace from a zip file or an existing directory.
     * Adds the workspace to the global index, does NOT start it.
     * The importing user becomes the owner of the imported workspace.
     * @param {string} sourcePath - Path to the zip file or workspace directory.
     * @param {string} userID - The ID of the user performing the import (will become owner).
     * @param {boolean} [inPlace=false] - If sourcePath is a directory, import it without copying (only adds to index).
     * @returns {Promise<Object>} Metadata of the imported workspace from the global index.
     */
    async importWorkspace(sourcePath, userID, inPlace = false) {
        if (!userID) {
            throw new Error('UserID is required to import a workspace and assign ownership.');
        }
        if (!existsSync(sourcePath)) {
            throw new Error(`Source path does not exist: ${sourcePath}`);
        }

        let importPath = path.resolve(sourcePath);
        let workspaceConfigData;
        let workspaceID;
        let finalWorkspacePath;
        let isZip = importPath.toLowerCase().endsWith('.zip');
        let tempExtractPath = null;

        try {
            if (isZip) {
                debug(`Importing workspace from zip file: ${importPath}`);
                tempExtractPath = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'canvas-import-'));
                debug(`Extracting zip to temporary path: ${tempExtractPath}`);
                const zip = new AdmZip(importPath);
                zip.extractAllTo(tempExtractPath, true /* overwrite */);

                // After extraction, treat the temp path as the source directory
                importPath = tempExtractPath;
                inPlace = false; // Cannot run in-place from temp dir
            }

            // Validate the source directory (original or extracted)
            let configFilePath = this.#findWorkspaceConfigPath(importPath);
            if (!existsSync(configFilePath)) {
                throw new Error(`Import source directory is missing workspace.json: ${importPath}`);
            }

            // Read config to get ID and validate
            try {
                const content = await fsPromises.readFile(configFilePath, 'utf8');
                workspaceConfigData = JSON.parse(content);
            } catch (err) {
                throw new Error(`Failed to read/parse workspace.json in import source: ${err.message}`);
            }

            // Temporarily set owner for validation, will be overridden later
            const originalOwner = workspaceConfigData.owner;
            workspaceConfigData.owner = userID;
            if (!this.#validateWorkspaceConfig(workspaceConfigData, true)) {
                // Restore original owner in error message if validation failed
                workspaceConfigData.owner = originalOwner;
                throw new Error(`Import source workspace.json is invalid (owner temporarily set to ${userID} for validation). Original: ${JSON.stringify(workspaceConfigData)}`);
            }
            workspaceID = workspaceConfigData.id; // Use ID from the imported config

            // Check for conflicts (ID or target path)
            const existingWorkspaces = this.index; // Use getter
            if (existingWorkspaces.some(ws => ws.id === workspaceID)) {
                throw new Error(`Workspace ID "${workspaceID}" from import source already exists in the index.`);
            }

            if (inPlace) {
                if (isZip) throw new Error("Cannot import zip file 'inPlace'.");
                finalWorkspacePath = importPath; // Use the source path directly
                // Check if path conflicts with existing *indexed* paths
                // Note: Access check isn't directly applicable here as we're checking global paths
                if (existingWorkspaces.some(ws => ws.rootPath === finalWorkspacePath)) {
                    throw new Error(`Workspace path "${finalWorkspacePath}" is already indexed.`);
                }
                debug(`Importing workspace "${workspaceID}" in-place from: ${finalWorkspacePath}`);
                // Overwrite owner in the existing workspace.json
                 try {
                     const conf = new Conf({configName: 'workspace', cwd: finalWorkspacePath});
                     conf.set('owner', userID);
                     conf.set('updated', new Date().toISOString());
                     debug(`Updated owner to ${userID} in in-place workspace.json`);
                 } catch(err) {
                     throw new Error(`Failed to update owner in in-place workspace.json: ${err.message}`);
                 }
            } else {
                finalWorkspacePath = path.join(this.#rootPath, workspaceID);
                // Check if target directory already exists (could be unrelated files)
                if (existsSync(finalWorkspacePath)) {
                    throw new Error(`Target directory for import already exists: ${finalWorkspacePath}`);
                }
                 debug(`Copying workspace "${workspaceID}" from ${importPath} to ${finalWorkspacePath}`);
                 // fsPromises.cp is available in Node 16.7+
                 await fsPromises.cp(importPath, finalWorkspacePath, { recursive: true });

                 // Ensure workspace.json includes restApi structure and correct owner after copy
                 try {
                     const conf = new Conf({configName: 'workspace', cwd: finalWorkspacePath});
                     conf.set('owner', userID);
                     conf.set('restApi', conf.get('restApi', { port: null, token: null })); // Ensure object exists
                     conf.set('updated', new Date().toISOString());
                     debug(`Set owner to ${userID} in copied workspace.json`);
                 } catch(err) {
                     throw new Error(`Failed to update owner/restApi in copied workspace.json: ${err.message}`);
                 }
                 debug(`Workspace copy complete.`);
            }

            // Add entry to the global index (workspaces array)
            const indexEntry = {
                id: workspaceID,
                rootPath: finalWorkspacePath, // Standardize on rootPath for the index entry
                status: WORKSPACE_STATUS.AVAILABLE, // Set to available after successful import/copy
                indexed: new Date().toISOString(),
                lastAccessed: null,
                restApiStatus: WORKSPACE_API_STATUS.STOPPED,
                pm2Name: null,
            };

            this.#addIndexEntry(indexEntry);
            debug(`Added imported workspace "${workspaceID}" to global index array.`);

            this.emit('workspace:imported', { ...indexEntry, owner: userID }); // Include owner in event
            return { ...indexEntry, owner: userID }; // Include owner in return

        } catch (error) {
            // Clean up temp directory if extraction happened
            if (tempExtractPath) {
                try {
                    await fsPromises.rm(tempExtractPath, { recursive: true, force: true });
                    debug(`Cleaned up temporary extraction path: ${tempExtractPath}`);
                } catch (cleanupError) {
                    logger.error(`Failed to clean up temp import directory ${tempExtractPath}: ${cleanupError.message}`);
                }
            }
            // Re-throw the original error
            throw error;
        }
    }

    /**
     * Export a workspace as a zip file.
     * Requires 'write' access (owner only).
     * @param {string} userID - The ID of the user attempting the export.
     * @param {string} workspaceID - Source workspace id.
     * @param {string} dstPath - Destination path for the zip file.
     * @returns {Promise<string>} Path to the created zip file.
     */
    async exportWorkspace(userID, workspaceID, dstPath) {
        if (!userID) {
            throw new Error('UserID is required to export a workspace.');
        }
        // Access Check: Requires write access
        if (!this.#checkAccess(workspaceID, userID, 'write')) {
            logger.warn(`User ${userID} denied write access to export workspace ${workspaceID}.`);
            // Throw error instead of returning null for path?
            throw new Error(`Access Denied: User ${userID} cannot export workspace ${workspaceID}.`);
        }

        if (!workspaceID) throw new Error('Workspace ID is required for export.');
        if (!dstPath) throw new Error('Destination path is required for export.');

        // const indexEntry = this.index[workspaceID];
        const indexEntry = this.#findIndexEntry(workspaceID);
        if (!indexEntry) {
            throw new Error(`Workspace "${workspaceID}" not found in index array.`);
        }

        // Ensure workspace is not active (loaded instance status check)
        const workspaceInstance = this.#workspaces.get(workspaceID);
        if (workspaceInstance && workspaceInstance.status === WORKSPACE_STATUS.ACTIVE) {
            // Automatically stop it? Or force user to stop?
            // Let's stop it automatically for convenience, as user has write access.
             debug(`Workspace ${workspaceID} is active. Stopping automatically before export.`);
             await this.stopWorkspace(userID, workspaceID);
            // throw new Error(`Workspace "${workspaceID}" is active. Stop it before exporting.`);
        }
        // Also check index status as a fallback if not loaded
        // if (!workspaceInstance && indexEntry.status === WORKSPACE_STATUS.ACTIVE) {
        //     throw new Error(`Workspace "${workspaceID}" is marked as active in index. Stop it before exporting.`);
        // }

        const sourcePath = indexEntry.rootPath;
        let outputZipPath = dstPath;

        // If dstPath is a directory, create zip name based on workspace ID
        try {
            const stats = await fsPromises.stat(dstPath);
            if (stats.isDirectory()) {
                 outputZipPath = path.join(dstPath, `${workspaceID}.zip`);
            }
        } catch (e) {
            // If stat fails, dstPath likely doesn't exist, assume it's the full file path
            // Ensure parent directory exists if dstPath includes directories
             const parentDir = path.dirname(outputZipPath);
             if (!existsSync(parentDir)) {
                 await this.#ensureDirectoryExists(parentDir);
             }
        }

        // Ensure path ends with .zip if it wasn't auto-generated
        if (!outputZipPath.toLowerCase().endsWith('.zip')) {
             outputZipPath += '.zip';
        }

        debug(`Exporting workspace "${workspaceID}" from ${sourcePath} to ${outputZipPath} by user ${userID}`);

        try {
            const zip = new AdmZip();
            // Add the entire workspace folder content to the zip
            zip.addLocalFolder(sourcePath, ''); // Add content directly at zip root
            await zip.writeZipPromise(outputZipPath);
            debug(`Workspace export successful: ${outputZipPath}`);
            this.emit('workspace:exported', { id: workspaceID, path: outputZipPath });
            return outputZipPath;
        } catch (err) {
            throw new Error(`Failed to create workspace zip file at ${outputZipPath}: ${err.message}`);
        }
    }

     /**
     * Get the status of a workspace from the global index.
     * Requires 'read' access.
     * @param {string} userID - The ID of the user requesting the status.
     * @param {string} workspaceID - The ID of the workspace.
     * @returns {string|null} Status string (e.g., 'active', 'inactive') or null if not found or access denied.
     */
    getWorkspaceStatus(userID, workspaceID) {
        if (!userID) {
            throw new Error('UserID is required to get workspace status.');
        }
        // Access Check: Requires read access
        if (!this.#checkAccess(workspaceID, userID, 'read')) {
            // Don't log warning here, just return null as if not found
            debug(`User ${userID} denied read access for status of workspace ${workspaceID}.`);
            return null;
        }
        // const indexEntry = this.index[workspaceID];
        const indexEntry = this.#findIndexEntry(workspaceID);
        return indexEntry ? indexEntry.status : null;
    }

    /**
     * Update a specific property of a workspace's configuration.
     * Updates both the workspace.json file and the active instance if loaded.
     * Requires 'write' access (owner only).
     * @param {string} userID - The ID of the user attempting the update.
     * @param {string} workspaceID - The ID of the workspace.
     * @param {string} property - The configuration key to set (e.g., 'name', 'description', 'color', 'acl').
     * @param {*} value - The new value for the property.
     * @returns {Promise<boolean>} True if successful, false otherwise or if access denied.
     */
    async setWorkspaceProperty(userID, workspaceID, property, value) {
        if (!userID) {
            throw new Error('UserID is required to set workspace property.');
        }
        // Access Check: Requires write access
        // Special case: Allow non-owners to modify ACL? Maybe later.
        // For now, only owner can change anything.
        if (!this.#checkAccess(workspaceID, userID, 'write')) {
            logger.warn(`User ${userID} denied write access to set property '${property}' for workspace ${workspaceID}.`);
            return false;
        }

        // const indexEntry = this.index[workspaceID];
        const indexEntry = this.#findIndexEntry(workspaceID);
        if (!indexEntry) {
            debug(`Workspace "${workspaceID}" not found. Cannot set property.`);
            return false;
        }

        // Define allowed properties carefully
        const allowedProperties = [
            'name', 'label', 'description', 'color', 'locked',
             'acl', // Allow setting the ACL object
             'restApi.port', 'restApi.token' // Allow setting API details
            // Exclude: id, owner, path, created, updated (managed internally), status
        ];
        if (!allowedProperties.includes(property)) {
            debug(`Attempted to set disallowed property "${property}" for workspace "${workspaceID}".`);
            return false;
        }

        // Validation specific to property type
        if (property === 'color' && !WorkspaceManager.validateWorkspaceColor(value)) {
            debug(`Invalid color value "${value}" for workspace "${workspaceID}".`);
            return false;
        }
        if (property === 'locked' && typeof value !== 'boolean') {
             debug(`Invalid locked value "${value}" for workspace "${workspaceID}". Must be boolean.`);
             return false;
        }
        if (property === 'acl' && (typeof value !== 'object' || value === null)) {
             debug(`Invalid acl value for workspace "${workspaceID}". Must be an object.`);
             return false;
        }
        if (property === 'restApi.port' && value !== null && (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > 65535)) {
            debug(`Invalid port value "${value}" for workspace "${workspaceID}". Must be null or an integer between 1 and 65535.`);
            return false;
        }
        if (property === 'restApi.token' && value !== null && (typeof value !== 'string' || value.length < 16)) {
            debug(`Invalid token value for workspace "${workspaceID}". Must be null or a string of at least 16 characters.`);
            return false;
        }
        // Add validation for ACL structure here if needed (e.g., keys are valid userIDs, values are roles)

        // Check if API needs restart
        const requiresApiRestart = (property === 'restApi.port' || property === 'restApi.token') &&
                                  indexEntry.restApiStatus === WORKSPACE_API_STATUS.RUNNING;

        if (requiresApiRestart) {
             debug(`API property change requires restart for workspace ${workspaceID}. Stopping API...`);
             await this.stopRestApi(userID, workspaceID); // Pass userID
        }

        // Update the active instance if it exists
        const workspaceInstance = this.#workspaces.get(workspaceID);
        let updateSuccessful = false;
        if (workspaceInstance) {
            // Ensure instance is accessible (should be due to check at start, but good practice)
            if (!this.#checkAccess(workspaceID, userID, 'write')) {
                 logger.error(`Consistency Error: User ${userID} lost write access to loaded workspace ${workspaceID} during setProperty.`);
                 return false;
            }
            debug(`Updating property "${property}" on active workspace instance "${workspaceID}".`);

            // Use generic setter - specific setters might not handle all allowed props like 'acl'
            if (typeof workspaceInstance.setConfigKey === 'function') {
                updateSuccessful = await workspaceInstance.setConfigKey(property, value);
                if (!updateSuccessful) {
                     debug(`Workspace instance setConfigKey failed for property "${property}".`);
                     // Proceed to update file directly as fallback
                }
            } else {
                 debug(`Workspace instance lacks setConfigKey method. Will update config file directly.`);
            }
        }

        // If not loaded OR instance update failed/not attempted, update workspace.json directly
        if (!workspaceInstance || !updateSuccessful) {
             debug(`Updating property "${property}" directly in workspace.json for "${workspaceID}".`);
            const workspacePath = indexEntry.rootPath;
            try {
                const configStore = new Conf({
                    configName: 'workspace',
                    cwd: workspacePath,
                });
                // Use dot notation for nested properties within Conf if needed
                configStore.set(property, value);
                configStore.set('updated', new Date().toISOString()); // Also update timestamp
                debug(`Successfully updated "${property}" in ${path.join(workspacePath, 'workspace.json')}`);
                updateSuccessful = true;
            } catch (err) {
                 logger.error(`Failed to update workspace.json for "${workspaceID}": ${err.message}`);
                 return false; // Failed to update the config file
            }
        }

        // Emit event regardless of whether instance or file was updated (as long as successful)
        if (updateSuccessful) {
            this.emit('workspace:property:changed', { id: workspaceID, property, value });
        }

        // Restart API if necessary
        if (requiresApiRestart && updateSuccessful) {
            debug(`Restarting API for workspace ${workspaceID} after property change...`);
            await this.startRestApi(userID, workspaceID); // Ensure public method is called
        }

        return updateSuccessful;
    }

    /**
     * Workspace Utils
     */

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
        // Relaxed regex to allow 3-digit hex?
        // Current WORKSPACE_CONFIG_TEMPLATE uses #000000
        // const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
        if (!color.match(/^#(?:[0-9a-fA-F]{3}){1,2}$/)) {
            debug('Workspace color must be a valid hex color (e.g., #RRGGBB or #RGB)');
            return false;
        }
        return true;
    }

    /**
     * Private methods
     */

    /**
     * Check if a user has the required access level to a workspace.
     * @param {string} workspaceID The ID of the workspace.
     * @param {string} userID The ID of the user requesting access.
     * @param {string} [requiredLevel='read'] The required access level ('read' or 'write'). Currently only 'read' logic is implemented fully. 'write' requires ownership.
     * @param {Object} [workspaceMetadataOrConfig=null] Optional pre-fetched metadata (from index) or config (from Workspace instance) to avoid redundant reads.
     * @returns {boolean} True if access is granted, false otherwise.
     * @private
     */
    #checkAccess(workspaceID, userID, requiredLevel = 'read', workspaceMetadataOrConfig = null) {
        if (!userID) {
            debug(`Access check failed for workspace ${workspaceID}: userID is required.`);
            return false;
        }

        let owner = null;
        let acl = null;

        // 1. Try getting info from provided metadata/config
        if (workspaceMetadataOrConfig) {
             // Check if it's a Workspace config object (has methods like get) or index metadata (plain object)
            if (typeof workspaceMetadataOrConfig.get === 'function') { // Likely a Conf instance or Workspace instance config getter
                owner = workspaceMetadataOrConfig.get('owner');
                acl = workspaceMetadataOrConfig.get('acl');
            } else if (workspaceMetadataOrConfig.id) { // Likely index metadata or plain config object
                 owner = workspaceMetadataOrConfig.owner;
                 // If it's just index metadata, ACL might be missing or stale, so clear it to force a read
                 // How to reliably distinguish index metadata from a full config object passed in?
                 // Assume if `.get` is not present, it *might* be index metadata, force ACL read.
                  acl = null; // Force read below if only index entry provided
             }
        }

        // 2. If owner/acl not obtained, try loading from workspace.json
        if (owner === null || acl === null) {
            // const indexEntry = this.index[workspaceID];
            const indexEntry = this.#findIndexEntry(workspaceID);
            if (!indexEntry) {
                 debug(`Access check failed for ${workspaceID}: Workspace not found in index.`);
                 return false; // Workspace doesn't even exist in index
            }
            // Only read config if necessary (not provided or only index metadata provided)
            try {
                 const configFilePath = this.#findWorkspaceConfigPath(indexEntry.rootPath);
                 if (!configFilePath) {
                     throw new Error('Workspace config file not found.');
                 }
                 const configDir = path.dirname(configFilePath);
                 const configName = path.basename(configFilePath, '.json');
                 const wsConfig = new Conf({ configName: configName, cwd: configDir });
                 owner = wsConfig.get('owner');
                 acl = wsConfig.get('acl', {}); // Default to empty object if missing
            } catch (err) {
                 logger.error(`Access check failed for ${workspaceID}: Could not read workspace config at ${indexEntry.rootPath}: ${err.message}`);
                 return false; // Cannot determine access if config is unreadable
            }
        }

        // 3. Perform the access check
        if (!owner) {
             logger.error(`Access check failed for ${workspaceID}: Workspace owner is not defined in config.`);
             return false; // Invalid configuration
        }

        // Owner always has access
        if (owner === userID) {
            return true;
        }

        // For write access, only owner is allowed (for now)
        if (requiredLevel === 'write') {
            debug(`Access check failed for ${workspaceID}: User ${userID} requires write access, but is not the owner (${owner}).`);
            return false;
        }

        // For read access, check ACL
        if (requiredLevel === 'read') {
             if (acl && typeof acl === 'object' && acl[userID]) {
                 // User is explicitly listed in the ACL.
                 // Future: Check acl[userID] value for 'read'/'write'/'admin'
                 return true;
             } else {
                 debug(`Access check failed for ${workspaceID}: User ${userID} is not owner (${owner}) and not found in ACL.`);
                 return false;
             }
        }

        // Should not reach here if requiredLevel is 'read' or 'write'
        debug(`Access check failed for ${workspaceID}: Unknown requiredLevel '${requiredLevel}'.`);
        return false;
    }

    /**
     * Convert a workspace name/ID to a filesystem-safe path component.
     * Example: "My Workspace!" -> "my-workspace"
     * @param {string} name
     * @returns {string}
     */
     #sanitizeWorkspaceName(name) {
        if (!name) return 'untitled';
        return name
            .toString()
            .toLowerCase()
            .replace(/\s+/g, '-')       // Replace spaces with -
            .replace(/[^a-z0-9-]/g, '') // Remove all non-alphanumeric or hyphen characters
            .replace(/--+/g, '-')      // Replace multiple - with single -
            .replace(/^-+/, '')        // Trim - from start of text
            .replace(/-+$/, '');       // Trim - from end of text
    }

    /**
     * Validate workspace configuration data (used before creating or importing).
     * @param {Object} configData - The configuration object to validate.
     * @param {boolean} [isImport=false] - If true, applies stricter checks (e.g., requires ID).
     * @returns {boolean} True if valid, false otherwise.
     * @private
     */
    #validateWorkspaceConfig(configData, isImport = false) {
        let isValid = true;
        let validationErrors = [];
        const logError = (msg) => {
            debug(`Config validation failed: ${msg}`);
            isValid = false;
            validationErrors.push(msg);
        };

        if (!configData) return logError('Config data is missing.');

        // ID is crucial
        if (!configData.id || typeof configData.id !== 'string') {
            // For creation, ID might be generated later, but parseWorkspaceOptions should add it.
            // For import, it MUST exist.
            // For loading existing, it MUST exist.
            // Let's always require it here.
            logError('Workspace ID is missing or not a string.');
        }

        if (!configData.name || typeof configData.name !== 'string') logError('Workspace name is missing or not a string.');
        // Should we validate owner format?
        if (!configData.owner || typeof configData.owner !== 'string') logError('Workspace owner is missing or not a string.');
        if (configData.color && !WorkspaceManager.validateWorkspaceColor(configData.color)) logError('Invalid color format.');
        if (!configData.type || !WORKSPACE_TYPES.includes(configData.type)) logError(`Invalid type: ${configData.type}. Must be one of ${WORKSPACE_TYPES.join(', ')}.`);
        if (configData.locked === undefined || typeof configData.locked !== 'boolean') logError('Locked flag must be a boolean or is missing.'); // Default is handled by Workspace getter
        // Check other fields like created, updated?
        if (!configData.created || Number.isNaN(Date.parse(configData.created))) logError('Created timestamp is invalid or missing.');
        if (!configData.updated || Number.isNaN(Date.parse(configData.updated))) logError('Updated timestamp is invalid or missing.');

        // Validate restApi structure if present
        if (configData.restApi) {
            if (configData.restApi.port && (typeof configData.restApi.port !== 'number' || !Number.isInteger(configData.restApi.port) || configData.restApi.port <= 0 || configData.restApi.port > 65535)) {
                return logError('Invalid restApi.port: Must be an integer between 1 and 65535.');
            }
            // Basic token validation - could be enhanced
            if (configData.restApi.token && (typeof configData.restApi.token !== 'string' || configData.restApi.token.length < 16)) {
                 return logError('Invalid restApi.token: Must be a string of at least 16 characters.');
            }
        }

        return isValid || validationErrors;
    }

    /**
     * Parse and normalize workspace options, merging with defaults.
     * @param {Object} options - Raw options provided by the user.
     * @returns {Object} Parsed and defaulted options suitable for workspace.json.
     * @private
     */
    #parseWorkspaceOptions(options) {
        // Start with the template defaults
        let parsedOptions = {
            ...WORKSPACE_CONFIG_TEMPLATE,
        };

        // Apply provided options, potentially overriding defaults
        // We need to be careful here not to overwrite required fields like id if they are already set (e.g., during import validation)
        for (const key in options) {
             if (options.hasOwnProperty(key) && options[key] !== undefined) { // Check for undefined
                 // Only copy properties that exist in the template or are known valid options?
                 // Or just copy everything provided?
                 // For now, copy if value is provided.
                 parsedOptions[key] = options[key];
             }
        }

        // Ensure essential fields have values
        if (!parsedOptions.id) {
            // This should ideally be set before calling parse, based on name or import
            // parsedOptions.id = ulid(); // Or generate based on name?
            debug("Warning: Parsing options without an ID set.");
        }
        if (!parsedOptions.name) {
             // Derive from ID if name is missing?
             parsedOptions.name = parsedOptions.id || 'Untitled Workspace';
        }
        if (!parsedOptions.label) {
            // Default label based on name
             parsedOptions.label = parsedOptions.name.charAt(0).toUpperCase() + parsedOptions.name.slice(1);
        }
        if (!parsedOptions.color) {
            parsedOptions.color = WorkspaceManager.getRandomColor();
        }
        if (!parsedOptions.created) {
            const now = new Date().toISOString();
            parsedOptions.created = now;
            parsedOptions.updated = now;
        } else if (!parsedOptions.updated) {
            parsedOptions.updated = parsedOptions.created; // Default updated to created if missing
        }

        // Re-validate owner - should be enforced by createWorkspace
        if (!parsedOptions.owner) {
             debug("Warning: Parsing options without an owner set.");
        }

        // Ensure restApi object exists
        parsedOptions.restApi = parsedOptions.restApi || { port: null, token: null };

        return parsedOptions;
    }

    /**
     * Ensure a directory exists.
     * @param {string} dirPath - Directory path.
     * @returns {Promise<void>}
     * @private
     */
    async #ensureDirectoryExists(dirPath) {
        try {
            await fsPromises.mkdir(dirPath, { recursive: true });
        } catch (err) {
            // Ignore EEXIST error (directory already exists)
            if (err.code !== 'EEXIST') {
                 throw new Error(`Failed to create directory ${dirPath}: ${err.message}`);
            }
        }
    }

    /**
     * Starts the dedicated REST API server for a workspace using PM2.
     * Requires 'write' access to the workspace.
     * @param {string} userID The ID of the user attempting the action.
     * @param {string} workspaceID The ID of the workspace.
     * @param {Object} apiConfig - Optional API configuration overrides.
     * @returns {Promise<boolean>} True if API started successfully, false otherwise or if access denied.
     */
    async startRestApi(userID, workspaceID, apiConfig = {}) {
        // Access Check: Requires write access to the workspace to manage its API
        if (!this.#checkAccess(workspaceID, userID, 'write')) {
            logger.warn(`User ${userID} denied write access to start REST API for workspace ${workspaceID}.`);
            return false;
        }

        debug(`Attempting to start REST API for workspace ${workspaceID}...`);
        // const indexEntry = this.index[workspaceID];
        const indexEntry = this.#findIndexEntry(workspaceID);
        if (!indexEntry) {
            logger.error(`Cannot start REST API: Workspace ${workspaceID} not found in index array.`);
            return false;
        }

        if (indexEntry.restApiStatus === WORKSPACE_API_STATUS.RUNNING || indexEntry.restApiStatus === WORKSPACE_API_STATUS.STARTING) {
            logger.warn(`REST API for workspace ${workspaceID} is already ${indexEntry.restApiStatus}.`);
            return true;
        }

        // Load workspace config to get API port and token
        let port, token;
        try {
            const wsConfig = new Conf({ configName: 'workspace', cwd: indexEntry.rootPath });
            port = wsConfig.get('restApi.port');
            // Use provided token if valid, otherwise from config
            token = (apiConfig.token && typeof apiConfig.token === 'string' && apiConfig.token.length >= 16) ? apiConfig.token : wsConfig.get('restApi.token');
        } catch (err) {
            logger.error(`Failed to load workspace config for ${workspaceID} to start API: ${err.message}`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.ERROR);
            this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.ERROR });
            return false;
        }

        if (!port || !token) {
            logger.error(`Cannot start REST API for ${workspaceID}: Port or token not configured in workspace.json.`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.ERROR);
             this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.ERROR });
            return false;
        }

        const pm2Name = `canvas-wsapi-${workspaceID}`;
        const scriptPath = path.resolve('src/managers/workspace/server/service.js'); // Ensure absolute path?

        const options = {
            name: pm2Name,
            script: scriptPath,
            env: {
                CANVAS_WS_PATH: indexEntry.rootPath,
                CANVAS_WS_API_PORT: port,
                CANVAS_WS_API_TOKEN: token, // Pass the actual token
                NODE_ENV: process.env.NODE_ENV || 'development' // Pass environment
            },
            // PM2 options: restart strategy, logs, etc.
            autorestart: true,
            watch: false, // Don't watch by default, can cause issues
            max_memory_restart: '100M' // Example limit
        };

        try {
            await pm2Connect();
            logger.info(`Starting PM2 process "${pm2Name}" for workspace ${workspaceID} API...`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.STARTING);
            // this.#index.set(`workspaces.${workspaceID}.pm2Name`, pm2Name);
            this.#updateIndexEntry(workspaceID, {
                 restApiStatus: WORKSPACE_API_STATUS.STARTING,
                 pm2Name: pm2Name
            });

            await pm2Start(options);
            logger.info(`PM2 process "${pm2Name}" started successfully.`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.RUNNING);
            this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.RUNNING });
            this.emit('workspace:api:started', { id: workspaceID, name: pm2Name });
            return true;
        } catch (err) {
            logger.error(`Failed to start PM2 process "${pm2Name}" for workspace ${workspaceID}: ${err.message}`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.ERROR);
            // this.#index.set(`workspaces.${workspaceID}.pm2Name`, null);
            this.#updateIndexEntry(workspaceID, {
                 restApiStatus: WORKSPACE_API_STATUS.ERROR,
                 pm2Name: null
            });
            // Attempt to clean up failed start
            try { await pm2Delete(pm2Name); } catch (delErr) { /* Ignore delete error */ }
            return false;
        } finally {
            await pm2Disconnect();
        }
    }

    /**
     * Stops the dedicated REST API server for a workspace using PM2.
     * Requires 'write' access to the workspace.
     * @param {string} userID The ID of the user attempting the action.
     * @param {string} workspaceID The ID of the workspace.
     * @returns {Promise<boolean>} True if API stopped successfully or was already stopped, false on error or access denied.
     */
    async stopRestApi(userID, workspaceID) {
        // Access Check: Requires write access to the workspace to manage its API
        if (!this.#checkAccess(workspaceID, userID, 'write')) {
            logger.warn(`User ${userID} denied write access to stop REST API for workspace ${workspaceID}.`);
            return false;
        }

        debug(`Attempting to stop REST API for workspace ${workspaceID}...`);
        // const indexEntry = this.index[workspaceID];
        const indexEntry = this.#findIndexEntry(workspaceID);
        const pm2Name = indexEntry?.pm2Name;

        if (!pm2Name || indexEntry?.restApiStatus === WORKSPACE_API_STATUS.STOPPED) {
            debug(`REST API for workspace ${workspaceID} is not running or has no PM2 name associated.`);
            // Ensure index is consistent if status was wrong
            if (indexEntry && indexEntry.restApiStatus !== WORKSPACE_API_STATUS.STOPPED) {
                // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.STOPPED);
                // this.#index.set(`workspaces.${workspaceID}.pm2Name`, null);
                this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.STOPPED, pm2Name: null });
            }
            return true; // Already stopped
        }

        try {
            await pm2Connect();
            logger.info(`Stopping PM2 process "${pm2Name}" for workspace ${workspaceID} API...`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.STOPPING);
            this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.STOPPING });

            await pm2Stop(pm2Name);
            await pm2Delete(pm2Name); // Stop and delete to remove from list
            logger.info(`PM2 process "${pm2Name}" stopped and deleted successfully.`);
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.STOPPED);
            // this.#index.set(`workspaces.${workspaceID}.pm2Name`, null);
             this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.STOPPED, pm2Name: null });
            this.emit('workspace:api:stopped', { id: workspaceID, name: pm2Name });
            return true;
        } catch (err) {
            logger.error(`Failed to stop/delete PM2 process "${pm2Name}" for workspace ${workspaceID}: ${err.message}`);
            // If stop/delete failed, the process might still exist.
            // Set status to error, keep pm2Name for potential manual cleanup?
            // this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.ERROR);
            this.#updateIndexEntry(workspaceID, { restApiStatus: WORKSPACE_API_STATUS.ERROR });
            return false;
        } finally {
            await pm2Disconnect();
        }
    }

    /**
     * Finds the path to the workspace configuration file within a given directory.
     * Checks standard locations in order: .workspace/workspace.json, .workspace.json, workspace.json
     * @param {string} workspacePath - The root directory of the workspace.
     * @returns {string|null} The full path to the found config file, or null if none is found.
     * @private
     */
    #findWorkspaceConfigPath(workspacePath) {
        const filename = WORKSPACE_CONFIG_FILENAME;
        const locations = [
            path.join(workspacePath, '.workspace', filename),
            path.join(workspacePath, `.${filename}`), // .workspace.json
            path.join(workspacePath, filename)      // workspace.json (default)
        ];

        for (const loc of locations) {
            // Use synchronous check as this might be called during initial scan/constructor phases
            if (existsSync(loc)) {
                debug(`Found workspace config for ${workspacePath} at: ${loc}`);
                return loc;
            }
        }
        debug(`Workspace config not found for ${workspacePath} in standard locations.`);
        return null;
    }

    /**
     * Performs the initial scan of workspaces listed in the index.
     * Updates statuses (NOT_FOUND, ERROR, AVAILABLE) in the index.
     * Loads valid workspace instances into the #workspaces map.
     * This is called synchronously from the constructor.
     * @private
     */
    #performInitialScan() {
        debug('Performing initial workspace scan...');
        // const workspaceIndex = this.#index.get('workspaces') || {};
        const workspaceIndex = this.#getWorkspacesArrayIndex(); // Get the array
        let updatedIndex = [...workspaceIndex]; // Create a mutable copy
        let updated = false;

        // for (const workspaceID in workspaceIndex) {
        for (let i = 0; i < updatedIndex.length; i++) {
            const indexEntry = updatedIndex[i];
            const workspaceID = indexEntry.id;
            const workspacePath = indexEntry.rootPath;
            let currentStatus = indexEntry.status;
            let newStatus = currentStatus;

            // Skip processing if marked as REMOVED
            if (currentStatus === WORKSPACE_STATUS.REMOVED) {
                 debug(`Skipping removed workspace: ${workspaceID}`);
                 continue;
            }

            // 1. Check Path Existence
            if (!existsSync(workspacePath)) {
                debug(`Workspace path not found for ${workspaceID}: ${workspacePath}`);
                newStatus = WORKSPACE_STATUS.NOT_FOUND;
            } else {
                // 2. Try Reading/Validating Config
                let configStore;
                let configData;
                try {
                    // Find the actual config file path
                    const configFilePath = this.#findWorkspaceConfigPath(workspacePath);
                    if (!configFilePath) {
                        throw new Error('Workspace config file not found in standard locations.');
                    }
                    // Load Conf using the found path
                    const configDir = path.dirname(configFilePath);
                    const configName = path.basename(configFilePath, '.json');
                    configStore = new Conf({ configName: configName, cwd: configDir });
                    configData = configStore.store; // Get the plain object
                    if (!this.#validateWorkspaceConfig(configData)) {
                        // Validation failed, error logged in validate method
                         throw new Error('Workspace configuration validation failed.');
                    }
                    // Path exists and config is valid
                    newStatus = WORKSPACE_STATUS.AVAILABLE;
                    debug(`Workspace config validated for ${workspaceID}. Status: AVAILABLE.`);

                    // 3. Load Workspace Instance (without starting)
                    try {
                        const workspace = new Workspace({
                            rootPath: workspacePath, // Pass rootPath to constructor
                            configStore: configStore, // Pass the validated config store
                        });
                        this.#workspaces.set(workspaceID, workspace); // Add to loaded map
                        debug(`Workspace instance loaded for ${workspaceID}.`);
                    } catch (instanceError) {
                         logger.error(`Failed to instantiate Workspace for ${workspaceID}: ${instanceError.message}`);
                         newStatus = WORKSPACE_STATUS.ERROR; // Instantiation failed
                         // Remove potentially corrupted configStore reference if needed?
                         configStore = null;
                    }

                } catch (err) {
                    logger.error(`Error loading/validating config for ${workspaceID} at ${workspacePath}: ${err.message}`);
                    newStatus = WORKSPACE_STATUS.ERROR;
                }
            }

            // Update index only if status changed
            if (newStatus !== currentStatus) {
                updatedIndex[i] = { ...indexEntry, status: newStatus }; // Update the copy
                debug(`Updated status for ${workspaceID} to ${newStatus}`);
                updated = true;
            }
        }

        if (updated) {
            this.#setWorkspacesArrayIndex(updatedIndex); // Write the whole updated array back
            debug('Initial workspace scan complete. Index updated.');
        } else {
             debug('Initial workspace scan complete. No index changes required.');
        }
    }

    /**
     * Private Index Helper Methods
     */

    /**
     * Get the current workspaces array from the index.
     * @returns {Array<Object>} The array of workspace metadata objects.
     * @private
     */
    #getWorkspacesArrayIndex() {
        return this.#index.get('workspaces', []); // Default to empty array
    }

    /**
     * Save the updated workspaces array back to the index.
     * @param {Array<Object>} workspacesArray - The modified array.
     * @private
     */
    #setWorkspacesArrayIndex(workspacesArray) {
        this.#index.set('workspaces', workspacesArray);
    }

    /**
     * Find a workspace entry in the index array by its ID.
     * @param {string} workspaceID - The ID of the workspace to find.
     * @returns {Object|undefined} The found workspace metadata object or undefined.
     * @private
     */
    #findIndexEntry(workspaceID) {
        const workspaces = this.#getWorkspacesArrayIndex();
        return workspaces.find(ws => ws.id === workspaceID);
    }

    /**
     * Add a new workspace entry to the index array.
     * @param {Object} newEntry - The workspace metadata object to add.
     * @private
     */
    #addIndexEntry(newEntry) {
        const workspaces = this.#getWorkspacesArrayIndex();
        // Ensure no duplicate ID before adding
        if (workspaces.some(ws => ws.id === newEntry.id)) {
            // This should ideally be caught earlier, but good safety check
             logger.warn(`Attempted to add duplicate workspace ID "${newEntry.id}" to index.`);
            return;
        }
        workspaces.push(newEntry);
        this.#setWorkspacesArrayIndex(workspaces);
    }

    /**
     * Update an existing workspace entry in the index array.
     * @param {string} workspaceID - The ID of the workspace to update.
     * @param {Object} updates - An object containing properties to update.
     * @returns {boolean} True if the update was successful, false otherwise.
     * @private
     */
    #updateIndexEntry(workspaceID, updates) {
        const workspaces = this.#getWorkspacesArrayIndex();
        const index = workspaces.findIndex(ws => ws.id === workspaceID);
        if (index !== -1) {
            // Merge updates into the existing entry
            workspaces[index] = { ...workspaces[index], ...updates };
            this.#setWorkspacesArrayIndex(workspaces);
            return true;
        }
        logger.warn(`Attempted to update non-existent workspace ID "${workspaceID}" in index.`);
        return false;
    }

     /**
     * Remove a workspace entry from the index array by its ID.
     * @param {string} workspaceID - The ID of the workspace to remove.
     * @returns {boolean} True if an entry was removed, false otherwise.
     * @private
     */
    #removeIndexEntry(workspaceID) {
        const workspaces = this.#getWorkspacesArrayIndex();
        const initialLength = workspaces.length;
        const filteredWorkspaces = workspaces.filter(ws => ws.id !== workspaceID);
        if (filteredWorkspaces.length < initialLength) {
            this.#setWorkspacesArrayIndex(filteredWorkspaces);
            return true;
        }
        return false;
    }

}

export default WorkspaceManager;
export {
    WORKSPACE_STATUS,
    WORKSPACE_API_STATUS,
    WORKSPACE_DIRECTORIES
};
