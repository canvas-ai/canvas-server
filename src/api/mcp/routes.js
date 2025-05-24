'use strict';

import CanvasMcpServer from './index.js';
import createDebug from 'debug';

const debug = createDebug('canvas-server:mcp:routes');

/**
 * MCP routes for Fastify integration
 * Provides SSE-based MCP endpoints with authentication
 */
export default async function mcpRoutes(fastify, options) {
  // Store MCP server instance and active sessions
  let mcpServer = null;
  const activeSessions = new Map();

  // Initialize MCP server with Canvas dependencies
  fastify.addHook('onReady', async () => {
    mcpServer = new CanvasMcpServer({
      contextManager: fastify.contextManager,
      userManager: fastify.userManager,
      authService: fastify.authService
    });
    debug('MCP server initialized and ready');
  });

  // Helper function to authenticate MCP requests
  const authenticateBasic = async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.code(401).send({ error: 'Bearer token required' });
        return null;
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        reply.code(401).send({ error: 'Token is empty' });
        return null;
      }

      let user = null;

      // Check if it's an API token
      if (token.startsWith('canvas-')) {
        debug('Authenticating with API token');
        const tokenResult = await fastify.authService.verifyApiToken(token);
        if (!tokenResult) {
          reply.code(401).send({ error: 'Invalid API token' });
          return null;
        }

        user = await fastify.userManager.getUserById(tokenResult.userId);
        if (!user || user.status !== 'active') {
          reply.code(401).send({ error: 'User not found or inactive' });
          return null;
        }
      } else {
        // For JWT tokens, we can use Fastify's built-in verification
        try {
          await request.jwtVerify();
          user = request.user;
        } catch (jwtError) {
          debug(`JWT verification failed: ${jwtError.message}`);
          reply.code(401).send({ error: 'Invalid JWT token' });
          return null;
        }
      }

      return user;
    } catch (error) {
      debug(`Authentication error: ${error.message}`);
      reply.code(401).send({ error: 'Authentication failed' });
      return null;
    }
  };

  // MCP v1 SSE endpoint - establishes SSE connection
  fastify.get('/mcp/v1/sse', {
    preValidation: async (request, reply) => {
      // Custom validation to allow either header or query token
      if (!request.headers.authorization && !request.query.token) {
        reply.code(400).send({ error: 'Authentication required via Authorization header or token query parameter' });
        return;
      }
    },
    schema: false // Disable all schema validation for this route
  }, async (request, reply) => {
    debug('New MCP SSE connection request');

    // Enhanced authentication that supports both header and query parameter
    let user = null;

    // Try header authentication first
    if (request.headers.authorization) {
      user = await authenticateBasic(request, reply);
      if (!user) {
        return; // Error already sent by authenticateBasic
      }
    } else if (request.query.token) {
      // Try query parameter authentication for EventSource compatibility
      try {
        const token = request.query.token;
        debug('Authenticating SSE with query token');

        if (token.startsWith('canvas-')) {
          const tokenResult = await fastify.authService.verifyApiToken(token);
          if (!tokenResult) {
            reply.code(401).send({ error: 'Invalid API token' });
            return;
          }

          user = await fastify.userManager.getUserById(tokenResult.userId);
          if (!user || user.status !== 'active') {
            reply.code(401).send({ error: 'User not found or inactive' });
            return;
          }
        } else {
          reply.code(401).send({ error: 'Invalid token format' });
          return;
        }
      } catch (error) {
        debug(`Query token authentication error: ${error.message}`);
        reply.code(401).send({ error: 'Authentication failed' });
        return;
      }
    } else {
      reply.code(401).send({ error: 'Authentication required via Authorization header or token query parameter' });
      return;
    }

    // Generate or use provided session ID
    const sessionId = request.query.sessionId || `mcp-${Date.now()}-${Math.random().toString(36).substring(2)}`;

    try {
      debug(`Creating MCP SSE session: ${sessionId} for user: ${user.id}`);

      // Store session info
      activeSessions.set(sessionId, {
        userId: user.id,
        userEmail: user.email,
        startTime: new Date(),
        lastActivity: new Date()
      });

      // Create and connect MCP transport with token info
      const token = request.headers.authorization ?
        request.headers.authorization.split(' ')[1] :
        request.query.token;
      const transport = mcpServer.createSSETransport(sessionId, reply.raw, token);

      // Store auth info for this session so the MCP server can access it
      const authToken = request.headers.authorization || `Bearer ${request.query.token}`;

      // Override transport message handling to inject authentication
      const originalHandleMessage = transport.handleMessage.bind(transport);
      transport.handleMessage = async (message) => {
        // Inject authentication context for all MCP requests
        const contextWithAuth = {
          ...message,
          meta: {
            ...(message.meta || {}),
            authorization: authToken,
            userId: user.id,
            sessionId: sessionId
          }
        };
        return originalHandleMessage(contextWithAuth);
      };

      await mcpServer.connect(transport);

      // Handle connection cleanup - but keep session alive longer for message handling
      reply.raw.on('close', () => {
        debug(`MCP SSE connection closed for session: ${sessionId}`);
        // Delay session cleanup to allow for MCP message exchange after SSE closes
        setTimeout(() => {
          activeSessions.delete(sessionId);
          debug(`Session ${sessionId} cleaned up`);
        }, 60000); // Keep session for 60 seconds to match transport cleanup
      });

      debug(`MCP SSE connection established for session: ${sessionId}`);

    } catch (error) {
      debug(`Error establishing MCP SSE connection: ${error.message}`);
      // Only send error response if headers haven't been sent yet
      if (!reply.raw.headersSent) {
        reply.code(500).send({ error: 'Failed to establish MCP connection' });
      } else {
        // If headers already sent, close the connection
        reply.raw.end();
      }
      // Clean up session if it was created
      if (activeSessions.has(sessionId)) {
        activeSessions.delete(sessionId);
      }
    }
  });

  // MCP v1 message endpoint - handles POST messages for SSE transport
  fastify.post('/mcp/v1/messages', {
    preValidation: async (request, reply) => {
      // Custom validation to allow either header or query token (like SSE endpoint)
      if (!request.headers.authorization && !request.query.token) {
        reply.code(400).send({ error: 'Authentication required via Authorization header or token query parameter' });
        return;
      }
    },
    schema: {
      description: 'Send message to MCP server via SSE transport',
      tags: ['MCP'],
      querystring: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'Session ID for the MCP connection'
          },
          token: {
            type: 'string',
            description: 'API token for authentication (alternative to Authorization header)'
          }
        },
        required: ['sessionId']
      },
      body: {
        type: 'object',
        description: 'MCP message payload'
      }
    }
  }, async (request, reply) => {
    debug('MCP message received');

    // Enhanced authentication that supports both header and query parameter
    let user = null;

    // Try header authentication first
    if (request.headers.authorization) {
      user = await authenticateBasic(request, reply);
      if (!user) {
        return; // Error already sent by authenticateBasic
      }
    } else if (request.query.token) {
      // Try query parameter authentication for EventSource compatibility
      try {
        const token = request.query.token;
        debug('Authenticating message with query token');

        if (token.startsWith('canvas-')) {
          const tokenResult = await fastify.authService.verifyApiToken(token);
          if (!tokenResult) {
            reply.code(401).send({ error: 'Invalid API token' });
            return;
          }

          user = await fastify.userManager.getUserById(tokenResult.userId);
          if (!user || user.status !== 'active') {
            reply.code(401).send({ error: 'User not found or inactive' });
            return;
          }
        } else {
          reply.code(401).send({ error: 'Invalid token format' });
          return;
        }
      } catch (error) {
        debug(`Query token authentication error: ${error.message}`);
        reply.code(401).send({ error: 'Authentication failed' });
        return;
      }
    } else {
      reply.code(401).send({ error: 'Authentication required via Authorization header or token query parameter' });
      return;
    }

    const sessionId = request.query.sessionId;
    if (!sessionId) {
      reply.code(400).send({ error: 'sessionId is required' });
      return;
    }

    // Verify session exists and belongs to the authenticated user
    const session = activeSessions.get(sessionId);
    if (!session) {
      reply.code(404).send({ error: 'Session not found' });
      return;
    }

    if (session.userId !== user.id) {
      reply.code(403).send({ error: 'Session does not belong to authenticated user' });
      return;
    }

    try {
      // Update session activity
      session.lastActivity = new Date();

      // Create message with authentication context
      const authToken = request.headers.authorization || `Bearer ${request.query.token}`;
      const messageWithAuth = {
        ...request.body,
        meta: {
          ...(request.body?.meta || {}),
          authorization: authToken,
          userId: user.id,
          sessionId: sessionId
        }
      };

      // Handle the message via MCP server
      await mcpServer.handleSSEMessage(sessionId, request.raw, reply.raw, messageWithAuth);

      debug(`MCP message processed for session: ${sessionId}`);
    } catch (error) {
      debug(`Error processing MCP message for session ${sessionId}: ${error.message}`);
      reply.code(500).send({ error: 'Failed to process MCP message' });
    }
  });

  // MCP status/info endpoint
  fastify.get('/mcp/v1/status', {
    schema: {
      description: 'Get MCP server status and capabilities',
      tags: ['MCP'],
      headers: {
        type: 'object',
        properties: {
          authorization: {
            type: 'string',
            description: 'Bearer token for authentication'
          }
        },
        required: ['authorization']
      }
    }
  }, async (request, reply) => {
    // Authenticate the user
    const user = await authenticateBasic(request, reply);
    if (!user) {
      return; // Error already sent by authenticateBasic
    }

    try {
      const activeSessionCount = Array.from(activeSessions.keys()).length;
      const status = {
        name: 'canvas-server-mcp',
        version: '1.0.0',
        protocol: 'mcp/v1',
        transport: 'sse',
        capabilities: {
          resources: true,
          tools: true,
          prompts: false
        },
        activeSessions: activeSessionCount,
        serverTime: new Date().toISOString(),
        endpoints: {
          sse: '/mcp/v1/sse',
          messages: '/mcp/v1/messages',
          status: '/mcp/v1/status'
        },
        supportedOperations: {
          contexts: ['list', 'get', 'create', 'remove'],
          documents: ['find', 'get', 'query']
        }
      };

      reply.send(status);
    } catch (error) {
      debug(`Error getting MCP status: ${error.message}`);
      reply.code(500).send({ error: 'Failed to get MCP status' });
    }
  });

  // MCP sessions management endpoint (for debugging/monitoring)
  fastify.get('/mcp/v1/sessions', {
    schema: {
      description: 'List active MCP sessions (admin only)',
      tags: ['MCP'],
      headers: {
        type: 'object',
        properties: {
          authorization: {
            type: 'string',
            description: 'Bearer token for authentication'
          }
        },
        required: ['authorization']
      }
    }
  }, async (request, reply) => {
    // Authenticate the user
    const user = await authenticateBasic(request, reply);
    if (!user) {
      return;
    }

    // Simple check for admin privileges (you may want to implement proper role-based access)
    if (user.userType !== 'admin' && user.email !== 'admin@canvas.local') {
      reply.code(403).send({ error: 'Admin access required' });
      return;
    }

    try {
      const sessions = Array.from(activeSessions.entries()).map(([sessionId, session]) => ({
        sessionId,
        userId: session.userId,
        userEmail: session.userEmail,
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        duration: new Date() - session.startTime
      }));

      reply.send({ sessions, count: sessions.length });
    } catch (error) {
      debug(`Error listing MCP sessions: ${error.message}`);
      reply.code(500).send({ error: 'Failed to list MCP sessions' });
    }
  });

  debug('MCP routes registered');
}
