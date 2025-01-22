import env from "../../../env.js";
import path from "path";
import JsonMap from "../../../utils/JsonMap.js";

class WorkspaceStore extends JsonMap {
    constructor(id) {
      super(path.join(env.CANVAS_SERVER_WORKSPACES, id, "workspace"));
    }
}

export default WorkspaceStore;