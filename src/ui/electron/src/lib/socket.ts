import { io, Socket } from 'socket.io-client';
import { TreeNode } from '../types/tree';
import config, { tokenInitializationPromise } from './config';

// To fix linter errors, we need to import these from config
// but they're not exposed, so we'll recreate them here
let tokenInitialized = false;
const configCache: Record<string, any> = {};

// Default URL if we can't get it from the main process
const DEFAULT_URL = 'http://localhost:8001';
// Default token - this will be overridden if possible
const DEFAULT_TOKEN = '';

interface WorkspaceUpdateEvent {
  workspaceId: string;
  data: {
    tree: TreeNode;
    operation: string;
    path?: string;
    pathFrom?: string;
    pathTo?: string;
  };
}

class SocketService {
  private socket: Socket | null = null;
  private workspaceCallbacks: Map<string, ((tree: TreeNode) => void)[]> = new Map();
  private reconnecting = false;
  private pingInterval: NodeJS.Timeout | null = null;

  // Track last updates to avoid duplicates
  private lastUpdates: Map<string, { timestamp: number, operation: string, path?: string }> = new Map();

  // Debounce timers for batch processing
  private updateDebounceTimers: Map<string, NodeJS.Timeout> = new Map();

  // Check if electronAPI is available
  private isElectronAPIAvailable(): boolean {
    // Check if we're running in Electron by looking for the process.versions.electron
    return typeof process !== 'undefined' && process.versions && !!process.versions.electron;
  }

  // Safely get config from electronAPI
  private async safeGetConfig(): Promise<any> {
    try {
      return await config.getAll();
    } catch (error) {
      console.error('Error getting config:', error);
      return null;
    }
  }

  // Safely get auth token from electronAPI
  private async safeGetAuthToken(): Promise<string> {
    try {
      return await config.getAuthToken();
    } catch (error) {
      console.error('Error getting auth token:', error);
      return DEFAULT_TOKEN;
    }
  }

  // Safely get server URL from electronAPI
  private async safeGetServerUrl(): Promise<string> {
    try {
      return await config.getServerUrl();
    } catch (error) {
      console.error('Error getting server URL:', error);
      return DEFAULT_URL;
    }
  }

  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Disconnect any existing socket
        if (this.socket && this.socket.connected) {
          this.socket.disconnect();
        }

        console.log('Attempting to connect to WebSocket server');

        // IMPORTANT: Wait for token initialization to complete before connecting
        console.log('Waiting for auth token initialization to complete...');

        // If token initialization is in progress, wait for it
        if (tokenInitializationPromise) {
          try {
            console.log('Token initialization promise exists, waiting for it to resolve...');
            await tokenInitializationPromise;
            console.log('Token initialization complete');
          } catch (error) {
            console.error('Error waiting for token initialization:', error);
          }
        } else {
          console.log('No token initialization promise found');
        }

        // Get the full config directly to ensure we have the token
        const fullConfig = await this.safeGetConfig();
        console.log('Config structure keys:', fullConfig ? Object.keys(fullConfig).join(', ') : 'empty');

        // Extract token from server.auth.token directly
        let authToken = '';
        if (fullConfig?.server?.auth?.token) {
          authToken = fullConfig.server.auth.token;
          console.log(`Found auth token in server.auth.token: ${authToken.substring(0, 15)}... (${authToken.length} chars)`);
        } else {
          console.error('No token found in server.auth.token structure!');
          console.log('Full config server section:', JSON.stringify(fullConfig?.server || 'undefined'));

          // Try to get token from main process via regular method as fallback
          try {
            authToken = await this.safeGetAuthToken();
            if (authToken) {
              console.log(`Retrieved token via getAuthToken: ${authToken.substring(0, 15)}...`);
            }
          } catch (tokenError) {
            console.error('Error during token fallback retrieval:', tokenError);
          }
        }

        // Ensure auth token is a valid JWT
        if (authToken) {
          // Check if token has proper JWT format (3 parts separated by dots)
          const parts = authToken.split('.');
          if (parts.length !== 3) {
            console.error('Auth token does not have valid JWT format (should have 3 parts separated by dots)');
            console.error('This may cause authentication to fail');
          } else {
            console.log('Auth token has valid JWT format');
          }
        }

        // Cache the token for other parts of the app
        if (authToken) {
          configCache.authToken = authToken;
          tokenInitialized = true;
        }

        // Get server URL
        let serverUrl = DEFAULT_URL;
        try {
          serverUrl = fullConfig?.server?.url || await this.safeGetServerUrl() || DEFAULT_URL;
        } catch (urlError) {
          console.error('Error getting server URL:', urlError);
        }

        console.log(`Connecting to WebSocket server at ${serverUrl}`);

