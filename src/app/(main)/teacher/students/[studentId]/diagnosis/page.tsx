'use client';

/**
 * 学生个体诊断页面
 *
 * 教师查看单个学生的详细画像和风险分析
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { getCompetencyLabel, COMPETENCY_DIMENSIONS } from '@/lib/data-governance/competency-model';
import type { CompetencyVector, TrendVector } from '@/lib/data-governance/competency-model';
import type { RiskFlag } from '@/lib/data-governance/risk-detector';

interface EvidenceSummaryItem {
  factType: string;
  outcome: string;
  score?: number;
  evidenceTitle?: string;
  stepId?: string;
  questionSummaries?: Array<{
    questionId?: string;
    prompt?: string;
    studentAnswer?: string | null;
    referenceAnswer?: string;
    isCorrect?: boolean;
  }>;
}

interface StudentDiagnosisData {
  student: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    className: string;
  };
  currentSnapshot: {
    vector: CompetencyVector;
    snapshotAt: string;
    factCount: number;
  } | null;
  trendVector: TrendVector | null;
  riskFlags: RiskFlag[];
  recentPerformance: Array<{
    date: string;
    score: number;
    activity: string;
  }>;
  evidenceSummary: Record<string, EvidenceSummaryItem[]>;
  recommendations: Array<{
    type: string;
    title: string;
    description: string;
    scaffolding: string;
  }>;
  classAverage: CompetencyVector | null;
}

export default function StudentDiagnosisPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params?.studentId as string;
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status ?? 'loading';

  const [data, setData] = useState<StudentDiagnosisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teacherNote, setTeacherNote] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // For now, fetch from the student snapshot API
      // In production, this would be a dedicated teacher diagnosis API
      const response = await fetch(`/api/student/competency-snapshot?studentId=${studentId}`);
      if (!response.ok) throw new Error('获取学生诊断数据失败');
      const snapshotData = await response.json();

      // Mock student info
      const mockData: StudentDiagnosisData = {
        student: {
          id: studentId,
          name: '学生姓名',
          email: 'student@example.com',
          avatar: null,
          className: '班级名称',
        },
        currentSnapshot: snapshotData.currentSnapshot,
        trendVector: snapshotData.trendVector,
        riskFlags: snapshotData.riskFlags || [],
        recentPerformance: [
          { date: '2024-01-01', score: 65, activity: '仿真练习' },
          { date: '2024-01-05', score: 68, activity: '知识测试' },
          { date: '2024-01-10', score: 72, activity: '仿真实验' },
          { date: '2024-01-15', score: 70, activity: '提示词设计' },
          { date: '2024-01-20', score: 75, activity: '综合测试' },
        ],
        evidenceSummary: snapshotData.evidenceSummary || {},
        recommendations: [
          {
            type: 'immediate',
            title: '加强跨域知识联系',
            description: '学生在单点知识上表现良好，但跨域迁移能力需要提升',
            scaffolding: '推荐进行联动练习，建立知识间的联系',
          },
          {
            type: 'weekly',
            title: '优化AI使用方式',
            description: '近期AI使用频率高但问题解决率较低',
            scaffolding: '建议引导学生先独立思考，再针对性提问',
          },
        ],
        classAverage: null,
      };

      setData(mockData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id && studentId) {
      if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
        router.replace('/dashboard');
        return;
      }
      void fetchData();
    }
  }, [status, session, router, studentId, fetchData]);

  const handlePushTask = async () => {
    // TODO: Implement push task functionality
    alert('推送补强任务功能将在后续实现');
  };

  const handleAddNote = async () => {
    // TODO: Implement add note functionality
    if (!teacherNote.trim()) return;
    alert('教师备注已添加: ' + teacherNote);
    setTeacherNote('');
  };

  if (status === 'loading' || loading) {
    return (
      <div className="surface-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-subtle">加载诊断数据...</p>
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

  const currentVector = data?.currentSnapshot?.vector;
  const overallScore = currentVector
    ? Math.round(
        COMPETENCY_DIMENSIONS.reduce((sum, d) => sum + currentVector[d].score, 0) /
          COMPETENCY_DIMENSIONS.length
      )
    : 0;

  // Prepare radar chart data
  const radarData = currentVector
    ? COMPETENCY_DIMENSIONS.map((dim) => ({
        dimension: getCompetencyLabel(dim).slice(0, 4),
        fullDimension: getCompetencyLabel(dim),
        score: Math.round(currentVector[dim].score),
        trend: data?.trendVector?.[dim] || 'stable',
      }))
    : [];

  // Get risk level
  const hasHighRisk = data?.riskFlags?.some((r) => r.severity === 'high');
  const hasMediumRisk = data?.riskFlags?.some((r) => r.severity === 'medium');
  const riskLevel = hasHighRisk ? 'high' : hasMediumRisk ? 'medium' : data?.riskFlags?.length ? 'low' : 'none';

  return (
    <div className="surface-page">
      {/* Header */}
      <header className="surface-topbar px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-subtle transition hover:text-foreground">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-foreground">学生个体诊断</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        {/* Student Profile Card */}
        <div className="surface-card mb-8 bg-gradient-to-br from-card via-card to-violet-500/10 p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-2xl font-bold text-white">
                {data?.student?.name?.charAt(0) || 'S'}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{data?.student?.name}</h2>
                <p className="text-subtle">{data?.student?.className}</p>
                <p className="mt-1 text-sm text-subtle">{data?.student?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className={`text-4xl font-bold ${
                  overallScore >= 75 ? 'text-emerald-500' :
                  overallScore >= 55 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {overallScore}
                </div>
                <p className="text-sm text-subtle">综合得分</p>
              </div>
              <div className="h-12 w-px bg-accent" />
              <div className="text-center">
                <div className={`text-2xl font-bold ${
                  riskLevel === 'high' ? 'text-red-500' :
                  riskLevel === 'medium' ? 'text-amber-500' :
                  riskLevel === 'low' ? 'text-blue-500' : 'text-emerald-500'
                }`}>
                  {riskLevel === 'high' ? '高风险' :
                   riskLevel === 'medium' ? '中风险' :
                   riskLevel === 'low' ? '低风险' : '正常'}
                </div>
                <p className="text-sm text-subtle">当前风险等级</p>
              </div>
              <div className="h-12 w-px bg-accent" />
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{data?.currentSnapshot?.factCount || 0}</div>
                <p className="text-sm text-subtle">学习记录</p>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Flags */}
        {data?.riskFlags && data.riskFlags.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-foreground">风险标记</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.riskFlags.map((risk, index) => (
                <div
                  key={index}
                  className={`surface-card-soft p-4 ${
                    risk.severity === 'high'
                      ? 'border-red-500/30 bg-red-500/5'
                      : risk.severity === 'medium'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-blue-500/30 bg-blue-500/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-full p-2 ${
                        risk.severity === 'high'
                          ? 'bg-red-500/20 text-red-500'
                          : risk.severity === 'medium'
                          ? 'bg-amber-500/20 text-amber-500'
                          : 'bg-blue-500/20 text-blue-500'
                      }`}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {risk.type === 'ai_misuse'
                          ? 'AI使用方式'
                          : risk.type === 'participation'
                          ? '学习活跃度'
                          : risk.type === 'constraint'
                          ? '工程约束'
                          : risk.type === 'cross_domain'
                          ? '跨域迁移'
                          : risk.type === 'stagnation'
                          ? '学习停滞'
                          : '其他'}
                      </p>
                      <p className="mt-1 text-sm text-subtle">{risk.description}</p>
                      <p className="mt-2 text-xs text-subtle">
                        触发时间: {new Date(risk.triggeredAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Radar Chart */}
          <div className="surface-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">能力雷达</h3>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="currentColor" strokeOpacity={0.2} />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: 'currentColor', fontSize: 12 }}
                    tickLine={{ stroke: 'currentColor', strokeOpacity: 0.3 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.7 }}
                    tickCount={5}
                    axisLine={{ stroke: 'currentColor', strokeOpacity: 0.3 }}
                  />
                  <Radar
                    name="能力评分"
                    dataKey="score"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="surface-card border p-3 shadow-lg">
                            <p className="font-medium text-amber-500">{item.fullDimension}</p>
                            <p className="text-2xl font-bold">{item.score}</p>
                            <p className="mt-1 text-xs text-subtle">
                              趋势: {item.trend === 'up' ? '上升' : item.trend === 'down' ? '下降' : '稳定'}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Performance */}
          <div className="surface-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">近5次表现趋势</h3>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.recentPerformance || []}>
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
                            <p className="text-sm text-subtle">{payload[0].payload.activity}</p>
                            <p className="text-xl font-bold text-amber-500">{payload[0].value}分</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="3 3" label="及格线" />
                  <ReferenceLine y={75} stroke="#22c55e" strokeDasharray="3 3" label="良好" />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Evidence Summary */}
        {data?.evidenceSummary && Object.keys(data.evidenceSummary).length > 0 && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-foreground">能力证据链</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(data.evidenceSummary).slice(0, 6).map(([dimension, evidence]) => (
                <div key={dimension} className="surface-card-soft p-4">
                  <p className="font-medium text-foreground">{getCompetencyLabel(dimension as never)}</p>
                  <div className="mt-3 space-y-2">
                    {evidence.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="rounded-lg border border-border/60 bg-card/70 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-foreground">{formatEvidenceTitle(item)}</span>
                          <span className={getOutcomeBadgeClass(item.outcome)}>{formatOutcome(item.outcome)}</span>
                        </div>
                        {typeof item.score === 'number' && (
                          <p className="mt-1 text-xs text-subtle">评分 {item.score}</p>
                        )}
                        {item.questionSummaries?.slice(0, 2).map((question, questionIndex) => (
                          <p key={`${question.questionId ?? questionIndex}`} className="mt-2 text-xs text-subtle">
                            {question.prompt ?? question.questionId ?? '题目'}：作答 {question.studentAnswer ?? '未作答'}
                            {question.referenceAnswer ? `，参考 ${question.referenceAnswer}` : ''}
                            {typeof question.isCorrect === 'boolean' ? `，${question.isCorrect ? '正确' : '需修正'}` : ''}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Intervention Strategies */}
        {data?.recommendations && data.recommendations.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-foreground">推荐干预策略</h3>
            <div className="space-y-4">
              {data.recommendations.map((rec, index) => (
                <div key={index} className="surface-card-soft p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`rounded-full p-2 ${
                        rec.type === 'immediate'
                          ? 'bg-red-500/20 text-red-500'
                          : rec.type === 'weekly'
                          ? 'bg-blue-500/20 text-blue-500'
                          : 'bg-purple-500/20 text-purple-500'
                      }`}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            rec.type === 'immediate'
                              ? 'bg-red-500/20 text-red-500'
                              : rec.type === 'weekly'
                              ? 'bg-blue-500/20 text-blue-500'
                              : 'bg-purple-500/20 text-purple-500'
                          }`}
                        >
                          {rec.type === 'immediate' ? '立即' : rec.type === 'weekly' ? '本周' : '长期'}
                        </span>
                        <h4 className="font-medium text-foreground">{rec.title}</h4>
                      </div>
                      <p className="mt-1 text-sm text-subtle">{rec.description}</p>
                      <div className="mt-2 rounded bg-accent/50 p-2">
                        <p className="text-xs text-subtle">
                          <span className="font-medium">建议措施:</span> {rec.scaffolding}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Teacher Actions */}
        <div className="surface-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">教师操作</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="surface-card-soft p-4">
              <h4 className="font-medium text-foreground">推送补强任务</h4>
              <p className="mt-1 text-sm text-subtle">为学生推送个性化的补强任务和练习</p>
              <button onClick={handlePushTask} className="cta-primary mt-3 rounded-lg px-4 py-2 text-sm">
                一键推送
              </button>
            </div>
            <div className="surface-card-soft p-4">
              <h4 className="font-medium text-foreground">追加教师备注</h4>
              <p className="mt-1 text-sm text-subtle">为学生添加教师观察备注，供AI助手参考</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={teacherNote}
                  onChange={(e) => setTeacherNote(e.target.value)}
                  placeholder="输入备注..."
                  className="input-themed flex-1 rounded-lg px-3 py-2 text-sm"
                />
                <button onClick={handleAddNote} className="btn-ghost-themed rounded-lg px-4 py-2 text-sm">
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

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
