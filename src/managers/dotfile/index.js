'use strict';

// Core dependencies
import path from 'path';
import { existsSync } from 'fs';
import * as fsPromises from 'fs/promises';
import { spawn } from 'child_process';
import EventEmitter from 'eventemitter2';

// Logging
import logger, { createDebug } from '../../utils/log/index.js';
const debug = createDebug('dotfile-manager');

const DOTFILES_DIR = 'dotfiles.git';

/**
 * DotfileManager - Manages workspace-based Git repositories for dotfiles
 */
class DotfileManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.workspaceManager = options.workspaceManager;
        if (!this.workspaceManager) {
            throw new Error('WorkspaceManager is required');
        }
        debug('DotfileManager initialized');
    }

    // Initialize method for compatibility with Server.js
    async initialize() {
        return this;
    }

    // Get repository path for workspace
    #getDotfilesRepoPath(workspace) {
        return path.join(workspace.rootPath, DOTFILES_DIR);
    }

    // Check if repository exists
    async hasRepository(userId, workspaceIdOrObject, requestingUserId) {
        // Handle workspace object vs ID
        let workspace;
        if (typeof workspaceIdOrObject === 'object' && workspaceIdOrObject.id) {
            workspace = workspaceIdOrObject;
        } else {
            workspace = await this.workspaceManager.getWorkspaceById(workspaceIdOrObject, requestingUserId);
            if (!workspace) {
                return false;
            }
        }
        const repoPath = this.#getDotfilesRepoPath(workspace);
        return existsSync(repoPath);
    }

    // Initialize bare Git repository
    async initializeRepository(userId, workspaceIdOrObject, requestingUserId) {
        // Handle workspace object vs ID
        let workspace;
        if (typeof workspaceIdOrObject === 'object' && workspaceIdOrObject.id) {
            workspace = workspaceIdOrObject;
        } else {
            workspace = await this.workspaceManager.getWorkspaceById(workspaceIdOrObject, requestingUserId);
            if (!workspace) {
                throw new Error(`Workspace ${workspaceIdOrObject} not found or access denied`);
            }
        }
        const repoPath = this.#getDotfilesRepoPath(workspace);

        if (existsSync(repoPath)) {
            return { success: true, message: 'Repository already initialized', path: repoPath };
        }

                await fsPromises.mkdir(repoPath, { recursive: true });

        // Initialize bare repository with native git
        const gitInit = spawn('git', ['init', '--bare', '--initial-branch=main'], {
            cwd: repoPath,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        await new Promise((resolve, reject) => {
            gitInit.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`git init failed with code ${code}`));
                }
            });
            gitInit.on('error', reject);
        });

        this.emit('repository.initialized', { userId, workspace: workspace.id, path: repoPath });
        return { success: true, message: 'Repository initialized successfully', path: repoPath };
    }

    // Get repository status
    async getRepositoryStatus(userId, workspaceIdOrObject, requestingUserId) {
        // Handle workspace object vs ID
        let workspace;
        if (typeof workspaceIdOrObject === 'object' && workspaceIdOrObject.id) {
            workspace = workspaceIdOrObject;
        } else {
            workspace = await this.workspaceManager.getWorkspaceById(workspaceIdOrObject, requestingUserId);
            if (!workspace) {
                throw new Error(`Workspace ${workspaceIdOrObject} not found or access denied`);
            }
        }
        const repoPath = this.#getDotfilesRepoPath(workspace);

        if (!existsSync(repoPath)) {
            return { initialized: false, path: repoPath };
        }

        // Read branches from filesystem
        let branches = [];
        let currentBranch = null;

        try {
            const refsHeadsPath = path.join(repoPath, 'refs', 'heads');
            if (existsSync(refsHeadsPath)) {
                const refFiles = await fsPromises.readdir(refsHeadsPath);
                for (const file of refFiles) {
                    const filePath = path.join(refsHeadsPath, file);
                    const stats = await fsPromises.stat(filePath);
                    if (stats.isFile()) {
                        branches.push(file);
                    }
                }
                currentBranch = branches.includes('main') ? 'main' : branches[0];
            }
        } catch (error) {
            // Empty repository - no branches yet
        }

        return {
            initialized: true,
            path: repoPath,
            branches,
            currentBranch,
            bare: true
        };
    }

    // Handle Git HTTP backend operations
    async handleGitHttpBackend(userId, workspaceIdOrObject, requestingUserId, service, request, reply) {
        // Handle workspace object vs ID
        let workspace;
        if (typeof workspaceIdOrObject === 'object' && workspaceIdOrObject.id) {
            workspace = workspaceIdOrObject;
        } else {
            workspace = await this.workspaceManager.getWorkspaceById(workspaceIdOrObject, requestingUserId);
            if (!workspace) {
                throw new Error(`Workspace ${workspaceIdOrObject} not found or access denied`);
            }
        }
        const repoPath = this.#getDotfilesRepoPath(workspace);

        if (!existsSync(repoPath)) {
            throw new Error('Repository not initialized');
        }

        switch (service) {
            case 'info/refs':
                return this.#handleInfoRefs(repoPath, request, reply);
            case 'git-upload-pack':
                return this.#handleUploadPack(repoPath, request, reply);
            case 'git-receive-pack':
                return this.#handleReceivePack(repoPath, request, reply);
            default:
                throw new Error(`Unsupported Git service: ${service}`);
        }
    }

        // Handle info/refs requests
    async #handleInfoRefs(repoPath, request, reply) {
        const service = request.query.service;

        // Set correct content type based on service
        const contentType = service === 'git-receive-pack'
            ? 'application/x-git-receive-pack-advertisement'
            : 'application/x-git-upload-pack-advertisement';

        reply
            .type(contentType)
            .header('cache-control', 'no-cache');

        // Build proper Git protocol response
        let response = '';

        // Service announcement
        const serviceHeader = `# service=${service}\n`;
        const headerLength = (serviceHeader.length + 4).toString(16).padStart(4, '0');
        response += headerLength + serviceHeader + '0000';

        // Add refs if any exist
        try {
            const refsHeadsPath = path.join(repoPath, 'refs', 'heads');
            if (existsSync(refsHeadsPath)) {
                const refFiles = await fsPromises.readdir(refsHeadsPath);
                for (const file of refFiles) {
                    const filePath = path.join(refsHeadsPath, file);
                    const stats = await fsPromises.stat(filePath);
                    if (stats.isFile()) {
                        const refContent = await fsPromises.readFile(filePath, 'utf8');
                        const oid = refContent.trim();
                        const refLine = `${oid} refs/heads/${file}\n`;
                        const refLength = (refLine.length + 4).toString(16).padStart(4, '0');
                        response += refLength + refLine;
                    }
                }
            }
        } catch (error) {
            // Empty repository - no refs to add
        }

        // Final terminator
        response += '0000';
        reply.send(response);
    }

    // Handle git-upload-pack requests
    async #handleUploadPack(repoPath, request, reply) {
        reply.type('application/x-git-upload-pack-result');

        const gitProcess = spawn('git', ['upload-pack', '--stateless-rpc', repoPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Handle request body
        if (request.body && Buffer.isBuffer(request.body)) {
            gitProcess.stdin.end(request.body);
        } else {
            request.raw.pipe(gitProcess.stdin);
        }

        gitProcess.stderr.on('data', (data) => {
            debug(`upload-pack stderr: ${data.toString()}`);
        });

        return reply.send(gitProcess.stdout);
    }

    // Handle git-receive-pack requests
    async #handleReceivePack(repoPath, request, reply) {
        reply.type('application/x-git-receive-pack-result');

        const gitProcess = spawn('git', ['receive-pack', '--stateless-rpc', repoPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Handle request body
        if (request.body && Buffer.isBuffer(request.body)) {
            gitProcess.stdin.end(request.body);
        } else {
            request.raw.pipe(gitProcess.stdin);
        }

        gitProcess.stderr.on('data', (data) => {
            debug(`receive-pack stderr: ${data.toString()}`);
        });

        return reply.send(gitProcess.stdout);
    }
}

export default DotfileManager;

