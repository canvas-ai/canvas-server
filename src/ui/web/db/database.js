// src/ui/web/db/database.js
import env from '../../../env.js';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import bcrypt from 'bcrypt';

const dbPath = path.join(env.CANVAS_SERVER_DB, 'server.sqlite');

let db;

export async function initializeDatabase() {
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Create tables if they don't exist
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS access_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS sessions (
            sid TEXT PRIMARY KEY,
            sess TEXT NOT NULL,
            expired DATETIME NOT NULL
        );
    `);

    // Create indexes for better performance
    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_expired
        ON sessions(expired);

        CREATE INDEX IF NOT EXISTS idx_access_tokens_user_id
        ON access_tokens(user_id);
    `);
}

export async function createUser(email, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return db.run(
        'INSERT INTO users (email, password) VALUES (?, ?)',
        [email, hashedPassword]
    );
}

export async function findUserByEmail(email) {
    return db.get('SELECT * FROM users WHERE email = ?', [email]);
}

export async function createAccessToken(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.run(
        'INSERT INTO access_tokens (user_id, token) VALUES (?, ?)',
        [userId, token]
    );
    return token;
}

export async function getUserTokens(userId) {
    return db.all(
        'SELECT token, created_at FROM access_tokens WHERE user_id = ?',
        [userId]
    );
}

export async function revokeToken(token, userId) {
    return db.run(
        'DELETE FROM access_tokens WHERE token = ? AND user_id = ?',
        [token, userId]
    );
}

export function getDatabase() {
    return db;
}

// Export the database path for session store configuration
export const DATABASE_PATH = dbPath;