        if (!authToken) {
          console.error('No authentication token available, connection will likely fail');
          console.error('Please check your configuration file at ~/.canvas/config/canvas-electron.json');
        } else {
          // Log token details without exposing the full token
          console.log(`Using auth token: ${authToken.substring(0, 10)}...${authToken.substring(authToken.length - 5)}`);
          console.log('Auth token length:', authToken.length);
          console.log('Auth token character at position 0:', authToken.charAt(0));
          console.log('Auth token first 5 chars:', authToken.substring(0, 5));
        }

        // Create the socket with authentication
        console.log('Creating socket.io client with auth token...');

        // IMPORTANT: We do NOT add "Bearer" prefix for WebSocket auth.token
        // Socket.io auth.token should be the raw JWT token, while HTTP requests use "Bearer" prefix
        this.socket = io(serverUrl, {
          transports: ['websocket'],
          auth: {
            token: authToken  // Use raw token without any prefix
          },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 10000
        });

        // Log the handshake data for debugging
        console.log('Socket.io client created with auth:', {
          hasToken: !!authToken,
          tokenLength: authToken ? authToken.length : 0,
          transport: 'websocket',
          authObject: authToken ? {
            token: `${authToken.substring(0, 10)}...${authToken.substring(authToken.length - 5)}`
          } : null
        });

        // Setup event listeners
        this.setupEventListeners();

        // Start ping to keep connection alive
        this.startPing();

        // Wait for connection
        this.socket.on('connect', () => {
          console.log(`Connected to server with socket ID: ${this.socket?.id}`);
          this.reconnecting = false;
          resolve();
        });

        // Handle connection failure
        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          console.error('Socket connection error message:', error.message);

          // Check if it's an authentication error
          if (error.message && error.message.includes('Authentication')) {
            console.error('Authentication error detected. Please check your token.');
          }

