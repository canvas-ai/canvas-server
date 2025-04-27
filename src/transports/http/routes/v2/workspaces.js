'use strict';

import express from 'express';
import logger, { createDebug } from '../../../../utils/log/index.js';
const debug = createDebug('http:routes:workspaces');

import ResponseObject from '../../../ResponseObject.js';

//
// --- Middleware --- //
//

/**
 * Middleware to ensure the user is authenticated.
 * @param {Object} authService - Authentication service instance.
 * @returns {Function}
 */
const ensureAuthenticated = (authService) => {
    if (!authService || !authService.passport) {
        return (req, res, next) => {
            logger.warn('Auth service or passport not available, skipping authentication');
            next();
        };
    }
    // Assuming 'jwt' strategy is configured in authService
    return authService.passport.authenticate('jwt', { session: false });
};

/**
 * Middleware to load and attach the requested workspace instance (not necessarily active).
 * @param {Object} userManager - User Manager instance.
 * @returns {Function}
 */
const loadWorkspace = (userManager) => async (req, res, next) => {
    const workspaceId = req.params.id;
    debug(`Loading workspace ${workspaceId})`);
    const userId = req.user?.id; // Use the user ID instead of email
    const response = new ResponseObject();

    if (!userId) {
        return res.status(401).json(response.unauthorized('User not authenticated'));
    }
    if (!workspaceId) {
        return res.status(400).json(response.badRequest('Workspace ID is required'));
    }

    try {
        const workspace = await userManager.workspaceManager.openWorkspace(userId, workspaceId);
        if (!workspace) {
            return res.status(404).json(response.notFound(`Workspace '${workspaceId}' not found or access denied.`));
        }
        req.workspace = workspace; // Attach workspace instance to request
        debug(`Successfully loaded workspace: ${workspace.id} (${workspace.name})`);
        next();
    } catch (error) {
        logger.error(`Error loading workspace ${userId}/${workspaceId}: ${error.message}`);
        return res.status(500).json(response.error('Internal server error loading workspace', [error.message]));
    }
};

/**
 * Middleware to ensure the workspace attached to the request is active (started).
 * It attempts to start the workspace if it's not already active.
 * @param {Object} userManager - User Manager instance.
 * @returns {Function}
 */
const ensureWorkspaceActive = (userManager) => async (req, res, next) => {
    const workspaceId = req.params.id;
    const userId = req.user?.id; // Use the user ID instead of email
    const response = new ResponseObject();

    if (!req.workspace) {
        // This should ideally be caught by loadWorkspace middleware first
        logger.error(`ensureWorkspaceActive called without req.workspace for ${userId}/${workspaceId}`);
        return res.status(500).json(response.error('Internal server error: Workspace not loaded'));
    }

    if (req.workspace.isActive) {
        return next(); // Already active
    }

    // Attempt to start the workspace
    debug(`Workspace ${workspaceId} not active, attempting to start...`);
    try {
        const startedWorkspace = await userManager.workspaceManager.startWorkspace(userId, workspaceId);
        if (!startedWorkspace || !startedWorkspace.isActive) {
             // startWorkspace should throw on failure, but double-check
             return res.status(409).json(response.conflict(`Workspace '${workspaceId}' could not be started.`));
        }
        req.workspace = startedWorkspace; // Update req.workspace with the potentially new instance returned by startWorkspace
        debug(`Workspace ${workspaceId} started successfully.`);
        next();
    } catch (error) {
        logger.error(`Error starting workspace ${userId}/${workspaceId} for active check: ${error.message}`);
        return res.status(500).json(response.error('Internal server error starting workspace', [error.message]));
    }
};


//
// --- Routes --- //
//

