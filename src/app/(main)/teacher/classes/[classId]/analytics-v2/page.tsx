'use client';

/**
 * 班级能力驾驶舱 V2
 *
 * 数据治理系统 - 教师端班级分析页面
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  ReferenceLine,
} from 'recharts';
import { getCompetencyLabel, COMPETENCY_DIMENSIONS } from '@/lib/data-governance/competency-model';
import type { HeatmapData } from '@/app/api/teacher/classes/[classId]/heatmap/route';

interface ClassAnalyticsData {
  classId: string;
  className: string;
  studentCount: number;
  activeRate: number;
  overallIndex: number;
  weeklyImprovement: number;
  riskStats: {
    highRiskCount: number;
    aiDependencyCount: number;
    constraintWeakCount: number;
  };
  dimensionAverages: Record<string, number>;
  levelDistribution: {
    excellent: number;
    good: number;
    average: number;
    needsImprovement: number;
    atRisk: number;
  };
  trendData: Array<{
    date: string;
    averageScore: number;
    activeCount: number;
  }>;
}

interface StudentListItem {
  id: string;
  name: string;
  avatar: string | null;
  overallScore: number;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  riskFlags: string[];
  lastActive: string;
}

export default function ClassAnalyticsV2Page() {
  const router = useRouter();
  const params = useParams();
  const classId = params?.classId as string;
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status ?? 'loading';

  const [analytics, setAnalytics] = useState<ClassAnalyticsData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heatmapView, setHeatmapView] = useState<'score' | 'change' | 'risk'>('score');

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id && classId) {
      if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
        router.replace('/dashboard');
        return;
      }
      fetchData();
    }
  }, [status, session, router, classId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch heatmap data
      const heatmapRes = await fetch(`/api/teacher/classes/${classId}/heatmap`);
      if (!heatmapRes.ok) throw new Error('获取热力图数据失败');
      const heatmapData = await heatmapRes.json();
      setHeatmap(heatmapData);

      // Generate mock analytics data for now
      // In production, this would be a dedicated API endpoint
      const mockAnalytics: ClassAnalyticsData = {
        classId,
        className: '示例班级',
        studentCount: heatmapData.students?.length || 0,
        activeRate: 85,
        overallIndex: 72,
        weeklyImprovement: 5.2,
        riskStats: {
          highRiskCount: heatmapData.matrix?.filter((m: { riskLevel: string }) => m.riskLevel === 'high').length || 0,
          aiDependencyCount: 3,
          constraintWeakCount: 4,
        },
        dimensionAverages: heatmapData.dimensions?.reduce((acc: Record<string, number>, dim: string) => {
          const scores = heatmapData.matrix
            ?.filter((m: { dimension: string }) => m.dimension === dim)
            .map((m: { score: number }) => m.score) || [];
          acc[dim] = scores.length
            ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
            : 0;
          return acc;
        }, {}),
        levelDistribution: {
          excellent: 5,
          good: 12,
          average: 15,
          needsImprovement: 6,
          atRisk: 2,
        },
        trendData: [
          { date: '2024-01-01', averageScore: 68, activeCount: 35 },
          { date: '2024-01-08', averageScore: 70, activeCount: 36 },
          { date: '2024-01-15', averageScore: 71, activeCount: 38 },
          { date: '2024-01-22', averageScore: 72, activeCount: 40 },
        ],
      };
      setAnalytics(mockAnalytics);

      // Generate student list from heatmap data
      const studentList: StudentListItem[] = heatmapData.students?.map((s: { id: string; name: string | null }) => {
        const studentMatrix = heatmapData.matrix?.filter((m: { studentId: string }) => m.studentId === s.id) || [];
        const avgScore = studentMatrix.length
          ? Math.round(studentMatrix.reduce((acc: number, m: { score: number }) => acc + m.score, 0) / studentMatrix.length)
          : 0;
        const maxRisk = studentMatrix.reduce(
          (max: string, m: { riskLevel: string }) => {
            const riskOrder = ['none', 'low', 'medium', 'high'];
            return riskOrder.indexOf(m.riskLevel) > riskOrder.indexOf(max) ? m.riskLevel : max;
          },
          'none'
        );
        return {
          id: s.id,
          name: s.name || '未命名学生',
          avatar: null,
          overallScore: avgScore,
          riskLevel: maxRisk as StudentListItem['riskLevel'],
          riskFlags: [],
          lastActive: new Date().toISOString(),
        };
      }) || [];
      setStudents(studentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="surface-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-subtle">加载班级分析数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface-page flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-500">{error}</p>
          <button onClick={fetchData} className="btn-ghost-themed mt-4 rounded-lg px-6 py-2">
            重试
          </button>
        </div>
      </div>
    );
  }

  // Prepare heatmap grid data
  const heatmapGrid = heatmap?.students?.map((student) => {
    const row: Record<string, number | string> = { studentId: student.id, studentName: student.name || '' };
    heatmap?.dimensions?.forEach((dim) => {
      const cell = heatmap.matrix?.find((m) => m.studentId === student.id && m.dimension === dim);
      row[dim] = cell
        ? heatmapView === 'score'
          ? cell.score
          : heatmapView === 'change'
            ? cell.change
            : cell.riskLevel === 'high'
              ? 3
              : cell.riskLevel === 'medium'
                ? 2
                : cell.riskLevel === 'low'
                  ? 1
                  : 0
        : 0;
    });
    return row;
  }) || [];

  return (
    <div className="surface-page">
      {/* Header */}
      <header className="surface-topbar px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/teacher/classes/${classId}`} className="text-subtle transition hover:text-foreground">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">班级能力驾驶舱 V2</h1>
              <p className="text-sm text-subtle">{analytics?.className} · {analytics?.studentCount} 名学生</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-subtle">
              数据更新: {heatmap?.lastUpdated ? new Date(heatmap.lastUpdated).toLocaleString('zh-CN') : '-'}
            </span>
            <button onClick={fetchData} className="btn-ghost-themed rounded-lg px-4 py-2 text-sm">
              刷新数据
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        {/* Top Stats Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="班级活跃率"
            value={`${analytics?.activeRate || 0}%`}
            trend="本周"
            color="text-blue-500"
            bgColor="bg-blue-500/10"
          />
          <StatCard
            label="总体能力指数"
            value={analytics?.overallIndex || 0}
            trend={`${analytics?.weeklyImprovement || 0 > 0 ? '+' : ''}${analytics?.weeklyImprovement || 0}%`}
            color="text-amber-500"
            bgColor="bg-amber-500/10"
          />
          <StatCard
            label="本周提升率"
            value={`${analytics?.weeklyImprovement || 0}%`}
            trend="环比"
            color="text-emerald-500"
            bgColor="bg-emerald-500/10"
          />
          <StatCard
            label="高风险学生"
            value={analytics?.riskStats.highRiskCount || 0}
            trend="需关注"
            color="text-red-500"
            bgColor="bg-red-500/10"
          />
          <StatCard
            label="AI依赖偏高"
            value={analytics?.riskStats.aiDependencyCount || 0}
            trend="需引导"
            color="text-violet-500"
            bgColor="bg-violet-500/10"
          />
          <StatCard
            label="约束意识薄弱"
            value={analytics?.riskStats.constraintWeakCount || 0}
            trend="需干预"
            color="text-orange-500"
            bgColor="bg-orange-500/10"
          />
        </div>

        {/* Heatmap Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">班级能力热力图</h3>
            <div className="flex gap-2">
              {(['score', 'change', 'risk'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setHeatmapView(view)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    heatmapView === view
                      ? 'bg-amber-500 text-white'
                      : 'surface-card-soft text-subtle hover:text-foreground'
                  }`}
                >
                  {view === 'score' ? '当前得分' : view === 'change' ? '变化量' : '风险等级'}
                </button>
              ))}
            </div>
          </div>

          <div className="surface-card overflow-x-auto p-6">
            <div className="min-w-[800px]">
              {/* Heatmap Header */}
              <div className="grid grid-cols-[200px_repeat(6,1fr)] gap-1">
                <div className="p-2 text-sm font-medium text-subtle">学生</div>
                {COMPETENCY_DIMENSIONS.map((dim) => (
                  <div key={dim} className="p-2 text-center text-xs text-subtle">
                    {getCompetencyLabel(dim).slice(0, 4)}
                  </div>
                ))}
              </div>

              {/* Heatmap Rows */}
              {students.slice(0, 20).map((student) => (
                <div key={student.id} className="grid grid-cols-[200px_repeat(6,1fr)] gap-1">
                  <Link
                    href={`/teacher/students/${student.id}/diagnosis`}
                    className="flex items-center gap-2 truncate p-2 text-sm text-foreground transition hover:text-amber-500"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs">
                      {student.name.charAt(0)}
                    </div>
                    <span className="truncate">{student.name}</span>
                  </Link>
                  {COMPETENCY_DIMENSIONS.map((dim) => {
                    const cell = heatmap?.matrix?.find(
                      (m) => m.studentId === student.id && m.dimension === dim
                    );
                    const value = cell?.score || 0;
                    const change = cell?.change || 0;
                    const risk = cell?.riskLevel || 'none';

                    let bgColor = 'bg-accent';
                    let textColor = 'text-subtle';

                    if (heatmapView === 'score') {
                      if (value >= 75) {
                        bgColor = 'bg-emerald-500/30';
                        textColor = 'text-emerald-500';
                      } else if (value >= 55) {
                        bgColor = 'bg-amber-500/30';
                        textColor = 'text-amber-500';
                      } else {
                        bgColor = 'bg-red-500/30';
                        textColor = 'text-red-500';
                      }
                    } else if (heatmapView === 'change') {
                      if (change > 5) {
                        bgColor = 'bg-emerald-500/30';
                        textColor = 'text-emerald-500';
                      } else if (change < -5) {
                        bgColor = 'bg-red-500/30';
                        textColor = 'text-red-500';
                      } else {
                        bgColor = 'bg-accent';
                        textColor = 'text-subtle';
                      }
                    } else {
                      if (risk === 'high') {
                        bgColor = 'bg-red-500/50';
                        textColor = 'text-red-500';
                      } else if (risk === 'medium') {
                        bgColor = 'bg-amber-500/50';
                        textColor = 'text-amber-500';
                      } else if (risk === 'low') {
                        bgColor = 'bg-blue-500/30';
                        textColor = 'text-blue-500';
                      }
                    }

                    return (
                      <div
                        key={dim}
                        className={`flex h-10 items-center justify-center rounded ${bgColor} ${textColor} text-xs font-medium`}
                        title={`${getCompetencyLabel(dim)}: ${value}分 (变化: ${change > 0 ? '+' : ''}${change})`}
                      >
                        {heatmapView === 'score'
                          ? Math.round(value)
                          : heatmapView === 'change'
                            ? `${change > 0 ? '+' : ''}${Math.round(change)}`
                            : risk === 'none'
                              ? '✓'
                              : '!'}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Dimension Averages Bar Chart */}
          <div className="surface-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">维度均值对比</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(analytics?.dimensionAverages || {}).map(([dim, score]) => ({
                    dimension: getCompetencyLabel(dim as never).slice(0, 4),
                    score,
                  }))}
                  margin={{ left: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis dataKey="dimension" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="surface-card border p-3 shadow-lg">
                            <p className="font-medium">{payload[0].payload.dimension}</p>
                            <p className="text-2xl font-bold text-amber-500">{payload[0].value}分</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="3 3" />
                  <ReferenceLine y={75} stroke="#22c55e" strokeDasharray="3 3" />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {Object.entries(analytics?.dimensionAverages || {}).map(([, score], index) => (
                      <Cell
                        key={index}
                        fill={score >= 75 ? '#22c55e' : score >= 55 ? '#f59e0b' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend Line Chart */}
          <div className="surface-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">能力趋势</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics?.trendData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="surface-card border p-3 shadow-lg">
                            <p className="text-sm text-subtle">
                              {new Date(payload[0].payload.date).toLocaleDateString('zh-CN')}
                            </p>
                            <p className="text-xl font-bold text-amber-500">{payload[0].value}分</p>
                            <p className="text-xs text-subtle">活跃: {payload[0].payload.activeCount}人</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="averageScore"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Level Distribution */}
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-foreground">能力分层分布</h3>
          <div className="grid gap-4 md:grid-cols-5">
            {[
              { key: 'excellent', label: '优秀', color: 'bg-emerald-500', textColor: 'text-emerald-500', minScore: 85 },
              { key: 'good', label: '良好', color: 'bg-blue-500', textColor: 'text-blue-500', minScore: 70 },
              { key: 'average', label: '中等', color: 'bg-amber-500', textColor: 'text-amber-500', minScore: 55 },
              { key: 'needsImprovement', label: '需提升', color: 'bg-orange-500', textColor: 'text-orange-500', minScore: 40 },
              { key: 'atRisk', label: '需关注', color: 'bg-red-500', textColor: 'text-red-500', minScore: 0 },
            ].map((level) => {
              const count = analytics?.levelDistribution[level.key as keyof typeof analytics.levelDistribution] || 0;
              const percentage = analytics?.studentCount ? Math.round((count / analytics.studentCount) * 100) : 0;
              return (
                <div key={level.key} className="surface-card-soft p-4 text-center">
                  <div className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full ${level.color}/20`}>
                    <span className={`text-lg font-bold ${level.textColor}`}>{count}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{level.label}</p>
                  <p className="text-xs text-subtle">≥{level.minScore}分 · {percentage}%</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Student List */}
        <div>
          <h3 className="mb-4 text-lg font-semibold text-foreground">学生列表</h3>
          <div className="surface-card overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b border-accent p-4 text-sm font-medium text-subtle">
              <div>学生</div>
              <div>综合得分</div>
              <div>风险等级</div>
              <div>最近活跃</div>
              <div>操作</div>
            </div>
            {students.slice(0, 10).map((student) => (
              <div
                key={student.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-accent/50 p-4 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm">
                    {student.name.charAt(0)}
                  </div>
                  <span className="font-medium text-foreground">{student.name}</span>
                </div>
                <div className={`font-bold ${
                  student.overallScore >= 75 ? 'text-emerald-500' :
                  student.overallScore >= 55 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {student.overallScore}
                </div>
                <div>
                  {student.riskLevel === 'high' ? (
                    <span className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-500">高风险</span>
                  ) : student.riskLevel === 'medium' ? (
                    <span className="rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-500">中风险</span>
                  ) : student.riskLevel === 'low' ? (
                    <span className="rounded bg-blue-500/20 px-2 py-1 text-xs text-blue-500">低风险</span>
                  ) : (
                    <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-500">正常</span>
                  )}
                </div>
                <div className="text-sm text-subtle">{formatRelativeDate(student.lastActive)}</div>
                <div>
                  <Link
                    href={`/teacher/students/${student.id}/diagnosis`}
                    className="btn-ghost-themed rounded px-3 py-1.5 text-sm"
                  >
                    查看详情
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  trend,
  color,
  bgColor,
}: {
  label: string;
  value: string | number;
  trend: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-sm text-subtle">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        <span className="text-xs text-subtle">{trend}</span>
      </div>
      <div className={`mt-3 h-1.5 w-full rounded-full bg-accent`}>
        <div className={`h-full rounded-full ${bgColor.replace('/10', '')}`} style={{ width: '60%' }} />
      </div>
    </div>
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  return `${Math.floor(diffDays / 30)}月前`;
}
