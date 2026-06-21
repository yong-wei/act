'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';

import {
  COMPETENCY_DIMENSIONS,
  getCompetencyLabel,
  type CompetencyDimension,
} from '@/lib/data-governance/competency-model';
import type { EvidenceTimelineItem } from '@/lib/data-governance/evidence-timeline';

interface EvidenceTimelineBrowserPayload {
  items: EvidenceTimelineItem[];
  nextCursor: string | null;
  student?: {
    name: string;
    className?: string | null;
  };
}

interface EvidenceTimelineBrowserProps {
  apiPath: string;
  backHref: string;
  chrome?: 'standalone' | 'embedded';
  emptyBackLabel?: string;
  contextBadges?: string[];
  initialLessonId?: string;
  title: string;
  subtitle?: string;
}

export function EvidenceTimelineBrowser({
  apiPath,
  backHref,
  chrome = 'standalone',
  emptyBackLabel = '返回成长中心',
  contextBadges = [],
  initialLessonId,
  title,
  subtitle,
}: EvidenceTimelineBrowserProps) {
  const [items, setItems] = useState<EvidenceTimelineItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [dimension, setDimension] = useState('');
  const [lessonId, setLessonId] = useState(initialLessonId ?? '');
  const [factType, setFactType] = useState('');
  const [outcome, setOutcome] = useState('');
  const [studentLabel, setStudentLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);

  const filterKey = useMemo(
    () => JSON.stringify({ dimension, lessonId, factType, outcome }),
    [dimension, lessonId, factType, outcome]
  );

  const buildUrl = useCallback((cursor?: string | null) => {
    const params = new URLSearchParams({ limit: '20' });
    if (dimension) params.set('dimension', dimension);
    if (lessonId.trim()) params.set('lessonId', lessonId.trim());
    if (factType) params.set('factType', factType);
    if (outcome) params.set('outcome', outcome);
    if (cursor) params.set('cursor', cursor);
    return `${apiPath}?${params.toString()}`;
  }, [apiPath, dimension, factType, lessonId, outcome]);

  const loadPage = useCallback(async (cursor?: string | null) => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;

    try {
      setLoading(true);
      setError(null);
      if (!cursor) {
        setItems([]);
        setNextCursor(null);
      }

      const response = await fetch(buildUrl(cursor));
      if (!response.ok) {
        throw new Error('获取证据失败');
      }

      const payload = await response.json() as EvidenceTimelineBrowserPayload;
      if (requestId !== requestSequenceRef.current) {
        return;
      }

      setItems((previous) => cursor ? [...previous, ...payload.items] : payload.items);
      setNextCursor(payload.nextCursor);
      setStudentLabel(payload.student
        ? [payload.student.name, payload.student.className].filter(Boolean).join(' · ')
        : null);
    } catch (err) {
      if (requestId !== requestSequenceRef.current) {
        return;
      }

      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      if (requestId === requestSequenceRef.current) {
        setLoading(false);
      }
    }
  }, [buildUrl]);

  useEffect(() => {
    void loadPage();
  }, [filterKey, loadPage]);

  useEffect(() => {
    setLessonId(initialLessonId ?? '');
  }, [initialLessonId]);

  const resetFilters = () => {
    setDimension('');
    setLessonId('');
    setFactType('');
    setOutcome('');
  };

  return (
    <div className={chrome === 'standalone' ? 'surface-page' : undefined}>
      {chrome === 'standalone' ? (
        <header className="surface-topbar px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={backHref} className="text-subtle transition hover:text-foreground">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">{title}</h1>
              <p className="text-sm text-subtle">{studentLabel || subtitle || '按时间查看学习事实和作答摘要'}</p>
              {contextBadges.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-subtle">
                  {contextBadges.map((item) => (
                    <span key={item} className="rounded border border-border px-2 py-1">
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadPage()}
            className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </div>
        </header>
      ) : null}

      <main className={chrome === 'standalone' ? 'mx-auto grid max-w-[1600px] gap-6 px-6 py-8 lg:grid-cols-[300px_1fr]' : 'grid gap-6 lg:grid-cols-[300px_1fr]'}>
        <aside className="surface-card h-fit p-5" data-learner-record-surface="evidence-filter">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-foreground">筛选</h2>
          </div>
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="text-subtle">能力维度</span>
              <select
                value={dimension}
                onChange={(event) => setDimension(event.target.value)}
                className="input-themed mt-2 w-full rounded-lg px-3 py-2"
              >
                <option value="">全部维度</option>
                {COMPETENCY_DIMENSIONS.map((item) => (
                  <option key={item} value={item}>{getCompetencyLabel(item)}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-subtle">课次</span>
              <input
                value={lessonId}
                onChange={(event) => setLessonId(event.target.value)}
                placeholder="unit-5-2..."
                className="input-themed mt-2 w-full rounded-lg px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-subtle">事实类型</span>
              <select
                value={factType}
                onChange={(event) => setFactType(event.target.value)}
                className="input-themed mt-2 w-full rounded-lg px-3 py-2"
              >
                <option value="">全部类型</option>
                <option value="question">课堂作答</option>
                <option value="simulation">仿真</option>
                <option value="ai_intervention">AI 交互</option>
                <option value="ethical">工程伦理</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-subtle">结果</span>
              <select
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                className="input-themed mt-2 w-full rounded-lg px-3 py-2"
              >
                <option value="">全部结果</option>
                <option value="success">成功</option>
                <option value="partial">部分</option>
                <option value="failure">失败</option>
                <option value="abandoned">中止</option>
              </select>
            </label>
            <button
              type="button"
              onClick={resetFilters}
              className="btn-ghost-themed inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              重置筛选条件
            </button>
          </div>
        </aside>

        <section className="space-y-3" data-learner-record-priority="evidence-timeline">
          {error && (
            <div className="surface-card border-red-500/40 p-4 text-sm text-red-500">{error}</div>
          )}
          {!loading && items.length === 0 && !error && (
            <div className="surface-card p-6">
              <p className="text-sm text-subtle">当前筛选下暂无证据。</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                  重置筛选条件
                </button>
                <Link
                  href={backHref}
                  className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
                >
                  {emptyBackLabel}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
          {items.map((item) => (
            <article
              key={item.id}
              className={`surface-card p-5 ${item.displayPriority === 'deemphasized' ? 'border-dashed opacity-80' : ''}`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-foreground">{formatEvidenceTitle(item)}</h2>
                    <span className={getOutcomeBadgeClass(item.outcome)}>{formatOutcome(item.outcome)}</span>
                    {item.groupedCount && item.groupedCount > 1 ? (
                      <span className="rounded bg-slate-500/15 px-2 py-0.5 text-xs text-subtle">
                        {item.groupLabel ?? `重复证据 ${item.groupedCount} 条`}
                      </span>
                    ) : null}
                    {item.quality && (
                      <span className="rounded bg-sky-500/15 px-2 py-0.5 text-xs text-sky-600 dark:text-sky-300">
                        {formatQuality(item.quality)}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-subtle">
                    {formatDateTime(item.startedAt)}
                    {item.lessonId ? ` · ${item.lessonId}` : ''}
                    {item.stepId ? ` · ${item.stepId}` : ''}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-2xl font-bold text-foreground">
                    {typeof item.score === 'number' ? Math.round(item.score) : '--'}
                  </p>
                  <p className="text-xs text-subtle">评分</p>
                </div>
              </div>

              {item.questionSummaries?.length ? (
                <div className="mt-4 space-y-2">
                  {item.questionSummaries.map((question, index) => (
                    <div key={`${item.id}-${question.questionId ?? index}`} className="rounded-lg border border-border/70 bg-card/70 p-3 text-sm">
                      <p className="font-medium text-foreground">{question.prompt ?? question.questionId ?? '题目'}</p>
                      <p className="mt-1 text-subtle">
                        作答 {question.studentAnswerRedacted ? '已脱敏' : question.studentAnswer ?? '未作答'}
                        {question.referenceAnswer ? `，参考 ${question.referenceAnswer}` : ''}
                        {typeof question.isCorrect === 'boolean' ? `，${question.isCorrect ? '正确' : '需修正'}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {item.learnerRecord ? (
                <div
                  className="mt-4 grid gap-3 rounded-lg border border-border/70 bg-card/70 p-3 text-sm md:grid-cols-[1fr_auto]"
                  data-learner-record-evidence-confidence={item.learnerRecord.confidence}
                  data-learner-record-missing-source={item.learnerRecord.missingSourceState}
                >
                  <div className="grid gap-2 sm:grid-cols-4">
                    <EvidenceMeta label="来源范围" value={formatLearnerRecordSourceScope(item.learnerRecord.sourceScope)} />
                    <EvidenceMeta label="新鲜度" value={formatLearnerRecordFreshness(item.learnerRecord.freshness)} />
                    <EvidenceMeta label="置信度" value={formatLearnerRecordConfidence(item.learnerRecord.confidence)} />
                    <EvidenceMeta label="缺失来源" value={formatLearnerRecordMissingSource(item.learnerRecord.missingSourceState)} />
                  </div>
                  <Link
                    href={item.learnerRecord.nextAction.href}
                    className="btn-ghost-themed inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs"
                    data-learner-record-next-action={item.learnerRecord.sourceScope}
                  >
                    {item.learnerRecord.nextAction.label}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : null}
            </article>
          ))}

          {loading && (
            <div className="surface-card p-6 text-sm text-subtle">加载中...</div>
          )}
          {nextCursor && !loading && (
            <button
              type="button"
              onClick={() => void loadPage(nextCursor)}
              className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
            >
              加载更多
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

function EvidenceMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}

function formatEvidenceTitle(item: EvidenceTimelineItem): string {
  if (item.evidenceTitle) return item.evidenceTitle;
  if (item.factType === 'simulation') return '仿真操作证据';
  if (item.factType === 'question') return item.stepId ? `课堂作答 ${item.stepId}` : '课堂作答证据';
  if (item.factType === 'ai_intervention') return 'AI 交互证据';
  if (item.factType === 'ethical') return '工程伦理证据';
  return item.factType;
}

function formatOutcome(outcome: string): string {
  if (outcome === 'success') return '成功';
  if (outcome === 'failure') return '失败';
  if (outcome === 'partial') return '部分';
  if (outcome === 'abandoned') return '中止';
  return outcome;
}

function formatQuality(quality: string): string {
  if (quality === 'rich') return '丰富证据';
  if (quality === 'partial') return '部分证据';
  if (quality === 'legacy') return '旧证据';
  if (quality === 'missing') return '缺少证据';
  return quality;
}

function formatLearnerRecordSourceScope(scope: string): string {
  if (scope === 'interactive-lesson-submission') return '互动课提交';
  if (scope === 'arena-official-result') return 'Arena 官方结果';
  if (scope === 'arena-preview-result') return 'Arena 预览结果';
  if (scope === 'simulation-workbench-completion') return '仿真/工作台完成';
  if (scope === 'adaptive-practice-submission') return '自适应练习提交';
  return scope;
}

function formatLearnerRecordFreshness(freshness: string): string {
  if (freshness === 'fresh') return '最新';
  if (freshness === 'recent') return '近期';
  if (freshness === 'stale') return '待刷新';
  return '未知';
}

function formatLearnerRecordConfidence(confidence: string): string {
  if (confidence === 'high') return '高';
  if (confidence === 'medium') return '中';
  if (confidence === 'low') return '低';
  return '未知';
}

function formatLearnerRecordMissingSource(state: string): string {
  if (state === 'complete') return '来源完整';
  if (state === 'official-arena-missing') return '缺少官方 Arena 结果';
  if (state === 'low-confidence') return '证据置信度低';
  if (state === 'partial') return '来源不完整';
  if (state === 'restricted') return '受限详情已隐藏';
  if (state === 'missing-evidence') return '缺少学习证据';
  return state;
}

function getOutcomeBadgeClass(outcome: string): string {
  const base = 'shrink-0 rounded px-2 py-0.5 text-xs';
  if (outcome === 'success') return `${base} bg-emerald-500/20 text-emerald-500`;
  if (outcome === 'failure') return `${base} bg-red-500/20 text-red-500`;
  if (outcome === 'partial') return `${base} bg-amber-500/20 text-amber-500`;
  return `${base} bg-slate-500/20 text-slate-500`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
