'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import randomcolor from 'randomcolor';
import path from 'path';
import * as fsPromises from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Conf from 'conf';

// Logging
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('workspace');

// Includes
import SynapsD from '@/services/synapsd/src/index.js';
import Tree from '../../tree/lib/Tree.js';
import JsonIndexManager from '@/utils/jim/index.js';
import Context from '../../context/lib/Context.js';

/**
 * Canvas Workspace
 */
class Workspace extends EventEmitter {

    #id;

    // Paths
    #rootPath;
    #configPath = 'config';
    #dbPath = 'db';
    #treeStorePath = 'db';
    #layersStorePath = 'db';

    // Modules
    #db;
    #tree;
    #layers;
    #configStore;
    #jim;

    #dataSources = [];

    constructor(options = {}) {
        super();

        this.id = options.id;
        this.name = options.name;
        this.type = options.type || 'universe';
        this.owner = options.owner;
        this.ownerId = options.ownerId;
        this.path = options.path;
        this.created = options.created || new Date().toISOString();
        this.updated = options.updated || new Date().toISOString();

        // Initialize config store to null, will be set in initialize()
        this.#configStore = null;
    }

    async initialize() {
        await this.#createWorkspaceDirectories();
        await this.#initializeDatabase();
        await this.#initializeConfigStore();
        await this.#initializeJIM();
        await this.#initializeTree();
    }

    async #createWorkspaceDirectories() {
        const dirs = [
            this.path,
            path.join(this.path, 'db'),
            path.join(this.path, 'config'),
        ];

