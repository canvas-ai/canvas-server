'use strict';

// Utils
import EventEmitter from 'eventemitter2';
import { v4 as uuidv4 } from 'uuid';

// Logging
import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('context-manager:context');

// Includes
import Url from './Url.js';

// Constants
const DEFAULT_BASE_URL = '/';

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

    constructor(url = DEFAULT_BASE_URL, options = {}) {
        super();

        // Context properties
        this.#id = options.id || uuidv4(); // TODO: Use human-typeable 6-char ULID
        this.#url = null;
        this.#baseUrl = options.baseUrl || DEFAULT_BASE_URL;
        this.#path = null;
        this.#pathArray = [];
        this.#isLocked = options.locked || false;

        // User ID
        if (!options.userId) { throw new Error('User ID is required'); }
        this.#userId = options.userId;

        // Workspace references
        if (!options.workspace) { throw new Error('Workspace instance is required'); }
        if (!options.workspaceManager) { throw new Error('Workspace manager instance is required'); }
        this.#workspace = options.workspace;
        this.#workspaceManager = options.workspaceManager;
        this.#db = this.#workspace.db;
        this.#tree = this.#workspace.tree;
        this.#color = this.#workspace.color;

        // Context manager references
        if (!options.contextManager) { throw new Error('Context manager instance is required'); }
        this.#contextManager = options.contextManager;

        // Context metadata
        this.#createdAt = options.createdAt || new Date().toISOString();
        this.#updatedAt = options.updatedAt || new Date().toISOString();

        // ACL
        this.#acl = options.acl || {};

        // Context variables
        this.#serverContextArray = options.serverContextArray || [];
        this.#clientContextArray = options.clientContextArray || [];

        // Set up event forwarding from workspace
        this.#setupWorkspaceEventForwarding();

        // Set initial URL - simplified logic now that Url properly handles null workspaceId
        try {
            // Validate base URL if provided
            if (this.#baseUrl !== '/') {
                const base = new Url(this.#baseUrl);
                if (!base.isValid) {
                    throw new Error(`Invalid base URL provided: ${this.#baseUrl}`);
                }
            }

            // Parse the initial URL
            const parsedUrl = new Url(url);
            if (!parsedUrl.isValid) {
                throw new Error(`Invalid initial URL provided: ${url}`);
            }

            // Check if URL is within base URL constraints
            if (this.#baseUrl !== '/' && !parsedUrl.path.startsWith(new Url(this.#baseUrl).path)) {
                debug(`Provided URL "${url}" is outside base URL "${this.#baseUrl}". Forcing URL to base URL.`);
                const baseUrl = new Url(this.#baseUrl);
                this.#url = baseUrl.url;
                this.#path = baseUrl.path;
                this.#pathArray = baseUrl.pathArray;
            } else {
                // If no workspaceId in URL, use current workspace name
                if (!parsedUrl.workspaceId) {
                    this.#url = `${this.#workspace.name}://${parsedUrl.path.replace(/^\//, '')}`;
                    this.#path = parsedUrl.path;
                    this.#pathArray = parsedUrl.pathArray;
                } else if (parsedUrl.workspaceId === this.#workspace.name) {
                    // Same workspace, use as-is
                    this.#url = parsedUrl.url;
                    this.#path = parsedUrl.path;
                    this.#pathArray = parsedUrl.pathArray;
                } else {
                    // Different workspace, store as pending for later switching
                    this.#url = `${this.#workspace.name}://${parsedUrl.path.replace(/^\//, '')}`;
                    this.#path = parsedUrl.path;
                    this.#pathArray = parsedUrl.pathArray;
                    this.#pendingUrl = url;
                }
            }
        } catch (error) {
            // Clean up on error
            this.#baseUrl = '/';
            this.#url = null;
            this.#path = null;
            this.#pathArray = [];
            throw new Error(`Failed to initialize context: ${error.message}`);
        }

        debug(`Context ${this.#id} constructor finished. Initial URL state: ${this.#url}, Base URL: ${this.#baseUrl}`);
        this.emit('context.created', this.toJSON());
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
    get workspaceName() { return this.#workspace.name; }
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
        this.emit('context.acl.updated', { id: this.#id, userId: sharedWithUserId, accessLevel });

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
            this.emit('context.acl.revoked', { id: this.#id, userId: sharedWithUserId });

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
        this.emit('context.updated', { id: this.#id, clientContextArray: this.#clientContextArray });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);
    }

    async clearClientContextArray() {
        this.#clientContextArray = [];
        this.emit('context.updated', { id: this.#id, clientContextArray: this.#clientContextArray });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);
    }

    setServerContextArray(serverContextArray) {
        if (!Array.isArray(serverContextArray)) {
            serverContextArray = [serverContextArray];
        }

        this.#serverContextArray = serverContextArray;
        this.emit('context.updated', { id: this.#id, serverContextArray: this.#serverContextArray });
    }

    async clearServerContextArray() {
        this.#serverContextArray = [];
        this.emit('context.updated', { id: this.#id, serverContextArray: this.#serverContextArray });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);
    }

    async setUrl(url) {
        if (this.#isLocked) {
            throw new Error('Context is locked');
        }

        const parsed = new Url(url);
        if (!parsed.isValid) {
            throw new Error(`Invalid URL provided: ${url}`);
        }

        debug(`Attempting to set URL to ${parsed.url}`);
        debug(`Parsed URL: ${JSON.stringify({ workspaceId: parsed.workspaceId, path: parsed.path, pathArray: parsed.pathArray })}`);

        // Validate against base URL if it's set and not root
        if (this.#baseUrl && this.#baseUrl !== '/') {
            const base = new Url(this.#baseUrl);
            if (!parsed.path.startsWith(base.path)) {
                throw new Error(`Cannot set URL "${url}" outside the context base URL "${this.#baseUrl}"`);
            }
        }

        // Determine target workspace name
        const targetWorkspaceName = parsed.workspaceId || this.#workspace.name;

        // If the workspace name is different, switch to the new workspace
        if (targetWorkspaceName !== this.#workspace.name) {
            await this.#switchWorkspace(targetWorkspaceName);
        }

        // Create the URL path in the current workspace
        const contextLayers = await this.#workspace.insertPath(parsed.path);
        this.#contextBitmapArray = parsed.pathArray;
        debug(`ContextPath: ${parsed.path}, contextLayer IDs: ${JSON.stringify(contextLayers)}`);

        // Update the internal URL state
        this.#url = `${this.#workspace.name}://${parsed.path.replace(/^\//, '')}`;
        this.#path = parsed.path;
        this.#pathArray = parsed.pathArray;

        // Update the updated timestamp
        this.#updatedAt = new Date().toISOString();

        // Emit the change event
        this.emit('context.url.set', { id: this.#id, url: this.#url });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);

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
            if (parsedNewBase.workspaceId && parsedNewBase.workspaceId !== this.#workspace.name) {
                throw new Error(`Cannot set base URL to a different workspace: ${newBaseUrl}`);
            }

            // Check if the current URL is compatible with the new base URL
            if (this.#url) {
                const currentParsed = new Url(this.#url);
                // Only check path if the current URL is actually in the same workspace
                if ((!currentParsed.workspaceId || currentParsed.workspaceId === this.#workspace.name) &&
                    !currentParsed.path.startsWith(parsedNewBase.path)) {
                    throw new Error(
                        `Current URL "${this.#url}" is outside the proposed new base URL "${newBaseUrl}". Please navigate within the new base URL before setting it.`,
                    );
                }
            }
        }

        debug(`Setting base URL from "${this.#baseUrl}" to "${newBaseUrl}"`);
        this.#baseUrl = newBaseUrl;
        this.#updatedAt = new Date().toISOString();
        this.emit('context.updated', { id: this.#id, baseUrl: this.#baseUrl });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);

        return Promise.resolve(this);
    }

    async lock() {
        this.#isLocked = true;
        this.#updatedAt = new Date().toISOString();
        this.emit('context.locked', { id: this.#id, locked: this.#isLocked });

        // Save changes to index
        await this.#contextManager.saveContext(this.#userId, this);

        return Promise.resolve(this);
    }

    async unlock() {
        this.#isLocked = false;
        this.#updatedAt = new Date().toISOString();
        this.emit('context.unlocked', { id: this.#id, locked: this.#isLocked });

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
        this.emit('context.deleted', { id: this.#id });

        // Remove all listeners
        this.removeAllListeners();

        return Promise.resolve(this);
    }

    async #switchWorkspace(workspaceName) {
        if (this.#isLocked) {
            throw new Error('Context is locked');
        }

        const hasWs = await this.#workspaceManager.hasWorkspace(this.#userId, workspaceName, this.#userId);
        if (!hasWs) {
            throw new Error(`Workspace "${workspaceName}" not found`);
        }

        try {
            // Clean up event forwarding from the old workspace
            this.#cleanupWorkspaceEventForwarding();

            const newWorkspaceInstance = await this.#workspaceManager.getWorkspace(this.#userId, workspaceName, this.#userId);
            this.#workspace = newWorkspaceInstance;
            this.#db = this.#workspace.db;
            this.#tree = this.#workspace.tree;
            this.#color = this.#workspace.color;

            // Set up event forwarding for the new workspace
            this.#setupWorkspaceEventForwarding();

            debug(`Context "${this.#id}" successfully switched to workspace "${workspaceName}"`);
        } catch (error) {
            throw new Error(`Failed to switch workspace: ${error.message}`);
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
        this.emit('context.updated', { id: this.#id, featureBitmapArray: this.#featureBitmapArray });
    }

    appendFeatureBitmaps(featureArray) {
        if (!Array.isArray(featureArray)) {
            featureArray = [featureArray];
        }
        this.#featureBitmapArray.push(...featureArray);
        this.emit('context.updated', { id: this.#id, featureBitmapArray: this.#featureBitmapArray });
    }

    removeFeatureBitmaps(featureArray) {
        if (!Array.isArray(featureArray)) {
            featureArray = [featureArray];
        }
        this.#featureBitmapArray = this.#featureBitmapArray.filter((feature) => !featureArray.includes(feature));
        this.emit('context.updated', { id: this.#id, featureBitmapArray: this.#featureBitmapArray });
    }

    clearFeatureBitmaps() {
        this.#featureBitmapArray = [];
        this.emit('context.updated', { id: this.#id, featureBitmapArray: this.#featureBitmapArray });
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

        this.emit('document.inserted', documentEventPayload);
        this.emit('context.updated', {
            id: this.#id,
            operation: 'document.inserted',
            document: documentId,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
        });

        return result;
    }

    async insertDocumentArray(accessingUserId, documentArray, featureArray = [], options = {}) {
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

        // Insert the documents (handle async results)
        const result = await Promise.resolve(this.#db.insertDocumentArray(documentArray, contextArray, featureArray));

        // Prepare document data for events - handle different result formats
        let documentIds = [];

        debug('#insertDocumentArray: DB result type:', typeof result, 'isArray:', Array.isArray(result));
        debug('#insertDocumentArray: DB result value:', result);

        if (result && Array.isArray(result)) {
            // Result is an array of document IDs
            documentIds = result;
        } else if (result && typeof result === 'object' && result.data && Array.isArray(result.data)) {
            // Result is wrapped in a response object with data array
            documentIds = result.data.map(doc => doc.id || doc);
        } else if (result && typeof result === 'object' && result.insertedIds) {
            // Result has insertedIds property
            documentIds = result.insertedIds;
        } else if (result && typeof result === 'number') {
            // Single document ID returned
            documentIds = [result];
        } else {
            // Fallback: try to extract IDs from documents (though they might not have them yet)
            documentIds = documentArray.map(doc => doc.id).filter(id => id != null);
            debug('#insertDocumentArray: WARNING - Using fallback for documentIds, may contain nulls');
        }

        debug('#insertDocumentArray: Final documentIds:', documentIds);

        // Enhance documents with IDs if available
        const enhancedDocuments = documentArray.map((doc, index) => ({
            ...doc,
            id: documentIds[index] || doc.id
        }));

        const documentEventPayload = {
            contextId: this.#id,
            operation: 'insert',
            documentIds: documentIds,
            documents: enhancedDocuments,
            contextArray: this.#contextBitmapArray,
            featureArray: featureArray,
            url: this.#url,
            workspaceId: this.#workspace.id,
            timestamp: new Date().toISOString()
        };

        debug('#insertDocumentArray: Emitting document.inserted event with payload:', JSON.stringify(documentEventPayload, null, 2));
        this.emit('document.inserted', documentEventPayload);
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

        this.emit('document.updated', documentEventPayload);
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

        this.emit('document.updated', documentEventPayload);
        return result;
    }

    removeDocument(accessingUserId, documentId, featureArray = [], options = {}) {
        debug(`#removeDocument: Starting removal for documentId: ${documentId}, accessingUserId: ${accessingUserId}, featureArray: ${JSON.stringify(featureArray)}, options: ${JSON.stringify(options)}`);

        if (!this.checkPermission(accessingUserId, 'documentReadWrite')) {
            debug(`#removeDocument: Permission check failed for user ${accessingUserId}`);
            throw new Error('Access denied: User requires documentReadWrite permission.');
        }
        debug(`#removeDocument: Permission check passed`);

        if (!this.#workspace || !this.#workspace.db) {
            debug(`#removeDocument: Workspace or database not available - workspace: ${!!this.#workspace}, db: ${!!this.#workspace?.db}`);
            throw new Error('Workspace or database not available');
        }
        debug(`#removeDocument: Workspace and database available`);
        debug(`#removeDocument: Context bitmap array: ${JSON.stringify(this.#contextBitmapArray)}`);

        try {
            // We remove document from the current context not from the database
            debug(`#removeDocument: Calling db.removeDocument with documentId: ${documentId}, contextArray: ${JSON.stringify(this.#contextBitmapArray)}, featureArray: ${JSON.stringify(featureArray)}, options: ${JSON.stringify(options)}`);
            const result = this.#db.removeDocument(documentId, this.#contextBitmapArray, featureArray, options);
            debug(`#removeDocument: Database removal successful, result: ${JSON.stringify(result)}`);

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
            debug(`#removeDocument: Prepared event payload: ${JSON.stringify(documentEventPayload)}`);

            debug(`#removeDocument: Emitting document.remove event`);
            this.emit('document.removed', documentEventPayload);

            debug(`#removeDocument: Successfully completed removal of document ${documentId} from context`);
            return result;
        } catch (error) {
            debug(`#removeDocument: Error during removal process: ${error.message}`);
            debug(`#removeDocument: Error stack: ${error.stack}`);
            throw error;
        }
    }

    removeDocumentArray(accessingUserId, documentIdArray, featureArray = [], options = {}) {
        debug(`#removeDocumentArray: Starting removal for documentIdArray: ${JSON.stringify(documentIdArray)}, accessingUserId: ${accessingUserId}, featureArray: ${JSON.stringify(featureArray)}, options: ${JSON.stringify(options)}`);

        if (!this.checkPermission(accessingUserId, 'documentReadWrite')) {
            debug(`#removeDocumentArray: Permission check failed for user ${accessingUserId}`);
            throw new Error('Access denied: User requires documentReadWrite permission.');
        }
        debug(`#removeDocumentArray: Permission check passed`);

        if (!this.#workspace || !this.#workspace.db) {
            debug(`#removeDocumentArray: Workspace or database not available - workspace: ${!!this.#workspace}, db: ${!!this.#workspace?.db}`);
            throw new Error('Workspace or database not available');
        }
        debug(`#removeDocumentArray: Workspace and database available`);

        if (!Array.isArray(documentIdArray)) {
            debug(`#removeDocumentArray: Invalid input - not an array: ${typeof documentIdArray}`);
            throw new Error('Document ID array must be an array');
        }
        debug(`#removeDocumentArray: Input validation passed - array length: ${documentIdArray.length}`);
        debug(`#removeDocumentArray: Context bitmap array: ${JSON.stringify(this.#contextBitmapArray)}`);

        try {
            // Ensure all document IDs are numbers
            debug(`#removeDocumentArray: Converting document IDs to numbers`);
            const numericDocumentIdArray = documentIdArray.map((id, index) => {
                const numId = parseInt(id, 10);
                if (isNaN(numId)) {
                    debug(`#removeDocumentArray: Invalid document ID at index ${index} - original: ${id}, parsed: ${numId}`);
                    throw new Error(`Invalid document ID: ${id}. Must be a number or a string coercible to a number.`);
                }
                return numId;
            });
            debug(`#removeDocumentArray: Document ID conversion successful - using: ${JSON.stringify(numericDocumentIdArray)}`);

            // We remove documents from the current context not from the database
            debug(`#removeDocumentArray: Calling db.removeDocumentArray with documentIds: ${JSON.stringify(numericDocumentIdArray)}, contextArray: ${JSON.stringify(this.#contextBitmapArray)}, featureArray: ${JSON.stringify(featureArray)}, options: ${JSON.stringify(options)}`);
            const result = this.#db.removeDocumentArray(numericDocumentIdArray, this.#contextBitmapArray, featureArray, options);
            debug(`#removeDocumentArray: Database removal successful, result: ${JSON.stringify(result)}`);

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
            debug(`#removeDocumentArray: Prepared event payload: ${JSON.stringify(documentEventPayload)}`);

            debug(`#removeDocumentArray: Emitting document.removed.batch event`);
            this.emit('document.removed.batch', documentEventPayload);
            debug(`#removeDocumentArray: Successfully completed removal of ${numericDocumentIdArray.length} documents from context`);
            return result;
        } catch (error) {
            debug(`#removeDocumentArray: Error during removal process: ${error.message}`);
            debug(`#removeDocumentArray: Error stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Core DB methods (not contextualized)
     * TODO: Maybe we should remove them from context entirely?
     */

    deleteDocumentFromDb(accessingUserId, documentId) {
        debug(`#deleteDocumentFromDb: Starting deletion for documentId: ${documentId}, accessingUserId: ${accessingUserId}`);

        // This is a direct DB access method, only context owner should call it.
        if (accessingUserId !== this.#userId) {
            debug(`#deleteDocumentFromDb: Access denied - user ${accessingUserId} is not owner ${this.#userId}`);
            throw new Error('Access denied: Only the context owner can delete documents directly from the database.');
        }
        debug(`#deleteDocumentFromDb: Owner check passed`);

        // Technically, owner has all permissions, but check for completeness or if that changes.
        if (!this.checkPermission(accessingUserId, 'documentReadWrite')) {
            debug(`#deleteDocumentFromDb: Permission check failed for user ${accessingUserId}`);
            throw new Error('Access denied: User requires documentReadWrite permission for direct DB deletion.');
        }
        debug(`#deleteDocumentFromDb: Permission check passed`);

        if (!this.#workspace || !this.#workspace.db) {
            debug(`#deleteDocumentFromDb: Workspace or database not available - workspace: ${!!this.#workspace}, db: ${!!this.#workspace?.db}`);
            throw new Error('Workspace or database not available');
        }
        debug(`#deleteDocumentFromDb: Workspace and database available`);

        // Ensure document ID is a number (consistent with array version)
        const numericDocumentId = parseInt(documentId, 10);
        if (isNaN(numericDocumentId)) {
            debug(`#deleteDocumentFromDb: Invalid document ID conversion - original: ${documentId}, parsed: ${numericDocumentId}`);
            throw new Error(`Invalid document ID: ${documentId}. Must be a number or a string coercible to a number.`);
        }
        debug(`#deleteDocumentFromDb: Document ID validation passed - using: ${numericDocumentId}`);
        debug(`#deleteDocumentFromDb: Context pathArray: ${JSON.stringify(this.#pathArray)}`);

        try {
            // Completely delete the document from the database, respecting the context
            debug(`#deleteDocumentFromDb: Calling db.deleteDocument with documentId: ${numericDocumentId}, pathArray: ${JSON.stringify(this.#pathArray)}`);
            const result = this.#db.deleteDocument(numericDocumentId, this.#pathArray);
            debug(`#deleteDocumentFromDb: Database deletion successful, result: ${JSON.stringify(result)}`);

            // Prepare document data for events
            const documentEventPayload = {
                contextId: this.#id,
                operation: 'delete',
                documentId: numericDocumentId,
                url: this.#url,
                workspaceId: this.#workspace.id,
                timestamp: new Date().toISOString()
            };
            debug(`#deleteDocumentFromDb: Prepared event payload: ${JSON.stringify(documentEventPayload)}`);

            debug(`#deleteDocumentFromDb: Emitting document.delete event`);
            this.emit('document.deleted', documentEventPayload);

            debug(`#deleteDocumentFromDb: Successfully completed deletion of document ${numericDocumentId}`);
            return result;
        } catch (error) {
            debug(`#deleteDocumentFromDb: Error during deletion process: ${error.message}`);
            debug(`#deleteDocumentFromDb: Error stack: ${error.stack}`);
            throw error;
        }
    }

    deleteDocumentArrayFromDb(accessingUserId, documentIdArray, options = {}) {
        debug(`#deleteDocumentArrayFromDb: Starting deletion for documentIdArray: ${JSON.stringify(documentIdArray)}, accessingUserId: ${accessingUserId}, options: ${JSON.stringify(options)}`);

        // This is a direct DB access method, only context owner should call it.
        if (accessingUserId !== this.#userId) {
            debug(`#deleteDocumentArrayFromDb: Access denied - user ${accessingUserId} is not owner ${this.#userId}`);
            throw new Error('Access denied: Only the context owner can delete documents directly from the database.');
        }
        debug(`#deleteDocumentArrayFromDb: Owner check passed`);

        // Technically, owner has all permissions, but check for completeness or if that changes.
        if (!this.checkPermission(accessingUserId, 'documentReadWrite')) {
            debug(`#deleteDocumentArrayFromDb: Permission check failed for user ${accessingUserId}`);
            throw new Error('Access denied: User requires documentReadWrite permission for direct DB deletion.');
        }
        debug(`#deleteDocumentArrayFromDb: Permission check passed`);

        if (!this.#workspace || !this.#workspace.db) {
            debug(`#deleteDocumentArrayFromDb: Workspace or database not available - workspace: ${!!this.#workspace}, db: ${!!this.#workspace?.db}`);
            throw new Error('Workspace or database not available');
        }
        debug(`#deleteDocumentArrayFromDb: Workspace and database available`);

        if (!Array.isArray(documentIdArray)) {
            debug(`#deleteDocumentArrayFromDb: Invalid input - not an array: ${typeof documentIdArray}`);
            throw new Error('Document ID array must be an array');
        }
        debug(`#deleteDocumentArrayFromDb: Input validation passed - array length: ${documentIdArray.length}`);

        try {
            // Ensure all document IDs are numbers (same validation as removeDocumentArray)
            debug(`#deleteDocumentArrayFromDb: Converting document IDs to numbers`);
            const numericDocumentIdArray = documentIdArray.map((id, index) => {
                const numId = parseInt(id, 10);
                if (isNaN(numId)) {
                    debug(`#deleteDocumentArrayFromDb: Invalid document ID at index ${index} - original: ${id}, parsed: ${numId}`);
                    throw new Error(`Invalid document ID: ${id}. Must be a number or a string coercible to a number.`);
                }
                return numId;
            });
            debug(`#deleteDocumentArrayFromDb: Document ID conversion successful - using: ${JSON.stringify(numericDocumentIdArray)}`);
            debug(`#deleteDocumentArrayFromDb: Context pathArray: ${JSON.stringify(this.#pathArray)}`);

            // Completely delete the documents from the database, respecting the context
            debug(`#deleteDocumentArrayFromDb: Calling db.deleteDocumentArray with documentIds: ${JSON.stringify(numericDocumentIdArray)}, pathArray: ${JSON.stringify(this.#pathArray)}, options: ${JSON.stringify(options)}`);
            const result = this.#db.deleteDocumentArray(numericDocumentIdArray, this.#pathArray, options);
            debug(`#deleteDocumentArrayFromDb: Database deletion successful, result: ${JSON.stringify(result)}`);

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
            debug(`#deleteDocumentArrayFromDb: Prepared event payload: ${JSON.stringify(documentEventPayload)}`);

            debug(`#deleteDocumentArrayFromDb: Emitting document.deleted.batch event`);
            this.emit('document.deleted.batch', documentEventPayload);

            debug(`#deleteDocumentArrayFromDb: Successfully completed deletion of ${numericDocumentIdArray.length} documents`);
            return result;
        } catch (error) {
            debug(`#deleteDocumentArrayFromDb: Error during deletion process: ${error.message}`);
            debug(`#deleteDocumentArrayFromDb: Error stack: ${error.stack}`);
            throw error;
        }
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
            workspaceName: this.#workspace?.name,
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

        debug(`Setting up workspace event forwarding for context "${this.#id}" (wild-card mode)`);

        // Wild-card listener – forwards every workspace event
        const handler = (eventName, payload) => {
            const enriched = {
                contextId: this.#id,
                contextUrl: this.#url,
                contextPath: this.#path,
                contextPathArray: this.#pathArray,
                userId: this.#userId,
                ...payload
            };

            this.emit(`context.workspace.${eventName}`, enriched);

            // If the workspace event is a document CRUD operation, re-emit it as a direct context event
            if (eventName.startsWith('document.')) {
                // Forward the same document.* event at context level
                this.emit(eventName, {
                    contextId: this.#id,
                    ...enriched
                });

                // Emit an umbrella context.updated so consumers can do cheap cache invalidation
                this.emit('context.updated', {
                    id: this.#id,
                    operation: eventName,
                    documentId: enriched.documentId || enriched.documentIds,
                    contextArray: this.#contextBitmapArray,
                    featureArray: enriched.featureArray || []
                });
            }
        };

        this.#workspaceEventHandlers = handler;
        this.#workspace.onAny(handler);
    }

    /**
     * Clean up workspace event forwarding
     * @private
     */
    #cleanupWorkspaceEventForwarding() {
        if (this.#workspace && this.#workspaceEventHandlers) {
            this.#workspace.offAny(this.#workspaceEventHandlers);
            this.#workspaceEventHandlers = null;
            debug(`Workspace event forwarding cleanup completed for context "${this.#id}"`);
        }
    }
}

export default Context;
