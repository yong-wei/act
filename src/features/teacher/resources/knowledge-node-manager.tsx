'use client';

import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, BookOpen, Eye, Pencil, Lightbulb, Brain, Scale, type LucideIcon } from 'lucide-react';
import { KnowledgeNodeEditDialog } from './knowledge-node-edit-dialog';
import { KnowledgeCardDialog } from '@/features/knowledge/knowledge-card';
import { useRouter } from 'next/navigation';

interface KnowledgeNodeLink {
  relation: string;
  targetNode?: { id: string; name: string; nodeType: string };
  sourceNode?: { id: string; name: string; nodeType: string };
}

interface KnowledgeNode {
  id: string;
  name: string;
  description: string;
  nodeType: string;
  metadata: any;
  sourceLinks: KnowledgeNodeLink[];
  targetLinks: KnowledgeNodeLink[];
}

interface KnowledgeNodeManagerProps {
  nodes: KnowledgeNode[];
  searchQuery: string;
}

const NODE_TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  theory: { icon: Brain, color: 'text-blue-400', label: '理论' },
  application: { icon: Lightbulb, color: 'text-amber-400', label: '应用' },
  ethics: { icon: Scale, color: 'text-rose-400', label: '伦理' },
};

interface TreeNode {
  node: KnowledgeNode;
  children: TreeNode[];
}

export function KnowledgeNodeManager({
  nodes,
  searchQuery,
}: KnowledgeNodeManagerProps) {
  const router = useRouter();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [editingNode, setEditingNode] = useState<KnowledgeNode | null>(null);
  const [previewNode, setPreviewNode] = useState<KnowledgeNode | null>(null);

  // 构建树形结构
  const tree = useMemo(() => {
    const nodeMap = new Map<string, KnowledgeNode>();
    const childrenMap = new Map<string, string[]>();
    const hasParent = new Set<string>();

    // 建立节点映射
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // 建立父子关系 (基于 prerequisite/provides_foundation/follows 关系)
    for (const node of nodes) {
      // targetLinks 中 prerequisite/provides_foundation 关系表示 sourceNode 是前置
      for (const link of node.targetLinks) {
        if (link.relation === 'prerequisite' || link.relation === 'provides_foundation') {
          if (link.sourceNode) {
            if (!childrenMap.has(link.sourceNode.id)) {
              childrenMap.set(link.sourceNode.id, []);
            }
            childrenMap.get(link.sourceNode.id)!.push(node.id);
            hasParent.add(node.id);
          }
        }
      }
      // sourceLinks 中 follows 关系表示 targetNode 是后继
      for (const link of node.sourceLinks) {
        if (link.relation === 'follows') {
          if (link.targetNode) {
            if (!childrenMap.has(node.id)) {
              childrenMap.set(node.id, []);
            }
            childrenMap.get(node.id)!.push(link.targetNode.id);
            hasParent.add(link.targetNode.id);
          }
        }
      }
    }

    // 找根节点（没有父节点的节点）
    const rootIds = nodes
      .filter((n) => !hasParent.has(n.id))
      .map((n) => n.id);

    // 递归构建树
    function buildTree(nodeId: string, visited: Set<string>): TreeNode | null {
      if (visited.has(nodeId)) return null;
      const node = nodeMap.get(nodeId);
      if (!node) return null;

      visited.add(nodeId);
      const childIds = childrenMap.get(nodeId) || [];
      const children: TreeNode[] = [];

      for (const childId of childIds) {
        const childTree = buildTree(childId, visited);
        if (childTree) {
          children.push(childTree);
        }
      }

      return { node, children };
    }

    const roots: TreeNode[] = [];
    const visited = new Set<string>();

    for (const rootId of rootIds) {
      const tree = buildTree(rootId, visited);
      if (tree) {
        roots.push(tree);
      }
    }

    // 添加未被访问的节点（孤立节点）
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        roots.push({ node, children: [] });
      }
    }

    return roots;
  }, [nodes]);

  // 过滤树（搜索时展开所有匹配的路径）
  const filteredTree = useMemo(() => {
    if (!searchQuery) return tree;

    function filterTree(treeNodes: TreeNode[]): TreeNode[] {
      const result: TreeNode[] = [];
      for (const treeNode of treeNodes) {
        const matchesSearch =
          treeNode.node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          treeNode.node.description.toLowerCase().includes(searchQuery.toLowerCase());

        const filteredChildren = filterTree(treeNode.children);

        if (matchesSearch || filteredChildren.length > 0) {
          result.push({
            node: treeNode.node,
            children: filteredChildren,
          });
        }
      }
      return result;
    }

    return filterTree(tree);
  }, [tree, searchQuery]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleSaveNode = async (
    id: string,
    data: { name: string; description: string; metadata: any }
  ) => {
    const res = await fetch(`/api/knowledge/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error('Failed to update node');
    }
    router.refresh();
  };

  const renderTreeNode = (treeNode: TreeNode, depth: number = 0) => {
    const { node, children } = treeNode;
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(node.id) || !!searchQuery;
    const config = NODE_TYPE_CONFIG[node.nodeType] || {
      icon: BookOpen,
      color: 'text-slate-400',
      label: node.nodeType,
    };
    const Icon = config.icon;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-700/50 transition-colors group`}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {/* 展开/折叠按钮 */}
          <button
            onClick={() => toggleExpand(node.id)}
            className={`p-0.5 rounded hover:bg-slate-600 ${hasChildren ? '' : 'invisible'}`}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {/* 节点图标 */}
          <Icon className={`h-4 w-4 ${config.color}`} />

          {/* 节点名称 */}
          <span className="flex-1 text-sm text-white truncate">{node.name}</span>

          {/* 类型标签 */}
          <span className={`px-2 py-0.5 text-[10px] rounded ${config.color} bg-slate-700`}>
            {config.label}
          </span>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setPreviewNode(node)}
              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-600 rounded"
              title="预览"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setEditingNode(node)}
              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-600 rounded"
              title="编辑"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 子节点 */}
        {hasChildren && isExpanded && (
          <div>
            {children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 图例 */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>节点类型:</span>
        {Object.entries(NODE_TYPE_CONFIG).map(([type, config]) => {
          const Icon = config.icon;
          return (
            <span key={type} className="flex items-center gap-1">
              <Icon className={`h-3.5 w-3.5 ${config.color}`} />
              {config.label}
            </span>
          );
        })}
      </div>

      {/* 树形列表 */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 divide-y divide-slate-700/50">
        {filteredTree.length > 0 ? (
          filteredTree.map((treeNode) => renderTreeNode(treeNode))
        ) : (
          <div className="py-12 text-center text-slate-500">
            <BookOpen className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-2">没有找到匹配的知识节点</p>
          </div>
        )}
      </div>

      {/* 编辑对话框 */}
      <KnowledgeNodeEditDialog
        open={!!editingNode}
        onOpenChange={(open) => {
          if (!open) setEditingNode(null);
        }}
        node={editingNode}
        onSave={handleSaveNode}
      />

      {/* 预览对话框 */}
      {previewNode && (
        <KnowledgeCardDialog
          open
          onOpenChange={(open) => {
            if (!open) setPreviewNode(null);
          }}
          node={{
            name: previewNode.name,
            description: previewNode.description,
            nodeType: previewNode.nodeType,
            metadata: previewNode.metadata,
          }}
        />
      )}
    </div>
  );
}
