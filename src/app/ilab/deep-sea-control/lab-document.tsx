import type { ReactNode } from 'react';
import Link from 'next/link';

import { ILAB_EXPERIMENT_TITLE } from '@/features/ilab/steps';

export function LabDocument({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <article className="mx-auto max-w-3xl px-5 py-8">
        <Link className="text-sm text-amber-200" href="/ilab/deep-sea-control">返回实验</Link>
        <p className="mt-6 text-xs tracking-wide text-amber-200">{kicker}</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-slate-400">{ILAB_EXPERIMENT_TITLE}</p>
        <div className="mt-8 space-y-4 leading-7 text-slate-200">{children}</div>
      </article>
    </main>
  );
}
