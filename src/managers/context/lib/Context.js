'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import { v4 as uuidv4 } from 'uuid';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('context');

// Includes
import Url from './Url.js';

/**
 * Context
 * Represents a view on top of data, holding references to workspace, session, device, etc.
 */
class Context extends EventEmitter {

    // Context properties
    #id;
    #name;
    #baseUrl;
    #url;
    #urlPath;

    // Workspace references
    #db; // workspace.db
    #tree; // workspace.tree
    #treeLayers; // workspace.tree.layers

    // Bitmap arrays
    #systemBitmapArray = [];
    #contextBitmapArray = [];
    #featureBitmapArray = [];
    #filterBitmapArray = [];

    // Manager module references
    #device;
    #user;
    #workspace;

    // Context metadata
    #created;
    #updated;
    #isLocked = false;

    constructor(url, options) {
        super();

        // Context properties
        this.#id = options.id || uuidv4();
        this.#name = options.name || this.#id;
        this.#baseUrl = options.baseUrl || false;

        // Manager module references
        this.#device = options.device;
        this.#user = options.user;
        this.#workspace = options.workspace;

        // Workspace references
        this.#db = this.#workspace.db;
        this.#tree = this.#workspace.tree;
        this.#treeLayers = this.#workspace.tree.layers;

        // Context metadata
        this.#created = options.created || new Date().toISOString();
        this.#updated = options.updated || new Date().toISOString();

        debug(`Context ${this.#id} created at ${url}, base URL: ${this.#baseUrl}`);
    }

    // Getters
    get id() { return this.#id; }
    get name() { return this.#name; }

    get baseUrl() { return this.#baseUrl; }
    get url() { return this.#url; }
    get urlPath() { return this.#urlPath; }

    get workspace() { return this.#workspace.id; }
    get device() { return this.#device.id; }
    get app() { return this.#device.app; }
    get user() { return this.#user; }
    get identity() { return this.#user.identity; }
    get tree() { return this.#workspace.tree.toJSON(); } // Legacy


    /**
     * Context API
     */

    setUrl(url) {
        this.#url = url;
        this.#urlPath = new Url(url).path;
    }

    /**
     * Document API
     */

    getDocument(documentId) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

    }

    getDocuments(featureArray = [], filterArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }
    }

    listDocuments(featureArray = [], filterArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }
    }

    toJSON() {
        return {
        };
    }

}

export default Context;
