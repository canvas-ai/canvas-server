'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import { v4 as uuidv4 } from 'uuid';
import logger, { createDebug } from '../../../utils/log/index.js';
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
    #baseUrl; // With workspace support we need to change the format to workspace://baseUrl/path
    #url;
    #path;
    #pathArray;

    // Workspace references
    #db; // workspace.db
    #tree; // workspace.tree

    // Runtime Context arrays
    #serverContextArray; // server/os/linux, server/version/1.0.0, server/datetime/, server/ip/192.168.1.1
    #clientContextArray; // client/os/linux, client/app/firefox, client/datetime/, client/user/john.doe

    // Bitmap arrays
    #contextBitmapArray = [];
    #featureBitmapArray = [];

    #filterArray = [];

    // Manager module references
    #device;
    #user;
    #workspace;
    #workspaceManager;

    // Context metadata
    #created;
    #updated;
    #isLocked;

    // Additional properties
    #pendingUrl;

    constructor(url, options) {
        super();

        // Context properties
        this.#id = options.id || uuidv4();
        this.#name = options.name ?? this.#id;
        this.#baseUrl = options.baseUrl || '/';
        this.#isLocked = options.locked || false;

        // Manager module references
        this.#device = options.device;
        this.#user = options.user;
        this.#workspace = options.workspace;
        this.#workspaceManager = options.workspaceManager;

        // Workspace references
        this.#db = this.#workspace.db;
        this.#tree = this.#workspace.tree;

        // Context metadata
        this.#created = options.created || new Date().toISOString();
        this.#updated = options.updated || new Date().toISOString();

        // Server Context
        this.#serverContextArray = options.serverContextArray || [];

        // Client Context
        this.#clientContextArray = options.clientContextArray || [];

        // Parse the URL without switching workspaces
        // We'll handle the actual URL setting after initialization
        try {
            const parsed = new Url(url);

            // Only set the URL if it's for the current workspace
            if (parsed.workspaceID === this.#workspace.name) {
                this.#url = parsed.url;
            } else {
                // For different workspace, we'll set a temporary URL
                // The actual workspace switch will happen when the context is used
                this.#url = `${this.#workspace.name}://${parsed.path}`;

                // Store the original URL for later switching
                this.#pendingUrl = url;
            }
        } catch (error) {
            throw new Error(`Failed to initialize context: ${error.message}`);
        }

        debug(`Context ${this.#id} created at ${this.#url}`);
        this.emit('created', this.toJSON());
    }

    /**
     * Initialize the context by processing any pending URL switch
     * This should be called after the context is created if you need
     * to ensure the context is fully initialized with the correct workspace
     * @returns {Promise<Context>} - The initialized context
     */
    async initialize() {
        if (this.#pendingUrl) {
            debug(`Processing pending URL switch to ${this.#pendingUrl}`);
            const pendingUrl = this.#pendingUrl;
            this.#pendingUrl = null;
            return this.setUrl(pendingUrl);
        }
        return Promise.resolve(this);
    }

    // Getters
    get id() {
        return this.#id;
    }
    get name() {
        return this.#name;
    }
    get baseUrl() {
        return this.#baseUrl;
    }
    get url() {
        return this.#url;
    }
    get path() {
        return this.#path;
    }
    get pathArray() {
        return this.#pathArray;
    }
    get workspace() {
        return this.#workspace.id;
    }
    get device() {
        return this.#device.id;
    }
    get apps() {
        return this.#device.apps;
    }
    get user() {
        return this.#user;
    }
    get identity() {
        return this.#user.identity;
    }
    get tree() {
        return this.#tree.toJSON();
    } // Legacy
    get pendingUrl() {
        return this.#pendingUrl;
    } // Check if there's a pending URL switch
    get bitmapArrays() {
        return {
            server: this.#serverContextArray,
            client: this.#clientContextArray,
            context: this.#contextBitmapArray,
            feature: this.#featureBitmapArray,
            filter: this.#filterArray,
        };
    }

    get serverContextArray() {
        return this.#serverContextArray;
    }
    get clientContextArray() {
        return this.#clientContextArray;
    }
    get contextBitmapArray() {
        return this.#contextBitmapArray;
    }
    get featureBitmapArray() {
        return this.#featureBitmapArray;
    }
    get filterArray() {
        return this.#filterArray;
    }

    get created() {
        return this.#created;
    }
    get updated() {
        return this.#updated;
    }
    get status() {
        return this.toJSON();
    }

    /**
     * Context API
     */

    setClientContextArray(clientContextArray) {
        if (!Array.isArray(clientContextArray)) {
            clientContextArray = [clientContextArray];
        }

        this.#clientContextArray = clientContextArray;
    }

    clearClientContextArray() {
        this.#clientContextArray = [];
    }

    setServerContextArray(serverContextArray) {
        if (!Array.isArray(serverContextArray)) {
            serverContextArray = [serverContextArray];
        }

        this.#serverContextArray = serverContextArray;
    }

    clearServerContextArray() {
        this.#serverContextArray = [];
    }

    setUrl(url) {
        if (this.#isLocked) {
            throw new Error('Context is locked');
        }

        const parsed = new Url(url);
        debug(`Setting URL to ${parsed.url}`);

        // If the workspace ID is different, switch to the new workspace
        if (parsed.workspaceID !== this.#workspace.name) {
            return this.switchWorkspace(parsed.workspaceID, parsed.path);
        }

        // Create the URL path in the workspace
        const contextLayers = this.#workspace.insertPath(parsed.path);
        debug(`Created workspace path with contextLayer IDs: ${JSON.stringify(contextLayers)}`);

        // Update the context bitmap array
        this.#contextBitmapArray = contextLayers.map((layer) => `context/${layer}`);

        // Update the URL
        this.#url = parsed.url;
        this.#path = parsed.path;
        this.#pathArray = parsed.pathArray;

        // Update the updated timestamp
        this.#updated = new Date().toISOString();

        // Emit the change event
        this.emit('change:url', url);

        // Return this for method chaining and to maintain consistency with async version
        return Promise.resolve(this);
    }

    setBaseUrl(baseUrl) {
        if (this.#isLocked) {
            throw new Error('Context is locked');
        }

        if (Url.validate(baseUrl)) {
            throw new Error('Invalid base URL: ' + baseUrl);
        }

        try {
            this.#baseUrl = baseUrl;
            this.emit('change:baseUrl', baseUrl);
            // Setting a baseUrl will also set the URL (easier to implement)
            // Return the promise from setUrl for async consistency
            return this.setUrl(baseUrl);
        } catch (error) {
            throw new Error(`Failed to set base URL: ${error.message}`);
        }
    }

    lock() {
        this.#isLocked = true;
        this.#updated = new Date().toISOString();
        this.emit('locked', this.#id);
    }

    unlock() {
        this.#isLocked = false;
        this.#updated = new Date().toISOString();
        this.emit('unlocked', this.#id);
    }

    destroy() {
        // Perform any cleanup needed
        this.#isLocked = true;

        // Clear references
        this.#db = null;
        this.#tree = null;

        // Update the updated timestamp
        this.#updated = new Date().toISOString();

        // Emit destroy event
        this.emit('destroyed', this.#id);

        // Remove all listeners
        this.removeAllListeners();

        return Promise.resolve();
    }

    async switchWorkspace(workspace, url = '/') {
        if (this.#isLocked) {
            throw new Error('Context is locked');
        }

        if (!workspace) {
            throw new Error('Workspace is required');
        }

        if (this.#workspaceManager.hasWorkspace(workspace)) {
            try {
                // Open the workspace asynchronously
                this.#workspace = await this.#workspaceManager.openWorkspace(workspace);
                this.#db = this.#workspace.db;
                this.#tree = this.#workspace.tree;

                // Here we should retrieve the last context URL opened for this context
                // in this workspace and set it
                // We need a proper context log for LLM integration so TODO: implement this

                // Set the URL without triggering another workspace switch
                const parsed = new Url(url);

                // Create the URL path in the workspace
                const contextLayers = this.#workspace.insertPath(parsed.path);
                debug(`Created workspace path with contextLayer IDs: ${JSON.stringify(contextLayers)}`);

                // Update the context bitmap array with prefixed layers
                // Prefix workaround till we implement propper collections in the DB
                this.#contextBitmapArray = contextLayers.map((layer) => `context/${layer}`);

                // Update the URL
                this.#url = parsed.url;

                // Update the updated timestamp
                this.#updated = new Date().toISOString();

                return this;
            } catch (error) {
                throw new Error(`Failed to switch workspace: ${error.message}`);
            }
        } else {
            throw new Error(`Workspace "${workspace}" not found`);
        }
    }

    /**
     * Query
     */

    query(query, featureArray = [], filterArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        // NLP query
    }

    ftsQuery(query, featureArray = [], filterArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        // FTS query
    }

    /**
     * Bitmaps
     */

    setFeatureBitmaps(featureArray) {
        if (!Array.isArray(featureArray)) {
            featureArray = [featureArray];
        }
        this.#featureBitmapArray = featureArray;
    }

    appendFeatureBitmaps(featureArray) {
        if (!Array.isArray(featureArray)) {
            featureArray = [featureArray];
        }
        this.#featureBitmapArray.push(...featureArray);
    }

    removeFeatureBitmaps(featureArray) {
        if (!Array.isArray(featureArray)) {
            featureArray = [featureArray];
        }
        this.#featureBitmapArray = this.#featureBitmapArray.filter((feature) => !featureArray.includes(feature));
    }

    clearFeatureBitmaps() {
        this.#featureBitmapArray = [];
    }

    /**
     * Document API
     */

    getDocument(documentId, featureArray = [], filterArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        const contextArray = this.#contextBitmapArray;

        if (options.includeServerContext) {
            contextArray.push(this.#serverContextArray);
        }

        if (options.includeClientContext) {
            contextArray.push(this.#clientContextArray);
        }

        // Filters are out of scope for now
        const document = this.#db.getDocument(documentId, contextArray, featureArray, filterArray);
        this.emit('document:get', document.id);
        return document;
    }

    listDocuments(featureArray = [], filterArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        const contextArray = this.#contextBitmapArray;

        if (options.includeServerContext) {
            contextArray.push(this.#serverContextArray);
        }

        if (options.includeClientContext) {
            contextArray.push(this.#clientContextArray);
        }

        // Filters are out of scope for now
        const documents = this.#db.listDocuments(contextArray, featureArray, filterArray);
        this.emit('documents:list', documents.length);
        return documents;
    }

    insertDocument(document, featureArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!document) {
            throw new Error('Document is required');
        }

        // We always update context bitmaps
        const contextArray = this.#contextBitmapArray;
        contextArray.push(this.#serverContextArray);
        contextArray.push(this.#clientContextArray);

        // We always index with all features
        featureArray = [...this.#featureBitmapArray, ...featureArray];

        // Insert the document
        const result = this.#db.insertDocument(document, contextArray, featureArray);
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

        // We always update context bitmaps
        const contextArray = this.#contextBitmapArray;
        contextArray.push(this.#serverContextArray);
        contextArray.push(this.#clientContextArray);

        // Insert the documents
        const result = this.#db.insertDocumentArray(documentArray, contextArray, featureArray);
        this.emit('documents:insert', documentArray.length);
        return result;
    }

    updateDocument(document, featureArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!document) {
            throw new Error('Document is required');
        }

        // We always update context bitmaps
        const contextArray = this.#contextBitmapArray;
        contextArray.push(this.#serverContextArray);
        contextArray.push(this.#clientContextArray);

        // Update the document
        const result = this.#db.updateDocument(document, contextArray, featureArray);

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

        // We always update context bitmaps
        const contextArray = this.#contextBitmapArray;
        contextArray.push(this.#serverContextArray);
        contextArray.push(this.#clientContextArray);

        // Update the documents
        const result = this.#db.updateDocumentArray(documentArray, contextArray, featureArray);

        this.emit('documents:update', documentArray.length);
        return result;
    }

    removeDocument(documentId, featureArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        // We remove document from the current context not from the database
        const result = this.#db.removeDocument(documentId, this.#contextBitmapArray, featureArray, options);
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
        const result = this.#db.removeDocumentArray(documentIdArray, this.#contextBitmapArray, featureArray, options);
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
        const result = this.#db.deleteDocumentArray(documentIdArray, featureArray, options);
        this.emit('documents:delete', documentIdArray.length);
        return result;
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
            locked: this.#isLocked,
            serverContextArray: this.#serverContextArray,
            clientContextArray: this.#clientContextArray,
            contextBitmapArray: this.#contextBitmapArray,
            featureBitmapArray: this.#featureBitmapArray,
            filterArray: this.#filterArray,
        };

        // Include pendingUrl if it exists
        if (this.#pendingUrl) {
            json.pendingUrl = this.#pendingUrl;
        }

        return json;
    }
}

export default Context;
