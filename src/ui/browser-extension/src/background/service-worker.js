// Canvas Browser Extension Service Worker
// Handles background operations, API communication, and tab synchronization

import { browserStorage } from './modules/browser-storage.js';
import { apiClient } from './modules/api-client.js';
import { webSocketClient } from './modules/websocket-client.js';
import { tabManager } from './modules/tab-manager.js';
import { syncEngine } from './modules/sync-engine.js';

console.log('Canvas Extension Service Worker loaded');

// Service worker installation and activation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);

  // Open settings page on first install
  if (details.reason === 'install') {
    await openSettingsPage();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser startup - initializing Canvas Extension');
  await initializeExtension();
});

// Initialize extension on service worker startup
async function initializeExtension() {
  try {
    console.log('Initializing Canvas Extension...');

        // Load connection settings
    const connectionSettings = await browserStorage.getConnectionSettings();
    console.log('Service Worker Init: Loaded connection settings:', connectionSettings);

    // Check if we have actual saved settings vs defaults
    if (connectionSettings && connectionSettings.apiToken) {
      console.log('Service Worker Init: Found saved API token, extension was previously configured');
    } else {
      console.log('Service Worker Init: No API token found, extension needs configuration');
    }

    // Initialize API client if we have settings
    if (connectionSettings.serverUrl && connectionSettings.apiBasePath) {
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken || ''
      );

      // Test connection if we're supposed to be connected
      if (connectionSettings.connected && connectionSettings.apiToken) {
        console.log('Testing saved connection...');
        const testResult = await apiClient.testConnection();
        if (!testResult.success || !testResult.authenticated) {
          console.warn('Saved connection failed, marking as disconnected');
          await browserStorage.setConnectionSettings({ connected: false });
        } else {
          console.log('Saved connection is valid');
        }
      }
    }

    // Generate browser identity if not set
    const browserIdentity = await browserStorage.getBrowserIdentity();
    console.log('Browser identity:', browserIdentity);

    console.log('Canvas Extension initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Canvas Extension:', error);
  }
}

// Initialize on service worker startup
initializeExtension();

// Tab event listeners for synchronization
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log('Tab created:', tab.id, tab.url);
  // Handle new tab creation
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Tab updated:', tabId, tab.url);
    // Handle tab updates when fully loaded
  }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log('Tab removed:', tabId);
  // Handle tab removal
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('Tab activated:', activeInfo.tabId);
  // Handle tab activation
});

// Window event listeners
chrome.windows.onCreated.addListener(async (window) => {
  console.log('Window created:', window.id);
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  console.log('Window removed:', windowId);
});

// Message handling for popup/settings communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message.type, message);

  switch (message.type) {
    case 'GET_CONNECTION_STATUS':
      // Return current connection status from storage
      handleGetConnectionStatus(sendResponse);
      return true;

    case 'TEST_CONNECTION':
      // Test connection to Canvas server
      handleTestConnection(message.data, sendResponse);
      return true; // Keep message channel open for async response

    case 'CONNECT':
      // Connect to Canvas server
      handleConnect(message.data, sendResponse);
      return true;

    case 'DISCONNECT':
      // Disconnect from Canvas server
      handleDisconnect(sendResponse);
      return true;

    case 'GET_CONTEXTS':
      // Get available contexts from Canvas server
      handleGetContexts(sendResponse);
      return true;

    case 'BIND_CONTEXT':
      // Bind to a specific context
      handleBindContext(message.data, sendResponse);
      return true;

    case 'SAVE_SETTINGS':
      // Save all extension settings
      handleSaveSettings(message.data, sendResponse);
      return true;

    case 'GET_TABS':
      // Get browser tabs or canvas tabs
      handleGetTabs(message.data, sendResponse);
      return true;

    case 'GET_CANVAS_DOCUMENTS':
      // Get Canvas documents for current context
      handleGetCanvasDocuments(message.data, sendResponse);
      return true;

    case 'SYNC_TAB':
      // Sync a single tab to Canvas
      handleSyncTab(message.data, sendResponse);
      return true;

    case 'SYNC_MULTIPLE_TABS':
      // Sync multiple tabs to Canvas
      handleSyncMultipleTabs(message.data, sendResponse);
      return true;

    case 'OPEN_CANVAS_DOCUMENT':
      // Open Canvas document as browser tab
      handleOpenCanvasDocument(message.data, sendResponse);
      return true;

    case 'REMOVE_CANVAS_DOCUMENT':
      // Remove Canvas document
      handleRemoveCanvasDocument(message.data, sendResponse);
      return true;

    case 'CLOSE_TAB':
      // Close browser tab
      handleCloseTab(message.data, sendResponse);
      return true;

    case 'OPEN_TAB':
      // Open a Canvas tab in browser
      handleOpenTab(message.data, sendResponse);
      return true;

    case 'REMOVE_FROM_CONTEXT':
      // Remove tab from context
      handleRemoveFromContext(message.data, sendResponse);
      return true;

    case 'DELETE_FROM_DATABASE':
      // Delete tab from database completely
      handleDeleteFromDatabase(message.data, sendResponse);
      return true;

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }
});

