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
import crypto from 'crypto';
import { ulid } from 'ulid';
import pm2 from 'pm2';
import { promisify } from 'util';

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
import Workspace from './lib/Workspace.js';

/**
 * Constants
 */

const WORKSPACE_TYPES = ['universe', 'workspace'];

// Default configuration template for a new workspace's workspace.json
const WORKSPACE_CONFIG_TEMPLATE = {
    id: null,
    name: null,
    type: 'workspace',
    label: 'Workspace',
    color: '#000000',
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

// Statuses stored in the global workspaces.json index
const WORKSPACE_INDEX_STATUS = {
    NEW: 'new',
    IMPORTED: 'imported',
    ACTIVE: 'active', // Workspace is loaded and running
    INACTIVE: 'inactive', // Workspace is known but not running
    DELETED: 'deleted', // Soft deleted, can be purged
};

// Statuses for the optional REST API managed by PM2
const WORKSPACE_API_STATUS = {
    RUNNING: 'running',
    STOPPED: 'stopped',
    STARTING: 'starting',
    STOPPING: 'stopping',
    ERROR: 'error',
};

// Internal status used by Workspace instances (matches config)
const WORKSPACE_INSTANCE_STATUS = {
    INITIALIZED: 'initialized',
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    DELETED: 'deleted',
};

const WORKSPACE_DIRECTORIES = {
    db: 'db',
    config: 'config',
    data: 'data',
    cache: 'cache',
    home: 'home',
    roles: 'roles',
    dotfiles: 'dotfiles',
};

/**
 * Workspace Manager
 *
 * Manages workspaces on disk and their metadata in a global index.
 * Handles loading/unloading (starting/stopping) workspace instances.
 */
class WorkspaceManager extends EventEmitter {

    #rootPath;  // Default root path for workspaces if not specified
    #configPath; // Path to store the global workspaces.json index

    #index; // Conf instance for the global workspaces.json index
    #activeWorkspaces = new Map(); // Map of workspaceID -> active Workspace instance

    /**
     * Constructor
     * @param {Object} options - Configuration options
     * @param {string} options.rootPath - Root path for workspaces
     * @param {string} [options.configPath] - Path for global config (defaults to rootPath/config)
     */
    constructor(options = {}) {
        super(options.eventEmitterOptions || {});
        if (!options.rootPath || typeof options.rootPath !== 'string') {
            throw new Error('Workspaces root path (string) is required');
        }

        this.#rootPath = options.rootPath;
        this.#configPath = options.configPath || path.join(this.#rootPath, 'config');

        // Ensure the config directory exists before initializing Conf
        // NOTE: Conf might handle this, but explicit check is safer
        // Consider adding an async initialize method if this needs async operations
        try {
            fsPromises.mkdir(this.#configPath, { recursive: true });
        } catch (syncError) {
            // Handle potential sync errors during setup if necessary
            // In a real async setup, this would be awaited
            console.error(`Error creating config directory sync: ${syncError}`);
            // For now, we proceed assuming Conf might handle it or throw later
        }

        // Initialize the global config/index
        this.#index = new Conf({
            configName: 'workspaces', // -> workspaces.json
            cwd: this.#configPath,
            defaults: {
                workspaces: {}, // Map of workspaceID -> { id, path, status, indexed, lastAccessed, restApiStatus, pm2Name }
            },
        });

        debug(`Workspace manager initialized, root path: ${this.#rootPath}, config path: ${this.#configPath}`);
        // TODO: Potentially add an async initialize() method to handle async setup like directory checks,
        // scanning existing workspaces, and ensuring universe exists.
        // TODO: Connect to PM2 daemon on initialization?
    }

    /**
     * Getters
     */

    get rootPath() { return this.#rootPath; }
    get configPath() { return this.#configPath; }
    get index() { return this.#index.store.workspaces || {}; } // Return the workspaces object
    get workspaces() { return Object.values(this.index); } // Array of workspace metadata objects
    get activeWorkspaces() { return Array.from(this.#activeWorkspaces.values()); } // Array of active Workspace instances
    get inactiveWorkspaces() { // Get metadata for inactive workspaces
        return this.workspaces.filter(ws =>
            ws.status === WORKSPACE_INDEX_STATUS.INACTIVE ||
            ws.status === WORKSPACE_INDEX_STATUS.NEW ||
            ws.status === WORKSPACE_INDEX_STATUS.IMPORTED
        );
    }

    /**
     * Simplified Workspace Manager API
     */

    /**
     * Create a new workspace.
     * Creates the directory structure, workspace.json, and adds metadata to the global index.
     * Does NOT start the workspace.
     * @param {string} name - Desired name for the workspace (used for ID and default path).
     * @param {Object} [options={}] - Configuration options (overrides defaults).
     * @param {string} [options.path] - Optional custom path for the workspace.
     * @param {string} [options.owner] - Owner identifier (required).
     * @returns {Promise<Object>} Metadata of the created workspace from the global index.
     */
    async createWorkspace(name, options = {}) {
        const { restApi, ...otherOptions } = options;
        if (!name || typeof name !== 'string') {
            throw new Error('Workspace name (string) is required');
        }
        if (!otherOptions.owner) {
            // Enforce owner requirement based on user query
            throw new Error('Workspace owner option is required');
        }

        const workspaceID = this.#sanitizeNameForID(name); // Use sanitized name as ID
        const workspacePath = otherOptions.path ? path.resolve(otherOptions.path) : path.join(this.#rootPath, workspaceID);

        // Check if workspace ID or path is already indexed
        if (this.index[workspaceID]) {
            throw new Error(`Workspace ID "${workspaceID}" already registered.`);
        }
        if (this.workspaces.some(ws => ws.path === workspacePath)) {
            throw new Error(`Workspace path "${workspacePath}" is already in use.`);
        }

        // Prepare configuration for workspace.json
        const creationTime = new Date().toISOString();
        let workspaceConfigData = this.#parseWorkspaceOptions({ // Use helper to merge defaults
            id: workspaceID,
            name: name, // Keep original name for display?
            ...otherOptions, // User options override defaults
            // Ensure crucial fields are set
            created: creationTime,
            updated: creationTime,
            status: WORKSPACE_INSTANCE_STATUS.INITIALIZED, // Initial status in workspace.json
            restApi: { // Initialize restApi config in workspace.json
                port: restApi?.port || null,
                // SECURITY: Store HASHED token in production!
                token: restApi?.token || (restApi?.enabled ? crypto.randomBytes(24).toString('hex') : null),
            },
        });

        // Validate the final config data *before* creating files
        if (!this.#validateWorkspaceConfig(workspaceConfigData)) {
            // Validation errors are logged within the function
            throw new Error('Invalid workspace configuration options provided.');
        }

        // Create workspace directory and standard subdirectories
        await this.#ensureDirectoryExists(workspacePath);
        for (const dirName of Object.values(WORKSPACE_DIRECTORIES)) {
            await this.#ensureDirectoryExists(path.join(workspacePath, dirName));
        }

        // Create the workspace's own config file (workspace.json)
        const workspaceConfigFile = path.join(workspacePath, 'workspace.json');
        try {
            await fsPromises.writeFile(workspaceConfigFile, JSON.stringify(workspaceConfigData, null, 4));
            debug(`Created workspace config at: ${workspaceConfigFile}`);
        } catch (err) {
            // Clean up created directories if config write fails?
            throw new Error(`Failed to write workspace config file at ${workspaceConfigFile}: ${err.message}`);
        }

        // Add entry to the global index (workspaces.json)
        const indexEntry = {
            id: workspaceID,
            path: workspacePath,
            status: WORKSPACE_INDEX_STATUS.NEW, // Initial status in global index
            indexed: creationTime,
            lastAccessed: null,
            restApiStatus: WORKSPACE_API_STATUS.STOPPED,
            pm2Name: null,
        };
        this.#index.set(`workspaces.${workspaceID}`, indexEntry);
        debug(`Added workspace "${workspaceID}" to global index.`);

        this.emit('workspace:created', indexEntry);
        return indexEntry; // Return the metadata added to the index
    }

    getWorkspace(workspaceID) {
        if (!this.index[workspaceID]) {
            debug(`Workspace "${workspaceID}" not found in index.`);
            return null;
        }

        if (!this.#activeWorkspaces.has(workspaceID)) {
            debug(`Workspace "${workspaceID}" is not active.`);
            return null;
        }

        return this.#activeWorkspaces.get(workspaceID);
    }

    /**
     * Starts a workspace: Loads its config, creates a Workspace instance,
     * calls its start() method, and adds it to the active list.
     * @param {string} workspaceID - The ID of the workspace to start.
     * @returns {Promise<Workspace>} The active Workspace instance.
     */
    async startWorkspace(workspaceID) {
        if (this.#activeWorkspaces.has(workspaceID)) {
            debug(`Workspace "${workspaceID}" is already active.`);
            return this.#activeWorkspaces.get(workspaceID);
        }

        const indexEntry = this.index[workspaceID];
        if (!indexEntry) {
            throw new Error(`Workspace "${workspaceID}" not found in the index.`);
        }

        if (indexEntry.status === WORKSPACE_INDEX_STATUS.DELETED) {
            throw new Error(`Workspace "${workspaceID}" is marked as deleted.`);
        }

        const workspacePath = indexEntry.path;
        const workspaceConfigFile = path.join(workspacePath, 'workspace.json');

        let workspaceConfigData;
        try {
            const content = await fsPromises.readFile(workspaceConfigFile, 'utf8');
            workspaceConfigData = JSON.parse(content);
            debug(`Loaded workspace config for "${workspaceID}" from ${workspaceConfigFile}`);
        } catch (err) {
            throw new Error(`Failed to read or parse workspace config for "${workspaceID}" at ${workspaceConfigFile}: ${err.message}`);
        }

        // Validate loaded config again?
        if (!this.#validateWorkspaceConfig(workspaceConfigData)) {
             throw new Error(`Workspace config for "${workspaceID}" is invalid.`);
        }

        // Create the Workspace instance
        // We need Conf for the Workspace instance to manage its own config file
        const configStore = new Conf({
            configName: 'workspace', // workspace.json
            cwd: workspacePath,
            // We don't set defaults here, assuming the file exists and is loaded
        });

        const workspace = new Workspace({
            ...workspaceConfigData, // Use data loaded from file
            path: workspacePath, // Ensure path is correctly passed
            configStore: configStore, // Pass the Conf instance
        });

        // Start the workspace's internal resources (DB, etc.)
        try {
            await workspace.start(); // Workspace handles its internal status
            debug(`Workspace "${workspaceID}" instance started successfully.`);
        } catch (err) {
            throw new Error(`Failed to start workspace "${workspaceID}" instance: ${err.message}`);
        }

        // Add to active workspaces map
        this.#activeWorkspaces.set(workspaceID, workspace);

        // Update global index status and last accessed time
        this.#index.set(`workspaces.${workspaceID}.status`, WORKSPACE_INDEX_STATUS.ACTIVE);
        this.#index.set(`workspaces.${workspaceID}.lastAccessed`, new Date().toISOString());
        debug(`Updated global index for active workspace "${workspaceID}".`);

        this.emit('workspace:started', workspace);
        return workspace;
    }

    /**
     * Stops an active workspace: Calls its stop() method and removes it from the active list.
     * @param {string} workspaceID - The ID of the workspace to stop.
     * @returns {Promise<boolean>} True if stopped successfully, false if not found or not active.
     */
    async stopWorkspace(workspaceID) {
        const workspace = this.#activeWorkspaces.get(workspaceID);
        if (!workspace) {
            debug(`Workspace "${workspaceID}" is not active or not found.`);
            return false;
        }

        try {
            await workspace.stop(); // Workspace handles its internal status
            debug(`Workspace "${workspaceID}" instance stopped successfully.`);
        } catch (err) {
            // Log the error but continue cleanup
            logger.error(`Error stopping workspace "${workspaceID}" instance: ${err.message}`);
            // Decide if we should re-throw or just log
        }

        // Remove from active map
        this.#activeWorkspaces.delete(workspaceID);

        // Update global index status (only if it exists - safety check)
        if (this.index[workspaceID]) {
             this.#index.set(`workspaces.${workspaceID}.status`, WORKSPACE_INDEX_STATUS.INACTIVE);
             debug(`Updated global index for inactive workspace "${workspaceID}".`);
        }

        this.emit('workspace:stopped', { id: workspaceID });
        return true;
    }

    /**
     * Remove a workspace from the global index. Stops it if active.
     * Does NOT delete files from disk.
     * @param {string} workspaceID - Workspace ID/name to remove.
     * @returns {Promise<boolean>} True if removed, false if not found.
     */
    async removeWorkspace(workspaceID) {
        debug(`Attempting to remove workspace ${workspaceID} from index...`);
        const indexEntry = this.index[workspaceID];
        if (!indexEntry) {
            debug(`Workspace "${workspaceID}" not found in index. Cannot remove.`);
            return false;
        }

        // Stop the REST API service if it's running
        await this.stopRestApi(workspaceID);

        // Stop the workspace if it's active
        if (this.#activeWorkspaces.has(workspaceID)) {
            debug(`Workspace "${workspaceID}" is active, stopping before removing from index.`);
            await this.stopWorkspace(workspaceID);
        }

        // Remove from the global index
        this.#index.delete(`workspaces.${workspaceID}`);
        debug(`Removed workspace "${workspaceID}" from global index.`);

        this.emit('workspace:removed', { id: workspaceID });
        return true;
    }

    /**
     * Destroy a workspace: Stops it if active, removes it from the index,
     * and deletes its directory from the filesystem.
     * @param {string} workspaceID - Workspace ID/name to destroy.
     * @param {boolean} [forceDestroy=false] - Skip checks and force deletion (use with caution).
     * @returns {Promise<boolean>} True if destroyed, false if not found.
     */
    async destroyWorkspace(workspaceID, forceDestroy = false) {
        debug(`Attempting to destroy workspace ${workspaceID}...`);
        const indexEntry = this.index[workspaceID];
        if (!indexEntry) {
            debug(`Workspace "${workspaceID}" not found in index. Cannot destroy.`);
            return false;
        }

        // Stop the REST API service first
        await this.stopRestApi(workspaceID);

        const workspacePath = indexEntry.path;

        // Basic safety check unless forced
        if (!forceDestroy && this.#activeWorkspaces.has(workspaceID)) {
             // Or maybe just stop it? User query implies stop is part of destroy.
             debug(`Workspace "${workspaceID}" is active. Stopping before destroying.`);
             await this.stopWorkspace(workspaceID);
             // throw new Error(`Workspace "${workspaceID}" is active. Stop it before destroying, or use forceDestroy.`);
        }

        // Stop again just in case or if forceDestroy skipped the check
         if (this.#activeWorkspaces.has(workspaceID)) {
            await this.stopWorkspace(workspaceID);
        }

        // Remove from the global index *before* deleting files
        this.#index.delete(`workspaces.${workspaceID}`);
        debug(`Removed workspace "${workspaceID}" from global index before deletion.`);

        // Delete the workspace directory
        try {
            debug(`Attempting to delete workspace directory: ${workspacePath}`);
            await fsPromises.rm(workspacePath, { recursive: true, force: true }); // Use force: true cautiously
            debug(`Successfully deleted workspace directory: ${workspacePath}`);
        } catch (err) {
            // Log the error, but the index entry is already removed.
            // Consider if the index entry should be restored or marked as 'delete_failed'?
            logger.error(`Failed to delete workspace directory "${workspacePath}": ${err.message}`);
            // Re-throw or return false? Returning false might be less disruptive.
            this.emit('workspace:destroy_failed', { id: workspaceID, error: err.message });
            return false;
        }

        this.emit('workspace:destroyed', { id: workspaceID });
        return true;
    }

    /**
     * Import a workspace from a zip file or an existing directory.
     * Adds the workspace to the global index, does NOT start it.
     * @param {string} sourcePath - Path to the zip file or workspace directory.
     * @param {boolean} [inPlace=false] - If sourcePath is a directory, import it without copying (only adds to index).
     * @returns {Promise<Object>} Metadata of the imported workspace from the global index.
     */
    async importWorkspace(sourcePath, inPlace = false) {
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
            const configFilePath = path.join(importPath, 'workspace.json');
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

            if (!this.#validateWorkspaceConfig(workspaceConfigData, true /* isImport */)) {
                throw new Error(`Import source workspace.json is invalid.`);
            }
            workspaceID = workspaceConfigData.id; // Use ID from the imported config

            // Check for conflicts (ID or target path)
            if (this.index[workspaceID]) {
                throw new Error(`Workspace ID "${workspaceID}" from import source already exists in the index.`);
            }

            if (inPlace) {
                if (isZip) throw new Error("Cannot import zip file 'inPlace'.");
                finalWorkspacePath = importPath; // Use the source path directly
                // Check if path conflicts with existing *indexed* paths
                if (this.workspaces.some(ws => ws.path === finalWorkspacePath)) {
                    throw new Error(`Workspace path "${finalWorkspacePath}" is already indexed.`);
                }
                debug(`Importing workspace "${workspaceID}" in-place from: ${finalWorkspacePath}`);
            } else {
                finalWorkspacePath = path.join(this.#rootPath, workspaceID);
                // Check if target directory already exists (could be unrelated files)
                if (existsSync(finalWorkspacePath)) {
                    throw new Error(`Target directory for import already exists: ${finalWorkspacePath}`);
                }
                 debug(`Copying workspace "${workspaceID}" from ${importPath} to ${finalWorkspacePath}`);
                 // fsPromises.cp is available in Node 16.7+
                 await fsPromises.cp(importPath, finalWorkspacePath, { recursive: true });
                 // Ensure workspace.json includes restApi structure after copy
                 workspaceConfigData.restApi = workspaceConfigData.restApi || { port: null, token: null };
                 debug(`Workspace copy complete.`);
            }

            // Add entry to the global index
            const indexEntry = {
                id: workspaceID,
                path: finalWorkspacePath,
                status: WORKSPACE_INDEX_STATUS.IMPORTED,
                indexed: new Date().toISOString(),
                lastAccessed: null,
                restApiStatus: WORKSPACE_API_STATUS.STOPPED,
                pm2Name: null,
            };
            this.#index.set(`workspaces.${workspaceID}`, indexEntry);
            debug(`Added imported workspace "${workspaceID}" to global index.`);

            this.emit('workspace:imported', indexEntry);
            return indexEntry;

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
     * Requires the workspace to be stopped/inactive.
     * @param {string} workspaceID - Source workspace id.
     * @param {string} dstPath - Destination path for the zip file.
     * @returns {Promise<string>} Path to the created zip file.
     */
    async exportWorkspace(workspaceID, dstPath) {
        if (!workspaceID) throw new Error('Workspace ID is required for export.');
        if (!dstPath) throw new Error('Destination path is required for export.');

        const indexEntry = this.index[workspaceID];
        if (!indexEntry) {
            throw new Error(`Workspace "${workspaceID}" not found in index.`);
        }

        // Ensure workspace is not active
        if (this.#activeWorkspaces.has(workspaceID)) {
            throw new Error(`Workspace "${workspaceID}" is active. Stop it before exporting.`);
        }

        const sourcePath = indexEntry.path;
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

        debug(`Exporting workspace "${workspaceID}" from ${sourcePath} to ${outputZipPath}`);

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
     * @param {string} workspaceID - The ID of the workspace.
     * @returns {string|null} Status string (e.g., 'active', 'inactive') or null if not found.
     */
    getWorkspaceStatus(workspaceID) {
        const indexEntry = this.index[workspaceID];
        return indexEntry ? indexEntry.status : null;
    }

    /**
     * Update a specific property of a workspace's configuration.
     * Updates both the workspace.json file and the active instance if loaded.
     * @param {string} workspaceID - The ID of the workspace.
     * @param {string} property - The configuration key to set (e.g., 'name', 'description', 'color').
     * @param {*} value - The new value for the property.
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async setWorkspaceProperty(workspaceID, property, value) {
        const indexEntry = this.index[workspaceID];
        if (!indexEntry) {
            debug(`Workspace "${workspaceID}" not found. Cannot set property.`);
            return false;
        }

        const allowedProperties = ['name', 'description', 'owner', 'color', 'acl', 'label', 'locked', 'restApi.port', 'restApi.token'];
        if (!allowedProperties.includes(property)) {
            debug(`Attempted to set disallowed property "${property}" for workspace "${workspaceID}".`);
            return false;
        }

        // Special validation for color
        if (property === 'color' && !WorkspaceManager.validateWorkspaceColor(value)) {
            debug(`Invalid color value "${value}" for workspace "${workspaceID}".`);
            return false;
        }

        // Validation for port
        if (property === 'restApi.port' && (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > 65535)) {
            debug(`Invalid port value "${value}" for workspace "${workspaceID}". Must be an integer between 1 and 65535.`);
            return false;
        }

        // Validation for token (basic check)
        if (property === 'restApi.token' && (typeof value !== 'string' || value.length < 16)) {
            // SECURITY: Add stricter token validation/generation logic
            debug(`Invalid token value for workspace "${workspaceID}". Must be a string of at least 16 characters.`);
            return false;
        }

        const requiresApiRestart = (property === 'restApi.port' || property === 'restApi.token') &&
                                  indexEntry.restApiStatus === WORKSPACE_API_STATUS.RUNNING;

        if (requiresApiRestart) {
             debug(`API property change requires restart for workspace ${workspaceID}. Stopping API...`);
             await this.stopRestApi(workspaceID);
        }

        // Update the active instance if it exists
        const workspaceInstance = this.#activeWorkspaces.get(workspaceID);
        let updateSuccessful = false;
        if (workspaceInstance) {
            debug(`Updating property "${property}" on active workspace instance "${workspaceID}".`);
            // Assume Workspace class has corresponding setters or a generic `setConfigKey`
            // Need to match method names in Workspace.js
            const setterMethod = `set${property.charAt(0).toUpperCase() + property.slice(1)}`;
            if (typeof workspaceInstance[setterMethod] === 'function') {
                workspaceInstance[setterMethod](value);
                updateSuccessful = true; // Assume setter updates configStore internally
            } else if (typeof workspaceInstance.setConfigKey === 'function') {
                // Fallback to generic setter if specific one doesn't exist
                workspaceInstance.setConfigKey(property, value);
                 updateSuccessful = true;
            } else {
                 debug(`No suitable setter method found on Workspace instance for property "${property}". Config file might be updated directly.`);
                 // If no setter, we have to update the config file directly (below)
                 // We assume the setter handles updating the underlying configStore
            }
        }

        // If not active OR setter didn't exist/failed, update workspace.json directly
        if (!updateSuccessful) {
             debug(`Updating property "${property}" directly in workspace.json for "${workspaceID}".`);
            const workspacePath = indexEntry.path;
             // Use Conf to update the specific workspace's config file
            try {
                const configStore = new Conf({
                    configName: 'workspace',
                    cwd: workspacePath,
                });
                if (property.startsWith('restApi.')) {
                    // Use dot notation for nested properties within Conf
                    configStore.set(property, value);
                } else {
                     configStore.set(property, value);
                }
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
            await this.startRestApi(workspaceID);
        }

        return updateSuccessful;
    }

    updateWorkspace(workspaceID, updates) {
        const indexEntry = this.index[workspaceID];
        if (!indexEntry) {
            debug(`Workspace "${workspaceID}" not found. Cannot update.`);
            return false;
        }

        return; // TODO: Implement

    }

    /**
     * Helper methods
     */

    /**
     * List workspace metadata based on status filter.
     * @param {string} [status] - Optional status filter (e.g., 'active', 'inactive').
     * @returns {Array<Object>} Array of workspace metadata objects from the index.
     */
    listWorkspaces(status) {
        const allWorkspaces = Object.values(this.index);
        if (!status) {
            return allWorkspaces;
        }

        if (!Object.values(WORKSPACE_INDEX_STATUS).includes(status)) {
            debug('Invalid status filter: ' + status);
            return []; // Or throw error?
        }

        return allWorkspaces.filter(workspace => workspace.status === status);
    }

    hasWorkspace(workspaceID) {
        return this.index[workspaceID] !== undefined;
    }

    isActive(workspaceID) {
        return this.#activeWorkspaces.has(workspaceID);
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
     * Convert a workspace name/ID to a filesystem-safe path component.
     * Example: "My Workspace!" -> "my-workspace"
     * @param {string} name
     * @returns {string}
     */
     #sanitizeNameForID(name) {
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
         const logError = (msg) => {
             debug(`Config validation failed: ${msg}`);
             isValid = false;
         };

         if (!configData) return logError('Config data is missing.');

         // ID is crucial, especially for import
         if (!configData.id || typeof configData.id !== 'string') {
             // For creation, ID might be generated later, but parseWorkspaceOptions should add it.
             // For import, it MUST exist.
             if (isImport) return logError('Workspace ID is missing or not a string.');
         }

         if (!configData.name || typeof configData.name !== 'string') return logError('Workspace name is missing or not a string.');
         // Should we validate owner format?
         if (!configData.owner || typeof configData.owner !== 'string') return logError('Workspace owner is missing or not a string.');
         if (configData.color && !WorkspaceManager.validateWorkspaceColor(configData.color)) return logError('Invalid color format.');
         if (!configData.type || !WORKSPACE_TYPES.includes(configData.type)) return logError(`Invalid type: ${configData.type}. Must be one of ${WORKSPACE_TYPES.join(', ')}.`);
         if (typeof configData.locked !== 'boolean') return logError('Locked flag must be a boolean.');
         // Check other fields like created, updated, status format?
         if (!configData.created || Number.isNaN(Date.parse(configData.created))) return logError('Created timestamp is invalid or missing.');
         if (!configData.updated || Number.isNaN(Date.parse(configData.updated))) return logError('Updated timestamp is invalid or missing.');
         if (!configData.status || !Object.values(WORKSPACE_INSTANCE_STATUS).includes(configData.status)) return logError(`Invalid status in config: ${configData.status}`);

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

        return isValid;
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
     * @param {string} workspaceID The ID of the workspace.
     * @returns {Promise<boolean>} True if API started successfully, false otherwise.
     */
    async startRestApi(workspaceID) {
        debug(`Attempting to start REST API for workspace ${workspaceID}...`);
        const indexEntry = this.index[workspaceID];
        if (!indexEntry) {
            logger.error(`Cannot start REST API: Workspace ${workspaceID} not found in index.`);
            return false;
        }

        if (indexEntry.restApiStatus === WORKSPACE_API_STATUS.RUNNING || indexEntry.restApiStatus === WORKSPACE_API_STATUS.STARTING) {
            logger.warn(`REST API for workspace ${workspaceID} is already ${indexEntry.restApiStatus}.`);
            // Consider checking if the pm2 process actually exists
            return true;
        }

        // Load workspace config to get API port and token
        let port, token;
        try {
            const wsConfig = new Conf({ configName: 'workspace', cwd: indexEntry.path });
            port = wsConfig.get('restApi.port');
            token = wsConfig.get('restApi.token');
        } catch (err) {
            logger.error(`Failed to load workspace config for ${workspaceID} to start API: ${err.message}`);
            this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.ERROR);
            return false;
        }

        if (!port || !token) {
            logger.error(`Cannot start REST API for ${workspaceID}: Port or token not configured in workspace.json.`);
            this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.ERROR);
            return false;
        }

        const pm2Name = `canvas-wsapi-${workspaceID}`;
        const scriptPath = path.resolve('src/managers/workspace/server/service.js'); // Ensure absolute path?

        const options = {
            name: pm2Name,
            script: scriptPath,
            env: {
                CANVAS_WS_PATH: indexEntry.path,
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
            this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.STARTING);
            this.#index.set(`workspaces.${workspaceID}.pm2Name`, pm2Name);

            await pm2Start(options);
            logger.info(`PM2 process "${pm2Name}" started successfully.`);
            this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.RUNNING);
            this.emit('workspace:api:started', { id: workspaceID, name: pm2Name });
            return true;
        } catch (err) {
            logger.error(`Failed to start PM2 process "${pm2Name}" for workspace ${workspaceID}: ${err.message}`);
            this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.ERROR);
            this.#index.set(`workspaces.${workspaceID}.pm2Name`, null);
            // Attempt to clean up failed start
            try { await pm2Delete(pm2Name); } catch (delErr) { /* Ignore delete error */ }
            return false;
        } finally {
            await pm2Disconnect();
        }
    }

    /**
     * Stops the dedicated REST API server for a workspace using PM2.
     * @param {string} workspaceID The ID of the workspace.
     * @returns {Promise<boolean>} True if API stopped successfully or was already stopped, false on error.
     */
    async stopRestApi(workspaceID) {
        debug(`Attempting to stop REST API for workspace ${workspaceID}...`);
        const indexEntry = this.index[workspaceID];
        const pm2Name = indexEntry?.pm2Name;

        if (!pm2Name || indexEntry?.restApiStatus === WORKSPACE_API_STATUS.STOPPED) {
            debug(`REST API for workspace ${workspaceID} is not running or has no PM2 name associated.`);
            // Ensure index is consistent if status was wrong
            if (indexEntry && indexEntry.restApiStatus !== WORKSPACE_API_STATUS.STOPPED) {
                this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.STOPPED);
                this.#index.set(`workspaces.${workspaceID}.pm2Name`, null);
            }
            return true; // Already stopped
        }

        try {
            await pm2Connect();
            logger.info(`Stopping PM2 process "${pm2Name}" for workspace ${workspaceID} API...`);
            this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.STOPPING);

            await pm2Stop(pm2Name);
            await pm2Delete(pm2Name); // Stop and delete to remove from list
            logger.info(`PM2 process "${pm2Name}" stopped and deleted successfully.`);
            this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.STOPPED);
            this.#index.set(`workspaces.${workspaceID}.pm2Name`, null);
            this.emit('workspace:api:stopped', { id: workspaceID, name: pm2Name });
            return true;
        } catch (err) {
            logger.error(`Failed to stop/delete PM2 process "${pm2Name}" for workspace ${workspaceID}: ${err.message}`);
            // If stop/delete failed, the process might still exist.
            // Set status to error, keep pm2Name for potential manual cleanup?
            this.#index.set(`workspaces.${workspaceID}.restApiStatus`, WORKSPACE_API_STATUS.ERROR);
            return false;
        } finally {
            await pm2Disconnect();
        }
    }

}

export default WorkspaceManager;
export {
    WORKSPACE_INDEX_STATUS,
    WORKSPACE_API_STATUS,
    WORKSPACE_INSTANCE_STATUS,
    WORKSPACE_DIRECTORIES
};
