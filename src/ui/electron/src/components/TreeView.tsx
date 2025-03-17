import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { ScrollArea } from './ui/scroll-area';
import { TreeNode, DragItem, TreeContextMenuActions } from '../types/tree';
import { TreeNodeComponent } from './TreeNode';

interface TreeViewProps {
  tree: TreeNode;
  onNodeMove: (draggedId: string, targetId: string) => void;
  contextMenuActions: TreeContextMenuActions;
}

export const TreeView: React.FC<TreeViewProps> = ({ tree, onNodeMove, contextMenuActions }) => {
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
          />
        </div>
      </ScrollArea>
    </div>
  );
};
