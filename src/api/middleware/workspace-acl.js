'use strict';

import crypto from 'crypto';
import { createDebug } from '../../utils/log/index.js';
import ResponseObject from '../ResponseObject.js';

const debug = createDebug('canvas-server:middleware:workspace-acl');

/**
 * Workspace ACL Validation Middleware
 *
 * This middleware validates workspace access supporting both JWT and API tokens:
 * - JWT tokens (web UI): Only owner access allowed
 * - Canvas API tokens: Owner access + token-based sharing access
 *
 * It works in conjunction with the existing Canvas authentication middleware.
 *
 * Token-based ACL format in workspace.json:
 * {
 *   "acl": {
 *     "tokens": {
 *       "sha256:abc123...": {
 *         "permissions": ["read", "write"],
 *         "description": "Jane's laptop",
 *         "createdAt": "2024-01-01T00:00:00Z",
 *         "expiresAt": null
 *       }
 *     }
 *   }
 * }
 */

/**
 * Create workspace access validation middleware
 * @param {string} requiredPermission - Required permission ('read', 'write', 'admin')
 * @returns {Function} Fastify middleware function
 */
export function createWorkspaceACLMiddleware(requiredPermission = 'read') {
  return async function validateWorkspaceAccess(request, reply) {
    try {
      debug(`Validating workspace access for permission: ${requiredPermission}`);

      // 1. Extract workspace ID from route parameters
      const workspaceId = request.params.id;
      if (!workspaceId) {
        throw new Error('Workspace ID required in route parameters');
      }

      // 2. Extract token from request (should already be validated by fastify.authenticate)
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        throw new Error('Bearer token required');
      }

      const token = authHeader.split(' ')[1];
      const isApiToken = token.startsWith('canvas-');
      const isJwtToken = !isApiToken; // Assume JWT if not API token

      // 3. Get user information from the request (set by authenticate middleware)
      let userId;

      if (isJwtToken) {
        // For JWT tokens (web UI), user info is in request.user
        if (!request.user?.id) {
          throw new Error('Invalid JWT token: no user information');
        }
        userId = request.user.id;
        debug(`Using JWT token for user: ${userId}`);
      } else {
        // For API tokens, verify through authService
        let tokenResult;
        try {
          tokenResult = await request.server.authService.verifyApiToken(token);
          if (!tokenResult) {
            throw new Error('Invalid API token');
          }
          userId = tokenResult.userId;
          debug(`Using API token for user: ${userId}`);
        } catch (error) {
          debug(`API token verification failed: ${error.message}`);
          throw new Error(`Token verification failed: ${error.message}`);
        }
      }

      // 4. Try owner access first (fastest path)
      const workspace = await tryOwnerAccess(
        request.server.workspaceManager,
        userId,
        workspaceId
      );

      if (workspace) {
        debug(`Owner access granted for workspace ${workspaceId}`);
        request.workspace = workspace;
        request.workspaceAccess = {
          permissions: ['read', 'write', 'admin'],
          isOwner: true,
          description: 'Workspace owner'
        };
        return; // Continue to route handler
      }

      // 5. Try token-based access (only for API tokens, not JWT tokens)
      if (isApiToken) {
        const tokenAccess = await tryTokenAccess(
          request.server.workspaceManager,
          workspaceId,
          token,
          requiredPermission
        );

        if (tokenAccess) {
          debug(`Token access granted for workspace ${workspaceId}: ${tokenAccess.access.description}`);
          request.workspace = tokenAccess.workspace;
          request.workspaceAccess = {
            ...tokenAccess.access,
            isOwner: false
          };
          return; // Continue to route handler
        }
      }

      // 6. Access denied
      debug(`Access denied for workspace ${workspaceId}`);
      if (isJwtToken) {
        const response = new ResponseObject().forbidden(
          `Access denied to workspace ${workspaceId}. You are not the owner of this workspace.`
        );
        return reply.code(response.statusCode).send(response.getResponse());
      } else {
        const response = new ResponseObject().forbidden(
          `Access denied to workspace ${workspaceId}. Token lacks required permission: ${requiredPermission}`
        );
        return reply.code(response.statusCode).send(response.getResponse());
      }

    } catch (error) {
      debug(`Workspace ACL validation error: ${error.message}`);
      const response = new ResponseObject().serverError(`Workspace access validation failed: ${error.message}`);
      return reply.code(response.statusCode).send(response.getResponse());
    }
  };
}

/**
 * Try to access workspace as owner
 * @param {WorkspaceManager} workspaceManager - Workspace manager instance
 * @param {string} userId - User ID from token
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<Workspace|null>} Workspace instance if owner, null otherwise
 */
