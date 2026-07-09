import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { notFound } from 'next/navigation';

import 'katex/dist/katex.min.css';

import { RuntimeMarkdownContent } from '@/components/shared/runtime-markdown';
import {
  preprocessTextbookCitationMarkdown,
  resolveRuntimeMarkdownAssetHref,
  resolveTextbookCitationReaderPath,
} from '@/lib/textbook-citation-targets';

export const dynamic = 'force-dynamic';

const RUNTIME_ROOT = path.join(process.cwd(), 'course-content', 'runtime');

function titleFromMarkdown(markdown: string, fallback: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}

export default async function TextbookCitationReaderPage(
  props: {
    params: Promise<{ targetPath: string[] }>;
  },
) {
  const params = await props.params;
  const resolved = resolveTextbookCitationReaderPath(params.targetPath ?? []);
  if (!resolved) notFound();

  try {
    const absolutePath = path.join(RUNTIME_ROOT, resolved.runtimeRelativePath);
    if (!absolutePath.startsWith(RUNTIME_ROOT)) notFound();

    const rawMarkdown = await readFile(absolutePath, 'utf8');
    const markdown = preprocessTextbookCitationMarkdown(rawMarkdown);
    const title = titleFromMarkdown(markdown, path.basename(resolved.runtimeRelativePath, path.extname(resolved.runtimeRelativePath)));
    const resolveAssetHref = (href: string) => resolveRuntimeMarkdownAssetHref(href, resolved.runtimeRelativePath);

    return (
      <main
        className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50"
        data-textbook-citation-reader="true"
        data-canonical-href={resolved.canonicalHref}
        data-rendered-citation-ready="true"
      >
        <div className="mx-auto max-w-[920px] px-5 py-8 sm:px-8 sm:py-10">
          <header className="mb-7 border-b border-zinc-200 pb-5 dark:border-zinc-800">
            <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              Textbook Source
            </div>
            <h1 className="mt-3 text-[28px] font-semibold leading-tight text-zinc-950 dark:text-zinc-50">
              {title}
            </h1>
          </header>

          <article className="space-y-4 rounded-lg bg-white px-5 py-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800 sm:px-8">
            <RuntimeMarkdownContent
              markdown={markdown}
              resolveAssetHref={resolveAssetHref}
              mode="textbook-citation"
            />
          </article>
        </div>
      </main>
    );
  } catch {
    notFound();
  }
}
