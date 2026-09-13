'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Search } from 'lucide-react';
import { InteractiveLearningShell } from '@/features/interactive/interactive-learning-shell';
import { buildAdaptivePathCompletionRequest, buildAdaptivePathLaunchHref, resolveAdaptivePathLaunchReturnContext } from '@/features/personalization/experience/adaptive-learning-center-contracts';
import { publishAdaptivePathJourneyResponse } from '@/features/personalization/experience/adaptive-path-journey-control';
import { KnowledgeCard } from './knowledge-card';

export interface PublishedResourcePageData {
  title: string;
  kindLabel: string;
  summary: string;
  estimatedMinutes: number | null;
  knowledgeCount: number;
  limitation: string | null;
  kind: 'card' | 'infographic' | 'media' | 'route' | 'container' | 'reference-only';
  href?: string;
  referenceHref?: string;
  imageSrc?: string;
  media?: { mediaType: 'video' | 'audio'; src: string; assetPath: string };
  card?: { summary: string; insight: string | null; explanation: string };
  children?: Array<{ title: string; href: string }>;
  appearance?: 'first' | 'revisit' | 'reference' | null;
  anchors?: Array<{ label: string; appearance: string; href: string | null }>;
}

export function PublishedResourcePage({ resource }: { resource: PublishedResourcePageData }) {
  const search = useSearchParams();
  const context = resolveAdaptivePathLaunchReturnContext(search);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(24);
  const { data: session } = useSession();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const feedbackAttempt = useRef<{ rating: string; eventId: string } | null>(null);
  useEffect(() => { setMediaReady(false); }, [resource.media?.src]);
  const entries = useMemo(() => (resource.children ?? []).filter((item) =>
    item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [query, resource.children]);
  const href = resource.href && context ? buildAdaptivePathLaunchHref(resource.href, context) : resource.href;
  const canCompleteReading = Boolean(context && (
    resource.kind === 'card'
    || resource.kind === 'infographic'
    || (resource.kind === 'media' && mediaReady)
  ));

  async function completeReading() {
    if (!context || !canCompleteReading) return;
    const request = buildAdaptivePathCompletionRequest({ launchContext: context, completedAt: new Date().toISOString() });
    if (!request) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(request.href, {
        method: request.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(request.body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error('记录阅读完成失败，请重试。');
      publishAdaptivePathJourneyResponse(result);
      setCompleted(true);
    } catch {
      setError('记录阅读完成失败，请重试。');
    } finally { setPending(false); }
  }

  async function submitFeedback(rating: string) {
    if (!resource.referenceHref || feedbackPending) return;
    if (feedbackAttempt.current?.rating !== rating) feedbackAttempt.current = { rating, eventId: crypto.randomUUID() };
    setFeedbackPending(true); setFeedbackError(null);
    try {
      const response = await fetch('/api/learning-resources/feedback', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference: resource.referenceHref, ...feedbackAttempt.current }),
      });
      if (!response.ok) throw new Error('feedback-not-saved');
      setFeedback(rating); feedbackAttempt.current = null;
    } catch { setFeedbackError('反馈尚未保存，请重试。'); }
    finally { setFeedbackPending(false); }
  }

  return (
    <InteractiveLearningShell
      activeHref={context ? '/assessment/adaptive-practice' : '/knowledge'}
      title={resource.title}
      subtitle={resource.kindLabel}
      breadcrumbs={[context ? { label: '学习路径', href: context.returnHref } : { label: '知识资源', href: '/knowledge' }, { label: resource.title }]}
      actions={context ? undefined : <Link href="/knowledge" className="inline-flex items-center gap-2 text-sm text-platform-fg-secondary">
        <ArrowLeft className="h-4 w-4" />返回知识图谱
      </Link>}
    >
      <article className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6" data-published-resource-view={resource.kind}>
        <div className="flex flex-wrap items-center gap-3 text-sm text-platform-fg-muted">
          <span className="rounded-md bg-platform-action-subtle px-2 py-1 text-platform-action-primary">{resource.kindLabel}</span>
          {resource.knowledgeCount > 0 && <span>关联 {resource.knowledgeCount} 个知识点</span>}
          {resource.estimatedMinutes !== null && <span>参考用时约 {resource.estimatedMinutes} 分钟</span>}
          {resource.appearance === 'first' ? <span data-published-resource-appearance="first">首次出现</span> : null}
          {resource.appearance === 'revisit' ? <span data-published-resource-appearance="revisit">复现</span> : null}
        </div>
        {resource.anchors && resource.anchors.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-xs" data-published-resource-anchors>
            {resource.anchors.map((anchor) => (
              <li key={`${anchor.label}-${anchor.appearance}-${anchor.href ?? 'none'}`}>
                {anchor.href ? (
                  <Link href={anchor.href} className="rounded-md border border-platform-border bg-platform-surface px-2 py-1">
                    {anchor.label} · {anchor.appearance === 'first' ? '首次' : anchor.appearance === 'revisit' ? '复现' : '参考'}
                  </Link>
                ) : (
                  <span className="rounded-md border border-platform-border bg-platform-surface px-2 py-1">
                    {anchor.label} · {anchor.appearance === 'first' ? '首次' : anchor.appearance === 'revisit' ? '复现' : '参考'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {resource.limitation && <p className="rounded-lg border border-platform-border bg-platform-canvas-muted p-4 text-sm text-platform-fg-secondary" role="status">{resource.limitation}</p>}
        {resource.kind === 'card' && resource.card ? (
          <KnowledgeCard name={resource.title} description={resource.card.summary} nodeType="KnowledgeStatement"
            metadata={{ type: 'rich-text', content: resource.card.explanation }} variant="full" />
        ) : resource.kind === 'infographic' && resource.imageSrc ? (
          <figure className="overflow-hidden rounded-xl border border-platform-border bg-white">
            <Image src={resource.imageSrc} alt={resource.title} width={1600} height={1000} unoptimized
              className="h-auto w-full object-contain" onError={() => setError('信息图读取失败，当前版本可能已不可用。')} />
          </figure>
        ) : resource.kind === 'media' && resource.media ? (
          <section className="space-y-3 rounded-xl border border-platform-border bg-platform-surface p-4">
            {resource.media.mediaType === 'video' ? (
              <video controls preload="metadata" className="w-full rounded-lg bg-black" src={resource.media.src}
                aria-label={resource.title} onLoadedMetadata={() => { setMediaReady(true); setError(null); }}
                onError={() => { setMediaReady(false); setError('媒体加载失败，当前发布版本可能已不可用。'); }}>
                您的浏览器不支持视频播放。
              </video>
            ) : (
              <audio controls preload="metadata" className="w-full" src={resource.media.src}
                aria-label={resource.title} onLoadedMetadata={() => { setMediaReady(true); setError(null); }}
                onError={() => { setMediaReady(false); setError('媒体加载失败，当前发布版本可能已不可用。'); }}>
                您的浏览器不支持音频播放。
              </audio>
            )}
            <p className="text-sm text-platform-fg-muted">{mediaReady ? '媒体已加载，可以记录完成。' : '正在加载媒体…'}</p>
          </section>
        ) : resource.kind === 'route' && href ? (
          <section className="space-y-5 rounded-xl border border-platform-border bg-platform-surface p-6">
            <p className="leading-7 text-platform-fg-secondary">{resource.summary}</p>
            <Link href={href} className="inline-flex items-center gap-2 rounded-md bg-platform-action-primary px-4 py-2 text-white">
              打开{resource.kindLabel}<ArrowUpRight className="h-4 w-4" />
            </Link>
          </section>
        ) : null}
        {resource.kind === 'container' && (
          <section className="space-y-4">
            <label className="flex items-center gap-2 rounded-lg border border-platform-border bg-platform-surface px-3 py-2">
              <Search className="h-4 w-4 text-platform-fg-muted" />
              <input aria-label="搜索教材单元" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(24); }}
                placeholder="搜索教材单元" className="w-full bg-transparent text-sm outline-none" />
            </label>
            <ul className="grid gap-2 sm:grid-cols-2">
              {entries.slice(0, limit).map((item) => <li key={item.href}>
                <Link href={item.href} className="block rounded-lg border border-platform-border bg-platform-surface px-4 py-3 text-sm hover:bg-platform-action-subtle">{item.title}</Link>
              </li>)}
            </ul>
            {entries.length === 0 && <p className="text-sm text-platform-fg-muted">没有匹配的可阅读单元。</p>}
            {entries.length > limit && <button type="button" onClick={() => setLimit(limit + 24)} className="text-sm text-platform-action-primary">显示更多单元</button>}
          </section>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {session?.user?.role === 'STUDENT' && resource.referenceHref && !['container', 'reference-only'].includes(resource.kind) && (
          <section className="flex flex-wrap items-center gap-2 rounded-lg border border-platform-border p-4 text-sm" aria-label="资源难度反馈">
            <span className="mr-2 text-platform-fg-secondary">这份内容对你来说</span>
            {([['easy', '偏简单'], ['appropriate', '适合'], ['hard', '偏难']] as const).map(([rating, label]) => (
              <button key={rating} type="button" aria-pressed={feedback === rating} disabled={feedbackPending}
                onClick={() => void submitFeedback(rating)} className="rounded-md border border-platform-border px-3 py-1.5 aria-pressed:bg-platform-action-subtle disabled:opacity-50">{label}</button>
            ))}
            {feedback && <span role="status" className="text-platform-fg-muted">已记录，将用于调整后续推荐。</span>}
            {feedbackError && <span role="alert" className="text-destructive">{feedbackError}</span>}
          </section>
        )}
        {canCompleteReading && <button type="button" onClick={() => void completeReading()} disabled={pending || completed || Boolean(error)}
          className="inline-flex items-center gap-2 rounded-md border border-platform-border bg-platform-surface px-4 py-2 text-sm disabled:opacity-50">
          <CheckCircle2 className="h-4 w-4" />{completed ? '已记录阅读完成' : pending ? '正在记录…' : '我已完成阅读'}
        </button>}
      </article>
    </InteractiveLearningShell>
  );
}
