'use strict';

import EventEmitter from 'eventemitter2';
import { v4 as uuidv4 } from 'uuid';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('context');

import Url from './Url.js';

/**
 * Context
 *
 * Represents a view on top of data, holding references to workspace, session, device, etc.
 */
class Context extends EventEmitter {

    #id;
    #url;
    #parsedUrl;
    #path;
    #session;
    #workspace;
    #device;
    #user;
    #filters = new Map();
    #layers = new Map();
    #contextBitmapArray = [];
    #data = new Map();
    #canvases = new Map();
    #created;
    #updated;
    #initialized = false;
    #tree;
    #workspaceManager;
    #workspaceId;
    #sessionInfo;

    constructor(options) {
        super();

        this.#id = options.id || uuidv4();
        this.#parsedUrl = new Url(options.url);
        this.#url = options.url;
        this.#path = options.path || '/';
        this.#sessionInfo = options.sessionInfo || {};

        this.#workspace = options.workspace;
        this.#device = options.device;
        this.#user = options.user;

        this.#workspaceId = options.workspaceId;

        this.#created = options.created || new Date().toISOString();
        this.#updated = options.updated || new Date().toISOString();

        this.#workspaceManager = options.workspaceManager;

        debug(`Context created: ${this.#id} (${options.url})`);
    }

    async initialize() {
        if (this.#initialized) {
            return;
        }

        debug(`Initializing context: ${this.#id}`);

        // If URL doesn't have a workspace ID but we have a workspace, update the URL
        if (!this.#parsedUrl.hasWorkspaceId && this.#workspace) {
            debug(`URL doesn't have a workspace ID, using current workspace: ${this.#workspace.id}`);

            // If URL also has a session ID, create a full URL
            if (this.#parsedUrl.hasSessionId && this.#session) {
                this.#parsedUrl = this.#parsedUrl.withSessionAndWorkspace(
                    this.#session.id,
                    this.#workspace.id,
                );
            } else {
                // Otherwise, create a workspace URL
                this.#parsedUrl = this.#parsedUrl.withWorkspaceId(this.#workspace.id);
            }

            // Update the raw URL
            this.#url = this.#parsedUrl.toString();
            debug(`Updated URL to: ${this.#url}`);
        }

        // Get the tree from the workspace
        if (this.#workspace) {
            this.#tree = await this.#workspace.getTree();
            debug(`Got tree from workspace: ${this.#workspace.id}`);
        }

        // Initialize layers from the path
        await this.#initializeLayers();

        this.#initialized = true;