// Helper Functions

async function openSettingsPage() {
  const url = chrome.runtime.getURL('settings/settings.html');
  await chrome.tabs.create({ url });
}

async function handleGetConnectionStatus(sendResponse) {
  try {
    console.log('Getting connection status from storage...');

    // Get connection settings and current context
    const connectionSettings = await browserStorage.getConnectionSettings();
    const currentContext = await browserStorage.getCurrentContext();

    console.log('Connection settings:', connectionSettings);
    console.log('Current context:', currentContext);

    sendResponse({
      connected: connectionSettings.connected || false,
      context: currentContext,
      settings: connectionSettings
    });
  } catch (error) {
    console.error('Failed to get connection status:', error);
    sendResponse({
      connected: false,
      context: null,
      error: error.message
    });
  }
}

async function handleTestConnection(data, sendResponse) {
  try {
    console.log('Testing connection with data:', data);

    // Initialize API client with provided settings
    if (data.serverUrl && data.apiBasePath) {
      apiClient.initialize(data.serverUrl, data.apiBasePath, data.apiToken || '');
    }

    // Test the connection
    const result = await apiClient.testConnection();

    console.log('Connection test result:', result);
    sendResponse(result);
  } catch (error) {
    console.error('Connection test failed:', error);
    sendResponse({
      success: false,
      connected: false,
      authenticated: false,
      error: error.message,
      message: 'Connection test failed'
    });
  }
}

async function handleConnect(data, sendResponse) {
  try {
    console.log('Connecting with data:', data);

    // Validate required fields
    if (!data.serverUrl || !data.apiBasePath || !data.apiToken) {
      throw new Error('Missing required connection parameters');
    }

    // Initialize API client
    apiClient.initialize(data.serverUrl, data.apiBasePath, data.apiToken);

    // Test the connection first
    const testResult = await apiClient.testConnection();
    if (!testResult.success || !testResult.authenticated) {
      throw new Error(testResult.message || 'Connection test failed');
    }

    // Save connection settings to storage
    const connectionSettings = {
      serverUrl: data.serverUrl,
      apiBasePath: data.apiBasePath,
      apiToken: data.apiToken,
      connected: true
    };

    console.log('Saving connection settings:', connectionSettings);
    await browserStorage.setConnectionSettings(connectionSettings);

    // Verify settings were saved
    const savedSettings = await browserStorage.getConnectionSettings();
    console.log('Verified saved settings:', savedSettings);

    // Save browser identity if provided
    if (data.browserIdentity) {
      await browserStorage.set(browserStorage.KEYS.BROWSER_IDENTITY, data.browserIdentity);
    }

    console.log('Connection saved successfully');

    sendResponse({
      success: true,
      connected: true,
      authenticated: true,
      user: testResult.user,
      message: 'Connected and settings saved successfully'
    });
  } catch (error) {
    console.error('Connection failed:', error);

    // Make sure we clear any connected state on failure
      await browserStorage.setConnectionSettings({
      serverUrl: 'http://127.0.0.1:8001',
      apiBasePath: '/rest/v2',
      apiToken: '',
      connected: false
    });

    sendResponse({
      success: false,
      connected: false,
      authenticated: false,
      error: error.message,
      message: 'Connection failed'
    });
  }
}

