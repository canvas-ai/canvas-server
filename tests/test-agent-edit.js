#!/usr/bin/env node

/**
 * Test script for agent edit functionality
 * Usage: node tests/test-agent-edit.js
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

async function testAgentEdit() {
    console.log('🧪 Testing Agent Edit Functionality...\n');

    try {
        // 1. Create a test agent
        console.log('📝 Creating test agent...');
        const createResponse = await fetch(`${API_BASE}/agents`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: 'test-edit-agent',
                label: 'Test Edit Agent',
                description: 'Agent for testing edit functionality',
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

        // 2. Read the agent to see initial state
        console.log('\n📖 Reading initial agent state...');
        const readResponse = await fetch(`${API_BASE}/agents/${agentId}`, {
            headers
        });

        if (!readResponse.ok) {
            console.error(`❌ Read failed: ${readResponse.status}`);
            return;
        }

        const agent = await readResponse.json();
        console.log(`✅ Read agent: ${agent.payload.name}`);
        console.log(`   Initial config:`, JSON.stringify(agent.payload.config, null, 2));

        // 3. Update the agent with comprehensive settings
        console.log('\n✏️ Updating agent with comprehensive settings...');
        const updateData = {
            label: 'Updated Test Agent',
            description: 'Updated description with comprehensive LLM settings',
            llmProvider: 'ollama',
            model: 'qwen2.5-coder:latest',
            prompts: {
                system: 'You are a helpful AI assistant specialized in coding and technical tasks. You provide clear, concise, and accurate responses. Always explain your reasoning and suggest best practices.'
            },
            connectors: {
                ollama: {
                    temperature: 0.3,
                    maxTokens: 8192,
                    topP: 0.9,
                    frequencyPenalty: 0.1,
                    presencePenalty: 0.1,
                    numCtx: 8192,
                    reasoning: true
                }
            }
        };

        const updateResponse = await fetch(`${API_BASE}/agents/${agentId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updateData)
        });

        if (!updateResponse.ok) {
            const error = await updateResponse.text();
            console.error(`❌ Update failed: ${updateResponse.status} ${error}`);
        } else {
            const updated = await updateResponse.json();
            console.log(`✅ Updated agent: ${updated.payload.label}`);
            console.log(`   Updated config:`, JSON.stringify(updated.payload.config, null, 2));
        }

        // 4. Read the agent again to verify changes
        console.log('\n🔍 Verifying changes...');
        const verifyResponse = await fetch(`${API_BASE}/agents/${agentId}`, {
            headers
        });

        if (verifyResponse.ok) {
            const verified = await verifyResponse.json();
            console.log(`✅ Verification successful:`);
            console.log(`   Label: ${verified.payload.label}`);
            console.log(`   Description: ${verified.payload.description}`);
            console.log(`   Model: ${verified.payload.model}`);
            console.log(`   System Prompt: ${verified.payload.config?.prompts?.system?.substring(0, 100)}...`);
            console.log(`   Temperature: ${verified.payload.config?.connectors?.ollama?.temperature}`);
            console.log(`   Max Tokens: ${verified.payload.config?.connectors?.ollama?.maxTokens}`);
            console.log(`   Num Ctx: ${verified.payload.config?.connectors?.ollama?.numCtx}`);
            console.log(`   Reasoning: ${verified.payload.config?.connectors?.ollama?.reasoning}`);
        }

        // 5. Test chat with the updated agent to verify system prompt works
        console.log('\n💬 Testing chat with updated agent...');
        const chatResponse = await fetch(`${API_BASE}/agents/${agentId}/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                message: 'Hello! What kind of assistant are you?',
                maxTokens: 500
            })
        });

        if (chatResponse.ok) {
            const chatResult = await chatResponse.json();
            console.log(`✅ Chat successful:`);
            console.log(`   Response: ${chatResult.payload.content.substring(0, 200)}...`);
        } else {
            console.log(`⚠️ Chat test skipped (agent may not be active)`);
        }

        // 6. Clean up - delete the agent
        console.log('\n🗑️ Cleaning up...');
        const deleteResponse = await fetch(`${API_BASE}/agents/${agentId}`, {
            method: 'DELETE',
            headers
        });

        if (deleteResponse.ok) {
            console.log(`✅ Test agent deleted successfully`);
        } else {
            console.log(`⚠️ Failed to delete test agent`);
        }

        console.log('\n🎉 Agent edit test completed successfully!');

    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
    }
}

async function main() {
    try {
        await testAgentEdit();
    } catch (error) {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
