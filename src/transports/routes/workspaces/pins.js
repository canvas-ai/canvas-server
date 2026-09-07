'use strict';

import ResponseObject from '../../ResponseObject.js';
import { requireWorkspaceRead, requireWorkspaceWrite } from '../../middleware/workspace-acl.js';

/**
 * Workspace Pins Routes — per-workspace pinned tree paths ("task containers").
 *
 * Stored in workspace.json `pins: [{ id, tree, path, layerId, label, createdAt }]`,
 * ordered. Renderer-agnostic: the webui M2 Pins tab, the desktop overlay and
 * agents all read the same list. Every mutation emits `pins.changed` on the
 * workspace channel.
 *
 *   GET    /                 -> resolved pins (layer label/color/icon, resolvable flag)
 *   POST   /   { path, tree?, label? }  -> pin a path (idempotent)
 *   DELETE /   { path, tree? }          -> unpin by address
 *   DELETE /:pinId                      -> unpin by id
 *   PATCH  /order { order: [pinId] }    -> reorder
 */
export default async function workspacePinsRoutes(fastify) {
  const send = (reply, response) => reply.code(response.statusCode).send(response.getResponse());

  const listResolved = (workspace) => {
    // A stopped workspace still lists its pins (unresolved) — the tab should
    // never go blank just because the workspace is idle.
    try { return workspace.listPins(); }
    catch { return workspace.pins.map((pin) => ({ ...pin, name: pin.path.split('/').pop(), resolvable: null })); }
  };

  fastify.get('/', {
    onRequest: [fastify.authenticate, requireWorkspaceRead()],
  }, async (request, reply) => {
    try {
      const pins = listResolved(request.workspace);
      return send(reply, new ResponseObject().found(pins, 'Workspace pins retrieved successfully', 200, pins.length, pins.length));
    } catch (error) {
      request.log.error(error);
      return send(reply, new ResponseObject().serverError(error.message || 'Failed to list pins'));
    }
  });

  fastify.post('/', {
    onRequest: [fastify.authenticate, requireWorkspaceWrite()],
    schema: {
      body: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string', minLength: 1 },
          tree: { type: 'string' },
          label: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const workspace = request.workspace;
      if (!workspace.isActive) await workspace.start();
      const { pin, created } = workspace.addPin(request.body);
      const resolved = listResolved(workspace).find((p) => p.id === pin.id) || pin;
      const response = created
        ? new ResponseObject().created(resolved, 'Path pinned')
        : new ResponseObject().found(resolved, 'Path already pinned');
      return send(reply, response);
    } catch (error) {
      if (/not found|cannot be pinned/i.test(error.message || '')) {
        return send(reply, new ResponseObject().badRequest(error.message));
      }
      request.log.error(error);
      return send(reply, new ResponseObject().serverError(error.message || 'Failed to pin path'));
    }
  });

  fastify.delete('/', {
    onRequest: [fastify.authenticate, requireWorkspaceWrite()],
    schema: {
      body: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string', minLength: 1 },
          tree: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { path, tree } = request.body;
      const removed = request.workspace.removePin(path, tree || 'context');
      if (!removed) return send(reply, new ResponseObject().notFound(`No pin for ${tree || 'context'}:${path}`));
      return send(reply, new ResponseObject().deleted({ path, tree: tree || 'context' }, 'Path unpinned'));
    } catch (error) {
      request.log.error(error);
      return send(reply, new ResponseObject().serverError(error.message || 'Failed to unpin path'));
    }
  });

  fastify.delete('/:pinId', {
    onRequest: [fastify.authenticate, requireWorkspaceWrite()],
    schema: {
      params: { type: 'object', required: ['pinId'], properties: { pinId: { type: 'string' } } },
    },
  }, async (request, reply) => {
    try {
      const { pinId } = request.params;
      const removed = request.workspace.removePin(pinId);
      if (!removed) return send(reply, new ResponseObject().notFound(`Pin not found: ${pinId}`));
      return send(reply, new ResponseObject().deleted({ id: pinId }, 'Pin removed'));
    } catch (error) {
      request.log.error(error);
      return send(reply, new ResponseObject().serverError(error.message || 'Failed to remove pin'));
    }
  });

  fastify.patch('/order', {
    onRequest: [fastify.authenticate, requireWorkspaceWrite()],
    schema: {
      body: {
        type: 'object',
        required: ['order'],
        properties: { order: { type: 'array', items: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    try {
      request.workspace.reorderPins(request.body.order);
      const pins = listResolved(request.workspace);
      return send(reply, new ResponseObject().updated(pins, 'Pins reordered', 200, pins.length));
    } catch (error) {
      request.log.error(error);
      return send(reply, new ResponseObject().serverError(error.message || 'Failed to reorder pins'));
    }
  });
}
