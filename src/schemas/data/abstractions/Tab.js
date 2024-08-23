/**
 * Data abstraction for storing browser tab data
 */

const BaseDocument = require('../BaseDocument.js');

const DOCUMENT_SCHEMA = 'data/abstraction/tab';
const DOCUMENT_SCHEMA_VERSION = '2.0';
const DOCUMENT_DATA_TYPE = 'application/json';
const DOCUMENT_DATA_ENCODING = 'utf8';


class Tab extends BaseDocument {

    constructor(options = {}) {
        super({
            schema: DOCUMENT_SCHEMA,
            schemaVersion: DOCUMENT_SCHEMA_VERSION,
            index: {
                primaryChecksumAlgorithm: 'sha1',
                primaryChecksumFields: ['data.url'],
                fullTextIndexFields: ['data.title'],
                embeddingFields: ['data.title'],
                ...options.index,
            },
            meta: {
                dataContentType: DOCUMENT_DATA_TYPE,
                dataContentEncoding: DOCUMENT_DATA_ENCODING,
                ...options.meta,
            },
            ...options,
        });

        this.validate();
    }

    toJSON() {
        // Get base document as JSON
        let base = super.toJSON();
        // Set schema version and type
        base.schema = DOCUMENT_SCHEMA;
        base.schemaVersion = DOCUMENT_SCHEMA_VERSION;
        base.index = {
            ...base.index,
            primaryChecksumAlgorithm: 'sha1',
            primaryChecksumFields: ['document.url'],
            fullTextIndexFields: ['document.title'],
            embeddingFields: ['document.title'],

        };
        base.meta = {
            ...base.meta,
            dataContentType: DOCUMENT_DATA_TYPE,
            dataContentEncoding: DOCUMENT_DATA_ENCODING,
        };
        return base;
    }

}

module.exports = Tab;
