'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import path from 'path';

// Logging
import { createDebug } from '@/utils/log/index.js';
const debug = createDebug('workspace');

// Includes
import Db from '@/services/synapsd/src/index.js';

// Constants
import {
    WORKSPACE_STATUS_VALUES,
    WORKSPACE_DIRECTORIES
} from '../index.new.js';

/**
 * Canvas Workspace
 */

class Workspace extends EventEmitter {

    // Internal
    #configStore;
    #db;
    #tree;


    /**
     * Create a new Workspace instance
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        super();

        if (!options.id) {
            throw new Error('Workspace ID is required');
        }

        if (!options.name) {
            throw new Error('Workspace name is required');
        }

        if (options.color && !this.#validateColor(options.color)) {
            throw new Error('Invalid color format');
        }

        if (!options.path) {
            throw new Error('Workspace path is required');
        }

        if (!options.configStore) {
            throw new Error('Config store is required');
        }

        this.id = options.id;
        this.name = options.name;
        this.type = options.type ?? 'workspace';
        this.owner = options.owner;
        this.path = options.path;
        this.color = options.color;
        this.label = options.label || this.name.charAt(0).toUpperCase() + this.name.slice(1);
        this.description = options.description || `My ${this.name} workspace`;
        this.locked = options.locked || false;
        this.created = options.created || new Date().toISOString();
        this.updated = options.updated || new Date().toISOString();
        this.acl = options.acl || {};

        // Initialize config store to null, will be set by WorkspaceManager
        this.#configStore = options.configStore || null;

        // Set initial status in the config store if provided
        if (this.#configStore && options.status) {
            this.#configStore.set('status', options.status);
        }

        this.status = 'initialized';
    }

    /**
     * Getters
     */

