#!/usr/bin/env node

/**
 * Test Context WebSocket Event Forwarding Chain
 *
 * This test demonstrates the complete event flow:
 * Database → Workspace → Context → ContextManager → WebSocket → Client
 *
 * Shows how real-time events will reach connected websocket clients.
 */

import EventEmitter from 'eventemitter2';

// Mock the complete event forwarding chain
class MockSynapsD extends EventEmitter {
    constructor(workspaceId) {
        super();
        this.workspaceId = workspaceId;
    }

    async insertDocument(document, contextSpec, featureArray) {
        const docId = Math.floor(Math.random() * 10000);
        console.log(`📄 Database ${this.workspaceId}: Inserting document ID ${docId}`);

        // Emit database-level event
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
    constructor(id) {
        super();
        this.id = id;
        this.db = new MockSynapsD(id);
        this.tree = { buildJsonTree: () => ({ id: 'root', children: [] }) };
        this.setupEventForwarding();
    }

    setupEventForwarding() {
        this.db.on('document:inserted', (payload) => {
            console.log(`🏢 Workspace ${this.id}: Forwarding document:inserted event`);
            this.emit('workspace:document:inserted', {
                workspaceId: this.id,
                workspaceName: this.id,
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

    setWorkspace(workspace) {
        this.workspace = workspace;
        this.setupWorkspaceEventForwarding();
    }

    setupWorkspaceEventForwarding() {
        if (!this.workspace) return;

        console.log(`🎯 Context ${this.id}: Setting up workspace event forwarding`);

        this.workspaceEventHandlers = {
            documentInserted: (payload) => {
                console.log(`🎯 Context ${this.id}: Forwarding workspace:document:inserted`);
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

    async insertDocument(document, featureArray = []) {
        if (!this.workspace) throw new Error('No workspace selected');
        return await this.workspace.db.insertDocument(document, this.path, featureArray);
    }

    toJSON() {
        return {
            id: this.id,
            path: this.path,
            userId: this.userId,
            workspaceId: this.workspace?.id
        };
    }
}

class MockContextManager extends EventEmitter {
    constructor() {
        super();
        this.contexts = new Map();
    }

    addContext(context) {
        this.contexts.set(context.id, context);

        // Forward context events to this manager (mimicking real ContextManager)
        context.on('context:workspace:document:inserted', (payload) => {
            console.log(`📋 ContextManager: Forwarding context:workspace:document:inserted from context ${payload.contextId}`);
            this.emit('context:workspace:document:inserted', payload);
        });
    }

    async hasContext(userId, contextId) {
        const context = this.contexts.get(contextId);
        return context && context.userId === userId;
    }

    async getContext(userId, contextId) {
        const context = this.contexts.get(contextId);
        if (context && context.userId === userId) {
            return context;
        }
        return null;
    }
}

class MockWebSocketClient extends EventEmitter {
    constructor(userId) {
        super();
        this.user = { id: userId };
        this.receivedEvents = [];
    }

    emit(eventName, payload) {
        console.log(`🖥️  WebSocket Client: Received ${eventName} event`);
        this.receivedEvents.push({ eventName, payload });
        super.emit(eventName, payload);
    }
}

// Mock the websocket registration function (simplified version)
function mockRegisterContextWebSocket(contextManager, socket) {
    const contextEvents = [
        'context:workspace:document:inserted',
        'context:workspace:document:updated',
        'context:workspace:tree:path:inserted'
    ];

    const listeners = new Map();

    contextEvents.forEach(eventName => {
        const listener = async (payload) => {
            try {
                const userId = socket.user?.id;
                if (!userId) {
                    console.log(`❌ Not forwarding ${eventName} - no authenticated user`);
                    return;
                }

                const contextId = payload.contextId;
                if (contextId) {
                    const hasAccess = await contextManager.hasContext(userId, contextId);
                    if (!hasAccess) {
                        console.log(`❌ Not forwarding ${eventName} - user ${userId} has no access to context ${contextId}`);
                        return;
                    }
                }

                console.log(`🌐 WebSocket: Forwarding ${eventName} to client for user ${userId}`);
                socket.emit(eventName, payload);
            } catch (error) {
                console.error(`Error handling ${eventName}:`, error);
            }
        };

        listeners.set(eventName, listener);
        contextManager.on(eventName, listener);
    });

    return { listeners };
}

async function testWebSocketEventForwarding() {
    console.log('🚀 Starting WebSocket Context Event Forwarding Test\n');

    // Set up the complete chain
    const workspace = new MockWorkspace('ws1');
    const context1 = new MockContext('ctx1', '/foo/bar', 'user1');
    const context2 = new MockContext('ctx2', '/foo/baz', 'user2');
    const contextManager = new MockContextManager();

    // Connect contexts to workspace and manager
    context1.setWorkspace(workspace);
    context2.setWorkspace(workspace);
    contextManager.addContext(context1);
    contextManager.addContext(context2);

    // Create websocket clients
    const client1 = new MockWebSocketClient('user1');
    const client2 = new MockWebSocketClient('user2');
    const client3 = new MockWebSocketClient('user3'); // Unauthorized user

    // Register websocket handlers
    mockRegisterContextWebSocket(contextManager, client1);
    mockRegisterContextWebSocket(contextManager, client2);
    mockRegisterContextWebSocket(contextManager, client3);

    console.log('--- Step 1: User1 inserts document via context1 ---');
    await context1.insertDocument({
        schema: 'test',
        data: { title: 'Document from user1 context1' }
    });

    console.log('\n--- Step 2: User2 inserts document via context2 ---');
    await context2.insertDocument({
        schema: 'test',
        data: { title: 'Document from user2 context2' }
    });

    console.log('\n--- Step 3: Direct database insert (should reach all contexts) ---');
    await workspace.db.insertDocument({
        schema: 'test',
        data: { title: 'Direct database insert' }
    }, '/shared/path', []);

    // Small delay to let events propagate
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('\n✅ WebSocket Event Forwarding Test Completed!');
    console.log('\n📊 Results:');
    console.log(`🖥️  Client1 (user1) received ${client1.receivedEvents.length} events:`);
    client1.receivedEvents.forEach((event, i) => {
        console.log(`  ${i + 1}. ${event.eventName} from context ${event.payload.contextId}`);
    });

    console.log(`🖥️  Client2 (user2) received ${client2.receivedEvents.length} events:`);
    client2.receivedEvents.forEach((event, i) => {
        console.log(`  ${i + 1}. ${event.eventName} from context ${event.payload.contextId}`);
    });

    console.log(`🖥️  Client3 (user3) received ${client3.receivedEvents.length} events:`);
    client3.receivedEvents.forEach((event, i) => {
        console.log(`  ${i + 1}. ${event.eventName} from context ${event.payload.contextId}`);
    });

    console.log('\n📋 Expected behavior:');
    console.log('  - Each user should only receive events from their own contexts');
    console.log('  - Events should propagate: Database → Workspace → Context → ContextManager → WebSocket → Client');
    console.log('  - Unauthorized users (user3) should receive no events');
    console.log('  - All contexts receive workspace-level events (shared database operations)');
}

testWebSocketEventForwarding().catch(console.error);
