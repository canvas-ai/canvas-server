'use strict';

import Fastify from 'fastify';
import fastifyAuth from '@fastify/auth';
import fastifyJwt from '@fastify/jwt';
import fastifySocketIO from 'fastify-socket.io';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import fastifyCors from '@fastify/cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../env.js';
import ResponseObject from './ResponseObject.js';

// Auth strategies
import {
  verifyJWT,
  verifyApiToken,
  authService
} from './auth/strategies.js';

// Routes
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces/index.js';
import contextRoutes from './routes/contexts/index.js';
import pubRoutes from './routes/pub/index.js';
import pingRoute from './routes/ping.js';
import schemaRoutes from './routes/schemas.js';
import { mcpPlugin } from './mcp/index.js';

// WebSocket handlers
import setupWebSocketHandlers from './websocket/index.js';

// Logging
import createDebug from 'debug';
const debug = createDebug('canvas-server:api');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Custom Error for Auth Failure
import createError from '@fastify/error';
const AuthError = createError('FST_AUTH_FAILED', 'Authentication Failed: %s', 401);

/**
 * Create and configure the Fastify server
 * @param {Object} options - Server options
 * @returns {FastifyInstance} - Configured Fastify instance
 */
export async function createServer(options = {}) {
  const server = Fastify({
    logger: options.logger || {
      level: env.server.logLevel || 'info',
      transport: {
        target: 'pino-pretty'
      },
      // Disable request/response logging
      serializers: {
        req: () => undefined,  // Skip request logging
        res: () => undefined   // Skip response logging
      }
    },
    trustProxy: true,
    // Disable response validation for better performance during development
    disableResponseValidation: true,
    ignoreTrailingSlash: true
  });

  // Register fastify-jwt FIRST - needed for request.jwtVerify
  await server.register(fastifyJwt, {
    secret: env.auth.jwtSecret,
    sign: {
      expiresIn: '1d'
    },
    // Keep decorateRequest: false as we manually set request.user
    decorateRequest: false
  });

  // Decorate server with our custom verification strategies
  server.decorate('verifyJWT', verifyJWT);
  server.decorate('verifyApiToken', verifyApiToken);

  // Register fastify-auth, which will allow us to chain strategies
  await server.register(fastifyAuth);

  // Define the 'authenticate' decorator using the chained strategies.
  // @fastify/auth will try them in order until one succeeds.
  server.decorate('authenticate', server.auth([
    server.verifyJWT,
    server.verifyApiToken
  ], { relation: 'or' }));

  // Create a custom authentication decorator that handles errors properly
  server.decorate('authenticateCustom', async (request, reply) => {
    try {
      // Try JWT first
      await server.verifyJWT(request, reply);
      return; // Success
    } catch (jwtError) {
      console.log(`[Auth/Custom] JWT failed: ${jwtError.message}`);

      try {
        // Try API token if JWT fails
        await server.verifyApiToken(request, reply);
        return; // Success
      } catch (apiError) {
        console.log(`[Auth/Custom] API token failed: ${apiError.message}`);

        // Both failed - send error response and close connection
        const statusCode = apiError.statusCode || 401;
        reply.header('Connection', 'close');

        const response = new ResponseObject();
        response.error(apiError.message || 'Authentication failed', null, [apiError], statusCode);
        reply.code(statusCode).send(response.getResponse());

        // Force close the connection after sending the response
        setImmediate(() => {
          console.log('Forcing connection close after authentication failure');
          if (reply.raw.socket && !reply.raw.socket.destroyed) {
            reply.raw.socket.end();
          }
        });

        return; // Don't throw - we've handled the error
      }
    }
  });

  // Make managers available
  if (options.userManager) server.decorate('userManager', options.userManager);
  if (options.workspaceManager) server.decorate('workspaceManager', options.workspaceManager);
  if (options.contextManager) server.decorate('contextManager', options.contextManager);
  if (options.authService) server.decorate('authService', options.authService);

  // Register plugins
  await server.register(fastifyCors, {
    origin: options.corsOrigin || true, // Default to allowing all origins, customize in production
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-App-Name', 'X-Selected-Session'],
    exposedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400 // 24 hours
  });

  await server.register(fastifyMultipart, {
    limits: {
      fileSize: options.maxFileSize || 10485760 // 10MB default
    }
  });

  // Register WebSocket support with fastify-socket.io
  await server.register(fastifySocketIO, {
    cors: {
      origin: options.corsOrigin || true,
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Authorization", "Content-Type", "X-App-Name", "X-Selected-Session"]
    },
    transports: ['websocket'] // Force WebSockets, disable long-polling
  });

  // Setup WebSocket handlers
  setupWebSocketHandlers(server);

  // Register event listeners to relay Context events to WebSocket clients
  if (server.contextManager) {
    // Listen for context URL changes and other important events
    server.contextManager.on('context.url.set', (payload) => {
      if (payload && payload.id) {
        try {
          server.broadcastToContext(payload.id, 'context.url.set', payload);
          debug(`Relayed context.url.set event for context ${payload.id} to WebSocket clients`);
        } catch (error) {
          console.error(`Error broadcasting context.url.set event: ${error.message}`);
        }
      }
    });

    // Other important context events can be added here in the same pattern
    server.contextManager.on('context.updated', (payload) => {
      if (payload && payload.id) {
        server.broadcastToContext(payload.id, 'context.updated', payload);
      }
    });

    server.contextManager.on('context.locked', (payload) => {
      if (payload && payload.id) {
        server.broadcastToContext(payload.id, 'context.locked', payload);
      }
    });

    server.contextManager.on('context.unlocked', (payload) => {
      if (payload && payload.id) {
        server.broadcastToContext(payload.id, 'context.unlocked', payload);
      }
    });
  }

  // Static file server for the UI
  await server.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'ui', 'web', 'dist'),
    prefix: '/',
  });

  await authService.initialize();

  // Register routes
  server.register(pingRoute);
  server.register(authRoutes, { prefix: '/rest/v2/auth' });
  server.register(workspaceRoutes, { prefix: '/rest/v2/workspaces' });
  server.register(contextRoutes, { prefix: '/rest/v2/contexts' });
  server.register(pubRoutes, { prefix: '/rest/v2/pub' });
  server.register(schemaRoutes, { prefix: '/rest/v2/schemas' });
  server.register(mcpPlugin); // TODO: Draft/test only!!!

  // Global 404 handler
  server.setNotFoundHandler((request, reply) => {
    // For API routes, return a JSON 404 response
    if (request.url.startsWith('/rest/v2/')) {
      return new ResponseObject(reply).notFound(`Route ${request.method}:${request.url} not found`);
    }

    // For all other routes (UI routes), serve the index.html
    // This supports client-side routing in SPA
    reply.sendFile('index.html');
  });

    // Global error handler
  server.setErrorHandler((error, request, reply) => {
    server.log.error('Global error handler called:', error);
    console.log('Global error handler called:', error.message, 'statusCode:', error.statusCode);

    // Only send error response if a response hasn't been sent yet
    if (!reply.sent) {
      const statusCode = error.statusCode || 500;

      // For authentication errors (401), close the connection to prevent resource exhaustion
      if (statusCode === 401) {
        // Set Connection: close header to signal connection should be closed
        reply.header('Connection', 'close');
        server.log.info('Authentication failed - closing connection');
        console.log('Authentication failed - closing connection');

                // Create and send the error response
        const response = new ResponseObject();
        response.error(error.message || 'Authentication failed', null, statusCode);

        // Send the response and close the connection immediately after
        reply.code(statusCode).send(response.getResponse());

        // Force close the connection after sending the response
        setImmediate(() => {
          server.log.info('Forcing connection close after authentication failure');
          console.log('Forcing connection close after authentication failure');
          if (reply.raw.socket && !reply.raw.socket.destroyed) {
            reply.raw.socket.end();
          }
        });
      } else {
        // Use the generic error method from our ResponseObject for non-auth errors
        const response = new ResponseObject();
        response.error(error.message || 'Something went wrong', null, [error], statusCode);
        reply.code(response.statusCode).send(response.getResponse());
      }
    } else {
      console.log('Reply already sent - not handling error');
    }
  });

  return server;
}

/**
 * Start the API server
 * @param {Object} options - Server options
 * @returns {Promise<FastifyInstance>} - Fastify server instance
 */
export async function startApiServer(options = {}) {
  // Create and configure the Fastify server
  const fastify = await createServer(options);

  // These decorations are now handled in createServer, but we'll keep them here
  // to ensure backward compatibility, only adding if they don't already exist
  if (!fastify.hasDecorator('userManager') && options.userManager)
    fastify.decorate('userManager', options.userManager);
  if (!fastify.hasDecorator('workspaceManager') && options.workspaceManager)
    fastify.decorate('workspaceManager', options.workspaceManager);
  if (!fastify.hasDecorator('contextManager') && options.contextManager)
    fastify.decorate('contextManager', options.contextManager);
  if (!fastify.hasDecorator('authService') && options.authService)
    fastify.decorate('authService', options.authService);

  // Start listening
  const port = options.port || env.server.api.port;
  const host = options.host || env.server.api.host;

  await fastify.listen({ port, host });
  debug(`API server listening on http://${host}:${port}`);

  return fastify;
}

export default createServer;
