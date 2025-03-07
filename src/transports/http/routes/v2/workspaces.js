'use strict';

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('http:routes:workspaces');
import ResponseObject from '@/transports/ResponseObject.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Workspace:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The workspace ID
 *         name:
 *           type: string
 *           description: The workspace name
 *         description:
 *           type: string
 *           description: The workspace description
 *         owner:
 *           type: string
 *           description: The workspace owner ID
 *         created:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         status:
 *           type: string
 *           enum: [active, archived]
 *           description: Workspace status
 *     WorkspaceDocument:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The document ID
 *         content:
 *           type: object
 *           description: The document content
 *         created:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */

/**
 * Workspaces routes
 * @param {Object} options - Route options
 * @param {Object} options.auth - Auth service
 * @param {Object} options.workspaceManager - Workspace manager
 * @returns {express.Router} - Express router
 */
export default function workspacesRoutes(options) {
    const router = express.Router();
    const { auth, workspaceManager } = options;

    if (!auth) {
        throw new Error('Auth service is required');
    }

    if (!workspaceManager) {
        throw new Error('Workspace manager is required');
    }

    // Middleware to get user from request
    const getUserMiddleware = async (req, res, next) => {
        try {
            req.user = await auth.getUserFromRequest(req);
            if (!req.user) {
                return res.status(401).json(new ResponseObject(null, 'Unauthorized', 401));
            }
            next();
        } catch (err) {
            debug(`Error getting user: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    };

    // Apply auth middleware to all routes
    router.use(auth.getAuthMiddleware());
    router.use(getUserMiddleware);

    /**
     * @swagger
     * /:
     *   get:
     *     summary: List all workspaces
     *     tags: [Workspaces]
     *     parameters:
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 50
     *         description: Maximum number of workspaces to return
     *       - in: query
     *         name: offset
     *         schema:
     *           type: integer
     *           default: 0
     *         description: Number of workspaces to skip
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [active, archived]
     *         description: Filter by workspace status
     *     responses:
     *       200:
     *         description: List of workspaces
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Workspace'
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    router.get('/', async (req, res) => {
        try {
            const { limit = 50, offset = 0, status } = req.query;
            const options = {
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
                status,
                user: req.user
            };

            const workspaces = await workspaceManager.listWorkspaces(options);
            return res.json(new ResponseObject(workspaces));
        } catch (err) {
            debug(`Error listing workspaces: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /:
     *   post:
     *     summary: Create a new workspace
     *     tags: [Workspaces]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *             properties:
     *               name:
     *                 type: string
     *                 description: The workspace name
     *               description:
     *                 type: string
     *                 description: The workspace description
     *     responses:
     *       201:
     *         description: Workspace created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Workspace'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    router.post('/', async (req, res) => {
        try {
            const { name, description } = req.body;

            if (!name) {
                return res.status(400).json(new ResponseObject(null, 'Workspace name is required', 400));
            }

            const workspaceData = {
                name,
                description,
                owner: req.user.id
            };

            const workspace = await workspaceManager.createWorkspace(workspaceData);
            return res.status(201).json(new ResponseObject(workspace));
        } catch (err) {
            debug(`Error creating workspace: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}:
     *   get:
     *     summary: Get a workspace by ID
     *     tags: [Workspaces]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *     responses:
     *       200:
     *         description: Workspace retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Workspace'
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace not found
     *       500:
     *         description: Server error
     */
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const workspace = await workspaceManager.getWorkspace(id);

            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if user has access to this workspace
            if (!workspaceManager.hasAccess(workspace, req.user)) {
                return res.status(403).json(new ResponseObject(null, 'Access denied', 403));
            }

            return res.json(new ResponseObject(workspace));
        } catch (err) {
            debug(`Error getting workspace: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}:
     *   put:
     *     summary: Update a workspace
     *     tags: [Workspaces]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *                 description: The workspace name
     *               description:
     *                 type: string
     *                 description: The workspace description
     *               status:
     *                 type: string
     *                 enum: [active, archived]
     *                 description: Workspace status
     *     responses:
     *       200:
     *         description: Workspace updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Workspace'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Access denied
     *       404:
     *         description: Workspace not found
     *       500:
     *         description: Server error
     */
    router.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description, status } = req.body;

            const workspace = await workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if user has access to update this workspace
            if (!workspaceManager.hasAccess(workspace, req.user, 'write')) {
                return res.status(403).json(new ResponseObject(null, 'Access denied', 403));
            }

            const workspaceData = {
                name,
                description,
                status
            };

            const updatedWorkspace = await workspaceManager.updateWorkspace(id, workspaceData);
            return res.json(new ResponseObject(updatedWorkspace));
        } catch (err) {
            debug(`Error updating workspace: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}:
     *   patch:
     *     summary: Partially update a workspace
     *     tags: [Workspaces]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *                 description: The workspace name
     *               description:
     *                 type: string
     *                 description: The workspace description
     *               status:
     *                 type: string
     *                 enum: [active, archived]
     *                 description: Workspace status
     *     responses:
     *       200:
     *         description: Workspace updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Workspace'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Access denied
     *       404:
     *         description: Workspace not found
     *       500:
     *         description: Server error
     */
    router.patch('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const workspace = await workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if user has access to update this workspace
            if (!workspaceManager.hasAccess(workspace, req.user, 'write')) {
                return res.status(403).json(new ResponseObject(null, 'Access denied', 403));
            }

            const updatedWorkspace = await workspaceManager.updateWorkspace(id, updateData);
            return res.json(new ResponseObject(updatedWorkspace));
        } catch (err) {
            debug(`Error updating workspace: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}:
     *   delete:
     *     summary: Delete a workspace
     *     tags: [Workspaces]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *     responses:
     *       200:
     *         description: Workspace deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Access denied
     *       404:
     *         description: Workspace not found
     *       500:
     *         description: Server error
     */
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;

            const workspace = await workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if user has access to delete this workspace
            if (!workspaceManager.hasAccess(workspace, req.user, 'admin')) {
                return res.status(403).json(new ResponseObject(null, 'Access denied', 403));
            }

            const result = await workspaceManager.deleteWorkspace(id);
            return res.json(new ResponseObject({ success: true }));
        } catch (err) {
            debug(`Error deleting workspace: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/documents:
     *   get:
     *     summary: List documents in a workspace
     *     tags: [Workspaces]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 50
     *         description: Maximum number of documents to return
     *       - in: query
     *         name: offset
     *         schema:
     *           type: integer
     *           default: 0
     *         description: Number of documents to skip
     *     responses:
     *       200:
     *         description: List of documents in the workspace
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/WorkspaceDocument'
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Access denied
     *       404:
     *         description: Workspace not found
     *       500:
     *         description: Server error
     */
    router.get('/:id/documents', async (req, res) => {
        try {
            const { id } = req.params;
            const { limit = 50, offset = 0 } = req.query;

            const workspace = await workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if user has access to this workspace
            if (!workspaceManager.hasAccess(workspace, req.user)) {
                return res.status(403).json(new ResponseObject(null, 'Access denied', 403));
            }

            const options = {
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10)
            };

            const documents = await workspaceManager.listWorkspaceDocuments(id, options);
            return res.json(new ResponseObject(documents));
        } catch (err) {
            debug(`Error listing workspace documents: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/documents:
     *   post:
     *     summary: Create a document in a workspace
     *     tags: [Workspaces]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - content
     *             properties:
     *               content:
     *                 type: object
     *                 description: The document content
     *     responses:
     *       201:
     *         description: Document created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/WorkspaceDocument'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Access denied
     *       404:
     *         description: Workspace not found
     *       500:
     *         description: Server error
     */
    router.post('/:id/documents', async (req, res) => {
        try {
            const { id } = req.params;
            const { content } = req.body;

            if (!content) {
                return res.status(400).json(new ResponseObject(null, 'Document content is required', 400));
            }

            const workspace = await workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if user has access to write to this workspace
            if (!workspaceManager.hasAccess(workspace, req.user, 'write')) {
                return res.status(403).json(new ResponseObject(null, 'Access denied', 403));
            }

            const document = await workspaceManager.createWorkspaceDocument(id, { content });
            return res.status(201).json(new ResponseObject(document));
        } catch (err) {
            debug(`Error creating workspace document: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    return router;
}