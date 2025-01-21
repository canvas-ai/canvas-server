import UserRepository from '../../../services/db/prisma/repositories/User.js';

class UserStore {
  static #instance;
  #userRepository;

  constructor() {
    if (UserStore.#instance) {
      throw new Error('UserStore is a singleton. Use UserStore.getInstance() instead.');
    }
  }

  async initialize() {
    if(!this.#userRepository) {
      this.#userRepository = new UserRepository();
    }
  }

  static async getInstance() {
    if (!UserStore.#instance) {
      UserStore.#instance = new UserStore();
    }
    await UserStore.#instance.initialize();
    return UserStore.#instance;
  }

  findByEmail(email) {
    return this.#userRepository.findByEmail(email);
  }

  create(user) {
    return this.#userRepository.create(user);
  }

  findById(id) {
    return this.#userRepository.findById(id);
  }

  update(user) {
    return this.#userRepository.update(user);
  }

  delete(id) {
    return this.#userRepository.delete(id);
  }
}

export default UserStore.getInstance;