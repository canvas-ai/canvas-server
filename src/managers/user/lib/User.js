// Managers
import { sessionManager, workspaceManager } from '@/Server.js'

export default class User {

    constructor(options = {}) {
        this.id = options.id;

        this.sessions = new Map();        // Active sessions
        this.workspaces = new Map();      // Accessible workspaces
    }

    async initialize() {
        // Load active sessions
        const sessions = await sessionManager.getSessions(this.id);
        sessions.forEach(session => this.sessions.set(session.id, session));

        // Load accessible workspaces
        const workspaces = await workspaceManager.getWorkspaces(this.id);
        workspaces.forEach(workspace => {
            this.workspaces.set(workspace.id, workspace);

            // Set personal workspace reference
            if (workspace.type === 'personal' && workspace.ownerId === this.id) {
                this.personalWorkspace = workspace;
            }
        });
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
