'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import { v4 as uuidv4 } from 'uuid';

// Logging
import createDebug from 'debug';
const debug = createDebug('context');


// Includes
import Url from './Url.js';

/**
 * Context
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
        // Store the provided baseUrl, default to '/'
        const providedBaseUrl = options.baseUrl || '/';
        this.#isLocked = options.locked || false;

        // Manager module references
        this.#device = options.device;
        this.#user = options.user;
        this.#workspace = options.workspace;

        if (!options.workspaceManager) {
            throw new Error('Workspace manager is required');
        }
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

        // Initialize url and path related properties
        this.#url = null;
        this.#path = null;
        this.#pathArray = [];

        // Set initial base URL - this must happen before setting the initial URL
        try {
            // Directly set the internal variable first
            this.#baseUrl = providedBaseUrl;
            // Now validate and handle potential conflicts (though unlikely in constructor)
            // We use a temporary Url object for validation and path checking
            const base = new Url(this.#baseUrl);
            if (!base.isValid) {
                throw new Error(`Invalid base URL provided: ${providedBaseUrl}`);
            }
            // Ensure the initial context URL respects the base URL
            let initialUrl = url;
            const parsedInitial = new Url(initialUrl);

            if (this.#baseUrl !== '/' && !parsedInitial.path.startsWith(base.path)) {
                debug(`Provided URL "${initialUrl}" is outside base URL "${this.#baseUrl}". Forcing URL to base URL.`);
                initialUrl = this.#baseUrl; // Force URL to base
            }

            // Now set the initial URL using the potentially adjusted value
            // We bypass setUrl here as workspace/layer logic happens in initialize/setUrl calls
            const finalParsed = new Url(initialUrl);

            if (finalParsed.workspaceID === this.#workspace.name) {
                this.#url = finalParsed.url;
                this.#path = finalParsed.path;
                this.#pathArray = finalParsed.pathArray;
                // Initial context/feature bitmaps will be set by setUrl/initialize later
            } else {
                // This logic remains for handling initial cross-workspace URLs
                this.#url = `${this.#workspace.name}://${finalParsed.path}`; // Use current workspace name temporarily
                this.#path = finalParsed.path;
                this.#pathArray = finalParsed.pathArray;
                this.#pendingUrl = initialUrl; // Store the original full URL
            }
        } catch (error) {
            // Clean up potentially partially set state
            this.#baseUrl = '/'; // Reset base to default on error
            this.#url = null;
            this.#path = null;
            this.#pathArray = [];
            throw new Error(`Failed to initialize context: ${error.message}`);
        }

        debug(`Context ${this.#id} constructor finished. Initial URL state: ${this.#url}, Base URL: ${this.#baseUrl}`);
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

    // Getters / Setters
    get id() { return this.#id; }
    get name() { return this.#name; }
    get baseUrl() { return this.#baseUrl; }
    get url() { return this.#url; }
    set url(url) { return this.setUrl(url); }
    get path() { return this.#path; }
    get pathArray() { return this.#pathArray; }
    get workspace() { return this.#workspace.id; }
    get device() { return this.#device.id; }
    get apps() { return this.#device.apps; }
    get user() { return this.#user; }
    get identity() { return this.#user.identity; }
    get tree() { return this.#tree.toJSON(); }
    get pendingUrl() { return this.#pendingUrl; }
    get bitmapArrays() {
        return {
            server: this.#serverContextArray,
            client: this.#clientContextArray,
            context: this.#contextBitmapArray,
            feature: this.#featureBitmapArray,
            filter: this.#filterArray,
        };
    }
    get serverContextArray() { return this.#serverContextArray; }
    get clientContextArray() { return this.#clientContextArray; }
    get contextBitmapArray() { return this.#contextBitmapArray; }
    get featureBitmapArray() { return this.#featureBitmapArray; }
    get filterArray() { return this.#filterArray; }

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
        debug(`Attempting to set URL to ${parsed.url}`);
        debug(`Parsed URL: ${JSON.stringify(parsed)}`);

        // Validate against base URL if it's set and not root
        if (this.#baseUrl && this.#baseUrl !== '/') {
            const base = new Url(this.#baseUrl); // Assuming baseUrl is always valid by this point
            // Ensure the target URL path starts with the base URL path
            if (!parsed.path.startsWith(base.path)) {
                throw new Error(`Cannot set URL "${url}" outside the context base URL "${this.#baseUrl}"`);
            }
        }

        // If the workspace ID is different, switch to the new workspace
        if (parsed.workspaceID !== this.#workspace.name) {
            // switchWorkspace will handle setting the final URL path after switching
            return this.switchWorkspace(parsed.workspaceID, parsed.path);
        }

        // Create the URL path in the current workspace
        const contextLayers = this.#workspace.insertPath(parsed.path);
        debug(`Created workspace path with contextLayer IDs: ${JSON.stringify(contextLayers)}`);

        // Update the context bitmap array
        this.#contextBitmapArray = contextLayers.map((layer) => `context/${layer}`);

        // Update the internal URL state
        this.#url = parsed.url;
        this.#path = parsed.path;
        this.#pathArray = parsed.pathArray;

        // Update the updated timestamp
        this.#updated = new Date().toISOString();

        // Emit the change event
        this.emit('change:url', this.#url); // Emit the actual set URL

        // Return this for method chaining and to maintain consistency with async version
        return Promise.resolve(this);
    }

    setBaseUrl(newBaseUrl) {
        if (this.#isLocked) {
            throw new Error('Context is locked');
        }

        // Allow setting base URL back to '/' (effectively removing constraint)
        if (newBaseUrl !== '/') {
            // Validate the new base URL format itself
            const parsedNewBase = new Url(newBaseUrl);
            if (!parsedNewBase.isValid) {
                throw new Error(`Invalid base URL format: ${newBaseUrl}`);
            }
            // Ensure the new base URL is within the same workspace
            if (parsedNewBase.workspaceID !== this.#workspace.name) {
                throw new Error(`Cannot set base URL to a different workspace: ${newBaseUrl}`);
            }

            // Option C: Check if the *current* URL is compatible with the *new* base URL
            if (this.#url) {
                const currentParsed = new Url(this.#url);
                // Only check path if the current URL is actually in the same workspace
                if (currentParsed.workspaceID === this.#workspace.name && !currentParsed.path.startsWith(parsedNewBase.path)) {
                    throw new Error(
                        `Current URL "${this.#url}" is outside the proposed new base URL "${newBaseUrl}". Please navigate within the new base URL before setting it.`,
                    );
                }
            }
        }
        /*
         * TODO: Implement Workspace Layer Locking logic here before committing the change
         * This needs careful thought about atomicity and error handling.
         * The identifier should uniquely identify this context and user.
         */
        const lockIdentifier = `${this.#user.email}/${this.#id}`;
        // Placeholder logic:
        // try {
        //     if (this.#baseUrl !== '/') {
        //         await this.#workspace.releaseLock(this.#baseUrl, lockIdentifier);
        //     }
        //     if (newBaseUrl !== '/') {
        //         await this.#workspace.acquireLock(newBaseUrl, lockIdentifier);
        //     }
        // } catch (lockError) {
        //     // Handle lock acquisition/release failure - potentially revert?
        //     throw new Error(`Failed to update layer locks for base URL: ${lockError.message}`);
        // }

        debug(`Setting base URL from "${this.#baseUrl}" to "${newBaseUrl}"`);
        this.#baseUrl = newBaseUrl;
        this.#updated = new Date().toISOString();
        this.emit('change:baseUrl', this.#baseUrl);

        // No automatic setUrl according to Option C
        return Promise.resolve(this);
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

        /*
         * TODO: Release base URL lock if held
         * The identifier should uniquely identify this context and user.
         */
        // Placeholder logic:
        // if (this.#baseUrl && this.#baseUrl !== '/') {
        //     const lockIdentifier = `${this.#user.email}/${this.#id}`;
        //     try {
        //         await this.#workspace.releaseLock(this.#baseUrl, lockIdentifier);
        //     } catch (unlockError) {
        //          logger.error(`Failed to release lock for context ${this.#id} on destroy: ${unlockError.message}`);
        //          // Continue cleanup even if unlock fails?
        //     }
        // }

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
            throw new Error('Workspace ID/name is required for switching');
        }

        if (!this.#user || !this.#user.id) {
            throw new Error('User information is missing in context, cannot switch workspace.');
        }

        // workspaceManager.hasWorkspace expects ownerKeyId, workspaceId, requestingUserId
        // For openWorkspace, we also need these three.
        // Let's assume 'workspace' parameter is the workspaceId (short name)
        // hasWorkspace(ownerKeyId, workspaceId, requestingUserId)
        const hasWs = await this.#workspaceManager.hasWorkspace(this.#user.email, workspace, this.#user.id);

        if (hasWs) { // Corrected check based on updated hasWorkspace signature
            try {
                /*
                 * TODO: Release base URL lock in the *old* workspace if held before switching.
                 * The identifier should uniquely identify this context and user.
                 */
                // Placeholder logic:
                // if (this.#baseUrl && this.#baseUrl !== '/') {
                //     const lockIdentifier = `${this.#user.email}/${this.#id}`;
                //     try {
                //         await this.#workspace.releaseLock(this.#baseUrl, lockIdentifier);
                //     } catch (unlockError) {
                //          console.warn(`Failed to release lock for context ${this.#id} before switching workspace: ${unlockError.message}`);
                //     }
                // }

                // openWorkspace(ownerKeyId, workspaceId, requestingUserId)
                const newWorkspaceInstance = await this.#workspaceManager.openWorkspace(this.#user.email, workspace, this.#user.id);
                if (!newWorkspaceInstance) {
                    throw new Error(`Failed to open workspace "${workspace}" for user ${this.#user.id}. It might not exist or user may not have access.`);
                }
                this.#workspace = newWorkspaceInstance;
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
                // Ensure contextLayers is treated as an array
                if (contextLayers && contextLayers.layerIds) {
                    // If we get an object with a layerIds property, use that
                    const layerIds = Object.values(contextLayers.layerIds || {});
                    this.#contextBitmapArray = layerIds.map((layer) => `context/${layer}`);
                } else if (Array.isArray(contextLayers)) {
                    // If we directly get an array
                    this.#contextBitmapArray = contextLayers.map((layer) => `context/${layer}`);
                } else {
                    // Fallback to empty array if neither case applies
                    debug(`Warning: Expected array or object with layerIds, got: ${typeof contextLayers}`);
                    this.#contextBitmapArray = [];
                }

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
        return {
            id: this.#id,
            name: this.#name,
            url: this.#url,
            baseUrl: this.#baseUrl,
            path: this.#path,
            pathArray: this.#pathArray,
            workspace: this.#workspace?.id,
            createdAt: this.#created,
            updated: this.#updated,
            locked: this.#isLocked,
            serverContextArray: this.#serverContextArray,
            clientContextArray: this.#clientContextArray,
            contextBitmapArray: this.#contextBitmapArray,
            featureBitmapArray: this.#featureBitmapArray,
            filterArray: this.#filterArray,
            pendingUrl: this.#pendingUrl || null,
        };
    }
}

export default Context;
