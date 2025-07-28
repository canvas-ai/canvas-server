'use strict';

import ResponseObject from '../../ResponseObject.js';
import { validateUser } from '../../auth/strategies.js';

/**
 * Agent routes handler for the API
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Plugin options
 */
export default async function agentRoutes(fastify, options) {

  /**
   * Middleware to validate user
   */
  const validateUserWithResponse = (request, reply) => {
    if (!validateUser(request.user, ['id', 'email'])) {
      const response = new ResponseObject().unauthorized('Valid authentication required');
      return reply.code(response.statusCode).send(response.getResponse());
    }
    return true;
  };

  // List all agents for the authenticated user
  fastify.get('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      if (!validateUserWithResponse(request, reply)) return;

      const { host } = request.query;
      const agents = await fastify.agentManager.listUserAgents(request.user.id, host);

      const response = new ResponseObject().found(agents, 'Agents retrieved successfully', 200, agents.length);
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to list agents');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Create a new agent
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            minLength: 3,
            maxLength: 39,
            pattern: '^[a-z0-9_-]+$',
            description: 'Agent name (3-39 chars, lowercase letters, numbers, underscores, hyphens only)'
          },
          label: { type: 'string' },
          description: { type: 'string' },
          color: { type: 'string', pattern: '^#[0-9A-Fa-f]{3,6}$' },
          llmProvider: {
            type: 'string',
            enum: ['anthropic', 'openai', 'ollama'],
            default: 'anthropic'
          },
          model: { type: 'string' },
          connectors: { type: 'object' },
          prompts: { type: 'object' },
          tools: { type: 'object' },
          mcp: { type: 'object' },
          metadata: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!validateUserWithResponse(request, reply)) return;

      const {
        name,
        label,
        description,
        color,
        llmProvider = 'anthropic',
        model,
        connectors = {},
        prompts = {},
        tools = {},
        mcp = { servers: [] },
        metadata = {}
      } = request.body;

      const agent = await fastify.agentManager.createAgent(
        request.user.id,
        name,
        {
          owner: request.user.id,
          label: label || name,
          description: description || '',
          color,
          llmProvider,
          model,
          connectors,
          prompts,
          tools,
          mcp,
          metadata
        }
      );

      const response = new ResponseObject().created(agent, 'Agent created successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);

      // Handle specific errors
      if (error.message.includes('already exists')) {
        const response = new ResponseObject().conflict(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().serverError(error.message || 'Failed to create agent');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Get agent by ID or name
  fastify.get('/:agentIdentifier', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['agentIdentifier'],
        properties: {
          agentIdentifier: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!validateUserWithResponse(request, reply)) return;

      const agent = await fastify.agentManager.getAgentById(
        request.params.agentIdentifier,
        request.user.id
      );

      if (!agent) {
        const response = new ResponseObject().notFound('Agent not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().found(agent.toJSON(), 'Agent retrieved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to get agent');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Start an agent
  fastify.post('/:agentIdentifier/start', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['agentIdentifier'],
        properties: {
          agentIdentifier: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!validateUserWithResponse(request, reply)) return;

      const agent = await fastify.agentManager.startAgent(
        request.user.id,
        request.params.agentIdentifier,
        request.user.id
      );

      if (!agent) {
        const response = new ResponseObject().notFound('Agent not found or failed to start');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success(agent.toJSON(), 'Agent started successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError(error.message || 'Failed to start agent');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Stop an agent
  fastify.post('/:agentIdentifier/stop', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['agentIdentifier'],
        properties: {
          agentIdentifier: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!validateUserWithResponse(request, reply)) return;

      const success = await fastify.agentManager.stopAgent(
        request.user.id,
        request.params.agentIdentifier,
        request.user.id
      );

      if (!success) {
        const response = new ResponseObject().notFound('Agent not found or failed to stop');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success({ success: true }, 'Agent stopped successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError(error.message || 'Failed to stop agent');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Get agent status
  fastify.get('/:agentIdentifier/status', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['agentIdentifier'],
        properties: {
          agentIdentifier: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!validateUserWithResponse(request, reply)) return;

      const agent = await fastify.agentManager.getAgentById(
        request.params.agentIdentifier,
        request.user.id
      );

      if (!agent) {
        const response = new ResponseObject().notFound('Agent not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const status = {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        isActive: agent.isActive,
        llmProvider: agent.llmProvider,
        model: agent.model,
        lastAccessed: agent.metadata?.lastAccessed || null
      };

      const response = new ResponseObject().found(status, 'Agent status retrieved successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to get agent status');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Chat with an agent
  fastify.post('/:agentIdentifier/chat', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['agentIdentifier'],
        properties: {
          agentIdentifier: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
          context: { type: 'array' },
          mcpContext: { type: 'boolean', default: true },
          maxTokens: { type: 'number' },
          temperature: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!validateUserWithResponse(request, reply)) return;

      const agent = await fastify.agentManager.getAgentById(
        request.params.agentIdentifier,
        request.user.id
      );

      if (!agent) {
        const response = new ResponseObject().notFound('Agent not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      if (!agent.isActive) {
        const response = new ResponseObject().badRequest('Agent is not active. Please start the agent first.');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const { message, context, mcpContext = true, maxTokens, temperature } = request.body;

      const result = await agent.chat(message, {
        context,
        mcpContext,
        maxTokens,
        temperature
      });

      const response = new ResponseObject().success(result, 'Chat response generated successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError(error.message || 'Failed to chat with agent');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Get agent memory
  fastify.get('/:agentIdentifier/memory', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['agentIdentifier'],
        properties: {
          agentIdentifier: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          context: { type: 'string', default: '/' },
          limit: { type: 'number', default: 50 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!validateUserWithResponse(request, reply)) return;

      const agent = await fastify.agentManager.getAgentById(
        request.params.agentIdentifier,
        request.user.id
      );

      if (!agent) {
        const response = new ResponseObject().notFound('Agent not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      if (!agent.isActive) {
        const response = new ResponseObject().badRequest('Agent is not active');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const { query, context = '/', limit = 50 } = request.query;

      let memory;
      if (query) {
        memory = await agent.queryMemory(query, context, { limit });
      } else {
        // List recent memories
        memory = await agent.db.findDocuments(context, [], [], { parse: true });
        memory = memory.slice(0, limit);
      }

      const response = new ResponseObject().found(memory, 'Agent memory retrieved successfully', 200, memory.length);
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to get agent memory');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Clear agent memory
  fastify.delete('/:agentIdentifier/memory', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['agentIdentifier'],
        properties: {
          agentIdentifier: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!validateUserWithResponse(request, reply)) return;

      const agent = await fastify.agentManager.getAgentById(
        request.params.agentIdentifier,
        request.user.id
      );

      if (!agent) {
        const response = new ResponseObject().notFound('Agent not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      if (!agent.isActive) {
        const response = new ResponseObject().badRequest('Agent is not active');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const success = await agent.clearMemory();

      const response = new ResponseObject().success({ success }, 'Agent memory cleared successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to clear agent memory');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Get agent MCP tools
  fastify.get('/:agentIdentifier/mcp/tools', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['agentIdentifier'],
        properties: {
          agentIdentifier: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!validateUserWithResponse(request, reply)) return;

      const agent = await fastify.agentManager.getAgentById(
        request.params.agentIdentifier,
        request.user.id
      );

      if (!agent) {
        const response = new ResponseObject().notFound('Agent not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      if (!agent.isActive) {
        const response = new ResponseObject().badRequest('Agent is not active');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const tools = await agent.getMCPTools();

      const response = new ResponseObject().found(tools, 'MCP tools retrieved successfully', 200, tools.length);
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to get MCP tools');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Call an MCP tool
  fastify.post('/:agentIdentifier/mcp/tools/:toolName', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['agentIdentifier', 'toolName'],
        properties: {
          agentIdentifier: { type: 'string' },
          toolName: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          arguments: { type: 'object' },
          source: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!validateUserWithResponse(request, reply)) return;

      const agent = await fastify.agentManager.getAgentById(
        request.params.agentIdentifier,
        request.user.id
      );

      if (!agent) {
        const response = new ResponseObject().notFound('Agent not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      if (!agent.isActive) {
        const response = new ResponseObject().badRequest('Agent is not active');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const { toolName } = request.params;
      const { arguments: args = {}, source } = request.body;

      const result = await agent.callMCPTool(toolName, args, source);

      const response = new ResponseObject().success(result, 'MCP tool executed successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError(error.message || 'Failed to execute MCP tool');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });
}
