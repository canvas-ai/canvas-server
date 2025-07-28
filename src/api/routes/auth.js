'use strict';

import { authService, imapAuthStrategy, login, register, verifyEmail, requestEmailVerification, requestPasswordReset, resetPassword, validateUser } from '../auth/strategies.js';
import SecurityUtils from '../utils/security.js';
import { createRateLimiter, clearRateLimit } from '../middleware/rate-limiter.js';
import ResponseObject from '../ResponseObject.js';

/**
 * Auth routes handler for the API
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Plugin options
 */
export default async function authRoutes(fastify, options) {
  // Get authentication configuration
  fastify.get('/config', async (request, reply) => {
    try {
      await imapAuthStrategy.initialize();

      const config = {
        strategies: {
          local: { enabled: true },
          imap: {
            enabled: imapAuthStrategy.isEnabled(),
            domains: imapAuthStrategy.getAvailableDomains()
          }
        }
      };

      const response = new ResponseObject().success(config, 'Authentication configuration retrieved');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to retrieve authentication configuration');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Login endpoint
  fastify.post('/login', {
    preHandler: [createRateLimiter()],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          strategy: { type: 'string', enum: ['local', 'imap', 'auto'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Check if userManager is available
      if (!fastify.userManager) {
        fastify.log.error('User manager not available in login endpoint');
        const response = new ResponseObject().serverError('User management system not available');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const { email, password, strategy = 'auto' } = request.body;

      // Ensure IMAP strategy is initialized before login attempt
      if (strategy === 'imap' || strategy === 'auto') {
        try {
          await imapAuthStrategy.initialize();
        } catch (error) {
          fastify.log.warn(`IMAP strategy initialization failed: ${error.message}. IMAP login may be unavailable.`);
          // If strategy is explicitly 'imap', fail fast
          if (strategy === 'imap') {
            const response = new ResponseObject().serverError('IMAP authentication is not available.');
            return reply.code(response.statusCode).send(response.getResponse());
          }
        }
      }

      const result = await login(email, password, fastify.userManager, strategy);

      // Clear rate limit on successful login
      clearRateLimit(request);

      // Generate JWT token
      const token = authService.generateJWT(result.user);

      const response = new ResponseObject().success({
        token,
        user: {
          id: result.user.id,
          name: result.user.name || result.user.email,
          email: result.user.email,
          authMethod: result.authMethod || 'local'
        }
      }, 'Login successful');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      if (error.code === 'ERR_INVALID_CREDENTIALS') {
        fastify.log.info(`Login failed: ${error.message}`);
        const response = new ResponseObject().unauthorized(error.message || 'Login failed');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // Handle IMAP-specific errors with more descriptive messages
      if (error.code === 'ERR_IMAP_AUTH') {
        fastify.log.info(`IMAP login failed: ${error.message}`);
        const response = new ResponseObject().unauthorized(error.message || 'Email server authentication failed');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      if (error.code === 'ERR_IMAP_CONFIG') {
        fastify.log.info(`IMAP config error: ${error.message}`);
        const response = new ResponseObject().badRequest('Unsupported login domain - email server not configured');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // Check if error message indicates unsupported domain
      if (error.message && error.message.includes('not supported for domain')) {
        fastify.log.info(`Unsupported domain: ${error.message}`);
        const response = new ResponseObject().badRequest('Unsupported login domain - please check your email address or contact administrator');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      fastify.log.error(error);
      const response = new ResponseObject().serverError(error.message || 'An unexpected error occurred during login');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Logout endpoint (client-side only)
  fastify.post('/logout', {
  }, async (request, reply) => {
    const response = new ResponseObject().success({ success: true }, 'Logout successful');
    return reply.code(response.statusCode).send(response.getResponse());
  });

  // Register endpoint
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: {
            type: 'string',
            minLength: 3,
            maxLength: 39,
            pattern: '^[a-z0-9._-]+$',
            description: 'Username (3-39 chars, lowercase letters, numbers, underscores, hyphens, dots only)'
          },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 12 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Validate input data
      const { name, email, password } = request.body;

      // Validate email format
      if (!SecurityUtils.validateEmail(email)) {
        const response = new ResponseObject().badRequest('Invalid email format');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // Validate username
      const usernameValidation = SecurityUtils.validateUsername(name);
      if (!usernameValidation.valid) {
        const response = new ResponseObject().badRequest(`Username validation failed: ${usernameValidation.errors.join(', ')}`);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // Validate password
      const securityConfig = SecurityUtils.loadSecurityConfig();
      const passwordPolicy = securityConfig?.strategies?.local?.passwordPolicy;
      if (passwordPolicy) {
        const passwordValidation = SecurityUtils.validatePassword(password, passwordPolicy);
        if (!passwordValidation.valid) {
          const response = new ResponseObject().badRequest(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
          return reply.code(response.statusCode).send(response.getResponse());
        }
      }

      const result = await register(request.body, fastify.userManager);

      if (!result.success) {
        const response = new ResponseObject().badRequest(result.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const message = result.data.requireEmailVerification 
        ? 'Registration successful. Please check your email to verify your account.'
        : 'Registration successful';

      const response = new ResponseObject().created(result.data, message);
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error('[Register Route Error]', error.message);

      // Provide specific error messages for validation
      if (error.message.includes('validation failed')) {
        const response = new ResponseObject().badRequest(error.message);
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().serverError('Registration failed');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Update password endpoint
  fastify.put('/password', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', minLength: 1 },
          newPassword: { type: 'string', minLength: 8 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { currentPassword, newPassword } = request.body;
      const validPassword = await authService.verifyPassword(request.user.id, currentPassword);

      if (!validPassword) {
        const response = new ResponseObject().unauthorized('Current password is incorrect');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      await authService.setPassword(request.user.id, newPassword);
      const response = new ResponseObject().success({ success: true }, 'Password updated successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to update password');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Forgot password endpoint
  fastify.post('/forgot-password', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const result = await requestPasswordReset(request.body.email, fastify.userManager);
      const response = new ResponseObject().success({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.'
      }, 'Password reset email sent');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to process password reset request');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Reset password endpoint
  fastify.post('/reset-password', {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { token, newPassword } = request.body;
      const success = await resetPassword(token, newPassword, fastify.userManager);

      if (!success) {
        const response = new ResponseObject().badRequest('Password reset token is invalid or expired');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success({ success: true }, 'Password reset successful');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to reset password');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Request email verification endpoint
  fastify.post('/request-email-verification', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const result = await requestEmailVerification(request.body.email, fastify.userManager);
      const response = new ResponseObject().success({
        success: true,
        message: result.message
      }, 'Email verification request processed');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to process email verification request');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Verify email token endpoint
  fastify.get('/verify-email/:token', {
    schema: {
      params: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const updatedUser = await verifyEmail(request.params.token, fastify.userManager);
      const response = new ResponseObject().success({ 
        success: true,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          emailVerified: updatedUser.emailVerified
        }
      }, 'Email verified successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      if (error.code === 'ERR_INVALID_TOKEN') {
        const response = new ResponseObject().badRequest('Invalid or expired verification token');
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().serverError('Failed to verify email');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // List API tokens endpoint
  fastify.get('/tokens', {
    onRequest: [fastify.authenticate]

  }, async (request, reply) => {
    try {
      const tokens = await authService.listTokens(request.user.id);
      const response = new ResponseObject().found(tokens, 'API tokens retrieved successfully', 200, tokens.length);
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to list API tokens');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Create API token endpoint
  fastify.post('/tokens', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const token = await authService.createToken(request.user.id, request.body);
      const response = new ResponseObject().created({
        id: token.id,
        token: token.value,
        name: token.name,
        description: token.description,
        createdAt: token.createdAt
      }, 'API token created successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to create API token');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Delete API token endpoint
  fastify.delete('/tokens/:tokenId', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['tokenId'],
        properties: {
          tokenId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const success = await authService.deleteToken(request.user.id, request.params.tokenId);
      if (!success) {
        const response = new ResponseObject().notFound('Token not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().success({ success: true }, 'Token deleted successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to delete token');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Update API token endpoint
  fastify.put('/tokens/:tokenId', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['tokenId'],
        properties: {
          tokenId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const result = await authService.updateToken(request.user.id, request.params.tokenId, request.body);
      if (!result) {
        const response = new ResponseObject().notFound('Token not found');
        return reply.code(response.statusCode).send(response.getResponse());
      }
      const response = new ResponseObject().success(result, 'Token updated successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to update token');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Verify token endpoint (no auth required)
  fastify.post('/token/verify', {
    schema: {
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const result = await authService.verifyToken(request.body.token);

      if (!result.valid) {
        const response = new ResponseObject().unauthorized('Invalid token');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      const response = new ResponseObject().success({
        valid: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          userType: result.user.userType
        }
      }, 'Token verified successfully');
      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      fastify.log.error(error);
      const response = new ResponseObject().serverError('Failed to verify token');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });

  // Get current user endpoint
  fastify.get('/me', {
    onRequest: [fastify.authenticateCustom]

  }, async (request, reply) => {
    // Check if reply has already been sent by auth middleware or other mechanism
    if (reply.sent) {
      fastify.log.warn('[Auth/Me] Reply already sent before handler execution');
      return;
    }

    try {
      // Enhanced logging for debugging authentication issues
      fastify.log.info(`[Auth/Me] Request received, headers: ${JSON.stringify({
        authorization: request.headers.authorization ? `Bearer ${request.headers.authorization.substring(7, 16)}...` : undefined,
        'user-agent': request.headers['user-agent'],
        referer: request.headers.referer
      })}`);

      fastify.log.info(`[Auth/Me] Request user object: ${request.user ? `id=${request.user.id}` : 'undefined'}`);

      let userId = null;
      let userData = null;

      // First attempt: Check if auth middleware set the user object
      if (request.user && request.user.id) {
        userId = request.user.id;
        fastify.log.info(`[Auth/Me] Using user ID from request: ${userId}`);
      }
      // Second attempt: Try to extract user ID from token
      else {
        fastify.log.warn('[Auth/Me] User object missing or incomplete, attempting token extraction');

        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          fastify.log.error('[Auth/Me] No valid authorization header found');
          const response = new ResponseObject().unauthorized('Authentication required');
          return reply.code(response.statusCode).send(response.getResponse());
        }

        const token = authHeader.split(' ')[1];
        fastify.log.info(`[Auth/Me] Attempting manual token validation: ${token.substring(0, 10)}...`);

        try {
          // Handle API token
          if (token.startsWith('canvas-')) {
            fastify.log.info('[Auth/Me] Detected API token, verifying manually');
            const tokenResult = await fastify.authService.verifyApiToken(token);
            if (tokenResult) {
              userId = tokenResult.userId;
              fastify.log.info(`[Auth/Me] API token validation successful: ${userId}`);
            }
          }
          // Handle JWT token
          else {
            fastify.log.info('[Auth/Me] Attempting JWT verification');
            const decoded = fastify.jwt.verify(token);
            userId = decoded.sub;
            fastify.log.info(`[Auth/Me] JWT verification successful: ${userId}`);
          }
        } catch (tokenError) {
          fastify.log.error(`[Auth/Me] Token validation failed: ${tokenError.message}`);
          const response = new ResponseObject().unauthorized(`Invalid token: ${tokenError.message}`);
          return reply.code(response.statusCode).send(response.getResponse());
        }
      }

      // Verify we have a user ID
      if (!userId) {
        fastify.log.error('[Auth/Me] Failed to extract user ID from request or token');
        const response = new ResponseObject().unauthorized('Authentication failed - unable to identify user');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // Get user data from database
      try {
        userData = await fastify.userManager.getUserById(userId);

        if (!userData) {
          fastify.log.error(`[Auth/Me] User not found in database: ${userId}`);
          const response = new ResponseObject().unauthorized(`Authentication failed - user account no longer exists: ${userId}`);
          return reply.code(response.statusCode).send(response.getResponse());
        }

        fastify.log.info(`[Auth/Me] Successfully retrieved user data: ${userData.id}`);
      } catch (dbError) {
        fastify.log.error(`[Auth/Me] Database error: ${dbError.message}`);

        // Handle the specific case where user exists in token but not in database
        if (dbError.message.includes('User not found in index')) {
          fastify.log.warn(`[Auth/Me] User ${userId} has valid token but missing from database - clearing authentication`);

          // Return a specific error that the frontend can handle
          const response = new ResponseObject().unauthorized(
            'Your session is invalid. Please log in again.',
            {
              code: 'USER_NOT_FOUND_IN_DATABASE',
              userId: userId,
              action: 'logout'
            }
          );
          return reply.code(response.statusCode).send(response.getResponse());
        }

        // For other database errors, return a generic server error
        const response = new ResponseObject().serverError('Database error when retrieving user profile');
        return reply.code(response.statusCode).send(response.getResponse());
      }

      // Check if reply has been sent during our manual auth process
      if (reply.sent) {
        fastify.log.warn('[Auth/Me] Reply already sent during handler execution');
        return;
      }

      // Return user profile
      const response = new ResponseObject().found({
        id: userData.id,
        name: userData.name || userData.email,
        email: userData.email,
        userType: userData.userType || 'user',
        status: userData.status || 'active'
      }, 'User profile retrieved successfully');

      return reply.code(response.statusCode).send(response.getResponse());
    } catch (error) {
      // Check if reply has been sent before responding to error
      if (reply.sent) {
        fastify.log.error(`[Auth/Me] Error after reply already sent: ${error.message}`);
        return;
      }

      fastify.log.error(`[Auth/Me] Unexpected error: ${error.message}`, error);
      const response = new ResponseObject().serverError('Failed to get user profile');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });
}
