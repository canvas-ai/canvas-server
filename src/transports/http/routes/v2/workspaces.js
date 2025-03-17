'use strict';

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('http:routes:workspaces');
import ResponseObject from '@/transports/ResponseObject.js';
import { requireWorkspaceManager } from '../../middleware/userManagers.js';

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
 * @param {Object} options.userManager - User manager
 * @returns {express.Router} - Express router
 */
export default function workspacesRoutes(options) {
    const router = express.Router();
    const { auth, userManager } = options;

    if (!auth) {
        throw new Error('Auth service is required');
    }

    if (!userManager) {
        throw new Error('User manager is required');
    }

    // Apply auth middleware to all routes
    router.use(auth.getAuthMiddleware());

    // Apply workspace manager middleware to all routes
    router.use(requireWorkspaceManager({ userManager }));

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
            debug(`Listing workspaces for user: ${req.user.id}`);

            // Get workspaces from the user's workspace manager
            const workspaces = req.workspaceManager.listWorkspaces({
                limit: parseInt(limit),
                offset: parseInt(offset),
                status,
            });

            const response = new ResponseObject().success({
                workspaces,
                total: workspaces.length,
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error listing workspaces: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
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
                return res.status(400).json(new ResponseObject().badRequest('Workspace name is required'));
            }

            // Use name as the workspaceID and pass description as an option
            const workspace = await req.workspaceManager.createWorkspace(name, {
                description,
                owner: req.user.id,
            });

            debug(`Created workspace: ${workspace.id} for user: ${req.user.id}`);
            const response = new ResponseObject().created(workspace, 'Workspace created successfully');
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            debug(`Error creating workspace: ${error.message}`);
            const response = new ResponseObject().serverError(error.message);
            res.status(response.statusCode).json(response.getResponse());
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
            const workspace = await req.workspaceManager.getWorkspace(id);

            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
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

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const workspaceData = {
                name,
                description,
                status,
            };

            const updatedWorkspace = await req.workspaceManager.updateWorkspace(id, workspaceData);
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

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const updatedWorkspace = await req.workspaceManager.updateWorkspace(id, updateData);
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

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const result = await req.workspaceManager.deleteWorkspace(id);
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

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const options = {
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
            };

            const documents = await req.workspaceManager.listWorkspaceDocuments(id, options);
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

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const document = await req.workspaceManager.createWorkspaceDocument(id, { content });
            return res.status(201).json(new ResponseObject(document));
        } catch (err) {
            debug(`Error creating workspace document: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree:
     *   get:
     *     summary: Get the JSON tree structure of a workspace
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
     *         description: JSON tree structure of the workspace
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Access denied
     *       404:
     *         description: Workspace not found
     *       500:
     *         description: Server error
     */
    router.get('/:id/tree', async (req, res) => {
        try {
            const { id } = req.params;

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const tree = workspace.jsonTree;
            const response = new ResponseObject().success(tree, 'Workspace tree retrieved successfully');
            debug(`Workspace tree: ${JSON.stringify(tree, null, 2)}`);
            return res.status(200).json(response.getResponse());
        } catch (err) {
            debug(`Error getting workspace tree: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    return router;
}
