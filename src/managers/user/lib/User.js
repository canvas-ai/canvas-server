// Managers
import { sessionManager, workspaceManager } from '@/Server.js'
import path from 'path'
import fs from 'fs/promises'
import env from '@/env.js'

export default class User {

    constructor(options = {}) {
        this.id = options.id; // User's email is their ID
        this.email = options.email;
        this.home = path.join(env.CANVAS_USER_HOME, this.id);

        this.sessions = new Map();        // Active sessions
        this.workspaces = new Map();      // Accessible workspaces
        this.personalWorkspace = null;    // Reference to personal Universe workspace
    }

    async initialize() {
        // Create user home directory structure
        await this.#createHomeDirectories();

        // Initialize default Universe workspace if not exists
        await this.#initializeUniverseWorkspace();

        // Load active sessions
        const sessions = await sessionManager.getSessions(this.id);
        sessions.forEach(session => this.sessions.set(session.id, session));

        // Load accessible workspaces
        const workspaces = await workspaceManager.getWorkspaces(this.id);
        workspaces.forEach(workspace => {
            this.workspaces.set(workspace.id, workspace);

            // Set personal workspace reference
            if (workspace.type === 'universe' && workspace.ownerId === this.id) {
                this.personalWorkspace = workspace;
            }
        });
    }

    async #createHomeDirectories() {
        // Create main user directory structure
        const dirs = [
            this.home,
            path.join(this.home, 'config'),
            path.join(this.home, 'workspaces')
        ];

        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    async #initializeUniverseWorkspace() {
        const universeWorkspacePath = path.join(this.home, 'workspaces', 'Universe');
        const workspaceConfigPath = path.join(universeWorkspacePath, 'workspace.json');

        // Check if Universe workspace already exists
        try {
            await fs.access(workspaceConfigPath);
            return; // Workspace already exists
        } catch {
            // Create Universe workspace
            await fs.mkdir(universeWorkspacePath, { recursive: true });

            const workspaceConfig = {
                id: 'universe',
                name: 'Universe',
                type: 'universe',
                ownerId: this.id,
                created: new Date().toISOString(),
                updated: new Date().toISOString()
            };

            await fs.writeFile(workspaceConfigPath, JSON.stringify(workspaceConfig, null, 2));

            // Initialize workspace in the manager
            await workspaceManager.createWorkspace(this.id, 'Universe', workspaceConfig);
        }
    }

    async createSession(deviceInfo) {
        const session = await sessionManager.createSession({
            userId: this.id,
            deviceInfo
        });

        this.sessions.set(session.id, session);
        return session;
    }

    async createAccessToken(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Invalid session');
        }

        const token = await session.createAccessToken();
        this.accessTokens.set(token, session);
        return token;
    }

    hasAccessToWorkspace(workspaceId) {
        return this.workspaces.has(workspaceId);
    }

    // Session management
    getActiveSessions() {
        return Array.from(this.sessions.values());
    }

    // Workspace access
    getAccessibleWorkspaces() {
        return Array.from(this.workspaces.values());
    }
}
