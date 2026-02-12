'use client';

/**
 * ResourcePanel - 知识图谱右侧资源面板（精简版）
 *
 * 显示内容：
 * - 基本信息：名称、类型（中文）、描述、认知层级、知识维度
 * - 关联知识点列表
 * - 查看知识卡片按钮
 */

import { useEffect, useState } from 'react';
import { BookOpen, FileText, X, ArrowRight, Link2 } from 'lucide-react';
import type { KnowledgeNodeData } from '../knowledge-graph-system';
import { extractMdxPaths, KnowledgeCardDialog } from '../knowledge-card';
import {
  getBloomLabel,
  getKnowledgeDimLabel,
  getNodeTypeLabel,
  getRelationLabel,
} from '@/lib/knowledge-labels';

// 关联知识点类型
interface RelatedNode {
  id: string;
  name: string;
  nodeType: string;
  relation: string;
  category: 'prerequisite' | 'follows' | 'related';
  strength?: number;
}

// 扩展的节点详情类型
interface KnowledgeNodeDetail extends KnowledgeNodeData {
  tags?: string[];
  isActive?: boolean;
  createdAt?: string;
  relatedNodes?: RelatedNode[];
}

interface ResourcePanelProps {
  isOpen: boolean;
  selectedNode: KnowledgeNodeData | null;
  onClose: () => void;
  /** 点击关联知识点时的回调 */
  onNodeClick?: (nodeId: string) => void;
}

export function ResourcePanel({
  isOpen,
  selectedNode,
  onClose,
  onNodeClick,
}: ResourcePanelProps) {
  const [nodeDetail, setNodeDetail] = useState<KnowledgeNodeDetail | null>(null);
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedNode) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/knowledge/nodes/${selectedNode.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setNodeDetail(data);
      } catch (error) {
        console.error('Failed to fetch knowledge node detail:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setNodeDetail(null);
    setIsCardOpen(false);
    fetchDetail();
  }, [selectedNode]);

  useEffect(() => {
    if (!isOpen) {
      setIsCardOpen(false);
    }
  }, [isOpen]);

  if (!isOpen || !selectedNode) return null;

  const displayNode = (nodeDetail || selectedNode) as KnowledgeNodeDetail;
  const mdxPaths = extractMdxPaths(displayNode.resources);
  const knowledgeCardPaths = mdxPaths.filter((path) => path.startsWith('content/concepts/'));
  const hasKnowledgeCard = knowledgeCardPaths.length > 0;

  // 获取中文标签
  const typeLabel = getNodeTypeLabel(displayNode.nodeType);
  const bloomLabel = getBloomLabel(displayNode.bloomLevel);
  const knowledgeLabel = getKnowledgeDimLabel(displayNode.knowledgeDim);

  // 节点类型颜色
  const getTypeColor = (type: string) => {
    if (type === 'THEORY') return 'bg-blue-600';
    if (type === 'SCENARIO') return 'bg-red-600';
    if (type === 'ETHICS') return 'bg-green-600';
    return 'bg-slate-500';
  };

  // 关联类型标签颜色
  const getCategoryColor = (category: string) => {
    if (category === 'prerequisite') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (category === 'follows') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  };

  const relatedNodes = displayNode.relatedNodes || [];

  return (
    <aside
      className={`absolute right-0 top-0 h-full w-[280px] transform overflow-y-auto border-l border-blue-500/30 bg-[#091540] transition-transform duration-300 z-50 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-blue-500/30 p-4 sticky top-0 bg-[#091540] z-10">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="font-medium text-sm truncate">{selectedNode.name}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 transition-colors hover:text-slate-200 shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="p-4 text-center text-slate-400 text-sm">
          加载中...
        </div>
      )}

      {/* 内容区域 */}
      {!isLoading && (
        <div className="p-4 space-y-4">
          {/* 基本信息 */}
          <section className="space-y-3">
            {/* 类型徽章 */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${getTypeColor(displayNode.nodeType)}`}>
                {typeLabel}
              </span>
              {bloomLabel && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                  {bloomLabel}
                </span>
              )}
              {knowledgeLabel && (
                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300">
                  {knowledgeLabel}
                </span>
              )}
            </div>

            {/* 描述 */}
            <p className="text-sm text-slate-300 leading-relaxed">
              {displayNode.description}
            </p>
          </section>

          {/* 关联知识点 */}
          {relatedNodes.length > 0 && (
            <section className="rounded-lg border border-blue-500/20 bg-[#0c1d4f]/50 p-3">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-medium text-blue-400">关联知识点</h3>
              </div>
              <ul className="space-y-2">
                {relatedNodes.map((node) => (
                  <li key={node.id}>
                    <button
                      onClick={() => onNodeClick?.(node.id)}
                      className="w-full flex items-center gap-2 p-2 rounded-md bg-slate-800/50 hover:bg-slate-700/50 transition-colors text-left group"
                    >
                      <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded border ${getCategoryColor(node.category)}`}>
                        {getRelationLabel(node.relation)}
                      </span>
                      <span className="text-sm text-slate-200 truncate flex-1 group-hover:text-white">
                        {node.name}
                      </span>
                      {typeof node.strength === 'number' && (
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {node.strength.toFixed(1)}
                        </span>
                      )}
                      <ArrowRight className="h-3 w-3 text-slate-500 group-hover:text-blue-400 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 查看知识卡片按钮 */}
          <section className="rounded-lg border border-blue-500/20 bg-[#0c1d4f]/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-medium text-blue-400">知识卡片</h3>
              </div>
              {hasKnowledgeCard ? (
                <button
                  type="button"
                  onClick={() => setIsCardOpen(true)}
                  className="flex items-center gap-1.5 rounded-md bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/30"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  查看卡片
                </button>
              ) : (
                <span className="text-xs text-slate-500">未关联</span>
              )}
            </div>
            {hasKnowledgeCard && (
              <p className="mt-2 text-xs text-slate-500">
                点击查看完整的知识卡片内容
              </p>
            )}
          </section>
        </div>
      )}

      <KnowledgeCardDialog
        open={isCardOpen}
        onOpenChange={setIsCardOpen}
        node={displayNode}
      />
    </aside>
  );
}
