'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import path from 'path';

// Logging
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('workspace');

// Includes
import Db from '@/services/synapsd/src/index.js';

// Constants
import {
    WORKSPACE_INSTANCE_STATUS,
    WORKSPACE_DIRECTORIES
} from '../index.js';

/**
 * Canvas Workspace
 *
 * Represents an active, loaded workspace instance with its resources (DB, tree).
 * Configuration is managed via the injected configStore (Conf instance).
 */

class Workspace extends EventEmitter {

    // Immutable properties set at construction
    id;
    name;
    type;
    owner;
    path;
    created;

    // Internal state
    #configStore;
    #db = null;

    /**
     * Create a new Workspace instance.
     * Should only be called by WorkspaceManager after validating config.
     * @param {Object} options - Configuration options (should match workspace.json structure).
     * @param {Conf} options.configStore - Initialized Conf instance for this workspace.
     */
    constructor(options = {}) {
        super();

        // --- Essential configuration validation ---
        if (!options.id) throw new Error('Workspace ID is required');
        if (!options.name) throw new Error('Workspace name is required');
        if (!options.path) throw new Error('Workspace path is required');
        if (!options.owner) throw new Error('Workspace owner is required');
        if (!options.configStore) throw new Error('Config store (Conf instance) is required');
        if (!options.created) throw new Error('Workspace creation timestamp is required'); // Should be set by manager

        // Validate color if present (optional, manager might set default)
        if (options.color && !this.#validateColor(options.color)) {
            // Log warning but don't throw? Or should manager guarantee validation?
             logger.warn(`Workspace "${options.id}" created with invalid color format: ${options.color}`);
             // Let's allow it for now, manager should validate beforehand.
            // throw new Error('Invalid color format');
        }

        // --- Assign immutable properties ---
        this.id = options.id;
        this.name = options.name;
        this.type = options.type || 'workspace'; // Default type if missing
        this.owner = options.owner;
        this.path = options.path;
        this.created = options.created;

        // --- Set internal state ---
        this.#configStore = options.configStore;

        // NOTE: Runtime status (active/inactive) is derived from DB/Tree state,
        // Persisted status is read from configStore.
        // The constructor doesn't set status, it should reflect what's in configStore.
        debug(`Workspace instance created for ID: ${this.id}, Name: ${this.name}, Path: ${this.path}`);
        debug(`Initial persisted status from config: ${this.status}`);
    }

    /**
     * Getters
     *
     * Provide access to configuration directly from the config store,
     * and internal resources like DB and tree.
     */

