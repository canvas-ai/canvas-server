/**
 * Data abstraction for storing Notes
 */

const Document = require('../Document');
const DOCUMENT_SCHEMA_VERSION = '2.0';
const DOCUMENT_SCHEMA_TYPE = 'data/abstraction/note';

class Note extends Document {

    constructor(params) {
        super({
            ...params,
            type: DOCUMENT_SCHEMA_TYPE,
            schemaVersion: DOCUMENT_SCHEMA_VERSION,
        });

        this.data = params.data || {};
    }

    validate() {
        super.validate();
        if (!this.data.content) {
            throw new Error('Note content is a mandatory parameter');
        }
    }

    static toJSON() {}

}

module.exports = Note;
