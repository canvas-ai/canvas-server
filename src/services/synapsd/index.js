'use strict';

// Utils
const EventEmitter = require('eventemitter2');
const path = require('path');
const debug = require('debug')('canvas:synapsd');

// Services
const Db = require('../db');
const Fts = require('./lib/FullTextSearch');
const Embeddings = require('@lancedb/lancedb');
const BitmapCollection = require('./lib/BitmapCollection.js');

// Constants
const INTERNAL_BITMAP_ID_MIN = 1000;
const INTERNAL_BITMAP_ID_MAX = 1000000;

// Schemas (temporary implementation, MVP)
const SchemaRegistry = require('../../schemas/SchemaRegistry.js');

/**
 * SynapsD index class
 */

class SynapsD extends EventEmitter {

    #db;

    constructor(options = {
        backupOnOpen: false,
        backupOnClose: false,
        compression: true,
        eventEmitter: {},
    }) {
        // Event emitter
        super(options.eventEmitter);

        // Initialize database backends
        if (!options.path) { throw new Error('Database path required'); }
        this.#db = new Db(options);
        this.schemas = new SchemaRegistry();

        // Initialize a global in-memory bitmap cache
        this.cache = new Map();

        // Main document store
        this.documents = this.#db.createDataset('documents'); // id -> document

        // Initialize inverted checksum index
        this.hash2id = this.#db.createDataset('checksums'); // algo/checksum -> id

        // FTS index (until we move to something better)
        this.fts = new Fts(this.#db.createDataset('fts'), {
            preset: 'performance',
            tokenize: 'forward',
            cache: true,
        });

        // Initialize bitmap store
        this.bitmaps = this.#db.createDataset('bitmaps');   // id -> bitmap

        // Initialize bitmap collections
        this.contexts = new BitmapCollection(
            this.bitmaps.createDataset('contexts'),
            this.cache,
            {
                tag: 'contexts',
                rangeMin: INTERNAL_BITMAP_ID_MIN,
                rangeMax: INTERNAL_BITMAP_ID_MAX,
            });

        this.features = new BitmapCollection(
            this.bitmaps.createDataset('features'),
            this.cache,
            {
                tag: 'features',
                rangeMin: INTERNAL_BITMAP_ID_MIN,
                rangeMax: INTERNAL_BITMAP_ID_MAX,
            });

        // RAG
        this.chunks = this.#db.createDataset('chunks');
        this.embeddings = Embeddings.connect(path.join(options.path, 'embeddings'));

        debug('SynapsD initialized');
    }

    async insert(document, contextArray = [], featureArray = []) {
        debug('Inserting document to index', document);
        if (!(document instanceof this.schemas.get('data/abstraction/document'))) {
            throw new Error('Invalid document type');
        }

        if (!document.validate()) { throw new Error('Invalid document'); }
        let primaryChecksum = document.getChecksum(); //returns the primary one by default, maybe we should use document.index.primaryChecksumAlgorithm explicitly though
        let existingId = await this.checksumToId(document.index.primaryChecksumAlgorithm, primaryChecksum);
        if (existingId) {
            debug(`Document with primary checksum "${document.index.primaryChecksumAlgorithm}/${primaryChecksum}" already exists, doc ID: ${existingId}`);
            return existingId;
        }

        // Insert document to database
        await this.documents.put(document.id, document); //document.toJSON()

        // Update checksums
        for (const [algo, checksum] of document.checksums) {
            await this.insertChecksum(algo, checksum, document.id);
        }

        // Update bitmaps
        this.contexts.tickManySync(contextArray, document.id);
        this.features.tickManySync(featureArray, document.id);

        // Update FTS index
        await this.fts.addDocument(document);

        // Emit event
        this.emit('index:insert', document.id);

        // Return document.id
        return document.id;
    }

    async update(document, contextArray = [], featureArray = []) {
        debug('Updating document', document);
        if (!(document instanceof this.schemas.get('data/abstraction/document'))) {
            throw new Error('Invalid document type');
        }
        // TODO
        // Emit event
        this.emit('index:update', document.id);
        return document.id;
    }

    async remove(id, contextArray = [], featureArray = []) {
        debug(`Removing document ${id} from bitmap indexes ctx: ${contextArray} ftr: ${featureArray}`);
        let document = await this.documents.get(id);
        if (!document) { return false; }

        // Update bitmaps
        if (contextArray.length > 0) { this.contexts.untickManySync(contextArray, id); }
        if (featureArray.length > 0) { this.features.untickManySync(featureArray, id); }

        this.emit('index:remove', id);
        return id;
    }

    async delete(id) {
        debug(`Deleting document ${id} from index`);
        let document = await this.documents.get(id);
        if (!document) { return false; }

        // Remove document from database
        await this.documents.del(id);

        // Remove checksums
        for (const [algo, checksum] of document.checksums) {
            await this.hash2id.del(`${algo}/${checksum}`);
        }

        // Remove bitmaps
        this.contexts.untickAllSync(id);
        this.features.untickAllSync(id);

        // Remove FTS index
        await this.fts.removeDocument(document.id);

        // Emit event
        this.emit('index:delete', id);
        return id;
    }

    async get(id) {
        debug(`Getting document ${id}`);
        if (!id) { throw new Error('Document ID required'); }
        if (!Number.isInteger(id)) { throw new Error('Document ID must be an integer'); }

        let document = await this.documents.get(id);
        if (!document) { return null; }

        return document;
    }

    async list(contextArray = [], featureArray = [], filterArray = []) {
        debug(`Listing documents ctx: ${contextArray} ftr: ${featureArray} flt: ${filterArray}`);
        let contextBitmap = this.contexts.AND(contextArray);
        let featureBitmap = this.features.OR(featureArray);

        if (contextBitmap.isEmpty) {
            debug('No documents found for contextArray, doing ID computation on features only');
            return featureBitmap.toArray();
        }

        contextBitmap.andInPlace(featureBitmap);
        return contextBitmap.toArray();
    }

    async has(id, contextArray = [], featureArray = [], filterArray = []) {

    }

    async find(query, contextArray = [], featureArray = [], filterArray = []) {

    }

    async insertChecksum(algo, checksum, id) {
        return await this.hash2id.put(`${algo}/${checksum}`, id);
    }

    async checksumToId(algo, checksum) {
        return await this.hash2id.get(`${algo}/${checksum}`);
    }

    async query(query) {}


    /**
     * Document schemas
     */

    listSchemas() {
        return this.schemas.listSchemas();
    }

    getSchema(name) {
        return this.schemas.getSchema(name);
    }


    /**
     * Utils
     */

    async close() {
        await this.#db.close();
        debug('SynapsD Index database closed');
    }

}

module.exports = SynapsD;
