'use client';

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