async function handleDisconnect(sendResponse) {
  try {
    console.log('Disconnecting from Canvas server...');

    // Clear connection settings
    await browserStorage.setConnectionSettings({
      serverUrl: 'http://127.0.0.1:8001',
      apiBasePath: '/rest/v2',
      apiToken: '',
      connected: false
    });

    // Clear current context
    await browserStorage.setCurrentContext(null);

    // Disconnect WebSocket if connected
    if (webSocketClient.isConnected()) {
      webSocketClient.disconnect();
    }

    // Clear API client
    apiClient.connected = false;

    console.log('Disconnected successfully');

    sendResponse({
      success: true,
      connected: false,
      message: 'Disconnected successfully'
    });
  } catch (error) {
    console.error('Disconnection failed:', error);
    sendResponse({
      success: false,
      error: error.message,
      message: 'Disconnection failed'
    });
  }
}

async function handleGetContexts(sendResponse) {
  try {
    console.log('Getting available contexts from Canvas server...');

    // Check if API client is initialized and has a token
    if (!apiClient.apiToken) {
      // Try to load from storage if API client isn't initialized
      const connectionSettings = await browserStorage.getConnectionSettings();
      if (!connectionSettings.apiToken) {
        throw new Error('No API token available - please connect first');
      }

      // Initialize API client with stored settings
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    console.log('API client initialized, fetching contexts...');

    // Fetch contexts from Canvas server
    const response = await apiClient.getContexts();

    console.log('Contexts response:', response);

    if (response.status === 'success') {
      sendResponse({
        success: true,
        contexts: response.payload || [],
        count: response.count || 0
      });
    } else {
      throw new Error(response.message || 'Failed to fetch contexts');
    }
  } catch (error) {
    console.error('Failed to get contexts:', error);
    sendResponse({
      success: false,
      contexts: [],
      error: error.message
    });
  }
}

async function handleGetTabs(data, sendResponse) {
  try {
    console.log('Getting tabs with type:', data?.type);

    if (data?.type === 'browser') {
      // Get browser tabs that should be synced
      const tabs = await tabManager.getSyncableTabs();
      console.log('Syncable browser tabs:', tabs.length);

      sendResponse({
        success: true,
        tabs: tabs,
        type: 'browser'
      });
    } else if (data?.type === 'canvas') {
      // Get Canvas context tabs - TODO: implement when we have context binding
      console.log('Canvas tabs not implemented yet');
      sendResponse({
        success: true,
        tabs: [],
        type: 'canvas'
      });
    } else {
      throw new Error('Invalid tab type requested');
    }
  } catch (error) {
    console.error('Failed to get tabs:', error);
    sendResponse({
      success: false,
      tabs: [],
      error: error.message
    });
  }
}



async function handleOpenTab(data, sendResponse) {
  try {
    // TODO: Implement tab opening
    sendResponse({ success: true, message: 'Tab opened successfully' });
  } catch (error) {
    console.error('Failed to open tab:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleCloseTab(data, sendResponse) {
  try {
    const { tabId } = data;

    if (!tabId) {
      throw new Error('Tab ID is required');
    }

    console.log('Closing tab:', tabId);

    // Close the tab using Chrome API
    const result = await tabManager.closeTab(tabId);

    if (result) {
      console.log('Tab closed successfully:', tabId);
      sendResponse({
        success: true,
        message: 'Tab closed successfully'
      });
    } else {
      throw new Error('Failed to close tab');
    }
  } catch (error) {
    console.error('Failed to close tab:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleRemoveFromContext(data, sendResponse) {
  try {
    // TODO: Implement context removal
    sendResponse({ success: true, message: 'Tab removed from context' });
  } catch (error) {
    console.error('Failed to remove from context:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleDeleteFromDatabase(data, sendResponse) {
  try {
    // TODO: Implement database deletion
    sendResponse({ success: true, message: 'Tab deleted from database' });
  } catch (error) {
    console.error('Failed to delete from database:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// New Tab Management Handlers

async function handleBindContext(data, sendResponse) {
  try {
    const { context } = data;

    if (!context || !context.id) {
      throw new Error('Valid context is required');
    }

    console.log('Binding to context:', context);

    // Save context to storage
    await browserStorage.setCurrentContext(context);

    console.log('Context bound successfully:', context.id);

    sendResponse({
      success: true,
      context: context,
      message: `Bound to context: ${context.id}`
    });
  } catch (error) {
    console.error('Failed to bind context:', error);
    sendResponse({
      success: false,
      error: error.message,
      message: 'Failed to bind context'
    });
  }
}

async function handleSaveSettings(data, sendResponse) {
  try {
    console.log('Saving all extension settings:', data);

    // Save connection settings
    if (data.connectionSettings) {
      await browserStorage.setConnectionSettings(data.connectionSettings);
      console.log('Connection settings saved');
    }

    // Save sync settings
    if (data.syncSettings) {
      await browserStorage.setSyncSettings(data.syncSettings);
      console.log('Sync settings saved');
    }

    // Save browser identity
    if (data.browserIdentity) {
      await browserStorage.set(browserStorage.KEYS.BROWSER_IDENTITY, data.browserIdentity);
      console.log('Browser identity saved');
    }

    // Verify all settings were saved correctly
    const verifyConnection = await browserStorage.getConnectionSettings();
    const verifySync = await browserStorage.getSyncSettings();
    const verifyIdentity = await browserStorage.getBrowserIdentity();
    const verifyContext = await browserStorage.getCurrentContext();

    console.log('Settings verification:', {
      connection: verifyConnection,
      sync: verifySync,
      identity: verifyIdentity,
      context: verifyContext
    });

    sendResponse({
      success: true,
      message: 'All settings saved successfully',
      savedSettings: {
        connection: verifyConnection,
        sync: verifySync,
        identity: verifyIdentity,
        context: verifyContext
      }
    });
  } catch (error) {
    console.error('Failed to save settings:', error);
    sendResponse({
      success: false,
      error: error.message,
      message: 'Failed to save settings'
    });
  }
}

async function handleGetCanvasDocuments(data, sendResponse) {
  try {
    console.log('Getting Canvas documents for context:', data?.contextId);

    // Get current context if not provided
    let contextId = data?.contextId;
    if (!contextId) {
      const currentContext = await browserStorage.getCurrentContext();
      if (!currentContext?.id) {
        throw new Error('No context selected');
      }
      contextId = currentContext.id;
    }

    // Get connection settings
    const connectionSettings = await browserStorage.getConnectionSettings();
    console.log('Canvas Documents: connection settings check:', connectionSettings);

    // Check if we have essential connection info (prioritize API token over connected flag)
    if (!connectionSettings.apiToken || !connectionSettings.serverUrl) {
      console.error('Canvas Documents: Missing API token or server URL');
      throw new Error('Not connected to Canvas server - missing credentials');
    }

    if (!connectionSettings.connected) {
      console.warn('Canvas Documents: Connected flag is false, but we have API token - attempting operation');
    }

    // Initialize API client if needed
    if (!apiClient.apiToken) {
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    // Fetch Canvas documents with tab schema filter
    const featureArray = ['data/abstraction/tab'];
    const response = await apiClient.getContextDocuments(contextId, featureArray);

    if (response.status === 'success') {
      sendResponse({
        success: true,
        documents: response.payload || [],
        count: response.count || 0
      });
    } else {
      throw new Error(response.message || 'Failed to fetch Canvas documents');
    }
  } catch (error) {
    console.error('Failed to get Canvas documents:', error);
    sendResponse({
      success: false,
      documents: [],
      error: error.message
    });
  }
}

async function handleSyncTab(data, sendResponse) {
  try {
    const { tabId, contextId } = data;

    if (!tabId) {
      throw new Error('Tab ID is required');
    }

    // Get the tab
    const tab = await tabManager.getTab(tabId);
    if (!tab) {
      throw new Error('Tab not found');
    }

        // Get current context if not provided
    let targetContextId = contextId;
    if (!targetContextId) {
      const currentContext = await browserStorage.getCurrentContext();
      if (!currentContext?.id) {
        throw new Error('No context selected');
      }
      targetContextId = currentContext.id;
    }

    // Get connection settings
    const connectionSettings = await browserStorage.getConnectionSettings();
    console.log('Sync Tab: connection settings check:', connectionSettings);

    // Check if we have essential connection info (prioritize API token over connected flag)
    if (!connectionSettings.apiToken || !connectionSettings.serverUrl) {
      console.error('Sync Tab: Missing API token or server URL');
      throw new Error('Not connected to Canvas server - missing credentials');
    }

    if (!connectionSettings.connected) {
      console.warn('Sync Tab: Connected flag is false, but we have API token - attempting operation');
    }

    // Get browser identity
    const browserIdentity = await browserStorage.getBrowserIdentity();

    // Initialize API client if needed
    if (!apiClient.apiToken) {
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    // Sync the tab
    const result = await tabManager.syncTabToCanvas(tab, apiClient, targetContextId, browserIdentity);

    sendResponse(result);
  } catch (error) {
    console.error('Failed to sync tab:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleSyncMultipleTabs(data, sendResponse) {
  try {
    const { tabIds, contextId } = data;

    if (!tabIds || !Array.isArray(tabIds)) {
      throw new Error('Tab IDs array is required');
    }

    // Get the tabs
    const tabs = [];
    for (const tabId of tabIds) {
      const tab = await tabManager.getTab(tabId);
      if (tab) {
        tabs.push(tab);
      }
    }

    if (tabs.length === 0) {
      throw new Error('No valid tabs found');
    }

    // Get current context if not provided
    let targetContextId = contextId;
    if (!targetContextId) {
      const currentContext = await browserStorage.getCurrentContext();
      if (!currentContext?.id) {
        throw new Error('No context selected');
      }
      targetContextId = currentContext.id;
    }

    // Get connection settings
    const connectionSettings = await browserStorage.getConnectionSettings();
    if (!connectionSettings.connected || !connectionSettings.apiToken) {
      throw new Error('Not connected to Canvas server');
    }

    // Get browser identity
    const browserIdentity = await browserStorage.getBrowserIdentity();

    // Initialize API client if needed
    if (!apiClient.apiToken) {
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    // Sync multiple tabs
    const result = await tabManager.syncMultipleTabs(tabs, apiClient, targetContextId, browserIdentity);

    sendResponse(result);
  } catch (error) {
    console.error('Failed to sync multiple tabs:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleOpenCanvasDocument(data, sendResponse) {
  try {
    const { document, options = {} } = data;

    if (!document) {
      throw new Error('Canvas document is required');
    }

    // Open the Canvas document as a browser tab
    const result = await tabManager.openCanvasDocument(document, options);

    sendResponse(result);
  } catch (error) {
    console.error('Failed to open Canvas document:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleRemoveCanvasDocument(data, sendResponse) {
  try {
    const { document, contextId, closeTab = false } = data;

    if (!document) {
      throw new Error('Canvas document is required');
    }

    // Get current context if not provided
    let targetContextId = contextId;
    if (!targetContextId) {
      const currentContext = await browserStorage.getCurrentContext();
      if (!currentContext?.id) {
        throw new Error('No context selected');
      }
      targetContextId = currentContext.id;
    }

    // Get connection settings
    const connectionSettings = await browserStorage.getConnectionSettings();
    if (!connectionSettings.connected || !connectionSettings.apiToken) {
      throw new Error('Not connected to Canvas server');
    }

    // Initialize API client if needed
    if (!apiClient.apiToken) {
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    // Remove the Canvas document
    const result = await tabManager.removeCanvasDocument(document, apiClient, targetContextId, closeTab);

    sendResponse(result);
  } catch (error) {
    console.error('Failed to remove Canvas document:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}
