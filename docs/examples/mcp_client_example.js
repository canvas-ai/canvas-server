#!/usr/bin/env node
'use strict';

/**
 * Canvas MCP Client Example
 * Demonstrates how to connect to and use the Canvas MCP server
 */

import fetch from 'node-fetch';
import { EventSource } from 'eventsource';

const BASE_URL = 'http://localhost:8001';
const API_TOKEN = process.env.CANVAS_API_TOKEN || 'your-api-token-here';

class CanvasMcpClient {
  constructor(baseUrl, apiToken) {
    this.baseUrl = baseUrl;
    this.apiToken = apiToken;
    this.sessionId = null;
    this.eventSource = null;
    this.messageId = 1;
  }

    async connect() {
    console.log('🔗 Connecting to Canvas MCP server...');

    return new Promise((resolve, reject) => {
      // EventSource doesn't support custom headers, so use query parameters
      const url = new URL(`${this.baseUrl}/mcp/v1/sse`);
      url.searchParams.set('token', this.apiToken);

      this.eventSource = new EventSource(url.toString());

      this.eventSource.onopen = (event) => {
        console.log('✅ Connected to MCP server');
        // We'll get the session ID from the first message
        this.sessionId = `client-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        console.log(`🆔 Session ID: ${this.sessionId}`);
        resolve();
      };

            this.eventSource.onmessage = (event) => {
        console.log('📨 Received message:', event.data);

        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (parseError) {
          console.log('📝 Raw message (non-JSON):', event.data);
        }
      };

      // Handle different event types
      this.eventSource.addEventListener('endpoint', (event) => {
        console.log('🔗 MCP endpoint received:', event.data);
        // Extract session ID from endpoint URL
        const sessionMatch = event.data.match(/sessionId=([^&\s]+)/);
        if (sessionMatch) {
          this.sessionId = sessionMatch[1];
          console.log(`🆔 Updated session ID: ${this.sessionId}`);
        }
      });

      this.eventSource.onerror = (error) => {
        console.error('❌ Connection error:', error);
        reject(error);
      };
    });
  }

  handleMessage(message) {
    // Handle different types of MCP messages
    if (message.method === 'initialize') {
      console.log('🚀 Server initialized');
    } else if (message.result) {
      console.log('✅ Tool result:', JSON.stringify(message.result, null, 2));
    } else if (message.error) {
      console.error('❌ Tool error:', message.error);
    }
  }

  async sendMessage(method, params = {}) {
    if (!this.sessionId) {
      throw new Error('Not connected to MCP server');
    }

    const message = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method,
      params
    };

    console.log(`📤 Sending message: ${method}`);

    try {
      const response = await fetch(`${this.baseUrl}/mcp/v1/messages?sessionId=${this.sessionId}&token=${this.apiToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Message sent successfully');
      return message.id;
    } catch (error) {
      console.error(`❌ Failed to send message: ${error.message}`);
      throw error;
    }
  }

  async callTool(toolName, args = {}) {
    return this.sendMessage('tools/call', {
      name: toolName,
      arguments: args
    });
  }

  async listResources() {
    return this.sendMessage('resources/list');
  }

  async readResource(uri) {
    return this.sendMessage('resources/read', { uri });
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      console.log('👋 Disconnected from MCP server');
    }
  }
}

// Example usage
async function runExample() {
  const client = new CanvasMcpClient(BASE_URL, API_TOKEN);

  try {
    // Connect to the server
    await client.connect();

    // Wait a moment for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n📋 Listing available tools...');
    await client.sendMessage('tools/list');

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n📋 Listing contexts...');
    await client.callTool('list_contexts');

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n📋 Listing resources...');
    await client.listResources();

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n🆕 Creating a test context...');
    await client.callTool('create_context', {
      id: 'mcp-test-context',
      url: 'universe://mcp-test-context',
      description: 'A test context created via MCP',
      type: 'context'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n🔍 Getting context details...');
    await client.callTool('get_context', {
      contextId: 'mcp-test-context'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n📄 Finding documents in context...');
    await client.callTool('find_documents', {
      contextId: 'mcp-test-context',
      limit: 10
    });

    // Wait for responses
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n🧹 Cleaning up - removing test context...');
    await client.callTool('remove_context', {
      contextId: 'mcp-test-context'
    });

    // Wait for final response
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    console.error('💥 Example failed:', error.message);
  } finally {
    client.disconnect();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Example interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Example terminated');
  process.exit(0);
});

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Canvas MCP Client Example');
  console.log('=============================\n');

  if (!API_TOKEN || API_TOKEN === 'your-api-token-here') {
    console.log('⚠️  Warning: Please set CANVAS_API_TOKEN environment variable');
    console.log('   Example: export CANVAS_API_TOKEN=canvas-your-token-here\n');
  }

  runExample().catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}
