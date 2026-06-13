'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  Copy,
  Check,
  GraduationCap,
  Play,
  Clock,
  History,
  QrCode,
  RefreshCcw,
  Calendar,
  Search,
  X,
  BookOpen,
  UserPlus,
  Trash2,
  Loader2,
  BarChart3,
  ShieldAlert,
  Database,
} from 'lucide-react';
import { AddStudentsModal } from '@/components/teacher/add-students-modal';
import type { TeacherClassInsightsPayload } from '@/app/api/teacher/classes/[classId]/insights/route';
import { DiagnosisSurfacePanel } from '@/features/adaptive/diagnosis-surface-panel';
import {
  buildTeacherClassInsightsHref,
  buildTeacherStudentInsightsHref,
  formatTeacherStudentDisplayId,
} from '@/features/teacher/teacher-insights';

interface Student {
  id: string;
  studentNumber: string | null;
  techScore: number;
  ethicsScore: number;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

interface ClassDetail {
  id: string;
  name: string;
  code: string;
  description: string | null;
  year: string | null;
  semester: string | null;
  isActive: boolean;
  students: Student[];
  _count: { students: number };
}

interface ClassSession {
  id: string;
  joinCode: string;
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  startTime: string;
  endTime: string | null;
  currentStage: string | null;
  plan: {
    id: string;
    title: string;
  };
  studentCount: number;
  durationMinutes: number | null;
}

interface LessonPlan {
  id: string;
  title: string;
  description: string | null;
}

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params?.classId as string;

  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [insights, setInsights] = useState<TeacherClassInsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // 开始上课相关
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const [regeneratingJoinCode, setRegeneratingJoinCode] = useState(false);
  const [endingSessionId, setEndingSessionId] = useState<string | null>(null);

  // 历史筛选
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // 添加学生弹窗
  const [showAddStudentsModal, setShowAddStudentsModal] = useState(false);
  const [removingStudent, setRemovingStudent] = useState<string | null>(null);

  // 获取班级信息
  const fetchClass = useCallback(async () => {
    if (!classId) return;
    try {
      const res = await fetch(`/api/teacher/classes/${classId}`);
      if (res.ok) {
        const data = await res.json();
        setClassData(data);
      }
    } catch (error) {
      console.error('获取班级详情失败', error);
    }
  }, [classId]);

