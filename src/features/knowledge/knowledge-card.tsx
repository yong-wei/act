
'use client';

import React from 'react';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import { X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MdxSlide } from '@/components/shared/mdx-slide';
import { getBloomLabel, getKnowledgeDimLabel, getNodeTypeLabel } from '@/lib/knowledge-labels';

// Define standardized metadata structure (matches what we seeded)
export interface KnowledgeMetadata {
  type: string;
  content?: string;
  formulas?: {
    continuous?: string;
    discrete?: string;
  };
  learningObjectives?: string[];
  applications?: string[];
  lessonId?: string;
  phase?: string;
}

export interface KnowledgeCardSource {
  name: string;
  description: string;
  nodeType: string;
  bloomLevel?: string;
  knowledgeDim?: string;
  metadata?: Record<string, unknown> | null;
  content?: Record<string, unknown> | null;
  resources?: unknown[];
}

export function extractMdxPaths(resources?: unknown[]): string[] {
  if (!Array.isArray(resources)) return [];
  return resources
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const candidate = (item as { path?: string; url?: string }).path
          || (item as { path?: string; url?: string }).url;
        return typeof candidate === 'string' ? candidate : null;
      }
      return null;
    })
    .filter((path): path is string => !!path && path.endsWith('.mdx'));
}

export function normalizeKnowledgeMetadata({
  metadata,
  content,
  description,
}: {
  metadata?: Record<string, unknown> | null;
  content?: Record<string, unknown> | null;
  description?: string;
}): KnowledgeMetadata {
  const safeMetadata = (metadata ?? {}) as Record<string, unknown>;
  const legacyContent = (content ?? {}) as Record<string, unknown>;
  const formulas = (safeMetadata.formulas ?? {}) as Record<string, unknown>;

  return {
    type: 'rich-text',
    content: (safeMetadata.content as string)
      || (safeMetadata.explanation as string)
      || (legacyContent.explanation as string)
      || description
      || '',
    formulas: {
      continuous: (formulas.continuous as string)
        || (safeMetadata.formulaContinuous as string)
        || (legacyContent.formulaContinuous as string),
      discrete: (formulas.discrete as string)
        || (safeMetadata.formulaDiscrete as string)
        || (legacyContent.formulaDiscrete as string),
    },
    learningObjectives: (safeMetadata.learningObjectives as string[])
      || (legacyContent.learningObjectives as string[]),
    applications: (safeMetadata.applications as string[])
      || (legacyContent.applications as string[])
      || [],
    lessonId: (safeMetadata.lessonId as string)
      || (legacyContent.lessonId as string),
    phase: (safeMetadata.phase as string)
      || (legacyContent.phase as string),
  };
}

interface KnowledgeCardProps {
  name: string;
  description: string;
  nodeType: string;
  bloomLevel?: string;
  knowledgeDim?: string;
  metadata: KnowledgeMetadata;
  resources?: unknown[];
  /** 显示模式：full（完整）或 compact（紧凑） */
  variant?: 'full' | 'compact';
  className?: string;
  /** 关闭按钮回调（传入时显示关闭按钮） */
  onClose?: () => void;
}