    // Configuration Getters (reading from workspace.json via configStore)
    get config() { return this.#configStore?.store || {}; }
    get label() { return this.config.label || this.name; } // Default label to name if not set
    get description() { return this.config.description || `Workspace for ${this.name}`; }
    get color() { return this.config.color; }
    get locked() { return this.config.locked || false; }
    get updated() { return this.config.updated; }
    get acl() { return this.config.acl || {}; }
    get status() { // Persisted status from workspace.json
        return this.#configStore?.get('status', WORKSPACE_INSTANCE_STATUS.INACTIVE); // Default to inactive if missing
    }

    // Internal Resource Getters
    get db() { return this.#db; }
    get tree() { return this.#db?.tree; } // Access tree via db instance
    get jsonTree() { return this.#db?.tree?.toJSON ? this.#db.tree.toJSON() : null; } // Safely access tree method via db
    get layers() { return this.#db?.tree?.layers; } // Assuming tree provides this, accessed via db

    // Status/State Getters
    get isConfigLoaded() { return this.#configStore !== null; }
    get isOpen() { // Reflects if DB and Tree resources are initialized
        return this.#db !== null && this.#db?.tree !== null;
    }
    get isDeleted() { // Check persisted status
        return this.status === WORKSPACE_INSTANCE_STATUS.DELETED;
    }
    get isActive() { // Check persisted status
        // Note: This reflects the *intended* state based on config.
        // `isOpen` reflects the actual runtime state of resources.
        return this.status === WORKSPACE_INSTANCE_STATUS.ACTIVE;
    }

    /**
     * Workspace controls
     */

    /**
     * Start the workspace: Initialize DB connection and load the tree.
     * Updates the persisted status to ACTIVE.
     * @returns {Promise<Workspace>} The started workspace instance.
     */
    async start() {
        // Check persisted status first
        if (this.status === WORKSPACE_INSTANCE_STATUS.ACTIVE && this.isOpen) {
            debug(`Workspace "${this.id}" is already active and open.`);
            return this;
        }
        if (this.status === WORKSPACE_INSTANCE_STATUS.DELETED) {
            throw new Error(`Cannot start workspace "${this.id}" because it is marked as deleted.`);
        }

        debug(`Starting workspace "${this.id}"...`);
        try {
            await this.#initializeResources();
            // await this.#initializeRoles(); // Placeholder for future role initialization

            this.#setStatus(WORKSPACE_INSTANCE_STATUS.ACTIVE);
            this.emit('workspace:started', { id: this.id });
            debug(`Workspace "${this.id}" started successfully.`);
            return this;
        } catch (err) {
            logger.error(`Failed to start workspace "${this.id}": ${err.message}`);
            // Attempt to clean up partially initialized resources
            await this.#shutdownResourcesOnError();
            throw err; // Re-throw the error after cleanup attempt
        }
    }

    /**
     * Stop the workspace: Shutdown DB connection and release resources.
     * Updates the persisted status to INACTIVE.
     * @returns {Promise<boolean>} True if stopped successfully, false otherwise.
     */
    async stop() {
        // Check persisted status - allow stopping even if not ACTIVE (e.g., from INITIALIZED)
        if (this.status === WORKSPACE_INSTANCE_STATUS.INACTIVE && !this.isOpen) {
            debug(`Workspace "${this.id}" is already inactive and closed.`);
            return true; // Considered successful if already stopped
        }
        if (this.status === WORKSPACE_INSTANCE_STATUS.DELETED) {
             debug(`Workspace "${this.id}" is deleted, skipping stop.`);
             return true; // Nothing to stop
        }

        debug(`Stopping workspace "${this.id}"...`);
        try {
            await this.#shutdownResources();
            // await this.#shutdownRoles(); // Placeholder

            this.#setStatus(WORKSPACE_INSTANCE_STATUS.INACTIVE);
            this.emit('workspace:stopped', { id: this.id });
            debug(`Workspace "${this.id}" stopped successfully.`);
            return true;
        } catch (err) {
            logger.error(`Error stopping workspace "${this.id}": ${err.message}`);
            // Even if shutdown fails, update status? Or leave as ACTIVE?
            // Let's update status to INACTIVE to reflect intent, but log the error.
            this.#setStatus(WORKSPACE_INSTANCE_STATUS.INACTIVE);
            this.emit('workspace:stopped', { id: this.id, error: err.message }); // Emit with error
            // Decide whether to re-throw or return false
            return false; // Indicate stop had issues
        }
    }

    /**
     * Tree methods
     *
     * These methods proxy calls to the internal tree object, adding event emissions.
     * They should only be called when the workspace is active/open.
     */

    #ensureTree() {
        if (!this.#db?.tree) { // Check if db and its tree are available
            throw new Error('Workspace tree is not available. Is the workspace started?');
        }
    }

    getTree() {
        this.#ensureTree();
        return this.jsonTree; // Use the getter which includes safety check
    }

    insertPath(path, data = null, autoCreateLayers = true) {
        this.#ensureTree();
        const result = this.#db.tree.insertPath(path, data, autoCreateLayers);
        this.emit('workspace:tree:updated', {
            operation: 'insertPath',
            path,
            tree: this.jsonTree
        });
        return {
            layerIds: result, // Assuming tree.insertPath returns layer IDs
            tree: this.jsonTree
        };
    }

    removePath(path, recursive) {
        this.#ensureTree();
        const result = this.#db.tree.removePath(path, recursive);
        if (result) {
            this.emit('workspace:tree:updated', {
                operation: 'removePath',
                path,
                recursive,
                tree: this.jsonTree
            });
        }
        return {
            success: result,
            tree: result ? this.jsonTree : null
        };
    }

    movePath(pathFrom, pathTo, recursive) {
        this.#ensureTree();
        const result = this.#db.tree.movePath(pathFrom, pathTo, recursive);
        if (result) {
            this.emit('workspace:tree:updated', {
                operation: 'movePath',
                pathFrom,
                pathTo,
                recursive,
                tree: this.jsonTree
            });
        }
        return {
            success: result,
            tree: result ? this.jsonTree : null
        };
    }

    copyPath(pathFrom, pathTo, recursive) {
        this.#ensureTree();
        const result = this.#db.tree.copyPath(pathFrom, pathTo, recursive);
        if (result) {
            this.emit('workspace:tree:updated', {
                operation: 'copyPath',
                pathFrom,
                pathTo,
                recursive,
                tree: this.jsonTree
            });
        }
        return {
            success: result,
            tree: result ? this.jsonTree : null
        };
    }

    pathToIdArray(path) {
        this.#ensureTree();
        return this.#db.tree.pathToIdArray(path);
    }

    mergeUp(path) {
        this.#ensureTree();
        const result = this.#db.tree.mergeUp(path);
        if (result) {
            this.emit('workspace:tree:updated', {
                operation: 'mergeUp',
                path,
                tree: this.jsonTree
            });
        }
        return {
            success: result,
            tree: result ? this.jsonTree : null
        };
    }

    mergeDown(path) {
        this.#ensureTree();
        const result = this.#db.tree.mergeDown(path);
        if (result) {
            this.emit('workspace:tree:updated', {
                operation: 'mergeDown',
                path,
                tree: this.jsonTree
            });
        }
        return {
            success: result,
            tree: result ? this.jsonTree : null
        };
    }

    /**
     * Get a workspace layer by name
     * @param {string} name - Layer name
     * @returns {Object | null} - Layer object or null if not found
     */
    getLayer(name) {
        this.#ensureTree();
        return this.#db.tree.getLayer(name);
    }

    /**
     * Get a workspace layer by ID
     * @param {string} id - Layer ID
     * @returns {Object | null} - Layer object or null if not found
     */
    getLayerById(id) {
        this.#ensureTree();
        return this.#db.tree.getLayerById(id);
    }

    /**
     * Get all paths in the workspace tree
     * @returns {Array<string>} - Array of paths
     */
    get paths() {
        this.#ensureTree();
        return this.#db.tree.paths;
    }

    /**
     * Insert a canvas layer at a specified path
     * @param {string} parentPath - Parent path where to insert the canvas
     * @param {string} canvasName - Name of the canvas
     * @param {Object} [options={}] - Canvas options
     * @returns {Object} - Result with canvas ID and updated tree
     */
    insertCanvas(parentPath, canvasName, options = {}) {
        this.#ensureTree();
        // Assuming createLayer adds the layer to the tree's internal layer store
        const canvasLayer = this.createLayer({
            name: canvasName,
            type: 'canvas',
            ...options
        });

        const canvasPath = parentPath === '/' ? `/${canvasName}` : `${parentPath}/${canvasName}`;
        // Assuming insertPath associates the layer with the path node
        this.insertPath(canvasPath, { layerId: canvasLayer.id }); // Pass layer ID as data?

        this.emit('workspace:canvas:inserted', {
            parentPath,
            canvasName,
            canvasId: canvasLayer.id,
            tree: this.jsonTree
        });

        return {
            canvasId: canvasLayer.id,
            path: canvasPath,
            canvasName,
            tree: this.jsonTree
        };
    }

    /**
     * Insert a Workspace reference at a specified path
     * @param {string} parentPath - Parent path where to insert the workspace reference
     * @param {string} workspaceRefName - Name of the workspace reference node
     * @param {string} targetWorkspaceId - ID of the target workspace
     * @param {Object} [options={}] - Layer options
     * @returns {Object} - Result with workspace reference layer ID and updated tree
     */
    insertWorkspace(parentPath, workspaceRefName, targetWorkspaceId, options = {}) {
        this.#ensureTree();
        const workspaceLayer = this.createLayer({
            name: workspaceRefName, // Use ref name for layer name?
            type: 'workspace', // Layer type indicates it's a reference
            metadata: {
                targetWorkspaceId,
                ...options.metadata // Allow additional metadata
            },
            ...options // Apply other layer options
        });

        const workspacePath = parentPath === '/' ? `/${workspaceRefName}` : `${parentPath}/${workspaceRefName}`;
        this.insertPath(workspacePath, { layerId: workspaceLayer.id }); // Associate layer

        this.emit('workspace:ref:inserted', {
            parentPath,
            workspaceRefName,
            targetWorkspaceId,
            workspaceRefId: workspaceLayer.id,
            tree: this.jsonTree
        });

        return {
            workspaceRefId: workspaceLayer.id,
            path: workspacePath,
            workspaceRefName,
            targetWorkspaceId,
            tree: this.jsonTree
        };
    }

    /**
     * Tree layer methods
     */

    createLayer(options) {
        this.#ensureTree();
        const layer = this.#db.tree.createLayer(options);
        this.emit('workspace:layer:created', {
            layer,
            tree: this.jsonTree // Include tree state after creation
        });
        return layer;
    }

    renameLayer(name, newName) {
        this.#ensureTree();
        const result = this.#db.tree.renameLayer(name, newName);
        if (result) {
            this.emit('workspace:layer:renamed', {
                oldName: name,
                newName,
                tree: this.jsonTree
            });
        }
        return {
            success: result,
            oldName: name,
            newName: result ? newName : null,
            tree: result ? this.jsonTree : null
        };
    }

    updateLayer(name, options) {
        this.#ensureTree();
        const result = this.#db.tree.updateLayer(name, options);
        if (result) {
            this.emit('workspace:layer:updated', {
                name,
                options,
                tree: this.jsonTree
            });
        }
        return {
            success: result,
            name,
            options: result ? options : null,
            tree: result ? this.jsonTree : null
        };
    }

    deleteLayer(name) {
        this.#ensureTree();
        const result = this.#db.tree.deleteLayer(name);
        if (result) {
            this.emit('workspace:layer:deleted', {
                name,
                tree: this.jsonTree
            });
        }
        return {
            success: result,
            name,
            tree: result ? this.jsonTree : null
        };
    }

    /**
     * Setters and configuration methods
     *
     * These methods update the persisted configuration in workspace.json
     * via the configStore.
     */

    #updateConfig(key, value) {
        if (!this.#configStore) {
            logger.error(`Cannot update config for "${this.id}". Config store not available.`);
            return false;
        }
        try {
            this.#configStore.set(key, value);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit(`workspace:${key}:changed`, { id: this.id, [key]: value });
            return true;
        } catch (err) {
             logger.error(`Failed to update config key "${key}" for workspace "${this.id}": ${err.message}`);
             return false;
        }
    }

    setColor(color) {
        if (!this.#validateColor(color)) {
            debug(`Invalid color format: ${color}`);
            return false;
        }
        return this.#updateConfig('color', color);
    }

    setDescription(description) {
        return this.#updateConfig('description', description);
    }

    setLabel(label) {
        return this.#updateConfig('label', label);
    }

    lock() {
        return this.#updateConfig('locked', true);
    }

    unlock() {
        return this.#updateConfig('locked', false);
    }

    // Generic config key setter
    setConfigKey(key, value) {
        // Add validation here for allowed keys if necessary
        const allowedKeys = ['label', 'description', 'color', 'locked', 'acl', 'metadata']; // Example
        if (!allowedKeys.includes(key)) {
             debug(`Attempted to set disallowed config key: ${key}`);
             return false;
        }
        return this.#updateConfig(key, value);
    }

    // Generic config key getter (already handled by `this.config` getter)
    // getConfigKey(key, defaultValue) {
    //    return this.#configStore?.get(key, defaultValue);
    // }

    /**
     * Mark the workspace as deleted in its config file.
     * This is called by the WorkspaceManager.
     * @returns {boolean} Success status.
     */
    markAsDeleted() {
        debug(`Marking workspace "${this.id}" as deleted in its config.`);
        return this.#setStatus(WORKSPACE_INSTANCE_STATUS.DELETED);
    }

    /**
     * Convert the workspace's persisted configuration to a plain JSON object.
     * @returns {Object} - JSON object representing workspace.json content.
     */
    toJSON() {
        // Return the content of the config store
        return {
            ...this.config, // Get all key-values from the store
            // Ensure essential immutable fields are included, overriding store if necessary?
            // Should not be necessary if configStore is the source of truth.
            id: this.id,
            name: this.name,
            path: this.path,
            owner: this.owner,
            created: this.created,
        };
    }

    /**
     * Private methods
     */

    /**
     * Set the workspace status in its config file (workspace.json).
     * @param {string} status - Status to set (must be a WORKSPACE_INSTANCE_STATUS value).
     * @returns {boolean} - True if status was set, false otherwise.
     * @private
     */
    #setStatus(status) {
        if (!Object.values(WORKSPACE_INSTANCE_STATUS).includes(status)) {
            logger.error(`Invalid status value provided: ${status}`);
            return false;
        }
        debug(`Setting persisted status for workspace "${this.id}" to: ${status}`);
        return this.#updateConfig('status', status);
    }

    /**
     * Validate color format (hex color: #RGB or #RRGGBB).
     * @param {string} color - Color to validate.
     * @returns {boolean} - True if color is valid.
     * @private
     */
    #validateColor(color) {
        if (!color || typeof color !== 'string') {
            return false;
        }
        const hexRegex = /^#(?:[0-9a-fA-F]{3}){1,2}$/i;
        return hexRegex.test(color);
    }

    /**
     * Initialize workspace resources (Database, Tree).
     * @private
     */
    async #initializeResources() {
        try {
            // 1. Initialize Database
            const dbPath = path.join(this.path, WORKSPACE_DIRECTORIES.db);
            debug(`Initializing database for workspace "${this.id}" at ${dbPath}`);
            this.#db = new Db({ // Assuming Db constructor API
                path: dbPath,
                // Add other necessary DB options here
                // backupOnOpen: false, // Example option
                // backupOnClose: true, // Example option
                // compression: true, // Example option
            });
            await this.#db.start(); // Assuming start() is async
            debug(`Database started for workspace "${this.id}".`);

            // Tree is initialized within SynapsD and accessed via this.#db.tree
            // No need to get it separately here.
            if (!this.#db.tree) {
                 // This should ideally not happen if DB start succeeded and SynapsD constructor ran
                 throw new Error('SynapsD instance does not have a tree object after starting.');
            }
            debug(`SynapsD tree is available via workspace.db.tree for "${this.id}".`);

            debug(`Workspace "${this.id}" resources initialized.`);
        } catch (err) {
             debug(`Error during resource initialization for "${this.id}": ${err.message}`);
             // Rethrow to be caught by start() for cleanup
             throw err;
        }
    }

    /**
     * Shutdown workspace resources (Database, Tree).
     * @private
     */
    async #shutdownResources() {
        debug(`Shutting down resources for workspace "${this.id}"...`);
        // Shutdown Database (SynapsD instance)
        // The tree reference will be cleared when #db is set to null.
        if (this.#db) {
            try {
                await this.#db.shutdown(); // Assuming shutdown() is async
                debug(`Database shutdown complete for workspace "${this.id}".`);
            } catch (dbErr) {
                logger.error(`Error shutting down database for "${this.id}": ${dbErr.message}`);
                // Continue cleanup but log the error
            } finally {
                this.#db = null; // Ensure DB instance is cleared even if shutdown fails
            }
        }
        debug(`Workspace "${this.id}" resources shut down.`);
    }

    /**
     * Attempt to shutdown resources after an initialization error.
     * Used to prevent resource leaks if start() fails midway.
     * @private
     */
     async #shutdownResourcesOnError() {
        logger.warn(`Attempting resource cleanup after initialization error for workspace "${this.id}".`);
        // Use the same shutdown logic, but suppress errors during cleanup itself
        try {
            await this.#shutdownResources();
        } catch (cleanupErr) {
            logger.error(`Error during cleanup after initialization failure for "${this.id}": ${cleanupErr.message}`);
        }
    }

}

export default Workspace;
