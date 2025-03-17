export const API_BASE_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:8001'  // Development server port
  : 'http://localhost:8001'; // Production URL when deployed

export const API_ENDPOINTS = {
  workspaceTree: (workspaceId: string) => `${API_BASE_URL}/rest/v2/workspaces/${workspaceId}/tree`,
  contexts: (contextId: string) => `${API_BASE_URL}/rest/v2/contexts/${contextId}`,
  documents: (contextId: string) => `${API_BASE_URL}/rest/v2/contexts/${contextId}/documents`,
};

export const getAuthHeaders = () => ({
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU2YjgwZGU3LThkNjEtNGY2My1iMjU5LTlhOGRiMmY3MzlhZiIsImVtYWlsIjoibmV3dXNlckB0ZXN0LmNvbSIsInNlc3Npb25JZCI6IjhlYjdlZmQ1LTNhOWMtNDQwMC04MDQyLTc3OTk2MGE3ZjNkOCIsImlhdCI6MTc0MTY5NjA4MiwiZXhwIjoxNzQyMzAwODgyfQ.AMDZml1OFbHOmk1dIUgvnaWiD8TqjYb2Y-Wg2NeQUPY',
  'Content-Type': 'application/json',
});
