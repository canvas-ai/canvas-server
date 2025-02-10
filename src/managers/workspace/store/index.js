import path from "path";
import JsonMap from "../../../utils/JsonMap.js";

class WorkspaceStore extends JsonMap {
    constructor(workspacePath) {
        if (!workspacePath) {
            throw new Error('Workspace path is required');
        }

        // The store data will be in the db subdirectory of the workspace
        const dbPath = path.join(workspacePath, 'db');
        super(dbPath);

        this.workspacePath = workspacePath;
    }

    // Add any additional workspace store specific methods here
}

export default WorkspaceStore;