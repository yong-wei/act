'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Users, ChevronRight, Search, ArrowLeft } from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  year: string | null;
  semester: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  _count: { students: number };
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [defaultStatus, setDefaultStatus] = useState('');
  const [updatingDefaultClassId, setUpdatingDefaultClassId] = useState<string | null>(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/teacher/classes');
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
      }
    } catch (error) {
      console.error('获取班级列表失败', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const setDefaultClass = async (classId: string) => {
    setUpdatingDefaultClassId(classId);
    setDefaultStatus('正在设置默认班级…');
    try {
      const response = await fetch('/api/teacher/classes/default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || '设置默认班级失败');
      setClasses((current) => current.map((classItem) => ({
        ...classItem,
        isDefault: classItem.id === classId,
      })));
      setDefaultStatus('默认班级已更新。');
    } catch (error) {
      setDefaultStatus(error instanceof Error ? error.message : '设置默认班级失败');
    } finally {
      setUpdatingDefaultClassId(null);
    }
  };

  if (loading) {
    return (
      <main
        className="px-6 py-8"
        data-commercial-operations-workspace="teacher-operations"
        data-commercial-workspace-zone="instrument-area"
        data-operations-status-semantics="loading"
      >
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-slate-800" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-slate-800" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="px-6 py-8"
      data-commercial-operations-workspace="teacher-operations"
      data-commercial-workspace-zone="instrument-area"
      data-operations-status-semantics={filteredClasses.length === 0 ? 'empty' : 'active'}
    >
      {/* 头部 */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href="/teacher"
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-sky-400 transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            返回教师工作台
          </Link>
          <h1 className="text-2xl font-bold text-white">我的班级</h1>
          <p className="mt-1 text-slate-400">管理您的所有班级</p>
        </div>
        <Link
          href="/teacher/classes/new"
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
        >
          <Plus className="h-4 w-4" />
          新建班级
        </Link>
      </div>

      {/* 搜索 */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input aria-label="搜索班级名称或班级码..."
            type="text"
            placeholder="搜索班级名称或班级码..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* 班级列表 */}
      <p className="sr-only" role="status" aria-live="polite">{defaultStatus}</p>
      {filteredClasses.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/20 py-16 text-center">
          <Users className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-4 text-lg font-medium text-slate-300">
            {search ? '没有找到匹配的班级' : '暂无班级'}
          </h3>
          <p className="mt-2 text-slate-500">
            {search ? '请尝试其他搜索词' : '创建您的第一个班级开始教学'}
          </p>
          {!search && (
            <Link
              href="/teacher/classes/new"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
            >
              <Plus className="h-4 w-4" />
              创建班级
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClasses.map((cls) => (
            <article
              key={cls.id}
              className="group relative overflow-hidden rounded-xl border border-platform-border bg-platform-surface-raised/50 transition hover:border-platform-action-primary/50 hover:bg-platform-surface-overlay"
            >
              {cls.isDefault && (
                <span className="absolute right-[-2.2rem] top-3 w-32 rotate-45 bg-platform-action-primary py-1 text-center text-xs font-medium text-platform-fg-inverse">
                  默认班级
                </span>
              )}
              <div className="absolute right-4 top-4 z-10">
                {cls.isActive && !cls.isDefault && (
                  <button
                    type="button"
                    onClick={() => void setDefaultClass(cls.id)}
                    disabled={updatingDefaultClassId !== null}
                    className="rounded-md border border-platform-action-primary/60 bg-platform-surface-overlay/90 px-2.5 py-1 text-xs font-medium text-platform-action-primary transition hover:bg-platform-action-primary hover:text-platform-fg-inverse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-brand-focus-ring disabled:cursor-not-allowed disabled:opacity-60 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    aria-label={`将${cls.name}设为默认班级`}
                  >
                    {updatingDefaultClassId === cls.id ? '设置中…' : '设为默认'}
                  </button>
                )}
              </div>
              <Link
                href={`/teacher/classes/${cls.id}`}
                className="block p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-platform-brand-focus-ring"
                aria-label={`查看班级 ${cls.name}`}
              >
                <div className="flex items-start justify-between pr-20">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{cls.name}</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      班级码: <span className="font-mono text-sky-400">{cls.code}</span>
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-platform-fg-muted transition group-hover:text-platform-action-primary" />
                </div>
                {cls.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-slate-500">{cls.description}</p>
                )}
                <div className="mt-4 flex items-center gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {cls._count.students} 名学生
                  </span>
                  {cls.year && <span>{cls.year}</span>}
                  {cls.semester && <span>{cls.semester}</span>}
                </div>
                {!cls.isActive && (
                  <span className="mt-3 inline-block rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                    已关闭
                  </span>
                )}
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
