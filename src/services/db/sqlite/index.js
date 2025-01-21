import { PrismaClient } from '@prisma/client';

class Database {
  static #instance;
  #prisma;
  #initialized = false;

  constructor() {
    if (Database.#instance) {
      throw new Error('Database is a singleton. Use Database.getInstance() instead.');
    }
  }

  static async getInstance() {
    if (!Database.#instance) {
      Database.#instance = new Database();
    }
    if (!Database.#instance.#initialized) {
      await Database.#instance.initialize();
    }
    return Database.#instance;
  }

  async initialize() {
    this.#prisma = new PrismaClient();
    await this.#prisma.$connect();
    this.#initialized = true;
  }

  get db() {
    return this.#prisma;
  }
}

export default Database;