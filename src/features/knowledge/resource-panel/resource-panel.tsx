'use client';

/**
 * ResourcePanel - 知识图谱右侧资源面板
 */

import { useEffect, useState } from 'react';
import { BookOpen, FileText, X } from 'lucide-react';
import type { KnowledgeNodeData } from '../knowledge-graph-system';
import { extractMdxPaths, KnowledgeCardDialog } from '../knowledge-card';

interface ResourcePanelProps {
  isOpen: boolean;
  selectedNode: KnowledgeNodeData | null;
  onClose: () => void;
}

export function ResourcePanel({ isOpen, selectedNode, onClose }: ResourcePanelProps) {
  const [nodeDetail, setNodeDetail] = useState<KnowledgeNodeDetail | null>(null);
  const [isCardOpen, setIsCardOpen] = useState(false);

  useEffect(() => {
    if (!selectedNode) return;

    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/knowledge/nodes/${selectedNode.id}`);
        if (!res.ok) return;
        const data = (await res.json()) as KnowledgeNodeData;
        setNodeDetail(data);
      } catch (error) {
        console.error('Failed to fetch knowledge node detail:', error);
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

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
  };

  const renderJson = (value: unknown) => {
    if (value === undefined || value === null) return '-';
    return JSON.stringify(value, null, 2);
  };

  return (
    <aside
      className={`absolute right-0 top-0 h-full w-[40%] min-w-[350px] max-w-[600px] transform overflow-y-auto border-l border-blue-500/30 bg-[#091540]/95 transition-transform duration-300 z-50 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-blue-500/30 p-4 sticky top-0 bg-[#091540]/95 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-400" />
          <span className="font-medium truncate max-w-[200px]">{selectedNode.name}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 transition-colors hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        <div className="space-y-6">
          <section className="rounded-lg border border-blue-500/20 bg-[#0c1d4f]/50 p-4">
            <h3 className="text-sm font-semibold text-blue-400">基本信息</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <InfoRow label="ID" value={displayNode.id} />
              <InfoRow label="名称" value={displayNode.name} />
              <InfoRow label="类型" value={displayNode.nodeType} />
              <InfoRow label="描述" value={displayNode.description} />
              <InfoRow label="认知层级" value={displayNode.bloomLevel || '-'} />
              <InfoRow label="知识维度" value={displayNode.knowledgeDim || '-'} />
              <InfoRow
                label="标签"
                value={displayNode.tags && displayNode.tags.length > 0 ? displayNode.tags.join(' / ') : '-'}
              />
              <InfoRow
                label="激活"
                value={displayNode.isActive === undefined ? '-' : (displayNode.isActive ? '是' : '否')}
              />
              <InfoRow label="创建时间" value={formatDate(displayNode.createdAt)} />
              <InfoRow
                label="坐标"
                value={`${displayNode.positionX}, ${displayNode.positionY}, ${displayNode.positionZ}`}
              />
            </div>
          </section>

          <section className="rounded-lg border border-blue-500/20 bg-[#0c1d4f]/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-blue-400">知识卡片</h3>
              {hasKnowledgeCard ? (
                <button
                  type="button"
                  onClick={() => setIsCardOpen(true)}
                  className="flex items-center gap-2 rounded-md bg-blue-500/20 px-3 py-2 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/30"
                >
                  <BookOpen className="h-4 w-4" />
                  查看知识卡片
                </button>
              ) : (
                <span className="text-xs text-slate-500">未关联</span>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              知识卡片内容不会在此处渲染，仅在弹窗中展示完整卡片。
            </p>
          </section>

          <section className="rounded-lg border border-blue-500/20 bg-[#0c1d4f]/50 p-4">
            <h3 className="text-sm font-semibold text-blue-400">完整数据</h3>
            <div className="mt-4 space-y-4 text-xs text-slate-300">
              <div>
                <div className="text-slate-500">metadata</div>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-[#020721] p-3 text-[11px] text-slate-300">
                  {renderJson(displayNode.metadata)}
                </pre>
              </div>
              <div>
                <div className="text-slate-500">content</div>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-[#020721] p-3 text-[11px] text-slate-300">
                  {renderJson(displayNode.content)}
                </pre>
              </div>
              <div>
                <div className="text-slate-500">resources</div>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-[#020721] p-3 text-[11px] text-slate-300">
                  {renderJson(displayNode.resources)}
                </pre>
              </div>
              <div>
                <div className="text-slate-500">ethicsContent</div>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-[#020721] p-3 text-[11px] text-slate-300">
                  {renderJson(displayNode.ethicsContent)}
                </pre>
              </div>
            </div>
          </section>
        </div>
      </div>

      <KnowledgeCardDialog
        open={isCardOpen}
        onOpenChange={setIsCardOpen}
        node={displayNode}
      />
    </aside>
  );
}

interface KnowledgeNodeDetail extends KnowledgeNodeData {
  tags?: string[];
  isActive?: boolean;
  createdAt?: string;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      <span className="break-words text-sm text-slate-200">{value}</span>
    </div>
  );
}
