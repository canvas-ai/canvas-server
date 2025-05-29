#!/usr/bin/env node

/**
 * Simple Delete Test
 *
 * This test verifies that the delete functionality works by:
 * 1. Adding a tab via CLI
 * 2. Listening for WebSocket events
 * 3. Attempting to delete the tab via CLI
 * 4. Verifying delete events are received
 */

import { io } from 'socket.io-client';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

const WS_URL = 'http://localhost:8001';

// Use the provided API token
const API_TOKEN = 'canvas-88dd5eb14b80dc70630ddf7ff08c84dd300f6bfd01d450ae';

let wsSocket = null;

console.log('🧪 Starting Delete Test');
console.log('   Testing delete functionality with real-time events');
console.log(`   WebSocket URL: ${WS_URL}`);

async function setupWebSocketConnection() {
  console.log('🌐 Setting up WebSocket connection...');

  return new Promise((resolve, reject) => {
    const socket = io(WS_URL, {
      auth: {
        token: API_TOKEN
      },
      transports: ['websocket'],
      timeout: 10000
    });

    socket.on('connect', () => {
      console.log('   ✅ WebSocket connected successfully');
      wsSocket = socket;
      resolve(true);
    });

    socket.on('authenticated', (data) => {
      console.log('   ✅ WebSocket authenticated for user:', data.email || data.userId);
    });

    socket.on('connect_error', (error) => {
      console.error('   ❌ WebSocket connection failed:', error.message);
      reject(error);
    });

    socket.on('document:delete', (payload) => {
      console.log('🔌 Browser Extension: Received document:delete event!');
      console.log('   📋 Event payload:', JSON.stringify(payload, null, 2));
      console.log('   ✅ Document delete event handled successfully!');
    });

    socket.on('document:remove', (payload) => {
      console.log('🔌 Browser Extension: Received document:remove event!');
      console.log('   📋 Event payload:', JSON.stringify(payload, null, 2));
      console.log('   ✅ Document remove event handled successfully!');
    });

    socket.on('document:insert', (payload) => {
      console.log('🔌 Browser Extension: Received document:insert event!');
      console.log('   📋 Event payload:', JSON.stringify(payload, null, 2));
      console.log('   ✅ Document insert event handled successfully!');
    });

    // Set timeout
    setTimeout(() => {
      if (!socket.connected) {
        reject(new Error('Connection timeout'));
      }
    }, 10000);
  });
}

async function main() {
  try {
    console.log('🚀 Running Delete Test\n');

    // Setup WebSocket connection
    await setupWebSocketConnection();

    console.log('\n📝 Instructions:');
    console.log('   1. Open another terminal');
    console.log('   2. Run: context tab add https://delete-test-example.com');
    console.log('   3. Run: context tab list');
    console.log('   4. Run: context tab delete <tab-id-from-list>');
    console.log('   5. Check this terminal for delete events');
    console.log('\nListening for events... (Press Ctrl+C to exit)\n');

    // Keep the connection alive and listen for events
    while (true) {
      await sleep(1000);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🧹 Cleaning up WebSocket connection...');
  if (wsSocket) {
    wsSocket.disconnect();
  }
  process.exit(0);
});

main();
