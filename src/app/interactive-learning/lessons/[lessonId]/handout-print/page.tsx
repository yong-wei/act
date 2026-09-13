import { notFound } from 'next/navigation';

import 'katex/dist/katex.min.css';

import { RuntimeMarkdownContent } from '@/components/shared/runtime-markdown';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';
import { resolveHandoutAssetUrl } from '@/lib/handout-pdf';
import { handoutHeadingIdByLine } from '@/lib/handout-heading-anchors';
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

export default async function LessonHandoutPrintPage(
  props: {
    params: Promise<{ lessonId: string }>;
  }
) {
    const params = await props.params;
  try {
    const runtime = await loadLessonRuntimeEntry(params.lessonId);
    const markdown = await readReadableContentText(runtime.handoutSourcePath);
    const resolveAssetHref = (href: string) => resolveHandoutAssetUrl(href, { lessonId: params.lessonId });
    const headingIdsByLine = handoutHeadingIdByLine(markdown);

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
            <RuntimeMarkdownContent markdown={markdown} resolveAssetHref={resolveAssetHref} headingIdsByLine={headingIdsByLine} />
          </article>
        </div>
      </main>
    );
  } catch {
    notFound();
  }
}
