/**
 * Canvas Authentication Client Example
 *
 * This script demonstrates how to authenticate with the Canvas server
 * using API tokens and the token exchange endpoint.
 */

// Import fetch if using Node.js
// const fetch = require('node-fetch');

/**
 * Canvas Auth Client
 * A simple client to handle authentication with the Canvas server.
 */
class CanvasAuthClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:8001';
    this.apiToken = options.apiToken || null;
    this.jwtToken = options.jwtToken || null;
    this.tokenExchangeEndpoint = '/rest/v2/auth/token/exchange';
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Set the API token for authentication
   * @param {string} token - API token
   */
  setApiToken(token) {
    this.apiToken = token;
  }

  /**
   * Exchange API token for a JWT token
   * @returns {Promise<Object>} - Response with JWT token
   */
  async exchangeToken() {
    if (!this.apiToken) {
      throw new Error('API token not set');
    }

    const response = await fetch(`${this.baseUrl}${this.tokenExchangeEndpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ apiToken: this.apiToken }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to exchange token');
    }

    this.jwtToken = data.payload.token;
    return data.payload;
  }

  /**
   * Get authentication headers for API requests
   * @returns {Object} - Headers object
   */
  getAuthHeaders() {
    if (this.jwtToken) {
      return { Authorization: `Bearer ${this.jwtToken}` };
    } else if (this.apiToken) {
      return { Authorization: `Bearer ${this.apiToken}` };
    }
    return {};
  }

  /**
   * Make an authenticated API request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - API response
   */
  async request(endpoint, options = {}) {
    // Try to use JWT token if available, otherwise try API token exchange
    if (!this.jwtToken && this.apiToken) {
      await this.exchangeToken();
    }

    const url = `${this.baseUrl}${endpoint}`;
    const fetchOptions = {
      ...options,
      headers: {
        ...this.headers,
        ...this.getAuthHeaders(),
        ...(options.headers || {}),
      },
    };

    const response = await fetch(url, fetchOptions);
    return response.json();
  }
}

// Example usage:

// For Node.js
// async function main() {
//   const client = new CanvasAuthClient({
//     baseUrl: 'http://localhost:8001',
//     apiToken: 'YOUR_API_TOKEN',
//   });
//
//   try {
//     // Exchange API token for JWT token
//     const authResult = await client.exchangeToken();
//     console.log('Authentication successful:', authResult);
//
//     // Make authenticated requests
//     const workspaces = await client.request('/rest/v2/workspaces');
//     console.log('Workspaces:', workspaces);
//
//     const contexts = await client.request('/rest/v2/contexts');
//     console.log('Contexts:', contexts);
//   } catch (error) {
//     console.error('Error:', error.message);
//   }
// }
//
// main();

// For browser
// const client = new CanvasAuthClient({
//   baseUrl: 'http://localhost:8001',
//   apiToken: 'YOUR_API_TOKEN',
// });
//
// client.exchangeToken()
//   .then(() => client.request('/rest/v2/workspaces'))
//   .then(data => console.log('Workspaces:', data))
//   .catch(error => console.error('Error:', error.message));
