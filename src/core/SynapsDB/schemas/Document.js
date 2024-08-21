'use strict';

// Import necessary libraries
const crypto = require('crypto');

// Define constants
const DOCUMENT_SCHEMA_VERSION = '2.0';
const DOCUMENT_SCHEMA_TYPE = 'data/abstraction/document';
const DOCUMENT_DATA_CHECKSUM_ALGO = 'sha1';
const DOCUMENT_DATA_FORMAT = 'application/json';
const DOCUMENT_DATA_ENCODING = 'utf8';

// Document class
class Document {

    constructor(options = {}) {

        //if (!options.id) throw new Error('Document ID is not defined')
        this.id = null; //options.id;

        this.type = options?.type || DOCUMENT_SCHEMA_TYPE;
        this.schemaVersion = options?.schemaVersion || DOCUMENT_SCHEMA_VERSION;

        // Toggle document versioning
        this.versioning = options?.versioning || false;

        const now = new Date().toISOString();
        this.createdTimestamp = options?.createdTimestamp || now;
        this.modifiedTimestamp = now;

        this.index = {
            primaryChecksumAlgorithm: DOCUMENT_DATA_CHECKSUM_ALGO,
            primaryChecksumFields: ['data'],
            staticFeatureBitmapFields: [],
            dynamicFeatureBitmapFields: [],
            fullTextIndexFields: [],
            embeddingFields: ['data'],
            ...options?.index, // Maybe we should move this to the top to not override the default values
        };

        // Metadata
        this.meta = {
            dataContentType: DOCUMENT_DATA_FORMAT,
            dataContentEncoding: DOCUMENT_DATA_ENCODING,
            ...options?.meta,
        };

        // Document data
        this.data = options.data;

        // References for previous document versions
        // TODO: This feature depends on the underlying storage mechanism, we should implement
        // a universal versioning mechanism
        this.versions = options.versions || [];

        // Calculate document checksum (if not provided; maybe we should move it to the SynapsDB parser)
        this.meta.checksum = options?.checksum || this.calculateChecksum(this.index.primaryChecksumFields, this.data);

        // TODO: Add support for multiple checksum fields (or re-add, we already had this feature)

    }

    toJSON() {
        return {
            // Mandatory parameters
            schemaVersion: this.schemaVersion,

            id: this.id,
            type: this.type,

            createdTimestamp: this.createdTimestamp,
            modifiedTimestamp: this.modifiedTimestamp,

            index: this.index,
            meta: this.meta,
            data: this.data,

            versions: this.versions,
        };
    }

    static toJSON() {
        return {
            schemaVersion: DOCUMENT_SCHEMA_VERSION,

            id: null,
            type: DOCUMENT_SCHEMA_TYPE,

            index: {
                primaryChecksumAlgorithm: DOCUMENT_DATA_CHECKSUM_ALGO,
                primaryChecksumFields: ['data'],
                staticFeatureBitmapFields: ['type'],
                dynamicFeatureBitmapFields: [],
                fullTextIndexFields: [],
                embeddingFields: ['data'],
            },

            meta: {
                checksum: null,
                dataContentType: DOCUMENT_DATA_FORMAT,
                dataContentEncoding: DOCUMENT_DATA_ENCODING,
            },

            data: {},
            versions: [],
        };
    }

    static fromJSON(json) {
        // TODO: Fix for "undefined"
        let document = new Document(json);
        return document;
    }

    calculateChecksum(fields, data = this) { // TODO: Refactor,"this" is a mess!
        if (!fields) {throw new Error('Checksum fields are not defined');}
        const resolveField = (fieldPath, obj) => fieldPath.split('.').reduce((acc, part) => acc && acc[part], obj);
        const checksumData = fields.reduce((acc, field) => {
            const value = resolveField(field, data);
            if (value !== undefined) {
                acc[field] = value;
            }
            return acc;
        }, {});

        return this.createHash(checksumData);
    }

    createHash(str, algorithm = DOCUMENT_DATA_CHECKSUM_ALGO, encoding = DOCUMENT_DATA_ENCODING) {
        if (typeof str === 'object') {str = JSON.stringify(str);}
        return crypto
            .createHash(algorithm)
            .update(str, encoding)
            .digest('hex');
    }

    static createHash(str, algorithm = DOCUMENT_DATA_CHECKSUM_ALGO, encoding = DOCUMENT_DATA_ENCODING) {
        if (typeof str === 'object') {str = JSON.stringify(str);}
        return crypto
            .createHash(algorithm)
            .update(str, encoding)
            .digest('hex');
    }

    // TODO: Should replace the toJSON and fromJSON methods
    serialize() {
        return JSON.stringify(this);
    }

    // TODO: Should replace the toJSON and fromJSON methods
    static deserialize(data) {
        const obj = JSON.parse(data);
        return new Document(obj);
    }

    validate() {
        // Check for mandatory parameters (TODO)
        if (!this.type) {throw new Error('Document type is not defined');}
        if (!this.data) {throw new Error('Document data is not defined');}
        return true;
    }

    static validate(document) {
        if (!document) {throw new Error('Document is not defined');}

        // Check for mandatory parameters (TODO)
        // initialize and run doc.validate()?
        return (
            document.type &&
            document.data
        ) || false;
    }

    get schema() { return this.toJSON(); }
    static get schema() { return Document.toJSON(); }

    static get schemaVersion() {
        return DOCUMENT_SCHEMA_VERSION;
    }

    get schemaType() { return this.type; }
    static get schemaType() {
        return DOCUMENT_SCHEMA_TYPE;
    }
}

module.exports = Document;
