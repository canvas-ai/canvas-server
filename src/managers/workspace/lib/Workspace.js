'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import path from 'path';
import Conf from 'conf';

// Logging
import { createDebug } from '@/utils/log/index.js';
const debug = createDebug('workspace');

// Includes
import SynapsD from '@/services/synapsd/src/index.js';
import Tree from '../../tree/lib/Tree.js';
import JsonIndexManager from '@/utils/jim/index.js';

/**
 * Canvas Workspace
 * Represents a workspace with configuration and resources
 */
class Workspace extends EventEmitter {
    // Private properties
    #configStore;
    #db;
    #tree;
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

        if (!options.type) {
            throw new Error('Workspace type is required');
        }

        if (!options.owner) {
            throw new Error('Workspace owner is required');
        }

        if (options.color && !this.#validateColor(options.color)) {
            throw new Error('Invalid color format');
        }

        if (!options.path) {
            throw new Error('Workspace path is required');
        }

        this.id = options.id;
        this.name = options.name;
        this.type = options.type;
        this.owner = options.owner;
        this.path = options.path;
        this.color = options.color;
        this.label = options.label || this.name.charAt(0).toUpperCase() + this.name.slice(1);
        this.description = options.description || `My ${this.name} workspace`;
        this.locked = options.locked || false;

        this.created = options.created || new Date().toISOString();
        this.updated = options.updated || new Date().toISOString();
        this.acl = options.acl || {};
        this.meta = options.meta || {};

        // Initialize config store to null, will be set by WorkspaceManager
        this.#configStore = null;
    }

    // Getters
    get db() { return this.#db; }
    get tree() { return this.#tree.toJSON(); }
    get layers() { return this.#tree?.layers; }
    get config() { return this.#configStore?.store || {}; }
    get isConfigLoaded() { return this.#configStore !== null; }
    get isOpen() { return this.#db !== null && this.#tree !== null; }

    /**
     * Get the tree instance
     * @returns {Tree} - The tree instance
     */
    getTree() {
        return this.#tree.toJSON();
    }

    insertPath(path, options = {}) {
        return this.#tree.insert(path, options);
    }

    // Setters and configuration methods
    /**
     * Set workspace color
     * @param {string} color - Color in hex format
     * @returns {boolean} - True if color was set successfully
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

    /**
     * Set workspace description
     * @param {string} description - Workspace description
     */
    setDescription(description) {
        this.description = description;
        if (this.#configStore) {
            this.#configStore.set('description', description);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit('workspace:description:changed', { name: this.name, description });
        }
    }

    /**
     * Set workspace label
     * @param {string} label - Workspace label
     */
    setLabel(label) {
        this.label = label;
        if (this.#configStore) {
            this.#configStore.set('label', label);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit('workspace:label:changed', { name: this.name, label });
        }
    }

    /**
     * Lock the workspace
     */
    lock() {
        this.locked = true;
        if (this.#configStore) {
            this.#configStore.set('locked', true);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit('workspace:locked', { name: this.name });
        }
    }

    /**
     * Unlock the workspace
     */
    unlock() {
        this.locked = false;
        if (this.#configStore) {
            this.#configStore.set('locked', false);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit('workspace:unlocked', { name: this.name });
        }
    }

    /**
     * Get a configuration value
     * @param {string} key - Configuration key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} - Configuration value
     */
    getConfigKey(key, defaultValue) {
        return this.#configStore?.get(key, defaultValue);
    }

    /**
     * Set a configuration value
     * @param {string} key - Configuration key
     * @param {*} value - Configuration value
     */
    setConfigKey(key, value) {
        if (this.#configStore) {
            this.#configStore.set(key, value);
            this.#configStore.set('updated', new Date().toISOString());
            this.emit('workspace:config:changed', { name: this.name, key, value });
        }
    }

    /**
     * Get all configuration values
     * @returns {Object} - All configuration values
     */
    getConfig() {
        return this.#configStore?.store || {};
    }

    // Internal methods for WorkspaceManager to use
    /**
     * Initialize the configuration store
     * @internal - Should only be called by WorkspaceManager
     */
    async _initializeConfig() {
        debug(`Initializing configuration for workspace ${this.name}`);
        await this.#initializeConfigStore();

        // Update instance properties from config
        const config = this.#configStore.store;
        this.color = this.#validateColor(config.color) ? config.color : '#4285F4';
        this.label = config.label;
        this.description = config.description;
        this.locked = config.locked;
        this.acl = config.acl;
        this.meta = config.meta;

        this.emit('workspace:config:initialized', { id: this.name });
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

        this.#tree = null;
        this.#jim = null;

        this.emit('workspace:resources:shutdown', { id: this.name });
    }

    /**
     * Initialize the workspace (configuration and resources)
     * @returns {Promise<void>}
     */
    async initialize() {
        debug(`Initializing workspace ${this.name}`);
        await this._initializeConfig();
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
     * Initialize the configuration store using Conf
     * @private
     */
    async #initializeConfigStore() {
        // Create a Conf instance for workspace configuration with all properties from this instance
        this.#configStore = new Conf({
            configName: 'workspace',
            cwd: this.path,
            // Use all properties from this instance as defaults
            defaults: {
                // Core properties
                id: this.id,
                name: this.name,
                type: this.type,
                owner: this.owner,

                // Display properties
                label: this.label,
                description: this.description,
                color: this.color,
                locked: this.locked,

                // Metadata
                created: this.created,
                updated: this.updated,
                acl: this.acl,
                meta: this.meta
            }
        });

        debug(`Initialized configuration store for workspace ${this.name}`);
    }

    /**
     * Initialize the database
     * @private
     */
    async #initializeDatabase() {
        const dbPath = path.join(this.path, 'db');

        this.#db = new SynapsD({
            path: dbPath,
            backupOnOpen: false,
            backupOnClose: true,
            compression: true,
        });

        await this.#db.start();
        debug(`Initialized SynapsD database for workspace ${this.name} at ${dbPath}`);
    }

    /**
     * Initialize the JSON Index Manager
     * @private
     */
    async #initializeJIM() {
        const configPath = path.join(this.path, 'config');

        this.#jim = new JsonIndexManager({
            rootPath: configPath,
            driver: 'conf'
        });

        // Create the tree and layer indexes
        const treeIndex = this.#jim.createIndex('tree');
        const layerIndex = this.#jim.createIndex('layers');

        // Initialize the layer index with a root layer if it doesn't exist
        if (!layerIndex.has('layers')) {
            debug('Initializing layer index with root layer');
            layerIndex.set('layers', []);

            // Create root layer with workspace ID
            const rootLayer = {
                id: this.id, // Use workspace ID for root layer
                type: 'root',
                name: '/',  // Keep as '/' for compatibility with Tree class
                label: this.label || (this.name ? this.name.charAt(0).toUpperCase() + this.name.slice(1) : 'Workspace'),
                description: this.description || (this.name ? `Root layer for ${this.name}` : 'Root layer'),
                color: '#fff',
                locked: true,
                update: true,  // Set update option to true
                created: new Date().toISOString(),
                updated: new Date().toISOString()
            };

            layerIndex.set('root', rootLayer);

            // Add to layers array
            const layers = layerIndex.get('layers', []);
            layers.push(rootLayer);
            layerIndex.set('layers', layers);
        }

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

        this.#tree = new Tree({
            treeIndexStore: treeIndex,
            layerIndexStore: layerIndex
        });

        debug(`Context tree initialized for workspace ${this.name}`);
        return this.#tree;
    }
}

export default Workspace;
