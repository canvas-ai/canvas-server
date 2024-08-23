const BaseDocument = require('../BaseDocument.js');

const DOCUMENT_SCHEMA = 'data/abstraction/file';
const DOCUMENT_SCHEMA_VERSION = '2.0';
const DOCUMENT_DATA_TYPE = 'application/json';
const DOCUMENT_DATA_ENCODING = 'utf8';

class Note extends BaseDocument {
    constructor(options = {}) {
        super({
            schema: DOCUMENT_SCHEMA,
            schemaVersion: DOCUMENT_SCHEMA_VERSION,
            meta: {
                dataContentType: DOCUMENT_DATA_TYPE,
                dataContentEncoding: DOCUMENT_DATA_ENCODING,
                ...options.meta,
            },
            ...options,
        });
    }
}

module.exports = Note;
