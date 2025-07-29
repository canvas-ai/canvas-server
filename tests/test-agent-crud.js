#!/usr/bin/env node

/**
 * Test script for agent CRUD operations
 * Usage: node tests/test-agent-crud.js
 */

import fetch from 'node-fetch';

const API_BASE = process.env.API_URL || 'http://localhost:8001/rest/v2';
const AUTH_TOKEN = process.env.TEST_TOKEN || null;

if (!AUTH_TOKEN) {
    console.error('❌ TEST_TOKEN environment variable required');
    console.error('   Set it to a valid authentication token');
    process.exit(1);
}

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`
};

async function testAgentCRUD() {
    console.log('🧪 Testing Agent CRUD Operations...\n');

    try {
        // 1. Create a test agent
        console.log('📝 Creating test agent...');
        const createResponse = await fetch(`${API_BASE}/agents`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: 'test-crud-agent',
                label: 'Test CRUD Agent',
                description: 'Agent for testing CRUD operations',
                llmProvider: 'ollama',
                model: 'llama2'
            })
        });

        if (!createResponse.ok) {
            const error = await createResponse.text();
            console.error(`❌ Create failed: ${createResponse.status} ${error}`);
            return;
        }

        const created = await createResponse.json();
        const agentId = created.payload.id;
        console.log(`✅ Created agent: ${agentId}`);

        // 2. Read the agent
        console.log('\n📖 Reading agent...');
        const readResponse = await fetch(`${API_BASE}/agents/${agentId}`, {
            headers
        });

        if (!readResponse.ok) {
            console.error(`❌ Read failed: ${readResponse.status}`);
            return;
        }

        const agent = await readResponse.json();
        console.log(`✅ Read agent: ${agent.payload.name}`);

        // 3. Update the agent
        console.log('\n✏️ Updating agent...');
        const updateResponse = await fetch(`${API_BASE}/agents/${agentId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                label: 'Updated Test Agent',
                description: 'Updated description for testing'
            })
        });

        if (!updateResponse.ok) {
            const error = await updateResponse.text();
            console.error(`❌ Update failed: ${updateResponse.status} ${error}`);
        } else {
            const updated = await updateResponse.json();
            console.log(`✅ Updated agent: ${updated.payload.label}`);
        }

        // 4. Delete the agent
        console.log('\n🗑️ Deleting agent...');
        const deleteResponse = await fetch(`${API_BASE}/agents/${agentId}`, {
            method: 'DELETE',
            headers
        });

        if (!deleteResponse.ok) {
            const error = await deleteResponse.text();
            console.error(`❌ Delete failed: ${deleteResponse.status} ${error}`);
        } else {
            const deleted = await deleteResponse.json();
            console.log(`✅ Deleted agent successfully: ${deleted.payload.success}`);
        }

        // 5. Verify deletion
        console.log('\n🔍 Verifying deletion...');
        const verifyResponse = await fetch(`${API_BASE}/agents/${agentId}`, {
            headers
        });

        if (verifyResponse.status === 404) {
            console.log('✅ Agent deletion verified - agent not found');
        } else {
            console.log(`⚠️ Agent may still exist: ${verifyResponse.status}`);
        }

        console.log('\n🎉 CRUD test completed successfully!');

    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
    }
}

async function main() {
    try {
        await testAgentCRUD();
    } catch (error) {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
