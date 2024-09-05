// Environment variables
const {
    app,
    server,
    user,
} = require('../env.js');

// Utils
const path = require('path');

// Services
const Index = require('../services/index');
const Storage = require('../services/storage');

// Schemas
const SchemaRegistry = require('../schemas/SchemaRegistry.js');

class ContextInterface {

    constructor() {
        this.schemas = new SchemaRegistry(
            path.join(server.paths.src, 'schemas')
        );

        this.index = new Index({
            path: user.paths.index,
            backupPath: path.join(user.paths.index, 'backup'),
            backupOnOpen: true,
            backupOnClose: false,
            compression: true,
        });

        this.storage = new Storage({
            cache: {
                enabled: true,
                maxAge: -1,
                rootPath: user.paths.cache,
                cachePolicy: 'pull-through',
            },
            data: {
                abstraction: {
                    note: {
                        backends: {
                            db: {
                                priority: 1,
                            },
                            file: {
                                priority: 2,
                            }
                        }
                    }
                }
            },
            backends: {
                file: {
                    enabled: true,
                    priority: 1,
                    type: 'local',
                    driver: 'file',
                    driverConfig: {
                        rootPath: user.paths.data,
                    }
                },
                db: {
                    enabled: true,
                    primary: true,
                    type: 'local',
                    driver: 'lmdb',
                    driverConfig: {
                        path: user.paths.db,
                        backupPath: path.join(user.paths.db, 'backup'),
                        backupOnOpen: true,
                        backupOnClose: false,
                        compression: true,
                    },
                },
            },
        });

        this.contextArray = [
            'context1',
            'context2',
            'context3',
        ]
    }


    async insertDocument(document, contextArray = this.contextArray, featureArray = [], backends = []) {
        // Validate document
        if (!document) { throw new Error('Document is required'); }
        if (!document.schema) { throw new Error('Document schema is required'); }

        const Schema = this.schemas.getSchema(document.schema);
        if (!Schema) { throw new Error(`Schema not found: ${document.schema}`); }
        if (!Schema.validate(document)) { throw new Error('Document validation failed'); }

        // Initialize document (handy)
        const doc = new Schema(document);

        // Extract document features
        doc.features = await this.storage.extractFeatures(document);

        // Calculate checksums for document
        doc.checksums = await this.storage.calculateChecksums(document);

        // Calculate embeddings
        doc.embeddings = await this.storage.calculateEmbeddings(document);

        // Generate document ID
        doc.id = await this.index.generateDocumentId(document);

        // Insert document to storage backends
        doc.paths = await this.storage.insertDocument(document, backends);

        // Insert document to index
        await this.index.insertDocument(doc, contextArray, featureArray);

        // Return Metadata document
        return doc;
    }

}

