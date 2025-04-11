'use strict';

import express from 'express';
// Use console for logging in this simple service
const logPrefix = '[WorkspaceRoutes]';
const debug = (...args) => console.debug(logPrefix, ...args);
const error = (...args) => console.error(logPrefix, ...args);

export default function createApiRoutes(workspace) {
    if (!workspace) {
        throw new Error('Workspace instance is required to create routes');
    }

    const router = express.Router();

    // Middleware to check if workspace is active/open for all API routes
    const requireActiveWorkspace = (req, res, next) => {
        if (!workspace.isActive()) {
            error(`Workspace ${workspace.id} is not active. Status: ${workspace.status}`);
            return res.status(503).json({ success: false, message: 'Workspace is not active or ready' }); // 503 Service Unavailable
        }
        next();
    };
    router.use(requireActiveWorkspace);

    console.info(logPrefix, `Creating API routes for workspace: ${workspace.id}`);

    /**
     * GET /tree
     * Get the JSON tree structure of the workspace
     */
    router.get('/tree', (req, res) => {
        try {
            const tree = workspace.db.tree.buildJsonTree(); // Assuming this returns the tree JSON

            // Avoid logging potentially large trees by default
            debug(`Tree for ${workspace.id}: ${JSON.stringify(tree, null, 2)}`);
            res.status(200).json({ success: true, data: tree, message: 'Workspace tree retrieved successfully' });
        } catch (err) {
            error(`Error getting workspace tree for ${workspace.id}: ${err.message}`);
            res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
        }
    });

    /**
     * GET /tree/paths
     * Get all paths in the workspace tree
     */
    router.get('/tree/paths', (req, res) => {
        try {
            const paths = workspace.paths; // Use the getter
            res.status(200).json({ success: true, data: paths, message: 'Workspace paths retrieved successfully' });
        } catch (err) {
            error(`Error getting workspace paths for ${workspace.id}: ${err.message}`);
            res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
        }
    });

    /**
     * POST /tree/path
     * Insert a path in the workspace tree
     */
    router.post('/tree/path', (req, res) => { // Changed from GET to POST as it modifies state
        try {
            const { path, autoCreateLayers = true } = req.body;
            if (!path) {
                return res.status(400).json({ success: false, message: 'Path is required' });
            }

            // Insert the path and get the result
            const result = workspace.insertPath(path, null, autoCreateLayers);
            // Event emission happens within Workspace class

            res.status(201).json({ // Use 201 Created status
                success: true,
                data: {
                    path,
                    layerIds: result.layerIds,
                    tree: result.tree, // Include updated tree
                },
                message: 'Path inserted successfully'
            });
        } catch (err) {
            error(`Error inserting path for ${workspace.id}: ${err.message}`);
            res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
        }
    });

    // --- Add more routes here mirroring src/transports/http/routes/v2/workspaces.js ---
    // --- adapting them to operate directly on the `workspace` instance ---

    // Example: Get Layers
    router.get('/tree/layers', (req, res) => {
        try {
            const layers = workspace.layers.list(); // Assuming layers object has list()
            res.status(200).json({ success: true, data: {
                layers,
                tree: workspace.jsonTree // Include current tree state
            }, message: 'Layers retrieved successfully' });
        } catch (err) {
            error(`Error getting layers for ${workspace.id}: ${err.message}`);
            res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
        }
    });

    // Example: Get Layer by Name
    router.get('/tree/layers/:name', (req, res) => {
        try {
            const { name } = req.params;
            const layer = workspace.getLayer(name);
            if (!layer) {
                return res.status(404).json({ success: false, message: 'Layer not found' });
            }
            res.status(200).json({ success: true, data: {
                layer,
                tree: workspace.jsonTree
            }, message: 'Layer retrieved successfully' });
        } catch (err) {
            error(`Error getting layer ${req.params.name} for ${workspace.id}: ${err.message}`);
            res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
        }
    });

    /**
     * GET /documents
     * Get documents associated with a specific context path.
     * Query Param: path (string, required) - e.g., /work/project
     */
    router.get('/documents', async (req, res) => {
        const contextPath = req.query.path;

        if (!contextPath || typeof contextPath !== 'string' || !contextPath.startsWith('/')) {
            return res.status(400).json({ success: false, message: 'Valid context path query parameter starting with / is required' });
        }

        try {
            // Use the workspace's listDocuments method with the path as contextSpec
            // Assuming listDocuments handles the path format correctly (e.g., '/work/project')
            // Add options like limit/offset later if needed
            const documents = await workspace.db.listDocuments(contextPath);

            res.status(200).json({ success: true, data: documents, message: `Documents listed for path ${contextPath}` });
        } catch (err) {
            error(`Error listing documents for path ${contextPath} in workspace ${workspace.id}: ${err.message}`);
            res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
        }
    });

    // TODO: Implement remaining routes: delete path, move path, copy path, merge up/down,
    // create/update/rename/delete layer, insert canvas/workspace refs, documents (list/create)?

    return router;
}
