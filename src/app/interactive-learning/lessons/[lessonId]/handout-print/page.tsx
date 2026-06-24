import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { notFound } from 'next/navigation';

import 'katex/dist/katex.min.css';

import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { resolveHandoutAssetUrl } from '@/lib/handout-pdf';
import { readReadableContentText } from '@/lib/runtime-content-path';

export const dynamic = 'force-dynamic';

const PRINT_PAGE_CSS = `
  @page {
    size: A4;
    margin: 14mm 12mm;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
  }

  body {
    font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  }

  .katex-display {
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0.25rem 0;
  }

  img, table, blockquote, pre {
    page-break-inside: avoid;
  }
`;

function createMarkdownComponents(lessonId: string): Components {
  return {
    h1: ({ node, children, ...props }) => (
      <h1 className="text-[28px] font-semibold leading-tight text-slate-950" {...props}>
        {children}
      </h1>
    ),
    h2: ({ node, children, ...props }) => (
      <h2 className="mt-8 text-[22px] font-semibold leading-snug text-slate-950" {...props}>
        {children}
      </h2>
    ),
    h3: ({ node, children, ...props }) => (
      <h3 className="mt-6 text-[18px] font-semibold leading-snug text-slate-900" {...props}>
        {children}
      </h3>
    ),
    p: ({ node, children, ...props }) => (
      <p className="text-[15px] leading-7 text-slate-800" {...props}>
        {children}
      </p>
    ),
    ul: ({ node, children, ...props }) => (
      <ul className="ml-6 list-disc space-y-2 text-[15px] leading-7 text-slate-800" {...props}>
        {children}
      </ul>
    ),
    ol: ({ node, children, ...props }) => (
      <ol className="ml-6 list-decimal space-y-2 text-[15px] leading-7 text-slate-800" {...props}>
        {children}
      </ol>
    ),
    li: ({ node, children, ...props }) => (
      <li className="text-[15px] leading-7 text-slate-800" {...props}>
        {children}
      </li>
    ),
    blockquote: ({ node, children, ...props }) => (
      <blockquote
        className="border-l-4 border-sky-300 bg-sky-50/80 px-4 py-3 text-[15px] leading-7 text-slate-700"
        {...props}
      >
        {children}
      </blockquote>
    ),
    table: ({ node, children, ...props }) => (
      <div className="my-4 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full border-collapse text-[14px] text-slate-800" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ node, children, ...props }) => (
      <th className="border border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold" {...props}>
        {children}
      </th>
    ),
    td: ({ node, children, ...props }) => (
      <td className="border border-slate-200 px-3 py-2 align-top" {...props}>
        {children}
      </td>
    ),
    img: ({ node, src = '', alt = '', ...props }) => (
      // eslint-disable-next-line @next/next/no-img-element
      (<img
        src={resolveHandoutAssetUrl(typeof src === 'string' ? src : '', { lessonId })}
        alt={alt}
        className="my-5 w-full rounded-2xl border border-slate-200 bg-white object-contain"
        {...props}
      />)
    ),
    a: ({ node, href = '', children, ...props }) => (
      <a
        href={resolveHandoutAssetUrl(typeof href === 'string' ? href : '', { lessonId })}
        className="text-sky-700 underline underline-offset-2"
        {...props}
      >
        {children}
      </a>
    ),
    hr: ({ node, ...props }) => <hr className="my-8 border-slate-200" {...props} />,
    code: ({ node, inline, children, className, ...props }: any) => {
      if (inline) {
        return (
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-slate-900" {...props}>
            {children}
          </code>
        );
      }

      return (
        <code className={`${className ?? ''} block overflow-x-auto rounded-2xl bg-slate-950 p-4 text-[13px] text-slate-100`} {...props}>
          {children}
        </code>
      );
    },
    pre: ({ node, children }) => <>{children}</>,
  };
}

export default async function LessonHandoutPrintPage(
  props: {
    params: Promise<{ lessonId: string }>;
  }
) {
  const params = await props.params;
  try {
    const runtime = await loadLessonRuntimeEntry(params.lessonId);
    const markdown = await readReadableContentText(runtime.handoutSourcePath);
    const markdownComponents = createMarkdownComponents(params.lessonId);

    return (
      <main className="min-h-screen bg-white text-slate-900" data-handout-print-ready="true">
        <style suppressHydrationWarning>{PRINT_PAGE_CSS}</style>
        <div className="mx-auto max-w-[820px] px-8 py-10">
          <header className="mb-8 border-b border-slate-200 pb-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{params.lessonId} Handout</div>
            <h1 className="mt-3 text-[30px] font-semibold leading-tight text-slate-950">{runtime.lesson.title}</h1>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">{runtime.handoutSummary}</p>
          </header>

          <article className="space-y-4">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={markdownComponents}
            >
              {markdown}
            </ReactMarkdown>
          </article>
        </div>
      </main>
    );
  } catch {
    notFound();
  }
}
