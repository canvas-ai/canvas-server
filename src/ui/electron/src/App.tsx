import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import axios from 'axios';
import { TreeView } from './components/TreeView';
import { TreeNode, TreeContextMenuActions } from './types/tree';
import { API_ENDPOINTS, getAuthHeaders } from './config';

const App: React.FC = () => {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{ action: 'cut' | 'copy', nodeId: string } | null>(null);

  useEffect(() => {
    const workspaceId = 'universe';
    fetchTree(workspaceId);
  }, []);

  const fetchTree = async (workspaceId: string) => {
    try {
      setError(null);
      const response = await axios.get(API_ENDPOINTS.workspaceTree(workspaceId), {
        headers: getAuthHeaders(),
      });
      console.log('Tree data:', response.data);

      if (response.data.status === 'success') {
        setTree(response.data.payload);
      } else {
        setError(response.data.message || 'Failed to fetch tree data');
      }
    } catch (error) {
      console.error('Error fetching tree:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch tree data');
    }
  };

  const handleNodeMove = (draggedId: string, targetId: string) => {
    // TODO: Implement node movement logic and API call
    console.log('Moving node', draggedId, 'to', targetId);
  };

  const contextMenuActions: TreeContextMenuActions = {
    onCut: (nodeId: string) => {
      setClipboard({ action: 'cut', nodeId });
    },
    onCopy: (nodeId: string) => {
      setClipboard({ action: 'copy', nodeId });
    },
    onPaste: (targetId: string) => {
      if (!clipboard) return;
      // TODO: Implement paste logic and API call
      console.log('Pasting node', clipboard.nodeId, 'to', targetId, 'with action', clipboard.action);
      if (clipboard.action === 'cut') {
        setClipboard(null);
      }
    },
    onMergeUp: (nodeId: string) => {
      // TODO: Implement merge up logic and API call
      console.log('Merging up node', nodeId);
    },
    onMergeDown: (nodeId: string) => {
      // TODO: Implement merge down logic and API call
      console.log('Merging down node', nodeId);
    },
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-red-800 font-semibold">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!tree) {
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
      <div className="flex h-screen">
        <TreeView
          tree={tree}
          onNodeMove={handleNodeMove}
          contextMenuActions={contextMenuActions}
        />
        <div className="flex-1 p-4">
          {/* Main content area */}
          <h1 className="text-2xl font-bold">Canvas</h1>
          <p className="text-gray-600">Select a node from the tree to view its contents.</p>
        </div>
      </div>
    </DndProvider>
  );
};

export default App;
