import express from 'express';
import fetch from 'node-fetch';
import auth from '../../src/services/auth/lib/auth.js';
import storage from '../../src/services/auth/lib/storage.js';
import { createHash } from 'crypto';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';

// Enable debug logging
process.env.DEBUG = 'canvas:auth:*';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.set('trust proxy', true);

// Add logging middleware
app.use((req, res, next) => {
    console.log(`\nIncoming ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    next();
});

app.use('/auth', auth);

// Add a callback route
app.get('/auth/callback', (req, res) => {
    res.json({ success: true });
});

async function cleanupTestUsers() {
    console.log('\nCleaning up existing test users...');
    const keys = await storage.getKeys('user:');
    for (const key of keys) {
        const user = await storage.getItem(key);
        if (user.email === 'test@example.com') {
            await storage.removeItem(key);
            console.log(`Removed test user: ${key}`);
        }
    }
}

async function testAuth() {
    console.log('Starting authentication tests...');

    try {
        // Clean up any existing test users
        await cleanupTestUsers();

        // Test user creation directly in storage
        console.log('\nTesting user creation...');
        const userId = crypto.randomUUID();
        const password = 'testpass123';
        const hashedPassword = createHash('sha256').update(password).digest('hex');
        console.log('Generated password hash:', hashedPassword);

        const userData = {
            id: userId,
            email: 'test@example.com',
            password: hashedPassword,
            name: 'Test User',
            userType: 'user',
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await storage.setItem(`user:${userId}`, userData);
        console.log('User created:', userData);

        // Test user retrieval
        console.log('\nTesting user retrieval...');
        const foundUser = await storage.getItem(`user:${userId}`);
        console.log('Found user:', foundUser);

        // List all users in storage for debugging
        console.log('\nListing all users in storage:');
        const keys = await storage.getKeys('user:');
        for (const key of keys) {
            const user = await storage.getItem(key);
            console.log(`User ${key}:`, user);
        }

        // Get CSRF token
        console.log('\nGetting CSRF token...');
        const csrfResponse = await fetch('http://localhost:8001/auth/csrf');
        const cookies = csrfResponse.headers.get('set-cookie');
        const { csrfToken } = await csrfResponse.json();
        console.log('CSRF token:', csrfToken);
        console.log('Cookies:', cookies);

        // Test authentication
        console.log('\nTesting authentication...');
        const authData = {
            email: 'test@example.com',
            password: password, // Use unhashed password for auth
            csrfToken,
            json: true,
            callbackUrl: 'http://localhost:8001/auth/callback'
        };
        console.log('Auth request data:', authData);

        const response = await fetch('http://localhost:8001/auth/signin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies,
                'Accept': 'application/json'
            },
            body: JSON.stringify(authData)
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers.raw());

        const responseText = await response.text();
        console.log('Response text:', responseText);

        const authResult = JSON.parse(responseText);
        console.log('Auth result:', authResult);

        if (response.status !== 200) {
            throw new Error(`Authentication failed with status ${response.status}: ${authResult.error}`);
        }

        // Test session
        console.log('\nTesting session...');
        const sessionResponse = await fetch('http://localhost:8001/auth/session', {
            headers: {
                'Cookie': response.headers.get('set-cookie'),
                'Accept': 'application/json'
            }
        });
        const session = await sessionResponse.json();
        console.log('Session:', session);

        // Test signout
        console.log('\nTesting signout...');
        const signoutResponse = await fetch('http://localhost:8001/auth/signout', {
            method: 'POST',
            headers: {
                'Cookie': response.headers.get('set-cookie'),
                'Accept': 'application/json'
            }
        });
        const signoutResult = await signoutResponse.json();
        console.log('Signout result:', signoutResult);

        // Cleanup
        console.log('\nCleaning up...');
        await cleanupTestUsers();
        console.log('Cleanup completed');

        console.log('\nAll tests completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        // Ensure cleanup even on failure
        await cleanupTestUsers();
        process.exit(1);
    }
}

// Start the server and run tests
const server = app.listen(8001, () => {
    console.log('Test server running on port 8001');
    testAuth();
});

// Handle server errors
server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
});

// Handle process termination
process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
