'use strict';

import authService from './service.js';
import createError from '@fastify/error';
import ResponseObject from '../ResponseObject.js';

// Export the auth service
export { authService };

/**
 * Custom errors
 */
const InvalidTokenError = createError('ERR_INVALID_TOKEN', 'Invalid or expired token', 401);
const InvalidCredentialsError = createError('ERR_INVALID_CREDENTIALS', 'Invalid credentials', 401);
const UserValidationError = createError('ERR_USER_VALIDATION', 'User validation failed', 401);

/**
 * Validate user object to ensure it has required properties
 * @param {Object} user - User object to validate
 * @param {Array<string>} requiredProps - Array of required properties
 * @returns {Object} - Validated user object
 * @throws {Error} - If validation fails
 */
export function validateUser(user, requiredProps = ['id', 'email']) {
  // Check if user exists
  if (!user) {
    throw new UserValidationError('User not found');
  }

  if (typeof user !== 'object') {
    throw new UserValidationError(`User is not an object, received ${typeof user}`);
  }

  // Check required properties
  const missingProps = [];
  for (const prop of requiredProps) {
    if (user[prop] === undefined || user[prop] === null || user[prop] === '') {
      missingProps.push(prop);
    }
  }

  if (missingProps.length > 0) {
    throw new UserValidationError(`User missing required properties: ${missingProps.join(', ')}`);
  }

  // Don't attempt to modify the user object directly, as some properties may be read-only
  // Instead, return a plain JavaScript object with the validated properties
  const validatedUser = {};

  // Copy all enumerable properties from the user object
  for (const prop in user) {
    if (Object.prototype.hasOwnProperty.call(user, prop)) {
      // For email, store lowercase version
      if (prop === 'email' && typeof user[prop] === 'string') {
        validatedUser[prop] = user[prop].toLowerCase();
      } else {
        validatedUser[prop] = user[prop];
      }
    }
  }

  // Ensure all required properties are copied
  for (const prop of requiredProps) {
    if (!(prop in validatedUser)) {
      validatedUser[prop] = user[prop];
    }
  }

  // If the original object is a class instance with methods, preserve important non-enumerable methods
  // by attaching them to our plain object (if accessible via getters)
  const methodsToPreserve = ['save', 'delete', 'update', 'toJSON'];
  for (const method of methodsToPreserve) {
    if (typeof user[method] === 'function') {
      validatedUser[method] = user[method].bind(user);
    }
  }

  return validatedUser;
}

/**
 * Verify JWT for authenticated routes
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 */
export async function verifyJWT(request, reply, done) {
  try {
    const authHeader = request.headers.authorization;
    console.log(`[Auth/JWT] Authorization header: ${authHeader ? 'present' : 'missing'}`);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Auth/JWT] No Bearer token or invalid format');
      return done(new InvalidTokenError('Bearer token required'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('[Auth/JWT] Empty token');
      return done(new InvalidTokenError('Token is empty'));
    }

    // Skip JWT verification if this is clearly an API token (starts with canvas-)
    // Let the API token strategy handle it
    if (token.startsWith('canvas-')) {
      console.log('[Auth/JWT] Detected API token in Authorization header, skipping JWT verification');
      return done(new InvalidTokenError('Not a JWT token'));
    }

    console.log('[Auth/JWT] Verifying JWT token...');

    // For debugging, let's try to decode without verification first
    try {
      const decoded = request.server.jwt.decode(token);
      console.log(`[Auth/JWT] Token decoded (not verified): ${JSON.stringify(decoded)}`);
    } catch (decodeErr) {
      console.log(`[Auth/JWT] Token decode failed: ${decodeErr.message}`);
    }

    // Proceed with actual JWT verification
    let decoded;
    try {
      decoded = await request.jwtVerify(); // This returns the payload
      // if (request.user && request.user.sub && !request.user.id) { // Check if it looks like raw JWT payload
      //   console.log('[Auth/JWT] Deleting request.user potentially set by jwtVerify default');
      //   delete request.user;
      // }
      console.log(`[Auth/JWT] JWT verified, subject: ${decoded.sub}`);
    } catch (jwtError) {
      console.error(`[Auth/JWT] JWT verification failed: ${jwtError.message}`);
      return done(new InvalidTokenError(`JWT verification failed: ${jwtError.message}`));
    }

    const userManager = request.server.userManager;
    if (!userManager) {
      console.error('[Auth/JWT] userManager not available on server');
      return done(new Error('User manager not initialized'));
    }

    console.log(`[Auth/JWT] Getting user by ID: ${decoded.sub}`);
    let user;
    try {
      user = await userManager.getUserById(decoded.sub);
      console.log(`[Auth/JWT] User retrieved: ${!!user}, ID: ${user ? user.id : 'null'}`);
    } catch (userError) {
      console.error(`[Auth/JWT] Error retrieving user: ${userError.message}`);
      return done(new Error(`Error retrieving user: ${userError.message}`));
    }

    if (!user) {
      console.error(`[Auth/JWT] User not found: ${decoded.sub}`);
      return done(new UserValidationError(`User not found: ${decoded.sub}`));
    }

    // Validate user status directly without modifying any properties
    if (user.status !== 'active') {
      console.log(`[Auth/JWT] User ${user.id} not active (${user.status})`);
      return done(new InvalidTokenError('User account is not active'));
    }

    // Only check version if both token and user have versions
    if (decoded.ver && (user.updated || user.created)) {
      const userVersion = user.updated || user.created;
      if (decoded.ver !== userVersion) {
        console.log(`[Auth/JWT] Token version mismatch: ${decoded.ver} vs ${userVersion}`);
        return done(new InvalidTokenError('Token is invalid - user data has changed'));
      }
    }

    // Create a simplified user object that contains only the essential properties
    const essentialUserData = {
      id: user.id,
      email: user.email ? user.email.toLowerCase() : null,
      userType: user.userType || 'user',
      status: user.status || 'active'
    };

    console.log(`[Auth/JWT] Preparing to authenticate user: ${essentialUserData.id}`);
    request.user = essentialUserData; // Set request.user directly
    console.log(`[Auth/JWT] User ${essentialUserData.id} authenticated via JWT (set on request.user)`);
    return done(); // Call done() on success
  } catch (err) {
    console.log(`[Auth/JWT] JWT verification failed: ${err.message}`, err);
    // For auth errors, pass them along
    if (err.code === 'ERR_INVALID_TOKEN' || err.code === 'ERR_USER_VALIDATION') {
        return done(err); // Pass existing custom error
    }
    // For other errors (e.g., jwtVerify throwing its own specific errors, or unexpected ones)
    return done(new InvalidTokenError(err.message || 'JWT authentication failed'));
  }
}

