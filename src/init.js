/**
 * Canvas server initialization script
 */

// Environment variables
import './env.js';

// Parse command-line arguments
const argv = require('minimist')(process.argv.slice(2));
if (argv.mode === 'minimal') {
    serverMode = 'minimal';
    console.log('Minimal mode enabled, user environment won\'t be initialized');
} else {
    serverMode = 'standalone';
    console.log('Standalone server mode enabled, user environment will be initialized');
}

// Canvas
import Canvas from './main';
const canvas = new Canvas({
    mode: serverMode
});

// Start the server
canvas.start();

// Event handlers
canvas.on('running', () => {
    console.log('Canvas server started successfully.');
});

canvas.on('error', (err) => {
    console.error('Canvas server failed to start.');
    console.error(err);
});
