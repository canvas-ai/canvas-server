import env from "../../../env.js";
import path from "path";
import JsonMap from "../../../utils/JsonMap.js";

class UserStore extends JsonMap {
  static #instance;

  constructor() {
    if (UserStore.#instance) {
      throw new Error('UserStore is a singleton. Use UserStore.getInstance() instead.');
    }
    super(path.join(env.CANVAS_SERVER_DATA, "users"));
  }

  static getInstance() {
    if (!UserStore.#instance) {
      UserStore.#instance = new UserStore();
    }
    return UserStore.#instance;
  }

  findByEmail(email) {
    return Array.from(this.values()).filter(user => {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    })[0];
  }

  create(user) {
    this.set(user.id, user);
    return user;
  }

  findById(id) {
    return this.get(id);
  }
}

export default UserStore.getInstance;