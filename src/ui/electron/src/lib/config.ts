/**
 * Canvas Electron Renderer Configuration
 *
 * This module provides configuration access for the renderer process
 * using electron-conf.
 */
import { Conf } from 'electron-conf/renderer';

// Define the store schema type
interface StoreSchema {
  server: {
    url: string;
    auth: {
      type: string;
      token: string;
    }
  };
  expandedNodes: string[];
}

// Create a new configuration instance
const conf = new Conf<StoreSchema>();

// Default values for fallback
const DEFAULT_SERVER_URL = 'http://localhost:8001';
const DEFAULT_AUTH_TOKEN = '';
const DEFAULT_EXPANDED_NODES: string[] = [];

// To track if token has been initialized
let tokenInitialized = false;
let tokenInitializationPromise: Promise<string> | null = null;

// Cache for values
let cachedValues: Partial<StoreSchema> = {};

/**
 * Initialize the authentication token
 */
const initializeAuthToken = async (): Promise<string> => {
  if (tokenInitialized) {
    return await getAuthToken();
  }

  console.log('[Config] Initializing auth token...');
  try {
    // Get from electron-conf
    const serverObj = await conf.get('server') as StoreSchema['server'] | undefined;
    const token = serverObj?.auth?.token || '';
    console.log(`[Config] Token from store: ${token ? token.substring(0, 10) + '...' : 'empty'}`);

    // Update cache
    if (serverObj) {
      cachedValues.server = serverObj;
    }

    tokenInitialized = true;
    return token;
  } catch (error) {
    console.error('[Config] Error initializing auth token:', error);
    tokenInitialized = true;
    return DEFAULT_AUTH_TOKEN;
  }
};

// Initialize token on module load
tokenInitializationPromise = initializeAuthToken();

/**
 * Get the authentication token asynchronously
 */
const getAuthToken = async (): Promise<string> => {
  // If initializing, wait for it
  if (tokenInitializationPromise && !tokenInitialized) {
    await tokenInitializationPromise;
  }

  try {
    const serverObj = await conf.get('server') as StoreSchema['server'] | undefined;
    return serverObj?.auth?.token || DEFAULT_AUTH_TOKEN;
  } catch (err) {
    console.error('[Config] Error getting auth token:', err);
    return DEFAULT_AUTH_TOKEN;
  }
};

/**
 * Get the authentication token synchronously - not really sync in renderer, but maintains API
 */
const getAuthTokenSync = (): string => {
  if (!tokenInitialized) {
    console.warn('[Config] getAuthTokenSync called before token initialized, returning default');
    return DEFAULT_AUTH_TOKEN;
  }
  // Return from cache if available
  return cachedValues.server?.auth?.token || DEFAULT_AUTH_TOKEN;
};

/**
 * Set the authentication token
 */
const setAuthToken = async (token: string): Promise<boolean> => {
  try {
    // First get the server object to ensure we don't overwrite other settings
    const serverObj = await conf.get('server') as StoreSchema['server'] | undefined || {
      url: DEFAULT_SERVER_URL,
      auth: { type: 'token', token: '' }
    };

    // Update the token
    serverObj.auth.token = token;

    // Save back to config
    await conf.set('server', serverObj);

    // Update cache
    cachedValues.server = serverObj;

    tokenInitialized = true;
    return true;
  } catch (error) {
    console.error('[Config] Error setting auth token:', error);
    return false;
  }
};

/**
 * Get the server URL asynchronously
 */
const getServerUrl = async (): Promise<string> => {
  try {
    const serverObj = await conf.get('server') as StoreSchema['server'] | undefined;
    return serverObj?.url || DEFAULT_SERVER_URL;
  } catch (err) {
    console.error('[Config] Error getting server URL:', err);
    return DEFAULT_SERVER_URL;
  }
};

/**
 * Get the server URL synchronously - not really sync in renderer, but maintains API
 */
const getServerUrlSync = (): string => {
  // Return from cache if available
  return cachedValues.server?.url || DEFAULT_SERVER_URL;
};

/**
 * Get expanded nodes from config
 */
const getExpandedNodes = async (): Promise<string[]> => {
  try {
    const expandedNodes = await conf.get('expandedNodes') as string[] | undefined;
    return expandedNodes || DEFAULT_EXPANDED_NODES;
  } catch (err) {
    console.error('[Config] Error getting expanded nodes:', err);
    return DEFAULT_EXPANDED_NODES;
  }
};

/**
 * Save expanded nodes to config
 */
const saveExpandedNodes = async (nodeIds: string[]): Promise<boolean> => {
  try {
    await conf.set('expandedNodes', nodeIds);
    // Update cache
    cachedValues.expandedNodes = nodeIds;
    return true;
  } catch (error) {
    console.error('[Config] Error saving expanded nodes:', error);
    return false;
  }
};

/**
 * Reset configuration
 */
const resetConfig = async (): Promise<boolean> => {
  try {
    await conf.clear();
    // Reset cache
    cachedValues = {};
    tokenInitialized = false;
    tokenInitializationPromise = initializeAuthToken();
    await tokenInitializationPromise;
    return true;
  } catch (error) {
    console.error('[Config] Error resetting config:', error);
    return false;
  }
};

/**
 * Get the entire configuration
 */
const getAll = async (): Promise<Partial<StoreSchema>> => {
  try {
    const server = await conf.get('server') as StoreSchema['server'] | undefined;
    const expandedNodes = await conf.get('expandedNodes') as string[] | undefined;

    const result: Partial<StoreSchema> = {};
    if (server) result.server = server;
    if (expandedNodes) result.expandedNodes = expandedNodes;

    // Update cache
    cachedValues = result;

    return result;
  } catch (err) {
    console.error('[Config] Error getting all config:', err);
    return cachedValues;
  }
};

// Export our API
export default {
  getAuthToken,
  getAuthTokenSync,
  setAuthToken,
  getServerUrl,
  getServerUrlSync,
  resetConfig,
  getExpandedNodes,
  saveExpandedNodes,
  getAll
};

export { tokenInitializationPromise };