          this.handleReconnect(reject, `Failed to connect: ${error.message}`);
        });

        // Set a connection timeout
        const timeout = setTimeout(() => {
          if (!this.socket?.connected) {
            this.handleReconnect(reject, 'Connection timeout');
          }
        }, 10000);

        // Clear timeout on connect
        this.socket.on('connect', () => {
          clearTimeout(timeout);
        });

      } catch (error) {
        console.error('Error in socket connect:', error);
        reject(error);
      }
    });
  }

  private handleReconnect(reject?: (reason: any) => void, message?: string): void {
    if (!this.reconnecting) {
      this.reconnecting = true;
      console.log('Attempting to reconnect...');

      if (reject) {
        reject(new Error(message || 'Connection failed'));
      }
    }
  }

  private startPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        console.log('Sending ping to keep connection alive');
        this.socket.emit('ping', (response: any) => {
          if (response && response.success) {
            console.log(`Ping successful, server timestamp: ${new Date(response.timestamp).toISOString()}`);
          }
        });
      } else {
        console.log('Socket not connected, skipping ping');
      }
    }, 30000); // 30 seconds
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Reconnect event
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      this.reconnecting = false;

      // Resubscribe to workspaces
      this.workspaceCallbacks.forEach((_, workspaceId) => {
        this.emitSubscribe(workspaceId);
      });
    });

    // Disconnect event
    this.socket.on('disconnect', (reason) => {
      console.log(`Disconnected: ${reason}`);

      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect
        this.socket?.connect();
      }
    });

    // Handle tree updates
    this.socket.on('workspace:workspace:tree:updated', (event: WorkspaceUpdateEvent) => {
      const { workspaceId, data } = event;
      console.log(`Received tree update for workspace ${workspaceId}, operation: ${data.operation}`);

      // Check for duplicate events (same operation on same path within short time window)
      const lastUpdateKey = `${workspaceId}:${data.operation}:${data.path || ''}`;
      const lastUpdate = this.lastUpdates.get(lastUpdateKey);

      const now = Date.now();
      if (lastUpdate && (now - lastUpdate.timestamp < 500)) {
        console.log('Detected duplicate event, skipping', {
          operation: data.operation,
          path: data.path,
          timeSinceLast: now - lastUpdate.timestamp
        });
        return;
      }

      // Update the last update timestamp
      this.lastUpdates.set(lastUpdateKey, {
        timestamp: now,
        operation: data.operation,
        path: data.path
      });

      // Debounce updates for the same workspace
      const key = `${workspaceId}`;
      if (this.updateDebounceTimers.has(key)) {
        clearTimeout(this.updateDebounceTimers.get(key)!);
      }

      this.updateDebounceTimers.set(key, setTimeout(() => {
        // Prepare tree for UI consumption
        const processedTree = this.prepareTreeForUI(data.tree);

        // Notify subscribers
        this.notifyWorkspaceSubscribers(workspaceId, processedTree);

        // Clear the debounce timer
        this.updateDebounceTimers.delete(key);
      }, 100)); // 100ms debounce
    });

    // Other event listeners can be added here
    // For example: layer created, updated, deleted, etc.
  }

  private prepareTreeForUI(tree: TreeNode): TreeNode {
    if (!tree) return tree;

    // Clone the tree to avoid mutations affecting the original
    const processedTree = JSON.parse(JSON.stringify(tree));

    // Process the tree recursively
    return this.processNode(processedTree);
  }

  private processNode(node: TreeNode, parentPath: string = ''): TreeNode {
    if (!node) return node;

    // Store original ID if needed for references
    node._originalId = node.id;

    // Process children recursively
    if (node.children && Array.isArray(node.children)) {
      node.children = node.children.map(child => this.processNode(child,
        parentPath ? `${parentPath}/${node.name}` : `/${node.name}`));
    }

    return node;
  }

  subscribeToWorkspace(workspaceId: string, callback: (tree: TreeNode) => void): void {
    console.log(`Subscribing to workspace ${workspaceId}`);

    if (!this.workspaceCallbacks.has(workspaceId)) {
      this.workspaceCallbacks.set(workspaceId, []);

      // Only emit subscribe if this is the first subscriber
      this.emitSubscribe(workspaceId);
    }

    // Add this callback to the subscribers
    const callbacks = this.workspaceCallbacks.get(workspaceId)!;
    if (!callbacks.includes(callback)) {
      callbacks.push(callback);
    }
  }

  private emitSubscribe(workspaceId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.error('Cannot subscribe to workspace - socket not connected');
      return;
    }

    console.log(`Emitting subscribe for workspace ${workspaceId}`);
    this.socket.emit('workspace:subscribe', workspaceId, (response: any) => {
      if (response && response.status === 'success') {
        console.log(`Successfully subscribed to workspace ${workspaceId}`);

        // Immediately get the tree to update UI
        this.getWorkspaceTree(workspaceId)
          .then(tree => {
            this.notifyWorkspaceSubscribers(workspaceId, tree);
          })
          .catch(error => {
            console.error(`Error getting initial tree for workspace ${workspaceId}:`, error);
          });
      } else {
        console.error(`Failed to subscribe to workspace ${workspaceId}:`, response ? response.error : 'Unknown error');
      }
    });
  }

  unsubscribeFromWorkspace(workspaceId: string, callback?: (tree: TreeNode) => void): void {
    if (!this.workspaceCallbacks.has(workspaceId)) return;

    const callbacks = this.workspaceCallbacks.get(workspaceId)!;

    if (callback) {
      // Remove specific callback
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    } else {
      // Remove all callbacks
      callbacks.length = 0;
    }

    // If no more callbacks, unsubscribe from workspace
    if (callbacks.length === 0) {
      this.workspaceCallbacks.delete(workspaceId);
      this.emitUnsubscribe(workspaceId);
    }
  }

  private emitUnsubscribe(workspaceId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.log(`Socket not connected, skipping unsubscribe for workspace ${workspaceId}`);
      return;
    }

    this.socket.emit('workspace:unsubscribe', workspaceId, (response: any) => {
      if (response && response.status === 'success') {
        console.log(`Successfully unsubscribed from workspace ${workspaceId}`);
      } else {
        console.error(`Failed to unsubscribe from workspace ${workspaceId}:`, response ? response.error : 'Unknown error');
      }
    });
  }

  private notifyWorkspaceSubscribers(workspaceId: string, tree: TreeNode): void {
    if (!this.workspaceCallbacks.has(workspaceId)) return;

    const callbacks = this.workspaceCallbacks.get(workspaceId)!;
    const callbackCount = callbacks.length;

    console.log(`Notifying ${callbackCount} subscribers for workspace ${workspaceId}`);

    callbacks.forEach(callback => callback(tree));
  }

  getWorkspaceTree(workspaceId: string): Promise<TreeNode> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      console.log(`Getting tree for workspace ${workspaceId}`);

      this.socket.emit('workspace:tree:get', workspaceId, (response: any) => {
        if (response && response.status === 'success') {
          const tree = response.payload.tree;
          console.log(`Received tree for workspace ${workspaceId}`);

          // Process the tree for UI consumption
          const processedTree = this.prepareTreeForUI(tree);
          resolve(processedTree);
        } else {
          console.error(`Failed to get tree for workspace ${workspaceId}:`, response ? response.error : 'Unknown error');
          reject(new Error(response ? response.error : 'Failed to get workspace tree'));
        }
      });
    });
  }

  isConnected(): boolean {
    return !!(this.socket && this.socket.connected);
  }

  disconnect(): void {
    this.stopPing();

    if (this.socket) {
      console.log('Disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
    }

    // Clear all callbacks
    this.workspaceCallbacks.clear();

    // Clear all debounce timers
    this.updateDebounceTimers.forEach(timer => clearTimeout(timer));
    this.updateDebounceTimers.clear();
  }
}

// Export singleton instance
export default new SocketService();
