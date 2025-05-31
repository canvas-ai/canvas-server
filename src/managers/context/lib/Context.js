'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import { v4 as uuidv4 } from 'uuid';

// Logging
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('context-manager:context');

// Includes
import Url from './Url.js';

/**
 * Context
 */

class Context extends EventEmitter {

    // Context properties
    #id;
    #baseUrl; // With workspace support we need to change the format to workspace://baseUrl/path
    #url;
    #path;
    #pathArray;
    #userId;
    #color;

    // Access Control List: maps userId to accessLevel (e.g., {"user@example.com": "documentRead"})
    #acl;

    // Runtime Context arrays
    #serverContextArray; // server/os/linux, server/version/1.0.0, server/datetime/, server/ip/192.168.1.1
    #clientContextArray; // client/os/linux, client/app/firefox, client/datetime/, client/user/john.doe

    // Bitmap arrays
    #contextBitmapArray = [];
    #featureBitmapArray = [];

    #filterArray = [];

    // Workspace references
    #workspace; // Current workspace instance
    #db; // workspace.db
    #tree; // workspace.tree
    #workspaceManager; // Workspace manager instance
    #contextManager; // Context manager instance
    #workspaceEventHandlers; // Event handlers for workspace event forwarding

    // Context metadata
    #createdAt;
    #updatedAt;
    #isLocked;

    // Additional properties
    #pendingUrl;