export default ({ auth, userManager, sessionManager }) => {
    const router = express.Router();
    const authMiddleware = ensureAuthenticated(auth);

    if (!userManager) {
        logger.error('UserManager not provided to workspace routes');
        // Return a dummy router or throw an error?
        return router;
    }

    const workspaceManager = userManager.workspaceManager;
    if (!workspaceManager) {
        logger.error('WorkspaceManager not available via UserManager');
        return router;
    }

    // Middleware for routes requiring workspace ID
    const loadWorkspaceMiddleware = loadWorkspace(userManager);
    const ensureActiveMiddleware = ensureWorkspaceActive(userManager);

    // Apply auth middleware to all workspace routes
    router.use(authMiddleware);

    // === Workspace Management ===

    /**
     * GET / - List all workspaces (metadata) for the authenticated user
     */
    router.get('/', async (req, res) => {
        const userId = req.user?.id; // Use the user ID instead of email
        const response = new ResponseObject();
        if (!userId) return res.status(401).json(response.unauthorized());

        debug(`ROUTE: GET / - List workspaces for user ${userId}`);

        try {
            // Get workspaces for this user using the new schema
            const userWorkspaces = workspaceManager.listWorkspaces(userId);
            debug(`Found ${userWorkspaces.length} workspaces for user ${userId}`);
            response.success(userWorkspaces, 'User workspaces retrieved successfully.');
            res.json(response.getResponse());
        } catch (error) {
            logger.error(`Error listing workspaces for user ${userId}: ${error.message}`);
            res.status(500).json(response.error('Internal server error listing workspaces', [error.message]).getResponse());
        }
    });

    /**
     * POST / - Create a new workspace definition
     */
    router.post('/', async (req, res) => {
        const userId = req.user?.id; // Use the user ID instead of email
        const { name, label, color, description, type } = req.body;
        const response = new ResponseObject();

        debug(`ROUTE: POST / - Create workspace "${name}" for user ${userId}`);

        if (!userId) return res.status(401).json(response.unauthorized());
        if (!name) return res.status(400).json(response.badRequest('Workspace name is required.'));

        try {
            const newWorkspaceEntry = await workspaceManager.createWorkspace(userId, name, { label, color, description, type });
            response.success(newWorkspaceEntry, 'Workspace created successfully.', 201);
            res.status(201).json(response.getResponse());
        } catch (error) {
            logger.error(`Error creating workspace "${name}" for user ${userId}: ${error.message}`);
            if (error.message.includes('already exists')) {
                res.status(409).json(response.conflict('Workspace already exists', [error.message]).getResponse());
            } else {
                res.status(500).json(response.error('Internal server error creating workspace', [error.message]).getResponse());
            }
        }
    });

    /**
     * GET /:id - Get workspace details (config and status)
     * Uses loadWorkspace middleware
     */
    router.get('/:id', loadWorkspaceMiddleware, async (req, res) => {
        const response = new ResponseObject();
        debug(`ROUTE: GET /:id - Get workspace details for ${req.params.id}`);
        // req.workspace is attached by middleware
        response.success(req.workspace.toJSON(), 'Workspace details retrieved successfully.');
        res.json(response.getResponse());
    });

    /**
     * PATCH /:id - Update workspace configuration (label, color, locked, acl, metadata)
     * Uses loadWorkspace middleware
     */
    router.patch('/:id', loadWorkspaceMiddleware, async (req, res) => {
        const response = new ResponseObject();
        const workspace = req.workspace;
        const updates = req.body;
        const allowedUpdates = ['label', 'description', 'color', 'locked', 'acl', 'metadata'];

        debug(`ROUTE: PATCH /:id - Update workspace ${req.params.id} with data:`, updates);

        const filteredUpdates = Object.keys(updates)
            .filter(key => allowedUpdates.includes(key))
            .reduce((obj, key) => {
                obj[key] = updates[key];
                return obj;
            }, {});

        if (Object.keys(filteredUpdates).length === 0) {
            return res.status(400).json(response.badRequest('No valid fields provided for update.'));
        }

        // Use the Workspace instance method to update config
        let success = true;
        for (const key in filteredUpdates) {
             // Use the generic setConfigKey for validation
            if (!workspace.setConfigKey(key, filteredUpdates[key])) {
                success = false;
                 // setConfigKey logs errors, return a general failure message
                return res.status(400).json(response.badRequest(`Failed to update field '${key}'. Check server logs for details.`, [`Invalid value for ${key}`]).getResponse());
            }
        }

        if (success) {
             // Refresh workspace data after updates
             const updatedWorkspace = await workspaceManager.openWorkspace(req.user.id, req.params.id);
             response.success(updatedWorkspace.toJSON(), 'Workspace configuration updated successfully.');
             res.json(response.getResponse());
        } else {
             // Should have returned earlier on failure
             res.status(500).json(response.error('An unexpected error occurred during update.'));
        }
    });

    /**
     * DELETE /:id - Destroy workspace (stops, removes index entry, deletes files)
     */
    router.delete('/:id', async (req, res) => {
        const userId = req.user?.id; // Use the user ID instead of email
        const workspaceId = req.params.id;
        const destroyData = req.query.destroyData === 'true'; // Check query param
        const response = new ResponseObject();

        debug(`ROUTE: DELETE /:id - Destroy workspace ${workspaceId} (Destroy data: ${destroyData}) for user ${userId}`);

        if (!userId) return res.status(401).json(response.unauthorized());

        try {
            const removed = await workspaceManager.removeWorkspace(userId, workspaceId, destroyData);
            if (removed) {
                response.success({ id: workspaceId, destroyed: destroyData }, `Workspace '${workspaceId}' removed successfully.`);
                res.json(response.getResponse());
            } else {
                // removeWorkspace logs warnings for not found/access denied
                res.status(404).json(response.notFound(`Workspace '${workspaceId}' not found or removal failed.`));
            }
        } catch (error) {
            logger.error(`Error removing workspace ${userId}/${workspaceId}: ${error.message}`);
            res.status(500).json(response.error('Internal server error removing workspace', [error.message]).getResponse());
        }
    });

    // === Workspace State Management ===

    /**
     * GET /:id/status - Get current workspace status
     * Uses loadWorkspace middleware
     */
    router.get('/:id/status', loadWorkspaceMiddleware, async (req, res) => {
        const response = new ResponseObject();
        debug(`ROUTE: GET /:id/status - Get status for workspace ${req.params.id}`);
        response.success({ id: req.workspace.id, status: req.workspace.status }, 'Workspace status retrieved successfully.');
        res.json(response.getResponse());
    });

    /**
     * POST /:id/open - Load workspace into memory (status=INACTIVE)
     * Implicitly handled by loadWorkspaceMiddleware, maybe just return current state?
     */
    router.post('/:id/open', loadWorkspaceMiddleware, async (req, res) => {
        const response = new ResponseObject();
        debug(`ROUTE: POST /:id/open - Open workspace ${req.params.id}`);
        // loadWorkspaceMiddleware already loaded it. Return the state.
        response.success(req.workspace.toJSON(), `Workspace '${req.workspace.id}' is open (loaded).`);
        res.json(response.getResponse());
    });

    /**
     * POST /:id/close - Unload workspace from memory (if inactive)
     */
    router.post('/:id/close', async (req, res) => {
        const userId = req.user?.id; // Use the user ID instead of email
        const workspaceId = req.params.id;
        const response = new ResponseObject();

        debug(`ROUTE: POST /:id/close - Close workspace ${workspaceId} for user ${userId}`);

        if (!userId) return res.status(401).json(response.unauthorized());

        try {
            const closed = await workspaceManager.closeWorkspace(userId, workspaceId);
            if (closed) {
                response.success({ id: workspaceId }, `Workspace '${workspaceId}' closed successfully.`);
                res.json(response.getResponse());
            } else {
                // closeWorkspace logs reasons for failure (e.g., failed to stop)
                res.status(400).json(response.badRequest(`Failed to close workspace '${workspaceId}'. It might be active or encountered an error.`));
            }
        } catch (error) {
            logger.error(`Error closing workspace ${userId}/${workspaceId}: ${error.message}`);
            res.status(500).json(response.error('Internal server error closing workspace', [error.message]).getResponse());
        }
    });

    /**
     * POST /:id/start - Start an inactive workspace (loads DB, status=ACTIVE)
     */
    router.post('/:id/start', loadWorkspaceMiddleware, async (req, res) => {
        const userId = req.user?.id; // Use the user ID instead of email
        const workspaceId = req.params.id; // Use original ID from params for logging/response
        const response = new ResponseObject();

        debug(`ROUTE: POST /:id/start - Start workspace ${workspaceId} for user ${userId}`);

        if (req.workspace.isActive) {
            return res.json(response.success(req.workspace.toJSON(), `Workspace '${workspaceId}' is already active.`).getResponse());
        }

        try {
            // Use startWorkspace from the manager, which also handles loading if needed
            const startedWorkspace = await workspaceManager.startWorkspace(userId, workspaceId);
            if (startedWorkspace) {
                response.success(startedWorkspace.toJSON(), `Workspace '${workspaceId}' started successfully.`);
                res.json(response.getResponse());
            } else {
                // startWorkspace logs errors
                res.status(500).json(response.error(`Failed to start workspace '${workspaceId}'.`));
            }
        } catch (error) {
            logger.error(`Error starting workspace ${userId}/${workspaceId}: ${error.message}`);
            res.status(500).json(response.error('Internal server error starting workspace', [error.message]).getResponse());
        }
    });

    /**
     * POST /:id/stop - Stop an active workspace (shuts down DB, status=INACTIVE)
     */
    router.post('/:id/stop', loadWorkspaceMiddleware, async (req, res) => {
        const userId = req.user?.id; // Use the user ID instead of email
        const workspaceId = req.params.id;
        const response = new ResponseObject();

        debug(`ROUTE: POST /:id/stop - Stop workspace ${workspaceId} for user ${userId}`);

        if (!req.workspace.isActive) {
            return res.json(response.success({ id: req.workspace.id, status: req.workspace.status }, `Workspace '${workspaceId}' is already inactive.`).getResponse());
        }

        try {
            // Use stopWorkspace from the manager
            const stopped = await workspaceManager.stopWorkspace(userId, workspaceId);
            if (stopped) {
                 // Fetch the workspace again to get the updated status (INACTIVE)
                const stoppedWorkspace = await workspaceManager.openWorkspace(userId, workspaceId);
                response.success(stoppedWorkspace.toJSON(), `Workspace '${workspaceId}' stopped successfully.`);
                res.json(response.getResponse());
            } else {
                 // stopWorkspace logs errors
                res.status(500).json(response.error(`Failed to stop workspace '${workspaceId}'.`));
            }
        } catch (error) {
            logger.error(`Error stopping workspace ${userId}/${workspaceId}: ${error.message}`);
            res.status(500).json(response.error('Internal server error stopping workspace', [error.message]).getResponse());
        }
    });


    // === Tree Management (Requires Active Workspace) ===

    // Apply active middleware to all /tree routes
    router.use('/:id/tree*', loadWorkspaceMiddleware, ensureActiveMiddleware);

    /**
     * GET /:id/tree - Get the workspace's hierarchical tree structure
     */
    router.get('/:id/tree', (req, res) => {
        const response = new ResponseObject();
        debug(`ROUTE: GET /:id/tree - Get tree for workspace ${req.params.id}`);
        try {
            // Access tree via the active workspace instance
            const treeJson = req.workspace.jsonTree;
            response.success(JSON.parse(treeJson), 'Workspace tree retrieved successfully.');
            res.json(response.getResponse());
        } catch (error) {
            logger.error(`Error getting tree for workspace ${req.workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error getting tree', [error.message]).getResponse());
        }
    });

    /**
     * POST /:id/tree/paths - Insert a path
     */
    router.post('/:id/tree/paths', (req, res) => {
        const { path: targetPath, data = null, autoCreateLayers = true } = req.body;
        const response = new ResponseObject();

        debug(`ROUTE: POST /:id/tree/paths - Insert path '${targetPath}' into workspace ${req.params.id}`);

        if (!targetPath) return res.status(400).json(response.badRequest('Path is required.'));

        try {
            const result = req.workspace.insertPath(targetPath, data, autoCreateLayers);
            response.success(result, `Path '${targetPath}' inserted successfully.`);
            res.status(201).json(response.getResponse());
        } catch (error) {
            logger.error(`Error inserting path '${targetPath}' in workspace ${req.workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error inserting path', [error.message]).getResponse());
        }
    });

    /**
     * DELETE /:id/tree/paths - Remove a path
     */
    router.delete('/:id/tree/paths', (req, res) => {
        const { path: targetPath, recursive = false } = req.query; // Get path/recursive from query parameters
        const response = new ResponseObject();

        debug(`ROUTE: DELETE /:id/tree/paths - Remove path '${targetPath}' (recursive: ${recursive}) from workspace ${req.params.id}`);

        if (!targetPath) return res.status(400).json(response.badRequest('Path query parameter is required.'));

        try {
            const result = req.workspace.removePath(targetPath, recursive === 'true' || recursive === true);
            if (result.success) {
                response.success(result, `Path '${targetPath}' removed successfully.`);
                res.json(response.getResponse());
            } else {
                 response.notFound(`Path '${targetPath}' not found or could not be removed.`);
                 res.status(404).json(response.getResponse());
            }
        } catch (error) {
            logger.error(`Error removing path '${targetPath}' in workspace ${req.workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error removing path', [error.message]).getResponse());
        }
    });

    /**
     * POST /:id/tree/paths/move - Move a path
     */
    router.post('/:id/tree/paths/move', (req, res) => {
        const { from, to, recursive = false } = req.body;
        const response = new ResponseObject();

        debug(`ROUTE: POST /:id/tree/paths/move - Move path from '${from}' to '${to}' (recursive: ${recursive}) in workspace ${req.params.id}`);

        if (!from || !to) return res.status(400).json(response.badRequest('Both "from" and "to" paths are required.'));

        try {
            const result = req.workspace.movePath(from, to, recursive);
            if (result.success) {
                response.success(result, `Path moved successfully from '${from}' to '${to}'.`);
                res.json(response.getResponse());
            } else {
                response.notFound(`Failed to move path from '${from}' to '${to}'. Source path might not exist or target path invalid.`);
                res.status(404).json(response.getResponse()); // Or 400 Bad Request?
            }
        } catch (error) {
            logger.error(`Error moving path from '${from}' to '${to}' in workspace ${req.workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error moving path', [error.message]).getResponse());
        }
    });

    /**
     * POST /:id/tree/paths/copy - Copy a path
     */
    router.post('/:id/tree/paths/copy', (req, res) => {
        const { from, to, recursive = false } = req.body;
        const response = new ResponseObject();

        debug(`ROUTE: POST /:id/tree/paths/copy - Copy path from '${from}' to '${to}' (recursive: ${recursive}) in workspace ${req.params.id}`);

        if (!from || !to) return res.status(400).json(response.badRequest('Both "from" and "to" paths are required.'));

        try {
            const result = req.workspace.copyPath(from, to, recursive);
             if (result.success) {
                response.success(result, `Path copied successfully from '${from}' to '${to}'.`);
                res.json(response.getResponse());
            } else {
                response.notFound(`Failed to copy path from '${from}' to '${to}'. Source path might not exist or target path invalid.`);
                res.status(404).json(response.getResponse()); // Or 400 Bad Request?
            }
        } catch (error) {
            logger.error(`Error copying path from '${from}' to '${to}' in workspace ${req.workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error copying path', [error.message]).getResponse());
        }
    });

     /**
     * POST /:id/tree/paths/merge-up - Merge layer bitmaps upwards
     */
    router.post('/:id/tree/paths/merge-up', (req, res) => {
        const { path: targetPath } = req.body;
        const response = new ResponseObject();

        debug(`ROUTE: POST /:id/tree/paths/merge-up - Merge up path '${targetPath}' in workspace ${req.params.id}`);

        if (!targetPath) return res.status(400).json(response.badRequest('Path is required.'));

        try {
            const result = req.workspace.mergeUp(targetPath);
            if (result.success) {
                response.success(result, `Successfully merged up from path '${targetPath}'.`);
                res.json(response.getResponse());
            } else {
                response.notFound(`Failed to merge up from path '${targetPath}'. Path might not exist or has no parent.`);
                res.status(404).json(response.getResponse());
            }
        } catch (error) {
            logger.error(`Error merging up path '${targetPath}' in workspace ${req.workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error merging path up', [error.message]).getResponse());
        }
    });

    /**
     * POST /:id/tree/paths/merge-down - Merge layer bitmaps downwards
     */
    router.post('/:id/tree/paths/merge-down', (req, res) => {
        const { path: targetPath } = req.body;
        const response = new ResponseObject();

        debug(`ROUTE: POST /:id/tree/paths/merge-down - Merge down path '${targetPath}' in workspace ${req.params.id}`);

        if (!targetPath) return res.status(400).json(response.badRequest('Path is required.'));

        try {
            const result = req.workspace.mergeDown(targetPath);
            if (result.success) {
                response.success(result, `Successfully merged down from path '${targetPath}'.`);
                res.json(response.getResponse());
            } else {
                response.notFound(`Failed to merge down from path '${targetPath}'. Path might not exist or has no children.`);
                res.status(404).json(response.getResponse());
            }
        } catch (error) {
            logger.error(`Error merging down path '${targetPath}' in workspace ${req.workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error merging path down', [error.message]).getResponse());
        }
    });


    // === Layer Management (Requires Active Workspace) ===

    // Apply active middleware to all /layers routes
    router.use('/:id/layers*', loadWorkspaceMiddleware, ensureActiveMiddleware);

    /**
     * GET /:id/layers - List all layer definitions
     */
    router.get('/:id/layers', (req, res) => {
        const response = new ResponseObject();
        debug(`ROUTE: GET /:id/layers - List layers for workspace ${req.params.id}`);
        try {
            // Assuming tree object has a method to list layers
            const layers = req.workspace.tree?.layers; // Or db.tree.getLayers()
            if (!layers) {
                return res.status(500).json(response.error('Cannot access layers, tree not available.'));
            }
            response.success(layers, 'Workspace layers retrieved successfully.');
            res.json(response.getResponse());
        } catch (error) {
            logger.error(`Error listing layers for workspace ${req.workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error listing layers', [error.message]).getResponse());
        }
    });

    /**
     * POST /:id/layers - Create a new layer definition
     */
    router.post('/:id/layers', (req, res) => {
        const { name, type, ...options } = req.body;
        const response = new ResponseObject();

        debug(`ROUTE: POST /:id/layers - Create layer '${name}' (type: ${type}) in workspace ${req.params.id}`);

        if (!name || !type) {
            return res.status(400).json(response.badRequest('Layer name and type are required.'));
        }

        try {
            const newLayer = req.workspace.createLayer({ name, type, ...options });
            response.success(newLayer, `Layer '${name}' created successfully.`, 201);
            res.status(201).json(response.getResponse());
        } catch (error) {
            logger.error(`Error creating layer '${name}' in workspace ${req.workspace.id}: ${error.message}`);
            if (error.message.includes('already exists')) { // Check for specific error if Tree throws it
                 res.status(409).json(response.conflict(`Layer with name '${name}' already exists.`));
            } else {
                 res.status(500).json(response.error('Internal server error creating layer', [error.message]).getResponse());
            }
        }
    });

    /**
     * GET /:id/layers/:layerName - Get layer definition by name
     */
    router.get('/:id/layers/:layerName', (req, res) => {
        const layerName = req.params.layerName;
        const response = new ResponseObject();
        debug(`ROUTE: GET /:id/layers/:layerName - Get layer '${layerName}' from workspace ${req.params.id}`);
        try {
            const layer = req.workspace.getLayer(layerName);
            if (layer) {
                response.success(layer, `Layer '${layerName}' retrieved successfully.`);
                res.json(response.getResponse());
            } else {
                response.notFound(`Layer '${layerName}' not found.`);
                res.status(404).json(response.getResponse());
            }
        } catch (error) {
            logger.error(`Error getting layer '${layerName}' in workspace ${req.workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error getting layer', [error.message]).getResponse());
        }
    });

    /**
     * PATCH /:id/layers/:layerName - Update layer properties
     */
    router.patch('/:id/layers/:layerName', (req, res) => {
        const layerName = req.params.layerName;
        const options = req.body;
        const response = new ResponseObject();

        debug(`ROUTE: PATCH /:id/layers/:layerName - Update layer '${layerName}' in workspace ${req.params.id} with data:`, options);

        // Basic validation: Disallow changing name via PATCH, use renameLayer method
        if (options.name && options.name !== layerName) {
             return res.status(400).json(response.badRequest('Cannot change layer name via PATCH. Use rename endpoint if available.'));
        }
        delete options.name; // Remove name from options if present

        if (Object.keys(options).length === 0) {
            return res.status(400).json(response.badRequest('No update options provided.'));
        }

        try {
            const result = req.workspace.updateLayer(layerName, options);
            if (result.success) {
                // Fetch updated layer data
                 const updatedLayer = req.workspace.getLayer(layerName);
                 response.success(updatedLayer, `Layer '${layerName}' updated successfully.`);
                 res.json(response.getResponse());
            } else {
                response.notFound(`Layer '${layerName}' not found or update failed.`);
                res.status(404).json(response.getResponse());
            }
        } catch (error) {
            logger.error(`Error updating layer '${layerName}' in workspace ${req.workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error updating layer', [error.message]).getResponse());
        }
    });

    /**
     * DELETE /:id/layers/:layerName - Delete layer definition
     */
    router.delete('/:id/layers/:layerName', (req, res) => {
        const layerName = req.params.layerName;
        const response = new ResponseObject();
        debug(`ROUTE: DELETE /:id/layers/:layerName - Delete layer '${layerName}' from workspace ${req.params.id}`);
        try {
            const result = req.workspace.deleteLayer(layerName);
            if (result.success) {
                response.success({ name: layerName }, `Layer '${layerName}' deleted successfully.`);
                res.json(response.getResponse());
            } else {
                response.notFound(`Layer '${layerName}' not found or delete failed.`);
                res.status(404).json(response.getResponse());
            }
        } catch (error) {
            logger.error(`Error deleting layer '${layerName}' in workspace ${req.workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error deleting layer', [error.message]).getResponse());
        }
    });

    /**
     * GET /:id/layers/by-id/:layerId - Get layer definition by ID
     */
    router.get('/:id/layers/by-id/:layerId', (req, res) => {
        const layerId = req.params.layerId;
        const response = new ResponseObject();
        debug(`ROUTE: GET /:id/layers/by-id/:layerId - Get layer ID '${layerId}' from workspace ${req.params.id}`);
        try {
            const layer = req.workspace.getLayerById(layerId);
            if (layer) {
                response.success(layer, `Layer with ID '${layerId}' retrieved successfully.`);
                res.json(response.getResponse());
            } else {
                response.notFound(`Layer with ID '${layerId}' not found.`);
                res.status(404).json(response.getResponse());
            }
        } catch (error) {
            logger.error(`Error getting layer by ID '${layerId}' in workspace ${req.workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error getting layer by ID', [error.message]).getResponse());
        }
    });

    // === Document Management (Requires Active Workspace) ===

    // Helper to parse comma-separated query params into arrays
    const parseQueryArray = (queryParam) => {
        if (!queryParam ||
            queryParam == '' ||
            queryParam.trim() == '' ||
            queryParam == null ||
            queryParam == undefined
        ) {
            debug(`Parsing query param: "${queryParam}" -> []`);
            return [];
        }
        debug(`Parsing query param: "${queryParam}`);
        return queryParam.split(',').map(s => s.trim()).filter(Boolean);
    };

    // Apply active middleware to all /documents routes
    router.use('/:id/documents*', loadWorkspaceMiddleware, ensureActiveMiddleware);

    /**
     * GET /:id/documents - List documents (query: context, features, filters, limit)
     */
    router.get('/:id/documents', async (req, res) => {
        const { context = null, features = '', filters = '', limit = null } = req.query;
        const workspace = req.workspace;

        debug(`ROUTE: GET /:id/documents - List documents for workspace ${workspace.id} (context: ${context}, features: ${features}, filters: ${filters}, limit: ${limit})`);

        try {
            const featureBitmapArray = parseQueryArray(features);
            const filterArray = parseQueryArray(filters);
            const options = { limit: limit ? parseInt(limit, 10) : null };

            // Context spec parsing is handled inside listDocuments
            const documents = await workspace.db.listDocuments(context, featureBitmapArray, filterArray, options);

            const response = new ResponseObject();
            response.success(documents, 'Documents retrieved successfully.', 200, documents.length);
            res.json(response.getResponse());
        } catch (error) {
            logger.error(`Error listing documents in workspace ${workspace.id}: ${error.message}`);
            const errorResponse = new ResponseObject()
                .error('Internal server error listing documents', [error.message]);
            res.status(500).json(errorResponse.getResponse());
        }
    });

    /**
     * POST /:id/documents - Insert one or more documents (query: context, features)
     */
    router.post('/:id/documents', async (req, res) => {
        const { context = '/', features = [] } = req.query;
        const docArray = req.body;
        const workspace = req.workspace;

        debug(`ROUTE: POST /:id/documents - Insert documents into workspace ${workspace.id} (context: ${context}, features: ${features})`);

        if (!docArray || (Array.isArray(docArray) && docArray.length === 0)) {
            const response = new ResponseObject();
            return res.status(400).json(response.badRequest('Document data (array or single object) is required in the request body.').getResponse());
        }

        try {
            const featureBitmapArray = parseQueryArray(features);
            debug(`Inserting documents with context: ${context} and features: ${featureBitmapArray}`);
            debug(`Workspace ID: ${workspace.id} (${workspace.name})`);

            const errors = await workspace.db.insertDocumentArray(docArray, context, featureBitmapArray);
            const docsToInsert = Array.isArray(docArray) ? docArray : [docArray];
            const insertedCount = docsToInsert.length - Object.keys(errors).length;

            const response = new ResponseObject();
            if (Object.keys(errors).length > 0) {
                 // Partial success or total failure
                 response.error('Some documents failed to insert.', errors, 207); // 207 Multi-Status
                 res.status(207).json(response.getResponse());
            } else {
                 response.success(
                    { insertedCount },
                    'Documents inserted successfully.',
                    201,
                    insertedCount
                 );
                 res.status(201).json(response.getResponse());
            }
        } catch (error) {
            logger.error(`Error inserting documents in workspace ${workspace.id}: ${error.message}`);
            const response = new ResponseObject();
            res.status(500).json(response.error('Internal server error inserting documents', [error.message]).getResponse());
        }
    });

    /**
     * PUT /:id/documents - Update one or more documents (query: context, features)
     * Requires document objects with IDs in the body.
     */
    router.put('/:id/documents', async (req, res) => {
        const { context = null, features = '' } = req.query;
        const docArray = req.body;
        const workspace = req.workspace;
        const response = new ResponseObject();

        debug(`ROUTE: PUT /:id/documents - Update documents in workspace ${workspace.id} (context: ${context}, features: ${features})`);

        if (!docArray || (Array.isArray(docArray) && docArray.length === 0)) {
            return res.status(400).json(response.badRequest('Document data (array or single object) with IDs is required in the request body.').getResponse());
        }

        // Validate if all documents have an ID
        const docsToUpdate = Array.isArray(docArray) ? docArray : [docArray];
        if (docsToUpdate.some(doc => !doc || !doc.id)) {
             return res.status(400).json(response.badRequest('All documents for update must have an ID.').getResponse());
        }

        try {
            const featureBitmapArray = parseQueryArray(features);
            const errors = await workspace.db.updateDocumentArray(docArray, context, featureBitmapArray);
            const updatedCount = docsToUpdate.length - Object.keys(errors).length;

            if (Object.keys(errors).length > 0) {
                 response.error('Some documents failed to update.', errors, 207); // 207 Multi-Status
                 res.status(207).json(response.getResponse());
            } else {
                 response.success(
                    { updatedCount },
                    'Documents updated successfully.',
                    200,
                    updatedCount
                 );
                 res.json(response.getResponse());
            }
        } catch (error) {
            logger.error(`Error updating documents in workspace ${workspace.id}: ${error.message}`);
             if (error.message.includes('not found')) { // Basic check for not found errors during update
                res.status(404).json(response.notFound('One or more documents not found for update.', [error.message]).getResponse());
            } else {
                 res.status(500).json(response.error('Internal server error updating documents', [error.message]).getResponse());
            }
        }
    });

    /**
     * PATCH /:id/documents - Remove document IDs from specified bitmaps (query: context, features)
     * Expects an array of document IDs in the body: { "docIds": [...] }
     */
    router.patch('/:id/documents', async (req, res) => {
        const { context = null, features = '' } = req.query;
        const { docIds } = req.body; // Expecting { "docIds": [...] }
        const workspace = req.workspace;
        const response = new ResponseObject();

        debug(`ROUTE: PATCH /:id/documents - Remove doc IDs from bitmaps in workspace ${workspace.id} (context: ${context}, features: ${features})`);

        if (!docIds || !Array.isArray(docIds) || docIds.length === 0) {
            return res.status(400).json(response.badRequest('An array of document IDs (`docIds`) is required in the request body.').getResponse());
        }

        try {
            const featureBitmapArray = parseQueryArray(features);
            // Use removeDocumentArray which unticks from bitmaps
            const errors = await workspace.db.removeDocumentArray(docIds, context, featureBitmapArray);
            const removedCount = docIds.length - Object.keys(errors).length;

            if (Object.keys(errors).length > 0) {
                 response.error('Some documents failed removal from specified layers/bitmaps.', errors, 207);
                 res.status(207).json(response.getResponse());
            } else {
                 response.success(
                    { removedCount },
                    'Documents removed from specified layers/bitmaps successfully.',
                    200,
                    removedCount
                 );
                 res.json(response.getResponse());
            }
        } catch (error) {
            logger.error(`Error removing documents from layers/bitmaps in workspace ${workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error removing documents from layers/bitmaps', [error.message]).getResponse());
        }
    });

    /**
     * DELETE /:id/documents - Remove document IDs from the database entirely.
     * Expects an array of document IDs in the body: { "docIds": [...] }
     */
    router.delete('/:id/documents', async (req, res) => {
        const { docIds } = req.body; // Expecting { "docIds": [...] }
        const workspace = req.workspace;
        const response = new ResponseObject();

        debug(`ROUTE: DELETE /:id/documents - Delete doc IDs from DB in workspace ${workspace.id}`);

        if (!docIds || !Array.isArray(docIds) || docIds.length === 0) {
            return res.status(400).json(response.badRequest('An array of document IDs (`docIds`) is required in the request body.').getResponse());
        }

        try {
            // Use deleteDocumentArray for complete removal
            const errors = await workspace.db.deleteDocumentArray(docIds);
            const deletedCount = docIds.length - Object.keys(errors).length;

            if (Object.keys(errors).length > 0) {
                 response.error('Some documents failed to delete completely.', errors, 207);
                 res.status(207).json(response.getResponse());
            } else {
                 response.success(
                    { deletedCount },
                    'Documents deleted successfully from the database.',
                    200,
                    deletedCount
                 );
                 res.json(response.getResponse());
            }
        } catch (error) {
            logger.error(`Error deleting documents from database in workspace ${workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error deleting documents', [error.message]).getResponse());
        }
    });

    /**
     * GET /:id/documents/by-id/:docId - Get a specific document by ID
     */
    router.get('/:id/documents/by-id/:docId', async (req, res) => {
        const { docId } = req.params;
        const workspace = req.workspace;
        const response = new ResponseObject();

        debug(`ROUTE: GET /:id/documents/by-id/:docId - Get doc ID ${docId} from workspace ${workspace.id}`);

        try {
            const document = await workspace.db.getById(docId);
            if (document) {
                response.success(document, `Document ID '${docId}' retrieved successfully.`);
                res.json(response.getResponse());
            } else {
                response.notFound(`Document ID '${docId}' not found.`);
                res.status(404).json(response.getResponse());
            }
        } catch (error) {
            logger.error(`Error getting document by ID ${docId} in workspace ${workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error getting document by ID', [error.message]).getResponse());
        }
    });

    /**
     * GET /:id/documents/by-hash/:hashString - Get document by checksum hash
     */
    router.get('/:id/documents/by-hash/:hashString', async (req, res) => {
        const { hashString } = req.params;
        const workspace = req.workspace;
        const response = new ResponseObject();

        debug(`ROUTE: GET /:id/documents/by-hash/:hashString - Get doc hash ${hashString} from workspace ${workspace.id}`);

        try {
            const document = await workspace.db.getByChecksumString(hashString);
            if (document) {
                response.success(document, `Document with hash '${hashString}' retrieved successfully.`);
                res.json(response.getResponse());
            } else {
                response.notFound(`Document with hash '${hashString}' not found.`);
                res.status(404).json(response.getResponse());
            }
        } catch (error) {
            logger.error(`Error getting document by hash ${hashString} in workspace ${workspace.id}: ${error.message}`);
            res.status(500).json(response.error('Internal server error getting document by hash', [error.message]).getResponse());
        }
    });

    return router;
};
