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
    #isLocked = false;    #

    constructor(options) {
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

        debug(`Context created: ${this.#id} (${options.url})`);
    }

    // Getters
    get id() { return this.#id; }
    get name() { return this.#name; }

    get baseUrl() { return this.#baseUrl; }
    get url() { return this.#url; }
    get urlPath() { return this.#urlPath; }

    get workspace() { return this.#workspace.id; }
    get device() { return this.#device; }
    get app() { return this.#device.app; }
    get user() { return this.#user; }
    get identity() { return this.#user.identity; }
    get tree() { return this.#workspace.tree.toJSON(); } // Legacy


    /**
     * New API
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
