'use strict';

/**
 * Simple MCP client test script
 * Shows how to interact with the Canvas MCP server for contexts
 */

// Fetch is available in Node.js since v18
import fetch from 'node-fetch';

// Replace with your Canvas API token
// You can generate one from the Canvas UI in Settings > API Tokens
const API_TOKEN = 'canvas-88dd5eb14b80dc70630ddf7ff08c84dd300f6bfd01d450ae';

// Server URL
const SERVER_URL = 'http://localhost:8001/mcp';

/**
 * Send a request to the MCP server
 * @param {Object} jsonRpcRequest - JSON-RPC request object
 * @param {string} sessionId - Optional session ID for authenticated sessions
 * @returns {Promise<Object>} - JSON-RPC response
 */
async function sendRequest(jsonRpcRequest, sessionId = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${API_TOKEN}`
  };

  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
  }

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(jsonRpcRequest)
    });

    // Get session ID from response headers if this is an initialization
    if (jsonRpcRequest.method === 'initialize') {
      const newSessionId = response.headers.get('Mcp-Session-Id');
      if (newSessionId) {
        console.log(`MCP Session established: ${newSessionId}`);
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} - ${response.statusText}`);
    }

    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      throw new Error(`Unexpected content type: ${contentType}`);
    }
  } catch (error) {
    console.error('MCP request error:', error);
    throw error;
  }
}

// Main execution function
async function main() {
  try {
    console.log('Canvas MCP Client Test');
    console.log('-----------------------');

    // Step 1: Initialize the MCP session
    console.log('\n1. Initializing MCP session...');
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        capabilities: {
          supportsContexts: true
        }
      }
    };

    const initResponse = await sendRequest(initRequest);
    console.log('Server capabilities:');
    console.log(JSON.stringify(initResponse.result, null, 2));

    // Store session ID for future requests
    const sessionId = initResponse.result.sessionId;

    // Step 2: List available contexts
    console.log('\n2. Listing contexts...');
    const listContextsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'list_contexts'
    };

    const listResponse = await sendRequest(listContextsRequest, sessionId);
    console.log('Contexts:');

    // Pretty print the contexts list
    if (listResponse.result && listResponse.result.contexts) {
      console.log(`Found ${listResponse.result.contexts.length} contexts`);
      listResponse.result.contexts.forEach(context => {
        console.log(`- ${context.id}: ${context.url} (${context.type})`);
      });
    } else {
      console.log('No contexts found or error in response:');
      console.log(JSON.stringify(listResponse, null, 2));
    }

    // Step 3: Get default context
    console.log('\n3. Getting default context...');
    const getContextRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'get_current_context',
      params: {
        contextId: 'default'
      }
    };

    const contextResponse = await sendRequest(getContextRequest, sessionId);
    console.log('Default context details:');
    console.log(JSON.stringify(contextResponse.result, null, 2));

    // Step 4: Terminate the session
    console.log('\n4. Terminating session...');
    const terminateResponse = await fetch(SERVER_URL, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Mcp-Session-Id': sessionId
      }
    });

    if (terminateResponse.ok) {
      console.log('Session terminated successfully');
    } else {
      console.log(`Session termination failed: ${terminateResponse.status} - ${terminateResponse.statusText}`);
    }

  } catch (error) {
    console.error('Test script error:', error);
  }
}

// Run the demo
main();
