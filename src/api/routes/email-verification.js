'use strict';

import { verifyEmail } from '../auth/strategies.js';
import ResponseObject from '../ResponseObject.js';

/**
 * Email verification routes handler
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Plugin options
 */
export default async function emailVerificationRoutes(fastify, options) {
  
  // Email verification page (HTML)
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
      const { token } = request.params;
      
      // Verify the token
      const updatedUser = await verifyEmail(token, fastify.userManager);
      
      // Return HTML page for successful verification
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification - Canvas</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            text-align: center;
            max-width: 400px;
            width: 90%;
        }
        .success-icon {
            color: #10b981;
            font-size: 48px;
            margin-bottom: 20px;
        }
        h1 {
            color: #1f2937;
            margin-bottom: 16px;
            font-size: 24px;
        }
        p {
            color: #6b7280;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        .user-info {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
        }
        .user-info strong {
            color: #374151;
        }
        .login-button {
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: background-color 0.2s;
        }
        .login-button:hover {
            background: #2563eb;
        }
        .error {
            color: #dc2626;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✓</div>
        <h1>Email Verified Successfully!</h1>
        <p>Your email address has been verified. You can now log in to your Canvas account.</p>
        
        <div class="user-info">
            <strong>Account:</strong> ${updatedUser.name}<br>
            <strong>Email:</strong> ${updatedUser.email}
        </div>
        
        <a href="/login" class="login-button">Go to Login</a>
    </div>
</body>
</html>`;

      reply.type('text/html').send(html);
      
    } catch (error) {
      fastify.log.error('[Email Verification] Error:', error.message);
      
      // Return error HTML page
      const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification Failed - Canvas</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            text-align: center;
            max-width: 400px;
            width: 90%;
        }
        .error-icon {
            color: #dc2626;
            font-size: 48px;
            margin-bottom: 20px;
        }
        h1 {
            color: #1f2937;
            margin-bottom: 16px;
            font-size: 24px;
        }
        p {
            color: #6b7280;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        .error {
            color: #dc2626;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
        }
        .retry-button {
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: background-color 0.2s;
            margin: 8px;
        }
        .retry-button:hover {
            background: #2563eb;
        }
        .home-button {
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: background-color 0.2s;
            margin: 8px;
        }
        .home-button:hover {
            background: #4b5563;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">✗</div>
        <h1>Email Verification Failed</h1>
        <p>The verification link is invalid or has expired.</p>
        
        <div class="error">
            ${error.message || 'Invalid or expired verification token'}
        </div>
        
        <div>
            <a href="/request-email-verification" class="retry-button">Request New Verification</a>
            <a href="/" class="home-button">Go Home</a>
        </div>
    </div>
</body>
</html>`;

      reply.type('text/html').send(errorHtml);
    }
  });

  // API endpoint for email verification (JSON response)
  fastify.post('/api/verify-email/:token', {
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
      const { token } = request.params;
      
      const updatedUser = await verifyEmail(token, fastify.userManager);
      
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
      fastify.log.error('[Email Verification API] Error:', error.message);
      
      if (error.code === 'ERR_INVALID_TOKEN') {
        const response = new ResponseObject().badRequest('Invalid or expired verification token');
        return reply.code(response.statusCode).send(response.getResponse());
      }
      
      const response = new ResponseObject().serverError('Failed to verify email');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });
}