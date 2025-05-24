#!/usr/bin/env node
'use strict';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import createDebug from 'debug';
import fetch from 'node-fetch';

const debug = createDebug('canvas-mcp-stdio');

// Configuration - you can set these via environment variables
const CANVAS_SERVER_URL = process.env.CANVAS_SERVER_URL || 'http://localhost:8001';
const CANVAS_API_TOKEN = process.env.CANVAS_API_TOKEN || 'canvas-88dd5eb14b80dc70630ddf7ff08c84dd300f6bfd01d450ae';

/**
 * Standalone MCP server for Cursor integration via stdio
 * This server acts as a bridge between Cursor and the Canvas server
 */
class CanvasMcpStdioServer {
  constructor() {
    this.server = new McpServer({
      name: 'canvas-server-mcp-stdio',
      version: '1.0.0'
    });

    this.setupTools();
    this.setupResources();
  }

  setupTools() {
    // Context management tools
    this.server.tool(
      'list_contexts',
      {},
      async () => {
        try {
          const response = await this.makeCanvasRequest('/api/contexts');
          const data = await response.json();

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }]
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Error listing contexts: ${error.message}`
            }]
          };
        }
      }
    );

    this.server.tool(
      'get_context',
      { contextId: z.string().describe('The ID of the context to retrieve') },
      async ({ contextId }) => {
        try {
          const response = await this.makeCanvasRequest(`/api/contexts/${contextId}`);
          const data = await response.json();

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }]
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Error getting context: ${error.message}`
            }]
          };
        }
      }
    );

    this.server.tool(
      'create_context',
      {
        id: z.string().describe('User-defined ID for the new context'),
        url: z.string().describe('The URL for the new context (e.g., universe://my-context-name)'),
        description: z.string().optional().describe('Optional description for the context'),
        type: z.enum(['context', 'universe']).optional().describe('Type of context'),
        workspaceId: z.string().optional().describe('Workspace ID for the context')
      },
      async (args) => {
        try {
          const response = await this.makeCanvasRequest('/api/contexts', {
            method: 'POST',
            body: JSON.stringify(args)
          });
          const data = await response.json();

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }]
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Error creating context: ${error.message}`
            }]
          };
        }
      }
    );

    this.server.tool(
      'remove_context',
      { contextId: z.string().describe('The ID of the context to remove') },
      async ({ contextId }) => {
        try {
          const response = await this.makeCanvasRequest(`/api/contexts/${contextId}`, {
            method: 'DELETE'
          });
          const data = await response.json();

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }]
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Error removing context: ${error.message}`
            }]
          };
        }
      }
    );

    // Document tools
    this.server.tool(
      'find_documents',
      {
        contextId: z.string().describe('The ID of the context to search in'),
        contextPath: z.string().default('/').describe('Context path filter (default: "/")'),
        features: z.array(z.string()).default([]).describe('Feature filters'),
        filters: z.array(z.string()).default([]).describe('Additional filters'),
        limit: z.number().default(50).describe('Maximum number of documents to return')
      },
      async (args) => {
        try {
          const queryParams = new URLSearchParams();
          queryParams.append('contextPath', args.contextPath);
          queryParams.append('limit', args.limit.toString());
          if (args.features.length > 0) {
            queryParams.append('features', args.features.join(','));
          }
          if (args.filters.length > 0) {
            queryParams.append('filters', args.filters.join(','));
          }

          const response = await this.makeCanvasRequest(
            `/api/contexts/${args.contextId}/documents?${queryParams}`
          );
          const data = await response.json();

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }]
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Error finding documents: ${error.message}`
            }]
          };
        }
      }
    );

    this.server.tool(
      'get_document',
      {
        contextId: z.string().describe('The ID of the context containing the document'),
        documentId: z.string().describe('The ID of the document to retrieve')
      },
      async ({ contextId, documentId }) => {
        try {
          const response = await this.makeCanvasRequest(
            `/api/contexts/${contextId}/documents/${documentId}`
          );
          const data = await response.json();

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(data, null, 2)
            }]
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Error getting document: ${error.message}`
            }]
          };
        }
      }
    );

    debug('MCP tools registered');
  }

  setupResources() {
    // Context resources
    this.server.resource(
      'contexts',
      'canvas://contexts/{contextId}',
      async (uri) => {
        const match = uri.href.match(/^canvas:\/\/contexts\/([^\/]+)$/);
        if (!match) {
          throw new Error('Invalid context URI format');
        }
        const contextId = match[1];

        try {
          const response = await this.makeCanvasRequest(`/api/contexts/${contextId}`);
          const data = await response.json();

          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(data, null, 2),
              mimeType: 'application/json'
            }]
          };
        } catch (error) {
          throw new Error(`Failed to read context resource: ${error.message}`);
        }
      }
    );

    debug('MCP resources registered');
  }

  async makeCanvasRequest(endpoint, options = {}) {
    const url = `${CANVAS_SERVER_URL}${endpoint}`;
    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${CANVAS_API_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });

    if (!response.ok) {
      throw new Error(`Canvas API request failed: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  async start() {
    debug('Starting Canvas MCP stdio server');
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    debug('Canvas MCP stdio server connected');
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CanvasMcpStdioServer();
  server.start().catch(error => {
    console.error('Failed to start Canvas MCP stdio server:', error);
    process.exit(1);
  });
}

export default CanvasMcpStdioServer;
