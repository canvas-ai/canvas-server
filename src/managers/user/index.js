// Utils
import EventEmitter from 'eventemitter2';
import debugInstance from 'debug';
const debug = debugInstance('canvas:user:manager');
import bcrypt from 'bcrypt';

// Managers
import { sessionManager, workspaceManager } from '@/Server.js';

// Includes
import User from './lib/User.js';
import { Database } from 'sqlite3';

export default class UserManager extends EventEmitter {
    constructor(options = {}) {
        super();

        this.db = null;
        this.users = new Map(); // Cache active users

        this.initialize(options);
    }

    async initialize(options) {
        // Initialize SQLite connection
        this.db = new Database(options.dbPath || 'canvas.db');

        // Create users table if not exists
        await this.initializeDatabase();
    }

    async initializeDatabase() {
        return new Promise((resolve, reject) => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    home_path TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    debug('Failed to initialize users table:', err);
                    reject(err);
                }
                resolve();
            });
        });
    }

    async createUser({ email, password }) {
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        // Email is the user ID
        const id = email;
        const passwordHash = await this.#hashPassword(password);

        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO users (id, email, password_hash, home_path) VALUES (?, ?, ?, ?)',
                [id, email, passwordHash, ''],
                async (err) => {
                    if (err) {
                        debug('Failed to create user:', err);
                        reject(err);
                        return;
                    }

                    try {
                        const user = new User({ id, email });
                        await user.initialize(); // This will create home directories and Universe workspace

                        // Update home_path in database
                        await this.#updateUserHomePath(id, user.home);

                        this.users.set(id, user);
                        this.emit('user:created', user);

                        resolve(user);
                    } catch (error) {
                        debug('Failed to initialize user:', error);
                        // Cleanup the database entry if initialization fails
                        await this.#deleteUser(id);
                        reject(error);
                    }
                }
            );
        });
    }

    async getUser(id) {
        // Check cache first
        if (this.users.has(id)) {
            return this.users.get(id);
        }

        // Fetch from database
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE id = ?',
                [id],
                async (err, row) => {
                    if (err) {
                        debug('Failed to fetch user:', err);
                        reject(err);
                        return;
                    }

                    if (!row) {
                        resolve(null);
                        return;
                    }

                    try {
                        const user = new User(row);
                        await user.initialize();

                        this.users.set(id, user);
                        resolve(user);
                    } catch (error) {
                        debug('Failed to initialize user:', error);
                        reject(error);
                    }
                }
            );
        });
    }

    async #updateUserHomePath(id, homePath) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET home_path = ? WHERE id = ?',
                [homePath, id],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                }
            );
        });
    }

    async #deleteUser(id) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM users WHERE id = ?',
                [id],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                }
            );
        });
    }

    async #hashPassword(password) {
        const saltRounds = 10;
        return await bcrypt.hash(password, saltRounds);
    }
}
