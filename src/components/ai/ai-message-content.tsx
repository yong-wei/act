/**
 * AI Message Content 组件
 *
 * 封装 react-markdown 和 KaTeX 渲染逻辑
 * 支持 GitHub Flavored Markdown (表格、代码块等)
 * 支持 LaTeX 公式（行内 $...$ 和块级 $$...$$）
 */

'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { sanitizeAiVisibleContent } from '@/lib/ai-task-boundary-contracts';

interface AIMessageContentProps {
  content: string;
  className?: string;
  sanitizeContent?: boolean;
}

/**
 * AI 消息内容渲染组件
 *
 * 支持：
 * - Markdown 基础语法（粗体、斜体、列表、链接等）
 * - GitHub Flavored Markdown（表格、删除线、任务列表等）
 * - LaTeX 公式（行内 $...$ 和块级 $$...$$）
 * - 代码块（带语法高亮）
 */
export function AIMessageContent({ content, className = '', sanitizeContent = true }: AIMessageContentProps) {
  if (!content) return null;
  const visibleContent = sanitizeContent
    ? sanitizeVerifiedCitationMarkdown(sanitizeAiVisibleContent(content))
    : content;

  return (
    <div className={`ai-message-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // 代码块
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !className;

            if (isInline) {
              return (
                <code
                  className="rounded bg-slate-700/50 px-1.5 py-0.5 text-sm font-mono text-amber-300"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <pre className="my-2 overflow-x-auto rounded-lg bg-slate-900/80 p-3">
                <code
                  className={`text-sm font-mono text-slate-300 ${match ? `language-${match[1]}` : ''}`}
                  {...props}
                >
                  {children}
                </code>
              </pre>
            );
          },
          // 段落
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          // 列表
          ul({ children }) {
            return <ul className="mb-2 list-inside list-disc space-y-1 last:mb-0">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="mb-2 list-inside list-decimal space-y-1 last:mb-0">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          // 标题
          h1({ children }) {
            return <h1 className="mb-2 text-lg font-bold text-white">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="mb-2 text-base font-semibold text-white">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="mb-2 text-sm font-semibold text-slate-200">{children}</h3>;
          },
          // 表格
          table({ children }) {
            return (
              <div className="my-2 overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-slate-800/50">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="border border-slate-700 px-3 py-2 text-left font-semibold text-slate-200">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-slate-700 px-3 py-2 text-slate-300">{children}</td>
            );
          },
          // 引用块
          blockquote({ children }) {
            return (
              <blockquote className="my-2 border-l-4 border-amber-500/50 bg-slate-800/30 pl-4 italic text-slate-400">
                {children}
              </blockquote>
            );
          },
          // 水平线
          hr() {
            return <hr className="my-4 border-slate-700" />;
          },
          // 链接
          a({ children }) {
            return <span data-suppressed-model-link>{children}</span>;
          },
        }}
      >
        {visibleContent}
      </ReactMarkdown>
    </div>
  );
}

export default AIMessageContent;

export function sanitizeVerifiedCitationMarkdown(content: string): string {
  return content
    .replace(/^[ \t]*\[\^[^\]\n]+\]:[^\n]*(?:\n[ \t]{2,}[^\n]*)*/gm, '')
    .replace(/\[([^\]\n]+)\]\((?:\/knowledge)?#user-content-fn(?:ref)?[^)]*\)/gi, '')
    .replace(/\[\^[^\]\n]+\]/g, '')
    .replace(/[ \t]*\[证据:\s*[A-Za-z0-9:_-]+\]/g, '')
    .replace(/[ \t]*\[content:\s*[^\]\n]+\]/gi, '')
    .replace(/\[([^\]\n]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/[^\s)\]}，。；、]+/gi, '')
    .replace(/["']?(?:canonicalKey|bookId|edition|sourceRevision|unitId|fragmentId|structuralPath|identity)["']?\s*[:=]\s*(?:\{[^}\n]*\}|\[[^\]\n]*\]|"[^"\n]*"|'[^'\n]*'|[^\s,，。；;)\]}]+)/gi, '')
    .replace(/\b(?:textbook-(?:unit|fragment|window)|textbook):[^\s,，。；;)\]}]+/gi, '')
    .replace(/\b(?:hu-shousong-auto-control-(?:7th|8th)|liu-sheng-auto-control-2015|dorf-modern-control-systems|feedback-control-of-dynamic-systems|hu-shousong-exercise-analysis-3rd|control-encyclopedia)\b/gi, '')
    .replace(/\b(?:chapter|section)-[a-z0-9._-]+\b/gi, '')
    .replace(/(?:file:\/\/|\/(?:Users|home|workspace|course-content|src|var|tmp)\/)[^\s)\]}]+/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
