export type LayerType = 'context' | 'canvas' | 'workspace' | 'universe';

export interface TreeNode {
  id: string;
  type: LayerType;
  name: string;
  label?: string;
  description?: string;
  color?: string;
  locked?: boolean;
  children: TreeNode[];
  _originalId?: string;
}

export interface DragItem {
  id: string;
  type: 'TREE_NODE';
  node: TreeNode;
  path: string[];
}

export interface TreeContextMenuActions {
  onCut: (nodeId: string) => void;
  onCopy: (nodeId: string) => void;
  onPaste: (targetId: string) => void;
  onMove: (nodeId: string) => void;
  onMergeUp: (nodeId: string) => void;
  onMergeDown: (nodeId: string) => void;
  onCreateLayer: (parentId: string) => void;
  onCreateCanvas: (parentId: string) => void;
  onRenameLayer: (nodeId: string) => void;
  onRenameCanvas: (nodeId: string) => void;
  onRemoveCanvas: (nodeId: string) => void;
  onInsertPath: (nodeId: string) => void;
  onRemovePath: (nodeId: string) => void;
}
