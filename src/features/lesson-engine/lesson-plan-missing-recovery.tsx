import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Plus } from 'lucide-react';

import { ActionStatusPanel } from '@/components/platform/action-status';
import { buildPlatformRecoveryState } from '@/lib/platform-recovery-contract';

interface LessonPlanMissingRecoveryProps {
  planId: string;
  listHref: string;
  createHref: string;
  sourceRoute?: string;
  title: string;
  description: string;
}

export function LessonPlanMissingRecovery({
  planId,
  listHref,
  createHref,
  sourceRoute = listHref,
  title,
  description,
}: LessonPlanMissingRecoveryProps) {
  const recoveryState = buildPlatformRecoveryState({
    kind: 'missing-object',
    sourceRoute,
    targetLabel: '教案',
    displayReference: planId,
    message: description,
    recoveryAction: '返回教案列表或新建教案',
  });

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-xl border border-amber-500/30 bg-slate-900/80 p-8">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
          </div>
        </div>
        <ActionStatusPanel
          state={recoveryState}
          action={(
            <>
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
            </>
          )}
        />
      </div>
    </main>
  );
}
