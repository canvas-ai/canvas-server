#!/usr/bin/env node

/**
 * Test script to verify CLI integration with the new REST API
 *
 * Usage: node test-cli-integration.js
 *
 * This script tests the updated CLI against the new REST API structure
 * using the provided test credentials.
 */

import { execSync } from 'child_process';
import chalk from 'chalk';

// Test configuration
const CONFIG = {
    server: 'http://127.0.0.1:8001/rest/v2',
    email: 'admin@canvas.local',
    password: 'cHbOcruNZKux',
    token: 'canvas-a0ca1d5ce7da0235808d6b2d3e0a3530103c433e02b3d0f3'
};

// Helper function to run CLI commands
function runCLI(command, expectSuccess = true) {
    console.log(chalk.cyan(`\n► Running: canvas ${command}`));

    try {
        const result = execSync(`node src/ui/cli/src/index.js ${command}`, {
            encoding: 'utf8',
            cwd: process.cwd(),
            stdio: 'pipe'
        });

        if (expectSuccess) {
            console.log(chalk.green('✓ Success'));
            console.log(result);
        }

        return { success: true, output: result };
    } catch (error) {
        if (expectSuccess) {
            console.log(chalk.red('✗ Failed'));
            console.log(error.stdout || error.message);
        }

        return { success: false, output: error.stdout || error.message };
    }
}

async function main() {
    console.log(chalk.bold.blue('🧪 Testing CLI Integration with New REST API\n'));

    // Step 1: Configure CLI
    console.log(chalk.yellow('Step 1: Configuring CLI'));
    runCLI(`config set server.url ${CONFIG.server}`);

    // Step 2: Test ping
    console.log(chalk.yellow('\nStep 2: Testing server connectivity'));
    runCLI('config set server.auth.token ""'); // Clear token first

    // Step 3: Test authentication
    console.log(chalk.yellow('\nStep 3: Testing authentication'));

    // Test login
    runCLI(`auth login ${CONFIG.email} --password ${CONFIG.password}`);

    // Test profile
    runCLI('auth profile');

    // Test token creation
    runCLI('auth create-token "Test Token" --description "Integration test token"');

    // Test manual token setting
    runCLI(`auth set-token ${CONFIG.token}`);

    // Test auth status
    runCLI('auth status');

    // Step 4: Test workspace operations
    console.log(chalk.yellow('\nStep 4: Testing workspace operations'));

    // List workspaces
    runCLI('workspace list');

    // Show universe workspace
    runCLI('workspace show universe');

    // Get workspace status
    runCLI('workspace status universe');

    // Start workspace
    runCLI('workspace start universe');

    // List documents in workspace
    runCLI('workspace documents universe');

    // Get workspace tree
    runCLI('workspace tree universe');

    // Step 5: Test context operations
    console.log(chalk.yellow('\nStep 5: Testing context operations'));

    // List contexts
    runCLI('context list');

    // Create a test context
    runCLI('context create test-context --description "Test context for integration"');

    // Show context
    runCLI('context show test-context');

    // Switch to context
    runCLI('context switch test-context');

    // Show current context
    runCLI('context current');

    // Get context URL
    runCLI('context url test-context');

    // Get context path
    runCLI('context path test-context');

    // List documents in context
    runCLI('context documents');

    // Add a note
    runCLI('context note add "Test note for integration testing" --title "Integration Test Note"');

    // List notes
    runCLI('context notes');

    // Add a tab
    runCLI('context tab add https://example.com --title "Example Site"');

    // List tabs
    runCLI('context tabs');

    // Get context tree
    runCLI('context tree test-context');

    // Step 6: Test error handling
    console.log(chalk.yellow('\nStep 6: Testing error handling'));

    // Test non-existent context
    runCLI('context show non-existent-context', false);

    // Test invalid token
    runCLI('auth set-token invalid-token', false);

    // Step 7: Cleanup
    console.log(chalk.yellow('\nStep 7: Cleanup'));

    // Delete test context
    runCLI('context destroy test-context --force');

    console.log(chalk.bold.green('\n✅ CLI Integration Test Complete!'));
    console.log(chalk.gray('Check the output above for any failures or issues.'));
}

// Run the test
main().catch(error => {
    console.error(chalk.red('Test failed:'), error);
    process.exit(1);
});
