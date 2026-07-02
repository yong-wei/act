import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { ActionStatusPanel } from '@/components/platform/action-status';
import {
  buildPlatformRecoveryState,
  type PlatformRecoveryKind,
} from '@/lib/platform-recovery-contract';

interface ArenaRouteRecoveryProps {
  kind: PlatformRecoveryKind;
  sourceRoute: string;
  targetLabel: string;
  displayReference?: string | null;
  message?: string;
  recoveryAction?: string;
  primaryHref: string;
  primaryLabel: string;
  surface: string;
}

export function ArenaRouteRecovery({
  kind,
  sourceRoute,
  targetLabel,
  displayReference,
  message,
  recoveryAction,
  primaryHref,
  primaryLabel,
  surface,
}: ArenaRouteRecoveryProps) {
  const state = buildPlatformRecoveryState({
    kind,
    sourceRoute,
    targetLabel,
    displayReference,
    message,
    recoveryAction,
  });

  return (
    <main
      className="surface-page flex min-h-screen items-center justify-center px-6 py-12"
      data-arena-route-recovery={surface}
      data-platform-recovery-route={sourceRoute}
    >
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card/75 p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3 text-sm font-medium text-subtle">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Arena 恢复状态
        </div>
        <ActionStatusPanel
          state={state}
          action={(
            <Link
              href={primaryHref}
              className="inline-flex rounded-lg border border-border px-3 py-2 text-sm text-primary hover:text-primary/80"
            >
              {primaryLabel}
            </Link>
          )}
        />
      </div>
    </main>
  );
}
