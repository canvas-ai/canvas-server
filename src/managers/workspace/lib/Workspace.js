'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import path from 'path';
import Conf from 'conf';

// Logging
import { createDebug } from '@/utils/log/index.js';
const debug = createDebug('workspace');

// Includes
import Db from '@/services/synapsd/src/index.js';
import Tree from '../../tree/lib/Tree.js';
import JsonIndexManager from '@/utils/jim/index.js';

// Constants
const WORKSPACE_STATUS = {
    INITIALIZED: 'initialized',
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    DELETED: 'deleted',
};

/**
 * Canvas Workspace
 * Represents a workspace with configuration and resources
 */
class Workspace extends EventEmitter {
    // Private properties
    #configStore;
    #db;
    #jim;

    //#data; (storeD)
    //#apps;
    //#roles;
    //#dotfiles;

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
    }

    // Getters
    get db() {
        return this.#db;
    }
    get jsonTree() {
        return this.tree.jsonTree   ;
    }
    get layers() {
        return this.tree?.layers;
    }
    get config() {
        return this.#configStore?.store || {};
    }
    get isConfigLoaded() {
        return this.#configStore !== null;
    }
    get isOpen() {
        return this.#db !== null && this.tree !== null;
    }
    get isDeleted() {
        return this.status === WORKSPACE_STATUS.DELETED;
    }
    get isActive() {
        return this.status === WORKSPACE_STATUS.ACTIVE;
    }
    get status() {
        return this.#configStore?.get('status', WORKSPACE_STATUS.INITIALIZED);
    }

    // Status methods
    setStatus(status) {
        if (!Object.values(WORKSPACE_STATUS).includes(status)) {
            debug(`Invalid status: ${status}`);
            return false;
        }

        if (this.#configStore) {
            this.#configStore.set('status', status);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit('workspace:status:changed', { name: this.name, status });
        }
        return true;
    }

    markAsActive() {
        return this.setStatus(WORKSPACE_STATUS.ACTIVE);
    }

    markAsInactive() {
        return this.setStatus(WORKSPACE_STATUS.INACTIVE);
    }

    markAsDeleted() {
        return this.setStatus(WORKSPACE_STATUS.DELETED);
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
     * Initialize the database and resources
     * @internal - Should only be called by WorkspaceManager
     */
    async _initializeResources() {
        debug(`Initializing resources for workspace ${this.name}`);

        if (!this.#configStore) {
            throw new Error('Configuration must be initialized before resources');
        }

        await this.#initializeDatabase();
        await this.#initializeJIM();
        await this.#initializeTree();

        this.emit('workspace:resources:initialized', { id: this.name });
    }

    /**
     * Shutdown the database and resources
     * @internal - Should only be called by WorkspaceManager
     */
    async _shutdownResources() {
        debug(`Shutting down resources for workspace ${this.name}`);

        if (this.#db) {
            await this.#db.shutdown();
            this.#db = null;
        }

        this.tree = null;
        this.#jim = null;

        this.emit('workspace:resources:shutdown', { id: this.name });
    }

    /**
     * Initialize the workspace (configuration and resources)
     * @returns {Promise<void>}
     */
    async initialize() {
        debug(`Initializing workspace ${this.name}`);
        await this._initializeResources();
        debug(`Workspace ${this.name} initialized successfully`);
    }

    /**
     * Shutdown the workspace (close database and resources)
     * @returns {Promise<void>}
     */
    async shutdown() {
        debug(`Shutting down workspace ${this.name}`);
        await this._shutdownResources();
        debug(`Workspace ${this.name} shutdown successfully`);
    }

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

    // Private methods
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
     * Initialize the JSON Index Manager
     * @private
     */
    async #initializeJIM() {
        const configPath = path.join(this.path, 'config');

        this.#jim = new JsonIndexManager({
            rootPath: configPath,
            driver: 'conf',
        });

        // Create the tree and layer indexes
        const treeIndex = this.#jim.createIndex('tree');
        const layerIndex = this.#jim.createIndex('layers');

        debug(`Initialized JSON Index Manager for workspace ${this.name}`);
        return { treeIndex, layerIndex };
    }

    /**
     * Initialize the tree
     * @private
     */
    async #initializeTree() {
        if (!this.#jim) {
            await this.#initializeJIM();
        }

        const treeIndex = this.#jim.getIndex('tree');
        const layerIndex = this.#jim.getIndex('layers');

        this.tree = new Tree({
            treeIndexStore: treeIndex,
            layerIndexStore: layerIndex,
            rootLayerOptions: {
                id: this.id, // Use workspace ID for root layer
                type: 'universe',
                name: '/', // Keep as '/' for compatibility with Tree class
                label:
                    this.label || (this.name ? this.name.charAt(0).toUpperCase() + this.name.slice(1) : 'Universe Workspace'),
                description: this.description || (this.name ? `Root layer for ${this.name}` : 'And then there was geometry'),
                color: '#fff',
                locked: true,
                update: true,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
            },
        });

        debug(`Context tree initialized for workspace ${this.name}`);
        return this.tree;
    }
}

export default Workspace;
