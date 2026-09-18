'use client';

import { useState, type ReactNode } from 'react';
import { Maximize2, Minimize2, PanelLeft, PanelRight } from 'lucide-react';

export function TextbookReaderWorkspace({
  presentation,
  bookId,
  edition,
  header,
  toc,
  reading,
  meta,
}: {
  presentation: 'standalone' | 'modal';
  bookId: string;
  edition: string;
  header: ReactNode;
  toc: ReactNode;
  reading: ReactNode;
  meta: ReactNode;
}) {
  const [tocOpen, setTocOpen] = useState(true);
  const [metaOpen, setMetaOpen] = useState(true);
  const [maximized, setMaximized] = useState(false);
  const showToc = !maximized && tocOpen;
  const showMeta = !maximized && metaOpen;
  const gridClass = showToc && showMeta
    ? 'lg:grid-cols-[18rem_minmax(0,1fr)_15rem]'
    : showToc
      ? 'lg:grid-cols-[18rem_minmax(0,1fr)]'
      : showMeta
        ? 'lg:grid-cols-[minmax(0,1fr)_15rem]'
        : 'lg:grid-cols-1';

  return (
    <main
      className={`bg-background text-foreground ${
        presentation === 'standalone'
          ? 'min-h-screen'
          : maximized
            ? 'h-full overflow-hidden'
            : 'h-[min(92vh,980px)] overflow-hidden rounded-xl'
      }`}
      data-textbook-reader="true"
      data-textbook-reader-presentation={presentation}
      data-textbook-reader-maximized={maximized ? 'true' : 'false'}
      data-textbook-reader-toc={showToc ? 'expanded' : 'collapsed'}
      data-textbook-reader-meta={showMeta ? 'expanded' : 'collapsed'}
      data-book-id={bookId}
      data-edition={edition}
    >
      <header className="border-b border-border bg-background/95 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          {header}
          <div className="mt-3 flex flex-wrap gap-2" data-textbook-reader-chrome="true">
            <button
              type="button"
              aria-pressed={showToc}
              aria-controls="textbook-reader-toc"
              onClick={() => {
                setMaximized(false);
                setTocOpen((open) => !open);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <PanelLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {showToc ? '收起目录' : '展开目录'}
            </button>
            <button
              type="button"
              aria-pressed={showMeta}
              aria-controls="textbook-reader-meta"
              onClick={() => {
                setMaximized(false);
                setMetaOpen((open) => !open);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <PanelRight className="h-3.5 w-3.5" aria-hidden="true" />
              {showMeta ? '收起侧栏' : '展开侧栏'}
            </button>
            <button
              type="button"
              aria-pressed={maximized}
              onClick={() => setMaximized((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              {maximized ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
              {maximized ? '退出最大化' : '最大化阅读'}
            </button>
          </div>
        </div>
      </header>

      <div className={`mx-auto grid max-w-[1600px] ${gridClass} ${
        presentation === 'modal' ? 'h-[calc(100%_-_9.5rem)]' : ''
      }`}>
        {showToc ? (
          <aside id="textbook-reader-toc" className="border-b border-border bg-card p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            {toc}
          </aside>
        ) : null}
        {reading}
        {showMeta ? (
          <aside id="textbook-reader-meta" className="border-t border-border bg-card p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
            {meta}
          </aside>
        ) : null}
      </div>
    </main>
  );
}
