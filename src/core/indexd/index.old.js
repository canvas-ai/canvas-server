// Utils
const debug = require('debug')('canvas:db');
const EventEmitter = require('eventemitter2');

// Use the lmdb backend
const Db = require('../db/index.js').lmdb;

// App includes
const Index = require('./index/index.js');

// Schemas
const documentSchemas = require('./schemas/registry.js');

// Constants
const INTERNAL_BITMAP_ID_MIN = 1000;
const INTERNAL_BITMAP_ID_MAX = 1000000;


/**
 * Canvas document database
 */

class SynapsDB extends EventEmitter {

    #db;

    constructor(
        options = {
            backupOnOpen: false,
            backupOnClose: false,
            compression: true,
            eventEmitter: {},
        },
    ) {
        // Event emitter
        super(options.eventEmitter);

        // Initialize database backend
        if (!options.path) {throw new Error('Database path required');}
        this.#db = new Db(options);

        // Initialize internal datasets
        this.index = new Index({
            db: this.#db.createDataset('index'),
            eventEmitter: options.eventEmitter,
        });

        // Initialize documents dataset
        this.documents = this.#db.createDataset('documents');

        // Initialize dataset cache
        this.datasets = new Map();
    }


    /**
     * Generic search / query interface
     */

    // Search documents based on document fields
    async search(
        query,
        contextArray,
        featureArray,
        filterArray,
        returnMetaOnly = false,
    ) { debug('search() not implemented yet!'); return false; }

    // Find documents based on query
    async find(
        query,
        contextArray,
        featureArray,
        filterArray,
        returnMetaOnly = false,
    ) { debug('find() not implemented yet!'); return false; }


    /**
     * Document interface
     */

    // Legacy methods
    getDocument(id) { return this.getDocumentById(id); }
    hasDocument(id) {
        debug(`hasDocument(): ID: ${id}`);
        if (!id) {throw new Error('Document ID required');}
        return this.documents.has(id);
    }

    getDocumentById(id) {   // TODO: add metadataOnly support for all get methods?
        debug(`getDocumentById(): ID: ${id}`);
        if (!id) {throw new Error('Document ID required');}
        return this.documents.get(id);
    }

    getDocumentByHash(hash) {
        debug(`getDocumentByHash(): Hash: "${hash}"`);
        if (!hash) {throw new Error('Document hash required');}
        if (typeof hash !== 'string') {throw new Error('Document hash has to be a string of formant algo/hash');}
        let id = this.index.hash2oid.get(hash);
        if (!id) {
            debug(`Document not found for hash: "${hash}"`);
            return null;
        }
        return this.documents.get(id); // TODO: Assumption is that the document is always found when a hash is found (..)
    }

    async getDocuments(contextArray = [], featureArray = [], filterArray = [], metadataOnly = false) {
        debug(`getDocuments(): ContextArray: "${contextArray}"; FeatureArray: "${featureArray}", MetaOnly: ${metadataOnly}`);

        try {
            // Calculate document IDs based on supplied bitmaps
            // TODO: Move entirely to index
            const [contextBitmap, featureBitmap] = await Promise.all([
                contextArray.length ? this.index.contextArrayAND(contextArray) : null,
                featureArray.length ? this.index.featureArrayAND(featureArray) : null,
            ]);

            let bitmaps = [];
            if (contextBitmap) {bitmaps.push(contextBitmap);}
            if (featureBitmap) {bitmaps.push(featureBitmap);}

            let result = [];
            if (bitmaps.length) {
                result = this.index.bitmapAND(bitmaps, true);
            } else {
                debug('No bitmaps specified, returning all documents from your universe');
                result = await this.documents.listKeys();
            }

            debug('Result IDs', result);
            if (!result.length) {
                debug('No documents found, returning an empty array');
                return [];
            }

            // Retrieve documents by IDs
            let documents = await this.documents.getMany(result);
            debug('Documents found', documents.length);

            if (metadataOnly) {
                debug('Returning metadata only');
                documents = documents.map(doc => {
                    doc.index = null;
                    doc.data = null; //{ metadataOnly: "true" };
                    return doc;
                });
            }

            return documents;
        } catch (error) {
            debug('Error retrieving documents:', error.message);
            throw error;
        }
    }


