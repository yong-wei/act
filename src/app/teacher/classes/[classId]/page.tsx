'use client';

import { useEffect, useId, useRef, useState, useCallback } from 'react';
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
import { ActionStatusPanel } from '@/components/platform/action-status';
import { AddStudentsModal } from '@/components/teacher/add-students-modal';
import type { TeacherClassInsightsPayload } from '@/app/api/teacher/classes/[classId]/insights/route';
import { DiagnosisSurfacePanel } from '@/features/adaptive/diagnosis-surface-panel';
import {
  requestClassroomActionConfirmation,
  requestClassroomConflictChoice,
  requestClassroomEndConfirmation,
} from '@/features/classroom/classroom-lifecycle-dialog';
import {
  buildTeacherClassInsightsHref,
  buildTeacherStudentInsightsHref,
  formatTeacherStudentDisplayId,
} from '@/features/teacher/teacher-insights';
import { buildPlatformRecoveryState } from '@/lib/platform-recovery-contract';

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

const START_DIALOG_FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getStartDialogFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(START_DIALOG_FOCUSABLE_SELECTOR))
    .filter((item) => !item.hasAttribute('disabled') && item.offsetParent !== null);
}

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params?.classId as string;
  const startDialogRef = useRef<HTMLDivElement>(null);
  const startDialogOpenerRef = useRef<HTMLElement | null>(null);

  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [insights, setInsights] = useState<TeacherClassInsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState('班级详情正在加载。');

  // 开始上课相关
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const lessonPlanSelectId = useId();
  const startDialogErrorId = useId();
  const [startDialogError, setStartDialogError] = useState('');
  const [starting, setStarting] = useState(false);
  const [regeneratingJoinCode, setRegeneratingJoinCode] = useState(false);
  const [endingSessionId, setEndingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

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
      const res = await fetch(`/api/teacher/classes/${classId}/insights?scope=cumulative`);
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

  const openStartDialog = useCallback(() => {
    const activeElement = document.activeElement;
    startDialogOpenerRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    setStartDialogError('');
    setShowStartModal(true);
  }, []);

  const closeStartDialog = useCallback(() => {
    setStartDialogError('');
    setShowStartModal(false);
    window.requestAnimationFrame(() => {
      const opener = startDialogOpenerRef.current;
      if (opener?.isConnected && opener.offsetParent !== null) {
        opener.focus();
      }
    });
  }, []);

  useEffect(() => {
    if (!showStartModal) return;
    const dialog = startDialogRef.current;
    if (!dialog) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeStartDialog();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getStartDialogFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement) || document.activeElement === dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.requestAnimationFrame(() => {
      getStartDialogFocusableElements(dialog)[0]?.focus() ?? dialog.focus();
    });
    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [closeStartDialog, showStartModal]);

  const copyCode = async () => {
    if (classData) {
      await navigator.clipboard.writeText(classData.code);
      setCopied(true);
      setAnnouncement('班级加入码已复制。');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 开始上课
  const handleStartClass = async () => {
    setStartDialogError('');
    if (!selectedPlanId) {
      const message = '请选择教案后再开始上课。';
      setStartDialogError(message);
      setAnnouncement(message);
      return;
    }

    setStarting(true);
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlanId, classId, launchContext: 'class-bound' })
      });

      if (!res.ok) {
        const error = await res.json();
        if (error.existingSessionId && error.requiresExplicitChoice) {
          setStarting(false);
          const choice = await requestClassroomConflictChoice({
            identity: error.classroomIdentity,
            message: error.error,
          });
          if (choice === 'reuse') {
            router.push(`/classroom/teacher/${error.existingSessionId}`);
            return;
          }
          if (choice === 'new-session') {
            setStarting(true);
            const retry = await fetch('/api/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                planId: selectedPlanId,
                classId,
                launchContext: 'class-bound',
                duplicateAction: 'new-session',
              }),
            });
            const retryPayload = await retry.json().catch(() => ({}));
            if (!retry.ok || !retryPayload.id) {
              throw new Error(retryPayload.error || '开始课堂失败');
            }
            setAnnouncement('课堂已创建，正在进入教师课堂。');
            router.push(`/classroom/teacher/${retryPayload.id}`);
          }
          return;
        }
        throw new Error(error.error || '开始课堂失败');
      }

      const session = await res.json();
      setAnnouncement('课堂已创建，正在进入教师课堂。');
      router.push(`/classroom/teacher/${session.id}`);
    } catch (error) {
      console.error('开始课堂失败:', error);
      const message = error instanceof Error ? error.message : '开始课堂失败';
      setStartDialogError(message);
      setAnnouncement(message);
    } finally {
      setStarting(false);
    }
  };

  // 移除学生
  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    const confirmed = await requestClassroomActionConfirmation({
      title: '移除班级学生',
      description: `确认将 ${studentName} 从当前班级移除？`,
      details: ['学生账号不会被删除', '该学生将不能通过当前班级身份进入后续课堂', '已有课堂证据仍保留在历史记录中'],
      confirmLabel: '确认移除',
      dataState: 'remove-student',
    });
    if (!confirmed) return;

    setRemovingStudent(studentId);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/students?userId=${studentId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await Promise.all([fetchClass(), fetchInsights()]);
        setAnnouncement(`${studentName} 已从班级移除。`);
      } else {
        const data = await res.json();
        setAnnouncement(data.error || '移除失败');
      }
    } catch (error) {
      console.error('Remove student error:', error);
      setAnnouncement('移除失败');
    } finally {
      setRemovingStudent(null);
    }
  };

  const handleFinishSession = async (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    const confirmed = await requestClassroomEndConfirmation([
      session ? `课堂：${session.plan.title}` : `课堂会话：${sessionId}`,
      session ? `当前参与：${session.studentCount} 名学生` : '学生端将进入课堂结束态',
      '教师端课堂历史会在结束后刷新',
    ]);
    if (!confirmed) return;

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
      setAnnouncement('课堂已停止，课堂历史已刷新。');
    } catch (error) {
      console.error('Finish session error:', error);
      setAnnouncement(error instanceof Error ? error.message : '停止课堂失败');
    } finally {
      setEndingSessionId(null);
    }
  };

  const handleDeleteFinishedSession = async (session: ClassSession) => {
    if (session.status !== 'FINISHED') {
      setAnnouncement('仅可删除已结束课堂。');
      return;
    }
    const impact = [
      `${session.studentCount} 名学生的课堂状态`,
      '课堂作答与步进响应',
      '课堂复盘报告与学生报告',
    ];
    const confirmed = await requestClassroomActionConfirmation({
      title: '删除已结束课堂',
      description: `确认删除《${session.plan.title}》这节已结束课堂？`,
      details: impact,
      confirmLabel: '确认删除',
      dataState: 'delete-finished-session',
    });
    if (!confirmed) return;

    setDeletingSessionId(session.id);
    try {
      const res = await fetch(`/api/teacher/sessions?id=${encodeURIComponent(session.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || '删除课堂失败');
      }
      await Promise.all([fetchSessions(), fetchInsights()]);
      setAnnouncement(`已删除课堂《${session.plan.title}》，关联课堂状态与报告已按审计边界清理。`);
    } catch (error) {
      console.error('Delete finished session error:', error);
      setAnnouncement(error instanceof Error ? error.message : '删除课堂失败');
    } finally {
      setDeletingSessionId(null);
    }
  };

  // 当前进行中的课堂
  const activeSession = sessions.find(s => s.status === 'ACTIVE');
  const displayedSessions = statusFilter === 'ACTIVE' ? sessions.filter(s => s.status === 'ACTIVE') : sessions.filter(s => s.status === 'FINISHED');
  const governance = insights?.governance;
  const evidenceCoverage = governance?.evidenceCoverage;
  const studentInsightMap = new Map(insights?.students.map((student) => [student.id, student]) || []);
  const classDetailStatus = `${announcement} 当前显示 ${displayedSessions.length} 条课堂历史，${classData?.students.length ?? 0} 名学生。`;

  const handleRegenerateJoinCode = async () => {
    if (!activeSession) return;
    const confirmed = await requestClassroomActionConfirmation({
      title: '重新生成课堂码',
      description: '确认重新生成当前课堂的加入码？',
      details: ['旧课堂码将立即失效', `当前课堂：${activeSession.plan.title}`, '已在课堂内的学生不会被移除'],
      confirmLabel: '确认重新生成',
      dataState: 'regenerate-join-code',
    });
    if (!confirmed) return;

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
      setAnnouncement('课堂码已重新生成。');
    } catch (error) {
      console.error('Regenerate join code error:', error);
      setAnnouncement(error instanceof Error ? error.message : '重置课堂码失败');
    } finally {
      setRegeneratingJoinCode(false);
    }
  };

  if (loading) {
    return (
      <main
        className="surface-page px-6 py-8"
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
    const missingClassState = buildPlatformRecoveryState({
      kind: 'missing-object',
      sourceRoute: '/teacher/classes/[classId]',
      targetLabel: '班级',
      displayReference: typeof classId === 'string' ? classId : null,
      message: '班级不存在或当前教师账号不可见。',
      recoveryAction: '返回班级列表并刷新数据',
    });

    return (
      <main
        className="surface-page px-6 py-8"
        data-commercial-operations-workspace="teacher-operations"
        data-commercial-workspace-zone="instrument-area"
      >
        <ActionStatusPanel
          state={missingClassState}
          action={(
            <Link
              href="/teacher/classes"
              className="inline-flex rounded-lg border border-border px-3 py-2 text-sm text-primary hover:text-primary/80"
            >
              返回班级列表
            </Link>
          )}
        />
      </main>
    );
  }

  return (
    <main
      className="surface-page px-6 py-8"
      data-commercial-operations-workspace="teacher-operations"
      data-commercial-workspace-zone="instrument-area"
    >
      <div className="sr-only" role="status" aria-live="polite" data-teacher-class-detail-status>
        {classDetailStatus}
      </div>
      {announcement !== '班级详情正在加载。' && (
        <div className="surface-card mb-6 border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-foreground" role="status" aria-live="polite" data-teacher-class-visible-status>
          {announcement}
        </div>
      )}
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
                  {insights && <span className="font-medium text-foreground">口径：{insights.scopeLabel}</span>}
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
                <button type="button"
                  onClick={copyCode}
                  className="rounded-lg border border-sky-500/30 p-2 text-sky-500 transition hover:bg-sky-500/10 dark:text-sky-300"
                  aria-label="复制班级加入码"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="button"
              onClick={openStartDialog}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 font-medium text-white transition hover:from-emerald-500 hover:to-green-500"
              aria-label="打开开始上课对话框"
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
              <p className="text-sm font-semibold text-foreground">累计能力达成</p>
              <p className="mt-2 text-sm text-subtle">
                查看全历史能力矩阵与当前名册覆盖情况。
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
        <div className="teacher-insight-entry" data-recent-signals-not-applicable>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">近阶段风险与重点学生</p>
              <p className="mt-2 text-sm text-subtle">
                切换近阶段学情查看近期风险、课堂质量与趋势。
              </p>
            </div>
            <ShieldAlert className="h-5 w-5 text-rose-500" />
          </div>
        </div>
        <Link
          href={`/teacher/prep-packs?classId=${encodeURIComponent(classId)}`}
          className="teacher-insight-entry"
          data-teacher-prep-pack-entry="class-detail"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">课前包复核</p>
              <p className="mt-2 text-sm text-subtle">
                从班级诊断进入候选课前包，复核证据、插入点与 overlay 生命周期。
              </p>
            </div>
            <BookOpen className="h-5 w-5 text-violet-500" />
          </div>
        </Link>
      </section>

      {insights && (
        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="teacher-insight-metric">
            <p className="text-sm text-subtle">累计能力达成指数</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {insights.overview.overallIndex ?? '暂无证据'}
            </p>
            <p className="mt-2 text-xs text-subtle">来自全历史原生画像与累计班级快照。</p>
          </div>
          <div className="teacher-insight-metric" data-recent-risk-not-applicable>
            <p className="text-sm font-medium text-foreground">近阶段风险不适用</p>
            <p className="mt-2 text-xs text-subtle">切换近阶段学情查看近期风险、课堂质量与趋势。</p>
          </div>
          <div className="teacher-insight-metric">
            <p className="text-sm text-subtle">人均累计证据</p>
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
          <div className="teacher-insight-metric" data-recent-session-quality-not-applicable>
            <p className="text-sm font-medium text-foreground">近期会话质量不适用</p>
            <p className="mt-2 text-xs text-subtle">
              此页展示累计能力达成；切换近阶段学情查看近期会话质量、风险与趋势。
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
              <button type="button"
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
              <button type="button"
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
              aria-label="按课堂状态筛选课堂历史"
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
              <input aria-label="搜索教案..."
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
                      <button type="button"
                        onClick={() => void handleFinishSession(session.id)}
                        disabled={endingSessionId === session.id}
                        className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-300 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`停止课堂 ${session.plan.title}`}
                      >
                        {endingSessionId === session.id ? '停止中...' : '停止课堂'}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/classroom/teacher/${session.id}/review`}
                        className="btn-ghost-themed rounded-lg px-3 py-1.5 text-sm transition"
                      >
                        课堂统计
                      </Link>
                      <button type="button"
                        onClick={() => void handleDeleteFinishedSession(session)}
                        disabled={deletingSessionId === session.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-3 py-1.5 text-sm text-rose-600 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300"
                        data-teacher-finished-session-delete="available"
                        aria-label={`删除已结束课堂 ${session.plan.title}`}
                      >
                        {deletingSessionId === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        删除课堂
                      </button>
                    </>
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
            <button type="button"
              onClick={() => setShowAddStudentsModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-sky-500/50 px-3 py-1.5 text-sm text-sky-400 transition hover:bg-sky-500/10"
              aria-label="打开添加学生对话框"
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
            <table className="min-w-full border-collapse text-sm" data-teacher-mobile-cards="true" aria-label="班级学生清单">
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.16em] text-subtle">
                  <th className="px-4 py-3 font-medium">学生</th>
                  <th className="px-4 py-3 font-medium">累计画像等级</th>
                  <th className="px-4 py-3 font-medium">累计达成指数</th>
                  <th className="px-4 py-3 font-medium">证据状态（近阶段）</th>
                  <th className="px-4 py-3 font-medium">风险状态（近阶段）</th>
                  <th className="px-4 py-3 font-medium">近阶段趋势</th>
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
                      <td className="px-4 py-4 align-top" data-label="学生">
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
                      <td className="px-4 py-4 align-top text-foreground" data-label="画像等级">
                        {insight ? insight.overallLevel ?? '暂无证据' : '待生成'}
                      </td>
                      <td className="px-4 py-4 align-top" data-label="综合指数">
                        {insight ? (
                          <span className="font-semibold text-sky-600 dark:text-sky-300">
                            {insight.overallScore ?? '暂无证据'}
                          </span>
                        ) : (
                          <span className="text-subtle">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top" data-label="证据状态">
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
                      <td className="px-4 py-4 align-top" data-label="风险状态">
                        <span className="text-sm text-subtle">累计口径不适用</span>
                      </td>
                      <td className="px-4 py-4 align-top text-foreground" data-label="近期趋势">
                        <Link href={`${buildTeacherClassInsightsHref(classId)}?scope=recent`} className="text-sm text-primary hover:underline">
                          切换近阶段学情查看
                        </Link>
                      </td>
                      <td className="px-4 py-4 align-top" data-label="成长档案">
                        {insight ? (
                          <span className="font-semibold text-foreground">{insight.growthRecordCount}</span>
                        ) : (
                          <span className="text-subtle">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top" data-label="操作">
                        <div className="flex items-center gap-2">
                          <Link
                            href={buildTeacherStudentInsightsHref(classId, student.user.id)}
                            className="btn-ghost-themed rounded-lg px-3 py-1.5 text-sm"
                            aria-label={`查看学生 ${student.user.name || student.user.id} 详情`}
                          >
                            详情
                          </Link>
                          <button type="button"
                            onClick={() => handleRemoveStudent(student.user.id, student.user.name || '该学生')}
                            disabled={removingStudent === student.user.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-3 py-1.5 text-sm text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-300 disabled:opacity-50"
                            aria-label={`从班级移除学生 ${student.user.name || student.user.id}`}
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
          <div ref={startDialogRef} className="surface-card mx-4 w-full max-w-md p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="teacher-start-class-title" aria-describedby={startDialogError ? startDialogErrorId : undefined} tabIndex={-1}>
            <div className="mb-6 flex items-center justify-between">
              <h3 id="teacher-start-class-title" className="text-xl font-bold text-foreground">开始上课</h3>
              <button type="button"
                onClick={closeStartDialog}
                className="btn-ghost-themed rounded-lg p-1 transition"
                aria-label="关闭开始上课对话框"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <label htmlFor={lessonPlanSelectId} className="mb-2 block text-sm font-medium text-slate-300">
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
                  id={lessonPlanSelectId}
                  value={selectedPlanId}
                  onChange={(e) => {
                    setSelectedPlanId(e.target.value);
                    setStartDialogError('');
                  }}
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
            <p className="mb-4 rounded-lg border border-platform-evidence-eligible/40 bg-platform-evidence-eligible/10 px-3 py-2 text-sm text-platform-fg-primary">
              班级课堂：{classData?.name ?? '当前班级'}。学生端、教师投影和课后复盘将使用该班级身份。
            </p>

            {startDialogError && (
              <p id={startDialogErrorId} role="alert" className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {startDialogError}
              </p>
            )}

            <div className="flex gap-3">
              <button type="button"
                onClick={closeStartDialog}
                className="btn-ghost-themed flex-1 rounded-lg py-3 font-medium transition"
              >
                取消
              </button>
              <button type="button"
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
