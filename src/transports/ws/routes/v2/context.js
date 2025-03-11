'use strict';

import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('ws:routes:context');
import { routes } from '@/transports/ws/routes.js';

/**
 * Context WebSocket routes
 * @param {Object} socket - Socket.io socket
 * @param {Object} deps - Dependencies
 * @param {Object} deps.ResponseObject - Response object class
 * @param {Object} deps.sessionManager - Session manager
 * @param {Object} deps.context - Context manager
 * @returns {void}
 */
export default function contextRoutes(socket, deps) {
    const { ResponseObject, sessionManager, context: contextManager } = deps;

    // Get user from socket
    const user = socket.user;

    /**
     * Get a context by ID
     * @param {Object} data - Request data
     * @param {string} data.id - Context ID
     * @param {Function} callback - Callback function
     */
    socket.on(routes.CONTEXT_GET_ID, async (data, callback) => {
        try {
            debug(`Getting context by ID: ${data.id}`);
            const context = contextManager.getContext(data.id);
            callback(new ResponseObject(context));
        } catch (err) {
            debug(`Error getting context: ${err.message}`);
            callback(new ResponseObject(null, err.message, 404));
        }
    });

    /**
     * Get a context by URL
     * @param {Object} data - Request data
     * @param {string} data.url - Context URL
     * @param {Function} callback - Callback function
     */
    socket.on(routes.CONTEXT_GET_URL, async (data, callback) => {
        try {
            debug(`Getting context by URL: ${data.url}`);
            const context = contextManager.getContextByUrl(data.url);

            if (!context) {
                return callback(new ResponseObject(null, 'Context not found', 404));
            }

            callback(new ResponseObject(context));
        } catch (err) {
            debug(`Error getting context by URL: ${err.message}`);
            callback(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Set context URL
     * @param {Object} data - Request data
     * @param {string} data.id - Context ID
     * @param {string} data.url - New URL
     * @param {Function} callback - Callback function
     */
    socket.on(routes.CONTEXT_SET_URL, async (data, callback) => {
        try {
            debug(`Setting context URL: ${data.id} -> ${data.url}`);
            const context = contextManager.getContext(data.id);
            await context.setUrl(data.url);

            // Emit event to all clients in the room
            socket.to(data.id).emit(routes.EVENT_CONTEXT_URL, {
                id: data.id,
                url: data.url,
            });

            callback(new ResponseObject(context));
        } catch (err) {
            debug(`Error setting context URL: ${err.message}`);
            callback(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Create a context
     * @param {Object} data - Request data
     * @param {string} data.url - Context URL
     * @param {Object} data.options - Context options
     * @param {Function} callback - Callback function
     */
    socket.on(routes.SESSION_CONTEXT_CREATE, async (data, callback) => {
        try {
            debug(`Creating context: ${data.url}`);
            const context = await contextManager.createContext(data.url, {
                ...data.options,
                user,
            });

            // Join the context room
            socket.join(context.id);

            callback(new ResponseObject(context));
        } catch (err) {
            debug(`Error creating context: ${err.message}`);
            callback(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Remove a context
     * @param {Object} data - Request data
     * @param {string} data.id - Context ID
     * @param {Function} callback - Callback function
     */
    socket.on(routes.SESSION_CONTEXT_REMOVE, async (data, callback) => {
        try {
            debug(`Removing context: ${data.id}`);
            const result = await contextManager.removeContext(data.id);

            if (!result) {
                return callback(new ResponseObject(null, 'Context not found', 404));
            }

            // Leave the context room
            socket.leave(data.id);

            callback(new ResponseObject({ success: true }));
        } catch (err) {
            debug(`Error removing context: ${err.message}`);
            callback(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * List contexts for a session
     * @param {Object} data - Request data
     * @param {string} data.sessionId - Session ID
     * @param {Function} callback - Callback function
     */
    socket.on(routes.SESSION_CONTEXT_LIST, async (data, callback) => {
        try {
            debug(`Listing contexts for session: ${data.sessionId}`);
            const contexts = contextManager.listSessionContexts(data.sessionId);
            callback(new ResponseObject(contexts));
        } catch (err) {
            debug(`Error listing session contexts: ${err.message}`);
            callback(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Get a context by ID for a session
     * @param {Object} data - Request data
     * @param {string} data.sessionId - Session ID
     * @param {string} data.contextId - Context ID
     * @param {Function} callback - Callback function
     */
    socket.on(routes.SESSION_CONTEXT_GET_ID, async (data, callback) => {
        try {
            debug(`Getting context by ID for session: ${data.sessionId}, context: ${data.contextId}`);
            const context = contextManager.getContext(data.contextId);

            if (context.session.id !== data.sessionId) {
                return callback(new ResponseObject(null, 'Context does not belong to session', 403));
            }

            callback(new ResponseObject(context));
        } catch (err) {
            debug(`Error getting context for session: ${err.message}`);
            callback(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Add a layer to a context
     * @param {Object} data - Request data
     * @param {string} data.id - Context ID
     * @param {string} data.name - Layer name
     * @param {Object} data.options - Layer options
     * @param {Function} callback - Callback function
     */
    socket.on('context:layer:add', async (data, callback) => {
        try {
            debug(`Adding layer to context: ${data.id}, layer: ${data.name}`);
            const context = contextManager.getContext(data.id);
            const layer = await context.addLayer(data.name, data.options);

            // Emit event to all clients in the room
            socket.to(data.id).emit('context:layer:added', {
                contextId: data.id,
                layer,
            });

            callback(new ResponseObject(layer));
        } catch (err) {
            debug(`Error adding layer: ${err.message}`);
            callback(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Remove a layer from a context
     * @param {Object} data - Request data
     * @param {string} data.id - Context ID
     * @param {string} data.name - Layer name
     * @param {Function} callback - Callback function
     */
    socket.on('context:layer:remove', async (data, callback) => {
        try {
            debug(`Removing layer from context: ${data.id}, layer: ${data.name}`);
            const context = contextManager.getContext(data.id);
            const result = context.removeLayer(data.name);

            if (!result) {
                return callback(new ResponseObject(null, 'Layer not found', 404));
            }

            // Emit event to all clients in the room
            socket.to(data.id).emit('context:layer:removed', {
                contextId: data.id,
                name: data.name,
            });

            callback(new ResponseObject({ success: true }));
        } catch (err) {
            debug(`Error removing layer: ${err.message}`);
            callback(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Add a filter to a context
     * @param {Object} data - Request data
     * @param {string} data.id - Context ID
     * @param {string} data.name - Filter name
     * @param {Object} data.options - Filter options
     * @param {Function} callback - Callback function
     */
    socket.on('context:filter:add', async (data, callback) => {
        try {
            debug(`Adding filter to context: ${data.id}, filter: ${data.name}`);
            const context = contextManager.getContext(data.id);
            const filter = context.addFilter(data.name, data.options);

            // Emit event to all clients in the room
            socket.to(data.id).emit('context:filter:added', {
                contextId: data.id,
                filter,
            });

            callback(new ResponseObject(filter));
        } catch (err) {
            debug(`Error adding filter: ${err.message}`);
            callback(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * Remove a filter from a context
     * @param {Object} data - Request data
     * @param {string} data.id - Context ID
     * @param {string} data.name - Filter name
     * @param {Function} callback - Callback function
     */
    socket.on('context:filter:remove', async (data, callback) => {
        try {
            debug(`Removing filter from context: ${data.id}, filter: ${data.name}`);
            const context = contextManager.getContext(data.id);
            const result = context.removeFilter(data.name);

            if (!result) {
                return callback(new ResponseObject(null, 'Filter not found', 404));
            }

            // Emit event to all clients in the room
            socket.to(data.id).emit('context:filter:removed', {
                contextId: data.id,
                name: data.name,
            });

            callback(new ResponseObject({ success: true }));
        } catch (err) {
            debug(`Error removing filter: ${err.message}`);
            callback(new ResponseObject(null, err.message, 500));
        }
    });
}
