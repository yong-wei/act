import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Plus } from 'lucide-react';

interface LessonPlanMissingRecoveryProps {
  planId: string;
  listHref: string;
  createHref: string;
  title: string;
  description: string;
}

export function LessonPlanMissingRecovery({
  planId,
  listHref,
  createHref,
  title,
  description,
}: LessonPlanMissingRecoveryProps) {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-xl border border-amber-500/30 bg-slate-900/80 p-8">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
            <p className="mt-3 break-all rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
              请求教案 ID：{planId}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={listHref}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-cyan-500 hover:text-cyan-200"
          >
            <ArrowLeft className="h-4 w-4" />
            返回教案列表
          </Link>
          <Link
            href={createHref}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            新建教案
          </Link>
        </div>
      </div>
    </main>
  );
}
