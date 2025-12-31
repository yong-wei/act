'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useMdxContent } from '@/hooks/use-mdx-content';

interface MdxSlideProps {
  path: string;
  className?: string;
}

const PPT_WIDTH = 1920;
const PPT_HEIGHT = 1080;

export function MdxSlide({ path, className }: MdxSlideProps) {
  const { content, isLoading, error } = useMdxContent(path);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width || PPT_WIDTH;
      const nextScale = Math.min(1, width / PPT_WIDTH);
      setScale(nextScale);
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const markdownComponents = useMemo<Components>(
    () => ({
      h1: ({ node, children, ...props }) => (
        <h1 className="text-[36px] font-semibold leading-tight text-slate-900 mb-6" {...props}>
          {children}
        </h1>
      ),
      h2: ({ node, children, ...props }) => (
        <h2 className="text-[30px] font-semibold leading-snug text-slate-800 mt-6 mb-4" {...props}>
          {children}
        </h2>
      ),
      h3: ({ node, children, ...props }) => (
        <h3 className="text-[26px] font-semibold leading-snug text-slate-800 mt-4 mb-3" {...props}>
          {children}
        </h3>
      ),
      p: ({ node, children, ...props }) => (
        <p className="text-[24px] leading-relaxed text-slate-800" {...props}>
          {children}
        </p>
      ),
      li: ({ node, children, ...props }) => (
        <li className="text-[24px] leading-relaxed text-slate-800" {...props}>
          {children}
        </li>
      ),
      ul: ({ node, children, ...props }) => (
        <ul className="list-disc ml-10 space-y-2" {...props}>
          {children}
        </ul>
      ),
      ol: ({ node, children, ...props }) => (
        <ol className="list-decimal ml-10 space-y-2" {...props}>
          {children}
        </ol>
      ),
      table: ({ node, children, ...props }) => (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[22px] text-slate-800" {...props}>
            {children}
          </table>
        </div>
      ),
      th: ({ node, children, ...props }) => (
        <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold" {...props}>
          {children}
        </th>
      ),
      td: ({ node, children, ...props }) => (
        <td className="border border-slate-300 px-3 py-2" {...props}>
          {children}
        </td>
      ),
      blockquote: ({ node, children, ...props }) => (
        <blockquote className="border-l-4 border-slate-300 pl-4 text-[24px] text-slate-700 italic" {...props}>
          {children}
        </blockquote>
      ),
    }),
    []
  );

  if (isLoading) {
    return (
      <div className={`w-full ${className || ''}`}>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
          正在加载内容...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-full ${className || ''}`}>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-500">
          {error}
        </div>
      </div>
    );
  }

  if (!content) return null;

  return (
    <div ref={containerRef} className={`w-full ${className || ''}`}>
      <div style={{ height: `${PPT_HEIGHT * scale}px` }}>
        <div
          className="origin-top-left rounded-2xl border border-slate-200 bg-white shadow-lg"
          style={{
            width: `${PPT_WIDTH}px`,
            height: `${PPT_HEIGHT}px`,
            transform: `scale(${scale})`,
          }}
        >
          <div className="h-full w-full overflow-hidden">
            <div className="h-full w-full overflow-auto p-16">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={markdownComponents}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
