/**
 * Data abstraction for storing browser tab data
 */

const Document = require('../Document');
const DOCUMENT_SCHEMA_VERSION = '2.0';
const DOCUMENT_SCHEMA_TYPE = 'data/abstraction/tab';
const DOCUMENT_DATA_FORMAT = 'application/json';

class Tab extends Document {

    constructor(params) {

        //if (!params.id) throw new Error('Tab ID is not defined')
        if (!params.data) {throw new Error('Tab data is not defined');}
        if (!params.data.url) {throw new Error('Tab data.URL is not defined');}

        super({
            id: params.id || null,
            type: DOCUMENT_SCHEMA_TYPE,
            schemaVersion: DOCUMENT_SCHEMA_VERSION,
            versioning: false,

            index: {
                primaryChecksumAlgorithm: 'sha1',
                primaryChecksumFields: ['data.url'],
                staticFeatureBitmapFields: ['type'],
                dynamicFeatureBitmapFields: [],
                fullTextIndexFields: ['data.title'],
                embeddingFields: ['data.title'], // TODO: Handle creation of embeddings for the document type URL
            },

            meta: {
                browser: 'unknown',
                ...params.meta,
                dataContentType: DOCUMENT_DATA_FORMAT,
                dataContentEncoding: 'utf8',
            },

            data: params.data,
        });

        this.meta.checksum = this.calculateChecksum(this.index.primaryChecksumFields);

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
            staticFeatureBitmapFields: [],
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

module.exports = Tab;
