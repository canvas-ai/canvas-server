import React, { useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { ChevronRight, ChevronDown, FileIcon, FolderIcon, File } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from './ui/context-menu';
import { TreeNode, DragItem, TreeContextMenuActions } from '../types/tree';
import { cn } from '../lib/utils';

interface TreeNodeProps {
  node: TreeNode;
  path: string[];
  onNodeMove: (draggedId: string, targetId: string) => void;
  contextMenuActions: TreeContextMenuActions;
  level: number;
  expandedNodes: Set<string>;
  onNodeToggle: (nodeId: string) => void;
}

export const TreeNodeComponent: React.FC<TreeNodeProps> = ({
  node,
  path,
  onNodeMove,
  contextMenuActions,
  level,
  expandedNodes,
  onNodeToggle,
}) => {
  const isExpanded = expandedNodes.has(node.id);

  const [{ isDragging }, drag] = useDrag({
    type: 'TREE_NODE',
    item: { id: node.id, type: 'TREE_NODE', node, path },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'TREE_NODE',
    drop: (item: DragItem, monitor) => {
      if (monitor.didDrop()) return;
      onNodeMove(item.id, node.id);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  });

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeToggle(node.id);
  };

  const getIcon = () => {
    switch (node.type) {
      case 'context':
        return <FolderIcon className="w-4 h-4 mr-2" />;
      case 'canvas':
        return <File className="w-4 h-4 mr-2" />;
      case 'workspace':
      case 'universe':
        return <FileIcon className="w-4 h-4 mr-2" />;
      default:
        return null;
    }
  };

  return (
    <div ref={drop}>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            ref={drag}
            className={cn(
              'flex items-center py-1 px-2 rounded-md cursor-pointer select-none',
              'hover:bg-gray-100',
              isDragging && 'opacity-50',
              isOver && 'bg-blue-50',
              level > 0 && 'ml-6'
            )}
            style={{ marginLeft: `${level * 1.5}rem` }}
          >
            {node.children.length > 0 && (
              <button onClick={handleToggle} className="p-1">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            {getIcon()}
            <span className={cn('text-sm', node.locked && 'text-gray-400')}>
              {node.name}
            </span>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuItem onClick={() => contextMenuActions.onCut(node.id)}>
            Cut
          </ContextMenuItem>
          <ContextMenuItem onClick={() => contextMenuActions.onCopy(node.id)}>
            Copy
          </ContextMenuItem>
          <ContextMenuItem onClick={() => contextMenuActions.onPaste(node.id)}>
            Paste
          </ContextMenuItem>
          <ContextMenuItem onClick={() => contextMenuActions.onMove(node.id)}>
            Move
          </ContextMenuItem>
          <ContextMenuSeparator />

          <ContextMenuSub>
            <ContextMenuSubTrigger>Create</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => contextMenuActions.onCreateLayer(node.id)}>
                Create Layer
              </ContextMenuItem>
              <ContextMenuItem onClick={() => contextMenuActions.onCreateCanvas(node.id)}>
                Create Canvas
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSub>
            <ContextMenuSubTrigger>Path</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => contextMenuActions.onInsertPath(node.id)}>
                Insert Path
              </ContextMenuItem>
              <ContextMenuItem onClick={() => contextMenuActions.onRemovePath(node.id)}>
                Remove Path
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          <ContextMenuSub>
            <ContextMenuSubTrigger>Rename</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => contextMenuActions.onRenameLayer(node.id)}>
                Rename Layer
              </ContextMenuItem>
              <ContextMenuItem onClick={() => contextMenuActions.onRenameCanvas(node.id)}>
                Rename Canvas
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSub>
            <ContextMenuSubTrigger>Remove</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => contextMenuActions.onRemoveCanvas(node.id)}>
                Remove Canvas
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          <ContextMenuItem onClick={() => contextMenuActions.onMergeUp(node.id)}>
            Merge Up
          </ContextMenuItem>
          <ContextMenuItem onClick={() => contextMenuActions.onMergeDown(node.id)}>
            Merge Down
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isExpanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              path={[...path, node.id]}
              onNodeMove={onNodeMove}
              contextMenuActions={contextMenuActions}
              level={level + 1}
              expandedNodes={expandedNodes}
              onNodeToggle={onNodeToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};
