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
import userRoutes from './routes/users/index.js';
import pingRoute from './routes/ping.js';
import schemaRoutes from './routes/schemas.js';
import mcpRoutes from './mcp/routes.js';

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
    secret: env.auth.jwtSecret || 'change-this-secret-in-production',
    sign: {
      expiresIn: '1d'
    },
    // Keep decorateRequest: false as we manually set request.user
    decorateRequest: false
  });

  // Remove fastify-auth registration if ONLY used for the main authenticate hook
  // await server.register(fastifyAuth);

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
    server.contextManager.on('context:url:changed', (payload) => {
      if (payload && payload.id) {
        try {
          server.broadcastToContext(payload.id, 'context:url:changed', payload);
          debug(`Relayed context:url:changed event for context ${payload.id} to WebSocket clients`);
        } catch (error) {
          console.error(`Error broadcasting context:url:changed event: ${error.message}`);
        }
      }
    });

    // Other important context events can be added here in the same pattern
    server.contextManager.on('context:updated', (payload) => {
      if (payload && payload.id) {
        server.broadcastToContext(payload.id, 'context:updated', payload);
      }
    });

    server.contextManager.on('context:locked', (payload) => {
      if (payload && payload.id) {
        server.broadcastToContext(payload.id, 'context:locked', payload);
      }
    });

    server.contextManager.on('context:unlocked', (payload) => {
      if (payload && payload.id) {
        server.broadcastToContext(payload.id, 'context:unlocked', payload);
      }
    });
  }

  // Static file server for the UI
  await server.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'ui', 'web', 'dist'),
    prefix: '/',
  });

  // Define MANUAL authentication decorator
  server.decorate('authenticate', async function(request, reply) {
    try {
      console.log(`[Auth Manual] Processing auth for ${request.method} ${request.url}`);
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[Auth Manual] No Bearer token or invalid format');
        throw new AuthError('Bearer token required');
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        console.log('[Auth Manual] Empty token');
        throw new AuthError('Token is empty');
      }

      let user = null;

      // Check for API token first
      if (token.startsWith('canvas-')) {
        console.log(`[Auth Manual/API] Verifying API token: ${token.substring(0, 10)}...`);
        const authService = request.server.authService;
        const userManager = request.server.userManager;
        if (!authService || !userManager) throw new Error('Auth service or user manager not initialized');

        let tokenResult;
        try {
          tokenResult = await authService.verifyApiToken(token);
        } catch (tokenError) {
          console.error(`[Auth Manual/API] Token verification error: ${tokenError.message}`);
          throw new AuthError(`API token verification failed: ${tokenError.message}`);
        }

        if (!tokenResult) {
          console.error('[Auth Manual/API] Invalid API token - verification returned null');
          throw new AuthError('Invalid API token');
        }

        let dbUser;
        try {
          dbUser = await userManager.getUserById(tokenResult.userId);
        } catch (userError) {
          console.error(`[Auth Manual/API] Error retrieving user: ${userError.message}`);
          throw new Error(`Error retrieving user: ${userError.message}`); // Internal error potentially
        }

        if (!dbUser) {
          console.error(`[Auth Manual/API] User not found for token userId: ${tokenResult.userId}`);
          throw new AuthError('User not found for this API token');
        }
        if (dbUser.status !== 'active') {
           console.error(`[Auth Manual/API] User account not active: ${dbUser.status}`);
           throw new AuthError('User account is not active');
        }

        user = {
          id: dbUser.id,
          email: dbUser.email ? dbUser.email.toLowerCase() : null,
          userType: dbUser.userType || 'user',
          status: dbUser.status || 'active'
        };
        request.isApiTokenAuth = true; // Keep flag if needed elsewhere
        request.token = tokenResult.tokenId;
        console.log(`[Auth Manual/API] Authentication successful for user: ${user.id}`);

      } else {
        // Assume JWT
        console.log('[Auth Manual/JWT] Verifying JWT token...');
        const userManager = request.server.userManager;
        if (!userManager) throw new Error('User manager not initialized');

        let decoded;
        try {
          // request.jwtVerify() is available from @fastify/jwt
          decoded = await request.jwtVerify();
        } catch (jwtError) {
          console.error(`[Auth Manual/JWT] JWT verification failed: ${jwtError.message}`);
          throw new AuthError(`JWT verification failed: ${jwtError.message}`);
        }

        let dbUser;
        try {
          dbUser = await userManager.getUserById(decoded.sub);
        } catch (userError) {
          console.error(`[Auth Manual/JWT] Error retrieving user: ${userError.message}`);
          throw new Error(`Error retrieving user: ${userError.message}`); // Internal error potentially
        }

        if (!dbUser) {
          console.error(`[Auth Manual/JWT] User not found: ${decoded.sub}`);
          throw new AuthError(`User not found: ${decoded.sub}`);
        }
        if (dbUser.status !== 'active') {
          console.log(`[Auth Manual/JWT] User ${dbUser.id} not active (${dbUser.status})`);
          throw new AuthError('User account is not active');
        }
        // Optional: Check token version if needed (logic from verifyJWT)
        if (decoded.ver && (dbUser.updated || dbUser.created)) {
          const userVersion = dbUser.updated || dbUser.created;
          if (decoded.ver !== userVersion) {
            console.log(`[Auth Manual/JWT] Token version mismatch: ${decoded.ver} vs ${userVersion}`);
            throw new AuthError('Token is invalid - user data has changed');
          }
        }

        user = {
          id: dbUser.id,
          email: dbUser.email ? dbUser.email.toLowerCase() : null,
          userType: dbUser.userType || 'user',
          status: dbUser.status || 'active'
        };
        request.isJwtAuth = true; // Keep flag if needed elsewhere
        console.log(`[Auth Manual/JWT] Authentication successful for user: ${user.id}`);
      }

      // If we successfully got a user object
      if (user && user.id) {
        request.user = user; // Set the user object on the request
      } else {
        // This case should ideally be caught by specific errors above
        console.error('[Auth Manual] Auth succeeded but failed to produce valid user object.');
        throw new AuthError('Authentication succeeded but user data is invalid');
      }

    } catch (error) {
      console.log(`[Auth Manual] Authentication failed: ${error.message}`);
      if (!reply.sent) {
        // Use status code from AuthError if available, otherwise default to 401
        const statusCode = error.statusCode || 401;
        const response = new ResponseObject().error(error.message || 'Authentication required', null, statusCode);
        reply.code(response.statusCode).send(response.getResponse());
      }
      // Throw the error to stop the request lifecycle via Fastify's error handling
      throw error;
    }
  });

  await authService.initialize();
  // Register routes
  server.register(pingRoute);
  server.register(authRoutes, { prefix: '/rest/v2/auth' });
  server.register(workspaceRoutes, { prefix: '/rest/v2/workspaces' });
  server.register(contextRoutes, { prefix: '/rest/v2/contexts' });
  server.register(userRoutes, { prefix: '/rest/v2/users' });
  server.register(schemaRoutes, { prefix: '/rest/v2/schemas' });
  server.register(mcpRoutes); // MCP routes don't need prefix as they define their own paths

  // Global 404 handler
  server.setNotFoundHandler((request, reply) => {
    // For API routes, return a JSON 404 response
    if (request.url.startsWith('/rest/v2/')) {
      const response = new ResponseObject().notFound(`Route ${request.method}:${request.url} not found`);
      return reply.code(response.statusCode).send(response.getResponse());
    }

    // For all other routes (UI routes), serve the index.html
    // This supports client-side routing in SPA
    reply.sendFile('index.html');
  });

  // Global error handler
  server.setErrorHandler((error, request, reply) => {
    server.log.error(error);

    // Only send error response if a response hasn't been sent yet
    if (!reply.sent) {
      // Send appropriate error response
      const statusCode = error.statusCode || 500;
      const response = new ResponseObject().error(
        error.message || 'Something went wrong',
        null,
        statusCode
      );
      reply.code(response.statusCode).send(response.getResponse());
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
