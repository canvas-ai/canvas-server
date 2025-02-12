// Utils
import EventEmitter from 'eventemitter2';
import debugMessage from 'debug';
const debug = debugMessage('canvas:user-manager');

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
        // Create user in SQLite
        const id = crypto.randomUUID();
        const passwordHash = await this.hashPassword(password);
        
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
                [id, email, passwordHash],
                async (err) => {
                    if (err) {
                        debug('Failed to create user:', err);
                        reject(err);
                        return;
                    }

                    const user = new User({ id, email });
                    await user.initialize();
                    
                    this.users.set(id, user);
                    this.emit('user:created', user);
                    
                    resolve(user);
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

                    const user = new User(row);
                    await user.initialize();
                    
                    this.users.set(id, user);
                    resolve(user);
                }
            );
        });
    }

    // Additional methods...
}