export function KnowledgeCard({
  name,
  description,
  nodeType,
  bloomLevel,
  knowledgeDim,
  metadata,
  resources,
  variant = 'compact',
  className,
  onClose,
}: KnowledgeCardProps) {
  const bloomLabel = getBloomLabel(bloomLevel);
  const knowledgeLabel = getKnowledgeDimLabel(knowledgeDim);
  const typeLabel = getNodeTypeLabel(nodeType);

  const mdxPaths = extractMdxPaths(resources);
  const isCompact = variant === 'compact';

  // Helper to render type badge with Chinese label
  const renderTypeBadge = () => {
    let colorClass = 'bg-slate-500';
    if (nodeType === 'THEORY') colorClass = 'bg-blue-600';
    if (nodeType === 'SCENARIO') colorClass = 'bg-red-600';
    if (nodeType === 'ETHICS') colorClass = 'bg-green-600';

    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${colorClass}`}>
        {typeLabel || nodeType}
      </span>
    );
  };

  // 判断是否有 MDX 内容（如果有则不显示 metadata.content）
  const hasMdxContent = mdxPaths.length > 0;
  // 检查 metadata.content 是否为 MDX 格式（包含 Markdown 标记）
  const isMdxFormat = metadata.type === 'mdx' || (metadata.content && (
    metadata.content.includes('#') ||
    metadata.content.includes('$$') ||
    metadata.content.includes('**')
  ));

  return (
    <Card className={`w-full bg-[#0F172A] text-slate-200 border-slate-700 relative ${className || ''}`}>
      {/* 关闭按钮 - 仅在传入 onClose 时显示 */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <CardHeader className={`${isCompact ? 'pb-3' : 'pb-4'} ${onClose ? 'pr-12' : ''}`}>
        <div className="flex justify-between items-start gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <CardTitle className={`${isCompact ? 'text-xl' : 'text-2xl'} font-bold text-white flex items-center gap-2 flex-wrap`}>
              <span className="truncate">{name}</span>
              {renderTypeBadge()}
            </CardTitle>
            <CardDescription className={`text-slate-400 ${isCompact ? 'line-clamp-2' : ''}`}>
              {description}
            </CardDescription>
          </div>
          {(bloomLabel || knowledgeLabel) && (
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {bloomLabel && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300 whitespace-nowrap">
                  认知：{bloomLabel}
                </span>
              )}
              {knowledgeLabel && (
                <span className="rounded-full border border-blue-500/40 bg-blue-500/15 px-2 py-0.5 text-xs text-blue-300 whitespace-nowrap">
                  知识：{knowledgeLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className={isCompact ? 'space-y-3 pt-0' : 'space-y-5'}>
        {/* Main Content - 仅在没有 MDX 文件且不是 MDX 格式时显示纯文本 */}
        {metadata.content && !hasMdxContent && !isMdxFormat && (
          <div className="prose prose-invert max-w-none text-slate-300">
            <p className={isCompact ? 'text-sm' : 'text-base'}>{metadata.content}</p>
          </div>
        )}

        {/* Formulas - 仅在没有 MDX 内容时显示 */}
        {!hasMdxContent && metadata.formulas && (metadata.formulas.continuous || metadata.formulas.discrete) && (
          <div className={`space-y-3 ${isCompact ? 'p-3' : 'p-4'} bg-slate-900 rounded-lg border border-slate-800`}>
            <h4 className="text-sm font-semibold text-blue-400">数学表达</h4>
            {metadata.formulas.continuous && (
              <div>
                <div className="text-xs text-slate-500 mb-1">连续时间</div>
                <BlockMath math={metadata.formulas.continuous} />
              </div>
            )}
            {metadata.formulas.discrete && (
              <div>
                <div className="text-xs text-slate-500 mb-1">离散时间</div>
                <BlockMath math={metadata.formulas.discrete} />
              </div>
            )}
          </div>
        )}

        {/* Applications - 仅在没有 MDX 内容时显示 */}
        {!hasMdxContent && metadata.applications && metadata.applications.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-2">应用领域</h4>
            <div className="flex flex-wrap gap-1.5">
              {metadata.applications.map((app, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-800 text-xs text-slate-300 border border-slate-700">
                  {app}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* MDX Content - 使用暗色主题和自适应尺寸 */}
        {mdxPaths.length > 0 && (
          <div className="space-y-3">
            {mdxPaths.map((path) => (
              <MdxSlide key={path} path={path} theme="dark" size="adaptive" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface KnowledgeCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: KnowledgeCardSource;
}

export function KnowledgeCardDialog({
  open,
  onOpenChange,
  node,
}: KnowledgeCardDialogProps) {
  const metadata = normalizeKnowledgeMetadata({
    metadata: node.metadata,
    content: node.content,
    description: node.description,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[75vh] overflow-hidden bg-slate-900 border-slate-700 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{node.name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[75vh] overflow-y-auto">
          <KnowledgeCard
            name={node.name}
            description={node.description}
            nodeType={node.nodeType}
            bloomLevel={node.bloomLevel}
            knowledgeDim={node.knowledgeDim}
            metadata={metadata}
            resources={node.resources}
            variant="compact"
            className="border-0 bg-transparent shadow-none"
            onClose={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
