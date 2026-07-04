import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { ActionStatusPanel } from '@/components/platform/action-status';
import {
  buildPlatformRecoveryState,
  type PlatformRecoveryKind,
} from '@/lib/platform-recovery-contract';
import { ArenaPageShell } from './arena-page-shell';

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

function ArenaRouteRecoveryContent({
  state,
  primaryHref,
  primaryLabel,
  surface,
  sourceRoute,
}: {
  state: ReturnType<typeof buildPlatformRecoveryState>;
  primaryHref: string;
  primaryLabel: string;
  surface: string;
  sourceRoute: string;
}) {
  return (
    <section
      className="flex min-h-[60vh] items-center justify-center px-6 py-12"
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
    </section>
  );
}

function buildArenaRecoveryState({
  kind,
  sourceRoute,
  targetLabel,
  displayReference,
  message,
  recoveryAction,
}: Pick<ArenaRouteRecoveryProps, 'kind' | 'sourceRoute' | 'targetLabel' | 'displayReference' | 'message' | 'recoveryAction'>) {
  return buildPlatformRecoveryState({
    kind,
    sourceRoute,
    targetLabel,
    displayReference,
    message,
    recoveryAction,
  });
}

export function EmbeddedArenaRouteRecovery({
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
  const state = buildArenaRecoveryState({
    kind,
    sourceRoute,
    targetLabel,
    displayReference,
    message,
    recoveryAction,
  });

  return (
    <ArenaRouteRecoveryContent
      state={state}
      primaryHref={primaryHref}
      primaryLabel={primaryLabel}
      surface={surface}
      sourceRoute={sourceRoute}
    />
  );
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
  const state = buildArenaRecoveryState({
    kind,
    sourceRoute,
    targetLabel,
    displayReference,
    message,
    recoveryAction,
  });

  return (
    <ArenaPageShell
      activePath="/arena"
      breadcrumbs={[{ label: '首页', href: '/' }, { label: '竞技场', href: '/arena' }, { label: '恢复状态', href: '/arena' }]}
      title="竞技场"
      subtitle="恢复状态"
    >
      <ArenaRouteRecoveryContent
        state={state}
        primaryHref={primaryHref}
        primaryLabel={primaryLabel}
        surface={surface}
        sourceRoute={sourceRoute}
      />
    </ArenaPageShell>
  );
}