        for (const dir of dirs) {
            if (!existsSync(dir)) {
                await fsPromises.mkdir(dir, { recursive: true });
                debug(`Created directory: ${dir}`);
            }
        }
    }

    async #initializeDatabase() {
        const dbPath = path.join(this.path, 'db');

        this.#db = new SynapsD({
            path: dbPath,
            backupOnOpen: false,
            backupOnClose: true,
            compression: true,
        });

        await this.#db.start();
        debug(`Initialized SynapsD database for workspace ${this.id} at ${dbPath}`);
    }

    /**
     * Initialize the configuration store using Conf
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
                type: this.type || 'workspace',
                owner: this.owner,
                ownerId: this.ownerId,

                // Display properties
                label: this.label || (this.name ? this.name.charAt(0).toUpperCase() + this.name.slice(1) : 'Workspace'),
                description: this.description || (this.name ? `My ${this.name} workspace` : 'My workspace'),
                color: this.color || '#4285F4',
                locked: this.locked || false,

                // Metadata
                created: this.created || new Date().toISOString(),
                updated: this.updated || new Date().toISOString(),
                acl: this.acl || {},
                meta: this.meta || {}
            }
        });

        debug(`Initialized configuration store for workspace ${this.id}`);
    }

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

            // Create root layer - keep name as '/' for compatibility with Tree class
            // but customize label and description with workspace name
            const workspaceName = this.name || 'workspace';
            const workspaceLabel = workspaceName.charAt(0).toUpperCase() + workspaceName.slice(1);

            const rootLayer = {
                id: '0000-0000-0000',
                type: 'root',
                name: '/',  // Keep as '/' for compatibility with Tree class
                label: workspaceLabel,
                description: `Root layer for ${workspaceName}`,
                workspaceName: workspaceName,  // Add workspace name as a property
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

        debug(`Initialized JSON Index Manager for workspace ${this.id}`);

        return { treeIndex, layerIndex };
    }

    async #initializeTree() {
        if (!this.#jim) {
            await this.#initializeJIM();
        }

        const treeIndex = this.#jim.getIndex('tree');
        const layerIndex = this.#jim.getIndex('layers');

        this.#tree = new Tree({
            db: this.#db,
            workspace: this,
            treeIndexStore: treeIndex,
            layerIndexStore: layerIndex
        });

        // The Tree class initializes in its constructor, no need to call initialize()
        debug('Context tree initialized for workspace');

        return this.#tree;
    }

    /**
     * Get a configuration value
     * @param {string} key - Configuration key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} - Configuration value
     */
    getConfig(key, defaultValue) {
        return this.#configStore.get(key, defaultValue);
    }

    /**
     * Set a configuration value
     * @param {string} key - Configuration key
     * @param {*} value - Configuration value
     */
    setConfig(key, value) {
        this.#configStore.set(key, value);
        // Update the updated timestamp
        this.#configStore.set('updated', new Date().toISOString());
    }

    /**
     * Delete a configuration value
     * @param {string} key - Configuration key
     */
    deleteConfig(key) {
        this.#configStore.delete(key);
    }

    /**
     * Get all configuration values
     * @returns {Object} - All configuration values
     */
    getAllConfig() {
        return this.#configStore.store;
    }

    /**
     * Get the workspace tree
     * @returns {Tree} - Workspace tree
     */
    async getTree() {
        if (!this.#tree) {
            await this.#initializeTree();
        }
        return this.#tree;
    }

    /**
     * Create layers from a path
     * @param {string} contextPath - Context path
     * @param {Object} options - Layer options
     * @returns {Promise<Array<Object>>} - Array of created layers
     */
    async createLayersFromPath(contextPath, options = {}) {
        debug(`Creating layers from path: ${contextPath}`);

        if (!this.#tree) {
            await this.#initializeTree();
        }

        // Normalize path
        if (!contextPath.startsWith('/')) {
            contextPath = '/' + contextPath;
        }

        // Split path into parts
        const pathParts = contextPath.split('/').filter(part => part.length > 0);

        if (pathParts.length === 0) {
            debug('No path parts to create layers from');
            return [];
        }

        const layers = [];
        let currentPath = '';

        // Create or get each layer in the path
        for (const part of pathParts) {
            currentPath += '/' + part;

            try {
                // Try to get existing layer from tree
                let layer = this.#tree.getLayer(part);

                if (!layer) {
                    // Create new layer if it doesn't exist
                    const layerOptions = {
                        name: part,
                        path: currentPath,
                        type: options.layerType || 'generic',
                        color: options.color || this.#generateRandomColor(),
                        label: options.useCapitalizedNames ?
                            part.charAt(0).toUpperCase() + part.slice(1) :
                            part,
                        description: options.description || `Layer for ${part}`,
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                    };

                    layer = await this.#tree.createLayer(layerOptions);
                    debug(`Created new layer: ${part} at path ${currentPath}`);
                } else {
                    debug(`Using existing layer: ${part}`);

                    // Update layer if update option is true
                    if (options.update === true) {
                        const updateOptions = {
                            ...layer,
                            color: options.color || layer.color,
                            label: options.useCapitalizedNames ?
                                part.charAt(0).toUpperCase() + part.slice(1) :
                                layer.label,
                            description: options.description || layer.description,
                            updated: new Date().toISOString(),
                            update: true
                        };

                        layer = await this.#tree.createLayer(updateOptions);
                        debug(`Updated existing layer: ${part}`);
                    }
                }

                layers.push(layer);
            } catch (err) {
                debug(`Error creating/getting layer ${part}: ${err.message}`);

                // Create a basic layer object as fallback
                const fallbackLayer = {
                    id: uuidv4(),
                    name: part,
                    path: currentPath,
                    type: 'generic',
                    color: this.#generateRandomColor(),
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                };

                layers.push(fallbackLayer);
                debug(`Created fallback layer: ${part}`);
            }
        }

        return layers;
    }

    /**
     * Generate a random color for layers
     * @returns {string} - Random color in hex format
     * @private
     */
    #generateRandomColor() {
        const colors = [
            '#4285F4', // Google Blue
            '#34A853', // Google Green
            '#FBBC05', // Google Yellow
            '#EA4335', // Google Red
            '#673AB7', // Deep Purple
            '#3F51B5', // Indigo
            '#2196F3', // Blue
            '#03A9F4', // Light Blue
            '#00BCD4', // Cyan
            '#009688', // Teal
            '#4CAF50', // Green
            '#8BC34A', // Light Green
            '#CDDC39', // Lime
            '#FFEB3B', // Yellow
            '#FFC107', // Amber
            '#FF9800', // Orange
            '#FF5722', // Deep Orange
            '#795548', // Brown
            '#9E9E9E', // Grey
            '#607D8B'  // Blue Grey
        ];

        return colors[Math.floor(Math.random() * colors.length)];
    }

    get db() { return this.#db; }
    get tree() { return this.#tree; }
    get config() { return this.#configStore.store; }

    async createContext(sessionId, contextPath = '/') {
        if (!this.#tree) {
            await this.#initializeTree();
        }

        debug(`Creating context for session ${sessionId} at path ${contextPath}`);

        // Ensure the path exists in the tree
        if (!this.#tree.pathExists(contextPath)) {
            debug(`Path ${contextPath} does not exist in tree, creating it`);
            this.#tree.insert(contextPath, null, true);
        }

        // Create a context URL in the format sessionId@workspaceId://contextPath
        const contextUrl = `${sessionId}@${this.id}://${contextPath}`;
        debug(`Created context URL: ${contextUrl}`);

        // Create and return a new Context object
        const context = new Context(contextUrl, {
            workspace: this,
            sessionId: sessionId
        });

        // Initialize the context
        await context.initialize();

        return context;
    }

    async getContext(sessionId, contextPath) {
        if (!this.#tree) {
            await this.#initializeTree();
        }

        // Create a context URL in the format sessionId@workspaceId://contextPath
        const contextUrl = `${sessionId}@${this.id}://${contextPath}`;

        // Create and initialize a new Context object
        const context = new Context(contextUrl, {
            workspace: this,
            sessionId: sessionId
        });

        await context.initialize();

        return context;
    }

    async shutdown() {
        if (this.#db) {
            await this.#db.shutdown();
        }
    }
}

export default Workspace;
