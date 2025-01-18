// src/ui/web/server.js
import express from 'express';
import passport from 'passport';
import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { setupPassport } from './auth/passport-config.js';
import { initializeDatabase, DATABASE_PATH } from './db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SessionStore = SQLiteStore(session);

const app = express();

// Initialize database first
await initializeDatabase();

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration using the same database
app.use(session({
    store: new SessionStore({
        db: 'canvas.db',
        dir: path.dirname(DATABASE_PATH),
        table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Routes
app.use('/auth', authRouter);
app.use('/dashboard', dashboardRouter);

// Initialize passport
setupPassport();

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});