/**
 * Verify API token for authenticated routes
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 */
export async function verifyApiToken(request, reply, done) {
  try {
    // Check for token in Authorization header
    if (!request.headers.authorization || !request.headers.authorization.startsWith('Bearer ')) {
      console.log('[Auth/API] No Bearer token or invalid format');
      return done(new InvalidTokenError('Bearer token required'));
    }

    const token = request.headers.authorization.split(' ')[1];
    if (!token) {
      console.log('[Auth/API] Empty token');
      return done(new InvalidTokenError('Token is empty'));
    }

    // Only process tokens with the "canvas-" prefix, which identifies it as an API token
    if (!token.startsWith('canvas-')) {
      console.log(`[Auth/API] Not an API token (missing canvas- prefix): ${token.substring(0, 10)}...`);
      return done(new InvalidTokenError('Not a valid API token'));
    }

    console.log(`[Auth/API] Verifying API token: ${token.substring(0, 10)}...`);

    let tokenResult;
    try {
      tokenResult = await request.server.authService.verifyApiToken(token);
      console.log(`[Auth/API] Token verification result: ${JSON.stringify(tokenResult)}`);
    } catch (tokenError) {
      console.error(`[Auth/API] Token verification error: ${tokenError.message}`);
      return done(new InvalidTokenError(`API token verification failed: ${tokenError.message}`));
    }

    if (!tokenResult) {
      console.error('[Auth/API] Invalid API token - verification returned null');
      return done(new InvalidTokenError('Invalid API token'));
    }

    // Load user from UserManager
    const userManager = request.server.userManager;
    if (!userManager) {
      console.error('[Auth/API] userManager not available on server');
      return done(new Error('User manager not initialized'));
    }

    console.log(`[Auth/API] Getting user with ID: ${tokenResult.userId}`);
    let user;
    try {
      user = await userManager.getUserById(tokenResult.userId);
      console.log(`[Auth/API] User found: ${!!user}, user ID: ${user ? user.id : 'null'}`);
    } catch (userError) {
      console.error(`[Auth/API] Error retrieving user: ${userError.message}`);
      return done(new Error(`Error retrieving user: ${userError.message}`));
    }

    if (!user) {
      console.error(`[Auth/API] User not found for token userId: ${tokenResult.userId}`);
      return done(new UserValidationError('User not found for this API token'));
    }

    // Check required properties without modifying the object
    if (!user.id || !user.email) {
      console.error(`[Auth/API] User missing required properties`);
      return done(new UserValidationError('User missing required properties: id or email'));
    }

    if (user.status !== 'active') {
      console.error(`[Auth/API] User account not active: ${user.status}`);
      return done(new InvalidTokenError('User account is not active'));
    }

    // Create a simplified user object with essential properties
    const essentialUserData = {
      id: user.id,
      email: user.email ? user.email.toLowerCase() : null,
      userType: user.userType || 'user',
      status: user.status || 'active'
    };

    console.log(`[Auth/API] Preparing to authenticate user: ${essentialUserData.id}`);
    request.user = essentialUserData; // Set request.user directly
    request.token = tokenResult.tokenId; // Keep this for API token specific logic if any

    console.log(`[Auth/API] Authentication successful for user ${essentialUserData.id}`);
    return done(); // Call done() on success
  } catch (err) {
    console.error(`[Auth/API] API token verification failed: ${err.message}`, err);
    return done(new InvalidTokenError(err.message));
  }
}