    async getDocumentsByIdArray(idArray, metadataOnly = false) {
        debug(`getDocumentsByIdArray(): IDArray: "${idArray}", MetaOnly: ${metadataOnly}`);
        if (!Array.isArray(idArray) || idArray.length < 1) {
            throw new Error('Array of document IDs required');
        }

        try {
            let documents = await this.documents.getMany(idArray);
            if (metadataOnly) {
                documents = documents.map(doc => {
                    doc.data = null; //{ metadataOnly: "true" };
                    return doc;
                });
            }
            debug('Documents found', documents.length);
            return documents;
        } catch (error) {
            console.error('Failed to retrieve documents:', error);
            throw new Error('Error retrieving documents by ID array');
        }
    }


    async getDocumentsByHashArray(hashArray, metadataOnly = false) {
        debug(`getDocumentsByHashArray(): HashArray: "${hashArray}"; MetaOnly: ${metadataOnly}`);
        if (!Array.isArray(hashArray) || hashArray.length < 1) {
            throw new Error('Array of document hashes required');
        }

        const idArray = hashArray
            .map(hash => this.index.hash2oid.get(hash))
            .filter(id => id !== undefined);

        return this.getDocumentsByIdArray(idArray, metadataOnly);
    }

    // TODO: Refactor to use getDocuments() only, legacy method
    async listDocuments(contextArray = [], featureArray = [], filterArray = []) {
        debug('listDocuments(): -> getDocuments() with MetaOnly: true');
        return this.getDocuments(contextArray, featureArray, filterArray, true);
    }


    /**
     * Inserts a document into the database.
     *
     * @param {Object} document - The document to be inserted.
     * @param {Array} [contextArray=[]] - An array of context values.
     * @param {Array} [featureArray=[]] - An array of feature values.
     * @param {Array} [filterArray=[]] - An array of filter values.
     * @returns {string} - The ID of the inserted document.
     * @throws {Error} - If the document is invalid or if there is an error inserting it into the database.
     */
    async insertDocument(document, contextArray = [], featureArray = []) {
        debug(`insertDocument(): ContextArray: "${contextArray}"; FeatureArray: "${featureArray}"`);

        // Parse document
        let parsed = await this.#parseDocument(document);
        if (!parsed) {throw new Error('Failed to parse document');}

        // Check if document already exists based on its checksum
        if (this.index.hash2oid.has(parsed.meta.checksum)) {
            let existingDocument = this.getDocumentByHash(parsed.meta.checksum);
            debug(`Document hash "${parsed.meta.checksum}" already found in the database, updating exiting record: "${existingDocument.meta.checksum}/${existingDocument.id}"`);
            parsed.id = existingDocument.id; // TODO: Rework + move to updateDocument()
        }

        if (!parsed.id) {
            debug('Generating document ID');
            parsed.id = await this.#genDocumentID();
        }

        // TODO: Move updates to updateDocument()
        try {
            debug(`Inserting document into the database index: ${parsed.meta.checksum} -> ${parsed.id}`);
            await this.index.hash2oid.db.put(parsed.meta.checksum, parsed.id);
            debug(`Inserting document into the database: ${JSON.stringify(parsed, null, 2)}`);
            await this.documents.put(parsed.id, parsed);
        } catch (error) {
            console.error(`Error inserting document into the database: ${error.message}`);
            throw new Error(`Error inserting document into the database: ${error.message}`);
        }

        // Extract document features (to-be-moved to parseDocument() method)
        const documentFeatures = this.#extractDocumentFeatures(parsed);
        const combinedFeatureArray = [...featureArray, ...documentFeatures];
        debug(`Document features: ${combinedFeatureArray.join(', ')}`);

        // Update bitmaps
        // By default we leave the old bitmaps in place, moving documents between contexts
        // and adding/removing features should be handled via the respective methods
        // Maybe we should add a flag to remove old bitmaps
        // TODO: Refactor
        if (Array.isArray(contextArray) && contextArray.length > 0) {
            await this.index.updateContextBitmaps(contextArray, parsed.id);
        }

        // TODO: Refactor
        if (Array.isArray(combinedFeatureArray) && combinedFeatureArray.length > 0) {
            await this.index.updateFeatureBitmaps(combinedFeatureArray, parsed.id);
        }

        debug(`Document inserted under ID: ${parsed.id}`);

        // New return value
        parsed.index = null;
        parsed.data = null;
        return parsed;
    }

