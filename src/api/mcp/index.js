'use strict';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  InitializeRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import createDebug from 'debug';
import ResponseObject from '../ResponseObject.js';
import { validateUser } from '../auth/strategies.js';

const debug = createDebug('canvas-server:mcp');

// Tool input schemas - following the "everything" example pattern
const ListContextsSchema = z.object({});

const GetContextSchema = z.object({
  contextId: z.string().describe('The ID of the context to retrieve')
});

const CreateContextSchema = z.object({
  id: z.string().describe('User-defined ID for the new context'),
  url: z.string().describe('The URL for the new context (e.g., universe://my-context-name)'),
  description: z.string().optional().describe('Optional description for the context'),
  type: z.enum(['context', 'universe']).optional().describe('Type of context'),
  workspaceId: z.string().optional().describe('Workspace ID for the context')
});

const RemoveContextSchema = z.object({
  contextId: z.string().describe('The ID of the context to remove')
});

const FindDocumentsSchema = z.object({
  contextId: z.string().describe('The ID of the context to search in'),
  contextPath: z.string().default('/').describe('Context path filter (default: "/")'),
  features: z.array(z.string()).default([]).describe('Feature filters'),
  filters: z.array(z.string()).default([]).describe('Additional filters'),
  limit: z.number().default(50).describe('Maximum number of documents to return')
});

const GetDocumentSchema = z.object({
  contextId: z.string().describe('The ID of the context containing the document'),
  documentId: z.string().describe('The ID of the document to retrieve')
});

const QueryDocumentsSchema = z.object({
  contextId: z.string().describe('The ID of the context to query'),
  query: z.object({
    contextPath: z.string().optional(),
    features: z.array(z.string()).optional(),
    filters: z.array(z.string()).optional(),
    limit: z.number().optional()
  }).describe('Query parameters object')
});

// Tool names enum
const ToolName = {
  LIST_CONTEXTS: 'list_contexts',
  GET_CONTEXT: 'get_context',
  CREATE_CONTEXT: 'create_context',
  REMOVE_CONTEXT: 'remove_context',
  FIND_DOCUMENTS: 'find_documents',
  GET_DOCUMENT: 'get_document',
  QUERY_DOCUMENTS: 'query_documents'
};

/**
 * MCP Server implementation for Canvas Server
 * Provides Context lifecycle and Document read-only operations
 */
class CanvasMcpServer {
  #mcpServer;
  #contextManager;
  #userManager;
  #authService;
  #transports = new Map(); // Store active transports by sessionId