    constructor(url, options) {
        super();

        // Context properties
        this.#id = options.id || uuidv4();

        // User ID
        if (!options.userId) {
            throw new Error('User ID is required');
        }
        this.#userId = options.userId;

        // Store the provided baseUrl, default to '/'
        const providedBaseUrl = options.baseUrl || '/';
        this.#isLocked = options.locked || false;

        // Workspace references
        if (!options.workspace) {
            throw new Error('Workspace instance is required');
        }

        if (!options.workspaceManager) {
            throw new Error('Workspace manager instance is required');
        }

        if (!options.contextManager) {
            throw new Error('Context manager instance is required');
        }

        this.#workspace = options.workspace;
        this.#workspaceManager = options.workspaceManager;
        this.#db = this.#workspace.db;
        this.#tree = this.#workspace.tree;
        this.#color = this.#workspace.color;
        this.#contextManager = options.contextManager;

        // Context metadata
        this.#createdAt = options.createdAt || new Date().toISOString();
        this.#updatedAt = options.updatedAt || new Date().toISOString();

        // ACL
        this.#acl = options.acl || {};

        // Server Context
        this.#serverContextArray = options.serverContextArray || [];

        // Client Context
        this.#clientContextArray = options.clientContextArray || [];

        // Initialize url and path related properties
        this.#url = null;
        this.#path = null;
        this.#pathArray = [];

        // Set up event forwarding from workspace
        this.#setupWorkspaceEventForwarding();

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
        this.emit('context:created', this.toJSON());
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
    get userId() { return this.#userId; }
    get baseUrl() { return this.#baseUrl; }
    get url() { return this.#url; }
    set url(url) { return this.setUrl(url); }
    get path() { return this.#path; }
    get pathArray() { return this.#pathArray; }
    get workspace() { return this.#workspace; }
    get workspaceId() { return this.#workspace.id; }
    get tree() { return this.#tree.toJSON(); }
    get color() { return this.#color; }
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
    get acl() { return this.#acl; }
    get serverContextArray() { return this.#serverContextArray; }
    get clientContextArray() { return this.#clientContextArray; }
    get contextBitmapArray() { return this.#contextBitmapArray; }
    get featureBitmapArray() { return this.#featureBitmapArray; }
    get filterArray() { return this.#filterArray; }

    /**
     * Context API
     */

    /**
     * Grant access to this context to another user.
     * @param {string} sharedWithUserId - The ID of the user to grant access to.
     * @param {'documentRead' | 'documentWrite' | 'documentReadWrite'} accessLevel - The level of access to grant.
     */
    async grantAccess(sharedWithUserId, accessLevel) {
        if (!sharedWithUserId || typeof sharedWithUserId !== 'string') {
            throw new Error('Invalid sharedWithUserId provided.');
        }
        const validAccessLevels = ['documentRead', 'documentWrite', 'documentReadWrite'];
        if (!validAccessLevels.includes(accessLevel)) {
            throw new Error(`Invalid accessLevel: ${accessLevel}. Must be one of ${validAccessLevels.join(', ')}`);
        }

        if (sharedWithUserId === this.#userId) {
            debug(`User ${sharedWithUserId} is the owner, no need to grant explicit access.`);
            return Promise.resolve(this); // Owner always has full access
        }

        this.#acl[sharedWithUserId] = accessLevel;
        this.#updatedAt = new Date().toISOString();
        this.emit('context:acl:updated', { id: this.#id, userId: sharedWithUserId, accessLevel });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);
        return Promise.resolve(this);
    }

    /**
     * Revoke access to this context from another user.
     * @param {string} sharedWithUserId - The ID of the user whose access to revoke.
     */
    async revokeAccess(sharedWithUserId) {
        if (!sharedWithUserId || typeof sharedWithUserId !== 'string') {
            throw new Error('Invalid sharedWithUserId provided.');
        }

        if (sharedWithUserId === this.#userId) {
            debug(`Cannot revoke access from the owner ${sharedWithUserId}.`);
            return Promise.resolve(this);
        }

        if (this.#acl[sharedWithUserId]) {
            delete this.#acl[sharedWithUserId];
            this.#updatedAt = new Date().toISOString();
            this.emit('context:acl:revoked', { id: this.#id, userId: sharedWithUserId });

            // Save changes to index
            await this.#contextManager.saveContext(this.#userId, this);
        } else {
            debug(`No explicit access found for ${sharedWithUserId} to revoke.`);
        }
        return Promise.resolve(this);
    }

    /**
     * Check if a user has a specific permission level for this context.
     * The context owner always has all permissions.
     * @param {string} accessingUserId - The ID of the user attempting to access.
     * @param {'documentRead' | 'documentWrite' | 'documentReadWrite'} requiredAccessLevel - The minimum access level required.
     * @returns {boolean} - True if the user has the required permission, false otherwise.
     */
    checkPermission(accessingUserId, requiredAccessLevel) {
        if (!accessingUserId) {
            debug('No accessingUserId provided for permission check.');
            return false;
        }

        // Owner always has full permission
        if (accessingUserId === this.#userId) {
            return true;
        }

        const grantedAccessLevel = this.#acl[accessingUserId];

        if (!grantedAccessLevel) {
            debug(`User ${accessingUserId} has no explicit permissions granted for context ${this.#id}.`);
            return false;
        }

        // Define permission hierarchy
        const permissionHierarchy = {
            documentRead: 0,
            documentWrite: 1, // documentWrite implies read for simplicity in this check
            documentReadWrite: 2,
        };

        // For MVP, let's treat manage as a future permission above ReadWrite
        // const managePermissionLevel = 3;


        if (!(requiredAccessLevel in permissionHierarchy)) {
            debug(`Unknown requiredAccessLevel: ${requiredAccessLevel}`);
            return false; // Or throw an error
        }

        if (!(grantedAccessLevel in permissionHierarchy)) {
            debug(`User ${accessingUserId} has an unknown grantedAccessLevel: ${grantedAccessLevel}`);
            return false; // Or throw an error
        }

        const requiredLevel = permissionHierarchy[requiredAccessLevel];
        const grantedLevel = permissionHierarchy[grantedAccessLevel];

        // A user has permission if their granted level is equal to or higher than the required level.
        // Special handling for documentWrite: if documentWrite is required, documentRead is not enough.
        // If documentRead is required, documentWrite or documentReadWrite is enough.
        if (requiredAccessLevel === 'documentWrite') {
            return grantedAccessLevel === 'documentWrite' || grantedAccessLevel === 'documentReadWrite';
        }
        // For documentRead, any defined access level is sufficient.
        // For documentReadWrite, only documentReadWrite is sufficient.
        return grantedLevel >= requiredLevel;
    }

    async setClientContextArray(clientContextArray) {
        if (!Array.isArray(clientContextArray)) {
            clientContextArray = [clientContextArray];
        }

        this.#clientContextArray = clientContextArray;
        this.emit('context:updated', { id: this.#id, clientContextArray: this.#clientContextArray });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);
    }

    async clearClientContextArray() {
        this.#clientContextArray = [];
        this.emit('context:updated', { id: this.#id, clientContextArray: this.#clientContextArray });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);
    }

    setServerContextArray(serverContextArray) {
        if (!Array.isArray(serverContextArray)) {
            serverContextArray = [serverContextArray];
        }

        this.#serverContextArray = serverContextArray;
        this.emit('context:updated', { id: this.#id, serverContextArray: this.#serverContextArray });
    }

    async clearServerContextArray() {
        this.#serverContextArray = [];
        this.emit('context:updated', { id: this.#id, serverContextArray: this.#serverContextArray });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);
    }

    async setUrl(url) {
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
            // #switchWorkspace will handle setting the final URL path after switching
            await this.#switchWorkspace(parsed.workspaceID, parsed.path);
        }

        // Create the URL path in the current workspace
        const contextLayers = this.#workspace.insertPath(parsed.path); // This will return a list of layer IDs
        // Since we move the Layer to Path logic to SynapsD we can keep using paths in the context
        this.#contextBitmapArray = parsed.pathArray;
        debug(`ContextPath: ${parsed.path}, contextLayer IDs: ${JSON.stringify(contextLayers)}`);

        // Update the internal URL state
        this.#url = parsed.url;
        this.#path = parsed.path;
        this.#pathArray = parsed.pathArray;

        // Update the updated timestamp
        this.#updatedAt = new Date().toISOString();

        // Emit the change event
        this.emit('context:url:set', { id: this.#id, url: this.#url });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);

        // Return this for method chaining and to maintain consistency with async version
        return Promise.resolve(this);
    }

    async setBaseUrl(newBaseUrl) {
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

        debug(`Setting base URL from "${this.#baseUrl}" to "${newBaseUrl}"`);
        this.#baseUrl = newBaseUrl;
        this.#updatedAt = new Date().toISOString();
        this.emit('context:updated', { id: this.#id, baseUrl: this.#baseUrl });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);

        // No automatic setUrl according to Option C
        return Promise.resolve(this);
    }

    async lock() {
        this.#isLocked = true;
        this.#updatedAt = new Date().toISOString();
        this.emit('context:locked', { id: this.#id, locked: this.#isLocked });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);

        return Promise.resolve(this);
    }

    async unlock() {
        this.#isLocked = false;
        this.#updatedAt = new Date().toISOString();
        this.emit('context:unlocked', { id: this.#id, locked: this.#isLocked });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);
    }

    destroy() {
        // Perform any cleanup needed
        this.#isLocked = true;

        // Clean up workspace event forwarding
        this.#cleanupWorkspaceEventForwarding();

        // Clear references
        this.#db = null;
        this.#tree = null;
        this.#workspace = null;
        this.#workspaceManager = null;

        // Update the updated timestamp
        this.#updatedAt = new Date().toISOString();

        // Emit destroy event
        this.emit('context:deleted', { id: this.#id });

        // Remove all listeners
        this.removeAllListeners();

        return Promise.resolve(this);
    }

    async #switchWorkspace(workspaceId, url = '/') {
        if (this.#isLocked) {
            throw new Error('Context is locked');
        }

        const hasWs = await this.#workspaceManager.hasWorkspace(this.#userId, workspaceId, this.#userId);
        if (hasWs) {
            try {
                // Clean up event forwarding from the old workspace
                this.#cleanupWorkspaceEventForwarding();

                const newWorkspaceInstance = await this.#workspaceManager.getWorkspace(this.#userId, workspaceId, this.#userId);
                this.#workspace = newWorkspaceInstance;
                this.#db = this.#workspace.db;
                this.#tree = this.#workspace.tree;
                this.#color = this.#workspace.color;

                // Set up event forwarding for the new workspace
                this.#setupWorkspaceEventForwarding();

                debug(`Context "${this.#id}" successfully switched to workspace "${workspaceId}"`);
            } catch (error) {
                throw new Error(`Failed to switch workspace: ${error.message}`);
            }
        } else {
            throw new Error(`Workspace "${workspaceId}" not found`);
        }
    }

    /**
     * Bitmaps
     */

    setFeatureBitmaps(featureArray) {
        if (!Array.isArray(featureArray)) {
            featureArray = [featureArray];
        }
        this.#featureBitmapArray = featureArray;
        this.emit('context:updated', { id: this.#id, featureBitmapArray: this.#featureBitmapArray });
    }

    appendFeatureBitmaps(featureArray) {
        if (!Array.isArray(featureArray)) {
            featureArray = [featureArray];
        }
        this.#featureBitmapArray.push(...featureArray);
        this.emit('context:updated', { id: this.#id, featureBitmapArray: this.#featureBitmapArray });
    }

    removeFeatureBitmaps(featureArray) {
        if (!Array.isArray(featureArray)) {
            featureArray = [featureArray];
        }
        this.#featureBitmapArray = this.#featureBitmapArray.filter((feature) => !featureArray.includes(feature));
        this.emit('context:updated', { id: this.#id, featureBitmapArray: this.#featureBitmapArray });
    }

    clearFeatureBitmaps() {
        this.#featureBitmapArray = [];
        this.emit('context:updated', { id: this.#id, featureBitmapArray: this.#featureBitmapArray });
    }

    /**
     * Document API
     */

    async insertDocument(accessingUserId, document, featureArray = [], options = {}) {
        if (!this.checkPermission(accessingUserId, 'documentWrite')) {
            throw new Error('Access denied: User requires documentWrite permission.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!document) {
            throw new Error('Document is required');
        }

        // We always update context bitmaps
        const contextArray = [
            //...this.#contextBitmapArray,
            ...this.#pathArray,
            ...this.#serverContextArray,
            ...this.#clientContextArray,
        ];

        // We always index with all features
        featureArray = [...this.#featureBitmapArray, ...featureArray];

        // Insert the document
        const result = this.#db.insertDocument(document, contextArray, featureArray, options);

        // Prepare document data for events
        const documentId = document.id || result.id;
        const documentEventPayload = {
            contextId: this.#id,
            operation: 'insert',
            documentId: documentId,
            document: document,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
            url: this.#url,
            workspaceId: this.#workspace.id,
            timestamp: new Date().toISOString()
        };

        this.emit('document:insert', documentEventPayload);
        this.emit('context:updated', {
            id: this.#id,
            operation: 'document:inserted',
            document: documentId,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
        });

        return result;
    }

    insertDocumentArray(accessingUserId, documentArray, featureArray = [], options = {}) {
        if (!this.checkPermission(accessingUserId, 'documentWrite')) {
            throw new Error('Access denied: User requires documentWrite permission.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documentArray)) {
            throw new Error('Document array must be an array');
        }

        // We always update context bitmaps
        const contextArray = [
            //...this.#contextBitmapArray,
            ...this.#pathArray,
            ...this.#serverContextArray,
            ...this.#clientContextArray,
        ];


        debug('#insertDocumentArray: contextArray:', this.#contextBitmapArray);
        debug('#insertDocumentArray: Received featureArray:', featureArray);
        debug('#insertDocumentArray: Received options:', options);

        // Insert the documents
        const result = this.#db.insertDocumentArray(documentArray, contextArray, featureArray);

        // Prepare document data for events
        const documentIds = result && Array.isArray(result) ? result : documentArray.map(doc => doc.id);
        const documentEventPayload = {
            contextId: this.#id,
            operation: 'insert',
            documentIds: documentIds,
            documents: documentArray,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
            url: this.#url,
            workspaceId: this.#workspace.id,
            timestamp: new Date().toISOString()
        };

        this.emit('document:insert', documentEventPayload);
        this.emit('context:updated', {
            id: this.#id,
            operation: 'documentArray:inserted',
            documentArray: documentArray,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
        });

        return result;
    }

    async getDocument(accessingUserId, documentId, featureArray = [], filterArray = [], options = {}) {
        if (!this.checkPermission(accessingUserId, 'documentRead')) {
            throw new Error('Access denied: User requires documentRead permission.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        let baseContexts = [...this.#contextBitmapArray]; // Start with a copy

        let serverContexts = [];
        if (options.includeServerContext && this.#serverContextArray && this.#serverContextArray.length > 0) {
            serverContexts = this.#serverContextArray;
        }

        let clientContexts = [];
        if (options.includeClientContext && this.#clientContextArray && this.#clientContextArray.length > 0) {
            clientContexts = this.#clientContextArray;
        }

        // Combine them into a flat array
        const contextArray = [...new Set([...baseContexts, ...serverContexts, ...clientContexts])];

        // Then use this flat contextArray for DB operations.
        const document = this.#db.findDocuments(documentId, contextArray, featureArray, filterArray);
        return document;
    }

    async getDocumentById(accessingUserId, id, options = { parse: true }) {
        // This is a direct DB access method, only context owner should call it.
        if (accessingUserId !== this.#userId) {
            throw new Error('Access denied: This operation is only available to the context owner.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        // Pass the context's pathArray as the contextSpec to the DB method
        const result = await this.#workspace.db.getDocumentById(id, this.#pathArray, options);
        return result;
    }

    async getDocumentsByIdArray(accessingUserId, idArray, options = { parse: true, limit: null }) {
        if (accessingUserId !== this.#userId) {
            throw new Error('Access denied: This operation is only available to the context owner.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        const result = await this.#workspace.db.getDocumentsByIdArray(idArray, this.#pathArray, options);
        return result;
    }

    async getDocumentArray(accessingUserId, documentIdArray, featureArray = [], filterArray = [], options = {}) {
        if (!this.checkPermission(accessingUserId, 'documentRead')) {
            throw new Error('Access denied: User requires documentRead permission.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        let baseContexts = [...this.#contextBitmapArray]; // Start with a copy

        let serverContexts = [];
        if (options.includeServerContext && this.#serverContextArray && this.#serverContextArray.length > 0) {
            serverContexts = this.#serverContextArray;
        }

        let clientContexts = [];
        if (options.includeClientContext && this.#clientContextArray && this.#clientContextArray.length > 0) {
            clientContexts = this.#clientContextArray;
        }

        // Combine them into a flat array
        const contextArray = [...new Set([...baseContexts, ...serverContexts, ...clientContexts])];

        const documents = this.#db.findDocuments(documentIdArray, contextArray, featureArray, filterArray, options);
        return documents;
    }

    async hasDocument(accessingUserId, id, featureBitmapArray = []) {
        if (!this.checkPermission(accessingUserId, 'documentRead')) {
            throw new Error('Access denied: User requires documentRead permission.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        const result = await this.#workspace.db.hasDocument(id, this.#contextBitmapArray, featureBitmapArray);
        return result;
    }

    async hasDocumentByChecksum(accessingUserId, checksum, featureBitmapArray) {
        if (!this.checkPermission(accessingUserId, 'documentRead')) {
            throw new Error('Access denied: User requires documentRead permission.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        const result = await this.#workspace.db.hasDocumentByChecksum(checksum, this.#contextBitmapArray, featureBitmapArray);
        return result;
    }

    async listDocuments(accessingUserId, featureArray = [], filterArray = [], options = {}) {
        if (!this.checkPermission(accessingUserId, 'documentRead')) {
            throw new Error('Access denied: User requires documentRead permission.');
        }

        debug('#listDocuments: contextArray:', this.#contextBitmapArray);
        debug('#listDocuments: Received featureArray:', featureArray);
        debug('#listDocuments: Received filterArray:', filterArray);
        debug('#listDocuments: Received options:', options);

        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        let baseContexts = [...this.#contextBitmapArray]; // Start with a copy

        let serverContexts = [];
        if (options.includeServerContext && this.#serverContextArray && this.#serverContextArray.length > 0) {
            serverContexts = this.#serverContextArray;
        }

        let clientContexts = [];
        if (options.includeClientContext && this.#clientContextArray && this.#clientContextArray.length > 0) {
            clientContexts = this.#clientContextArray;
        }

        // Combine them into a flat array
        const contextArray = [...new Set([...baseContexts, ...serverContexts, ...clientContexts])];

        // Filters are out of scope for now
        const documents = this.#db.findDocuments(contextArray, featureArray, filterArray, options);
        return documents;
    }



    updateDocument(accessingUserId, document, featureArray = [], options = {}) {
        if (!this.checkPermission(accessingUserId, 'documentWrite')) {
            throw new Error('Access denied: User requires documentWrite permission.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!document) {
            throw new Error('Document is required');
        }

        // We always update context bitmaps
        const contextArray = [
            //...this.#contextBitmapArray,
            ...this.#pathArray,
            ...this.#serverContextArray,
            ...this.#clientContextArray,
        ];

        // Update the document
        const result = this.#db.updateDocument(document, contextArray, featureArray);

        // Prepare document data for events
        const documentEventPayload = {
            contextId: this.#id,
            operation: 'update',
            documentId: document.id,
            document: document,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
            url: this.#url,
            workspaceId: this.#workspace.id,
            timestamp: new Date().toISOString()
        };

        this.emit('document:update', documentEventPayload);
        this.emit('context:updated', {
            id: this.#id,
            operation: 'document:update',
            document: document.id,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
        });

        return result;
    }

    updateDocumentArray(accessingUserId, documentArray, featureArray = [], options = {}) {
        if (!this.checkPermission(accessingUserId, 'documentWrite')) {
            throw new Error('Access denied: User requires documentWrite permission.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documentArray)) {
            throw new Error('Document array must be an array');
        }

        // We always update context bitmaps
        const contextArray = [
            //...this.#contextBitmapArray,
            ...this.#pathArray,
            ...this.#serverContextArray,
            ...this.#clientContextArray,
        ];

        // Update the documents
        const result = this.#db.updateDocumentArray(documentArray, contextArray, featureArray);

        // Prepare document data for events
        const documentIds = documentArray.map(doc => doc.id);
        const documentEventPayload = {
            contextId: this.#id,
            operation: 'update',
            documentIds: documentIds,
            documents: documentArray,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
            url: this.#url,
            workspaceId: this.#workspace.id,
            timestamp: new Date().toISOString()
        };

        this.emit('document:update', documentEventPayload);
        this.emit('context:updated', {
            id: this.#id,
            operation: 'document:update',
            documentArray: documentArray,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
        });

        return result;
    }

    removeDocument(accessingUserId, documentId, featureArray = [], options = {}) {
        if (!this.checkPermission(accessingUserId, 'documentReadWrite')) {
            throw new Error('Access denied: User requires documentReadWrite permission.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        // We remove document from the current context not from the database
        const result = this.#db.removeDocument(documentId, this.#contextBitmapArray, featureArray, options);

        // Prepare document data for events
        const documentEventPayload = {
            contextId: this.#id,
            operation: 'remove',
            documentId: documentId,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
            url: this.#url,
            workspaceId: this.#workspace.id,
            timestamp: new Date().toISOString()
        };

        this.emit('document:remove', documentEventPayload);
        this.emit('context:updated', {
            id: this.#id,
            operation: 'document:remove',
            document: documentId,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
        });

        return result;
    }

    removeDocumentArray(accessingUserId, documentIdArray, featureArray = [], options = {}) {
        if (!this.checkPermission(accessingUserId, 'documentReadWrite')) {
            throw new Error('Access denied: User requires documentReadWrite permission.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documentIdArray)) {
            throw new Error('Document ID array must be an array');
        }

        // Ensure all document IDs are numbers
        const numericDocumentIdArray = documentIdArray.map(id => {
            const numId = parseInt(id, 10);
            if (isNaN(numId)) {
                throw new Error(`Invalid document ID: ${id}. Must be a number or a string coercible to a number.`);
            }
            return numId;
        });

        // We remove documents from the current context not from the database
        const result = this.#db.removeDocumentArray(numericDocumentIdArray, this.#contextBitmapArray, featureArray, options);

        // Prepare document data for events
        const documentEventPayload = {
            contextId: this.#id,
            operation: 'remove',
            documentIds: numericDocumentIdArray,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
            url: this.#url,
            workspaceId: this.#workspace.id,
            timestamp: new Date().toISOString()
        };

        this.emit('document:remove', documentEventPayload);
        this.emit('context:updated', {
            id: this.#id,
            operation: 'document:remove',
            documentArray: numericDocumentIdArray,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
        });

        return result;
    }

    /**
     * Core DB methods (not contextualized)
     * TODO: Maybe we should remove them from context entirely?
     */

    deleteDocumentFromDb(accessingUserId, documentId) {
        // This is a direct DB access method, only context owner should call it.
        if (accessingUserId !== this.#userId) {
            throw new Error('Access denied: Only the context owner can delete documents directly from the database.');
        }
        // Technically, owner has all permissions, but check for completeness or if that changes.
        if (!this.checkPermission(accessingUserId, 'documentReadWrite')) {
            throw new Error('Access denied: User requires documentReadWrite permission for direct DB deletion.');
        }

        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        // Ensure document ID is a number (consistent with array version)
        const numericDocumentId = parseInt(documentId, 10);
        if (isNaN(numericDocumentId)) {
            throw new Error(`Invalid document ID: ${documentId}. Must be a number or a string coercible to a number.`);
        }

        // Completely delete the document from the database, respecting the context
        const result = this.#db.deleteDocument(numericDocumentId, this.#pathArray);

        // Prepare document data for events
        const documentEventPayload = {
            contextId: this.#id,
            operation: 'delete',
            documentId: numericDocumentId,
            url: this.#url,
            workspaceId: this.#workspace.id,
            timestamp: new Date().toISOString()
        };

        this.emit('document:delete', documentEventPayload);
        this.emit('context:updated', {
            id: this.#id,
            operation: 'document:delete',
            document: numericDocumentId,
        });

        return result;
    }

    deleteDocumentArrayFromDb(accessingUserId, documentIdArray, options = {}) {
        // This is a direct DB access method, only context owner should call it.
        if (accessingUserId !== this.#userId) {
            throw new Error('Access denied: Only the context owner can delete documents directly from the database.');
        }
        // Technically, owner has all permissions, but check for completeness or if that changes.
        if (!this.checkPermission(accessingUserId, 'documentReadWrite')) {
            throw new Error('Access denied: User requires documentReadWrite permission for direct DB deletion.');
        }

        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documentIdArray)) {
            throw new Error('Document ID array must be an array');
        }

        // Ensure all document IDs are numbers (same validation as removeDocumentArray)
        const numericDocumentIdArray = documentIdArray.map(id => {
            const numId = parseInt(id, 10);
            if (isNaN(numId)) {
                throw new Error(`Invalid document ID: ${id}. Must be a number or a string coercible to a number.`);
            }
            return numId;
        });

        // Completely delete the documents from the database, respecting the context
        const result = this.#db.deleteDocumentArray(numericDocumentIdArray, this.#pathArray, options);

        // Prepare document data for events
        const documentEventPayload = {
            contextId: this.#id,
            operation: 'delete',
            documentIds: numericDocumentIdArray,
            count: numericDocumentIdArray.length,
            url: this.#url,
            workspaceId: this.#workspace.id,
            timestamp: new Date().toISOString()
        };

        this.emit('documents:delete', documentEventPayload);
        this.emit('document:delete', documentEventPayload);
        this.emit('context:updated', {
            id: this.#id,
            operation: 'document:delete',
            documentArray: numericDocumentIdArray,
        });

        return result;
    }

    /**
     * Utils
     */

    toJSON() {
        return {
            id: this.#id,
            userId: this.#userId,
            url: this.#url,
            baseUrl: this.#baseUrl,
            path: this.#path,
            pathArray: this.#pathArray,
            workspaceId: this.#workspace?.id,
            color: this.#color,
            acl: this.#acl,
            createdAt: this.#createdAt,
            updatedAt: this.#updatedAt,
            locked: this.#isLocked,
            serverContextArray: this.#serverContextArray,
            clientContextArray: this.#clientContextArray,
            contextBitmapArray: this.#contextBitmapArray,
            featureBitmapArray: this.#featureBitmapArray,
            filterArray: this.#filterArray,
            pendingUrl: this.#pendingUrl || null,
        };
    }

    async getDocumentByChecksum(accessingUserId, checksumString, featureArray = []) {
        if (!this.checkPermission(accessingUserId, 'documentRead')) {
            throw new Error('Access denied: User requires documentRead permission.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }
        if (!checksumString || typeof checksumString !== 'string') {
            throw new Error('Checksum string is required.');
        }

        // Step 1: Get the document by checksum, ensuring it's within the current context's path.
        // The updated SynapsD method handles the contextSpec (this.#pathArray).
        const documentInContext = await this.#workspace.db.getDocumentByChecksumString(checksumString, this.#pathArray);

        if (!documentInContext) {
            debug(`Document with checksum '${checksumString}' not found within context path '${this.#path}'.`);
            return null;
        }

        // Step 2: If featureArray is provided, perform an additional check for features.
        // We use this.#contextBitmapArray for the hasDocument call as it represents the fully resolved context for this Context instance.
        if (featureArray && featureArray.length > 0) {
            const matchesFeatures = await this.#workspace.db.hasDocument(documentInContext.id, this.#contextBitmapArray, featureArray);
            if (!matchesFeatures) {
                debug(`Document ID '${documentInContext.id}' (checksum '${checksumString}') found in context path '${this.#path}' but does not match featureArray: [${featureArray.join(', ')}].`);
                return null;
            }
        }

        // If all checks pass (in context, and matches features if specified)
        debug(`Document ID '${documentInContext.id}' (checksum '${checksumString}') is accessible in context and matches features (if specified).`);
        return documentInContext;
    }

    async getDocumentByChecksumStringFromDb(accessingUserId, checksumString) {
        // This is a direct DB access method, only context owner should call it.
        if (accessingUserId !== this.#userId) {
            throw new Error('Access denied: This operation is only available to the context owner.');
        }
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }
        if (!checksumString || typeof checksumString !== 'string') {
            throw new Error('Checksum string is required.');
        }

        // We assume getDocumentByChecksumString returns the parsed document object or null
        const document = await this.#workspace.db.getDocumentByChecksumString(checksumString, this.#pathArray);

        if (!document) {
            debug(`Document with checksum '${checksumString}' not found in database.`);
            return null;
        }
        return document;
    }

    /**
     * Setup event forwarding from workspace to context
     * @private
     */
    #setupWorkspaceEventForwarding() {
        if (!this.#workspace) return;

        debug(`Setting up workspace event forwarding for context "${this.#id}"`);

        // Store references to the bound event handlers for cleanup
        this.#workspaceEventHandlers = {
            documentInserted: (payload) => this.#handleWorkspaceDocumentEvent('document:inserted', payload),
            documentUpdated: (payload) => this.#handleWorkspaceDocumentEvent('document:updated', payload),
            documentRemoved: (payload) => this.#handleWorkspaceDocumentEvent('document:removed', payload),
            documentDeleted: (payload) => this.#handleWorkspaceDocumentEvent('document:deleted', payload),
            treePathInserted: (payload) => this.#handleWorkspaceTreeEvent('tree:path:inserted', payload),
            treePathMoved: (payload) => this.#handleWorkspaceTreeEvent('tree:path:moved', payload),
            treePathCopied: (payload) => this.#handleWorkspaceTreeEvent('tree:path:copied', payload),
            treePathRemoved: (payload) => this.#handleWorkspaceTreeEvent('tree:path:removed', payload),
            treeDocumentInserted: (payload) => this.#handleWorkspaceTreeDocumentEvent('tree:document:inserted', payload),
            treeDocumentInsertedBatch: (payload) => this.#handleWorkspaceTreeDocumentEvent('tree:document:inserted:batch', payload),
            treeDocumentUpdated: (payload) => this.#handleWorkspaceTreeDocumentEvent('tree:document:updated', payload),
            treeDocumentUpdatedBatch: (payload) => this.#handleWorkspaceTreeDocumentEvent('tree:document:updated:batch', payload),
            treeDocumentRemoved: (payload) => this.#handleWorkspaceTreeDocumentEvent('tree:document:removed', payload),
            treeDocumentRemovedBatch: (payload) => this.#handleWorkspaceTreeDocumentEvent('tree:document:removed:batch', payload),
            treeDocumentDeleted: (payload) => this.#handleWorkspaceTreeDocumentEvent('tree:document:deleted', payload),
            treeDocumentDeletedBatch: (payload) => this.#handleWorkspaceTreeDocumentEvent('tree:document:deleted:batch', payload),
            treePathLocked: (payload) => this.#handleWorkspaceTreeEvent('tree:path:locked', payload),
            treePathUnlocked: (payload) => this.#handleWorkspaceTreeEvent('tree:path:unlocked', payload),
            treeLayerMergedUp: (payload) => this.#handleWorkspaceTreeEvent('tree:layer:merged:up', payload),
            treeLayerMergedDown: (payload) => this.#handleWorkspaceTreeEvent('tree:layer:merged:down', payload),
            treeSaved: (payload) => this.#handleWorkspaceTreeEvent('tree:saved', payload),
            treeLoaded: (payload) => this.#handleWorkspaceTreeEvent('tree:loaded', payload),
            treeRecalculated: (payload) => this.#handleWorkspaceTreeEvent('tree:recalculated', payload),
            treeError: (payload) => this.#handleWorkspaceTreeEvent('tree:error', payload)
        };

        // Register the event handlers
        this.#workspace.on('workspace:document:inserted', this.#workspaceEventHandlers.documentInserted);
        this.#workspace.on('workspace:document:updated', this.#workspaceEventHandlers.documentUpdated);
        this.#workspace.on('workspace:document:removed', this.#workspaceEventHandlers.documentRemoved);
        this.#workspace.on('workspace:document:deleted', this.#workspaceEventHandlers.documentDeleted);
        this.#workspace.on('workspace:tree:path:inserted', this.#workspaceEventHandlers.treePathInserted);
        this.#workspace.on('workspace:tree:path:moved', this.#workspaceEventHandlers.treePathMoved);
        this.#workspace.on('workspace:tree:path:copied', this.#workspaceEventHandlers.treePathCopied);
        this.#workspace.on('workspace:tree:path:removed', this.#workspaceEventHandlers.treePathRemoved);
        this.#workspace.on('workspace:tree:document:inserted', this.#workspaceEventHandlers.treeDocumentInserted);
        this.#workspace.on('workspace:tree:document:inserted:batch', this.#workspaceEventHandlers.treeDocumentInsertedBatch);
        this.#workspace.on('workspace:tree:document:updated', this.#workspaceEventHandlers.treeDocumentUpdated);
        this.#workspace.on('workspace:tree:document:updated:batch', this.#workspaceEventHandlers.treeDocumentUpdatedBatch);
        this.#workspace.on('workspace:tree:document:removed', this.#workspaceEventHandlers.treeDocumentRemoved);
        this.#workspace.on('workspace:tree:document:removed:batch', this.#workspaceEventHandlers.treeDocumentRemovedBatch);
        this.#workspace.on('workspace:tree:document:deleted', this.#workspaceEventHandlers.treeDocumentDeleted);
        this.#workspace.on('workspace:tree:document:deleted:batch', this.#workspaceEventHandlers.treeDocumentDeletedBatch);
        this.#workspace.on('workspace:tree:path:locked', this.#workspaceEventHandlers.treePathLocked);
        this.#workspace.on('workspace:tree:path:unlocked', this.#workspaceEventHandlers.treePathUnlocked);
        this.#workspace.on('workspace:tree:layer:merged:up', this.#workspaceEventHandlers.treeLayerMergedUp);
        this.#workspace.on('workspace:tree:layer:merged:down', this.#workspaceEventHandlers.treeLayerMergedDown);
        this.#workspace.on('workspace:tree:saved', this.#workspaceEventHandlers.treeSaved);
        this.#workspace.on('workspace:tree:loaded', this.#workspaceEventHandlers.treeLoaded);
        this.#workspace.on('workspace:tree:recalculated', this.#workspaceEventHandlers.treeRecalculated);
        this.#workspace.on('workspace:tree:error', this.#workspaceEventHandlers.treeError);

        debug(`Workspace event forwarding setup completed for context "${this.#id}"`);
    }

    /**
     * Handle workspace document events and decide whether to forward them
     * @private
     */
    #handleWorkspaceDocumentEvent(eventType, payload) {
        // Forward all workspace document events with context information
        this.emit(`context:workspace:${eventType}`, {
            contextId: this.#id,
            contextUrl: this.#url,
            contextPath: this.#path,
            contextPathArray: this.#pathArray,
            userId: this.#userId,
            ...payload
        });
    }

    /**
     * Handle workspace tree events and decide whether to forward them
     * @private
     */
    #handleWorkspaceTreeEvent(eventType, payload) {
        // Forward tree events that might affect this context
        this.emit(`context:workspace:${eventType}`, {
            contextId: this.#id,
            contextUrl: this.#url,
            contextPath: this.#path,
            contextPathArray: this.#pathArray,
            userId: this.#userId,
            ...payload
        });
    }

    /**
     * Handle workspace tree document events and decide whether to forward them
     * @private
     */
    #handleWorkspaceTreeDocumentEvent(eventType, payload) {
        // Check if the event is relevant to this context based on path overlap
        const isRelevant = this.#isEventRelevantToContext(payload);

        if (isRelevant) {
            this.emit(`context:workspace:${eventType}`, {
                contextId: this.#id,
                contextUrl: this.#url,
                contextPath: this.#path,
                contextPathArray: this.#pathArray,
                userId: this.#userId,
                relevant: true,
                ...payload
            });

            debug(`Context "${this.#id}" forwarded relevant ${eventType} event for path "${payload.contextSpec || 'unknown'}"`);
        } else {
            // Still emit the event but mark it as not directly relevant
            this.emit(`context:workspace:${eventType}`, {
                contextId: this.#id,
                contextUrl: this.#url,
                contextPath: this.#path,
                contextPathArray: this.#pathArray,
                userId: this.#userId,
                relevant: false,
                ...payload
            });
        }
    }

    /**
     * Check if a workspace event is relevant to this context based on path overlap
     * @private
     */
    #isEventRelevantToContext(payload) {
        if (!payload.contextSpec && !payload.path) {
            // If no path information, consider it relevant (safer default)
            return true;
        }

        const eventPath = payload.contextSpec || payload.path || '';
        const contextPath = this.#path || '/';

        // Check if the event path is within this context's path or vice versa
        // This handles cases like:
        // - Context at /foo/bar receives event for /foo/bar/baz (child)
        // - Context at /foo/bar/baz receives event for /foo/bar (parent)
        // - Context at /foo/bar receives event for /foo/bar (same)

        const normalizePathForComparison = (path) => {
            if (!path || path === '/') return '/';
            return path.endsWith('/') ? path.slice(0, -1) : path;
        };

        const normalizedEventPath = normalizePathForComparison(eventPath);
        const normalizedContextPath = normalizePathForComparison(contextPath);

        // Check for path overlap (either path contains the other)
        return normalizedEventPath.startsWith(normalizedContextPath) ||
               normalizedContextPath.startsWith(normalizedEventPath);
    }

    /**
     * Clean up workspace event forwarding
     * @private
     */
    #cleanupWorkspaceEventForwarding() {
        if (!this.#workspace || !this.#workspaceEventHandlers) return;

        debug(`Cleaning up workspace event forwarding for context "${this.#id}"`);

        // Remove specific event listeners using stored handler references
        this.#workspace.off('workspace:document:inserted', this.#workspaceEventHandlers.documentInserted);
        this.#workspace.off('workspace:document:updated', this.#workspaceEventHandlers.documentUpdated);
        this.#workspace.off('workspace:document:removed', this.#workspaceEventHandlers.documentRemoved);
        this.#workspace.off('workspace:document:deleted', this.#workspaceEventHandlers.documentDeleted);
        this.#workspace.off('workspace:tree:path:inserted', this.#workspaceEventHandlers.treePathInserted);
        this.#workspace.off('workspace:tree:path:moved', this.#workspaceEventHandlers.treePathMoved);
        this.#workspace.off('workspace:tree:path:copied', this.#workspaceEventHandlers.treePathCopied);
        this.#workspace.off('workspace:tree:path:removed', this.#workspaceEventHandlers.treePathRemoved);
        this.#workspace.off('workspace:tree:document:inserted', this.#workspaceEventHandlers.treeDocumentInserted);
        this.#workspace.off('workspace:tree:document:inserted:batch', this.#workspaceEventHandlers.treeDocumentInsertedBatch);
        this.#workspace.off('workspace:tree:document:updated', this.#workspaceEventHandlers.treeDocumentUpdated);
        this.#workspace.off('workspace:tree:document:updated:batch', this.#workspaceEventHandlers.treeDocumentUpdatedBatch);
        this.#workspace.off('workspace:tree:document:removed', this.#workspaceEventHandlers.treeDocumentRemoved);
        this.#workspace.off('workspace:tree:document:removed:batch', this.#workspaceEventHandlers.treeDocumentRemovedBatch);
        this.#workspace.off('workspace:tree:document:deleted', this.#workspaceEventHandlers.treeDocumentDeleted);
        this.#workspace.off('workspace:tree:document:deleted:batch', this.#workspaceEventHandlers.treeDocumentDeletedBatch);
        this.#workspace.off('workspace:tree:path:locked', this.#workspaceEventHandlers.treePathLocked);
        this.#workspace.off('workspace:tree:path:unlocked', this.#workspaceEventHandlers.treePathUnlocked);
        this.#workspace.off('workspace:tree:layer:merged:up', this.#workspaceEventHandlers.treeLayerMergedUp);
        this.#workspace.off('workspace:tree:layer:merged:down', this.#workspaceEventHandlers.treeLayerMergedDown);
        this.#workspace.off('workspace:tree:saved', this.#workspaceEventHandlers.treeSaved);
        this.#workspace.off('workspace:tree:loaded', this.#workspaceEventHandlers.treeLoaded);
        this.#workspace.off('workspace:tree:recalculated', this.#workspaceEventHandlers.treeRecalculated);
        this.#workspace.off('workspace:tree:error', this.#workspaceEventHandlers.treeError);

        // Clear the handlers reference
        this.#workspaceEventHandlers = null;

        debug(`Workspace event forwarding cleanup completed for context "${this.#id}"`);
    }
}

export default Context;