    async insertDocumentArray(documentArray, contextArray = [], featureArray = []) {
        debug(`insertDocumentArray(): Document count: ${documentArray.length}, ContextArray: "${contextArray}"; FeatureArray: "${featureArray}"`);

        if (!Array.isArray(documentArray) || documentArray.length < 1) {
            throw new Error('Document array required');
        }

        const insertResults = [];
        for (const [index, doc] of documentArray.entries()) {
            try {
                const result = await this.insertDocument(doc, contextArray, featureArray);
                insertResults.push(result);
            } catch (error) {
                throw new Error(`Document ${index} failed: ${error.message}`);
            }
        }

        debug(`Inserted documents: (${insertResults.length})`);
        return insertResults;
    }

    async updateDocument(document, contextArray = [], featureArray = []) {
        return this.insertDocument(document, contextArray, featureArray);
    }

    async updateDocumentArray(documentArray, contextArray = [], featureArray = []) {
        debug(`updateDocumentArray(): ContextArray: "${contextArray}"; FeatureArray: "${featureArray}"`);

        if (!Array.isArray(documentArray) || documentArray.length < 1) {
            throw new Error('Document array required');
        }

        let result = [];
        let errors = [];

        // TODO: Refactor to use Promise.all() and lmdb batch operations
        for (const doc of documentArray) {
            try {
                const id = await this.updateDocument(doc, contextArray, featureArray);
                result.push(id);
            } catch (error) {
                errors.push(error.message);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Errors updating documents: ${errors.join('; ')}`);
        }

        return result;
    }

    async deleteDocument(id) {
        // TODO: We are not removing the entry, just updating meta: {} to mark it as deleted
        // TODO: We should also clear all bitmaps, tick the "removed" bitmap and remove the data: {} part
        debug(`deleteDocument(): ID: ${id}`);
        if (!id) {throw new Error('Document ID required');}
        if (!Number.isInteger(id)) {throw new Error('Document ID must be an integer');}

        let document = this.documents.get(id);
        if (!document) {return false;}

        // TODO: Do not remove the document, just mark it as deleted and keep the metadata
        try {
            // Remove document from DB
            await this.documents.remove(id);
            // Clear indexes
            await this.index.clear(id, document.meta.checksum);
        } catch (error) {
            console.error(`Error deleting document with ID ${id}, ${error}`);
            throw new Error(`Error deleting document with ID ${id}, ${error}`);
        }

        return true;
    }

    async deleteDocumentArray(idArray) {
        if (!Array.isArray(idArray) || idArray.length < 1) {throw new Error('Array of document IDs required');}

        let tasks = [];
        for (const id of idArray) {
            tasks.push(this.deleteDocument(id));
        }

        await Promise.all(tasks);
        return true;
    }


    /**
     * Bitmap methods
     */


    async removeDocument(id, contextArray, featureArray) {
        debug(`removeDocument(): ID: ${id}; ContextArray: "${contextArray}"; FeatureArray: ${featureArray}`);
        if (!id) {throw new Error('Document ID required');}
        if (!Array.isArray(contextArray) || contextArray.length < 1) {
            throw new Error('Context array required, got ' + JSON.stringify(contextArray));
        }

        let document = this.documents.get(id);
        if (!document) {
            throw new Error(`Document ID "${id}" not found`); //return false;
        }

        // Remove document from Context bitmaps
        await this.index.untickContextArray(contextArray, document.id);

        // Remove document from Feature bitmaps (if provided)
        if (Array.isArray(featureArray) && featureArray.length > 0) {
            await this.index.untickFeatureArray(featureArray, document.id);
        }

        return true;
    }

    async removeDocumentArray(idArray, contextArray, featureArray) {
        debug(`removeDocumentArray(): IDArray: ${idArray}; ContextArray: "${contextArray}"; FeatureArray: "${featureArray}"`);
        if (!Array.isArray(idArray) || idArray.length < 1) {throw new Error('Array of document IDs required');}

        let tasks = [];
        for (const id of idArray) {
            tasks.push(this.removeDocument(id, contextArray, featureArray));
        }

        await Promise.all(tasks); // TODO: Add try..catch from the above methods
        return true;
    }


    /**
     * Utils
     */

    listDocumentSchemas() {
        return documentSchemas.list();
    }

    getDocumentSchema(schema) {
        return documentSchemas.getSchema(schema);
    }

    // TODO: Remove or refactor
    createDataset(name) {
        if (this.datasets.has(name)) {return this.datasets.get(name);}
        let dataset = this.#db.createDataset(name);
        this.datasets.set(name, dataset);
        return dataset;
    }

    // TODO: Remove or refactor
    deleteDataset(name) {
        if (!this.datasets.has(name)) {return false;}
        return this.datasets.delete(name);
    }


    /**
     * Internal methods
     */

    async #parseDocument(doc) {
        debug('Input document ' + JSON.stringify(doc, null, 2));

        if (typeof doc !== 'object') {
            debug(`Document has to be an object, got ${typeof doc}`);
            throw new Error('Document has to be an object');
        }

        if (!doc.type) {
            debug('Missing document type');
            throw new Error('Document type required');
        }

        const Schema = this.getDocumentSchema(doc.type);
        if (!Schema) {
            debug(`Document schema not found: ${doc.type}`);
            throw new Error(`Document schema not found: ${doc.type}`);
        }

        // Initialize document object
        const parsed = new Schema(doc);

        debug('Parsed document: ' + JSON.stringify(parsed, null, 2));
        return parsed;
    }

    #extractDocumentFeatures(doc) {
        let features = [];

        // Parse doc.index.staticFeatureBitmapFields
        if (doc.index.staticFeatureBitmapFields && doc.index.staticFeatureBitmapFields.length > 0) {
            // Check if properties defined in the staticFeatureBitmapFields exist in the document
            for (let field of doc.index.staticFeatureBitmapFields) {
                let fields = field.split('.');
                let value = doc;
                for (let f of fields) {
                    if (value[f] === undefined) {
                        debug(`Field "${field}" not found in document`);
                        continue;
                    }
                    value = value[f];
                }
                if (value !== doc) {
                    //let feature = 'static/'
                    features.push(value.toLowerCase());
                }
            }
        }

        // Parse doc.index.dynamicFeatureBitmapFields
        if (doc.index.dynamicFeatureBitmapFields && doc.index.dynamicFeatureBitmapFields.length > 0) {
            // We'll use the same features array for dynamic features
            // TODO: Refactor to use separate arrays for static and dynamic features
            // TODO: Use dotprop to access nested properties
            for (let field of doc.index.dynamicFeatureBitmapFields) {
                let fields = field.split('.');
                let value = doc;
                for (let f of fields) {
                    if (value[f] === undefined) {
                        debug(`Field "${field}" not found in document`);
                        continue;
                    }
                    value = value[f];
                }
                if (value !== doc) {
                    features.push(value);
                }
            }
        }

        debug('Document features: ' + features.join(', '));
        return features;
    }

    async #genDocumentID() {
        const keyCount = await this.documents.getKeysCount() || 0;
        const nextDocumentID = INTERNAL_BITMAP_ID_MAX + keyCount + 1;
        debug(`Current key count: ${keyCount}, doc ID: ${nextDocumentID}`);
        return nextDocumentID;
    }

    async stop() {
        debug('Stopping database');
        await this.#db.close();
    }
}


module.exports = SynapsDB;
