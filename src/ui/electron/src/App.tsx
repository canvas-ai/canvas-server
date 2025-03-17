import React, { useState, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import axios from 'axios';
import { TreeView } from './components/TreeView';
import { TreeNode, TreeContextMenuActions } from './types/tree';
import { API_ENDPOINTS, getAuthHeaders, getAuthHeadersAsync } from './config';
import socketService from './lib/socket';
import config from './lib/config';
import { tokenInitializationPromise } from './lib/config';

const App: React.FC = () => {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{ action: 'cut' | 'copy', nodeId: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('universe');
  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  // Track expanded nodes to preserve state across tree updates
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const nodeMap = useRef<Map<string, TreeNode>>(new Map());
  const buildNodeMap = (node: TreeNode) => {
    nodeMap.current.set(node.id, node);
    node.children.forEach(child => buildNodeMap(child));
  };

  // Initialize expanded nodes from saved state in config
  useEffect(() => {
    const loadExpandedNodes = async () => {
      try {
        const savedExpandedNodes = await config.getExpandedNodes();
        if (savedExpandedNodes && savedExpandedNodes.length > 0) {
          setExpandedNodes(new Set(savedExpandedNodes));
        }
      } catch (error) {
        console.error('Error loading expanded nodes:', error);
      }
    };

    loadExpandedNodes();
  }, []);

  // Save expanded nodes state to config when it changes
  useEffect(() => {
    const saveNodes = async () => {
      if (expandedNodes.size > 0) {
        try {
          await config.saveExpandedNodes(Array.from(expandedNodes));
        } catch (error) {
          console.error('Error saving expanded nodes:', error);
        }
      }
    };

    saveNodes();
  }, [expandedNodes]);

  // Initialize WebSocket connection
  useEffect(() => {
    const maxRetries = 5;
    let retryCount = 0;
    let reconnectTimer: NodeJS.Timeout | null = null;

    // Check if Electron API is available
    const isElectronAPIAvailable = () => {
      // Check if we're running in Electron by looking for the process.versions.electron
      return typeof process !== 'undefined' && process.versions && !!process.versions.electron;
    };

    // Wait for Electron API to become available with timeout
    const waitForElectronAPI = async (timeoutMs = 5000): Promise<boolean> => {
      return new Promise((resolve) => {
        if (isElectronAPIAvailable()) {
          console.log('Electron API is available immediately');
          resolve(true);
          return;
        }

        console.log('Waiting for Electron API to become available...');
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
          if (isElectronAPIAvailable()) {
            console.log('Electron API is now available');
            clearInterval(checkInterval);
            resolve(true);
          } else if (Date.now() - startTime > timeoutMs) {
            console.error('Timed out waiting for Electron API');
            clearInterval(checkInterval);
            resolve(false);
          }
        }, 100);
      });
    };

    const initSocket = async () => {
      try {
        console.log('Initializing WebSocket connection');

        // First ensure Electron API is available
        const apiAvailable = await waitForElectronAPI();
        if (!apiAvailable) {
          console.warn('Proceeding with socket connection even though Electron API is not available');
          // Note: Our socket.ts has fallbacks for this case
        }

        // Wait for token initialization before connecting (if promise exists)
        if (tokenInitializationPromise) {
          console.log('Waiting for auth token to be initialized...');
          try {
            await tokenInitializationPromise;
          } catch (e) {
            console.error('Error waiting for token initialization:', e);
            // Continue anyway, the socket service has fallbacks
          }
        }

        // Connect to WebSocket server with fallbacks in place
        await socketService.connect();
        console.log('Successfully connected to WebSocket server');
        setSocketConnected(true);
        setError(null); // Clear any previous errors

        // Subscribe to the workspace
        const workspaceId = 'universe'; // Default workspace
        socketService.subscribeToWorkspace(workspaceId, handleTreeUpdate);
        setActiveWorkspaceId(workspaceId);

        // Fetch initial tree data
        await fetchTree(workspaceId);
      } catch (error) {
        console.error('Socket initialization error:', error);

        // Show different error messages based on error type
        let errorMessage = 'Failed to connect to server. Check your network connection and configuration.';

        // Check if it's an authentication error
        if (error instanceof Error) {
          if (error.message.includes('Authentication failed') ||
              error.message.includes('Valid user not found')) {
            errorMessage = 'Authentication failed. Please check your API token in ~/.canvas/config/canvas-electron.json';
            console.error('Authentication error: Your token may be missing, invalid, or expired.');
            console.error('Please check your configuration file at ~/.canvas/config/canvas-electron.json');
          } else if (error.message.includes('undefined') && error.message.includes('electronAPI')) {
            errorMessage = 'Electron API initialization failed. Please restart the application.';
            console.error('Electron API error: The preload script may not have initialized correctly.');
          }
        }

        setError(errorMessage);
        setSocketConnected(false);

        // Still try to load data via HTTP API
        try {
          console.log('Attempting to fetch tree via HTTP as fallback');
          const workspaceId = 'universe'; // Default workspace
          setActiveWorkspaceId(workspaceId);
          await fetchTree(workspaceId);
        } catch (httpError) {
          console.error('Failed to fetch tree data via HTTP:', httpError);
          if (axios.isAxiosError(httpError) && httpError.response?.status === 401) {
            setError('Authentication failed with both WebSocket and HTTP. Please check your API token.');
          } else {
            setError(errorMessage);
          }
        }
      }
    };

    // Initial connection attempt
    initSocket();

    // Setup periodic connection check
    const connectionCheckInterval = setInterval(() => {
      if (socketService.isConnected()) {
        if (!socketConnected) {
          console.log('WebSocket reconnected');
          setSocketConnected(true);
          setError(null);
        }
      } else if (socketConnected) {
        console.log('WebSocket disconnected, will retry connection');
        setSocketConnected(false);
        retryCount = 0; // Reset retry count
        initSocket();
      }
    }, 10000); // Check every 10 seconds

    return () => {
      console.log('Cleaning up WebSocket connections...');
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      clearInterval(connectionCheckInterval);
      socketService.disconnect();
    };
  }, []);

  useEffect(() => {
    if (tree) {
      nodeMap.current.clear();
      buildNodeMap(tree);
    }
  }, [tree]);

  const fetchTree = async (workspaceId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Try to use WebSocket first for better real-time updates
      if (socketService.isConnected()) {
        try {
          console.log('Attempting to fetch tree via WebSocket');
          const wsTree = await socketService.getWorkspaceTree(workspaceId);
          console.log('Successfully fetched tree via WebSocket');
          setTree(wsTree);
          return;
        } catch (wsError) {
          console.warn('WebSocket tree fetch failed, falling back to HTTP:', wsError);
          // Continue with HTTP fetch as fallback
        }
      }

      console.log('Fetching tree via HTTP API');

      // Use the async version of getAuthHeaders to ensure we have the token
      const headers = await getAuthHeadersAsync();

      const response = await axios.get(API_ENDPOINTS.workspaceTree(workspaceId), {
        headers,
      });
      console.log('HTTP Tree response:', response.data);

      if (response.data.status === 'success') {
        // Make sure we're using the correct property from the API response
        const treeData = response.data.payload;
        console.log('Setting tree data from HTTP:', treeData);
        setTree(treeData);
      } else {
        setError(response.data.message || 'Failed to fetch tree data');
      }
    } catch (error) {
      console.error('Error fetching tree:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setError('Authentication failed. Please check your API token.');
      } else {
        setError(error instanceof Error ? error.message : 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNodeMove = async (draggedId: string, targetId: string) => {
    try {
      const draggedNode = nodeMap.current.get(draggedId);
      const targetNode = nodeMap.current.get(targetId);

      if (!draggedNode || !targetNode) return;

      setLoading(true);
      // Implementation depends on your API structure
      // This is a placeholder for node movement logic
      console.log('Moving node', draggedId, 'to', targetId);

      // Refresh the tree after the operation
      await fetchTree(activeWorkspaceId);
    } catch (error) {
      console.error('Error moving node:', error);
      setError(error instanceof Error ? error.message : 'Failed to move node');
    } finally {
      setLoading(false);
    }
  };

  const promptForInput = (message: string, defaultValue: string = ''): string | null => {
    return window.prompt(message, defaultValue);
  };

  const contextMenuActions: TreeContextMenuActions = {
    onCut: (nodeId: string) => {
      setClipboard({ action: 'cut', nodeId });
    },

    onCopy: (nodeId: string) => {
      setClipboard({ action: 'copy', nodeId });
    },

    onPaste: async (targetId: string) => {
      if (!clipboard) return;

      try {
        setLoading(true);
        const sourceNode = nodeMap.current.get(clipboard.nodeId);
        const targetNode = nodeMap.current.get(targetId);

        if (!sourceNode || !targetNode) return;

        console.log('Pasting node', clipboard.nodeId, 'to', targetId, 'with action', clipboard.action);

        if (clipboard.action === 'cut') {
          // For cut, use the move endpoint
          // Implementation depends on your API structure
          setClipboard(null);
        } else if (clipboard.action === 'copy') {
          // For copy, use the copy endpoint
          // Implementation depends on your API structure
        }

        // Refresh the tree after the operation
        await fetchTree(activeWorkspaceId);
      } catch (error) {
        console.error('Error pasting node:', error);
        setError(error instanceof Error ? error.message : 'Failed to paste node');
      } finally {
        setLoading(false);
      }
    },

    onMove: async (nodeId: string) => {
      try {
        const node = nodeMap.current.get(nodeId);
        if (!node) return;

        const targetPath = promptForInput('Enter destination path:', '/');
        if (!targetPath) return;

        setLoading(true);

        // Call API to move the node
        // Implementation depends on your API structure
        console.log('Moving node', nodeId, 'to path', targetPath);

        // Refresh the tree after the operation
        await fetchTree(activeWorkspaceId);
      } catch (error) {
        console.error('Error moving node:', error);
        setError(error instanceof Error ? error.message : 'Failed to move node');
      } finally {
        setLoading(false);
      }
    },

    onMergeUp: async (nodeId: string) => {
      try {
        const node = nodeMap.current.get(nodeId);
        if (!node) return;

        setLoading(true);

        // Call API to merge up
        // Implementation depends on your API structure
        console.log('Merging up node', nodeId);

        // Refresh the tree after the operation
        await fetchTree(activeWorkspaceId);
      } catch (error) {
        console.error('Error merging up node:', error);
        setError(error instanceof Error ? error.message : 'Failed to merge up node');
      } finally {
        setLoading(false);
      }
    },

    onMergeDown: async (nodeId: string) => {
      try {
        const node = nodeMap.current.get(nodeId);
        if (!node) return;

        setLoading(true);

        // Call API to merge down
        // Implementation depends on your API structure
        console.log('Merging down node', nodeId);

        // Refresh the tree after the operation
        await fetchTree(activeWorkspaceId);
      } catch (error) {
        console.error('Error merging down node:', error);
        setError(error instanceof Error ? error.message : 'Failed to merge down node');
      } finally {
        setLoading(false);
      }
    },

    onCreateLayer: async (parentId: string) => {
      try {
        const parentNode = nodeMap.current.get(parentId);
        if (!parentNode) return;

        const layerName = promptForInput('Enter layer name:');
        if (!layerName) return;

        setLoading(true);

        // Calculate the path based on the parent node
        const parentPath = getNodePath(parentNode);
        const newPath = parentPath === '/' ? `/${layerName}` : `${parentPath}/${layerName}`;

        // Call API to create a new layer
        await axios.post(API_ENDPOINTS.workspacePath(activeWorkspaceId), {
          path: newPath,
          autoCreateLayers: true
        }, {
          headers: getAuthHeaders()
        });

        console.log('Created layer', layerName, 'at path', newPath);

        // Refresh the tree after the operation
        await fetchTree(activeWorkspaceId);
      } catch (error) {
        console.error('Error creating layer:', error);
        setError(error instanceof Error ? error.message : 'Failed to create layer');
      } finally {
        setLoading(false);
      }
    },

    onCreateCanvas: async (parentId: string) => {
      try {
        const parentNode = nodeMap.current.get(parentId);
        if (!parentNode) return;

        const canvasName = promptForInput('Enter canvas name:');
        if (!canvasName) return;

        setLoading(true);

        // Calculate the path based on the parent node
        const parentPath = getNodePath(parentNode);
        const newPath = parentPath === '/' ? `/${canvasName}` : `${parentPath}/${canvasName}`;

        // Call API to create a new canvas
        await axios.post(API_ENDPOINTS.workspacePath(activeWorkspaceId), {
          path: newPath,
          type: 'canvas',
          autoCreateLayers: true
        }, {
          headers: getAuthHeaders()
        });

        console.log('Created canvas', canvasName, 'at path', newPath);

        // Refresh the tree after the operation
        await fetchTree(activeWorkspaceId);
      } catch (error) {
        console.error('Error creating canvas:', error);
        setError(error instanceof Error ? error.message : 'Failed to create canvas');
      } finally {
        setLoading(false);
      }
    },

    onRenameLayer: async (nodeId: string) => {
      try {
        const node = nodeMap.current.get(nodeId);
        if (!node) return;

        const newName = promptForInput('Enter new layer name:', node.name);
        if (!newName || newName === node.name) return;

        setLoading(true);

        // Call API to rename the layer
        // Implementation depends on your API structure
        await axios.put(API_ENDPOINTS.layer(nodeId), {
          name: newName
        }, {
          headers: getAuthHeaders()
        });

        console.log('Renamed layer', node.name, 'to', newName);

        // Refresh the tree after the operation
        await fetchTree(activeWorkspaceId);
      } catch (error) {
        console.error('Error renaming layer:', error);
        setError(error instanceof Error ? error.message : 'Failed to rename layer');
      } finally {
        setLoading(false);
      }
    },

    onRenameCanvas: async (nodeId: string) => {
      try {
        const node = nodeMap.current.get(nodeId);
        if (!node) return;

        const newName = promptForInput('Enter new canvas name:', node.name);
        if (!newName || newName === node.name) return;

        setLoading(true);

        // Call API to rename the canvas
        await axios.put(API_ENDPOINTS.canvas(nodeId), {
          name: newName
        }, {
          headers: getAuthHeaders()
        });

        console.log('Renamed canvas', node.name, 'to', newName);

        // Refresh the tree after the operation
        await fetchTree(activeWorkspaceId);
      } catch (error) {
        console.error('Error renaming canvas:', error);
        setError(error instanceof Error ? error.message : 'Failed to rename canvas');
      } finally {
        setLoading(false);
      }
    },

    onRemoveCanvas: async (nodeId: string) => {
      try {
        const node = nodeMap.current.get(nodeId);
        if (!node) return;

        const confirmed = window.confirm(`Are you sure you want to remove canvas "${node.name}"?`);
        if (!confirmed) return;

        setLoading(true);

        // Call API to remove the canvas
        await axios.delete(API_ENDPOINTS.canvas(nodeId), {
          headers: getAuthHeaders()
        });

        console.log('Removed canvas', node.name);

        // Refresh the tree after the operation
        await fetchTree(activeWorkspaceId);
      } catch (error) {
        console.error('Error removing canvas:', error);
        setError(error instanceof Error ? error.message : 'Failed to remove canvas');
      } finally {
        setLoading(false);
      }
    },

    onInsertPath: async (nodeId: string) => {
      try {
        const node = nodeMap.current.get(nodeId);
        if (!node) return;

        const path = promptForInput('Enter path to insert:');
        if (!path) return;

        setLoading(true);

        // Call API to insert the path
        await axios.post(API_ENDPOINTS.workspacePath(activeWorkspaceId), {
          path,
          autoCreateLayers: true
        }, {
          headers: getAuthHeaders()
        });

        console.log('Inserted path', path);

        // Refresh the tree after the operation
        await fetchTree(activeWorkspaceId);
      } catch (error) {
        console.error('Error inserting path:', error);
        setError(error instanceof Error ? error.message : 'Failed to insert path');
      } finally {
        setLoading(false);
      }
    },

    onRemovePath: async (nodeId: string) => {
      try {
        const node = nodeMap.current.get(nodeId);
        if (!node) return;

        // Get the path of the node
        const path = getNodePath(node);

        const confirmed = window.confirm(`Are you sure you want to remove path "${path}"?`);
        if (!confirmed) return;

        setLoading(true);

        // Call API to remove the path
        await axios.delete(API_ENDPOINTS.workspacePath(activeWorkspaceId), {
          headers: getAuthHeaders(),
          data: { path }
        });

        console.log('Removed path', path);

        // Refresh the tree after the operation
        await fetchTree(activeWorkspaceId);
      } catch (error) {
        console.error('Error removing path:', error);
        setError(error instanceof Error ? error.message : 'Failed to remove path');
      } finally {
        setLoading(false);
      }
    }
  };

  // Helper function to get a node's path
  const getNodePath = (node: TreeNode): string => {
    // This is a simplified implementation
    // In a real implementation, you would traverse the tree to build the full path
    return node.name === '/' ? '/' : `/${node.name}`;
  };

  // Handle node expansion toggling
  const handleNodeToggle = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Handle tree updates from WebSocket
  const handleTreeUpdate = (updatedTree: TreeNode) => {
    console.log('Tree update received via WebSocket:', updatedTree);
    setTree(updatedTree);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-red-800 font-semibold">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => fetchTree(activeWorkspaceId)}
            className="mt-2 px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!tree || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading tree data...</p>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen flex flex-col">
        <header className="bg-white border-b border-gray-200 p-4">
          <h1 className="text-xl font-semibold">Canvas</h1>
          {error && <div className="text-red-500 mt-2">{error}</div>}
        </header>
        <main className="flex-grow flex overflow-hidden">
          {loading && <div className="flex-1 flex items-center justify-center">Loading...</div>}
          {tree && (
            <TreeView
              tree={tree}
              onNodeMove={handleNodeMove}
              expandedNodes={expandedNodes}
              onNodeToggle={handleNodeToggle}
              contextMenuActions={contextMenuActions}
            />
          )}
          <div className="flex-1 p-4">
            <h2 className="text-lg font-medium">Canvas Content</h2>
            {/* Add canvas content here */}
          </div>
        </main>
      </div>
    </DndProvider>
  );
};

export default App;
