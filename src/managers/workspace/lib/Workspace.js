'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import randomcolor from 'randomcolor';
import path from 'path';
import fs from 'fs';

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
            path.join(this.path, 'config')
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
            compression: true
        });

        await this.#db.start();
        debug(`Initialized SynapsD database for workspace ${this.id} at ${dbPath}`);
    }

    async #initializeTree() {
        this.#tree = new Tree({
            db: this.#db,
            workspace: this
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
                updated: this.updated
            };
            await this.saveConfig();
        }
    }

    async saveConfig() {
        const configPath = path.join(this.path, 'workspace.json');
        await fs.writeFile(configPath, JSON.stringify(this.#config, null, 2));
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
