import debugInstance from 'debug';
const debug = debugInstance('canvas:session:model');

import Base from './Base.js';

import Context from '../../context/lib/Context.js';

export default class Session extends Base {
  static tableName = 'Session';

  constructor(data) {
    super(data);
    this.contexts = new Map();
  }

  static async create(data) {
    const session = await super.create({
      ...data,
      name: data.name || this.#generateSessionName(),
      status: 'active'
    });

    // Create default context in Universe workspace
    await session.createContext('universe:///');

    return session;
  }

  static async findByUserIdAndName({ userId, name }) {
    return await super.findFirst({
      where: {
        userId,
        name
      }
    });
  }

  async createContext(url = 'universe:///') {
    const context = new Context(this, { url });
    await context.setUrl(url);

    this.contexts.set(context.id, context);
    debug(`Created context ${context.id} with URL ${url}`);

    return context;
  }

  async getContext(contextId) {
    return this.contexts.get(contextId);
  }

  async listContexts() {
    return Array.from(this.contexts.values());
  }

  async destroyContext(contextId) {
    const context = this.contexts.get(contextId);
    if (context) {
      await context.destroy();
      this.contexts.delete(contextId);
      debug(`Destroyed context ${contextId}`);
    }
  }

  static #generateSessionName() {
    // You can implement a more sophisticated name generator
    return `session-${Date.now()}`;
  }

  async destroy() {
    // Cleanup all contexts
    for (const context of this.contexts.values()) {
      await context.destroy();
    }
    this.contexts.clear();

    await super.destroy();
  }
}
