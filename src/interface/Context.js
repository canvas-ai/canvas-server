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


    async insertDocument(document, contextArray = this.contextArray, featureArray = [], backends = 'db') {
        // Validate document
        if (!document) { throw new Error('Document is required'); }
        if (!document.schema) { throw new Error('Document schema is required'); }

        const Schema = this.schemas.getSchema(document.schema);
        if (!Schema) { throw new Error(`Schema not found: ${document.schema}`); }

        const parsedDocument = Schema.fromJSON(document);

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
        console.log(parsedDocument);

        // Insert into index
        await this.index.insert(parsedDocument, contextArray, featureArray);

        // Insert into storage
        await this.storage.insertDocument(parsedDocument, null, backends);

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

/*
if (!obj.id) { throw new Error('Object ID required'); }
if (!obj.created_at) { throw new Error('Object created_at required'); }
if (!obj.updated_at) { throw new Error('Object updated_at required'); }
if (!obj.checksums) { throw new Error('Object checksums required'); }
if (!obj.ftsArray) { throw new Error('Object ftsArray required'); }
if (!obj.embeddings) { throw new Error('Object embeddings array required'); }
*/

console.log(context.index.objectCount());

async function test() {
    await context.insertDocument(doc1);
    await context.insertDocument(doc2, [], ['feature1', 'feature2']);
    await context.insertFile('/opt/ollama.service');
    await context.insertNote({
        title: 'Note 1',
        content: 'This is a note',
        tags: ['note', 'important'],
    });
}


test()
