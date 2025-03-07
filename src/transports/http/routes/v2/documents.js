'use strict';

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger, { createDebug } from '@/utils/log/index.js';
const debug = createDebug('http:routes:documents');
import ResponseObject from '@/transports/ResponseObject.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Document:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The document ID
 *         hash:
 *           type: string
 *           description: The document hash
 *         checksum:
 *           type: string
 *           description: The document checksum
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
 *         metadata:
 *           type: object
 *           description: Additional metadata
 */

/**
 * Documents routes
 * @param {Object} options - Route options
 * @param {Object} options.auth - Auth service
 * @param {Object} options.workspaceManager - Workspace manager
 * @param {Object} options.contextManager - Context manager
 * @returns {express.Router} - Express router
 */
export default function documentsRoutes(options) {
    const router = express.Router();
    const { auth, workspaceManager, contextManager } = options;

    if (!auth) {
        throw new Error('Auth service is required');
    }

    if (!workspaceManager) {
        throw new Error('Workspace manager is required');
    }

    if (!contextManager) {
        throw new Error('Context manager is required');
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
     *     summary: List documents
     *     tags: [Documents]
     *     parameters:
     *       - in: query
     *         name: workspaceId
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
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               contextArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of context IDs to filter by
     *               featureArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of features to filter by
     *               filterArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of filters to apply
     *     responses:
     *       200:
     *         description: List of documents
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Document'
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
    router.get('/', async (req, res) => {
        try {
            const { workspaceId, limit = 50, offset = 0 } = req.query;
            const { contextArray = [], featureArray = [], filterArray = [] } = req.body;

            if (!workspaceId) {
                return res.status(400).json(new ResponseObject(null, 'Workspace ID is required', 400));
            }

            // Check if workspace exists and user has access
            const workspace = await workspaceManager.getWorkspace(workspaceId);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if user has access to this workspace
            if (!workspaceManager.hasAccess(workspace, req.user)) {
                return res.status(403).json(new ResponseObject(null, 'Access denied', 403));
            }

            const options = {
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
                contextArray,
                featureArray,
                filterArray
            };

            const documents = await workspaceManager.listDocuments(workspaceId, options);
            return res.json(new ResponseObject(documents));
        } catch (err) {
            debug(`Error listing documents: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /:
     *   post:
     *     summary: Create a new document
     *     tags: [Documents]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - workspaceId
     *               - content
     *             properties:
     *               workspaceId:
     *                 type: string
     *                 description: Workspace ID
     *               content:
     *                 type: object
     *                 description: Document content
     *               contextArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of context IDs to associate with
     *               featureArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of features to index with
     *               filterArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of filters to apply
     *               metadata:
     *                 type: object
     *                 description: Additional metadata
     *     responses:
     *       201:
     *         description: Document created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Document'
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
    router.post('/', async (req, res) => {
        try {
            const { workspaceId, content, contextArray = [], featureArray = [], filterArray = [], metadata = {} } = req.body;

            if (!workspaceId) {
                return res.status(400).json(new ResponseObject(null, 'Workspace ID is required', 400));
            }

            if (!content) {
                return res.status(400).json(new ResponseObject(null, 'Document content is required', 400));
            }

            // Check if workspace exists and user has access
            const workspace = await workspaceManager.getWorkspace(workspaceId);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if user has write access to this workspace
            if (!workspaceManager.hasAccess(workspace, req.user, 'write')) {
                return res.status(403).json(new ResponseObject(null, 'Access denied', 403));
            }

            const documentData = {
                content,
                metadata,
                createdBy: req.user.id
            };

            const options = {
                contextArray,
                featureArray,
                filterArray
            };

            const document = await workspaceManager.createDocument(workspaceId, documentData, options);
            return res.status(201).json(new ResponseObject(document));
        } catch (err) {
            debug(`Error creating document: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /by-id/{id}:
     *   get:
     *     summary: Get a document by ID
     *     tags: [Documents]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Document ID
     *       - in: query
     *         name: workspaceId
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               contextArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of context IDs to filter by
     *               featureArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of features to filter by
     *               filterArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of filters to apply
     *     responses:
     *       200:
     *         description: Document retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Document'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Access denied
     *       404:
     *         description: Document or workspace not found
     *       500:
     *         description: Server error
     */
    router.get('/by-id/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { workspaceId } = req.query;
            const { contextArray = [], featureArray = [], filterArray = [] } = req.body;

            if (!workspaceId) {
                return res.status(400).json(new ResponseObject(null, 'Workspace ID is required', 400));
            }

            // Check if workspace exists and user has access
            const workspace = await workspaceManager.getWorkspace(workspaceId);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if user has access to this workspace
            if (!workspaceManager.hasAccess(workspace, req.user)) {
                return res.status(403).json(new ResponseObject(null, 'Access denied', 403));
            }

            const options = {
                contextArray,
                featureArray,
                filterArray
            };

            const document = await workspaceManager.getDocumentById(workspaceId, id, options);

            if (!document) {
                return res.status(404).json(new ResponseObject(null, 'Document not found', 404));
            }

            return res.json(new ResponseObject(document));
        } catch (err) {
            debug(`Error getting document by ID: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /by-hash/{hash}/{checksum}:
     *   get:
     *     summary: Get a document by hash and checksum
     *     tags: [Documents]
     *     parameters:
     *       - in: path
     *         name: hash
     *         required: true
     *         schema:
     *           type: string
     *         description: Document hash
     *       - in: path
     *         name: checksum
     *         required: true
     *         schema:
     *           type: string
     *         description: Document checksum
     *       - in: query
     *         name: workspaceId
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               contextArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of context IDs to filter by
     *               featureArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of features to filter by
     *               filterArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of filters to apply
     *     responses:
     *       200:
     *         description: Document retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Document'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Access denied
     *       404:
     *         description: Document or workspace not found
     *       500:
     *         description: Server error
     */
    router.get('/by-hash/:hash/:checksum', async (req, res) => {
        try {
            const { hash, checksum } = req.params;
            const { workspaceId } = req.query;
            const { contextArray = [], featureArray = [], filterArray = [] } = req.body;

            if (!workspaceId) {
                return res.status(400).json(new ResponseObject(null, 'Workspace ID is required', 400));
            }

            // Check if workspace exists and user has access
            const workspace = await workspaceManager.getWorkspace(workspaceId);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if user has access to this workspace
            if (!workspaceManager.hasAccess(workspace, req.user)) {
                return res.status(403).json(new ResponseObject(null, 'Access denied', 403));
            }

            const options = {
                contextArray,
                featureArray,
                filterArray
            };

            const document = await workspaceManager.getDocumentByHash(workspaceId, hash, checksum, options);

            if (!document) {
                return res.status(404).json(new ResponseObject(null, 'Document not found', 404));
            }

            return res.json(new ResponseObject(document));
        } catch (err) {
            debug(`Error getting document by hash: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}:
     *   put:
     *     summary: Update a document
     *     tags: [Documents]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Document ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - workspaceId
     *               - content
     *             properties:
     *               workspaceId:
     *                 type: string
     *                 description: Workspace ID
     *               content:
     *                 type: object
     *                 description: Document content
     *               contextArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of context IDs to associate with
     *               featureArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of features to index with
     *               filterArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of filters to apply
     *               metadata:
     *                 type: object
     *                 description: Additional metadata
     *     responses:
     *       200:
     *         description: Document updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Document'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Access denied
     *       404:
     *         description: Document or workspace not found
     *       500:
     *         description: Server error
     */
    router.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { workspaceId, content, contextArray = [], featureArray = [], filterArray = [], metadata = {} } = req.body;

            if (!workspaceId) {
                return res.status(400).json(new ResponseObject(null, 'Workspace ID is required', 400));
            }

            if (!content) {
                return res.status(400).json(new ResponseObject(null, 'Document content is required', 400));
            }

            // Check if workspace exists and user has access
            const workspace = await workspaceManager.getWorkspace(workspaceId);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if user has write access to this workspace
            if (!workspaceManager.hasAccess(workspace, req.user, 'write')) {
                return res.status(403).json(new ResponseObject(null, 'Access denied', 403));
            }

            // Check if document exists
            const existingDocument = await workspaceManager.getDocumentById(workspaceId, id);
            if (!existingDocument) {
                return res.status(404).json(new ResponseObject(null, 'Document not found', 404));
            }

            const documentData = {
                content,
                metadata,
                updatedBy: req.user.id
            };

            const options = {
                contextArray,
                featureArray,
                filterArray
            };

            const document = await workspaceManager.updateDocument(workspaceId, id, documentData, options);
            return res.json(new ResponseObject(document));
        } catch (err) {
            debug(`Error updating document: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}:
     *   patch:
     *     summary: Partially update a document
     *     tags: [Documents]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Document ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - workspaceId
     *             properties:
     *               workspaceId:
     *                 type: string
     *                 description: Workspace ID
     *               content:
     *                 type: object
     *                 description: Document content
     *               contextArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of context IDs to associate with
     *               featureArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of features to index with
     *               filterArray:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of filters to apply
     *               metadata:
     *                 type: object
     *                 description: Additional metadata
     *     responses:
     *       200:
     *         description: Document updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Document'
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Access denied
     *       404:
     *         description: Document or workspace not found
     *       500:
     *         description: Server error
     */
    router.patch('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { workspaceId, content, contextArray, featureArray, filterArray, metadata } = req.body;

            if (!workspaceId) {
                return res.status(400).json(new ResponseObject(null, 'Workspace ID is required', 400));
            }

            // Check if workspace exists and user has access
            const workspace = await workspaceManager.getWorkspace(workspaceId);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if user has write access to this workspace
            if (!workspaceManager.hasAccess(workspace, req.user, 'write')) {
                return res.status(403).json(new ResponseObject(null, 'Access denied', 403));
            }

            // Check if document exists
            const existingDocument = await workspaceManager.getDocumentById(workspaceId, id);
            if (!existingDocument) {
                return res.status(404).json(new ResponseObject(null, 'Document not found', 404));
            }

            const documentData = {
                updatedBy: req.user.id
            };

            if (content) documentData.content = content;
            if (metadata) documentData.metadata = metadata;

            const options = {};
            if (contextArray) options.contextArray = contextArray;
            if (featureArray) options.featureArray = featureArray;
            if (filterArray) options.filterArray = filterArray;

            const document = await workspaceManager.updateDocument(workspaceId, id, documentData, options);
            return res.json(new ResponseObject(document));
        } catch (err) {
            debug(`Error updating document: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    /**
     * @swagger
     * /{id}:
     *   delete:
     *     summary: Delete a document
     *     tags: [Documents]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Document ID
     *       - in: query
     *         name: workspaceId
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *     responses:
     *       200:
     *         description: Document deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Access denied
     *       404:
     *         description: Document or workspace not found
     *       500:
     *         description: Server error
     */
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { workspaceId } = req.query;

            if (!workspaceId) {
                return res.status(400).json(new ResponseObject(null, 'Workspace ID is required', 400));
            }

            // Check if workspace exists and user has access
            const workspace = await workspaceManager.getWorkspace(workspaceId);
            if (!workspace) {
                return res.status(404).json(new ResponseObject(null, 'Workspace not found', 404));
            }

            // Check if user has write access to this workspace
            if (!workspaceManager.hasAccess(workspace, req.user, 'write')) {
                return res.status(403).json(new ResponseObject(null, 'Access denied', 403));
            }

            // Check if document exists
            const existingDocument = await workspaceManager.getDocumentById(workspaceId, id);
            if (!existingDocument) {
                return res.status(404).json(new ResponseObject(null, 'Document not found', 404));
            }

            const result = await workspaceManager.deleteDocument(workspaceId, id);
            return res.json(new ResponseObject({ success: true }));
        } catch (err) {
            debug(`Error deleting document: ${err.message}`);
            return res.status(500).json(new ResponseObject(null, err.message, 500));
        }
    });

    return router;
}