/**
 * Login with email/password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {Object} userManager - User manager instance
 * @returns {Promise<Object>} - User object and token
 */
export async function login(email, password, userManager) {
  if (!email || !password) {
    throw new InvalidCredentialsError('Email and password are required');
  }

  // Validate userManager
  if (!userManager) {
    throw new Error('User manager is not initialized');
  }

  console.log(`[Auth/Login] Attempting login for ${email}`);

  // Get user by email
  const user = await userManager.getUserByEmail(email);
  if (!user) {
    console.log(`[Auth/Login] User not found for email: ${email}`);
    throw new InvalidCredentialsError('Invalid email or password');
  }

  console.log(`[Auth/Login] User found: ${user.id}`);

  // Verify password
  const validPassword = await authService.verifyPassword(user.id, password);
  if (!validPassword) {
    console.log(`[Auth/Login] Password verification failed for user: ${user.id}`);
    throw new InvalidCredentialsError('Invalid email or password');
  }

  // Check if account is active
  if (user.status !== 'active') {
    console.log(`[Auth/Login] User account not active: ${user.id}, status: ${user.status}`);
    throw new InvalidCredentialsError('Account is not active');
  }

  console.log(`[Auth/Login] Login successful for user: ${user.id}`);
  return { user };
}

/**
 * Register a new user
 * @param {Object} userData - User data for registration
 * @param {Object} userManager - User manager instance
 * @returns {Promise<Object>} - Created user and verification token
 */
export async function register(userData, userManager) {
  // Create user
  const user = await userManager.createUser({
    email: userData.email,
    // firstName: userData.firstName,
    // lastName: userData.lastName,
    userType: 'user', // Default to regular user
    status: 'active' // For production use this would be set to 'pending' awaiting email verification
  });

  // Set password
  await authService.setPassword(user.id, userData.password);

  // Create verification token
  const verificationToken = await authService.createEmailVerificationToken(user.id, user.email);

  return {
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email
      },
      token: verificationToken // This is the email verification token
    }
  };
}

/**
 * Verify email with token
 * @param {string} token - Verification token
 * @param {Object} userManager - User manager instance
 * @returns {Promise<Object>} - Updated user
 */
export async function verifyEmail(token, userManager) {
  const tokenData = await authService.verifyOneTimeToken(token, 'verification');
  if (!tokenData) {
    throw new InvalidTokenError('Invalid or expired verification token');
  }

  // Get user
  const user = await userManager.getUserById(tokenData.userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Update user status
  const updatedUser = await userManager.updateUser(user.id, {
    status: 'active',
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString()
  });

  return updatedUser;
}

/**
 * Request password reset
 * @param {string} email - User email
 * @param {Object} userManager - User manager instance
 * @returns {Promise<Object>} - Reset token
 */
export async function requestPasswordReset(email, userManager) {
  const user = await userManager.getUserByEmail(email);
  if (!user) {
    // Don't reveal if user exists, but don't create token either
    return null;
  }

  const resetToken = await authService.createPasswordResetToken(user.id, user.email);
  return { email: user.email, resetToken };
}

/**
 * Reset password with token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @param {Object} userManager - User manager instance
 * @returns {Promise<Object>} - Updated user
 */
export async function resetPassword(token, newPassword, userManager) {
  const tokenData = await authService.verifyOneTimeToken(token, 'password_reset');
  if (!tokenData) {
    throw new InvalidTokenError('Invalid or expired reset token');
  }

  // Get user
  const user = await userManager.getUserById(tokenData.userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Set new password
  await authService.setPassword(user.id, newPassword);

  // If user was pending verification, activate them
  if (user.status === 'pending') {
    await userManager.updateUser(user.id, {
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString()
    });
  }

  return { success: true };
}
