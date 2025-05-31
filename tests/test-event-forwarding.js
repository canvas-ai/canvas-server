#!/usr/bin/env node

/**
 * Test Event Forwarding: Database → Workspace → Context
 *
 * This test demonstrates the complete event forwarding chain:
 * 1. SynapsD (database) emits events when documents are inserted/updated/removed
 * 2. Workspace listens to database events and reemits them with workspace context
 * 3. Context listens to workspace events and reemits them with context information
 *
 * Use case: Two contexts (context1 at /foo/bar, context2 at /foo/bar/baz)
 * bound to the same workspace. When context2 inserts a document, context1
 * should receive the event and can notify its client.
 */

import EventEmitter from 'eventemitter2';

// Mock simplified classes for testing
class MockSynapsD extends EventEmitter {
    constructor() {
        super();
        this.status = 'running';
    }

    async insertDocument(document, contextSpec, featureArray) {
        // Simulate document insertion
        const docId = Math.floor(Math.random() * 10000);
        console.log(`📄 SynapsD: Inserting document ID ${docId} at context "${contextSpec}"`);

        // Emit the database event
        this.emit('document:inserted', {
            id: docId,
            document: { ...document, id: docId },
            contextSpec,
            featureArray
        });

        return docId;
    }
}

class MockWorkspace extends EventEmitter {
    constructor(id, label) {
        super();
        this.id = id;
        this.label = label;
        this.db = new MockSynapsD();
        this.setupEventForwarding();
    }

    setupEventForwarding() {
        console.log(`🏢 Workspace ${this.id}: Setting up event forwarding from database`);

        this.db.on('document:inserted', (payload) => {
            console.log(`🏢 Workspace ${this.id}: Received document:inserted from database, forwarding...`);
            this.emit('workspace:document:inserted', {
                workspaceId: this.id,
                workspaceName: this.label,
                ...payload
            });
        });

        // Add other events as needed...
    }
}

class MockContext extends EventEmitter {
    constructor(id, path, workspace, userId) {
        super();
        this.id = id;
        this.path = path;
        this.workspace = workspace;
        this.userId = userId;
        this.workspaceEventHandlers = {};
        this.setupWorkspaceEventForwarding();
    }

    setupWorkspaceEventForwarding() {
        console.log(`🎯 Context ${this.id}: Setting up event forwarding from workspace ${this.workspace.id}`);

        this.workspaceEventHandlers.documentInserted = (payload) => {
            const isRelevant = this.isEventRelevantToContext(payload);
            console.log(`🎯 Context ${this.id}: Received workspace:document:inserted, relevant: ${isRelevant}`);

            this.emit('context:workspace:document:inserted', {
                contextId: this.id,
                contextPath: this.path,
                userId: this.userId,
                relevant: isRelevant,
                ...payload
            });
        };

        this.workspace.on('workspace:document:inserted', this.workspaceEventHandlers.documentInserted);
    }

    isEventRelevantToContext(payload) {
        const eventPath = payload.contextSpec || '';
        const contextPath = this.path || '/';

        // Check for path overlap
        return eventPath.startsWith(contextPath) || contextPath.startsWith(eventPath);
    }

    async insertDocument(document, featureArray = []) {
        console.log(`🎯 Context ${this.id}: Inserting document via workspace database`);
        return await this.workspace.db.insertDocument(document, this.path, featureArray);
    }
}

// Test the event forwarding
async function testEventForwarding() {
    console.log('🚀 Starting Event Forwarding Test\n');

    // Create a workspace
    const workspace = new MockWorkspace('universe', 'Universe Workspace');

    // Create two contexts bound to the same workspace
    const context1 = new MockContext('ctx1', '/foo/bar', workspace, 'user1');
    const context2 = new MockContext('ctx2', '/foo/bar/baz', workspace, 'user2');

    // Set up client-side listeners to demonstrate cross-context notifications
    context1.on('context:workspace:document:inserted', (payload) => {
        console.log(`🖥️  Client for Context1: Received document event! Relevant: ${payload.relevant}`);
        console.log(`    Document ID: ${payload.id}, Path: ${payload.contextSpec}`);
    });

    context2.on('context:workspace:document:inserted', (payload) => {
        console.log(`🖥️  Client for Context2: Received document event! Relevant: ${payload.relevant}`);
        console.log(`    Document ID: ${payload.id}, Path: ${payload.contextSpec}`);
    });

    console.log('\n--- Test 1: Context2 inserts document at /foo/bar/baz ---');
    await context2.insertDocument({
        schema: 'test-document',
        data: { title: 'Test Document from Context2' }
    });

    console.log('\n--- Test 2: Context1 inserts document at /foo/bar ---');
    await context1.insertDocument({
        schema: 'test-document',
        data: { title: 'Test Document from Context1' }
    });

    console.log('\n✅ Event forwarding test completed!');
    console.log('\n📋 Summary:');
    console.log('  - Both contexts receive all document events from their shared workspace');
    console.log('  - Events are marked as relevant/irrelevant based on path overlap');
    console.log('  - Clients can filter events based on relevance or process all events');
    console.log('  - This enables real-time cross-context notifications');
}

// Run the test
testEventForwarding().catch(console.error);
