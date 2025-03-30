import appConfig from './lib/config';
import { tokenInitializationPromise } from './lib/config';

// Now an async function
export const getApiBaseUrl = async () => await appConfig.getServerUrl();

// Define API endpoints with synchronous versions for immediate use
export const API_ENDPOINTS = {
  // Workspace endpoints
  workspaceTree: (workspaceId: string) => `${appConfig.getServerUrlSync()}/rest/v2/workspaces/${workspaceId}/tree`,
  workspacePath: (workspaceId: string) => `${appConfig.getServerUrlSync()}/rest/v2/workspaces/${workspaceId}/tree/path`,

  // Context endpoints
  contexts: (contextId: string) => `${appConfig.getServerUrlSync()}/rest/v2/contexts/${contextId}`,
  contextsList: () => `${appConfig.getServerUrlSync()}/rest/v2/contexts`,

  // Layer endpoints
  layers: () => `${appConfig.getServerUrlSync()}/rest/v2/layers`,
  layer: (layerId: string) => `${appConfig.getServerUrlSync()}/rest/v2/layers/${layerId}`,

  // Document endpoints
  documents: (contextId: string) => `${appConfig.getServerUrlSync()}/rest/v2/contexts/${contextId}/documents`,
  document: (contextId: string, documentId: string) => `${appConfig.getServerUrlSync()}/rest/v2/contexts/${contextId}/documents/${documentId}`,

  // Canvas endpoints
  canvases: () => `${appConfig.getServerUrlSync()}/rest/v2/canvases`,
  canvas: (canvasId: string) => `${appConfig.getServerUrlSync()}/rest/v2/canvases/${canvasId}`,
};

// Create a fallback synchronous version using the same URLs but with the default server URL
export const SYNC_API_ENDPOINTS = {
  // Workspace endpoints
  workspaceTree: (workspaceId: string) => `http://localhost:8001/rest/v2/workspaces/${workspaceId}/tree`,
  workspacePath: (workspaceId: string) => `http://localhost:8001/rest/v2/workspaces/${workspaceId}/tree/path`,

  // Context endpoints
  contexts: (contextId: string) => `http://localhost:8001/rest/v2/contexts/${contextId}`,
  contextsList: () => `http://localhost:8001/rest/v2/contexts`,

  // Layer endpoints
  layers: () => `http://localhost:8001/rest/v2/layers`,
  layer: (layerId: string) => `http://localhost:8001/rest/v2/layers/${layerId}`,

  // Document endpoints
  documents: (contextId: string) => `http://localhost:8001/rest/v2/contexts/${contextId}/documents`,
  document: (contextId: string, documentId: string) => `http://localhost:8001/rest/v2/contexts/${contextId}/documents/${documentId}`,

  // Canvas endpoints
  canvases: () => `http://localhost:8001/rest/v2/canvases`,
  canvas: (canvasId: string) => `http://localhost:8001/rest/v2/canvases/${canvasId}`,
};

// Wait for token initialization to complete
(async () => {
  if (tokenInitializationPromise) {
    try {
      await tokenInitializationPromise;
      console.log('Auth token initialization completed for API calls');
    } catch (error) {
      console.error('Error waiting for token initialization:', error);
    }
  }
})();

// Async function to get auth headers
export const getAuthHeadersAsync = async () => {
  // Wait for token initialization if it's still in progress
  if (tokenInitializationPromise) {
    await tokenInitializationPromise;
  }

  const token = await appConfig.getAuthToken();
  console.log('Using auth token for API call:', token ? `${token.substring(0, 15)}...` : 'none');

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

// Synchronous version for compatibility - will use cached token if available
export const getAuthHeaders = () => {
  const token = appConfig.getAuthTokenSync();
  console.log('Using auth token for API call (sync):', token ? `${token.substring(0, 15)}...` : 'none');

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};
