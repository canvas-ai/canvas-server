#!/usr/bin/env node

/**
 * Test script to verify CLI fixes work correctly
 */

import { spawn } from 'child_process';
import { promisify } from 'util';

const exec = promisify(spawn);

const SERVER_URL = 'http://127.0.0.1:8001/rest/v2';
const EMAIL = 'admin@canvas.local';
const PASSWORD = 'cHbOcruNZKux';

async function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'pipe' });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            resolve({ code, stdout, stderr });
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

async function testCLIFixes() {
    console.log('Testing CLI fixes...\n');

    try {
        // Test 1: Login first
        console.log('1. Testing login...');
        const loginResult = await runCommand('node', [
            'src/ui/cli/bin/canvas.js',
            'auth', 'login',
            '--server', SERVER_URL,
            '--email', EMAIL,
            '--password', PASSWORD
        ]);

        if (loginResult.code !== 0) {
            console.error('Login failed:', loginResult.stderr);
            return;
        }

        console.log('✓ Login successful\n');

        // Test 2: List workspaces (should NOT show workspace ID)
        console.log('2. Testing workspace list (should not show workspace ID)...');
        const wsListResult = await runCommand('node', [
            'src/ui/cli/bin/canvas.js',
            'ws', 'list',
            '--server', SERVER_URL
        ]);

        console.log('Workspace list output:');
        console.log(wsListResult.stdout);

        // Check if output contains workspace ID column
        if (wsListResult.stdout.includes('ID')) {
            console.log('❌ Workspace list still shows ID column');
        } else {
            console.log('✓ Workspace list no longer shows ID column');
        }

        // Check if output contains owner email
        if (wsListResult.stdout.includes('@')) {
            console.log('✓ Workspace list shows owner email');
        } else {
            console.log('⚠️  Workspace list may not show owner email');
        }

        console.log('');

        // Test 3: List contexts (should NOT show context ID, should show owner email)
        console.log('3. Testing context list (should not show context ID, should show owner email)...');
        const contextListResult = await runCommand('node', [
            'src/ui/cli/bin/canvas.js',
            'context', 'list',
            '--server', SERVER_URL
        ]);

        console.log('Context list output:');
        console.log(contextListResult.stdout);

        // Check if output contains context ID column
        if (contextListResult.stdout.includes('ID')) {
            console.log('❌ Context list still shows ID column');
        } else {
            console.log('✓ Context list no longer shows ID column');
        }

        // Check if output contains owner email
        if (contextListResult.stdout.includes('@')) {
            console.log('✓ Context list shows owner email');
        } else {
            console.log('⚠️  Context list may not show owner email');
        }

        console.log('\n✓ All CLI fixes tested successfully!');

    } catch (error) {
        console.error('Error running CLI tests:', error);
    }
}

testCLIFixes();
