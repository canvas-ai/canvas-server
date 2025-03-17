import { contextBridge, ipcRenderer } from 'electron';
import { exposeConf } from 'electron-conf/preload';

// Log preload script initialization
console.log('Canvas Electron preload script initializing...');

// Expose electron-conf to the renderer process
exposeConf();

// Function to check if Electron IPC is available
const isIPCAvailable = () => {
  try {
    return !!ipcRenderer;
  } catch (e) {
    console.error('Failed to access ipcRenderer:', e);
    return false;
  }
};

// Function to create a safe IPC handler
const createSafeIPCHandler = (channel) => {
  return async (...args) => {
    try {
      if (!isIPCAvailable()) {
        console.error(`IPC not available for channel: ${channel}`);
        return null;
      }
      return await ipcRenderer.invoke(channel, ...args);
    } catch (error) {
      console.error(`Error in IPC channel ${channel}:`, error);
      return null;
    }
  };
};

// Try to expose the API with error handling
try {
  // Expose IPC handlers to the renderer process
  contextBridge.exposeInMainWorld('electronAPI', {
    // Configuration API
    config: {
      getAll: createSafeIPCHandler('config:get-all'),
      getServerUrl: createSafeIPCHandler('config:get-server-url'),
      getAuthToken: createSafeIPCHandler('config:get-auth-token'),
      setAuthToken: createSafeIPCHandler('config:set-auth-token'),
      getClientContext: createSafeIPCHandler('config:get-client-context'),
      getExpandedNodes: createSafeIPCHandler('config:get-expanded-nodes'),
      saveExpandedNodes: createSafeIPCHandler('config:save-expanded-nodes'),
      getMachineId: createSafeIPCHandler('config:get-machine-id'),
      reset: createSafeIPCHandler('config:reset')
    },

    // WebSocket proxy functions
    ws: {
      connect: createSafeIPCHandler('ws:connect')
    }
  });

  console.log('Preload script has exposed electronAPI to renderer process');
} catch (error) {
  console.error('Failed to expose API to renderer process:', error);
}

// Notify when preload script is fully loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload script: DOM is ready, electronAPI should be available');
});

console.log('Preload script initialization complete');
