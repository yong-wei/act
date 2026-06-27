'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit3,
  History,
  Loader2,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { buildTeacherReportDeliveryHref } from '@/lib/teacher-report-grading-contracts';

interface TeacherClassOption {
  id: string;
  name: string;
}

interface TeacherHistorySession {
  id: string;
  joinCode: string;
  status: 'FINISHED';
  startTime: string;
  endTime: string | null;
  currentStage: string | null;
  classId: string | null;
  className: string | null;
  plan: {
    id: string;
    title: string;
  };
  studentCount: number;
  durationMinutes: number | null;
}

export default function TeacherHistoryPage() {
  const [sessions, setSessions] = useState<TeacherHistorySession[]>([]);
  const [classes, setClasses] = useState<TeacherClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [selectedClassBySession, setSelectedClassBySession] = useState<Record<string, string>>({});
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const loadPageData = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({ status: 'FINISHED' });
      if (searchTerm.trim()) {
        query.set('search', searchTerm.trim());
      }

      const [sessionsRes, classesRes] = await Promise.all([
        fetch(`/api/teacher/sessions?${query.toString()}`),
        fetch('/api/teacher/classes'),
      ]);

      if (!sessionsRes.ok) {
        throw new Error('获取课堂历史失败');
      }

      const sessionsData = (await sessionsRes.json()) as TeacherHistorySession[];
      setSessions(sessionsData);
      setSelectedClassBySession(
        sessionsData.reduce<Record<string, string>>((accumulator, item) => {
          accumulator[item.id] = item.classId ?? '';
          return accumulator;
        }, {})
      );

      if (classesRes.ok) {
        const classesData = (await classesRes.json()) as Array<{ id: string; name: string }>;
        setClasses(classesData.map((item) => ({ id: item.id, name: item.name })));
      }
    } catch (error) {
      console.error('Load teacher history error:', error);
      setSessions([]);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const activeEditClassId = useMemo(
    () => (editingSessionId ? selectedClassBySession[editingSessionId] ?? '' : ''),
    [editingSessionId, selectedClassBySession]
  );

  const handleSaveClass = async (sessionId: string) => {
    setSavingSessionId(sessionId);
    try {
      const res = await fetch(`/api/teacher/sessions?id=${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClassBySession[sessionId] || null }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '保存失败');
      }

      const payload = (await res.json()) as { classId: string | null; className: string | null };
      setSessions((prev) =>
        prev.map((item) =>
          item.id === sessionId
            ? { ...item, classId: payload.classId, className: payload.className }
            : item
        )
      );
      setEditingSessionId(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSavingSessionId(null);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('确定删除这条课堂历史吗？课堂记录会一并删除。')) {
      return;
    }

    setDeletingSessionId(sessionId);
    try {
      const res = await fetch(`/api/teacher/sessions?id=${sessionId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '删除失败');
      }

      setSessions((prev) => prev.filter((item) => item.id !== sessionId));
      if (editingSessionId === sessionId) {
        setEditingSessionId(null);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeletingSessionId(null);
    }
  };

  return (
    <main
      className="surface-page mx-auto max-w-[1600px] px-6 py-8"
      data-commercial-operations-workspace="teacher-operations"
      data-commercial-workspace-zone="instrument-area"
      data-operations-status-semantics={loading ? 'loading' : sessions.length === 0 ? 'empty' : 'finished'}
    >
      <Link
        href="/teacher"
        className="mb-6 inline-flex items-center gap-2 text-sm text-subtle transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回教师工作台
      </Link>

      <section className="teacher-insight-hero mb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
                <History className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">上课历史</h1>
                <p className="mt-1 text-sm text-subtle">
                  查看全部已结束课堂，并将课堂归档到对应班级。
                </p>
              </div>
            </div>
          </div>

          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input aria-label="搜索教案标题..."
              type="text"
              placeholder="搜索教案标题..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-border/70 bg-card/75 py-3 pl-10 pr-4 text-sm text-foreground outline-none transition focus:border-primary"
            />
          </div>
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">已结束课堂清单</h2>
            <p className="mt-1 text-sm text-subtle">点击“课堂统计”进入课堂记录与统计汇总页面。</p>
          </div>
          <span className="text-sm text-subtle">{sessions.length} 节课</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-subtle">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载课堂历史...
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-16 text-center">
            <History className="mx-auto h-10 w-10 text-slate-500" />
            <p className="mt-4 text-subtle">暂无已结束课堂</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const isEditing = editingSessionId === session.id;
              const reportDeliveryHref = buildTeacherReportDeliveryHref({
                classId: session.classId,
                action: 'export',
                sessionId: session.id,
                surface: 'history',
                returnTo: '/teacher/history',
              });
              return (
                <div
                  key={session.id}
                  className="surface-card-soft p-4"
                  data-report-ledger-surface="teacher-history-report-delivery"
                  data-report-ledger-session-id={session.id}
                  data-report-ledger-delivery-state={session.classId ? 'ready' : 'missing-context'}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-base font-semibold text-foreground">{session.plan.title}</p>
                        <span className="teacher-insight-chip teacher-insight-chip-pending">
                          {session.className || '未归档班级'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-subtle">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(session.startTime).toLocaleDateString('zh-CN')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {session.durationMinutes ? `${session.durationMinutes} 分钟` : '时长待定'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {session.studentCount} 人参与
                        </span>
                        <span>课堂码 {session.joinCode}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={reportDeliveryHref}
                        className="btn-ghost-themed rounded-lg px-3 py-2 text-sm"
                        data-teacher-report-delivery-link="history"
                        data-report-ledger-recovery={session.classId ? undefined : 'archive-class-first'}
                      >
                        报告账本
                      </Link>
                      <Link
                        href={`/classroom/teacher/${session.id}/review`}
                        className="btn-ghost-themed rounded-lg px-3 py-2 text-sm"
                      >
                        课堂统计
                      </Link>
                      <button
                        type="button"
                        onClick={() => setEditingSessionId(isEditing ? null : session.id)}
                        className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                      >
                        {isEditing ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                        {isEditing ? '收起编辑' : '编辑'}
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-4 grid gap-3 rounded-xl border border-border/60 bg-background/50 p-4 lg:grid-cols-[minmax(0,1fr),auto,auto] lg:items-end">
                      <div>
                        <label htmlFor="page-control-1" className="mb-2 block text-sm font-medium text-foreground">归档到班级</label>
                        <select id="page-control-1"
                          value={activeEditClassId}
                          onChange={(event) =>
                            setSelectedClassBySession((prev) => ({
                              ...prev,
                              [session.id]: event.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-border/70 bg-card/75 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
                        >
                          <option value="">暂不归档</option>
                          {classes.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleSaveClass(session.id)}
                        disabled={savingSessionId === session.id}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                      >
                        {savingSessionId === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        保存归档
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSession(session.id)}
                        disabled={deletingSessionId === session.id}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500/40 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-300 disabled:opacity-60"
                      >
                        {deletingSessionId === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        删除课堂
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
