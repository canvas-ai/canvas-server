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

    listDocuments(featureArray = [], filterArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        // This may be subject to change, if featureArray is empty, we'll use the context-wide feature array
        if (featureArray.length === 0) {
            featureArray = this.#featureBitmapArray;
        }

        // Additionally filter based on system features (os, app, device, user)
        if (options.includeSystemContext) {
            featureArray.push(this.#systemBitmapArray);
        }

        // Filters are out of scope for now
        return this.#db.listDocuments(featureArray, filterArray, options);
    }

    insertDocument(document, featureArray = []) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!document) {
            throw new Error('Document is required');
        }

        // We always index with all features
        featureArray = [
            ...this.#featureBitmapArray,
            ...this.#systemBitmapArray,
            ...featureArray,
        ];

        // Insert the document
        return this.#db.insertDocument(document, featureArray, options); // not sure if its a good practice to allow passing options here
    }

    insertDocuments(documentArray, featureArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documentArray)) {
            throw new Error('Document array must be an array');
        }

        // We always index with all features
        featureArray = [
            ...this.#featureBitmapArray,
            ...this.#systemBitmapArray,
            ...featureArray,
        ];

        // Insert the documents
        return this.#db.insertDocuments(documentArray, featureArray, options);
    }

    updateDocument(document, featureArray = []) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!document) {
            throw new Error('Document is required');
        }

        // We always index with all features
        featureArray = [
            ...this.#featureBitmapArray,
            ...this.#systemBitmapArray,
            ...featureArray,
        ];

        // Update the document
        return this.#db.updateDocument(document, featureArray, options);
    }

    updateDocuments(documentArray, featureArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documentArray)) {
            throw new Error('Document array must be an array');
        }

        // Update the documents
        return this.#db.updateDocuments(documentArray, featureArray, options);
    }

    removeDocument(documentId, options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        // We remove document from the current context not from the database
        return this.#db.removeDocument(documentId, featureArray, options);
    }

    removeDocuments(documentIdArray, featureArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documentIdArray)) {
            throw new Error('Document ID array must be an array');
        }

        // We remove documents from the current context not from the database
        return this.#db.removeDocuments(documentIdArray, featureArray, options);
    }

    deleteDocument(documentId) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        // Completely delete the document from the database
        return this.#db.deleteDocument(documentId);
    }

    deleteDocuments(documentIdArray, featureArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documentIdArray)) {
            throw new Error('Document ID array must be an array');
        }

        // Completely delete the documents from the database
        return this.#db.deleteDocuments(documentIdArray, featureArray, options);
    }

    /**
     * Document Feature API
     */

    addDocumentFeature(feature) { }
    removeDocumentFeature(feature) { }
    listDocumentFeatures() { }
    hasDocumentFeature(feature) { }

    /**
     * Utils
     */

    toJSON() {
        return {
            id: this.#id,
            name: this.#name,
            url: this.#url,
            baseUrl: this.#baseUrl,
            created: this.#created,
            updated: this.#updated,
        };
    }

}

export default Context;
