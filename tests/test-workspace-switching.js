#!/usr/bin/env node

/**
 * Test Workspace Switching Event Handling
 *
 * This test demonstrates that when a context switches workspaces:
 * 1. Event listeners are properly removed from the old workspace
 * 2. Event listeners are properly set up on the new workspace
 * 3. The context only receives events from the currently active workspace
 */

import EventEmitter from 'eventemitter2';

class MockSynapsD extends EventEmitter {
    constructor(name) {
        super();
        this.name = name;
        this.status = 'running';
    }

    async insertDocument(document, contextSpec, featureArray) {
        const docId = Math.floor(Math.random() * 10000);
        console.log(`📄 ${this.name} SynapsD: Inserting document ID ${docId} at "${contextSpec}"`);

        this.emit('document:inserted', {
            id: docId,
            document: { ...document, id: docId },
            contextSpec,
            featureArray,
            database: this.name
        });

        return docId;
    }
}

class MockWorkspace extends EventEmitter {
    constructor(id, label) {
        super();
        this.id = id;
        this.label = label;
        this.db = new MockSynapsD(id);
        this.setupEventForwarding();
    }

    setupEventForwarding() {
        console.log(`🏢 Workspace ${this.id}: Setting up event forwarding from database`);

        this.db.on('document:inserted', (payload) => {
            console.log(`🏢 Workspace ${this.id}: Received document:inserted, forwarding...`);
            this.emit('workspace:document:inserted', {
                workspaceId: this.id,
                workspaceName: this.label,
                ...payload
            });
        });
    }
}

class MockContext extends EventEmitter {
    constructor(id, path, userId) {
        super();
        this.id = id;
        this.path = path;
        this.userId = userId;
        this.workspace = null;
        this.workspaceEventHandlers = null;
    }

    async switchWorkspace(newWorkspace) {
        console.log(`🎯 Context ${this.id}: Switching from workspace ${this.workspace?.id || 'none'} to ${newWorkspace.id}`);

        // Clean up old workspace event listeners
        this.cleanupWorkspaceEventForwarding();

        // Switch to new workspace
        this.workspace = newWorkspace;

        // Set up new event listeners
        this.setupWorkspaceEventForwarding();

        console.log(`🎯 Context ${this.id}: Successfully switched to workspace ${newWorkspace.id}`);
    }

    setupWorkspaceEventForwarding() {
        if (!this.workspace) return;

        console.log(`🎯 Context ${this.id}: Setting up event forwarding from workspace ${this.workspace.id}`);

        this.workspaceEventHandlers = {
            documentInserted: (payload) => {
                console.log(`🎯 Context ${this.id}: Received workspace:document:inserted from ${payload.workspaceId}`);
                this.emit('context:workspace:document:inserted', {
                    contextId: this.id,
                    contextPath: this.path,
                    userId: this.userId,
                    ...payload
                });
            }
        };

        this.workspace.on('workspace:document:inserted', this.workspaceEventHandlers.documentInserted);
    }

    cleanupWorkspaceEventForwarding() {
        if (!this.workspace || !this.workspaceEventHandlers) return;

        console.log(`🎯 Context ${this.id}: Cleaning up event forwarding from workspace ${this.workspace.id}`);

        this.workspace.off('workspace:document:inserted', this.workspaceEventHandlers.documentInserted);
        this.workspaceEventHandlers = null;
    }

    async insertDocument(document, featureArray = []) {
        if (!this.workspace) {
            throw new Error('No workspace selected');
        }
        console.log(`🎯 Context ${this.id}: Inserting document via workspace ${this.workspace.id}`);
        return await this.workspace.db.insertDocument(document, this.path, featureArray);
    }
}

async function testWorkspaceSwitching() {
    console.log('🚀 Starting Workspace Switching Test\n');

    // Create two workspaces
    const workspace1 = new MockWorkspace('workspace-1', 'First Workspace');
    const workspace2 = new MockWorkspace('workspace-2', 'Second Workspace');

    // Create a context
    const context = new MockContext('ctx1', '/foo/bar', 'user1');

    // Set up a client listener to see which events the context receives
    const receivedEvents = [];
    context.on('context:workspace:document:inserted', (payload) => {
        console.log(`🖥️  Client: Received document event from workspace ${payload.workspaceId}, doc ID: ${payload.id}`);
        receivedEvents.push(payload);
    });

    console.log('\n--- Step 1: Context starts without workspace ---');
    try {
        await context.insertDocument({ schema: 'test', data: { title: 'Should fail' } });
    } catch (error) {
        console.log(`❌ Expected error: ${error.message}`);
    }

    console.log('\n--- Step 2: Context switches to workspace-1 ---');
    await context.switchWorkspace(workspace1);

    console.log('\n--- Step 3: Insert document via workspace-1 ---');
    await context.insertDocument({ schema: 'test', data: { title: 'From workspace 1' } });

    console.log('\n--- Step 4: Insert document directly to workspace-2 (context should NOT receive this) ---');
    await workspace2.db.insertDocument({ schema: 'test', data: { title: 'Direct to workspace 2' } }, '/other/path', []);

    console.log('\n--- Step 5: Context switches to workspace-2 ---');
    await context.switchWorkspace(workspace2);

    console.log('\n--- Step 6: Insert document via workspace-2 ---');
    await context.insertDocument({ schema: 'test', data: { title: 'From workspace 2' } });

    console.log('\n--- Step 7: Insert document directly to workspace-1 (context should NOT receive this) ---');
    await workspace1.db.insertDocument({ schema: 'test', data: { title: 'Direct to workspace 1 after switch' } }, '/other/path', []);

    console.log('\n✅ Workspace switching test completed!');
    console.log(`\n📊 Context received ${receivedEvents.length} events:`);
    receivedEvents.forEach((event, index) => {
        console.log(`  ${index + 1}. From workspace ${event.workspaceId}: Document ${event.id}`);
    });

    console.log('\n📋 Expected behavior:');
    console.log('  - Context should receive 2 events (one from each workspace when it was active)');
    console.log('  - Context should NOT receive events from workspaces it\'s not currently connected to');
    console.log('  - Event listeners should be properly cleaned up during workspace switches');
}

testWorkspaceSwitching().catch(console.error);