    get db() { return this.#db; }
    get tree() { return this.#tree; }
    get jsonTree() { return this.tree?.jsonTree; }
    get layers() { return this.tree?.layers; }
    get config() { return this.#configStore?.store || {}; }
    get isConfigLoaded() { return this.#configStore !== null; }
    get isOpen() { return this.#db !== null && this.tree !== null; }
    get isDeleted() { return this.status === WORKSPACE_STATUS_VALUES.DELETED; }
    get isActive() { return this.status === WORKSPACE_STATUS_VALUES.ACTIVE; }
    get status() { return this.status; }

    /**
     * Workspace controls
     */

    async start() {
        if (this.status === WORKSPACE_STATUS_VALUES.ACTIVE) {
            debug(`Workspace ${this.name} is already active`);
            return this;
        }

        await this.#initializeResources();
        // await this.#initializeRoles();

        this.#setStatus(WORKSPACE_STATUS_VALUES.ACTIVE);
        this.emit('workspace:started', { id: this.id });
    }

    async stop() {
        if (this.status !== WORKSPACE_STATUS_VALUES.ACTIVE) {
            debug(`Workspace ${this.name} is not active`);
            return false;
        }

        await this.#shutdownResources();
        // await this.#shutdownRoles();

        this.#setStatus(WORKSPACE_STATUS_VALUES.INACTIVE);
        this.emit('workspace:stopped', { id: this.id });
    }

    /**
     * Tree methods
     */

    getTree() {
        return this.tree.toJSON();
    }

    insertPath(path, data = null, autoCreateLayers = true) {
        const result = this.tree.insertPath(path, data, autoCreateLayers);
        this.emit('workspace:tree:updated', {
            operation: 'insertPath',
            path,
            tree: this.jsonTree
        });
        return {
            layerIds: result,
            tree: this.jsonTree
        };
    }

    removePath(path, recursive) {
        const result = this.tree.removePath(path, recursive);
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
        const result = this.tree.movePath(pathFrom, pathTo, recursive);
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
        const result = this.tree.copyPath(pathFrom, pathTo, recursive);
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
        return this.tree.pathToIdArray(path);
    }

    mergeUp(path) {
        const result = this.tree.mergeUp(path);
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
        const result = this.tree.mergeDown(path);
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
     * @returns {Object} - Layer object or null if not found
     */
    getLayer(name) {
        return this.tree.getLayer(name);
    }

    /**
     * Get a workspace layer by ID
     * @param {string} id - Layer ID
     * @returns {Object} - Layer object or null if not found
     */
    getLayerById(id) {
        return this.tree.getLayerById(id);
    }

    /**
     * Get all paths in the workspace tree
     * @returns {Array} - Array of paths
     */
    get paths() {
        return this.tree.paths;
    }

    /**
     * Insert a canvas layer at a specified path
     * @param {string} path - Parent path where to insert the canvas
     * @param {string} canvasName - Name of the canvas
     * @param {Object} options - Canvas options
     * @returns {Object} - Result with canvas ID and updated tree
     */
    insertCanvas(path, canvasName, options = {}) {
        const canvasLayer = this.createLayer({
            name: canvasName,
            type: 'canvas',
            ...options
        });

        const canvasPath = path === '/' ? `/${canvasName}` : `${path}/${canvasName}`;
        this.tree.insertPath(canvasPath);

        this.emit('workspace:tree:updated', {
            operation: 'insertCanvas',
            path,
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
     * @param {string} path - Parent path where to insert the workspace reference
     * @param {string} workspaceName - Name of the workspace reference
     * @param {string} targetWorkspaceId - ID of the target workspace
     * @param {Object} options - Workspace options
     * @returns {Object} - Result with workspace ID and updated tree
     */
    insertWorkspace(path, workspaceName, targetWorkspaceId, options = {}) {
        const workspaceLayer = this.createLayer({
            name: workspaceName,
            type: 'workspace',
            metadata: {
                targetWorkspaceId
            },
            ...options
        });

        const workspacePath = path === '/' ? `/${workspaceName}` : `${path}/${workspaceName}`;
        this.tree.insertPath(workspacePath);

        this.emit('workspace:tree:updated', {
            operation: 'insertWorkspace',
            path,
            workspaceName,
            targetWorkspaceId,
            workspaceId: workspaceLayer.id,
            tree: this.jsonTree
        });

        return {
            workspaceId: workspaceLayer.id,
            path: workspacePath,
            workspaceName,
            targetWorkspaceId,
            tree: this.jsonTree
        };
    }

    /**
     * Tree layer methods
     */

    createLayer(options) {
        const layer = this.tree.createLayer(options);
        this.emit('workspace:layer:created', {
            layer,
            tree: this.jsonTree
        });
        return layer;
    }

    renameLayer(name, newName) {
        const result = this.tree.renameLayer(name, newName);
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
        const result = this.tree.updateLayer(name, options);
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
        const result = this.tree.deleteLayer(name);
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
     */

    setColor(color) {
        if (!this.#validateColor(color)) {
            debug(`Invalid color format: ${color}`);
            return false;
        }

        this.color = color;
        if (this.#configStore) {
            this.#configStore.set('color', color);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit('workspace:color:changed', { name: this.name, color });
        }
        return true;
    }

    setDescription(description) {
        this.description = description;
        if (this.#configStore) {
            this.#configStore.set('description', description);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit('workspace:description:changed', { name: this.name, description });
        }
    }

    setLabel(label) {
        this.label = label;
        if (this.#configStore) {
            this.#configStore.set('label', label);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit('workspace:label:changed', { name: this.name, label });
        }
    }

    lock() {
        this.locked = true;
        if (this.#configStore) {
            this.#configStore.set('locked', true);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit('workspace:locked', { name: this.name });
        }
    }

    unlock() {
        this.locked = false;
        if (this.#configStore) {
            this.#configStore.set('locked', false);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit('workspace:unlocked', { name: this.name });
        }
    }

    getConfigKey(key, defaultValue) {
        return this.#configStore?.get(key, defaultValue);
    }

    setConfigKey(key, value) {
        if (this.#configStore) {
            this.#configStore.set(key, value);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit('workspace:config:changed', { name: this.name, key, value });
        }
    }

    getConfig() {
        return this.#configStore?.store || {};
    }

    /**
     * Convert the workspace to a JSON object
     * @returns {Object} - JSON object
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            label: this.label,
            description: this.description,
            color: this.color,
            locked: this.locked,
            created: this.created,
            updated: this.updated,
            acl: this.acl,
            path: this.path,
            status: this.status,
        };
    }

    /**
     * Private methods
     */

    /**
     * Set the workspace status
     * @param {string} status - Status to set
     * @returns {boolean} - True if status was set, false otherwise
     * @private
     */
    #setStatus(status) {
        if (!Object.values(WORKSPACE_STATUS_VALUES).includes(status)) {
            debug(`Invalid status: ${status}`);
            return false;
        }

        this.#configStore.set('status', status);
        this.#configStore.set('updated', new Date().toISOString());
        this.emit('workspace:status:changed', { name: this.name, status });
        return true;
    }

    /**
     * Validate color format (hex color)
     * @param {string} color - Color to validate
     * @returns {boolean} - True if color is valid
     * @private
     */
    #validateColor(color) {
        if (!color) {
            return false;
        }

        const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
        return hexRegex.test(color);
    }

    /**
     * Initialize workspace resources
     * @private
     */
    async #initializeResources() {
        await this.#initializeDatabase();
    }

    /**
     * Shutdown workspace resources
     * @private
     */
    async #shutdownResources() {
        await this.#stopDatabase();
    }

    /**
     * Initialize the database
     * @private
     */
    async #initializeDatabase() {
        const dbPath = path.join(this.path, 'db');

        this.#db = new Db({
            path: dbPath,
            backupOnOpen: false,
            backupOnClose: true,
            compression: true,
        });

        await this.#db.start();
        debug(`Initialized database for workspace ${this.name} at ${dbPath}`);
    }

    /**
     * Stop the database
     * @private
     */
    async #stopDatabase() {
        await this.#db.shutdown();
        this.#db = null;
    }

}

export default Workspace;
