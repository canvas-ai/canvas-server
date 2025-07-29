#!/usr/bin/env node

/**
 * Test script to debug WebSocket authentication issues
 * Usage: node tests/test-websocket-auth.js
 */

import { io } from 'socket.io-client';

const WS_URL = process.env.WS_URL || 'http://localhost:8001';

async function testWebSocketAuth() {
  console.log('🧪 Testing WebSocket Authentication...\n');

  // Test with different token scenarios
  const testTokens = [
    {
      name: 'No Token',
      token: null,
      expectSuccess: false
    },
    {
      name: 'Empty Token',
      token: '',
      expectSuccess: false
    },
    {
      name: 'Invalid JWT Format',
      token: 'invalid.jwt.token',
      expectSuccess: false
    },
    {
      name: 'Sample Canvas API Token',
      token: 'canvas-test-token-12345',
      expectSuccess: false // Will fail unless this actual token exists
    }
  ];

  for (const testCase of testTokens) {
    console.log(`\n🔍 Testing: ${testCase.name}`);
    console.log(`   Token: ${testCase.token || 'null'}`);

    await new Promise((resolve) => {
      const socket = io(WS_URL, {
        auth: { token: testCase.token },
        transports: ['websocket'],
        reconnection: false,
        timeout: 5000
      });

      socket.on('connect', () => {
        console.log(`   ✅ Connected successfully`);
        socket.disconnect();
        resolve();
      });

      socket.on('connect_error', (error) => {
        console.log(`   ❌ Connection failed: ${error.message}`);
        if (error.data) {
          console.log(`   📝 Error data: ${JSON.stringify(error.data)}`);
        }
        resolve();
      });

      // Timeout fallback
      setTimeout(() => {
        console.log(`   ⏱️ Connection timeout`);
        socket.disconnect();
        resolve();
      }, 6000);
    });
  }

  console.log('\n📋 Authentication Test Results:');
  console.log('   - Check if your JWT secret is properly configured');
  console.log('   - Verify token format and expiration');
  console.log('   - For API tokens, ensure they exist in the database');
  console.log('   - Check server logs for detailed error messages');
}

async function checkTokenFromBrowser() {
  console.log('\n🌐 Browser Token Analysis:');
  console.log('   To debug browser issues:');
  console.log('   1. Open browser DevTools > Application > Local Storage');
  console.log('   2. Look for "authToken" key');
  console.log('   3. Copy the token value and check its format:');
  console.log('      - JWT tokens: have 3 parts separated by dots (header.payload.signature)');
  console.log('      - API tokens: start with "canvas-"');
  console.log('   4. Check token expiration (for JWT, decode the payload)');
  console.log('   5. Verify the token works with regular HTTP requests first');
}

async function main() {
  try {
    await testWebSocketAuth();
    await checkTokenFromBrowser();
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
