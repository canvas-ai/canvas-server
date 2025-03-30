import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import pkg from 'node-machine-id';
const { machineIdSync } = pkg;
import fs from 'fs';

// Import electron-conf
import { Conf, useConf } from 'electron-conf/main';

// Get dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const MACHINE_ID = machineIdSync(true);
const APP_ID = 'canvas-electron';

// Define paths for user configuration
const CANVAS_USER_HOME = os.platform() === 'win32' ?
    path.join(os.homedir(), 'Canvas') :
    path.join(os.homedir(), '.canvas');

const CANVAS_USER_CONFIG = path.join(CANVAS_USER_HOME, 'config');

// Create the config directory if it doesn't exist
try {
  if (!fs.existsSync(CANVAS_USER_HOME)) {
    fs.mkdirSync(CANVAS_USER_HOME, { recursive: true });
    console.log(`Created Canvas user home directory: ${CANVAS_USER_HOME}`);
  }

  if (!fs.existsSync(CANVAS_USER_CONFIG)) {
    fs.mkdirSync(CANVAS_USER_CONFIG, { recursive: true });
    console.log(`Created Canvas user config directory: ${CANVAS_USER_CONFIG}`);
  }
} catch (error) {
  console.error(`Error creating Canvas directories: ${error.message}`);
}

// Default configuration
const DEFAULT_CONFIG = {
  server: {
    url: 'http://localhost:8001',
    auth: {
      type: 'token',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU2YjgwZGU3LThkNjEtNGY2My1iMjU5LTlhOGRiMmY3MzlhZiIsImVtYWlsIjoibmV3dXNlckB0ZXN0LmNvbSIsInNlc3Npb25JZCI6IjhlYjdlZmQ1LTNhOWMtNDQwMC04MDQyLTc3OTk2MGE3ZjNkOCIsImlhdCI6MTc0MTY5NjA4MiwiZXhwIjoxNzQyMzAwODgyfQ.AMDZml1OFbHOmk1dIUgvnaWiD8TqjYb2Y-Wg2NeQUPY',
    },
  },
  session: {
    context: {
      id: `canvas-electron.${MACHINE_ID}`,
      clientArray: generateClientContextArray(),
    }
  },
  connectors: {
    ollama: {
      driver: 'ollama',
      host: 'http://localhost:11434',
      model: 'qwen2.5-coder:latest',
      defaultModel: 'qwen2.5-coder:latest',
    },
    docker: {
      driver: 'docker',
      host: 'unix:///var/run/docker.sock',
    },
  },
  expandedNodes: []
};

// Create config instance - don't use it until app is ready
const conf = new Conf({
  projectName: APP_ID,
  cwd: CANVAS_USER_CONFIG,
  defaults: DEFAULT_CONFIG,
});

// Initialize main window
let mainWindow;

// Create the browser window
function createWindow() {
  console.log('Creating main window...');

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  // Load the application
  if (process.env.NODE_ENV === 'development') {
    // Load from dev server in development
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools
    mainWindow.webContents.openDevTools();
  } else {
    // Load from build in production
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Log when window is ready to show
  mainWindow.once('ready-to-show', () => {
    console.log('Main window is ready to show');
  });

  // Log if window fails to load
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`Failed to load: ${errorDescription} (${errorCode})`);
  });
}

// Wait for app to be ready
app.whenReady().then(() => {
  console.log('App is ready, initializing...');

  // Register the renderer listener first
  conf.registerRendererListener();
  console.log('Renderer listener registered');

  // Now it's safe to use electron-conf as the app is ready
  useConf(conf);
  console.log('electron-conf initialized');

  // Register IPC handlers
  registerIpcHandlers();

  // Create the main window
  createWindow();

  // Standard MacOS behavior
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Handle window all closed
app.on('window-all-closed', function () {
  // Keep app running on macOS
  if (process.platform !== 'darwin') app.quit();
});

// Register IPC handlers for renderer process
function registerIpcHandlers() {
  console.log('Registering IPC handlers...');

  // Get all config
  ipcMain.handle('config:get-all', async () => {
    console.log('IPC: config:get-all');
    return conf.store;
  });

  // Get server URL
  ipcMain.handle('config:get-server-url', async () => {
    console.log('IPC: config:get-server-url');
    return conf.get('server.url');
  });

  // Get auth token
  ipcMain.handle('config:get-auth-token', async () => {
    console.log('IPC: config:get-auth-token');
    const token = conf.get('server.auth.token');
    console.log(`Token found (length: ${token ? token.length : 0})`);
    return token;
  });

  // Set auth token
  ipcMain.handle('config:set-auth-token', async (event, token) => {
    console.log(`IPC: config:set-auth-token (length: ${token ? token.length : 0})`);
    conf.set('server.auth.token', token);
    return true;
  });

  // Get expanded nodes
  ipcMain.handle('config:get-expanded-nodes', async () => {
    console.log('IPC: config:get-expanded-nodes');
    return conf.get('expandedNodes') || [];
  });

  // Save expanded nodes
  ipcMain.handle('config:save-expanded-nodes', async (event, nodes) => {
    console.log(`IPC: config:save-expanded-nodes (count: ${nodes ? nodes.length : 0})`);
    conf.set('expandedNodes', nodes);
    return true;
  });

  // Get machine ID
  ipcMain.handle('config:get-machine-id', async () => {
    console.log('IPC: config:get-machine-id');
    return MACHINE_ID;
  });

  // Reset config
  ipcMain.handle('config:reset', async () => {
    console.log('IPC: config:reset');
    conf.set(DEFAULT_CONFIG);
    return true;
  });

  // WebSocket connect
  ipcMain.handle('ws:connect', async () => {
    console.log('IPC: ws:connect');
    return true;
  });
}

/**
 * Generate client context array for the current machine
 */
function generateClientContextArray() {
  // Get network information
  let networkCidr = 'unknown';
  try {
    networkCidr = getNetworkCidr();
  } catch (error) {
    console.error('Error getting network CIDR:', error);
  }

  return [
    `client/app/${APP_ID}`,
    `client/device/${MACHINE_ID}`,
    `client/os/platform/${os.platform()}`,
    `client/os/arch/${os.arch()}`,
    `client/os/hostname/${os.hostname()}`,
    `client/os/user/${os.userInfo().username}`,
    `client/network/cidr/${networkCidr}`,
    `client/ephemeral/timezone/${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
    `client/ephemeral/datetime/${new Date().toISOString()}`
  ];
}

/**
 * Get the network CIDR for the current machine
 */
function getNetworkCidr() {
  const interfaces = os.networkInterfaces();
  for (const [name, netInterface] of Object.entries(interfaces)) {
    if (netInterface) {
      for (const iface of netInterface) {
        if (iface.family === 'IPv4' && !iface.internal && iface.cidr) {
          return iface.cidr;
        }
      }
    }
  }
  return 'unknown';
}
