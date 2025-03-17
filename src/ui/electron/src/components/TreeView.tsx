import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { ScrollArea } from './ui/scroll-area';
import { TreeNode, DragItem, TreeContextMenuActions } from '../types/tree';
import { TreeNodeComponent } from './TreeNode';

interface TreeViewProps {
  tree: TreeNode;
  onNodeMove: (draggedId: string, targetId: string) => void;
  contextMenuActions: TreeContextMenuActions;
  expandedNodes: Set<string>;
  onNodeToggle: (nodeId: string) => void;
}

export const TreeView: React.FC<TreeViewProps> = ({
  tree,
  onNodeMove,
  contextMenuActions,
  expandedNodes,
  onNodeToggle
}) => {
  return (
    <div className="w-[480px] h-full border-r border-gray-200 bg-white">
      <ScrollArea className="h-full">
        <div className="p-4">
          <TreeNodeComponent
            node={tree}
            path={[]}
            onNodeMove={onNodeMove}
            contextMenuActions={contextMenuActions}
            level={0}
            expandedNodes={expandedNodes}
            onNodeToggle={onNodeToggle}
          />
        </div>
      </ScrollArea>
    </div>
  );
};
