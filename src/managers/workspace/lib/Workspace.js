'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import randomcolor from 'randomcolor';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Logging
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('workspace');

// Includes
import SynapsD from '@/services/synapsd/src/index.js';
import Tree from '../../tree/lib/Tree.js';

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
    #config;

    #dataSources = [];

    constructor(options = {}) {
        super();

        this.id = options.id;
        this.name = options.name;
        this.type = options.type || 'universe';
        this.ownerId = options.ownerId;
        this.path = options.path;
        this.created = options.created || new Date().toISOString();
        this.updated = options.updated || new Date().toISOString();

        this.#config = null;
    }

    async initialize() {
        await this.#createWorkspaceDirectories();
        await this.#initializeDatabase();
        await this.#initializeTree();
        await this.#loadConfig();
    }

    async #createWorkspaceDirectories() {
        const dirs = [
            this.path,
            path.join(this.path, 'db'),
            path.join(this.path, 'config'),
        ];

        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
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

    async #initializeTree() {
        this.#tree = new Tree({
            db: this.#db,
            workspace: this,
        });
        await this.#tree.initialize();
        debug(`Initialized context tree for workspace ${this.id}`);
    }

    async #loadConfig() {
        const configPath = path.join(this.path, 'workspace.json');
        try {
            const configData = await fs.readFile(configPath, 'utf8');
            this.#config = JSON.parse(configData);
        } catch (error) {
            debug(`Failed to load workspace config: ${error.message}`);
            // Create default config if not exists
            this.#config = {
                id: this.id,
                name: this.name,
                type: this.type,
                ownerId: this.ownerId,
                created: this.created,
                updated: this.updated,
            };
            await this.saveConfig();
        }
    }

    async saveConfig() {
        const configPath = path.join(this.path, 'workspace.json');
        await fs.writeFile(configPath, JSON.stringify(this.#config, null, 2));
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
     * @returns {Promise<Array<Object>>} - Array of created layers
     */
    async createLayersFromPath(contextPath) {
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
                let layer = await this.#tree.getLayer(part);

                if (!layer) {
                    // Create new layer if it doesn't exist
                    layer = await this.#tree.createLayer({
                        id: uuidv4(),
                        name: part,
                        path: currentPath,
                        type: 'generic',
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                    });

                    debug(`Created new layer: ${part} at path ${currentPath}`);
                } else {
                    debug(`Using existing layer: ${part}`);
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
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                };

                layers.push(fallbackLayer);
                debug(`Created fallback layer: ${part}`);
            }
        }

        return layers;
    }

    get db() { return this.#db; }
    get tree() { return this.#tree; }
    get config() { return this.#config; }

    async createContext(sessionId, contextPath = '/') {
        return await this.#tree.createContext(sessionId, contextPath);
    }

    async getContext(sessionId, contextPath) {
        return await this.#tree.getContext(sessionId, contextPath);
    }

    async shutdown() {
        if (this.#db) {
            await this.#db.shutdown();
        }
    }
}

export default Workspace;
