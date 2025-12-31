
'use client';

import React from 'react';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MdxSlide } from '@/components/shared/mdx-slide';
import { getBloomLabel, getKnowledgeDimLabel } from '@/lib/knowledge-labels';

// Define standardized metadata structure (matches what we seeded)
interface KnowledgeMetadata {
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

  const mdxPaths = Array.isArray(resources)
    ? resources
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            const candidate = (item as { path?: string; url?: string }).path
              || (item as { path?: string; url?: string }).url;
            return typeof candidate === 'string' ? candidate : null;
          }
          return null;
        })
        .filter((path): path is string => !!path && path.endsWith('.mdx'))
    : [];
  
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
