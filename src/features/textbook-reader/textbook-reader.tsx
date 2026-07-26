import { ArrowLeft, ArrowRight, BookOpen, ChevronRight } from 'lucide-react';

import { RuntimeMarkdownContent } from '@/components/shared/runtime-markdown';
import {
  resolveTextbookUnitAssetHref,
  type TextbookNavigationNode,
  type TextbookReaderProjection,
} from '@/lib/textbook-reader';

import { TextbookFragmentFocus } from './textbook-fragment-focus';
import {
  TextbookReaderFragmentLink,
  TextbookReaderNavigationLink,
} from './textbook-reader-link';

function NavigationBranch({
  node,
  activeUnitId,
}: {
  node: TextbookNavigationNode;
  activeUnitId: string;
}) {
  const active = node.id === activeUnitId;
  const containsActive = active || node.children.some((child) => (
    child.id === activeUnitId || activeUnitId.startsWith(`${child.id}/`)
  ));
  const label = node.naturalNumber && node.naturalNumber !== node.title
    ? `${node.naturalNumber} ${node.title}`
    : node.title;

  if (node.children.length === 0) {
    return (
      <li>
        <TextbookReaderNavigationLink
          href={node.href}
          aria-current={active ? 'page' : undefined}
          className={`block rounded-md px-2 py-1.5 text-sm leading-5 transition-colors ${
            active
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          {label}
        </TextbookReaderNavigationLink>
      </li>
    );
  }

  return (
    <li>
      <details open={containsActive}>
        <summary className="cursor-pointer rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted">
          {label}
        </summary>
        <TextbookReaderNavigationLink
          href={node.href}
          aria-current={active ? 'page' : undefined}
          data-textbook-parent-link="true"
          className={`ml-2 block rounded-md border-l-2 px-2 py-1.5 text-sm ${
            active
              ? 'border-primary bg-primary/10 font-medium text-primary'
              : 'border-transparent text-muted-foreground hover:border-primary/40 hover:bg-muted'
          }`}
        >
          阅读本节点
          <span className="sr-only">：{label}</span>
        </TextbookReaderNavigationLink>
        <ul className="ml-2 space-y-0.5 border-l border-border pl-2">
          {node.children.map((child) => (
            <NavigationBranch key={child.id} node={child} activeUnitId={activeUnitId} />
          ))}
        </ul>
      </details>
    </li>
  );
}

function BookNavigation({
  projection,
}: {
  projection: TextbookReaderProjection;
}) {
  return (
    <nav aria-label="教材目录" className="space-y-2">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
        全书目录
      </div>
      <ul className="space-y-1">
        {projection.hierarchy.map((node) => (
          <NavigationBranch key={node.id} node={node} activeUnitId={projection.unit.id} />
        ))}
      </ul>
    </nav>
  );
}

export function TextbookReader({
  projection,
  presentation = 'standalone',
}: {
  projection: TextbookReaderProjection;
  presentation?: 'standalone' | 'modal';
}) {
  const resolveAssetHref = (href: string) => resolveTextbookUnitAssetHref({
    href,
    bookId: projection.book.bookId,
    chapterId: projection.unit.chapterId,
  });

  return (
    <main
      className={`bg-background text-foreground ${
        presentation === 'standalone' ? 'min-h-screen' : 'h-[min(92vh,980px)] overflow-hidden rounded-xl'
      }`}
      data-textbook-reader="true"
      data-textbook-reader-presentation={presentation}
      data-book-id={projection.book.bookId}
      data-edition={projection.book.edition}
    >
      <header className="border-b border-border bg-background/95 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            教材阅读
          </div>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{projection.book.title}</h1>
          <nav aria-label="面包屑" className="mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {projection.breadcrumbs.map((location, index) => (
              <span key={location.id} className="inline-flex items-center gap-1">
                {index > 0 ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                <TextbookReaderNavigationLink
                  href={location.href}
                  aria-current={index === projection.breadcrumbs.length - 1 ? 'page' : undefined}
                  className="hover:text-primary hover:underline"
                >
                  {location.title}
                </TextbookReaderNavigationLink>
              </span>
            ))}
          </nav>
        </div>
      </header>

      <div className={`mx-auto grid max-w-[1600px] lg:grid-cols-[18rem_minmax(0,1fr)_15rem] ${
        presentation === 'modal' ? 'h-[calc(100%_-_7.25rem)]' : ''
      }`}>
        <aside className="border-b border-border bg-card p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <details className="lg:hidden">
            <summary className="cursor-pointer font-medium">展开全书目录</summary>
            <div className="mt-4 max-h-[55vh] overflow-y-auto">
              <BookNavigation projection={projection} />
            </div>
          </details>
          <div className="hidden lg:block">
            <BookNavigation projection={projection} />
          </div>
        </aside>

        <section className="min-w-0 overflow-y-auto px-4 py-6 sm:px-8 lg:px-10">
          <article className="mx-auto max-w-[860px] space-y-4 rounded-xl bg-card px-5 py-7 shadow-sm ring-1 ring-border sm:px-8">
            <TextbookFragmentFocus availableFragments={projection.fragments.map((fragment) => fragment.id)}>
              <RuntimeMarkdownContent
                markdown={projection.unit.markdown}
                resolveAssetHref={resolveAssetHref}
                mode="textbook-citation"
              />
            </TextbookFragmentFocus>
          </article>
          <nav aria-label="相邻单元" className="mx-auto mt-6 grid max-w-[860px] grid-cols-2 gap-3">
            {projection.previous ? (
              <TextbookReaderNavigationLink
                href={projection.previous.href}
                rel="prev"
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm hover:border-primary"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{projection.previous.title}</span>
              </TextbookReaderNavigationLink>
            ) : <span />}
            {projection.next ? (
              <TextbookReaderNavigationLink
                href={projection.next.href}
                rel="next"
                className="flex items-center justify-end gap-2 rounded-lg border border-border bg-card px-4 py-3 text-right text-sm hover:border-primary"
              >
                <span className="truncate">{projection.next.title}</span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </TextbookReaderNavigationLink>
            ) : <span />}
          </nav>
        </section>

        <aside className="border-t border-border bg-card p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
          <h2 className="text-sm font-semibold">当前位置</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">版本</dt>
              <dd className="mt-1">{projection.book.edition}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">结构类型</dt>
              <dd className="mt-1">{projection.unit.kind}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">片段锚点</dt>
              <dd className="mt-1">{projection.fragments.length} 个</dd>
            </div>
          </dl>
          {projection.fragments.length > 0 ? (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">本单元定位</h3>
              <ul className="mt-2 space-y-1.5">
                {projection.fragments.map((fragment) => (
                  <li key={fragment.id}>
                    <TextbookReaderFragmentLink
                      href={`#${encodeURIComponent(fragment.id)}`}
                      className="block rounded-md px-2 py-1 text-sm text-primary hover:bg-primary/10"
                    >
                      {fragment.kind} {fragment.naturalNumber ?? fragment.ordinal}
                    </TextbookReaderFragmentLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
