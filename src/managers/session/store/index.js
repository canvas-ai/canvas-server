import env from "../../../env.js";
import path from "path";
import JsonMap from "../../../utils/JsonMap.js";

class SessionStore extends JsonMap {
    static #instance;

    constructor() {
      if(SessionStore.#instance) {
        throw new Error('SessionStore is a singleton. Use SessionStore.getInstance() instead.');
      }
      super(path.join(env.CANVAS_SERVER_DB, "sessions"));
    }

    static getInstance() {
        if (!SessionStore.#instance) {
            SessionStore.#instance = new SessionStore();
        }
        return SessionStore.#instance;
    }
}

export default SessionStore.getInstance;