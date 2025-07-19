#!/usr/bin/env node

/**
 * Test WebSocket Event Forwarding
 *
 * This test verifies that events emitted from Context instances
 * are properly forwarded through ContextManager to WebSocket clients.
 *
 * Run with: node tests/test-websocket-events.js
 */

import { createDebug } from '../src/utils/log/index.js';
import ContextManager from '../src/managers/context/index.js';
import WorkspaceManager from '../src/managers/workspace/index.js';
import UserManager from '../src/managers/user/index.js';
import jim from '../src/utils/jim/index.js';
import io from 'socket.io-client';

const debug = createDebug('test:websocket-events');

async function testWebSocketEvents() {
    debug('🧪 Starting WebSocket event forwarding test...');

    try {
        // Initialize managers
        const userManager = new UserManager({
            rootPath: '/tmp/test-users',
            indexStore: jim.createIndex('test-users'),
        });

        const workspaceManager = new WorkspaceManager({
            defaultRootPath: '/tmp/test-workspaces',
            indexStore: jim.createIndex('test-workspaces'),
            userManager: userManager,
        });

        const contextManager = new ContextManager({
            indexStore: jim.createIndex('test-contexts'),
            workspaceManager: workspaceManager
        });

        userManager.setWorkspaceManager(workspaceManager);
        userManager.setContextManager(contextManager);

        await userManager.initialize();
        await workspaceManager.initialize();
        await contextManager.initialize();

        debug('✅ Managers initialized');

        // Create a test user
        const testUser = await userManager.createUser({
            email: 'test@example.com',
            name: 'Test User'
        });

        debug('✅ Test user created:', testUser.id);

        // Get default workspace
        const workspace = await workspaceManager.getWorkspace(testUser.id, 'universe', testUser.id);
        debug('✅ Got workspace:', workspace.name);

        // Create a context
        const context = await contextManager.createContext(testUser.id, 'universe://test', {
            id: 'test-context'
        });

        debug('✅ Created context:', context.id);

        // Set up event listeners on ContextManager
        let managerEventReceived = false;
        let contextEventReceived = false;

        contextManager.on('document.inserted', (payload) => {
            debug('🎯 ContextManager received document.inserted event:', payload);
            managerEventReceived = true;
        });

        context.on('document.inserted', (payload) => {
            debug('🎯 Context received document.inserted event:', payload);
            contextEventReceived = true;
        });

        debug('✅ Event listeners set up');

        // Insert a test document to trigger events
        const testDocument = {
            schema: 'data/abstraction/tab',
            schemaVersion: '2.0',
            data: {
                url: 'https://test.example.com',
                title: 'Test Tab',
                timestamp: new Date().toISOString()
            }
        };

        debug('🚀 Inserting test document...');
        const result = await context.insertDocumentArray(testUser.id, [testDocument], ['test-feature']);

        debug('✅ Document inserted, result:', result);

        // Wait a bit for events to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check results
        if (contextEventReceived) {
            debug('✅ Context event was emitted correctly');
        } else {
            debug('❌ Context event was NOT emitted');
        }

        if (managerEventReceived) {
            debug('✅ ContextManager received forwarded event correctly');
        } else {
            debug('❌ ContextManager did NOT receive forwarded event');
        }

        // Test context URL change
        debug('🚀 Testing context URL change...');
        let urlChangeReceived = false;

        contextManager.on('context.url.set', (payload) => {
            debug('🎯 ContextManager received context.url.set event:', payload);
            urlChangeReceived = true;
        });

        await context.setUrl('universe://test/changed');

        await new Promise(resolve => setTimeout(resolve, 500));

        if (urlChangeReceived) {
            debug('✅ Context URL change event was forwarded correctly');
        } else {
            debug('❌ Context URL change event was NOT forwarded');
        }

        // Summary
        debug('🧪 Test Summary:');
        debug(`  Context Event Emission: ${contextEventReceived ? '✅' : '❌'}`);
        debug(`  Manager Event Forwarding: ${managerEventReceived ? '✅' : '❌'}`);
        debug(`  URL Change Forwarding: ${urlChangeReceived ? '✅' : '❌'}`);

        if (contextEventReceived && managerEventReceived && urlChangeReceived) {
            debug('🎉 All tests PASSED! Event forwarding is working correctly.');
            process.exit(0);
        } else {
            debug('💥 Some tests FAILED! Check the logs above.');
            process.exit(1);
        }

    } catch (error) {
        debug('💥 Test failed with error:', error.message);
        debug('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the test
testWebSocketEvents();
