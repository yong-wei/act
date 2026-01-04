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
  ChevronRight,
  Play,
  Clock,
  History,
  QrCode,
  Calendar,
  Search,
  X,
  BookOpen,
  UserPlus,
  Trash2,
  Loader2,
} from 'lucide-react';
import { AddStudentsModal } from '@/components/teacher/add-students-modal';

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
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // 开始上课相关
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [starting, setStarting] = useState(false);

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
      await Promise.all([fetchClass(), fetchSessions(), fetchLessonPlans()]);
      setLoading(false);
    };
    if (classId) {
      loadData();
    }
  }, [classId, fetchClass, fetchSessions, fetchLessonPlans]);

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
        fetchClass();
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

  // 当前进行中的课堂
  const activeSession = sessions.find(s => s.status === 'ACTIVE');
  const historySessions = sessions.filter(s => s.status === 'FINISHED');

  if (loading) {
    return (
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-slate-800" />
          <div className="h-32 rounded-xl bg-slate-800" />
        </div>
      </main>
    );
  }

  if (!classData) {
    return (
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="text-center">
          <p className="text-xl text-slate-400">班级不存在</p>
          <Link
            href="/teacher/classes"
            className="mt-4 inline-block text-sky-400 hover:text-sky-300"
          >
            返回班级列表
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8">
      {/* 返回链接 */}
      <Link
        href="/teacher/classes"
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        返回班级列表
      </Link>

      {/* 班级信息卡片 */}
      <div className="mb-8 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
              <Users className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{classData.name}</h1>
              {classData.description && (
                <p className="mt-1 text-slate-400">{classData.description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                {classData.year && <span>{classData.year}</span>}
                {classData.semester && <span>{classData.semester}</span>}
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" />
                  {classData._count.students} 名学生
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* 班级码 */}
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
              <p className="text-xs text-sky-300">班级加入码</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-mono text-2xl font-bold tracking-wider text-sky-400">
                  {classData.code}
                </span>
                <button
                  onClick={copyCode}
                  className="rounded-lg border border-sky-500/30 p-2 text-sky-400 transition hover:bg-sky-500/20"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 开始上课按钮 */}
            <button
              onClick={() => setShowStartModal(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 font-medium text-white transition hover:from-emerald-500 hover:to-green-500"
            >
              <Play className="h-5 w-5" />
              开始上课
            </button>
          </div>
        </div>
      </div>

      {/* 进行中的课堂 */}
      {activeSession && (
        <div className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
            <h2 className="text-lg font-semibold text-emerald-400">进行中的课堂</h2>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xl font-medium text-white">{activeSession.plan.title}</p>
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
              <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2">
                <QrCode className="h-5 w-5 text-emerald-400" />
                <span className="font-mono text-lg font-bold text-white">{activeSession.joinCode}</span>
              </div>
              <Link
                href={`/classroom/teacher/${activeSession.id}`}
                className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-500"
              >
                进入课堂
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 课堂历史 */}
      <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">课堂历史</h2>
            <span className="text-sm text-slate-500">({historySessions.length})</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 状态筛选 */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
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
                className="w-48 rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {historySessions.length === 0 ? (
          <div className="py-12 text-center">
            <History className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-4 text-slate-500">暂无课堂历史记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {historySessions.map(session => (
              <div
                key={session.id}
                className="flex flex-col gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-white">{session.plan.title}</p>
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
                <Link
                  href={`/classroom/teacher/${session.id}/review`}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-700"
                >
                  查看记录
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 学生列表 */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">班级学生</h2>
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
          <div className="space-y-2">
            {classData.students.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition hover:border-sky-500/50 hover:bg-slate-800"
              >
                <Link
                  href={`/teacher/classes/${classId}/students/${student.user.id}`}
                  className="flex flex-1 items-center gap-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-sm font-bold text-white">
                    {student.user.name?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {student.user.name || '未命名学生'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {student.studentNumber || student.user.email}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-slate-400">技术分</p>
                    <p className="text-lg font-semibold text-amber-400">
                      {student.techScore.toFixed(1)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">伦理分</p>
                    <p className="text-lg font-semibold text-emerald-400">
                      {student.ethicsScore}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveStudent(student.user.id, student.user.name || '该学生')}
                    disabled={removingStudent === student.user.id}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
                    title="从班级移除"
                  >
                    {removingStudent === student.user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                  <Link href={`/teacher/classes/${classId}/students/${student.user.id}`}>
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 开始上课模态框 */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">开始上课</h3>
              <button
                onClick={() => setShowStartModal(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-slate-300">
                选择教案
              </label>
              {lessonPlans.length === 0 ? (
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-center">
                  <BookOpen className="mx-auto h-8 w-8 text-slate-500" />
                  <p className="mt-2 text-sm text-slate-400">暂无可用教案</p>
                  <Link
                    href="/teacher/lesson-plans/new"
                    className="mt-2 inline-block text-sm text-sky-400 hover:text-sky-300"
                  >
                    创建教案
                  </Link>
                </div>
              ) : (
                <select
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-sky-500 focus:outline-none"
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
                className="flex-1 rounded-lg border border-slate-600 py-3 font-medium text-slate-300 transition hover:bg-slate-800"
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
        onSuccess={fetchClass}
      />
    </main>
  );
}
