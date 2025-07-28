'use strict';

import SecurityUtils from '../utils/security.js';

/**
 * Rate limiting middleware for authentication endpoints
 */
export function createRateLimiter() {
  const rateLimiter = SecurityUtils.createRateLimiter();

  return function rateLimitMiddleware(request, reply, done) {
    try {
      // Get rate limit configuration
      const securityConfig = SecurityUtils.loadSecurityConfig();
      const rateLimitConfig = securityConfig?.strategies?.local?.rateLimiting;

      if (!rateLimitConfig) {
        return done(); // No rate limiting configured
      }

      // Determine rate limit key (IP address or user identifier)
      const rateLimitKey = request.ip || request.headers['x-forwarded-for'] || 'unknown';
      
      // Determine which rate limit to apply based on route
      let config;
      if (request.url.includes('/login')) {
        config = rateLimitConfig.loginAttempts;
      } else if (request.url.includes('/register')) {
        config = rateLimitConfig.registration;
      } else if (request.url.includes('/forgot-password') || request.url.includes('/request-email-verification')) {
        config = rateLimitConfig.passwordReset || {
          maxAttempts: 3,
          windowMs: 3600000 // 1 hour
        };
      } else if (request.url.includes('/tokens') || request.url.includes('/password')) {
        config = rateLimitConfig.apiOperations || {
          maxAttempts: 10,
          windowMs: 300000 // 5 minutes
        };
      } else if (request.url.includes('/verify-email') || request.url.includes('/reset-password') || request.url.includes('/token/verify')) {
        config = rateLimitConfig.tokenOperations || {
          maxAttempts: 5,
          windowMs: 300000 // 5 minutes
        };
      } else if (request.url.includes('/me')) {
        config = rateLimitConfig.userProfile || {
          maxAttempts: 30,
          windowMs: 60000 // 1 minute
        };
      } else {
        return done(); // No rate limiting for other routes
      }

      if (!config) {
        return done();
      }

      // Check if request is allowed
      const isAllowed = rateLimiter.isAllowed(rateLimitKey, config.maxAttempts, config.windowMs);
      
      if (!isAllowed) {
        const remainingTime = config.lockoutDuration || config.windowMs;
        const response = {
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(remainingTime / 1000)
        };

        reply.code(429).header('Retry-After', Math.ceil(remainingTime / 1000)).send(response);
        return;
      }

      // Add rate limit headers
      const remainingAttempts = rateLimiter.getRemainingAttempts(rateLimitKey, config.maxAttempts, config.windowMs);
      reply.header('X-RateLimit-Limit', config.maxAttempts);
      reply.header('X-RateLimit-Remaining', remainingAttempts);
      reply.header('X-RateLimit-Reset', Date.now() + config.windowMs);

      done();
    } catch (error) {
      console.error('[RateLimiter] Error:', error.message);
      done(); // Continue without rate limiting on error
    }
  };
}

/**
 * Clear rate limit for successful authentication
 */
export function clearRateLimit(request) {
  try {
    const rateLimitKey = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    const rateLimiter = SecurityUtils.createRateLimiter();
    rateLimiter.clear(rateLimitKey);
  } catch (error) {
    console.error('[RateLimiter] Error clearing rate limit:', error.message);
  }
}

export default {
  createRateLimiter,
  clearRateLimit
};