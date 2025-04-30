'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import path from 'path';

// Logging
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('workspace');

// Includes
import Db from '../../../services/synapsd/src/index.js';

// Constants
import {
    WORKSPACE_STATUS_CODES,
    WORKSPACE_DIRECTORIES,
} from '../index.js';

/**
 * Canvas Workspace
 */

class Workspace extends EventEmitter {
    // Runtime state
    #status = WORKSPACE_STATUS_CODES.INACTIVE; // Internal runtime status
    #db = null;
    #tree = null;

    // Core configuration
    #rootPath;
    #configStore;

    /**
     * Create a new Workspace instance.
     * Manages its configuration via the injected config store.
     * @param {Object} options - Initialization options.
     * @param {string} options.path - Absolute path to the workspace root directory.
     * @param {Conf} options.configStore - Initialized Conf instance for this workspace.
     * @param {object} [options.eventEmitterOptions] - Options for EventEmitter2.
     */
    constructor(options = {}) {
        super(options.eventEmitterOptions);

        if (!options.rootPath) throw new Error('Workspace rootPath is required');
        if (!options.configStore) throw new Error('Config store (Conf instance) is required');

        this.#rootPath = options.rootPath;
        this.#configStore = options.configStore;

        debug(`Workspace instance created for ID: ${this.id}, Name: ${this.name}, RootPath: ${this.rootPath}`);
    }

    /**
     * Configuration Getters (reading from workspace.json via configStore)
     */

