
'use client';

import React from 'react';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MdxSlide } from '@/components/shared/mdx-slide';
import { getBloomLabel, getKnowledgeDimLabel } from '@/lib/knowledge-labels';

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
  className?: string;
}

export function KnowledgeCard({
  name,
  description,
  nodeType,
  bloomLevel,
  knowledgeDim,
  metadata,
  resources,
  className,
}: KnowledgeCardProps) {
  const bloomLabel = getBloomLabel(bloomLevel);
  const knowledgeLabel = getKnowledgeDimLabel(knowledgeDim);

  const mdxPaths = extractMdxPaths(resources);
  
  // Helper to render type badge
  const renderTypeBadge = () => {
    let colorClass = 'bg-slate-500';
    if (nodeType === 'THEORY') colorClass = 'bg-blue-600';
    if (nodeType === 'SCENARIO') colorClass = 'bg-red-600';
    if (nodeType === 'ETHICS') colorClass = 'bg-green-600';

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${colorClass}`}>
        {nodeType}
      </span>
    );
  };

  return (
    <Card className={`w-full max-w-2xl bg-[#0F172A] text-slate-200 border-slate-700 ${className}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div className="space-y-1">
                <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                    {name}
                    {renderTypeBadge()}
                </CardTitle>
                <CardDescription className="text-slate-400">
                    {description}
                </CardDescription>
            </div>
            {(bloomLabel || knowledgeLabel) && (
                <div className="flex flex-col items-end gap-2 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                        {bloomLabel && (
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300">
                                认知：{bloomLabel}
                            </span>
                        )}
                        {knowledgeLabel && (
                            <span className="rounded-full border border-blue-500/40 bg-blue-500/15 px-2.5 py-0.5 text-xs text-blue-300">
                                知识：{knowledgeLabel}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Content (Rich Text) */}
        {metadata.content && (
            <div className="prose prose-invert max-w-none text-slate-300">
                <p>{metadata.content}</p>
            </div>
        )}

        {/* Formulas */}
        {metadata.formulas && (
            <div className="space-y-4 p-4 bg-slate-900 rounded-lg border border-slate-800">
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

        {/* Applications */}
        {metadata.applications && metadata.applications.length > 0 && (
            <div>
                <h4 className="text-sm font-semibold text-slate-400 mb-2">应用领域</h4>
                <div className="flex flex-wrap gap-2">
                    {metadata.applications.map((app, idx) => (
                        <span key={idx} className="px-2 py-1 rounded-md bg-slate-800 text-xs text-slate-300 border border-slate-700">
                            {app}
                        </span>
                    ))}
                </div>
            </div>
        )}

        {mdxPaths.length > 0 && (
            <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-400">扩展内容</h4>
                {mdxPaths.map((path) => (
                    <MdxSlide key={path} path={path} />
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
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden bg-slate-900 p-0">
        <DialogHeader className="border-b border-slate-800 px-6 py-4">
          <DialogTitle className="text-white">{node.name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(85vh-136px)] overflow-auto p-6">
          <KnowledgeCard
            name={node.name}
            description={node.description}
            nodeType={node.nodeType}
            bloomLevel={node.bloomLevel}
            knowledgeDim={node.knowledgeDim}
            metadata={metadata}
            resources={node.resources}
            className="border-slate-700/50 shadow-2xl bg-[#0F172A]"
          />
        </div>
        <DialogFooter className="border-t border-slate-800 px-6 py-4">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              关闭
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