  constructor(options = {}) {
    this.#contextManager = options.contextManager;
    this.#userManager = options.userManager;
    this.#authService = options.authService;

    if (!this.#contextManager) {
      throw new Error('contextManager is required for CanvasMcpServer');
    }
    if (!this.#userManager) {
      throw new Error('userManager is required for CanvasMcpServer');
    }
    if (!this.#authService) {
      throw new Error('authService is required for CanvasMcpServer');
    }

    // Create MCP server with proper modern API
    this.#mcpServer = new McpServer({
      name: 'canvas-server-mcp',
      version: '1.0.0'
    });

    this.#setupTools();
    this.#setupResources();

    debug('Canvas MCP server initialized with modern SDK');
  }



  /**
   * Setup all MCP tools using modern SDK API
   */
  #setupTools() {
    // Context management tools
    this.#mcpServer.tool(
      'list_contexts',
      {},
      async (args, { meta } = {}) => {
        const user = await this.#authenticateFromMeta(meta);
        return await this.#handleListContexts(user);
      }
    );

    this.#mcpServer.tool(
      'get_context',
      { contextId: z.string().describe('The ID of the context to retrieve') },
      async ({ contextId }, { meta } = {}) => {
        const user = await this.#authenticateFromMeta(meta);
        return await this.#handleGetContext(user, contextId);
      }
    );

    this.#mcpServer.tool(
      'create_context',
      {
        id: z.string().describe('User-defined ID for the new context'),
        url: z.string().describe('The URL for the new context (e.g., universe://my-context-name)'),
        description: z.string().optional().describe('Optional description for the context'),
        type: z.enum(['context', 'universe']).optional().describe('Type of context'),
        workspaceId: z.string().optional().describe('Workspace ID for the context')
      },
      async (args, { meta } = {}) => {
        const user = await this.#authenticateFromMeta(meta);
        return await this.#handleCreateContext(user, args);
      }
    );

    this.#mcpServer.tool(
      'remove_context',
      { contextId: z.string().describe('The ID of the context to remove') },
      async ({ contextId }, { meta } = {}) => {
        const user = await this.#authenticateFromMeta(meta);
        return await this.#handleRemoveContext(user, contextId);
      }
    );

    // Document read-only tools
    this.#mcpServer.tool(
      'find_documents',
      {
        contextId: z.string().describe('The ID of the context to search in'),
        contextPath: z.string().default('/').describe('Context path filter (default: "/")'),
        features: z.array(z.string()).default([]).describe('Feature filters'),
        filters: z.array(z.string()).default([]).describe('Additional filters'),
        limit: z.number().default(50).describe('Maximum number of documents to return')
      },
      async (args, { meta } = {}) => {
        const user = await this.#authenticateFromMeta(meta);
        return await this.#handleFindDocuments(user, args);
      }
    );

    this.#mcpServer.tool(
      'get_document',
      {
        contextId: z.string().describe('The ID of the context containing the document'),
        documentId: z.string().describe('The ID of the document to retrieve')
      },
      async (args, { meta } = {}) => {
        const user = await this.#authenticateFromMeta(meta);
        return await this.#handleGetDocument(user, args);
      }
    );

    this.#mcpServer.tool(
      'query_documents',
      {
        contextId: z.string().describe('The ID of the context to query'),
        query: z.object({
          contextPath: z.string().optional(),
          features: z.array(z.string()).optional(),
          filters: z.array(z.string()).optional(),
          limit: z.number().optional()
        }).describe('Query parameters object')
      },
      async (args, { meta } = {}) => {
        const user = await this.#authenticateFromMeta(meta);
        return await this.#handleQueryDocuments(user, args);
      }
    );

    debug('MCP tools registered');
  }

  /**
   * Setup MCP resources using modern SDK API
   */
  #setupResources() {
    // Context resources
    this.#mcpServer.resource(
      'contexts',
      'canvas://contexts/{contextId}',
      async (uri, { meta } = {}) => {
        const user = await this.#authenticateFromMeta(meta);
        const contextId = this.#extractContextIdFromUri(uri);
        return await this.#handleReadContextResource(user, contextId);
      }
    );

    // Document resources
    this.#mcpServer.resource(
      'documents',
      'canvas://contexts/{contextId}/documents/{documentId}',
      async (uri, { meta } = {}) => {
        const user = await this.#authenticateFromMeta(meta);
        const { contextId, documentId } = this.#extractDocumentIdsFromUri(uri);
        return await this.#handleReadDocumentResource(user, contextId, documentId);
      }
    );

    debug('MCP resources registered');
  }

  /**
   * Authenticate user from meta information
   */
  async #authenticateFromMeta(meta) {
    if (!meta || !meta.authorization) {
      throw new Error('Authentication required');
    }

    const authHeader = meta.authorization;
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Bearer token required');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new Error('Token is empty');
    }

    let user = null;

    // Check if it's an API token
    if (token.startsWith('canvas-')) {
      debug('Authenticating with API token via MCP');
      const tokenResult = await this.#authService.verifyApiToken(token);
      if (!tokenResult) {
        throw new Error('Invalid API token');
      }

      user = await this.#userManager.getUserById(tokenResult.userId);
      if (!user || user.status !== 'active') {
        throw new Error('User not found or inactive');
      }
    } else {
      throw new Error('Only API tokens are currently supported for MCP authentication');
    }

    return user;
  }

  // Context tool handlers
  async #handleListContexts(user) {
    try {
      const contexts = await this.#contextManager.listUserContexts(user.id);
      const contextList = contexts.map(ctx => ({
        id: ctx.id,
        url: ctx.url,
        description: ctx.description || '',
        type: ctx.type || 'context',
        workspaceId: ctx.workspaceId || null,
        created: ctx.created || null,
        updated: ctx.updated || null
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ contexts: contextList }, null, 2)
        }]
      };
    } catch (error) {
      debug(`Error listing contexts: ${error.message}`);
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error listing contexts: ${error.message}`
        }]
      };
    }
  }

  async #handleGetContext(user, contextId) {
    try {
      const context = await this.#contextManager.getContext(user.id, contextId);
      if (!context) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Context not found: ${contextId}`
          }]
        };
      }

      const contextData = {
        id: context.id,
        url: context.url,
        description: context.description || '',
        type: context.type || 'context',
        workspaceId: context.workspaceId || null,
        created: context.created || null,
        updated: context.updated || null
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(contextData, null, 2)
        }]
      };
    } catch (error) {
      debug(`Error getting context ${contextId}: ${error.message}`);
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error getting context: ${error.message}`
        }]
      };
    }
  }

  async #handleCreateContext(user, args) {
    try {
      const context = await this.#contextManager.createContext(
        user.id,
        args.id,
        args.url,
        args.description,
        args.type,
        args.workspaceId
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            context: {
              id: context.id,
              url: context.url,
              description: context.description || '',
              type: context.type || 'context'
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      debug(`Error creating context: ${error.message}`);
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error creating context: ${error.message}`
        }]
      };
    }
  }

  async #handleRemoveContext(user, contextId) {
    try {
      const result = await this.#contextManager.removeContext(user.id, contextId);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Context ${contextId} removed successfully`,
            result
          }, null, 2)
        }]
      };
    } catch (error) {
      debug(`Error removing context ${contextId}: ${error.message}`);
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error removing context: ${error.message}`
        }]
      };
    }
  }

  // Document tool handlers
  async #handleFindDocuments(user, args) {
    try {
      const context = await this.#contextManager.getContext(user.id, args.contextId);
      if (!context) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Context not found: ${args.contextId}`
          }]
        };
      }

      const documents = await context.findDocuments(
        user.id,
        args.contextPath,
        args.features,
        args.filters,
        { limit: args.limit, parse: true }
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ documents }, null, 2)
        }]
      };
    } catch (error) {
      debug(`Error finding documents: ${error.message}`);
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error finding documents: ${error.message}`
        }]
      };
    }
  }

  async #handleGetDocument(user, args) {
    try {
      const context = await this.#contextManager.getContext(user.id, args.contextId);
      if (!context) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Context not found: ${args.contextId}`
          }]
        };
      }

      const document = await context.getDocumentById(user.id, args.documentId, true);
      if (!document) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Document not found: ${args.documentId}`
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(document, null, 2)
        }]
      };
    } catch (error) {
      debug(`Error getting document: ${error.message}`);
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error getting document: ${error.message}`
        }]
      };
    }
  }

  async #handleQueryDocuments(user, args) {
    try {
      const context = await this.#contextManager.getContext(user.id, args.contextId);
      if (!context) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Context not found: ${args.contextId}`
          }]
        };
      }

      const query = args.query || {};
      const documents = await context.findDocuments(
        user.id,
        query.contextPath || '/',
        query.features || [],
        query.filters || [],
        { limit: query.limit || 50, parse: true }
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ query: args.query, documents }, null, 2)
        }]
      };
    } catch (error) {
      debug(`Error querying documents: ${error.message}`);
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error querying documents: ${error.message}`
        }]
      };
    }
  }

  // Resource handlers
  async #handleReadContextResource(user, contextId) {
    try {
      const context = await this.#contextManager.getContext(user.id, contextId);
      if (!context) {
        throw new Error(`Context not found: ${contextId}`);
      }

      const contextData = {
        id: context.id,
        url: context.url,
        description: context.description || '',
        type: context.type || 'context',
        workspaceId: context.workspaceId || null
      };

      return {
        contents: [{
          uri: `canvas://contexts/${contextId}`,
          text: JSON.stringify(contextData, null, 2),
          mimeType: 'application/json'
        }]
      };
    } catch (error) {
      debug(`Error reading context resource ${contextId}: ${error.message}`);
      throw new Error(`Failed to read context resource: ${error.message}`);
    }
  }

  async #handleReadDocumentResource(user, contextId, documentId) {
    try {
      const context = await this.#contextManager.getContext(user.id, contextId);
      if (!context) {
        throw new Error(`Context not found: ${contextId}`);
      }

      const document = await context.getDocumentById(user.id, documentId, true);
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      return {
        contents: [{
          uri: `canvas://contexts/${contextId}/documents/${documentId}`,
          text: JSON.stringify(document, null, 2),
          mimeType: 'application/json'
        }]
      };
    } catch (error) {
      debug(`Error reading document resource ${contextId}/${documentId}: ${error.message}`);
      throw new Error(`Failed to read document resource: ${error.message}`);
    }
  }

  // Utility methods
  #extractContextIdFromUri(uri) {
    const match = uri.href.match(/^canvas:\/\/contexts\/([^\/]+)$/);
    if (!match) {
      throw new Error('Invalid context URI format');
    }
    return match[1];
  }

  #extractDocumentIdsFromUri(uri) {
    const match = uri.href.match(/^canvas:\/\/contexts\/([^\/]+)\/documents\/(.+)$/);
    if (!match) {
      throw new Error('Invalid document URI format');
    }
    return { contextId: match[1], documentId: match[2] };
  }

    /**
   * Create SSE transport for given session and response
   */
  createSSETransport(sessionId, res, token = null) {
    debug(`Creating SSE transport for session: ${sessionId}`);

    // Include token in the endpoint URL for EventSource clients like Cursor
    const endpoint = token ?
      `/mcp/v1/messages?token=${token}&sessionId=${sessionId}` :
      `/mcp/v1/messages?sessionId=${sessionId}`;

    // Use the SSE transport from the SDK
    const transport = new SSEServerTransport(endpoint, res);

    this.#transports.set(sessionId, transport);

    // Handle transport cleanup - keep session alive longer for MCP protocol
    transport.onclose = () => {
      debug(`SSE transport closed for session: ${sessionId}`);
      // Don't immediately delete the transport - MCP clients may need to POST after SSE closes
      setTimeout(() => {
        this.#transports.delete(sessionId);
        debug(`Session ${sessionId} transport cleaned up after delay`);
      }, 60000); // Keep for 60 seconds to allow MCP message exchange
    };

    return transport;
  }

  /**
   * Handle SSE message for given session
   */
  async handleSSEMessage(sessionId, req, res, body) {
    const transport = this.#transports.get(sessionId);
    if (!transport) {
      throw new Error(`No transport found for session: ${sessionId}`);
    }

    // Let the transport handle the message
    await transport.handlePostMessage(req, res, body);
  }

  /**
   * Connect MCP server to transport
   */
  async connect(transport) {
    debug('Connecting MCP server to transport');
    await this.#mcpServer.connect(transport);
    debug('MCP server connected successfully');
  }

  /**
   * Get the underlying MCP server instance
   */
  get server() {
    return this.#mcpServer;
  }
}

export default CanvasMcpServer;
