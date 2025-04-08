'use strict';

import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import logger, { createDebug } from '../../../../utils/log/index.js';
import ResponseObject from '../../../ResponseObject.js';
const debug = createDebug('http:routes:workspaces');

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
     *               type: object
     *               properties:
     *                 payload:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/Workspace'
     *                 total:
     *                   type: integer
     *                 offset:
     *                   type: integer
     *                 limit:
     *                   type: integer
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
            const workspaces = await req.workspaceManager.listWorkspaces({
                limit: parseInt(limit),
                offset: parseInt(offset),
                status,
            });

            debug(`Found ${workspaces.length} workspaces for user: ${req.user.id}`);

            // Structure the response as expected by the client
            const response = new ResponseObject();
            response.success(workspaces);

            return res.json(response.getResponse());
        } catch (error) {
            debug(`Error listing workspaces: ${error.message}`);
            const response = new ResponseObject();
            response.serverError(error.message);
            return res.status(response.statusCode).json(response.getResponse());
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

    /**
     * @swagger
     * /{id}/tree/paths:
     *   get:
     *     summary: Get all paths in the workspace tree
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
     *         description: Array of paths in the workspace tree
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: string
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace not found
     *       500:
     *         description: Server error
     */
    router.get('/:id/tree/paths', async (req, res) => {
        try {
            const { id } = req.params;

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const paths = workspace.tree.paths;
            const response = new ResponseObject().success(paths, 'Workspace paths retrieved successfully');
            return res.status(200).json(response.getResponse());
        } catch (err) {
            debug(`Error getting workspace paths: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/path:
     *   post:
     *     summary: Insert a path in the workspace tree
     *     description: Insert a path in the workspace tree
     *     tags: [Workspaces]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         description: Workspace ID
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               path:
     *                 type: string
     *                 description: Path to insert
     *               autoCreateLayers:
     *                 type: boolean
     *                 description: Whether to auto-create layers if they don't exist
     *                 default: true
     *     responses:
     *       201:
     *         description: Path inserted successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace not found
     *       500:
     *         description: Server error
     */
    router.post('/:id/tree/path', async (req, res) => {
        try {
            const { id } = req.params;
            const { path, autoCreateLayers = true } = req.body;

            if (!path) {
                return res.status(400).json(new ResponseObject(null, 'Path is required', 400));
            }

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Insert the path and get the result
            const result = workspace.insertPath(path, null, autoCreateLayers);

            // Workspace.js already emits 'workspace:tree:updated' event
            // We only need to check if there are WebSocket subscribers and ensure listeners are set up
            const wsTransport = req.app.locals.wsTransport;
            if (wsTransport && typeof wsTransport.broadcastToWorkspace === 'function') {
                // Check if there are WebSocket subscribers
                if (wsTransport.hasWorkspaceSubscribers(id)) {
                    debug(`Ensuring WebSocket listeners are set up for workspace ${id}`);

                    // Make sure workspace listeners are set up
                    if (typeof wsTransport.setupWorkspaceListeners === 'function') {
                        wsTransport.setupWorkspaceListeners(id, workspace);
                    }

                    // No need to broadcast again - the event is already emitted by workspace.insertPath()
                }
            }

            const response = new ResponseObject().created({
                path,
                layerIds: result.layerIds,
                tree: result.tree,
                success: true
            }, 'Path inserted successfully');

            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error inserting path: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/path:
     *   delete:
     *     summary: Remove a path from the workspace tree
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
     *               - path
     *             properties:
     *               path:
     *                 type: string
     *                 description: Path to remove
     *               recursive:
     *                 type: boolean
     *                 description: Whether to remove recursively
     *                 default: false
     *     responses:
     *       200:
     *         description: Path removed successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace or path not found
     *       500:
     *         description: Server error
     */
    router.delete('/:id/tree/path', async (req, res) => {
        try {
            const { id } = req.params;
            const { path, recursive = false } = req.body;

            if (!path) {
                return res.status(400).json(new ResponseObject(null, 'Path is required', 400));
            }

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const result = workspace.removePath(path, recursive);
            if (!result.success) {
                return res.status(404).json(new ResponseObject(null, 'Path not found', 404));
            }

            const response = new ResponseObject().success({
                path,
                recursive,
                tree: result.tree,
                success: true
            }, 'Path removed successfully');

            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error removing path: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/path/move:
     *   post:
     *     summary: Move a path in the workspace tree
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
     *               - pathFrom
     *               - pathTo
     *             properties:
     *               pathFrom:
     *                 type: string
     *                 description: Source path
     *               pathTo:
     *                 type: string
     *                 description: Destination path
     *               recursive:
     *                 type: boolean
     *                 description: Whether to move recursively
     *                 default: false
     *     responses:
     *       200:
     *         description: Path moved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace or path not found
     *       500:
     *         description: Server error
     */
    router.post('/:id/tree/path/move', async (req, res) => {
        try {
            const { id } = req.params;
            const { pathFrom, pathTo, recursive = false } = req.body;

            if (!pathFrom || !pathTo) {
                return res.status(400).json(new ResponseObject(null, 'Source and destination paths are required', 400));
            }

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const result = workspace.movePath(pathFrom, pathTo, recursive);
            if (!result.success) {
                return res.status(404).json(new ResponseObject(null, 'Path not found or move operation failed', 404));
            }

            const response = new ResponseObject().success({
                pathFrom,
                pathTo,
                recursive,
                tree: result.tree,
                success: true
            }, 'Path moved successfully');

            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error moving path: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/path/copy:
     *   post:
     *     summary: Copy a path in the workspace tree
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
     *               - pathFrom
     *               - pathTo
     *             properties:
     *               pathFrom:
     *                 type: string
     *                 description: Source path
     *               pathTo:
     *                 type: string
     *                 description: Destination path
     *               recursive:
     *                 type: boolean
     *                 description: Whether to copy recursively
     *                 default: false
     *     responses:
     *       200:
     *         description: Path copied successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace or path not found
     *       500:
     *         description: Server error
     */
    router.post('/:id/tree/path/copy', async (req, res) => {
        try {
            const { id } = req.params;
            const { pathFrom, pathTo, recursive = false } = req.body;

            if (!pathFrom || !pathTo) {
                return res.status(400).json(new ResponseObject(null, 'Source and destination paths are required', 400));
            }

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const result = workspace.copyPath(pathFrom, pathTo, recursive);
            if (!result.success) {
                return res.status(404).json(new ResponseObject(null, 'Path not found or copy operation failed', 404));
            }

            const response = new ResponseObject().success({
                pathFrom,
                pathTo,
                recursive,
                tree: result.tree,
                success: true
            }, 'Path copied successfully');

            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error copying path: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/canvas:
     *   post:
     *     summary: Insert a Canvas layer at a specified path
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
     *               - path
     *               - canvasName
     *             properties:
     *               path:
     *                 type: string
     *                 description: Parent path where to insert the canvas
     *               canvasName:
     *                 type: string
     *                 description: Name of the canvas
     *               description:
     *                 type: string
     *                 description: Canvas description
     *               color:
     *                 type: string
     *                 description: Canvas color
     *     responses:
     *       201:
     *         description: Canvas inserted successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace not found
     *       500:
     *         description: Server error
     */
    router.post('/:id/tree/canvas', async (req, res) => {
        try {
            const { id } = req.params;
            const { path, canvasName, ...canvasOptions } = req.body;

            if (!path || !canvasName) {
                return res.status(400).json(new ResponseObject(null, 'Path and canvas name are required', 400));
            }

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const result = workspace.insertCanvas(path, canvasName, canvasOptions);

            const response = new ResponseObject().created({
                path: result.path,
                canvasName: result.canvasName,
                canvasId: result.canvasId,
                tree: result.tree
            }, 'Canvas inserted successfully');

            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error inserting canvas: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/workspace:
     *   post:
     *     summary: Insert a Workspace reference at a specified path
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
     *               - path
     *               - workspaceName
     *               - targetWorkspaceId
     *             properties:
     *               path:
     *                 type: string
     *                 description: Parent path where to insert the workspace reference
     *               workspaceName:
     *                 type: string
     *                 description: Name of the workspace reference
     *               targetWorkspaceId:
     *                 type: string
     *                 description: ID of the target workspace
     *               description:
     *                 type: string
     *                 description: Workspace reference description
     *               color:
     *                 type: string
     *                 description: Workspace reference color
     *     responses:
     *       201:
     *         description: Workspace reference inserted successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace not found
     *       500:
     *         description: Server error
     */
    router.post('/:id/tree/workspace', async (req, res) => {
        try {
            const { id } = req.params;
            const { path, workspaceName, targetWorkspaceId, ...workspaceOptions } = req.body;

            if (!path || !workspaceName || !targetWorkspaceId) {
                return res.status(400).json(
                    new ResponseObject(null, 'Path, workspace name, and target workspace ID are required', 400)
                );
            }

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if the target workspace exists
            const targetWorkspace = await req.workspaceManager.getWorkspace(targetWorkspaceId);
            if (!targetWorkspace) {
                return res.status(404).json(new ResponseObject(null, 'Target workspace not found', 404));
            }

            const result = workspace.insertWorkspace(path, workspaceName, targetWorkspaceId, workspaceOptions);

            const response = new ResponseObject().created({
                path: result.path,
                workspaceName: result.workspaceName,
                workspaceId: result.workspaceId,
                targetWorkspaceId: result.targetWorkspaceId,
                tree: result.tree
            }, 'Workspace reference inserted successfully');

            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error inserting workspace reference: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/merge/up:
     *   post:
     *     summary: Merge a layer with layers above it
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
     *               - path
     *             properties:
     *               path:
     *                 type: string
     *                 description: Path to merge
     *     responses:
     *       200:
     *         description: Layer merged successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace or path not found
     *       500:
     *         description: Server error
     */
    router.post('/:id/tree/merge/up', async (req, res) => {
        try {
            const { id } = req.params;
            const { path } = req.body;

            if (!path) {
                return res.status(400).json(new ResponseObject(null, 'Path is required', 400));
            }

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const result = workspace.mergeUp(path);
            if (!result.success) {
                return res.status(404).json(new ResponseObject(null, 'Path not found or merge operation failed', 404));
            }

            const response = new ResponseObject().success({
                path,
                tree: result.tree,
                success: true
            }, 'Layer merged up successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error merging layer up: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/merge/down:
     *   post:
     *     summary: Merge a layer with layers below it
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
     *               - path
     *             properties:
     *               path:
     *                 type: string
     *                 description: Path to merge
     *     responses:
     *       200:
     *         description: Layer merged successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace or path not found
     *       500:
     *         description: Server error
     */
    router.post('/:id/tree/merge/down', async (req, res) => {
        try {
            const { id } = req.params;
            const { path } = req.body;

            if (!path) {
                return res.status(400).json(new ResponseObject(null, 'Path is required', 400));
            }

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const result = workspace.mergeDown(path);
            if (!result.success) {
                return res.status(404).json(new ResponseObject(null, 'Path not found or merge operation failed', 404));
            }

            const response = new ResponseObject().success({
                path,
                tree: result.tree,
                success: true
            }, 'Layer merged down successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error merging layer down: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/layers:
     *   get:
     *     summary: Get all layers in the workspace
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
     *         description: Layers retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace not found
     *       500:
     *         description: Server error
     */
    router.get('/:id/tree/layers', async (req, res) => {
        try {
            const { id } = req.params;

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const layers = workspace.layers.list();
            const response = new ResponseObject().success({
                layers,
                tree: workspace.jsonTree
            }, 'Layers retrieved successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error getting layers: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/layers:
     *   post:
     *     summary: Create a new layer
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
     *               - name
     *             properties:
     *               name:
     *                 type: string
     *                 description: Layer name
     *               type:
     *                 type: string
     *                 description: Layer type
     *                 default: context
     *               description:
     *                 type: string
     *                 description: Layer description
     *               color:
     *                 type: string
     *                 description: Layer color
     *               locked:
     *                 type: boolean
     *                 description: Whether the layer is locked
     *     responses:
     *       201:
     *         description: Layer created successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace not found
     *       500:
     *         description: Server error
     */
    router.post('/:id/tree/layers', async (req, res) => {
        try {
            const { id } = req.params;
            const layerOptions = req.body;

            if (!layerOptions.name) {
                return res.status(400).json(new ResponseObject(null, 'Layer name is required', 400));
            }

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const layer = workspace.createLayer(layerOptions);
            const response = new ResponseObject().created({
                layer,
                tree: workspace.jsonTree
            }, 'Layer created successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error creating layer: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/layers/{name}:
     *   get:
     *     summary: Get a layer by name
     *     tags: [Workspaces]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *       - in: path
     *         name: name
     *         required: true
     *         schema:
     *           type: string
     *         description: Layer name
     *     responses:
     *       200:
     *         description: Layer retrieved successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace or layer not found
     *       500:
     *         description: Server error
     */
    router.get('/:id/tree/layers/:name', async (req, res) => {
        try {
            const { id, name } = req.params;

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const layer = workspace.getLayer(name);
            if (!layer) {
                return res.status(404).json(new ResponseObject(null, 'Layer not found', 404));
            }

            const response = new ResponseObject().success({
                layer,
                tree: workspace.jsonTree
            }, 'Layer retrieved successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error getting layer: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/layers/{name}:
     *   put:
     *     summary: Update a layer
     *     tags: [Workspaces]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *       - in: path
     *         name: name
     *         required: true
     *         schema:
     *           type: string
     *         description: Layer name
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               description:
     *                 type: string
     *                 description: Layer description
     *               color:
     *                 type: string
     *                 description: Layer color
     *               locked:
     *                 type: boolean
     *                 description: Whether the layer is locked
     *     responses:
     *       200:
     *         description: Layer updated successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace or layer not found
     *       500:
     *         description: Server error
     */
    router.put('/:id/tree/layers/:name', async (req, res) => {
        try {
            const { id, name } = req.params;
            const updateOptions = req.body;

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const result = workspace.updateLayer(name, updateOptions);
            if (!result.success) {
                return res.status(404).json(new ResponseObject(null, 'Layer not found or update failed', 404));
            }

            const response = new ResponseObject().success({
                name,
                options: updateOptions,
                tree: result.tree,
                success: true
            }, 'Layer updated successfully');
            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error updating layer: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/layers/{name}/rename:
     *   post:
     *     summary: Rename a layer
     *     tags: [Workspaces]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *       - in: path
     *         name: name
     *         required: true
     *         schema:
     *           type: string
     *         description: Current layer name
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - newName
     *             properties:
     *               newName:
     *                 type: string
     *                 description: New layer name
     *     responses:
     *       200:
     *         description: Layer renamed successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace or layer not found
     *       500:
     *         description: Server error
     */
    router.post('/:id/tree/layers/:name/rename', async (req, res) => {
        try {
            const { id, name } = req.params;
            const { newName } = req.body;

            if (!newName) {
                return res.status(400).json(new ResponseObject(null, 'New name is required', 400));
            }

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const result = workspace.renameLayer(name, newName);
            if (!result.success) {
                return res.status(404).json(new ResponseObject(null, 'Layer not found or rename failed', 404));
            }

            const response = new ResponseObject().success({
                oldName: name,
                newName: result.newName,
                tree: result.tree,
                success: true
            }, 'Layer renamed successfully');

            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error renaming layer: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}/tree/layers/{name}:
     *   delete:
     *     summary: Delete a layer
     *     tags: [Workspaces]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *       - in: path
     *         name: name
     *         required: true
     *         schema:
     *           type: string
     *         description: Layer name
     *     responses:
     *       200:
     *         description: Layer deleted successfully
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Workspace or layer not found
     *       500:
     *         description: Server error
     */
    router.delete('/:id/tree/layers/:name', async (req, res) => {
        try {
            const { id, name } = req.params;

            const workspace = await req.workspaceManager.getWorkspace(id);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            const result = workspace.deleteLayer(name);
            if (!result.success) {
                return res.status(404).json(new ResponseObject(null, 'Layer not found or delete failed', 404));
            }

            const response = new ResponseObject().success({
                name,
                tree: result.tree,
                success: true
            }, 'Layer deleted successfully');

            return res.status(response.statusCode).json(response.getResponse());
        } catch (err) {
            debug(`Error deleting layer: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    return router;
}
