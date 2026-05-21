'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  BookOpen,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import type { TeacherStudentInsightsPayload } from '@/app/api/teacher/classes/[classId]/students/[studentId]/insights/route';

export default function TeacherStudentInsightsPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params?.classId as string;
  const studentId = params?.studentId as string;
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status ?? 'loading';

  const [data, setData] = useState<TeacherStudentInsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/teacher/classes/${classId}/students/${studentId}/insights`);
      if (!response.ok) {
        throw new Error('获取学生学情失败');
      }
      const payload = (await response.json()) as TeacherStudentInsightsPayload;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [classId, studentId]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id && classId && studentId) {
      if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
        router.replace('/dashboard');
        return;
      }
      void fetchData();
    }
  }, [classId, fetchData, router, session, status, studentId]);

  if (status === 'loading' || loading) {
    return (
      <div className="teacher-insight-shell flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          <p className="text-subtle">加载学生学情...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="teacher-insight-shell flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-500">{error || '加载失败'}</p>
          <button onClick={fetchData} className="btn-ghost-themed mt-4 rounded-lg px-6 py-2">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-insight-shell">
      <header className="surface-topbar px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/teacher/classes/${classId}`} className="text-subtle transition hover:text-foreground">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div>
              <p className="text-sm text-subtle">{data.student.className}</p>
              <h1 className="text-xl font-bold text-foreground">{data.student.name} 的个体学情</h1>
            </div>
          </div>
          <button onClick={fetchData} className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm">
            <RefreshCw className="h-4 w-4" />
            刷新数据
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <section className="teacher-insight-hero mb-8">
          <div className="grid gap-4 xl:grid-cols-[1.25fr,0.75fr]">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/15 text-2xl font-bold text-sky-500 dark:text-sky-300">
                  {data.student.name.charAt(0)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold text-foreground">{data.student.name}</h2>
                    <span className={`teacher-insight-chip teacher-insight-risk-${data.overview.riskLevel}`}>
                      {data.overview.riskLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-subtle">
                    {data.student.studentNumber || data.student.email || '暂无学号信息'}
                  </p>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-subtle">
                    {data.overview.recommendedScaffolding}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard title="综合指数" value={data.overview.overallScore} detail="六维能力平均值" />
                <MetricCard title="学习事实" value={data.overview.factCount} detail="已沉淀的治理证据数量" />
                <MetricCard
                  title="最近画像"
                  value={data.snapshot.current ? 1 : 0}
                  detail={data.overview.latestSnapshotAt ? new Date(data.overview.latestSnapshotAt).toLocaleString('zh-CN') : '暂无快照'}
                />
              </div>
            </div>

            <div className="teacher-insight-metric">
              <p className="text-sm font-medium text-foreground">画像摘要</p>
              <div className="mt-4 space-y-4 text-sm text-subtle">
                <div>
                  <p className="font-medium text-foreground">整体等级</p>
                  <p className="mt-1">{data.profileSummary?.overallLevel || '待生成'}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">近期趋势</p>
                  <p className="mt-1">{data.profileSummary?.recentTrend || '暂无趋势信息'}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">优势</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(data.profileSummary?.strengths || []).length > 0 ? (
                      data.profileSummary?.strengths.map((item) => (
                        <span key={item} className="teacher-insight-chip teacher-insight-chip-healthy">
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="teacher-insight-chip teacher-insight-chip-pending">暂无优势标签</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-medium text-foreground">待提升点</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(data.profileSummary?.weaknesses || []).length > 0 ? (
                      data.profileSummary?.weaknesses.map((item) => (
                        <span key={item} className="teacher-insight-chip teacher-insight-chip-warning">
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="teacher-insight-chip teacher-insight-chip-pending">暂无弱项标签</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="surface-card p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">能力画像与班级对比</h2>
              <p className="mt-1 text-sm text-subtle">逐项对比学生当前能力与班级均值，帮助教师决定补强重点。</p>
            </div>
            <div className="space-y-4">
              {data.classComparison.map((item) => (
                <div key={item.dimension} className="teacher-insight-metric">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="mt-1 text-xs text-subtle">
                        与班级均值 {item.classAverage} 相比 {item.gap >= 0 ? '领先' : '落后'} {Math.abs(item.gap)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold text-foreground">{item.studentScore}</p>
                      <p className="text-xs text-subtle">班级均值 {item.classAverage}</p>
                    </div>
                  </div>
                  <div className="teacher-insight-track mt-4">
                    <div className="teacher-insight-fill" style={{ width: `${Math.min(item.studentScore, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">风险与近期活动</h2>
              <p className="mt-1 text-sm text-subtle">把治理风险与近期学习动向并排看，判断是否需要即时干预。</p>
            </div>
            <div className="space-y-4">
              <div className="teacher-insight-metric">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ShieldAlert className="h-4 w-4 text-rose-500" />
                  风险标记
                </div>
                <div className="mt-3 space-y-3">
                  {data.riskFlags.length > 0 ? (
                    data.riskFlags.map((risk) => (
                      <div key={`${risk.type}-${risk.triggeredAt}`} className="rounded-xl border border-border/70 bg-card/80 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`teacher-insight-chip teacher-insight-risk-${risk.severity}`}>
                              {risk.severity === 'high' ? '高风险' : risk.severity === 'medium' ? '中风险' : '低风险'}
                            </span>
                            {risk.occurrenceCount > 1 && (
                              <span className="teacher-insight-chip teacher-insight-chip-pending">
                                重复 {risk.occurrenceCount} 次
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-subtle">最近一次 {new Date(risk.triggeredAt).toLocaleString('zh-CN')}</span>
                        </div>
                        <p className="mt-2 text-sm text-foreground">{risk.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-subtle">当前没有未解决的风险标记。</p>
                  )}
                </div>
              </div>

              <div className="teacher-insight-metric">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <TrendingUp className="h-4 w-4 text-sky-500 dark:text-sky-300" />
                  近期活动
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(data.profileSummary?.recentActivities || []).length > 0 ? (
                    data.profileSummary?.recentActivities.map((item) => (
                      <span key={item} className="teacher-insight-chip teacher-insight-chip-pending">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="teacher-insight-chip teacher-insight-chip-pending">暂无近期活动摘要</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
          <div className="surface-card p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">成长档案</h2>
              <p className="mt-1 text-sm text-subtle">记录可复盘的成长节点，用于教师访谈与个别指导。</p>
            </div>
            <div className="teacher-insight-timeline">
              {data.growthRecords.length > 0 ? (
                data.growthRecords.map((record) => (
                  <div key={record.id} className="teacher-insight-timeline-item">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium text-foreground">{record.title}</p>
                      <span className="text-xs text-subtle">{new Date(record.occurredAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <p className="mt-2 text-sm text-subtle">{record.description}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-subtle">{record.recordType}</p>
                  </div>
                ))
              ) : (
                <div className="teacher-insight-metric">
                  <p className="text-sm text-subtle">当前还没有生成成长档案记录。</p>
                </div>
              )}
            </div>
          </div>

          <div className="surface-card p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">推荐动作</h2>
              <p className="mt-1 text-sm text-subtle">把数据治理结果转成教师可立即执行的干预建议。</p>
            </div>
            <div className="space-y-3">
              {data.recommendations.length > 0 ? (
                data.recommendations.map((recommendation) => (
                  <div key={recommendation.id} className="teacher-insight-entry">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{recommendation.title}</p>
                          <span className="teacher-insight-chip teacher-insight-chip-warning">{recommendation.type}</span>
                        </div>
                        <p className="mt-2 text-sm text-subtle">{recommendation.description}</p>
                        <p className="mt-2 text-xs text-subtle">{recommendation.reason}</p>
                      </div>
                      <BookOpen className="h-5 w-5 text-amber-500" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="teacher-insight-metric">
                  <p className="text-sm text-subtle">当前没有新的推荐动作。</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="surface-card p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">证据摘要</h2>
              <p className="mt-1 text-sm text-subtle">按能力维度查看当前画像背后的证据，便于教师理解判断来源。</p>
            </div>
            <Link
              href={`/teacher/classes/${classId}/students/${studentId}/evidence`}
              className="btn-ghost-themed inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm"
            >
              查看完整证据
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.evidenceSummary.map((group) => (
              <div key={group.dimension} className="teacher-insight-metric">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles className="h-4 w-4 text-sky-500 dark:text-sky-300" />
                  {group.label}
                </div>
                <div className="mt-3 space-y-2">
                  {group.items.length > 0 ? (
                    group.items.slice(0, 3).map((item, index) => (
                      <div key={`${group.dimension}-${index}`} className="rounded-xl border border-border/70 bg-card/80 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{formatEvidenceTitle(item)}</p>
                          <span className={getOutcomeBadgeClass(item.outcome)}>{formatOutcome(item.outcome)}</span>
                        </div>
                        {typeof item.score === 'number' && (
                          <p className="mt-2 text-xs text-subtle">评分 {item.score}</p>
                        )}
                        {item.questionSummaries?.slice(0, 2).map((question, questionIndex) => (
                          <p key={`${question.questionId ?? questionIndex}`} className="mt-2 text-xs text-subtle">
                            {question.prompt ?? question.questionId ?? '题目'}：作答 {question.studentAnswer ?? '未作答'}
                            {question.referenceAnswer ? `，参考 ${question.referenceAnswer}` : ''}
                            {typeof question.isCorrect === 'boolean' ? `，${question.isCorrect ? '正确' : '需修正'}` : ''}
                          </p>
                        ))}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-subtle">当前维度暂无直接证据。</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="teacher-insight-metric">
      <p className="text-sm text-subtle">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-xs text-subtle">{detail}</p>
    </div>
  );
}

type EvidenceSummaryItem = TeacherStudentInsightsPayload['evidenceSummary'][number]['items'][number];

function formatEvidenceTitle(item: EvidenceSummaryItem): string {
  if (item.evidenceTitle) {
    return item.evidenceTitle;
  }
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
  return '进行中';
}

function getOutcomeBadgeClass(outcome: string): string {
  const base = 'shrink-0 rounded px-2 py-0.5 text-xs';
  if (outcome === 'success') return `${base} bg-emerald-500/20 text-emerald-500`;
  if (outcome === 'failure') return `${base} bg-red-500/20 text-red-500`;
  return `${base} bg-amber-500/20 text-amber-500`;
}
