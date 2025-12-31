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
  createdAt: string;
  _count: { students: number };
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  if (loading) {
    return (
      <main className="mx-auto max-w-[1600px] px-6 py-8">
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
    <main className="mx-auto max-w-[1600px] px-6 py-8">
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
          <input
            type="text"
            placeholder="搜索班级名称或班级码..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* 班级列表 */}
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
            <Link
              key={cls.id}
              href={`/teacher/classes/${cls.id}`}
              className="group rounded-xl border border-slate-700 bg-slate-800/50 p-5 transition hover:border-sky-500/50 hover:bg-slate-800"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{cls.name}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    班级码: <span className="font-mono text-sky-400">{cls.code}</span>
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-500 transition group-hover:text-sky-400" />
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
          ))}
        </div>
      )}
    </main>
  );
}
