#!/usr/bin/env node

/**
 * Context Sharing Test
 *
 * This test verifies that context sharing functionality works correctly:
 * 1. Creates a context as user1
 * 2. Shares it with user2 with documentRead permission
 * 3. Verifies user2 can access the context
 * 4. Updates permission to documentWrite
 * 5. Revokes access from user2
 * 6. Verifies user2 can no longer access the context
 */

import fetch from 'node-fetch';

const API_BASE = process.env.API_URL || 'http://localhost:8001/rest/v2';

// Test users
const user1 = {
  email: 'test.owner@example.com',
  password: 'testpass123'
};

const user2 = {
  email: 'test.shared@example.com',
  password: 'testpass123'
};

let user1Token = null;
let user2Token = null;
let testContextId = null;

async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return response.json();
}

async function loginUser(email, password) {
  console.log(`Logging in user: ${email}`);
  const response = await makeRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  // Handle different response structures
  const token = response.payload?.token || response.token;
  if (!token) {
    throw new Error('No token received from login');
  }

  console.log(`✓ User ${email} logged in successfully`);
  return token;
}

async function createContext(token, contextData) {
  console.log(`Creating context: ${contextData.id}`);
  const response = await makeRequest('/contexts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(contextData)
  });

  const context = response.payload?.context || response.payload;
  console.log(`✓ Context created: ${context.id}`);
  return context;
}

async function shareContext(ownerToken, ownerId, contextId, sharedWithUserId, accessLevel) {
  console.log(`Sharing context ${contextId} with ${sharedWithUserId} (${accessLevel})`);
  const response = await makeRequest(`/users/${ownerId}/contexts/${contextId}/shares`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      sharedWithUserId,
      accessLevel
    })
  });

  console.log(`✓ Context shared successfully`);
  return response;
}

async function getSharedContext(userToken, ownerId, contextId) {
  console.log(`Getting shared context ${ownerId}/${contextId}`);
  const response = await makeRequest(`/users/${ownerId}/contexts/${contextId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });

  const context = response.payload?.context || response.payload;
  console.log(`✓ Shared context retrieved: ${context.id}`);
  return context;
}

async function revokeContextAccess(ownerToken, ownerId, contextId, sharedWithUserId) {
  console.log(`Revoking access from ${sharedWithUserId} for context ${contextId}`);
  const response = await makeRequest(`/users/${ownerId}/contexts/${contextId}/shares/${sharedWithUserId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${ownerToken}`
    }
  });

  console.log(`✓ Access revoked successfully`);
  return response;
}

async function runTest() {
  try {
    console.log('🧪 Starting Context Sharing Test\n');

    // Step 1: Login both users
    console.log('Step 1: Logging in users');
    user1Token = await loginUser(user1.email, user1.password);
    user2Token = await loginUser(user2.email, user2.password);
    console.log('');

    // Step 2: Create a context as user1
    console.log('Step 2: Creating context as user1');
    const contextData = {
      id: 'sharetest',
      url: 'universe://test/sharing',
      workspaceId: 'universe',
      description: 'Test context for sharing functionality'
    };

    const context = await createContext(user1Token, contextData);
    testContextId = context.id;
    console.log('');

    // Step 3: Share context with user2 (documentRead)
    console.log('Step 3: Sharing context with user2 (documentRead)');
    await shareContext(user1Token, user1.email, testContextId, user2.email, 'documentRead');
    console.log('');

    // Step 4: Verify user2 can access the shared context
    console.log('Step 4: Verifying user2 can access shared context');
    const sharedContext = await getSharedContext(user2Token, user1.email, testContextId);

    if (sharedContext.acl && sharedContext.acl[user2.email] === 'documentRead') {
      console.log('✓ User2 has correct access level in ACL');
    } else {
      throw new Error('User2 does not have correct access in ACL');
    }
    console.log('');

    // Step 5: Update permission to documentWrite
    console.log('Step 5: Updating permission to documentWrite');
    await shareContext(user1Token, user1.email, testContextId, user2.email, 'documentWrite');

    // Verify updated permission
    const updatedContext = await getSharedContext(user2Token, user1.email, testContextId);
    if (updatedContext.acl && updatedContext.acl[user2.email] === 'documentWrite') {
      console.log('✓ Permission updated successfully');
    } else {
      throw new Error('Permission was not updated correctly');
    }
    console.log('');

    // Step 6: Revoke access from user2
    console.log('Step 6: Revoking access from user2');
    await revokeContextAccess(user1Token, user1.email, testContextId, user2.email);
    console.log('');

    // Step 7: Verify user2 can no longer access the context
    console.log('Step 7: Verifying user2 can no longer access context');
    try {
      await getSharedContext(user2Token, user1.email, testContextId);
      throw new Error('User2 should not be able to access revoked context');
    } catch (error) {
      if (error.message.includes('403') || error.message.includes('Access denied')) {
        console.log('✓ Access correctly revoked - user2 cannot access context');
      } else {
        throw error;
      }
    }
    console.log('');

    console.log('🎉 All tests passed! Context sharing functionality is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup: Delete test context if it was created
    if (user1Token && testContextId) {
      try {
        console.log('\n🧹 Cleaning up test context...');
        await makeRequest(`/contexts/${testContextId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${user1Token}`
          }
        });
        console.log('✓ Test context cleaned up');
      } catch (error) {
        console.warn('⚠️  Failed to cleanup test context:', error.message);
      }
    }
  }
}

// Run the test
runTest();
