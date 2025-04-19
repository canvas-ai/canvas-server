'use strict';

import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import logger, { createDebug } from '../../../../utils/log/index.js';
import ResponseObject from '../../../ResponseObject.js';
const debug = createDebug('http:routes:workspaces');

import { requireWorkspaceManager } from '../../middleware/userManagers.js';
import { WORKSPACE_STATUS } from '../../../../managers/workspace/index.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     WorkspaceMetadata:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The workspace ID (matches name)
 *         name:
 *           type: string
 *           description: The workspace name
 *         path:
 *           type: string
 *           description: Filesystem path to the workspace
 *         owner:
 *           type: string
 *           description: The workspace owner ID
 *         created:
 *           type: string
 *           format: date-time
 *           description: Index creation timestamp
 *         status:
 *           type: string
 *           enum: [active, inactive, loading, unloading, error, not_found, deleted] # Updated Enum
 *           description: Workspace status in the manager index
 *         lastAccessed:
 *            type: string
 *            format: date-time
 *            nullable: true
 *            description: Timestamp of last access
 *     WorkspaceConfig:
 *       allOf:
 *         - $ref: '#/components/schemas/WorkspaceMetadata' # Inherit metadata
 *         - type: object
 *           properties:
 *             label:
 *               type: string
 *               description: User-defined label for the workspace
 *             description:
 *               type: string
 *               description: User-defined description
 *             color:
 *               type: string
 *               format: hex-color # Assuming #RRGGBB or #RGB
 *               description: User-defined color
 *             locked:
 *               type: boolean
 *               description: Whether the workspace is locked
 *             type:
 *               type: string
 *               description: Workspace type (e.g., 'workspace', 'template')
 *             acl:
 *               type: object
 *               additionalProperties: true
 *               description: Access control list
 *             metadata:
 *               type: object
 *               additionalProperties: true
 *               description: Custom metadata
 *             restApi:
 *               type: object
 *               properties:
 *                  enabled:
 *                     type: boolean
 *                  port:
 *                     type: integer
 *                  host:
 *                     type: string
 *               description: REST API specific settings
 *             updated:
 *               type: string
 *               format: date-time
 *               description: Last update timestamp of config
 *     WorkspaceDocument:
 *       type: object
 *       description: Represents a document within SynapsD (structure depends on schema)
 *       # Add specific document properties based on BaseDocument or common fields if known
 *     TreeLayer:
 *        type: object
 *        properties:
 *           id: { type: string, format: uuid }
 *           type: { type: string }
 *           name: { type: string }
 *           label: { type: string, nullable: true }
 *           description: { type: string, nullable: true }
 *           color: { type: string, format: hex-color, nullable: true }
 *           locked: { type: boolean, default: false }
 *     TreeNode:
 *        type: object
 *        properties:
 *          id: { type: string, format: uuid }
 *          type: { type: string }
 *          name: { type: string }
 *          label: { type: string, nullable: true }
 *          description: { type: string, nullable: true }
 *          color: { type: string, format: hex-color, nullable: true }
 *          locked: { type: boolean }
 *          children:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/TreeNode'
 *   parameters:
 *     WorkspaceIdParam:
 *       in: path
 *       name: id
 *       required: true
 *       schema:
 *         type: string
 *       description: The ID (name) of the workspace
 *     DocumentIdParam:
 *        in: path
 *        name: docId
 *        required: true
 *        schema:
 *          type: string
 *        description: The ID of the document
 *     DocumentHashParam:
 *       in: path
 *       name: hashString
 *       required: true
 *       schema:
 *         type: string
 *       description: The checksum hash string of the document
 *     LayerNameParam:
 *       in: path
 *       name: layerName
 *       required: true
 *       schema:
 *         type: string
 *       description: The name of the layer
 *     LayerIdParam:
 *       in: path
 *       name: layerId
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 *       description: The ID of the layer
 *     ContextQueryParam:
 *        in: query
 *        name: context
 *        schema:
 *          type: string
 *        description: Context path (e.g., /proj/client) or comma-separated layer names (e.g., proj,client)
 *     FeaturesQueryParam:
 *        in: query
 *        name: features
 *        schema:
 *          type: string
 *        description: Comma-separated feature layer names (e.g., schema,tag)
 *     FiltersQueryParam:
 *        in: query
 *        name: filters
 *        schema:
 *          type: string
 *        description: Comma-separated filter layer names
 *     LimitQueryParam:
 *        in: query
 *        name: limit
 *        schema:
 *          type: integer
 *          default: 50
 *        description: Maximum number of items to return
 *     OffsetQueryParam:
 *        in: query
 *        name: offset
 *        schema:
 *          type: integer
 *          default: 0
 *        description: Number of items to skip
 *     RecursiveQueryParam:
 *        in: query
 *        name: recursive
 *        schema:
 *          type: boolean
 *          default: false
 *        description: Apply action recursively
 *     PathQueryParam:
 *        in: query
 *        name: path
 *        required: true
 *        schema:
 *          type: string
 *        description: The tree path for the operation
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

    if (!auth) { throw new Error('Auth service is required'); }
    if (!userManager) { throw new Error('User manager is required'); }

    // Apply auth middleware to all routes
    router.use(auth.getAuthMiddleware());

    // Apply workspace manager middleware to all routes
    router.use(requireWorkspaceManager({ userManager }));

    // === Helper Middleware ===

    /**
     * Middleware to translate workspace name to ID and ensure existence
     * This allows APIs to be called with human-readable names while using internal IDs
     */
    const translateWorkspaceNameToId = async (req, res, next) => {
        const workspaceName = req.params.id;
        const userId = req.user?.id;

        if (!userId) {
            const resp = new ResponseObject().unauthorized();
            return res.status(resp.statusCode).json(resp.getResponse());
        }

        // If the ID looks like a UUID or namespaced ID, don't try to translate
        if (workspaceName && (workspaceName.includes('-') || workspaceName.length > 20)) {
            debug(`Using provided workspace ID directly: ${workspaceName}`);
            return next();
        }

        // Try to find the workspace ID by name
        try {
            const workspaceId = req.workspaceManager.getWorkspaceIdByName(userId, workspaceName);

            if (!workspaceId) {
                debug(`translateWorkspaceNameToId: Workspace name "${workspaceName}" not found for user ${userId}`);
                const response = new ResponseObject().notFound(`Workspace "${workspaceName}" not found.`);
                return res.status(response.statusCode).json(response.getResponse());
            }

            // Replace the name with the actual ID in the request params
            debug(`Translated workspace name "${workspaceName}" to ID "${workspaceId}"`);
            req.params.id = workspaceId;
            req.originalWorkspaceName = workspaceName; // Store original name for reference

            next();
        } catch (error) {
            debug(`Error translating workspace name: ${error.message}`);
            const response = new ResponseObject().serverError(`Error processing workspace name: ${error.message}`);
            return res.status(response.statusCode).json(response.getResponse());
        }
    };

    // Insert translateWorkspaceNameToId middleware before other middleware
    router.use('/:id*', translateWorkspaceNameToId);

    /**
     * Middleware to ensure the requested workspace exists in the index and the user has access.
     * Returns 404 if not in index, 403 if exists but user lacks read access.
     */
    const ensureWorkspaceExists = async (req, res, next) => {
        const workspaceId = req.params.id;
        const userId = req.user?.id; // Assuming auth middleware sets req.user.id

        if (!userId) {
             logger.error('ensureWorkspaceExists: Missing userId in request.');
             const response = new ResponseObject().unauthorized('User authentication required.');
             return res.status(response.statusCode).json(response.getResponse());
        }

        // 1. Check if workspace ID exists in the global index at all
        if (!req.workspaceManager.index[workspaceId]) {
            debug(`ensureWorkspaceExists: Workspace "${workspaceId}" not found in index.`);
            const response = new ResponseObject().notFound(`Workspace "${workspaceId}" not found.`);
            return res.status(response.statusCode).json(response.getResponse());
        }

        // 2. Check if the user has at least read access to this workspace
        if (!req.workspaceManager.hasWorkspace(userId, workspaceId)) {
            debug(`ensureWorkspaceExists: User "${userId}" denied read access to workspace "${workspaceId}".`);
            const response = new ResponseObject().forbidden(`Access denied to workspace "${workspaceId}".`);
            return res.status(response.statusCode).json(response.getResponse());
        }

        // User has access, proceed
        next();
    };

     /**
     * Middleware to ensure the requested workspace exists, user has access, and it's active (loaded and started).
     * Attaches the workspace instance to req.workspace.
     * Returns 404 if not in index, 403 if no access, 409 if not active.
     */
    const ensureActiveWorkspace = async (req, res, next) => {
        const workspaceId = req.params.id;
        const userId = req.user?.id;

        if (!userId) {
             logger.error('ensureActiveWorkspace: Missing userId in request.');
             const response = new ResponseObject().unauthorized('User authentication required.');
             return res.status(response.statusCode).json(response.getResponse());
        }

        // 1. Check existence and access (incorporates #checkAccess via hasWorkspace)
        if (!req.workspaceManager.hasWorkspace(userId, workspaceId)) {
            // Determine if it's 404 or 403
            if (!req.workspaceManager.index[workspaceId]) {
                 debug(`ensureActiveWorkspace: Workspace "${workspaceId}" not found in index.`);
                 const response = new ResponseObject().notFound(`Workspace "${workspaceId}" not found.`);
                 return res.status(response.statusCode).json(response.getResponse());
            } else {
                 debug(`ensureActiveWorkspace: User "${userId}" denied read access to workspace "${workspaceId}".`);
                 const response = new ResponseObject().forbidden(`Access denied to workspace "${workspaceId}".`);
                 return res.status(response.statusCode).json(response.getResponse());
            }
        }

        // 2. Check if it's active (implies loaded)
        if (!req.workspaceManager.isActive(userId, workspaceId)) {
            const status = req.workspaceManager.getWorkspaceStatus(userId, workspaceId);
            debug(`ensureActiveWorkspace: Workspace "${workspaceId}" is not active for user "${userId}". Current status: ${status}`);
            // Use 409 Conflict as the resource exists but is not in the correct state
            const response = new ResponseObject().conflict(`Workspace "${workspaceId}" exists but is not active (Status: ${status}). Start it first.`);
            return res.status(response.statusCode).json(response.getResponse());
        }

        // Get the active workspace instance
        const workspace = req.workspaceManager.getWorkspace(userId, workspaceId);
        if (!workspace || !workspace.db) { // Double check instance and DB are available
             logger.error(`Failed to get active workspace instance or DB for "${workspaceId}" despite isActive check passing.`);
             const response = new ResponseObject().serverError(`Internal error retrieving active workspace "${workspaceId}".`);
             return res.status(response.statusCode).json(response.getResponse());
        }
        req.workspace = workspace; // Attach workspace instance to request
        req.db = workspace.db;     // Attach db instance for convenience
        next();
    };

    // === Helper Functions ===

    const parseCommaSeparated = (param) => {
        if (!param) return [];
        return param.split(',').map(s => s.trim()).filter(Boolean);
    };

    const parseContextSpec = (param) => {
        if (!param) return '/'; // Default to root if not provided
        // If it looks like a path, return as is. Otherwise, assume comma-separated layers.
        return param.includes('/') ? param : parseCommaSeparated(param);
    };

    // =======================================================================
    // == Workspace Management & Configuration Routes (/ and /:id level)
    // =======================================================================

    /**
     * @swagger
     * /workspaces:
     *   get:
     *     summary: List all workspaces (metadata)
     *     tags: [Workspaces]
     *     parameters:
     *       - $ref: '#/components/parameters/LimitQueryParam'
     *       - $ref: '#/components/parameters/OffsetQueryParam'
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [active, inactive, loading, unloading, error, not_found, deleted] # Updated Enum
     *         description: Filter by workspace status
     *     responses:
     *       200:
     *         description: List of workspace metadata
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 payload:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/WorkspaceMetadata' # Use Metadata schema
     *                 # Add pagination details if implemented (total, offset, limit)
     *       401: { $ref: '#/components/responses/UnauthorizedError' }
     *       500: { $ref: '#/components/responses/ServerError' }
     */
    router.get('/', async (req, res) => {
        const userId = req.user?.id;
        const statusFilter = req.query.status;

        if (!userId) {
             const resp = new ResponseObject().unauthorized();
             return res.status(resp.statusCode).json(resp.getResponse());
        }

        try {
            const workspaces = req.workspaceManager.listWorkspaces(userId, statusFilter);
            const response = new ResponseObject().success(workspaces);
            res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            logger.error(`Error listing workspaces for user ${userId}: ${error.message}`, error);
            const response = new ResponseObject().serverError(error.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /workspaces:
     *   post:
     *     summary: Create a new workspace definition
     *     tags: [Workspaces]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [name]
     *             properties:
     *               name:
     *                 type: string
     *                 description: The workspace name (will also be used as ID)
     *               description: { type: string }
     *               label: { type: string }
     *               color: { type: string, format: hex-color }
     *               # Add other initial config properties if needed
     *     responses:
     *       201:
     *         description: Workspace created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/WorkspaceMetadata' # Return metadata
     *       400: { $ref: '#/components/responses/BadRequestError' }
     *       401: { $ref: '#/components/responses/UnauthorizedError' }
     *       409: { $ref: '#/components/responses/ConflictError' } # If workspace exists
     *       500: { $ref: '#/components/responses/ServerError' }
     */
    router.post('/', async (req, res) => {
        const userId = req.user?.id;
        const { name, ...initialConfig } = req.body;

        if (!userId) {
             const resp = new ResponseObject().unauthorized();
             return res.status(resp.statusCode).json(resp.getResponse());
        }

        if (!name) {
            const response = new ResponseObject().badRequest('Workspace name is required');
            return res.status(response.statusCode).json(response.getResponse());
        }

        // hasWorkspace checks access and existence (userID first)
        if (req.workspaceManager.hasWorkspace(userId, name)) {
            const response = new ResponseObject().conflict(`Workspace "${name}" already exists.`);
            return res.status(response.statusCode).json(response.getResponse());
        }

        // Create workspace definition in the manager
        const workspaceMetadata = await req.workspaceManager.createWorkspace(userId, name, initialConfig);

        if (!workspaceMetadata) {
             throw new Error('Workspace creation returned no metadata.'); // Should not happen
        }

        debug(`Created workspace definition: ${name} for user: ${userId}`);
        const response = new ResponseObject().created(workspaceMetadata, 'Workspace created successfully');
        res.status(response.statusCode).json(response.getResponse());
    });

    /**
     * @swagger
     * /workspaces/{id}:
     *   get:
     *     summary: Get workspace details (config and status)
     *     tags: [Workspaces]
     *     parameters:
     *       - $ref: '#/components/parameters/WorkspaceIdParam'
     *     responses:
     *       200:
     *         description: Workspace details
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/WorkspaceConfig' # Return full config if loaded, else metadata
     *       401: { $ref: '#/components/responses/UnauthorizedError' }
     *       404: { $ref: '#/components/responses/NotFoundError' }
     *       500: { $ref: '#/components/responses/ServerError' }
     */
    router.get('/:id', ensureWorkspaceExists, async (req, res) => { // Use middleware
        const workspaceId = req.params.id;
        const userId = req.user?.id;

        if (!userId) {
             const resp = new ResponseObject().unauthorized();
             return res.status(resp.statusCode).json(resp.getResponse());
        }

        try {
            let workspaceData;
            if (req.workspaceManager.isLoaded(userId, workspaceId)) {
                const workspace = req.workspaceManager.getWorkspace(userId, workspaceId);
                workspaceData = workspace.toJSON(); // Get full config from loaded instance
                // Add current runtime status to the response?
                workspaceData.runtimeStatus = workspace.status;
                debug(`Returning loaded workspace config for "${workspaceId}" for user ${userId}`);
            } else {
                // Get metadata from index (access already checked by middleware)
                workspaceData = req.workspaceManager.index[workspaceId];
                debug(`Returning workspace metadata for "${workspaceId}" (not loaded) for user ${userId}`);
            }

            // Note: workspaceData could be either instance.toJSON() or index metadata here
            return res.json(new ResponseObject(workspaceData));
        } catch (err) {
            debug(`Error getting workspace ${workspaceId}: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /workspaces/{id}:
     *   patch:
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
     *               color:
     *                 type: string
     *                 format: hexcolor
 *                 description: Workspace color
 *               label:
 *                 type: string
 *                 description: Workspace label
 *               locked:
 *                 type: boolean
 *                 description: Whether the workspace is locked
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
    router.put('/:id', ensureWorkspaceExists, async (req, res) => { // ensureWorkspaceExists checks read access
        const workspaceId = req.params.id;
        const updates = req.body;
        const userId = req.user?.id;

        if (!userId) {
             const resp = new ResponseObject().unauthorized();
             return res.status(resp.statusCode).json(resp.getResponse());
        }

        // Check if workspace exists in the index
        if (!req.workspaceManager.index[workspaceId]) {
            debug(`Workspace ${workspaceId} not found in index for PUT update.`);
            return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
        }

        // Apply updates property by property using setWorkspaceProperty
        const allowedUpdates = ['name', 'description', 'color', 'label', 'locked', 'acl']; // Define updatable fields
        let updateErrors = [];
        let updateSuccess = false;

        for (const key of allowedUpdates) {
            if (updates.hasOwnProperty(key)) {
                const success = await req.workspaceManager.setWorkspaceProperty(userId, workspaceId, key, updates[key]);
                if (!success) {
                    updateErrors.push(`Failed to update ${key}.`);
                    debug(`Failed update for ${workspaceId}: key=${key}, value=${updates[key]}`);
                } else {
                    updateSuccess = true; // Mark if at least one update succeeded
                }
            }
        }

        if (updateErrors.length > 0) {
            // Decide how to handle partial failures - here we'll report error but still return potentially updated data
            logger.error(`Partial failure updating workspace ${workspaceId}: ${updateErrors.join(' ')}`);
            // Consider returning 500 or 400 based on failure type?
        }

        // Fetch updated data to return (prefer loaded instance, fallback to index)
        const finalWorkspaceData = req.workspaceManager.getWorkspace(userId, workspaceId)?.toJSON() || req.workspaceManager.index[workspaceId];

        const response = new ResponseObject(finalWorkspaceData);
        if (!updateSuccess && updateErrors.length > 0) {
            // If no updates succeeded
            response.serverError(updateErrors.join(' '));
            return res.status(response.statusCode).json(response.getResponse());
        }

        // If some/all updates succeeded
        response.success(finalWorkspaceData, updateErrors.length > 0 ? 'Workspace updated with some errors.' : 'Workspace updated successfully.');
        return res.json(response.getResponse());
    });

    /**
     * @swagger
     * /workspaces/{id}:
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
    router.delete('/:id', ensureWorkspaceExists, async (req, res) => { // ensureWorkspaceExists checks read access
        const workspaceId = req.params.id;
        const userId = req.user?.id;

        if (!userId) {
             const resp = new ResponseObject().unauthorized();
             return res.status(resp.statusCode).json(resp.getResponse());
        }

        try {
            // destroyWorkspace requires write access (owner check internally)
            const success = await req.workspaceManager.destroyWorkspace(userId, workspaceId);
            if (success) {
                const response = new ResponseObject().success(`Workspace "${workspaceId}" destroyed successfully.`);
                return res.json(response.getResponse());
            }
        } catch (error) {
             logger.error(`Error moving path: ${error.message}`, error);
             const response = new ResponseObject().serverError(error.message);
             return res.status(response.statusCode).json(response.getResponse());
         }
    });

    /**
     * @swagger
     * /workspaces/{id}/tree/paths/actions/copy:
     *   post:
     *     summary: Copy a path within the tree
     *     tags: [Workspaces, Tree, Actions]
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
     *               pathFrom: { type: string }
     *               pathTo: { type: string }
     *               recursive: { type: boolean, default: false }
     *     responses:
     *       200:
     *         description: Path copied
     *         content:
     *            application/json:
     *              schema:
     *                type: object
     *                properties:
     *                  success: { type: boolean }
     *                  tree: { $ref: '#/components/schemas/TreeNode', nullable: true }
     *       400: { $ref: '#/components/responses/BadRequestError' } # Invalid paths
     *       401: { $ref: '#/components/responses/UnauthorizedError' }
     *       404: { $ref: '#/components/responses/NotFoundError' } # Source path not found
     *       409: { $ref: '#/components/responses/ConflictError' } # Target path already exists
     *       500: { $ref: '#/components/responses/ServerError' }
     */
    router.post('/:id/tree/paths/actions/copy', async (req, res) => {
         const workspaceId = req.params.id;
         const { pathFrom, pathTo, recursive = false } = req.body;

          if (!pathFrom || !pathTo) {
             const response = new ResponseObject().badRequest('Source and destination paths are required');
             return res.status(response.statusCode).json(response.getResponse());
         }

         try {
             debug(`Copying path from "${pathFrom}" to "${pathTo}" (recursive: ${recursive}) in workspace "${workspaceId}" tree for user ${req.user.id}`);

             const result = req.workspace.copyPath(pathFrom, pathTo, recursive);

             if (!result.success) {
                 const response = new ResponseObject().notFound('Path not found or copy operation failed');
                 return res.status(response.statusCode).json(response.getResponse());
             }

             const response = new ResponseObject().success(result, 'Path copied successfully');
             return res.json(response.getResponse());
         } catch (error) {
             logger.error(`Error copying path: ${error.message}`, error);
             const response = new ResponseObject().serverError(error.message);
             return res.status(response.statusCode).json(response.getResponse());
         }
    });

    /**
     * @swagger
     * /workspaces/{id}/tree/paths/actions/merge-up:
     *   post:
     *     summary: Merge layer bitmaps upwards (Placeholder)
     *     tags: [Workspaces, Tree, Actions]
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
     *             required: [path]
     *             properties:
     *               path: { type: string }
     *     responses:
     *       501: { $ref: '#/components/responses/NotImplemented' }
     */
    router.post('/:id/tree/paths/actions/merge-up', async (req, res) => {
        const response = new ResponseObject().notImplemented('Merge-up action not implemented yet.');
        return res.status(response.statusCode).json(response.getResponse());
    });

    /**
     * @swagger
     * /workspaces/{id}/tree/paths/actions/merge-down:
     *   post:
     *     summary: Merge layer bitmaps downwards (Placeholder)
     *     tags: [Workspaces, Tree, Actions]
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
     *             required: [path]
     *             properties:
     *               path: { type: string }
     *     responses:
     *       501: { $ref: '#/components/responses/NotImplemented' }
     */
    router.post('/:id/tree/paths/actions/merge-down', async (req, res) => {
        const response = new ResponseObject().notImplemented('Merge-down action not implemented yet.');
        return res.status(response.statusCode).json(response.getResponse());
    });


    // === Layer Routes ===

    /**
     * @swagger
     * /workspaces/{id}/layers:
     *   get:
     *     summary: List all layer definitions
     *     tags: [Workspaces, Layers]
     *     parameters:
     *       - $ref: '#/components/parameters/WorkspaceIdParam'
     *     responses:
     *       200:
     *         description: List of layer definitions
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                  payload:
     *                      type: array
     *                      items: { $ref: '#/components/schemas/TreeLayer' }
     *       401: { $ref: '#/components/responses/UnauthorizedError' }
     *       404: { $ref: '#/components/responses/NotFoundError' }
     *       500: { $ref: '#/components/responses/ServerError' }
     */
    router.get('/:id/layers', async (req, res) => {
        const workspaceId = req.params.id;
        try {
            debug(`Listing layers for workspace "${workspaceId}" for user ${req.user.id}`);
            // Access layers via req.db.tree.layers (SynapsD -> ContextTree -> LayerIndex)
            const layers = req.db.tree.layers.listLayers(); // Assuming listLayers() exists

            const response = new ResponseObject().success(layers);
            return res.json(response.getResponse());
        } catch (error) {
            logger.error(`Error listing layers for workspace "${workspaceId}" for user ${req.user.id}: ${error.message}`, error);
            const response = new ResponseObject().serverError(error.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /workspaces/{id}/layers:
     *   post:
     *     summary: Create a new layer definition
     *     tags: [Workspaces, Layers]
     *     parameters:
     *       - $ref: '#/components/parameters/WorkspaceIdParam'
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [name]
     *             properties:
     *               name: { type: string }
     *               type: { type: string, default: "context" }
     *               id: { type: string, format: uuid, description: "Optional UUID, generated if omitted" }
     *               label: { type: string }
     *               description: { type: string }
     *               color: { type: string, format: hex-color }
     *               locked: { type: boolean }
     *               # Add other layer options
     *     responses:
     *       201:
     *         description: Layer created
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/TreeLayer' }
     *       400: { $ref: '#/components/responses/BadRequestError' } # Missing name, invalid options
     *       401: { $ref: '#/components/responses/UnauthorizedError' }
     *       404: { $ref: '#/components/responses/NotFoundError' }
     *       409: { $ref: '#/components/responses/ConflictError' } # Layer name/ID exists
     *       500: { $ref: '#/components/responses/ServerError' }
     */
    router.post('/:id/layers', async (req, res) => {
        const workspaceId = req.params.id;
        const layerOptions = req.body;

        if (!layerOptions || !layerOptions.name) {
            const response = new ResponseObject().badRequest('Layer "name" is required in request body.');
            return res.status(response.statusCode).json(response.getResponse());
        }

        try {
            debug(`Creating layer "${layerOptions.name}" in workspace "${workspaceId}" for user ${req.user.id}`);
             // Use workspace.createLayer which wraps db.tree.createLayer
            const layer = req.workspace.createLayer(layerOptions); // createLayer handles ID generation

             if (!layer) { // Should throw on failure usually
                 throw new Error(`Failed to create layer "${layerOptions.name}".`);
             }

            const response = new ResponseObject().created(layer, `Layer "${layer.name}" created successfully.`);
            return res.status(response.statusCode).json(response.getResponse());
        } catch (error) {
            logger.error(`Error creating layer in workspace "${workspaceId}" for user ${req.user.id}: ${error.message}`, error);
            const response = new ResponseObject().serverError(error.message);
            // Handle conflict errors specifically? LayerIndex might throw specific errors.
            if (error.message.includes('already exists')) { // Crude check
                 response.conflict(error.message);
            }
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /workspaces/{id}/layers/{layerName}:
     *   get:
     *     summary: Get layer definition by name
     *     tags: [Workspaces, Layers]
     *     parameters:
     *       - $ref: '#/components/parameters/WorkspaceIdParam'
     *       - $ref: '#/components/parameters/LayerNameParam'
     *     responses:
     *       200:
     *         description: Layer definition
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/TreeLayer' }
     *       401: { $ref: '#/components/responses/UnauthorizedError' }
     *       404: { $ref: '#/components/responses/NotFoundError' } # Layer or Workspace not found
     *       500: { $ref: '#/components/responses/ServerError' }
     */
    router.get('/:id/layers/:layerName', async (req, res) => {
        const workspaceId = req.params.id;
        const layerName = req.params.layerName;
        try {
            debug(`Getting layer "${layerName}" in workspace "${workspaceId}" for user ${req.user.id}`);
            const layer = req.workspace.getLayer(layerName); // Use Workspace wrapper

            if (!layer) {
                const response = new ResponseObject().notFound(`Layer "${layerName}" not found in workspace "${workspaceId}".`);
                return res.status(response.statusCode).json(response.getResponse());
            }

            const response = new ResponseObject().success(layer);
            return res.json(response.getResponse());
        } catch (error) {
            logger.error(`Error getting layer: ${error.message}`, error);
            const response = new ResponseObject().serverError(error.message);
            return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /workspaces/{id}/layers/{layerName}:
     *   patch:
     *     summary: Update layer properties
     *     tags: [Workspaces, Layers]
     *     parameters:
     *       - $ref: '#/components/parameters/WorkspaceIdParam'
     *       - $ref: '#/components/parameters/LayerNameParam'
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               # List editable properties from TreeLayer schema
     *               label: { type: string, nullable: true }
     *               description: { type: string, nullable: true }
     *               color: { type: string, format: hex-color, nullable: true }
     *               locked: { type: boolean }
     *               # Add other updatable options
     *     responses:
     *       200:
     *         description: Layer updated
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/TreeLayer' } # Return updated layer
     *       401: { $ref: '#/components/responses/UnauthorizedError' }
     *       404: { $ref: '#/components/responses/NotFoundError' } # Layer not found
     *       500: { $ref: '#/components/responses/ServerError' }
     */
    router.put('/:id/layers/:layerName', async (req, res) => {
        const workspaceId = req.params.id;
        const layerName = req.params.layerName;
        const updates = req.body;

        if (!updates || Object.keys(updates).length === 0) {
             const response = new ResponseObject().badRequest('Request body must contain layer properties to update.');
             return res.status(response.statusCode).json(response.getResponse());
        }
        // Add validation for allowed update keys if needed

        try {
             debug(`Updating layer "${layerName}" in workspace "${workspaceId}" for user ${req.user.id} with:`, updates);
             // Use workspace wrapper
             const result = req.workspace.updateLayer(layerName, updates);

             if (!result.success) {
                  // updateLayer returns success: false if layer not found
                  const response = new ResponseObject().notFound(`Layer "${layerName}" not found.`);
                  return res.status(response.statusCode).json(response.getResponse());
             }

             // Get the updated layer data to return
             const updatedLayer = req.workspace.getLayer(layerName);
             const response = new ResponseObject().success(updatedLayer, `Layer "${layerName}" updated successfully.`);
             return res.json(response.getResponse());
        } catch (error) {
             logger.error(`Error updating layer: ${error.message}`, error);
             const response = new ResponseObject().serverError(error.message);
              // Handle validation errors from updateLayer?
             return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /workspaces/{id}/layers/{layerName}/actions/rename:
     *   post:
     *     summary: Rename a layer
     *     tags: [Workspaces, Layers, Actions]
     *     parameters:
     *       - $ref: '#/components/parameters/WorkspaceIdParam'
     *       - $ref: '#/components/parameters/LayerNameParam'
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [newName]
     *             properties:
     *               newName: { type: string }
     *     responses:
     *       200:
     *         description: Layer renamed
     *         content:
     *           application/json:
     *              schema:
     *                  type: object
     *                  properties:
     *                      success: { type: boolean }
     *                      oldName: { type: string }
     *                      newName: { type: string }
     *                      # Optionally return updated tree or layer?
     *       401: { $ref: '#/components/responses/UnauthorizedError' }
     *       404: { $ref: '#/components/responses/NotFoundError' } # Layer not found
     *       409: { $ref: '#/components/responses/ConflictError' } # newName already exists
     *       500: { $ref: '#/components/responses/ServerError' }
     */
    router.post('/:id/layers/:layerName/actions/rename', async (req, res) => {
        const workspaceId = req.params.id;
        const oldName = req.params.layerName;
        const { newName } = req.body;

        if (!newName || typeof newName !== 'string') {
             const response = new ResponseObject().badRequest('Missing or invalid "newName" in request body.');
             return res.status(response.statusCode).json(response.getResponse());
        }

        try {
             debug(`Renaming layer "${oldName}" to "${newName}" in workspace "${workspaceId}" for user ${req.user.id}`);
             const result = req.workspace.renameLayer(oldName, newName);

             if (!result.success) {
                  // Distinguish between not found and conflict? renameLayer might return specific info or throw.
                  // Let's assume failure means conflict or not found for now.
                  // Check if newName exists to return Conflict
                  if (req.workspace.getLayer(newName)) {
                       const response = new ResponseObject().conflict(`Layer with name "${newName}" already exists.`);
                       return res.status(response.statusCode).json(response.getResponse());
                  } else {
                       const response = new ResponseObject().notFound(`Layer "${oldName}" not found.`);
                       return res.status(response.statusCode).json(response.getResponse());
                  }
             }

             const response = new ResponseObject().success(result, `Layer renamed from "${oldName}" to "${newName}" successfully.`);
             return res.json(response.getResponse());
        } catch (error) {
             logger.error(`Error renaming layer: ${error.message}`, error);
             const response = new ResponseObject().serverError(error.message);
             return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /workspaces/{id}/layers/{layerName}:
     *   delete:
     *     summary: Delete layer definition (and removes from tree)
     *     tags: [Workspaces, Layers]
     *     parameters:
     *       - $ref: '#/components/parameters/WorkspaceIdParam'
     *       - $ref: '#/components/parameters/LayerNameParam'
     *     responses:
     *       200:
     *         description: Layer deleted
     *         content:
     *            application/json:
     *              schema:
     *                type: object
     *                properties:
     *                  success: { type: boolean }
     *                  name: { type: string }
     *                  tree: { $ref: '#/components/schemas/TreeNode', nullable: true } # Return updated tree
     *       401: { $ref: '#/components/responses/UnauthorizedError' }
     *       404: { $ref: '#/components/responses/NotFoundError' } # Layer not found
     *       500: { $ref: '#/components/responses/ServerError' }
     */
    router.delete('/:id/layers/:layerName', async (req, res) => {
         const workspaceId = req.params.id;
         const layerName = req.params.layerName;

         if (layerName === '/') { // Prevent deleting root layer definition
            const response = new ResponseObject().badRequest('Cannot delete the root layer definition.');
            return res.status(response.statusCode).json(response.getResponse());
         }

         try {
             debug(`Deleting layer "${layerName}" in workspace "${workspaceId}" for user ${req.user.id}`);
             const result = req.workspace.deleteLayer(layerName); // Handles tree recalculation

            if (!result.success) {
                 const response = new ResponseObject().notFound(`Layer "${layerName}" not found.`);
                 return res.status(response.statusCode).json(response.getResponse());
             }

             const response = new ResponseObject().success(result, `Layer "${layerName}" deleted successfully.`);
             return res.json(response.getResponse());
         } catch (error) {
             logger.error(`Error deleting layer: ${error.message}`, error);
             const response = new ResponseObject().serverError(error.message);
             return res.status(response.statusCode).json(response.getResponse());
        }
    });

    /**
     * @swagger
     * /workspaces/{id}/layers/by-id/{layerId}:
     *   get:
     *     summary: Get layer definition by ID
     *     tags: [Workspaces, Layers]
     *     parameters:
     *       - $ref: '#/components/parameters/WorkspaceIdParam'
     *       - $ref: '#/components/parameters/LayerIdParam'
     *     responses:
     *       200:
     *         description: Layer definition
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/TreeLayer' }
     *       401: { $ref: '#/components/responses/UnauthorizedError' }
     *       404: { $ref: '#/components/responses/NotFoundError' } # Layer or Workspace not found
     *       500: { $ref: '#/components/responses/ServerError' }
     */
    router.get('/:id/layers/by-id/:layerId', async (req, res) => {
         const workspaceId = req.params.id;
         const layerId = req.params.layerId;
         try {
             debug(`Getting layer by ID "${layerId}" in workspace "${workspaceId}" for user ${req.user.id}`);
             const layer = req.workspace.getLayerById(layerId); // Use Workspace wrapper

             if (!layer) {
                 const response = new ResponseObject().notFound(`Layer with ID "${layerId}" not found in workspace "${workspaceId}".`);
                 return res.status(response.statusCode).json(response.getResponse());
             }

             const response = new ResponseObject().success(layer);
             return res.json(response.getResponse());
         } catch (error) {
             logger.error(`Error getting layer: ${error.message}`, error);
             const response = new ResponseObject().serverError(error.message);
             return res.status(response.statusCode).json(response.getResponse());
        }
    });


    // Add standard response components (can be in a separate file/setup)
    /**
     * @swagger
     * components:
     *   responses:
     *     Success:
     *       description: Operation successful
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               status: { type: integer, example: 200 }
     *               message: { type: string }
     *               payload: { nullable: true }
     *     Created:
     *       description: Resource created successfully
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               status: { type: integer, example: 201 }
     *               message: { type: string }
     *               payload: { } # Schema depends on created resource
     *     BadRequestError:
     *       description: Invalid request syntax or parameters
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ErrorResponse' }
     *     UnauthorizedError:
     *       description: Authentication required or insufficient permissions
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ErrorResponse' }
     *     NotFoundError:
     *       description: The specified resource was not found
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ErrorResponse' }
     *     ConflictError:
     *       description: Request conflicts with the current state of the server (e.g., resource already exists)
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ErrorResponse' }
     *     ServerError:
     *       description: An unexpected error occurred on the server
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ErrorResponse' }
     *     NotImplemented:
     *        description: The requested functionality is not implemented
     *        content:
     *          application/json:
     *            schema: { $ref: '#/components/schemas/ErrorResponse' }
     *   schemas:
     *      ErrorResponse:
     *          type: object
     *          properties:
     *              status: { type: integer }
     *              message: { type: string }
     *              error: { type: string, nullable: true }
     *              payload: { nullable: true }
     */

    return router;
}
