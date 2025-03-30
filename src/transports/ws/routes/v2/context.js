'use strict';

import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('ws:routes:context');
import ResponseObject from '@/transports/ResponseObject.js';

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

    // Track which contexts this socket is subscribed to
    socket.subscribedContexts = new Set();

    socket.on('context:subscribe', async (contextId, callback) => {
        try {
            debug(`Client ${socket.id} subscribing to context ${contextId}`);

            // Get the context (will throw if not found)
            const contextInstance = await contextManager.getContext(contextId);

            // Add to subscribed contexts
            socket.subscribedContexts.add(contextId);

            // Set up event listeners for this context
            const forwardEvent = (eventName) => {
                contextInstance.on(eventName, (data) => {
                    // Only forward if still subscribed
                    if (socket.subscribedContexts.has(contextId)) {
                        socket.emit(`context:${eventName}`, { contextId, data });
                    }
                });
            };

            // Forward relevant context events to the client
            [
                'change:url',
                'change:baseUrl',
                'locked',
                'unlocked',
                'document:insert',
                'document:update',
                'document:remove',
                'document:delete',
                'documents:insert',
                'documents:update',
                'documents:remove',
                'documents:delete',
            ].forEach(forwardEvent);

            callback(new ResponseObject({ message: 'Subscribed to context events' }));
        } catch (error) {
            debug(`Error subscribing to context: ${error.message}`);
            callback(new ResponseObject(null, error.message));
        }
    });

    socket.on('context:unsubscribe', (contextId, callback) => {
        try {
            debug(`Client ${socket.id} unsubscribing from context ${contextId}`);
            socket.subscribedContexts.delete(contextId);
            callback(new ResponseObject({ message: 'Unsubscribed from context events' }));
        } catch (error) {
            debug(`Error unsubscribing from context: ${error.message}`);
            callback(new ResponseObject(null, error.message));
        }
    });

    socket.on('disconnect', () => {
        debug(`Client ${socket.id} disconnected, cleaning up context subscriptions`);
        socket.subscribedContexts.clear();
    });

    socket.on('context:layer:add', async (data, callback) => {
        try {
            debug(`Adding layer to context: ${data.id}, layer: ${data.name}`);
            const contextInstance = await contextManager.getContext(data.id);
            const layer = await contextInstance.addLayer(data.name, data.options);

            // Emit event to all clients in the room
            socket.to(data.id).emit('context:layer:added', {
                contextId: data.id,
                layer,
            });

            callback(new ResponseObject(layer));
        } catch (error) {
            debug(`Error adding layer: ${error.message}`);
            callback(new ResponseObject(null, error.message));
        }
    });

    socket.on('context:layer:remove', async (data, callback) => {
        try {
            debug(`Removing layer from context: ${data.id}, layer: ${data.name}`);
            const contextInstance = await contextManager.getContext(data.id);
            const result = await contextInstance.removeLayer(data.name);

            if (!result) {
                return callback(new ResponseObject(null, 'Layer not found'));
            }

            // Emit event to all clients in the room
            socket.to(data.id).emit('context:layer:removed', {
                contextId: data.id,
                name: data.name,
            });

            callback(new ResponseObject({ success: true }));
        } catch (error) {
            debug(`Error removing layer: ${error.message}`);
            callback(new ResponseObject(null, error.message));
        }
    });

    socket.on('context:feature:add', async (data, callback) => {
        try {
            debug(`Adding feature to context: ${data.id}, feature: ${data.feature}`);
            const contextInstance = await contextManager.getContext(data.id);
            const feature = await contextInstance.appendFeatureBitmaps(data.feature, data.options);
            callback(new ResponseObject(feature));
        } catch (error) {
            debug(`Error adding feature: ${error.message}`);
            callback(new ResponseObject(null, error.message));
        }
    });

    socket.on('context:feature:remove', async (data, callback) => {
        try {
            debug(`Removing feature from context: ${data.id}, feature: ${data.feature}`);
            const contextInstance = await contextManager.getContext(data.id);
            const result = await contextInstance.removeFeatureBitmaps(data.feature);

            if (!result) {
                return callback(new ResponseObject(null, 'Feature not found'));
            }

            callback(new ResponseObject({ success: true }));
        } catch (error) {
            debug(`Error removing feature: ${error.message}`);
            callback(new ResponseObject(null, error.message));
        }
    });

    socket.on('context:filter:add', async (data, callback) => {
        try {
            debug(`Adding filter to context: ${data.id}, filter: ${data.filter}`);
            const contextInstance = await contextManager.getContext(data.id);
            const filter = await contextInstance.setFilterBitmaps(data.filter, data.options);

            socket.to(data.id).emit('context:filter:added', {
                contextId: data.id,
                filter,
            });

            callback(new ResponseObject(filter));
        } catch (error) {
            debug(`Error adding filter: ${error.message}`);
            callback(new ResponseObject(null, error.message));
        }
    });

    socket.on('context:filter:remove', async (data, callback) => {
        try {
            debug(`Removing filter from context: ${data.id}, filter: ${data.filter}`);
            const contextInstance = await contextManager.getContext(data.id);
            const result = await contextInstance.removeFilter(data.filter);

            if (!result) {
                return callback(new ResponseObject(null, 'Filter not found'));
            }

            socket.to(data.id).emit('context:filter:removed', {
                contextId: data.id,
                filter: data.filter,
            });

            callback(new ResponseObject({ success: true }));
        } catch (error) {
            debug(`Error removing filter: ${error.message}`);
            callback(new ResponseObject(null, error.message));
        }
    });

    socket.on('context:status', async (contextId, callback) => {
        try {
            debug(`Getting status for context: ${contextId}`);
            const contextInstance = await contextManager.getContext(contextId);
            callback(new ResponseObject(contextInstance.status));
        } catch (error) {
            debug(`Error getting context status: ${error.message}`);
            callback(new ResponseObject(null, error.message));
        }
    });

    socket.on('context:url:get', async ({ contextId }, callback) => {
        try {
            debug(`Getting URL for context: ${contextId}`);
            const contextInstance = await contextManager.getContext(contextId);
            callback(new ResponseObject({ url: contextInstance.url }));
        } catch (error) {
            debug(`Error getting context URL: ${error.message}`);
            callback(new ResponseObject(null, error.message));
        }
    });

    socket.on('context:url:set', async ({ contextId, url }, callback) => {
        try {
            debug(`Setting URL for context: ${contextId} to ${url}`);
            const contextInstance = await contextManager.getContext(contextId);
            await contextInstance.setUrl(url);
            callback(new ResponseObject({ url: contextInstance.url }));
        } catch (error) {
            debug(`Error setting context URL: ${error.message}`);
            callback(new ResponseObject(null, error.message));
        }
    });

    socket.on('context:documents:list', async ({ contextId, featureArray = [], filterArray = [], options = {} }, callback) => {
        try {
            debug(`Listing documents for context: ${contextId}`);
            const contextInstance = await contextManager.getContext(contextId);
            const documents = await contextInstance.listDocuments(featureArray, filterArray, options);
            callback(new ResponseObject(documents));
        } catch (error) {
            debug(`Error listing documents: ${error.message}`);
            callback(new ResponseObject(null, error.message));
        }
    });

    socket.on('context:documents:insert', async ({ contextId, documents, featureArray = [], options = {} }, callback) => {
        try {
            debug(`Inserting documents into context: ${contextId}`);
            const contextInstance = await contextManager.getContext(contextId);
            const result = await contextInstance.insertDocuments(documents, featureArray, options);
            callback(new ResponseObject(result));
        } catch (error) {
            debug(`Error inserting documents: ${error.message}`);
            callback(new ResponseObject(null, error.message));
        }
    });
}