  // 获取课堂历史
  const fetchSessions = useCallback(async () => {
    if (!classId) return;
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);

      const res = await fetch(`/api/teacher/classes/${classId}/sessions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('获取课堂历史失败', error);
    }
  }, [classId, statusFilter, searchTerm]);

  const fetchInsights = useCallback(async () => {
    if (!classId) return;
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/insights`);
      if (res.ok) {
        const data = await res.json();
        setInsights(data);
      }
    } catch (error) {
      console.error('获取班级学情失败', error);
    }
  }, [classId]);

  // 获取教案列表
  const fetchLessonPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/lesson-plans');
      if (res.ok) {
        const data = await res.json();
        setLessonPlans(data);
      }
    } catch (error) {
      console.error('获取教案列表失败', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchClass(), fetchSessions(), fetchLessonPlans(), fetchInsights()]);
      setLoading(false);
    };
    if (classId) {
      loadData();
    }
  }, [classId, fetchClass, fetchSessions, fetchLessonPlans, fetchInsights]);

  // 筛选变化时重新获取
  useEffect(() => {
    if (classId && !loading) {
      fetchSessions();
    }
  }, [statusFilter, searchTerm, classId, fetchSessions, loading]);

  const copyCode = async () => {
    if (classData) {
      await navigator.clipboard.writeText(classData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 开始上课
  const handleStartClass = async () => {
    if (!selectedPlanId) {
      alert('请选择教案');
      return;
    }

    setStarting(true);
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlanId, classId })
      });

      if (!res.ok) {
        const error = await res.json();
        if (error.existingSessionId) {
          // 已有进行中的课堂
          if (confirm('该班级已有进行中的课堂，是否直接进入？')) {
            router.push(`/classroom/teacher/${error.existingSessionId}`);
          }
          return;
        }
        throw new Error(error.error || '开始课堂失败');
      }

      const session = await res.json();
      router.push(`/classroom/teacher/${session.id}`);
    } catch (error) {
      console.error('开始课堂失败:', error);
      alert(error instanceof Error ? error.message : '开始课堂失败');
    } finally {
      setStarting(false);
    }
  };

  // 移除学生
  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`确定要将 ${studentName} 从班级中移除吗？`)) return;

    setRemovingStudent(studentId);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/students?userId=${studentId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await Promise.all([fetchClass(), fetchInsights()]);
      } else {
        const data = await res.json();
        alert(data.error || '移除失败');
      }
    } catch (error) {
      console.error('Remove student error:', error);
      alert('移除失败');
    } finally {
      setRemovingStudent(null);
    }
  };

  const handleFinishSession = async (sessionId: string) => {
    if (!confirm('确定停止这节正在进行的课堂吗？')) return;

    setEndingSessionId(sessionId);
    try {
      const res = await fetch(`/api/session/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FINISHED' }),
      });

      if (!res.ok) {
        const payloadText = await res.text();
        let message = '停止课堂失败';
        if (payloadText) {
          try {
            const payload = JSON.parse(payloadText);
            message = payload?.error || message;
          } catch {
            message = payloadText;
          }
        }
        throw new Error(message);
      }

      await fetchSessions();
    } catch (error) {
      console.error('Finish session error:', error);
      alert(error instanceof Error ? error.message : '停止课堂失败');
    } finally {
      setEndingSessionId(null);
    }
  };

  // 当前进行中的课堂
  const activeSession = sessions.find(s => s.status === 'ACTIVE');
  const displayedSessions = statusFilter === 'ACTIVE' ? sessions.filter(s => s.status === 'ACTIVE') : sessions.filter(s => s.status === 'FINISHED');
  const governance = insights?.governance;
  const evidenceCoverage = governance?.evidenceCoverage;
  const recentSessionQuality = governance?.recentSessionQuality;
  const studentInsightMap = new Map(insights?.students.map((student) => [student.id, student]) || []);

  const handleRegenerateJoinCode = async () => {
    if (!activeSession) return;
    if (!confirm('确定重新生成课堂码？旧码将立即失效。')) return;

    setRegeneratingJoinCode(true);
    try {
      const res = await fetch(`/api/session/${activeSession.id}/join-code`, {
        method: 'PATCH',
      });

      if (!res.ok) {
        const payloadText = await res.text();
        let message = '重置课堂码失败';
        if (payloadText) {
          try {
            const payload = JSON.parse(payloadText);
            message = payload?.error || message;
          } catch {
            message = payloadText;
          }
        }
        throw new Error(message);
      }

      const data = await res.json();
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSession.id
            ? { ...session, joinCode: data.joinCode }
            : session
        )
      );
    } catch (error) {
      console.error('Regenerate join code error:', error);
      alert(error instanceof Error ? error.message : '重置课堂码失败');
    } finally {
      setRegeneratingJoinCode(false);
    }
  };

  if (loading) {
    return (
      <main
        className="surface-page mx-auto max-w-[1600px] px-6 py-8"
        data-commercial-operations-workspace="teacher-operations"
        data-commercial-workspace-zone="instrument-area"
      >
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-accent" />
          <div className="h-32 rounded-xl bg-accent" />
        </div>
      </main>
    );
  }

  if (!classData) {
    return (
      <main
        className="surface-page mx-auto max-w-[1600px] px-6 py-8"
        data-commercial-operations-workspace="teacher-operations"
        data-commercial-workspace-zone="instrument-area"
      >
        <div className="text-center">
          <p className="text-xl text-subtle">班级不存在</p>
          <Link
            href="/teacher/classes"
            className="mt-4 inline-block text-primary hover:text-primary/80"
          >
            返回班级列表
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="surface-page mx-auto max-w-[1600px] px-6 py-8"
      data-commercial-operations-workspace="teacher-operations"
      data-commercial-workspace-zone="instrument-area"
    >
      {/* 返回链接 */}
      <Link
        href="/teacher/classes"
        className="mb-6 inline-flex items-center gap-2 text-sm text-subtle transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回班级列表
      </Link>

      {/* 班级信息卡片 */}
      <section className="teacher-insight-hero mb-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-500 dark:text-sky-300">
                <Users className="h-8 w-8" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">{classData.name}</h1>
                  {governance && (
                    <span className={`teacher-insight-chip ${
                      governance.tone === 'healthy'
                        ? 'teacher-insight-chip-healthy'
                        : governance.tone === 'warning'
                          ? 'teacher-insight-chip-warning'
                          : 'teacher-insight-chip-pending'
                    }`}>
                      {governance.label}
                    </span>
                  )}
                </div>
                {classData.description && (
                  <p className="mt-1 max-w-3xl text-subtle">{classData.description}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-subtle">
                  {classData.year && <span>{classData.year}</span>}
                  {classData.semester && <span>{classData.semester}</span>}
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-4 w-4" />
                    {classData._count.students} 名学生
                  </span>
                  {governance && <span>{governance.lastUpdatedLabel}</span>}
                </div>
              </div>
            </div>

            {governance && (
              <div className="teacher-insight-metric max-w-3xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">班级学情治理进度</p>
                    <p className="mt-1 text-sm text-subtle">{governance.detail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-foreground">
                      {governance.coveredStudents}/{governance.totalStudents || classData._count.students}
                    </p>
                    <p className="text-xs text-subtle">已覆盖学生</p>
                  </div>
                </div>
                <div className="teacher-insight-track mt-4">
                  <div
                    className="teacher-insight-fill"
                    style={{ width: `${Math.min(governance.coverageRatio * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="teacher-insight-metric min-w-[220px]">
              <p className="text-xs uppercase tracking-[0.18em] text-subtle">班级加入码</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-mono text-2xl font-bold tracking-wider text-sky-500 dark:text-sky-300">
                  {classData.code}
                </span>
                <button
                  onClick={copyCode}
                  className="rounded-lg border border-sky-500/30 p-2 text-sky-500 transition hover:bg-sky-500/10 dark:text-sky-300"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowStartModal(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 font-medium text-white transition hover:from-emerald-500 hover:to-green-500"
            >
              <Play className="h-5 w-5" />
              开始上课
            </button>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-4">
        <Link href={buildTeacherClassInsightsHref(classId)} className="teacher-insight-entry">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">班级学情总览</p>
              <p className="mt-2 text-sm text-subtle">
                查看能力矩阵、风险分层和治理覆盖情况。
              </p>
            </div>
            <BarChart3 className="h-5 w-5 text-sky-500 dark:text-sky-300" />
          </div>
        </Link>
        <Link href="#history" className="teacher-insight-entry">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">课堂历史</p>
              <p className="mt-2 text-sm text-subtle">
                回看已结束课堂、课堂记录与复盘入口。
              </p>
            </div>
            <History className="h-5 w-5 text-amber-500" />
          </div>
        </Link>
        <Link href="#students" className="teacher-insight-entry">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">学生清单</p>
              <p className="mt-2 text-sm text-subtle">
                进入学生画像、成长档案与个体风险详情。
              </p>
            </div>
            <GraduationCap className="h-5 w-5 text-emerald-500" />
          </div>
        </Link>
        <div className="teacher-insight-entry">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">重点关注</p>
              <p className="mt-2 text-sm text-subtle">
                {insights
                  ? `${insights.overview.attentionStudents} 名学生处于需重点跟进状态。`
                  : '等待治理结果生成后自动显示重点学生。'}
              </p>
            </div>
            <ShieldAlert className="h-5 w-5 text-rose-500" />
          </div>
        </div>
      </section>

      {insights && (
        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="teacher-insight-metric">
            <p className="text-sm text-subtle">班级总体指数</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{insights.overview.overallIndex}</p>
            <p className="mt-2 text-xs text-subtle">来自最新班级快照与学生画像聚合。</p>
          </div>
          <div className="teacher-insight-metric">
            <p className="text-sm text-subtle">高风险学生</p>
            <p className="mt-2 text-3xl font-semibold text-rose-500">{insights.overview.highRiskStudents}</p>
            <p className="mt-2 text-xs text-subtle">需要优先干预的个体数量。</p>
          </div>
          <div className="teacher-insight-metric">
            <p className="text-sm text-subtle">中风险学生</p>
            <p className="mt-2 text-3xl font-semibold text-amber-500">{insights.overview.mediumRiskStudents}</p>
            <p className="mt-2 text-xs text-subtle">建议在课堂中持续观察的学生。</p>
          </div>
          <div className="teacher-insight-metric">
            <p className="text-sm text-subtle">人均学习事实</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{insights.overview.averageFactCount}</p>
            <p className="mt-2 text-xs text-subtle">反映治理链路沉淀下来的过程证据密度。</p>
          </div>
          <div className="teacher-insight-metric">
            <p className="text-sm text-subtle">证据充分</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-500">
              {evidenceCoverage?.readyStudents ?? 0}/{evidenceCoverage?.totalStudents ?? 0}
            </p>
            <p className="mt-2 text-xs text-subtle">
              {evidenceCoverage?.staleStudents ?? 0} 名待刷新，{evidenceCoverage?.missingStudents ?? 0} 名缺少证据。
            </p>
          </div>
          <div className="teacher-insight-metric">
            <p className="text-sm text-subtle">近期会话质量</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{recentSessionQuality?.green ?? 0}/{recentSessionQuality?.totalReports ?? 0}</p>
            <p className="mt-2 text-xs text-subtle">
              黄灯 {recentSessionQuality?.yellow ?? 0}，红灯 {recentSessionQuality?.red ?? 0}。
            </p>
          </div>
        </section>
      )}

      {insights && (
        <div className="mb-8">
          <DiagnosisSurfacePanel
            diagnosis={insights.diagnosis}
            mode="teacher-class"
            title="控制校正班级诊断"
            description="聚合班级诊断快照、弱点聚类、证据覆盖与备课入口状态。"
          />
        </div>
      )}

      {/* 进行中的课堂 */}
      {activeSession && (
        <div className="surface-card mb-8 border-emerald-500/30 bg-emerald-500/10 p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
            <h2 className="text-lg font-semibold text-emerald-400">进行中的课堂</h2>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xl font-medium text-foreground">{activeSession.plan.title}</p>
              <div className="mt-2 flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {new Date(activeSession.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 开始
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {activeSession.studentCount} 人参与
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="surface-card-soft flex items-center gap-2 px-4 py-2">
                <QrCode className="h-5 w-5 text-emerald-400" />
                <span className="font-mono text-lg font-bold text-foreground">{activeSession.joinCode}</span>
              </div>
              <button
                onClick={handleRegenerateJoinCode}
                disabled={regeneratingJoinCode}
                className="flex items-center gap-2 rounded-lg border border-emerald-500/40 px-3 py-2 text-sm text-emerald-200 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCcw className={regeneratingJoinCode ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                重新生成
              </button>
              <Link
                href={`/classroom/teacher/${activeSession.id}`}
                className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-500"
              >
                进入课堂
              </Link>
              <button
                onClick={() => void handleFinishSession(activeSession.id)}
                disabled={endingSessionId === activeSession.id}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 px-4 py-2 text-sm font-medium text-rose-300 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {endingSessionId === activeSession.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                停止课堂
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 课堂历史 */}
      <div id="history" className="surface-card mb-8 p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-subtle" />
            <h2 className="text-lg font-semibold text-foreground">课堂历史</h2>
            <span className="text-sm text-slate-500">({displayedSessions.length})</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 状态筛选 */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="btn-ghost-themed rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">全部状态</option>
              <option value="FINISHED">已结束</option>
              <option value="ACTIVE">进行中</option>
            </select>

            {/* 搜索 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="搜索教案..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-48 rounded-lg border border-border/70 bg-background/70 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-slate-500 focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {displayedSessions.length === 0 ? (
          <div className="py-12 text-center">
            <History className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-4 text-slate-500">暂无课堂历史记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedSessions.map(session => (
              <div
                key={session.id}
                className="surface-card-soft flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">{session.plan.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(session.startTime).toLocaleDateString('zh-CN')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {session.durationMinutes ? `${session.durationMinutes} 分钟` : '-'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {session.studentCount} 人
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.status === 'ACTIVE' ? (
                    <>
                      <Link
                        href={`/classroom/teacher/${session.id}`}
                        className="btn-ghost-themed rounded-lg px-3 py-1.5 text-sm transition"
                      >
                        进入课堂
                      </Link>
                      <button
                        onClick={() => void handleFinishSession(session.id)}
                        disabled={endingSessionId === session.id}
                        className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-300 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {endingSessionId === session.id ? '停止中...' : '停止课堂'}
                      </button>
                    </>
                  ) : (
                    <Link
                      href={`/classroom/teacher/${session.id}/review`}
                      className="btn-ghost-themed rounded-lg px-3 py-1.5 text-sm transition"
                    >
                      课堂统计
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 学生列表 */}
      <div id="students" className="surface-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-subtle" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">班级学生</h2>
              <p className="text-sm text-subtle">以学生画像、风险和成长档案为主视图，不再只显示技术分/伦理分。</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{classData.students.length} 人</span>
            <button
              onClick={() => setShowAddStudentsModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-sky-500/50 px-3 py-1.5 text-sm text-sky-400 transition hover:bg-sky-500/10"
            >
              <UserPlus className="h-4 w-4" />
              添加学生
            </button>
          </div>
        </div>

        {classData.students.length === 0 ? (
          <div className="py-12 text-center">
            <GraduationCap className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-4 text-slate-500">暂无学生加入此班级</p>
            <p className="mt-2 text-sm text-slate-600">
              将班级码 <span className="font-mono text-sky-400">{classData.code}</span> 分享给学生
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.16em] text-subtle">
                  <th className="px-4 py-3 font-medium">学生</th>
                  <th className="px-4 py-3 font-medium">画像等级</th>
                  <th className="px-4 py-3 font-medium">综合指数</th>
                  <th className="px-4 py-3 font-medium">证据状态</th>
                  <th className="px-4 py-3 font-medium">风险状态</th>
                  <th className="px-4 py-3 font-medium">近期趋势</th>
                  <th className="px-4 py-3 font-medium">成长档案</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {classData.students.map((student) => {
                  const insight = studentInsightMap.get(student.user.id);
                  return (
                    <tr
                      key={student.id}
                      className="border-b border-border/50 bg-card/45 transition hover:bg-accent/45"
                    >
                      <td className="px-4 py-4 align-top">
                        <Link
                          href={buildTeacherStudentInsightsHref(classId, student.user.id)}
                          className="flex min-w-[220px] items-center gap-3"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-sm font-bold text-white">
                            {student.user.name?.charAt(0) || 'S'}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{student.user.name || '未命名学生'}</p>
                            <p className="text-xs text-subtle">
                              {formatTeacherStudentDisplayId({
                                studentNumber: student.studentNumber,
                                email: student.user.email,
                                fallbackId: student.user.id,
                              })}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-4 align-top text-foreground">
                        {insight ? insight.overallLevel : '待生成'}
                      </td>
                      <td className="px-4 py-4 align-top">
                        {insight ? (
                          <span className="font-semibold text-sky-600 dark:text-sky-300">
                            {insight.overallScore}
                          </span>
                        ) : (
                          <span className="text-subtle">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        {insight ? (
                          <div className="min-w-[150px]">
                            <span className={getTeacherEvidenceStateChipClass(insight.evidenceStatus)}>
                              {formatTeacherEvidenceState(insight.evidenceStatus)}
                            </span>
                            <p className="mt-2 flex items-center gap-1 text-xs text-subtle">
                              <Database className="h-3.5 w-3.5" />
                              {formatTeacherEvidenceConfidence(insight.evidenceStatus)}
                            </p>
                          </div>
                        ) : (
                          <span className="teacher-insight-chip teacher-insight-chip-pending">待生成</span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        {insight ? (
                          <span className={`teacher-insight-chip teacher-insight-risk-${insight.riskLevel}`}>
                            {insight.riskLabel}
                          </span>
                        ) : (
                          <span className="teacher-insight-chip teacher-insight-chip-pending">待生成</span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top text-foreground">
                        {insight ? insight.recentTrend : '治理结果待生成'}
                      </td>
                      <td className="px-4 py-4 align-top">
                        {insight ? (
                          <span className="font-semibold text-foreground">{insight.growthRecordCount}</span>
                        ) : (
                          <span className="text-subtle">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <Link
                            href={buildTeacherStudentInsightsHref(classId, student.user.id)}
                            className="btn-ghost-themed rounded-lg px-3 py-1.5 text-sm"
                          >
                            详情
                          </Link>
                          <button
                            onClick={() => handleRemoveStudent(student.user.id, student.user.name || '该学生')}
                            disabled={removingStudent === student.user.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-3 py-1.5 text-sm text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-300 disabled:opacity-50"
                          >
                            {removingStudent === student.user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 开始上课模态框 */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="surface-card mx-4 w-full max-w-md p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-foreground">开始上课</h3>
              <button
                onClick={() => setShowStartModal(false)}
                className="btn-ghost-themed rounded-lg p-1 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-slate-300">
                选择教案
              </label>
              {lessonPlans.length === 0 ? (
                <div className="surface-card-soft p-4 text-center">
                  <BookOpen className="mx-auto h-8 w-8 text-slate-500" />
                  <p className="mt-2 text-sm text-slate-400">暂无可用教案</p>
                  <Link
                    href={`/teacher/lesson-plans/new?returnTo=${encodeURIComponent(`/teacher/classes/${classId}`)}`}
                    className="mt-2 inline-block text-sm text-sky-400 hover:text-sky-300"
                  >
                    创建教案
                  </Link>
                </div>
              ) : (
                <select
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                  className="w-full rounded-lg border border-border/70 bg-background/70 px-4 py-3 text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">请选择教案...</option>
                  {lessonPlans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowStartModal(false)}
                className="btn-ghost-themed flex-1 rounded-lg py-3 font-medium transition"
              >
                取消
              </button>
              <button
                onClick={handleStartClass}
                disabled={!selectedPlanId || starting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {starting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    开始中...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    开始上课
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加学生弹窗 */}
      <AddStudentsModal
        classId={classId}
        className={classData?.name || ''}
        isOpen={showAddStudentsModal}
        onClose={() => setShowAddStudentsModal(false)}
        onSuccess={() => {
          void Promise.all([fetchClass(), fetchInsights()]);
        }}
      />
    </main>
  );
}

type TeacherEvidenceStatus = TeacherClassInsightsPayload['students'][number]['evidenceStatus'];

function formatTeacherEvidenceState(status: TeacherEvidenceStatus): string {
  if (status.state === 'missing') return '缺少证据';
  if (status.state === 'stale') return '待刷新';
  if (status.confidence.level === 'low' || status.statusMarkers.includes('low-confidence')) {
    return '低置信';
  }
  return '可使用';
}

function getTeacherEvidenceStateChipClass(status: TeacherEvidenceStatus): string {
  const base = 'teacher-insight-chip';
  if (status.state === 'missing') return `${base} teacher-insight-chip-pending`;
  if (status.state === 'stale') return `${base} teacher-insight-chip-warning`;
  if (status.confidence.level === 'low' || status.statusMarkers.includes('low-confidence')) {
    return `${base} teacher-insight-chip-warning`;
  }
  return `${base} teacher-insight-chip-healthy`;
}

function formatTeacherEvidenceConfidence(status: TeacherEvidenceStatus): string {
  const levelLabel = status.confidence.level === 'high'
    ? '高'
    : status.confidence.level === 'medium'
      ? '中'
      : status.confidence.level === 'low'
        ? '低'
        : '无';
  return `${levelLabel}置信 · ${status.confidence.evidenceCount} 条证据`;
}
