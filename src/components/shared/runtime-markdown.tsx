import type { Components } from 'react-markdown';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import { TEXTBOOK_CITATION_MARKDOWN_ANCHOR_PREFIX } from '@/lib/textbook-citation-targets';

export interface RuntimeMarkdownContentProps {
  markdown: string;
  resolveAssetHref: (href: string) => string;
  mode?: 'handout' | 'textbook-citation';
}

const textbookCitationAnchorMarkerPattern = new RegExp(
  `\\[\\[${TEXTBOOK_CITATION_MARKDOWN_ANCHOR_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([A-Za-z][A-Za-z0-9_.:-]{0,127})\\]\\]`,
  'g',
);

function renderMarkdownTextWithCitationAnchors(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(textbookCitationAnchorMarkerPattern)) {
    const markerIndex = match.index ?? 0;
    if (markerIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, markerIndex));
    }
    const anchorId = match[1];
    nodes.push(
      <span
        key={`textbook-citation-anchor:${anchorId}:${markerIndex}`}
        id={anchorId}
        className="inline-block h-0 w-0 scroll-mt-24 overflow-hidden align-top"
        aria-hidden="true"
        data-textbook-citation-anchor={anchorId}
      />,
    );
    lastIndex = markerIndex + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function renderChildrenWithCitationAnchors(children: React.ReactNode): React.ReactNode {
  return React.Children.toArray(children).flatMap((child) => (
    typeof child === 'string'
      ? renderMarkdownTextWithCitationAnchors(child)
      : [child]
  ));
}

function createRuntimeMarkdownComponents(
  resolveAssetHref: (href: string) => string,
  mode: RuntimeMarkdownContentProps['mode'],
): Components {
  const citationMode = mode === 'textbook-citation';
  const headingColor = citationMode ? 'text-zinc-950 dark:text-zinc-50' : 'text-slate-950';
  const bodyColor = citationMode ? 'text-zinc-800 dark:text-zinc-100' : 'text-slate-800';
  const borderColor = citationMode ? 'border-zinc-200 dark:border-zinc-800' : 'border-slate-200';
  const blockquoteClassName = citationMode
    ? 'border-l-4 border-sky-300 bg-sky-50/80 px-4 py-3 text-[15px] leading-7 text-slate-700 dark:bg-sky-950/30 dark:text-sky-100'
    : 'border-l-4 border-sky-300 bg-sky-50/80 px-4 py-3 text-[15px] leading-7 text-slate-700';
  const tableHeadClassName = citationMode
    ? `border ${borderColor} bg-slate-100 px-3 py-2 text-left font-semibold dark:bg-zinc-900`
    : `border ${borderColor} bg-slate-100 px-3 py-2 text-left font-semibold`;
  const imageClassName = citationMode
    ? 'my-5 w-full rounded-2xl border border-slate-200 bg-white object-contain dark:border-zinc-800'
    : 'my-5 w-full rounded-2xl border border-slate-200 bg-white object-contain';
  const anchorClassName = citationMode
    ? 'text-sky-700 underline underline-offset-2 dark:text-sky-300'
    : 'text-sky-700 underline underline-offset-2';
  const inlineCodeClassName = citationMode
    ? 'rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-slate-900 dark:bg-zinc-800 dark:text-zinc-100'
    : 'rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-slate-900';
  const codeBlockClassName = citationMode
    ? 'block overflow-x-auto rounded-2xl bg-slate-950 p-4 text-[13px] text-slate-100'
    : 'block overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-4 text-[13px] text-slate-900';

  return {
    h1: ({ node, children, ...props }) => (
      <h1 className={`text-[28px] font-semibold leading-tight ${headingColor}`} {...props}>
        {renderChildrenWithCitationAnchors(children)}
      </h1>
    ),
    h2: ({ node, children, ...props }) => (
      <h2 className={`mt-8 text-[22px] font-semibold leading-snug ${headingColor}`} {...props}>
        {renderChildrenWithCitationAnchors(children)}
      </h2>
    ),
    h3: ({ node, children, ...props }) => (
      <h3 className={`mt-6 text-[18px] font-semibold leading-snug ${headingColor}`} {...props}>
        {renderChildrenWithCitationAnchors(children)}
      </h3>
    ),
    p: ({ node, children, ...props }) => (
      <p className={`text-[15px] leading-7 ${bodyColor}`} {...props}>
        {renderChildrenWithCitationAnchors(children)}
      </p>
    ),
    ul: ({ node, children, ...props }) => (
      <ul className={`ml-6 list-disc space-y-2 text-[15px] leading-7 ${bodyColor}`} {...props}>
        {renderChildrenWithCitationAnchors(children)}
      </ul>
    ),
    ol: ({ node, children, ...props }) => (
      <ol className={`ml-6 list-decimal space-y-2 text-[15px] leading-7 ${bodyColor}`} {...props}>
        {renderChildrenWithCitationAnchors(children)}
      </ol>
    ),
    li: ({ node, children, ...props }) => (
      <li className={`text-[15px] leading-7 ${bodyColor}`} {...props}>
        {renderChildrenWithCitationAnchors(children)}
      </li>
    ),
    blockquote: ({ node, children, ...props }) => (
      <blockquote
        className={blockquoteClassName}
        {...props}
      >
        {renderChildrenWithCitationAnchors(children)}
      </blockquote>
    ),
    table: ({ node, children, ...props }) => (
      <div className={`my-4 overflow-hidden rounded-2xl border ${borderColor}`}>
        <table className={`w-full border-collapse text-[14px] ${bodyColor}`} {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ node, children, ...props }) => (
      <th className={tableHeadClassName} {...props}>
        {renderChildrenWithCitationAnchors(children)}
      </th>
    ),
    td: ({ node, children, ...props }) => (
      <td className={`border ${borderColor} px-3 py-2 align-top`} {...props}>
        {renderChildrenWithCitationAnchors(children)}
      </td>
    ),
    img: ({ node, src = '', alt = '', ...props }) => (
      // eslint-disable-next-line @next/next/no-img-element
      (<img
        src={resolveAssetHref(typeof src === 'string' ? src : '')}
        alt={alt}
        className={imageClassName}
        {...props}
      />)
    ),
    a: ({ node, href = '', children, ...props }) => (
      <a
        href={resolveAssetHref(typeof href === 'string' ? href : '')}
        className={anchorClassName}
        {...props}
      >
        {renderChildrenWithCitationAnchors(children)}
      </a>
    ),
    hr: ({ node, ...props }) => <hr className={`my-8 ${borderColor}`} {...props} />,
    code: ({ node, inline, children, className, ...props }: any) => {
      if (inline) {
        return (
          <code className={inlineCodeClassName} {...props}>
            {children}
          </code>
        );
      }

      return (
        <code className={`${className ?? ''} ${codeBlockClassName}`} {...props}>
          {children}
        </code>
      );
    },
    pre: ({ node, children }) => <>{children}</>,
  };
}

export function RuntimeMarkdownContent({
  markdown,
  resolveAssetHref,
  mode = 'handout',
}: RuntimeMarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={createRuntimeMarkdownComponents(resolveAssetHref, mode)}
    >
      {markdown}
    </ReactMarkdown>
  );
}
