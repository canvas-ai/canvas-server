/**
 * Data abstraction to store File metadata
 */

const Document = require('../Document');
const DOCUMENT_SCHEMA_VERSION = '2.0';
const DOCUMENT_SCHEMA_TYPE = 'data/abstraction/file';
const DOCUMENT_DATA_CHECKSUM_ALGO = 'sha1';
const DOCUMENT_DATA_FORMAT = 'application/json';
const DOCUMENT_DATA_ENCODING = 'utf8';
class File extends Document {

    constructor(params) {

        if (!params.data) {throw new Error('Tab data is not defined');}

        super({
            id: params.id || null,
            type: DOCUMENT_SCHEMA_TYPE,
            schemaVersion: DOCUMENT_SCHEMA_VERSION,
            versioning: false,

            index: {
                primaryChecksumAlgorithm: DOCUMENT_DATA_CHECKSUM_ALGO,
                primaryChecksumFields: ['meta.checksums.sha1'],
                staticFeatureBitmapFields: [
                    'type',
                    'meta.mimeType',
                    'meta.extension',
                ],
                dynamicFeatureBitmapFields: [],
                fullTextIndexFields: ['meta.name'],
                embeddingFields: ['data.title'], // TODO: Handle creation of embeddings for the document type URL
            },

            meta: {

                mimeType: null,

                checksums: {
                    sha1: null,
                },

                paths: {

                },
            },

            data: {},
        });

        if (!this.meta.checksums[DOCUMENT_DATA_CHECKSUM_ALGO]) {throw new Error('Primary checksum is not defined');}

    }

    validate() {
        super.validate();
        if (!this.data.url) {
            throw new Error('Tab URL is a mandatory parameter');
        }
    }

    static toJSON() {
        // Get base document as JSON
        let base = super.toJSON();

        // Set schema version and type
        base.schemaVersion = DOCUMENT_SCHEMA_VERSION;
        base.type = DOCUMENT_SCHEMA_TYPE;

        base.versions = false;

        base.index = {
            primaryChecksumAlgorithm: 'sha1',
            primaryChecksumFields: ['data.url'],
            staticFeatureBitmapFields: ['type', 'meta.browser'],
            dynamicFeatureBitmapFields: [],
            fullTextIndexFields: ['data.title'],
            embeddingFields: ['data.title'],
        };

        base.meta = {
            dataContentType: DOCUMENT_DATA_FORMAT,
            dataContentEncoding: 'utf8',
            browser: 'unknown',
        };

        base.data.url = 'https://getcanvas.org/';
        base.data.title = 'Canvas | GetCanvas.org';

        return base;
    }

}

module.exports = File;