async function tryOwnerAccess(workspaceManager, userId, workspaceId) {
  try {
    // Try to get workspace where user is the owner
    const workspace = await workspaceManager.getWorkspace(userId, workspaceId, userId);
    return workspace;
  } catch (error) {
    debug(`Owner access failed: ${error.message}`);
    return null;
  }
}

/**
 * Try to access workspace via token-based ACL
 * @param {WorkspaceManager} workspaceManager - Workspace manager instance
 * @param {string} workspaceId - Workspace ID
 * @param {string} token - API token
 * @param {string} requiredPermission - Required permission
 * @returns {Promise<Object|null>} Access info if valid, null otherwise
 */
async function tryTokenAccess(workspaceManager, workspaceId, token, requiredPermission) {
  try {
    // Hash the token to match against ACL
    const tokenHash = `sha256:${crypto.createHash('sha256').update(token).digest('hex')}`;

    // Find workspace with this token in ACL
    const workspaceEntry = await findWorkspaceByTokenHash(workspaceManager, workspaceId, tokenHash);
    if (!workspaceEntry) {
      debug(`Token not found in any workspace ACL: ${tokenHash.substring(0, 16)}...`);
      return null;
    }

    // Validate token permissions and expiration
    const tokenData = workspaceEntry.acl.tokens[tokenHash];

    // Check expiration
    if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
      debug(`Token has expired: ${tokenData.expiresAt}`);
      return null;
    }

    // Check permissions
    if (!tokenData.permissions.includes(requiredPermission)) {
      debug(`Token lacks required permission. Has: ${tokenData.permissions}, needs: ${requiredPermission}`);
      return null;
    }

    // Load the actual workspace instance for token access
    const workspace = await loadWorkspaceForTokenAccess(workspaceManager, workspaceEntry);
    if (!workspace) {
      debug(`Failed to load workspace for token access: ${workspaceId}`);
      return null;
    }

    return {
      workspace,
      access: tokenData,
      config: workspaceEntry
    };

  } catch (error) {
    debug(`Token access validation error: ${error.message}`);
    return null;
  }
}

/**
 * Find workspace by searching for token hash in ACLs
 * @param {WorkspaceManager} workspaceManager - Workspace manager instance
 * @param {string} workspaceId - Workspace ID
 * @param {string} tokenHash - Token hash to search for
 * @returns {Promise<Object|null>} Workspace config if found, null otherwise
 */
async function findWorkspaceByTokenHash(workspaceManager, workspaceId, tokenHash) {
  try {
        // In a production system, you'd maintain an index of token->workspace mappings
    // For now, we'll search through the workspace index

    const allWorkspaces = workspaceManager.getAllWorkspaces();

    for (const [workspaceKey, workspaceEntry] of Object.entries(allWorkspaces)) {
      // Check if this is the workspace we're looking for
      if (!workspaceKey.endsWith(`/${workspaceId}`)) {
        continue;
      }

      // Check if token exists in this workspace's ACL
      const tokens = workspaceEntry.acl?.tokens || {};
      if (tokens[tokenHash]) {
        debug(`Found token in workspace ACL: ${workspaceKey}`);
        return workspaceEntry;
      }
    }

    debug(`Token not found in any workspace ACL: ${tokenHash.substring(0, 16)}...`);
    return null;

  } catch (error) {
    debug(`Error searching for token in workspace ACLs: ${error.message}`);
    return null;
  }
}

/**
 * Load workspace instance for token-based access
 * @param {WorkspaceManager} workspaceManager - Workspace manager instance
 * @param {Object} workspaceEntry - Workspace entry from index
 * @returns {Promise<Workspace|null>} Workspace instance if successful, null otherwise
 */
async function loadWorkspaceForTokenAccess(workspaceManager, workspaceEntry) {
  try {
    // Extract owner and workspace ID from the entry
    const [ownerId, workspaceId] = workspaceEntry.id.includes('/')
      ? workspaceEntry.id.split('/')
      : [workspaceEntry.owner, workspaceEntry.id];

    // Load the workspace (this bypasses owner check since we validated ACL)
    const workspace = await workspaceManager.openWorkspace(ownerId, workspaceId, ownerId);
    return workspace;

  } catch (error) {
    debug(`Error loading workspace for token access: ${error.message}`);
    return null;
  }
}

/**
 * Convenience middleware factories for common permissions
 */
export const requireWorkspaceRead = () => createWorkspaceACLMiddleware('read');
export const requireWorkspaceWrite = () => createWorkspaceACLMiddleware('write');
export const requireWorkspaceAdmin = () => createWorkspaceACLMiddleware('admin');

export default {
  createWorkspaceACLMiddleware,
  requireWorkspaceRead,
  requireWorkspaceWrite,
  requireWorkspaceAdmin
};
