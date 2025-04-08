'use strict';

import logger, { createDebug } from '../../../../utils/log/index.js';
const debug = createDebug('ws:routes:workspace');
import ResponseObject from '../../../ResponseObject.js';

/**
 * Workspace WebSocket routes
 * @param {Object} socket - Socket.io socket
 * @param {Object} deps - Dependencies
 * @param {Object} deps.ResponseObject - Response object class
 * @param {Object} deps.userManager - User manager
 * @param {Object} deps.wsTransport - WebSocket transport instance
 * @returns {void}
 */
export default function workspaceRoutes(socket, deps) {
    const { ResponseObject, userManager, wsTransport } = deps;

    // Track which workspaces this socket is subscribed to
    socket.subscribedWorkspaces = new Set();

    // Add connection timestamp for tracking
    socket.connectionTimestamp = Date.now();
    debug(`Setting up workspace routes for client ${socket.id}, connected at ${new Date(socket.connectionTimestamp).toISOString()}`);

    // Handle custom ping from client (helps keep the connection alive)
    socket.on('ping', (callback) => {
        debug(`Received custom ping from client ${socket.id}`);
        if (typeof callback === 'function') {
            try {
                callback({ success: true, timestamp: Date.now() });
            } catch (error) {
                debug(`Error responding to ping from client ${socket.id}: ${error.message}`);
            }
        }
    });

    socket.on('workspace:subscribe', async (workspaceId, callback) => {
        try {
            debug(`Client ${socket.id} subscribing to workspace ${workspaceId}`);

            // Get the authenticated user
            if (!socket.user) {
                debug(`Authentication failed: No user object on socket ${socket.id}`);
                throw new Error('User not authenticated');
            }

            debug(`User ${socket.user.id} attempting to subscribe to workspace ${workspaceId}`);

            // Get the user instance
            const user = await userManager.getUserById(socket.user.id);
            if (!user) {
                debug(`User not found with ID: ${socket.user.id}`);
                throw new Error('User not found');
            }

            // Get the workspace manager from the user
            const workspaceManager = user.workspaceManager;
            if (!workspaceManager) {
                debug(`Workspace manager not available for user ${socket.user.id}`);
                throw new Error('Workspace manager not available for this user');
            }

            // Get the workspace (will throw if not found)
            const workspaceInstance = await workspaceManager.getWorkspace(workspaceId);
            if (!workspaceInstance) {
                debug(`Workspace not found: ${workspaceId} for user ${socket.user.id}`);
                throw new Error(`Workspace not found: ${workspaceId}`);
            }

            // Add to socket's local subscribed workspaces
            socket.subscribedWorkspaces.add(workspaceId);

            // Register with the central subscription tracker in the transport
            if (wsTransport) {
                wsTransport.addWorkspaceSubscription(workspaceId, socket.id);

                // Set up workspace event listeners if they don't exist yet
                wsTransport.setupWorkspaceListeners(workspaceId, workspaceInstance);
            }

            debug(`Client ${socket.id} subscribed to workspace ${workspaceId}, total subscriptions: ${socket.subscribedWorkspaces.size}`);

            // Send initial workspace data
            const response = new ResponseObject().success(workspaceInstance.toJSON());
            if (typeof callback === 'function') {
                callback(response.getResponse());
            }
        } catch (error) {
            debug(`Error subscribing to workspace: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            if (typeof callback === 'function') {
                callback(response.getResponse());
            }
        }
    });

    socket.on('workspace:unsubscribe', async (workspaceId, callback) => {
        try {
            debug(`Client ${socket.id} unsubscribing from workspace ${workspaceId}`);

            // Remove from socket's local subscribed workspaces
            socket.subscribedWorkspaces.delete(workspaceId);

            // Remove from the central subscription tracker in the transport
            if (wsTransport) {
                wsTransport.removeWorkspaceSubscription(workspaceId, socket.id);
            }

            debug(`Client ${socket.id} unsubscribed from workspace ${workspaceId}, remaining subscriptions: ${socket.subscribedWorkspaces.size}`);

            const response = new ResponseObject().success({ unsubscribed: true });
            if (typeof callback === 'function') {
                callback(response.getResponse());
            }
        } catch (error) {
            debug(`Error unsubscribing from workspace: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            if (typeof callback === 'function') {
                callback(response.getResponse());
            }
        }
    });

    // Tree operations
    socket.on('workspace:tree:get', async (workspaceId, callback) => {
        try {
            debug(`Client ${socket.id} requesting tree for workspace ${workspaceId}`);

            // Get the authenticated user
            if (!socket.user) {
                debug(`Authentication failed: No user object on socket ${socket.id}`);
                throw new Error('User not authenticated');
            }

            // Get the user instance
            const user = await userManager.getUserById(socket.user.id);
            if (!user) {
                debug(`User not found with ID: ${socket.user.id}`);
                throw new Error('User not found');
            }

            // Get the workspace manager from the user
            const workspaceManager = user.workspaceManager;
            if (!workspaceManager) {
                debug(`Workspace manager not available for user ${socket.user.id}`);
                throw new Error('Workspace manager not available for this user');
            }

            const workspace = await workspaceManager.getWorkspace(workspaceId);
            if (!workspace) {
                debug(`Workspace not found: ${workspaceId} for user ${socket.user.id}`);
                throw new Error(`Workspace not found: ${workspaceId}`);
            }

            const tree = workspace.jsonTree;
            debug(`Sending tree for workspace ${workspaceId} to client ${socket.id}, tree size: ${JSON.stringify(tree).length} bytes`);

            const response = new ResponseObject().success({ tree });
            if (typeof callback === 'function') {
                callback(response.getResponse());
            }
        } catch (error) {
            debug(`Error getting workspace tree: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            if (typeof callback === 'function') {
                callback(response.getResponse());
            }
        }
    });

    socket.on('workspace:tree:paths', async (workspaceId, callback) => {
        try {
            debug(`Client ${socket.id} requesting paths for workspace ${workspaceId}`);

            // Get the authenticated user
            if (!socket.user) {
                debug(`Authentication failed: No user object on socket ${socket.id}`);
                throw new Error('User not authenticated');
            }

            // Get the user instance
            const user = await userManager.getUserById(socket.user.id);
            if (!user) {
                debug(`User not found with ID: ${socket.user.id}`);
                throw new Error('User not found');
            }

            // Get the workspace manager from the user
            const workspaceManager = user.workspaceManager;
            if (!workspaceManager) {
                debug(`Workspace manager not available for user ${socket.user.id}`);
                throw new Error('Workspace manager not available for this user');
            }

            const workspace = await workspaceManager.getWorkspace(workspaceId);
            if (!workspace) {
                debug(`Workspace not found: ${workspaceId} for user ${socket.user.id}`);
                throw new Error(`Workspace not found: ${workspaceId}`);
            }

            const paths = workspace.paths;
            debug(`Sending paths for workspace ${workspaceId} to client ${socket.id}, count: ${paths.length}`);

            const response = new ResponseObject().success({ paths });
            if (typeof callback === 'function') {
                callback(response.getResponse());
            }
        } catch (error) {
            debug(`Error getting workspace paths: ${error.message}`);
            const response = new ResponseObject().error(error.message);
            if (typeof callback === 'function') {
                callback(response.getResponse());
            }
        }
    });

    // Clean up subscriptions when the client disconnects
    socket.on('disconnect', () => {
        const connectionDuration = (Date.now() - socket.connectionTimestamp) / 1000;
        debug(`Client ${socket.id} disconnected after ${connectionDuration.toFixed(2)}s, cleaning up ${socket.subscribedWorkspaces.size} workspace subscriptions`);

        // Clean up socket's local subscriptions
        socket.subscribedWorkspaces.clear();

        // Clean up from the central subscription tracker (redundant as the transport also does this)
        if (wsTransport) {
            wsTransport.removeSocketSubscriptions(socket.id);
        }
    });
}
