import Layer from './Layer.js';

export default class WorkspaceLayer extends Layer {
    constructor(options = {}) {
        super(options);
        this.type = 'workspace';

        // Workspace reference
        this.workspaceReference = options.workspaceReference;
        this.acl = options.acl ?? {};

        // Update layer properties based on workspace config
        this.fetchWorkspaceConfig();
    }

    /**
    /**
     * Workspace methods
     */

    getWorkspaceReference() {
        return this.workspaceReference;
    }

    setWorkspaceReference(workspaceReference) {
        this.workspaceReference = workspaceReference;
    }

    fetchWorkspaceConfig() {
        this.name = this.workspaceReference.name;
        this.label = this.workspaceReference.label;
        this.description = this.workspaceReference.description;
        this.color = this.workspaceReference.color;
        this.metadata = this.workspaceReference.metadata;
    }

    // Honestly, not sure how to deal with this yet, probably we'll just work with the ref instead
    // of reimplementing all the workspace methods here
    getWorkspaceTree() {
        return this.workspaceReference.tree;
    }

    /**
     * ACL
     */

    insertUser(user, permissions) {
        this.acl.users.push({ user, permissions });
    }

    removeUser(user) {
        this.acl.users = this.acl.users.filter((u) => u.user !== user);
    }

    /**
     * JSON
     */

    toJSON() {
        // TODO: Maybe we should use JSON.stringify to return a valid JSON directly
        return {
            schemaVersion: this.schemaVersion,
            id: this.id,
            type: this.type,
            name: this.name,
            label: this.label,
            description: this.description,
            color: this.color,
            locked: this.locked,
            metadata: this.metadata,
            acl: this.acl,
            ui: this.ui,
        };
    }

    static fromJSON(json) {
        // TODO: Maybe we should use JSON string as input and then JSON.parse it
        const layer = new Layer({
            schemaVersion: json.schemaVersion,
            id: json.id,
            type: json.type,
            name: json.name,
            label: json.label,
            description: json.description,
            color: json.color,
            locked: json.locked,
            metadata: json.metadata,
            acl: json.acl,
            ui: json.ui,
        });
        return layer;
    }
}
