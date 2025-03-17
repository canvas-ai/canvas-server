#!/usr/bin/env node

/**
 * Canvas Electron API Troubleshooter
 *
 * This script diagnoses and fixes common issues with Electron IPC communication.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get current file and directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration paths
const CONFIG_DIR = path.join(os.homedir(), '.canvas', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'canvas-electron.json');
const APP_DIR = path.dirname(path.dirname(__dirname));
const PRELOAD_FILE = path.join(APP_DIR, 'preload.mjs');
const MAIN_FILE = path.join(APP_DIR, 'main.mjs');
const PACKAGE_FILE = path.join(APP_DIR, 'package.json');

console.log('Canvas Electron API Troubleshooter');
console.log('=================================');

// Check preload script
console.log('\nVerifying preload script...');
if (fs.existsSync(PRELOAD_FILE)) {
  console.log(`✅ Preload script found: ${PRELOAD_FILE}`);

  // Check preload script content
  const preloadContent = fs.readFileSync(PRELOAD_FILE, 'utf8');
  if (preloadContent.includes('contextBridge.exposeInMainWorld')) {
    console.log('✅ Preload script contains contextBridge.exposeInMainWorld');
  } else {
    console.error('❌ Preload script does not contain contextBridge.exposeInMainWorld!');
    console.log('This is a critical issue - the API will not be exposed to the renderer process.');
  }

  if (preloadContent.includes('config:get-auth-token')) {
    console.log('✅ Preload script exposes auth token API');
  } else {
    console.error('❌ Preload script does not expose auth token API!');
  }
} else {
  console.error(`❌ Preload script not found: ${PRELOAD_FILE}`);
  console.log('This is a critical issue. The application cannot function without a preload script.');
}

// Check main process file
console.log('\nVerifying main process file...');
if (fs.existsSync(MAIN_FILE)) {
  console.log(`✅ Main process file found: ${MAIN_FILE}`);

  // Check main process content
  const mainContent = fs.readFileSync(MAIN_FILE, 'utf8');
  if (mainContent.includes('ipcMain.handle(\'config:get-auth-token\'')) {
    console.log('✅ Main process handles auth token requests');
  } else {
    console.error('❌ Main process does not handle auth token requests!');
  }

  if (mainContent.includes('preload: path.join(__dirname, \'preload.mjs\')')) {
    console.log('✅ Main process correctly references preload script');
  } else {
    console.error('❌ Main process may not be correctly referencing the preload script!');
  }
} else {
  console.error(`❌ Main process file not found: ${MAIN_FILE}`);
}

// Check package.json
console.log('\nVerifying package.json...');
if (fs.existsSync(PACKAGE_FILE)) {
  console.log(`✅ Package.json found: ${PACKAGE_FILE}`);

  // Check package.json content
  const packageContent = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
  if (packageContent.main === 'main.mjs') {
    console.log('✅ Package.json main entry is correct');
  } else {
    console.error(`❌ Package.json main entry is incorrect: ${packageContent.main} (should be main.mjs)`);
  }

  // Check if Electron is a dependency
  if (packageContent.dependencies && packageContent.dependencies.electron) {
    console.log(`✅ Electron dependency found: ${packageContent.dependencies.electron}`);
  } else {
    console.error('❌ Electron dependency not found in package.json!');
  }
} else {
  console.error(`❌ Package.json not found: ${PACKAGE_FILE}`);
}

// Check config file
console.log('\nVerifying configuration file...');
if (fs.existsSync(CONFIG_FILE)) {
  console.log(`✅ Config file found: ${CONFIG_FILE}`);

  try {
    const configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON.parse(configContent);

    // Check config structure
    if (config.server && config.server.auth && config.server.auth.token) {
      console.log('✅ Config has correct token structure (server.auth.token)');
      console.log(`Token length: ${config.server.auth.token.length}`);

      // Check if token looks like a JWT
      const tokenParts = config.server.auth.token.split('.');
      if (tokenParts.length === 3) {
        console.log('✅ Token appears to be a valid JWT (has 3 parts)');
      } else {
        console.error('❌ Token does not appear to be a valid JWT!');
        console.log('A valid JWT token should have 3 parts separated by dots.');
      }

      // Check if token has Bearer prefix (which it shouldn't)
      if (config.server.auth.token.startsWith('Bearer ')) {
        console.error('❌ Token has "Bearer " prefix which should NOT be included!');
        console.log('Fixing the token by removing the Bearer prefix...');

        // Fix the token by removing Bearer prefix
        config.server.auth.token = config.server.auth.token.replace('Bearer ', '');
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log('✅ Token fixed - Bearer prefix removed');
      }
    } else {
      console.error('❌ Config does not have correct token structure!');
      console.log('The token should be at config.server.auth.token');
    }
  } catch (error) {
    console.error(`❌ Error parsing config file: ${error.message}`);
  }
} else {
  console.error(`❌ Config file not found: ${CONFIG_FILE}`);
}

// Check if Electron and Canvas server are running
console.log('\nChecking running processes...');
try {
  const processes = execSync('ps aux | grep -E "electron|canvas-server" | grep -v grep').toString();
  console.log('Currently running processes:');
  console.log(processes);
} catch (error) {
  console.log('No Electron or Canvas server processes found running');
}

console.log('\nTroubleshooting completed!');
console.log('If you found issues, fix them and restart the application.');
console.log('For more help, check the README.md file in the electron directory.');
