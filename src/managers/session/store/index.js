import debug from "debug";
import SessionRepository from "../../../services/db/prisma/repositories/Session.js";
const log = debug('canvas:session-manager');
import EventEmitter from 'eventemitter2';

class SessionStore extends EventEmitter {
  static #instance;
  static #sessionRepository;

  constructor() {
    super();
    if (SessionStore.#instance) {
      throw new Error('SessionStore is a singleton. Use SessionStore.getInstance() instead.');
    }
  }

  static async getInstance() {
    if (!SessionStore.#instance) {
      SessionStore.#instance = new SessionStore();
    }
    await SessionStore.#instance.initialize();
    return SessionStore.#instance;
  }

  async initialize() {
    SessionStore.#sessionRepository = new SessionRepository();
  }

  async saveSession(session) {
    if (!session.userId) {
      throw new Error('Session user ID is required');
    }
    if (!session.name) {
      throw new Error('Session name is required');
    }
    log(`Saving session "${session.name}" to DB`);
    return await SessionStore.#sessionRepository.create(session);
  }

  async updateSession(id, data) {
    log(`Updating session "${id}" in DB`);
    await SessionStore.#sessionRepository.update(id, data);
  }

  async deleteSession(id) {
    log(`Deleting session "${id}" from DB`);
    await SessionStore.#sessionRepository.delete(id);
  }

  async getUserSession(userId, name) {
    const session = await SessionStore.#sessionRepository.findByUserIdAndName(userId, name);
    return session;
  }

  async getUserSessions(userId) {
    const sessions = await SessionStore.#sessionRepository.findByUserId(userId);
    return sessions;
  }

  async deleteUserSession(userId, name) {
    const session = await this.getUserSession(userId, name);
    if (!session) {
      throw new Error(`Session with name "${name}" does not found for the user`);
    }

    if (!await SessionStore.#sessionRepository.delete(session.id)) {
      throw new Error('Error deleting session from DB');
    }

    log(`Session name "${name}" deleted`);
    this.emit('session:deleted', name);

    return name;
  }
}

export default SessionStore.getInstance;