    // Runtime
    get config() { return this.#configStore?.store || {}; }
    get path() { return this.#rootPath; }
    get rootPath() { return this.#rootPath; }
    get configPath() { return this.#configStore?.path; }

    // Persisted
    get id() { return this.#configStore?.get('id'); }
    get name() { return this.#configStore?.get('name'); }
    get label() { return this.#configStore?.get('label', this.name); }
    get description() { return this.#configStore?.get('description', `Canvas Workspace`); }
    get color() { return this.#configStore?.get('color'); }
    get type() { return this.#configStore?.get('type', 'workspace'); }
    get owner() { return this.#configStore?.get('owner'); }
    get acl() { return this.#configStore?.get('acl', {}); }
    get created() { return this.#configStore?.get('created'); }

    /**
     * Internal Resource Getters
     */

    get db() {
        if (!this.#db) {
            throw new Error('Database not initialized');
        }
        return this.#db;
    }
    get tree() {
        if (!this.#db) {
            throw new Error('Database not initialized');
        }
        return this.#db?.tree;
    }
    get jsonTree() {
        if (!this.#db) {
            throw new Error('Database not initialized');
        }
        return this.#db?.tree?.jsonTree ? this.#db.tree.jsonTree : '{}';
    }

    /**
     * Status/State Getters
     */

    get status() { return this.#status; }
    get isConfigLoaded() { return this.#configStore !== null; }
    get isActive() { return this.#status === WORKSPACE_STATUS_CODES.ACTIVE; }

    /**
     * Setters and configuration methods
     */

    setStatus(status) {
        if (!Object.values(WORKSPACE_STATUS_CODES).includes(status)) {
            debug(`Invalid status value provided: ${status}`);
            return false;
        }
        this.#status = status;
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

    // Generic config key setter
    setConfigKey(key, value) {
        // Add validation here for allowed keys if necessary
        const allowedKeys = [
            'label',
            'description',
            'color',
            'locked',
            'acl',
            'metadata',
        ];

        if (!allowedKeys.includes(key)) {
            debug(`Attempted to set disallowed config key: ${key}`);
            return false;
        }

        // Special validation for color
        if (key === 'color' && !this.#validateColor(value)) {
            debug(`Invalid color format for key ${key}: ${value}`);
            return false;
        }

        return this.#updateConfig(key, value);
    }

    /**
     * Workspace controls
     */

    /**
     * Start the workspace: Initialize DB connection and load the tree.
     * Updates the internal status and the persisted status to ACTIVE.
     * @returns {Promise<Workspace>} The started workspace instance.
     */
    async start() {
        // Check internal runtime status first
        if (this.isActive) {
            debug(`Workspace "${this.id}" is already active.`);
            return this;
        }

        debug(`Starting workspace "${this.id}"...`);
        try {
            await this.#initializeResources();
            // await this.#initializeRoles(); // Placeholder for future role initialization
            this.#status = WORKSPACE_STATUS_CODES.ACTIVE;
            this.emit('workspace:started', { id: this.id });
            debug(`Workspace "${this.id}" started successfully.`);
            return this;
        } catch (err) {
            logger.error(`Failed to start workspace "${this.id}": ${err.message}`);
            await this.#shutdownResources();
            this.#status = WORKSPACE_STATUS_CODES.INACTIVE;
            throw err;
        }
    }

    /**
     * Stop the workspace: Shutdown DB connection and release resources.
     * Updates the internal status and the persisted status to INACTIVE.
     * @returns {Promise<boolean>} True if stopped successfully, false otherwise.
     */
    async stop() {
        // Check internal runtime status
        if (this.#status === WORKSPACE_STATUS_CODES.INACTIVE) {
            debug(`Workspace "${this.id}" is already inactive.`);
            return true; // Considered successful if already stopped
        }

        debug(`Stopping workspace "${this.id}"...`);
        try {
            await this.#shutdownResources();
            // await this.#shutdownRoles(); // Placeholder
            this.#status = WORKSPACE_STATUS_CODES.INACTIVE;
            this.emit('workspace:stopped', { id: this.id });
            debug(`Workspace "${this.id}" stopped successfully.`);
            return true;
        } catch (err) {
            logger.error(`Error stopping workspace "${this.id}": ${err.message}`);
            // Even if shutdown fails, update internal status to INACTIVE
            this.#status = WORKSPACE_STATUS_CODES.INACTIVE;
            this.emit('workspace:stopped', { id: this.id, error: err.message }); // Emit with error
            return false; // Indicate stop had issues
        }
    }

    /**
     * Tree methods
     */

    insertPath(path, data = null, autoCreateLayers = true) {
        if (!this.isActive) throw new Error('Workspace is not active');
        const result = this.#db.tree.insertPath(path, data, autoCreateLayers);
        this.emit('workspace:tree:updated', {
            operation: 'insertPath',
            path,
            tree: this.jsonTree,
        });
        return {
            layerIds: result,
            tree: this.jsonTree,
        };
    }

    removePath(path, recursive) {
        if (!this.isActive) throw new Error('Workspace is not active');
        const result = this.#db.tree.removePath(path, recursive);
        if (result) {
            this.emit('workspace:tree:updated', {
                operation: 'removePath',
                path,
                recursive,
                tree: this.jsonTree,
            });
        }
        return {
            success: result,
            tree: result ? this.jsonTree : null,
        };
    }

    movePath(pathFrom, pathTo, recursive) {
        if (!this.isActive) throw new Error('Workspace is not active');
        const result = this.#db.tree.movePath(pathFrom, pathTo, recursive);
        if (result) {
            this.emit('workspace:tree:updated', {
                operation: 'movePath',
                pathFrom,
                pathTo,
                recursive,
                tree: this.jsonTree,
            });
        }
        return {
            success: result,
            tree: result ? this.jsonTree : null,
        };
    }

    copyPath(pathFrom, pathTo, recursive) {
        if (!this.isActive) throw new Error('Workspace is not active');
        const result = this.#db.tree.copyPath(pathFrom, pathTo, recursive);
        if (result) {
            this.emit('workspace:tree:updated', {
                operation: 'copyPath',
                pathFrom,
                pathTo,
                recursive,
                tree: this.jsonTree,
            });
        }
        return {
            success: result,
            tree: result ? this.jsonTree : null,
        };
    }

    pathToIdArray(path) {
        if (!this.isActive) throw new Error('Workspace is not active');
        return this.#db.tree.pathToIdArray(path);
    }

    mergeUp(path) {
        if (!this.isActive) throw new Error('Workspace is not active');
        const result = this.#db.tree.mergeUp(path);
        if (result) {
            this.emit('workspace:tree:updated', {
                operation: 'mergeUp',
                path,
                tree: this.jsonTree,
            });
        }
        return {
            success: result,
            tree: result ? this.jsonTree : null,
        };
    }

    mergeDown(path) {
        if (!this.isActive) throw new Error('Workspace is not active');
        const result = this.#db.tree.mergeDown(path);
        if (result) {
            this.emit('workspace:tree:updated', {
                operation: 'mergeDown',
                path,
                tree: this.jsonTree,
            });
        }
        return {
            success: result,
            tree: result ? this.jsonTree : null,
        };
    }

    /**
     * Get all paths in the workspace tree
     * @returns {Array<string>} - Array of paths
     */
    get paths() {
        if (!this.isActive) return []; // Return empty if not active
        return this.#db?.tree?.paths || [];
    }

    /**
     * Insert a canvas layer at a specified path
     * @param {string} parentPath - Parent path where to insert the canvas
     * @param {string} canvasName - Name of the canvas
     * @param {Object} [options={}] - Canvas options
     * @returns {Object} - Result with canvas ID and updated tree
     */
    insertCanvas(parentPath, canvasName, options = {}) {
        if (!this.isActive) throw new Error('Workspace is not active');
        // Assuming createLayer adds the layer to the tree's internal layer store
        const canvasLayer = this.createLayer({
            name: canvasName,
            type: 'canvas',
            ...options,
        });

        const canvasPath = parentPath === '/' ? `/${canvasName}` : `${parentPath}/${canvasName}`;
        // Assuming insertPath associates the layer with the path node
        this.insertPath(canvasPath, { layerId: canvasLayer.id }); // Pass layer ID as data?

        this.emit('workspace:canvas:inserted', {
            parentPath,
            canvasName,
            canvasId: canvasLayer.id,
            tree: this.jsonTree,
        });

        return {
            canvasId: canvasLayer.id,
            path: canvasPath,
            canvasName,
            tree: this.jsonTree,
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
        if (!this.isActive) throw new Error('Workspace is not active');
        const workspaceLayer = this.createLayer({
            name: workspaceRefName, // Use ref name for layer name?
            type: 'workspace', // Layer type indicates it's a reference
            metadata: {
                targetWorkspaceId,
                ...options.metadata, // Allow additional metadata
            },
            ...options, // Apply other layer options
        });

        const workspacePath = parentPath === '/' ? `/${workspaceRefName}` : `${parentPath}/${workspaceRefName}`;
        this.insertPath(workspacePath, { layerId: workspaceLayer.id }); // Associate layer

        this.emit('workspace:ref:inserted', {
            parentPath,
            workspaceRefName,
            targetWorkspaceId,
            workspaceRefId: workspaceLayer.id,
            tree: this.jsonTree,
        });

        return {
            workspaceRefId: workspaceLayer.id,
            path: workspacePath,
            workspaceRefName,
            targetWorkspaceId,
            tree: this.jsonTree,
        };
    }

    /**
     * Tree layer methods
     */

    createLayer(options) {
        if (!this.isActive) throw new Error('Workspace is not active');
        const layer = this.#db.tree.createLayer(options);
        this.emit('workspace:layer:created', {
            layer,
            tree: this.jsonTree, // Include tree state after creation
        });
        return layer;
    }

    getLayer(name) {
        if (!this.isActive) return undefined;
        return this.#db?.tree?.getLayer(name);
    }

    getLayerById(id) {
        if (!this.isActive) return undefined;
        return this.#db?.tree?.getLayerById(id);
    }

    renameLayer(name, newName) {
        if (!this.isActive) throw new Error('Workspace is not active');
        const result = this.#db.tree.renameLayer(name, newName);
        if (result) {
            this.emit('workspace:layer:renamed', {
                oldName: name,
                newName,
                tree: this.jsonTree,
            });
        }
        return {
            success: result,
            oldName: name,
            newName: result ? newName : null,
            tree: result ? this.jsonTree : null,
        };
    }

    updateLayer(name, options) {
        if (!this.isActive) throw new Error('Workspace is not active');
        const result = this.#db.tree.updateLayer(name, options);
        if (result) {
            this.emit('workspace:layer:updated', {
                name,
                options,
                tree: this.jsonTree,
            });
        }
        return {
            success: result,
            name,
            options: result ? options : null,
            tree: result ? this.jsonTree : null,
        };
    }

    deleteLayer(name) {
        if (!this.isActive) throw new Error('Workspace is not active');
        const result = this.#db.tree.deleteLayer(name);
        if (result) {
            this.emit('workspace:layer:deleted', {
                name,
                tree: this.jsonTree,
            });
        }
        return {
            success: result,
            name,
            tree: result ? this.jsonTree : null,
        };
    }

    /**
     * Convert the workspace's configuration (via configStore) to a plain JSON object.
     * Includes essential properties like id, name, path, etc.
     * @returns {Object} - JSON object representing workspace configuration.
     */
    toJSON() {
        // Return the content of the config store, ensuring key properties are present
        return {
            ...this.config, // Get all persisted config
            // Append runtime variables
            rootPath: this.rootPath,
            configPath: this.configPath,
            status: this.status,
        };
    }

    /**
     * Private methods
     */

    async #updateConfig(key, value) {
        // Made async as set can be async
        if (!this.#configStore) {
            logger.error(`Cannot update config for "${this.id}". Config store not available.`);
            return false;
        }
        try {
            // Conf doesn't return a promise from set, but file I/O is async inherently.
            // Let's assume it's synchronous for now based on `conf` usage.
            // If issues arise, might need to wrap `conf` or use its async methods if available.
            this.#configStore.set(key, value);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit(`workspace:${key}:changed`, { id: this.id, [key]: value });
            return true;
        } catch (err) {
            logger.error(`Failed to update config key "${key}" for workspace "${this.id}": ${err.message}`);
            return false;
        }
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
     * Initialize workspace resources (DB, Tree)
     * @private
     */
    async #initializeResources() {
        // Prevent re-initialization if already active
        if (this.#db) {
            debug(`Resources already initialized for workspace "${this.id}".`);
            return;
        }
        try {
            const dbPath = path.join(this.path, WORKSPACE_DIRECTORIES.db);
            debug(`Initializing database for workspace "${this.id}" at ${dbPath}`);
            this.#db = new Db({
                path: dbPath,
            });

            // Initialize the database
            await this.#db.start();
            this.#tree = this.#db.tree;

            debug(`Database started for workspace "${this.id}".`);
            debug(`Workspace "${this.id}" resources initialized.`);
        } catch (err) {
            debug(`Error during resource initialization for "${this.id}": ${err.message}`);
            // Ensure partial resources are cleaned up if DB creation/start fails
            this.#tree = null;
            this.#db = null; // Clear DB instance on failure
            throw err;
        }
    }

    /**
     * Shutdown workspace resources (DB, Tree)
     * @private
     */
    async #shutdownResources() {
        debug(`Shutting down resources for workspace "${this.id}"...`);
        // Clear tree reference first
        this.#tree = null;
        // Shutdown Database (SynapsD instance)
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
        } else {
            debug(`No active DB instance to shut down for workspace "${this.id}".`);
        }
        debug(`Workspace "${this.id}" resources shut down.`);
    }
}

export default Workspace;