        return this;
    }

    /**
     * Initialize layers from the path
     */
    async #initializeLayers() {
        if (!this.#workspace) {
            debug('No workspace available to initialize layers');
            return;
        }

        const path = this.#path;
        debug(`Initializing layers from path: ${path}`);

        try {
            // Get the tree from the workspace
            if (!this.#tree) {
                this.#tree = this.#workspace.getTree();
                if (!this.#tree) {
                    debug('No tree available in workspace');
                    throw new Error('Tree not available');
                }
            }

            // Use the tree's insert method to create the path if needed
            // This will create any missing layers along the path
            const success = this.#tree.insert(path);
            if (!success) {
                debug('Failed to insert path into tree');
                throw new Error('Failed to insert path into tree');
            }

            // Clear existing layers and context bitmap array
            this.#layers.clear();
            this.#contextBitmapArray = [];

            // Get all nodes from root to the target path
            const pathParts = ['/', ...path.split('/').filter(Boolean)];
            const uniquePaths = [...new Set(pathParts.map((_, i, arr) =>
                i === 0 ? '/' : '/' + arr.slice(1, i + 1).join('/')
            ))];

            // Add each layer in the path to our context
            for (const currentPath of uniquePaths) {
                const node = this.#tree.getNode(currentPath);
                if (node && node.payload) {
                    const layer = node.payload;
                    this.#layers.set(currentPath, layer);
                    this.#contextBitmapArray.push(`context/${layer.id}`);
                    debug(`Added layer from tree: ${currentPath} (${layer.id})`);
                }
            }

            debug(`Context initialized with ${this.#contextBitmapArray.length} layers`);
        } catch (err) {
            debug(`Error initializing layers from path: ${err.message}`);
            // Fallback to manual layer creation if tree method fails
            await this.#createLayersManually();
        }
    }

    /**
     * Create layers manually from the path (fallback method)
     */
    async #createLayersManually() {
        const path = this.#parsedUrl.path;
        const pathParts = path.split('/').filter(part => part.length > 0);

        debug(`Creating layers manually from path parts: ${pathParts.join(', ')}`);

        // Add each path part as a layer
        for (const part of pathParts) {
            await this.addLayer(part);
        }
    }

    /**
     * Add a layer to the context
     * @param {string} name - Layer name
     * @param {Object} options - Layer options
     * @returns {Promise<Object>} - Added layer
     */
    async addLayer(name, options = {}) {
        if (!name || typeof name !== 'string') {
            throw new Error('Layer name must be a string');
        }

        // Check if layer already exists
        if (this.#layers.has(name)) {
            return this.#layers.get(name);
        }

        // Try to get layer from workspace tree if available
        let layer = null;
        if (this.#tree) {
            try {
                layer = await this.#tree.getLayer(name);
                debug(`Got layer from tree: ${name}`);
            } catch (err) {
                debug(`Could not get layer from tree: ${err.message}`);
            }
        }

        // Create layer if not found in tree
        if (!layer) {
            layer = {
                id: options.id || uuidv4(),
                name,
                type: options.type || 'generic',
                filters: options.filters || [],
                data: options.data || {},
                created: options.created || new Date().toISOString(),
                updated: options.updated || new Date().toISOString(),
            };
            debug(`Created new layer: ${name}`);
        }

        // Add layer to context
        this.#layers.set(name, layer);

        // Update context
        this.#updated = new Date().toISOString();

        this.emit('layer:added', layer);

        return layer;
    }

    /**
     * Remove a layer from the context
     * @param {string} name - Layer name
     * @returns {boolean} - True if layer was removed
     */
    removeLayer(name) {
        const result = this.#layers.delete(name);

        if (result) {
            // Update context
            this.#updated = new Date().toISOString();

            this.emit('layer:removed', name);
        }

        return result;
    }

    /**
     * Get a layer by name
     * @param {string} name - Layer name
     * @returns {Object} - Layer object
     */
    getLayer(name) {
        return this.#layers.get(name);
    }

    /**
     * List all layers
     * @returns {Array<Object>} - Array of layer objects
     */
    listLayers() {
        return Array.from(this.#layers.values());
    }

    /**
     * Add a filter to the context
     * @param {string} name - Filter name
     * @param {Object} options - Filter options
     * @returns {Object} - Added filter
     */
    addFilter(name, options = {}) {
        if (!name || typeof name !== 'string') {
            throw new Error('Filter name must be a string');
        }

        // Create filter
        const filter = {
            id: options.id || uuidv4(),
            name,
            type: options.type || 'generic',
            value: options.value,
            created: options.created || new Date().toISOString(),
            updated: options.updated || new Date().toISOString(),
        };

        // Add filter to context
        this.#filters.set(name, filter);

        // Update context
        this.#updated = new Date().toISOString();

        this.emit('filter:added', filter);

        return filter;
    }

    /**
     * Remove a filter from the context
     * @param {string} name - Filter name
     * @returns {boolean} - True if filter was removed
     */
    removeFilter(name) {
        const result = this.#filters.delete(name);

        if (result) {
            // Update context
            this.#updated = new Date().toISOString();

            this.emit('filter:removed', name);
        }

        return result;
    }

    /**
     * Get a filter by name
     * @param {string} name - Filter name
     * @returns {Object} - Filter object
     */
    getFilter(name) {
        return this.#filters.get(name);
    }

    /**
     * List all filters
     * @returns {Array<Object>} - Array of filter objects
     */
    listFilters() {
        return Array.from(this.#filters.values());
    }

    /**
     * Get the context URL
     * @returns {String} Context URL in the format workspaceID://path
     */
    get url() {
        return `${this.#workspaceId}://${this.#path}`;
    }

    /**
     * Get the parsed URL
     * @returns {Url} - Parsed URL
     */
    get parsedUrl() {
        return this.#parsedUrl;
    }

    /**
     * Get the workspace
     * @returns {Workspace} - Workspace
     */
    get workspace() {
        return this.#workspace;
    }

    /**
     * Get the session
     * @returns {Session} - Session
     */
    get session() {
        return this.#session;
    }

    /**
     * Get the session information associated with this context
     * @returns {Object} Session information
     */
    get sessionInfo() {
        return this.#sessionInfo;
    }

    /**
     * Switch to a different workspace while maintaining the same context path
     * @param {Workspace} workspace - New workspace
     * @returns {Promise<Context>} - Updated context
     */
    async switchWorkspace(workspace) {
        if (!workspace) {
            throw new Error('Workspace is required');
        }

        debug(`Switching context ${this.#id} from workspace ${this.#workspace?.id} to ${workspace.id}`);

        // Store the current path
        const contextPath = this.#parsedUrl.path;
        this.#path = contextPath; // Ensure path property is updated

        // Ensure the workspace is open
        const workspaceManager = global.app.getManager('workspace');
        if (!workspaceManager) {
            throw new Error('Workspace manager not available');
        }

        // Make sure the workspace is open
        if (!workspaceManager.isOpen(workspace.name)) {
            debug(`Opening workspace ${workspace.name} before switching context`);
            await workspaceManager.open(workspace.name);
        }

        // Update the workspace reference
        this.#workspace = workspace;

        // Update the URL with the new workspace ID
        if (this.#parsedUrl.hasSessionId) {
            this.#parsedUrl = this.#parsedUrl.withSessionAndWorkspace(
                this.#session.id,
                workspace.id
            );
        } else {
            this.#parsedUrl = this.#parsedUrl.withWorkspaceId(workspace.id);
        }

        // Update the raw URL
        this.#url = this.#parsedUrl.toString();
        debug(`Updated URL to: ${this.#url}`);

        // Reset initialization state
        this.#initialized = false;

        // Clear existing layers
        this.#layers.clear();
        this.#contextBitmapArray = []; // Clear context bitmap array

        // Re-initialize with the new workspace
        await this.initialize();

        // Emit an event for the workspace change
        this.emit('workspace:changed', {
            contextId: this.#id,
            workspaceId: workspace.id,
            path: contextPath,
            url: this.#url
        });

        return this;
    }

    /**
     * Set a new URL for this context
     * Handles various URL formats:
     * - sessionID@workspaceID://path (full URL)
     * - workspaceID://path (workspace-specific URL)
     * - /path (absolute path in current workspace)
     * - path/ (relative path appended to current path)
     *
     * @param {string} url - New URL
     * @returns {Promise<Context>} - Updated context
     */
    async setUrl(url) {
        debug(`Setting new URL for context ${this.#id}: ${url}`);

        let newUrl = url;
        let newParsedUrl;

        // Handle different URL formats
        if (url.includes('://')) {
            // Full URL or workspace-specific URL
            newParsedUrl = new Url(url);
        } else if (url.startsWith('/')) {
            // Absolute path in current workspace
            if (this.#parsedUrl.hasSessionId && this.#parsedUrl.hasWorkspaceId) {
                newUrl = `${this.#session.id}@${this.#workspace.id}://${url.replace(/^\//, '')}`;
            } else if (this.#parsedUrl.hasWorkspaceId) {
                newUrl = `${this.#workspace.id}://${url.replace(/^\//, '')}`;
            } else {
                // If we don't have a workspace ID, just use the path
                newUrl = url;
            }
            newParsedUrl = new Url(newUrl);
        } else {
            // Relative path to be appended to current path
            const currentPath = this.#parsedUrl.path || '/';
            const newPath = currentPath.endsWith('/')
                ? `${currentPath}${url}`
                : `${currentPath}/${url}`;

            if (this.#parsedUrl.hasSessionId && this.#parsedUrl.hasWorkspaceId) {
                newUrl = `${this.#session.id}@${this.#workspace.id}://${newPath.replace(/^\//, '')}`;
            } else if (this.#parsedUrl.hasWorkspaceId) {
                newUrl = `${this.#workspace.id}://${newPath.replace(/^\//, '')}`;
            } else {
                newUrl = newPath;
            }
            newParsedUrl = new Url(newUrl);
        }

        debug(`Processed URL: ${newUrl}`);

        // If the new URL has a different workspace ID, we need to switch workspaces
        if (newParsedUrl.hasWorkspaceId &&
            this.#parsedUrl.hasWorkspaceId &&
            newParsedUrl.workspaceId !== this.#parsedUrl.workspaceId) {

            if (!this.#workspaceManager) {
                throw new Error('Workspace manager is required to switch workspaces');
            }

            // Get the new workspace
            const newWorkspace = await this.#workspaceManager.getWorkspace(newParsedUrl.workspaceId);

            // Switch to the new workspace
            return this.switchWorkspace(newWorkspace);
        }

        // Update the URL and parsed URL
        this.#url = newUrl;
        this.#parsedUrl = newParsedUrl;
        this.#path = newParsedUrl.path;

        // Reset initialization state
        this.#initialized = false;

        // Clear existing layers
        this.#layers.clear();

        // Re-initialize with the new URL
        await this.initialize();

        // Emit an event for the URL change
        this.emit('url:changed', {
            contextId: this.#id,
            url: this.#url,
            path: this.#path
        });

        return this;
    }

    /**
     * Create a canvas
     * @param {string} name - Canvas name
     * @param {Object} options - Canvas options
     * @returns {Object} - Created canvas
     */
    createCanvas(name, options = {}) {
        if (!name || typeof name !== 'string') {
            throw new Error('Canvas name must be a string');
        }

        // Check if canvas already exists
        if (this.#canvases.has(name)) {
            throw new Error(`Canvas with name "${name}" already exists`);
        }

        // Create canvas
        const canvas = {
            id: options.id || uuidv4(),
            name,
            type: options.type || 'generic',
            elements: options.elements || [],
            data: options.data || {},
            created: options.created || new Date().toISOString(),
            updated: options.updated || new Date().toISOString(),
        };

        // Add canvas to context
        this.#canvases.set(name, canvas);

        // Update context
        this.#updated = new Date().toISOString();

        this.emit('canvas:created', canvas);

        return canvas;
    }

    /**
     * Get a canvas by name
     * @param {string} name - Canvas name
     * @returns {Object} - Canvas object
     */
    getCanvas(name) {
        return this.#canvases.get(name);
    }

    /**
     * List all canvases
     * @returns {Array<Object>} - Array of canvas objects
     */
    listCanvases() {
        return Array.from(this.#canvases.values());
    }

    /**
     * Remove a canvas
     * @param {string} name - Canvas name
     * @returns {boolean} - True if canvas was removed
     */
    removeCanvas(name) {
        const result = this.#canvases.delete(name);

        if (result) {
            // Update context
            this.#updated = new Date().toISOString();

            this.emit('canvas:removed', name);
        }

        return result;
    }

    /**
     * Destroy the context
     * @returns {Promise<boolean>} - True if context was destroyed
     */
    async destroy() {
        debug(`Destroying context: ${this.#id}`);

        // Clear all maps
        this.#filters.clear();
        this.#layers.clear();
        this.#data.clear();
        this.#canvases.clear();

        this.emit('destroyed', this.#id);

        return true;
    }

    // Getters
    get id() { return this.#id; }
    get device() { return this.#device; }
    get user() { return this.#user; }
    get created() { return this.#created; }
    get updated() { return this.#updated; }
    get tree() { return this.#tree; }

    toJSON() {
        return {
            id: this.#id,
            url: this.#url,
            sessionId: this.#session?.id,
            workspaceId: this.#workspace?.id,
            deviceId: this.#device?.id,
            userId: this.#user?.id,
            layers: Array.from(this.#layers.values()),
            filters: Array.from(this.#filters.values()),
            canvases: Array.from(this.#canvases.values()),
            created: this.#created,
            updated: this.#updated,
        };
    }

    /**
     * List documents in the context
     * @param {Array<string>} featureArray - Array of features to filter by
     * @param {Array<string>} filterArray - Array of filters to apply
     * @param {Object} options - Options for listing documents
     * @returns {Promise<Array<Object>>} - Array of documents
     */
    async listDocuments(featureArray = [], filterArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        try {
            const contextLayers = await this.listLayers();
            if (!contextLayers || !contextLayers.length) {
                throw new Error('No context layers found');
            }

            // Convert context layers to array of UUIDs
            const contextArray = contextLayers.map(layer => `context/${layer.uuid}`);

            // Ensure feature array has proper prefixes
            const formattedFeatureArray = featureArray.map(feature =>
                feature.startsWith('tag/') ? feature : `tag/${feature}`
            );

            debug(`Listing documents in context "${this.url}" with ${contextArray.length} layers, ${formattedFeatureArray.length} features, and ${filterArray.length} filters`);

            // Call SynapsD listDocuments method
            const documents = await this.#workspace.db.listDocuments(
                contextArray,
                formattedFeatureArray,
                filterArray,
                options
            );

            debug(`Found ${documents.length} documents in context "${this.url}"`);
            return documents;
        } catch (error) {
            console.error('Error listing documents:', error);
            return [];
        }
    }

    /**
     * Get a document by ID
     * @param {string} documentId - Document ID
     * @returns {Promise<Object|null>} - Document object or null if not found
     */
    async getDocument(documentId) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!documentId) {
            throw new Error('Document ID is required');
        }

        try {
            debug(`Getting document "${documentId}" in context "${this.url}"`);
            const document = await this.#workspace.db.getDocument(documentId);
            return document;
        } catch (error) {
            console.error(`Error getting document "${documentId}":`, error);
            return null;
        }
    }

    /**
     * Insert documents into the context
     * @param {Array<Object>} documents - Array of document objects to insert
     * @param {Array<string>} featureArray - Array of features to associate with the documents
     * @param {Object} options - Options for inserting documents
     * @returns {Promise<Array<Object>>} - Array of inserted documents with IDs
     */
    async insertDocuments(documents, featureArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documents) || documents.length === 0) {
            throw new Error('Documents array is required and must not be empty');
        }

        try {
            const contextLayers = await this.listLayers();
            if (!contextLayers || !contextLayers.length) {
                throw new Error('No context layers found');
            }

            // Convert context layers to array of UUIDs
            const contextArray = contextLayers.map(layer => `context/${layer.uuid}`);

            // Ensure feature array has proper prefixes
            const formattedFeatureArray = featureArray.map(feature =>
                feature.startsWith('tag/') ? feature : `tag/${feature}`
            );

            debug(`Inserting ${documents.length} documents into context "${this.url}" with ${contextArray.length} layers and ${formattedFeatureArray.length} features`);

            // Create any features that don't exist yet
            for (const feature of formattedFeatureArray) {
                const featureName = feature.replace('tag/', '');
                await this.addFeature(featureName);
            }

            // Call SynapsD insertDocuments method
            const insertedDocs = [];
            for (const doc of documents) {
                const insertedDoc = await this.#workspace.db.insertDocument(
                    doc,
                    contextArray,
                    formattedFeatureArray,
                    options
                );
                insertedDocs.push(insertedDoc);
            }

            debug(`Inserted ${insertedDocs.length} documents into context "${this.url}"`);
            return insertedDocs;
        } catch (error) {
            console.error('Error inserting documents:', error);
            throw error;
        }
    }

    /**
     * Update documents in the context
     * @param {Array<Object>} documents - Array of document objects to update
     * @param {Array<string>} featureArray - Array of features to associate with the documents
     * @param {Object} options - Options for updating documents
     * @returns {Promise<Array<Object>>} - Array of updated documents
     */
    async updateDocuments(documents, featureArray = [], options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documents) || documents.length === 0) {
            throw new Error('Documents array is required and must not be empty');
        }

        try {
            const contextLayers = await this.listLayers();
            if (!contextLayers || !contextLayers.length) {
                throw new Error('No context layers found');
            }

            // Convert context layers to array of UUIDs
            const contextArray = contextLayers.map(layer => `context/${layer.uuid}`);

            // Ensure feature array has proper prefixes
            const formattedFeatureArray = featureArray.map(feature =>
                feature.startsWith('tag/') ? feature : `tag/${feature}`
            );

            debug(`Updating ${documents.length} documents in context "${this.url}" with ${contextArray.length} layers and ${formattedFeatureArray.length} features`);

            // Create any features that don't exist yet
            for (const feature of formattedFeatureArray) {
                const featureName = feature.replace('tag/', '');
                await this.addFeature(featureName);
            }

            // Call SynapsD updateDocuments method
            const updatedDocs = [];
            for (const doc of documents) {
                const updatedDoc = await this.#workspace.db.updateDocument(
                    doc,
                    contextArray,
                    formattedFeatureArray,
                    options
                );
                updatedDocs.push(updatedDoc);
            }

            debug(`Updated ${updatedDocs.length} documents in context "${this.url}"`);
            return updatedDocs;
        } catch (error) {
            console.error('Error updating documents:', error);
            throw error;
        }
    }

    /**
     * Delete documents from the context
     * @param {Array<string>} documentIds - Array of document IDs to delete
     * @param {Object} options - Options for deleting documents
     * @returns {Promise<boolean>} - Success status
     */
    async deleteDocuments(documentIds, options = {}) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!Array.isArray(documentIds) || documentIds.length === 0) {
            throw new Error('Document IDs array is required and must not be empty');
        }

        try {
            debug(`Deleting ${documentIds.length} documents from context "${this.url}"`);

            // Call SynapsD deleteDocument method for each document
            for (const docId of documentIds) {
                await this.#workspace.db.deleteDocument(docId);
            }

            debug(`Deleted ${documentIds.length} documents from context "${this.url}"`);
            return true;
        } catch (error) {
            console.error('Error deleting documents:', error);
            return false;
        }
    }

    /**
     * Add a feature to the context
     * @param {string} feature - Feature name
     * @returns {Promise<boolean>} - Success status
     */
    async addFeature(feature) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        try {
            const contextLayers = await this.listLayers();
            if (!contextLayers || !contextLayers.length) {
                throw new Error('No context layers found');
            }

            // Check if bitmap exists
            // Use 'tag/' prefix instead of 'feature/' to comply with allowed prefixes
            const bitmapKey = `tag/${feature}`;

            // Use the correct property path to access bitmap methods
            const bitmapExists = this.#workspace.db.bitmapIndex.hasBitmap(bitmapKey);

            if (!bitmapExists) {
                debug(`Creating bitmap for feature "${feature}"`);
                await this.#workspace.db.createBitmap(bitmapKey);
            }

            debug(`Added feature "${feature}" to context "${this.url}"`);
            return true;
        } catch (error) {
            console.error(`Error adding feature "${feature}" to context:`, error);
            return false;
        }
    }

    /**
     * Remove a feature from the context
     * @param {string} featurePath - Feature path
     * @returns {Promise<boolean>} - Success status
     */
    async removeFeature(featurePath) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        debug(`Removing feature ${featurePath} from context ${this.id}`);

        // Get layer UUIDs for the current context path
        const contextLayers = await this.listLayers();
        const contextArray = contextLayers.map(layer => layer.id);

        try {
            await this.#workspace.db.removeFeature(featurePath, contextArray);
            debug(`Removed feature ${featurePath}`);
            return true;
        } catch (error) {
            debug(`Error removing feature: ${error.message}`);
            throw new Error(`Failed to remove feature: ${error.message}`);
        }
    }

    /**
     * Tick a feature for a document in the context
     * @param {string} feature - Feature name
     * @param {string} documentId - Document ID
     * @returns {Promise<boolean>} - Success status
     */
    async tickFeature(feature, documentId) {
        if (!this.#workspace || !this.#workspace.db) {
            throw new Error('Workspace or database not available');
        }

        if (!feature || !documentId) {
            throw new Error('Feature name and document ID are required');
        }

        try {
            const contextLayers = await this.listLayers();
            if (!contextLayers || !contextLayers.length) {
                throw new Error('No context layers found');
            }

            // Check if bitmap exists, create if not
            // Use 'tag/' prefix instead of 'feature/' to comply with allowed prefixes
            const bitmapKey = `tag/${feature}`;

            // Use the correct property path to access bitmap methods
            const bitmapExists = this.#workspace.db.bitmapIndex.hasBitmap(bitmapKey);

            if (!bitmapExists) {
                debug(`Creating bitmap for feature "${feature}"`);
                await this.#workspace.db.createBitmap(bitmapKey);
            }

            // Tick the feature for the document
            debug(`Ticking feature "${feature}" for document "${documentId}"`);
            await this.#workspace.db.bitmapIndex.tickSync(bitmapKey, documentId);

            // Also tick for all context layers
            for (const layer of contextLayers) {
                const contextBitmapKey = `context/${layer.id}`;
                const layerBitmapExists = this.#workspace.db.bitmapIndex.hasBitmap(contextBitmapKey);

                if (!layerBitmapExists) {
                    debug(`Creating bitmap for context layer "${layer.name}"`);
                    await this.#workspace.db.createBitmap(contextBitmapKey);
                }

                await this.#workspace.db.bitmapIndex.tickSync(contextBitmapKey, documentId);
            }

            return true;
        } catch (error) {
            console.error(`Error ticking feature "${feature}" for document "${documentId}":`, error);
            return false;
        }
    }

    /**
     * List all features in the context
     * @returns {Promise<Array<string>>} - Array of feature names
     */
    async listFeatures() {
        try {
            // Get all bitmaps with prefix 'tag/' instead of 'feature/'
            const bitmaps = await this.#workspace.db.listBitmaps();

            // Extract feature names from bitmap keys
            const features = bitmaps
                .filter(key => key.startsWith('tag/'))
                .map(key => key.replace('tag/', ''));

            debug(`Found ${features.length} features in context "${this.url}"`);
            return features;
        } catch (error) {
            console.error('Error listing features:', error);
            return [];
        }
    }

    /**
     * Update a document in the context
     * @param {number} documentId - The ID of the document to update
     * @param {Object} newData - The new data for the document
     * @param {Array<string>} features - Optional array of features to associate with the document
     * @returns {Promise<Object>} - The updated document
     */
    async updateDocument(documentId, newData, features = []) {
        // Initialize logger if it doesn't exist
        if (!this.logger) {
            this.logger = {
                debug: console.log,
                info: console.log,
                warn: console.warn,
                error: console.error
            };
        }

        this.logger.debug(`Updating document "${documentId}" in context "${this.url}"`);

        try {
            // 1. Get the existing document
            const existingDoc = await this.getDocument(documentId);
            if (!existingDoc) {
                throw new Error(`Document with ID ${documentId} not found`);
            }

            // 2. Get the schema for the document
            const Schema = this.workspace.db.getSchema(existingDoc.schema);
            if (!Schema) {
                throw new Error(`Schema ${existingDoc.schema} not found`);
            }

            // 3. Delete the existing document
            await this.deleteDocuments([documentId]);

            // 4. Create a new document with the same schema and ID
            const updatedDoc = new Schema({
                ...existingDoc.data,
                ...newData
            });

            // 5. Copy the ID from the original document
            updatedDoc.id = documentId;

            // 6. Insert the updated document with the specified features
            // Merge existing features with new features if needed
            const existingFeatures = await this.getDocumentFeatures(documentId);
            const allFeatures = [...new Set([...existingFeatures, ...features])];

            const [insertedDoc] = await this.insertDocuments([updatedDoc], allFeatures);
            return insertedDoc;
        } catch (error) {
            this.logger.error(`Error updating document ${documentId} in context ${this.url}:`, error);
            throw error;
        }
    }

}

export default Context;
