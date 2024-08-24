// Environment variables
const {
    app,
    server,
    user,
} = require('../env.js');

// Utils
const path = require('path');

// Services
const Index = require('../services/synapsd');
const Storage = require('../services/stored');

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
                    backend: 'file',
                    backendConfig: {
                        rootPath: user.paths.data,
                    }
                },
                db: {
                    enabled: true,
                    primary: true,
                    type: 'local',
                    backend: 'lmdb',
                    backendConfig: {
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
        if (!document) {
            throw new Error('Document is required');
        }

        if (!document.schema) {
            throw new Error('Document schema is required');
        }

        const Schema = this.schemas.getSchema(document.schema);
        if (!Schema) {
            throw new Error(`Schema not found: ${document.schema}`);
        }

        const parsedDocument = Schema.fromJSON(document);
        console.log(parsedDocument);

        // Calculate checksums
        let data = parsedDocument.getChecksumFields();
        let algorithms = parsedDocument.getChecksumAlgorithms();
        for (let i = 0; i < algorithms.length; i++) {
            let checksum = this.storage.utils.checksumJson(data, algorithms[i]);
            parsedDocument.addChecksum(algorithms[i], checksum);
        }

        // Extract features
        let features = [document.schema, ...featureArray];
        parsedDocument.addFeatureArray(features);

        // Calculate embeddings

        // Validate document
        parsedDocument.validate();

        // Insert into index
        await this.index.insertDocument(parsedDocument, contextArray, featureArray);

        // Insert into storage
        await this.storage.insertDocument(parsedDocument, backends);

    }

    insertFile(filePath) { }

    insertNote(note) {}

    insertTab(tab) { }

    insertTodo(todo) { }

}


const context = new ContextInterface();
const Doc = context.schemas.getSchema('data/abstraction/document');
const doc1 = new Doc({
    id: 100001,
    data: { title: 'Hello World from doc1' },
})

const doc2 = new Doc({
    id: 100002,
    data: { title: 'Hello World from doc2' },
})


context.insertDocument(doc1);
context.insertDocument(doc2, [], ['feature1', 'feature2']);
context.insertFile('/opt/ollama.service');
context.insertNote({
    title: 'Note 1',
    content: 'This is a note',
    tags: ['note', 'important'],
});
