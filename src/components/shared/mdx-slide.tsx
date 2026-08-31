'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { createGovernedRehypeKatexOptions } from '@/lib/governed-math';
import { useMdxContent } from '@/hooks/use-mdx-content';

interface MdxSlideProps {
  path: string;
  /** 主题模式：light（白色背景）或 dark（深色背景） */
  theme?: 'light' | 'dark';
  /** 尺寸模式：ppt（固定 1920x1080 缩放）或 adaptive（自适应内容高度） */
  size?: 'ppt' | 'adaptive';
  className?: string;
}

const PPT_WIDTH = 1920;
const PPT_HEIGHT = 1080;

export function MdxSlide({ path, theme = 'dark', size = 'adaptive', className }: MdxSlideProps) {
  const { content, isLoading, error } = useMdxContent(path);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [measuredScale, setMeasuredScale] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width || PPT_WIDTH;
      const nextScale = Math.min(1, width / PPT_WIDTH);
      setMeasuredScale(nextScale);
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 根据主题生成 Markdown 组件样式
  const markdownComponents = useMemo<Components>(() => {
    const isDark = theme === 'dark';

    // 颜色配置
    const textColor = isDark ? 'text-slate-200' : 'text-slate-800';
    const headingColor = isDark ? 'text-white' : 'text-slate-900';
    const subHeadingColor = isDark ? 'text-slate-100' : 'text-slate-800';
    const borderColor = isDark ? 'border-slate-700' : 'border-slate-300';
    const bgColor = isDark ? 'bg-slate-800' : 'bg-slate-100';
    const quoteColor = isDark ? 'text-slate-300' : 'text-slate-700';
    const quoteBorderColor = isDark ? 'border-blue-500/50' : 'border-slate-300';

    // 尺寸配置 - adaptive 模式使用较小字号
    const isAdaptive = size === 'adaptive';
    const h1Size = isAdaptive ? 'text-2xl' : 'text-[36px]';
    const h2Size = isAdaptive ? 'text-xl' : 'text-[30px]';
    const h3Size = isAdaptive ? 'text-lg' : 'text-[26px]';
    const textSize = isAdaptive ? 'text-base' : 'text-[24px]';
    const tableSize = isAdaptive ? 'text-sm' : 'text-[22px]';

    return {
      h1: ({ node, children, ...props }) => (
        <h1 className={`${h1Size} font-semibold leading-tight ${headingColor} mb-4`} {...props}>
          {children}
        </h1>
      ),
      h2: ({ node, children, ...props }) => (
        <h2 className={`${h2Size} font-semibold leading-snug ${subHeadingColor} mt-5 mb-3`} {...props}>
          {children}
        </h2>
      ),
      h3: ({ node, children, ...props }) => (
        <h3 className={`${h3Size} font-semibold leading-snug ${subHeadingColor} mt-4 mb-2`} {...props}>
          {children}
        </h3>
      ),
      p: ({ node, children, ...props }) => (
        <p className={`${textSize} leading-relaxed ${textColor}`} {...props}>
          {children}
        </p>
      ),
      li: ({ node, children, ...props }) => (
        <li className={`${textSize} leading-relaxed ${textColor}`} {...props}>
          {children}
        </li>
      ),
      ul: ({ node, children, ...props }) => (
        <ul className={`list-disc ${isAdaptive ? 'ml-6' : 'ml-10'} space-y-1`} {...props}>
          {children}
        </ul>
      ),
      ol: ({ node, children, ...props }) => (
        <ol className={`list-decimal ${isAdaptive ? 'ml-6' : 'ml-10'} space-y-1`} {...props}>
          {children}
        </ol>
      ),
      table: ({ node, children, ...props }) => (
        <div className="overflow-x-auto my-3">
          <table className={`w-full border-collapse ${tableSize} ${textColor}`} {...props}>
            {children}
          </table>
        </div>
      ),
      th: ({ node, children, ...props }) => (
        <th className={`border ${borderColor} ${bgColor} px-3 py-2 text-left font-semibold`} {...props}>
          {children}
        </th>
      ),
      td: ({ node, children, ...props }) => (
        <td className={`border ${borderColor} px-3 py-2`} {...props}>
          {children}
        </td>
      ),
      blockquote: ({ node, children, ...props }) => (
        <blockquote className={`border-l-4 ${quoteBorderColor} pl-4 ${textSize} ${quoteColor} italic my-3`} {...props}>
          {children}
        </blockquote>
      ),
      strong: ({ node, children, ...props }) => (
        <strong className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`} {...props}>
          {children}
        </strong>
      ),
      code: ({ node, children, className: codeClassName, ...props }) => {
        // 内联代码
        if (!codeClassName) {
          return (
            <code
              className={`px-1.5 py-0.5 rounded text-sm font-mono ${
                isDark ? 'bg-slate-800 text-blue-300' : 'bg-slate-100 text-blue-600'
              }`}
              {...props}
            >
              {children}
            </code>
          );
        }
        // 代码块
        return (
          <code className={codeClassName} {...props}>
            {children}
          </code>
        );
      },
      pre: ({ node, children, ...props }) => (
        <pre
          className={`${isAdaptive ? 'p-3' : 'p-4'} rounded-lg overflow-x-auto text-sm font-mono my-3 ${
            isDark ? 'bg-slate-800/80' : 'bg-slate-100'
          }`}
          {...props}
        >
          {children}
        </pre>
      ),
    };
  }, [theme, size]);

  // 加载状态
  if (isLoading) {
    const bgClass = theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white';
    const textClass = theme === 'dark' ? 'text-slate-400' : 'text-slate-600';
    return (
      <div className={`w-full ${className || ''}`}>
        <div className={`rounded-xl border ${bgClass} p-6 ${textClass}`}>
          正在加载内容...
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className={`w-full ${className || ''}`}>
        <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-6 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!content) return null;

  // 样式配置
  const isDark = theme === 'dark';
  const containerBg = isDark ? 'bg-slate-900' : 'bg-white';
  const borderStyle = isDark ? 'border-slate-700' : 'border-slate-200';
  const scale = size === 'ppt' ? measuredScale : 1;

  // PPT 模式：固定尺寸缩放
  if (size === 'ppt') {
    return (
      <div ref={containerRef} className={`w-full ${className || ''}`}>
        <div style={{ height: `${PPT_HEIGHT * scale}px` }}>
          <div
            className={`origin-top-left rounded-2xl border ${borderStyle} ${containerBg} shadow-lg`}
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
                  rehypePlugins={[[rehypeKatex, createGovernedRehypeKatexOptions()]]}
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

  // Adaptive 模式：自适应内容高度
  return (
    <div ref={containerRef} className={`w-full ${className || ''}`}>
      <div
        className={`rounded-xl border ${borderStyle} ${containerBg} shadow-md`}
      >
        <div className="p-6">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeKatex, createGovernedRehypeKatexOptions()]]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
