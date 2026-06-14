'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { resolveScopedReturnTarget } from '@/lib/navigation-return-target';

export default function NewClassPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTarget = resolveScopedReturnTarget(
    searchParams.get('returnTo') ?? undefined,
    '/teacher/classes',
    ['/teacher'],
  );
  const returnLabel = returnTarget === '/teacher' ? '返回教师工作台' : '返回班级列表';
  const [form, setForm] = useState({
    name: '',
    description: '',
    year: '',
    semester: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/teacher/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '创建失败');
      }

      const newClass = await res.json();
      router.push(`/teacher/classes/${newClass.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      {/* 返回链接 */}
      <Link
        href={returnTarget}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {returnLabel}
      </Link>

      {/* 表单卡片 */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">新建班级</h1>
            <p className="text-sm text-slate-400">创建班级后将生成唯一的班级码</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="page-control-1" className="mb-2 block text-sm font-medium text-slate-300">
              班级名称 <span className="text-rose-400">*</span>
            </label>
            <input id="page-control-1"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：自动控制原理 2024 秋季班"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-sky-500"
            />
          </div>

          <div>
            <label htmlFor="page-control-2" className="mb-2 block text-sm font-medium text-slate-300">
              班级描述
            </label>
            <textarea id="page-control-2"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="简短描述这个班级的内容或特点..."
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-sky-500"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="page-control-3" className="mb-2 block text-sm font-medium text-slate-300">
                学年
              </label>
              <input id="page-control-3"
                type="text"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                placeholder="例如：2024-2025"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-sky-500"
              />
            </div>
            <div>
              <label htmlFor="page-control-4" className="mb-2 block text-sm font-medium text-slate-300">
                学期
              </label>
              <input id="page-control-4"
                type="text"
                value={form.semester}
                onChange={(e) => setForm({ ...form, semester: e.target.value })}
                placeholder="例如：秋季学期"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-sky-500"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <Link
              href={returnTarget}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
            >
              取消
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-sky-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? '创建中...' : '创建班级'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
