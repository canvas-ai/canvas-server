export type LayerType = 'context' | 'canvas' | 'workspace';

export interface TreeNode {
  id: string;
  type: LayerType;
  name: string;
  label?: string;
  description?: string;
  color?: string;
  locked?: boolean;
  children: TreeNode[];
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
  onMergeUp: (nodeId: string) => void;
  onMergeDown: (nodeId: string) => void;
}
