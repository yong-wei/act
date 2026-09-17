'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import 'katex/dist/katex.min.css';
import { createGovernedRehypeKatexOptions } from '@/lib/governed-math';

export function InspectorLearnerMarkdown({ children }: { children: string }) {
  const text = children.trim();
  if (!text) return null;
  return (
    <div
      data-inspector-learner-markdown="true"
      className="[&_p]:m-0 [&_p+p]:mt-2 [&_.katex]:text-[1.05em] [&_.katex-display]:my-2"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, createGovernedRehypeKatexOptions()]]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function InspectorKnowledgeCardPanel({
  summary,
  insight,
  explanation,
}: {
  summary: string;
  insight?: string | null;
  explanation?: string | null;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const detail = explanation?.trim() ?? '';
  const homepage = [summary.trim(), insight?.trim() ?? ''].filter(Boolean);
  const hasDistinctDetail = Boolean(detail) && !homepage.includes(detail);
  return (
    <div data-inspector-card-panel="true" className="mt-2 space-y-2 text-sm leading-6 text-platform-fg-secondary">
      <InspectorLearnerMarkdown>{summary}</InspectorLearnerMarkdown>
      {insight ? <InspectorLearnerMarkdown>{insight}</InspectorLearnerMarkdown> : null}
      {hasDistinctDetail ? (
        <>
          <button
            type="button"
            data-inspector-card-detail-toggle=""
            aria-expanded={detailOpen}
            onClick={() => setDetailOpen((open) => !open)}
            className="inline-flex items-center rounded-full border border-platform-border px-3 py-1 text-xs font-medium text-platform-fg-primary transition hover:bg-platform-canvas-muted"
          >
            {detailOpen ? '收起详情' : '详情'}
          </button>
          {detailOpen ? (
            <div data-inspector-card-detail="true">
              <InspectorLearnerMarkdown>{detail}</InspectorLearnerMarkdown>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
