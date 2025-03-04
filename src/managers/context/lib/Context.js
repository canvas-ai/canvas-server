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
    #isLocked;

    constructor(url, options) {
        super();

        // Context properties
        this.#id = options.id || uuidv4();
        this.#name = options.name || this.#id;
        this.#baseUrl = options.baseUrl || false;
        this.#isLocked = options.locked || false;

        // Manager module references
        this.#device = options.device;
        this.#user = options.user;
        this.#workspace = options.workspace;

        // In-Workspace references
        this.#db = this.#workspace.db;
        this.#tree = this.#workspace.tree;

        // Context metadata
        this.#created = options.created || new Date().toISOString();
        this.#updated = options.updated || new Date().toISOString();

        // Set URL
        this.setUrl(url);

        debug(`Context ${this.#id} created at ${url}, base URL: ${this.#baseUrl}`);
        this.emit('created', this.toJSON());
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
    get tree() { return this.#tree.toJSON(); } // Legacy

    /**
     * Context API
     */

    setUrl(url) {
        if (this.#isLocked) {
            throw new Error('Context is locked');
        }

        this.#url = url;
        this.#urlPath = new Url(url).path;
        this.emit('change:url', url);
    }

    setBaseUrl(baseUrl) {
        if (this.#isLocked) {
            throw new Error('Context is locked');
        }

        this.#baseUrl = baseUrl;
        this.setUrl(baseUrl);
    }

    lock() {
        this.#isLocked = true;
        this.emit('lock', this.#id);
    }

    unlock() {
        this.#isLocked = false;
        this.emit('unlock', this.#id);
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
        const documents = this.#db.listDocuments(featureArray, filterArray, options);
        this.emit('documents:list', documents.length);
        return documents;
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
        const result = this.#db.insertDocument(document, featureArray);
        this.emit('document:insert', document.id || result.id);
        return result;
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
        const result = this.#db.insertDocuments(documentArray, featureArray, options);
        this.emit('documents:insert', documentArray.length);
        return result;
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
        const result = this.#db.updateDocument(document, featureArray);
        this.emit('document:update', document.id);
        return result;
    }

    updateDocuments(documentArray, featureArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documentArray)) {
            throw new Error('Document array must be an array');
        }

        // Update the documents
        const result = this.#db.updateDocuments(documentArray, featureArray, options);
        this.emit('documents:update', documentArray.length);
        return result;
    }

    removeDocument(documentId, options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        // We remove document from the current context not from the database
        const result = this.#db.removeDocument(documentId, this.#featureBitmapArray, options);
        this.emit('document:remove', documentId);
        return result;
    }

    removeDocuments(documentIdArray, featureArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documentIdArray)) {
            throw new Error('Document ID array must be an array');
        }

        // We remove documents from the current context not from the database
        const result = this.#db.removeDocuments(documentIdArray, featureArray, options);
        this.emit('documents:remove', documentIdArray.length);
        return result;
    }

    deleteDocument(documentId) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        // Completely delete the document from the database
        const result = this.#db.deleteDocument(documentId);
        this.emit('document:delete', documentId);
        return result;
    }

    deleteDocuments(documentIdArray, featureArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documentIdArray)) {
            throw new Error('Document ID array must be an array');
        }

        // Completely delete the documents from the database
        const result = this.#db.deleteDocuments(documentIdArray, featureArray, options);
        this.emit('documents:delete', documentIdArray.length);
        return result;
    }

    /**
     * Document Feature API
     */

    addDocumentFeature(feature) {
        // Implementation needed
        this.emit('feature:add', feature);
    }

    removeDocumentFeature(feature) {
        // Implementation needed
        this.emit('feature:remove', feature);
    }

    listDocumentFeatures() {
        // Implementation needed
        const features = []; // Placeholder for actual implementation
        this.emit('features:list', features.length);
        return features;
    }

    hasDocumentFeature(feature) {
        // Implementation needed
        const hasFeature = false; // Placeholder for actual implementation
        this.emit('feature:check', { feature, exists: hasFeature });
        return hasFeature;
    }

    /**
     * Utils
     */

    toJSON() {
        const json = {
            id: this.#id,
            name: this.#name,
            url: this.#url,
            baseUrl: this.#baseUrl,
            created: this.#created,
            updated: this.#updated,
        };
        this.emit('json', json);
        return json;
    }

    /**
     * Cleanup and destroy the context
     * @returns {Promise<void>}
     */
    async destroy() {
        // Perform any cleanup needed
        this.#isLocked = true;

        // Clear references
        this.#db = null;
        this.#tree = null;

        // Emit destroy event
        this.emit('destroyed', this.#id);

        // Remove all listeners
        this.removeAllListeners();

        return Promise.resolve();
    }

}

export default Context;
