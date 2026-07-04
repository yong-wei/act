'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { AppShell, type AppBreadcrumbItem } from '@/components/platform/app-shell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { SimulationLocalToolWorkspace, type SimulationLocalToolTemplateId } from './simulation-local-tools';

export interface SimulationShellProps {
  title: string;
  subtitle?: string;
  activeHref: string;
  returnHref?: string;
  returnLabel?: string;
  taskContext?: SimulationTaskContext | null;
  launchProvenance?: string;
  children: ReactNode;
  contextStrip?: ReactNode;
  evidenceRail?: ReactNode;
  supportDrawer?: ReactNode;
  commandBar?: ReactNode;
  localToolTemplate?: SimulationLocalToolTemplateId;
  className?: string;
}

export interface SimulationTaskContext {
  taskId: string;
  taskTitle: string;
  objective: string;
  completionCriteria: string;
  returnHref: string;
  returnLabel: string;
  saveBackTarget: string;
  saveBackStatus: 'saved' | 'queued' | 'unsupported' | 'failed';
  returnFlowState: string;
}

export function SimulationShell({
  title,
  subtitle,
  activeHref,
  returnHref = '/simulations',
  returnLabel = '虚拟仿真',
  taskContext,
  launchProvenance = 'standalone',
  children,
  contextStrip,
  evidenceRail,
  supportDrawer,
  commandBar,
  localToolTemplate,
  className,
}: SimulationShellProps) {
  const breadcrumbs: AppBreadcrumbItem[] = [
    { label: '首页', href: '/' },
    { label: returnLabel, href: returnHref },
    { label: title },
  ];
  const hasStructuredSlots = Boolean(contextStrip || evidenceRail || supportDrawer || commandBar);

  return (
    <AppShell
      viewerRole="student"
      activeHref={activeHref}
      sidebarMode="collapsible"
      title={title}
      subtitle={subtitle}
      breadcrumbs={breadcrumbs}
      className="bg-platform-canvas"
    >
      <SimulationSceneFrame
        activeHref={activeHref}
        launchProvenance={launchProvenance}
        returnHref={returnHref}
        localToolTemplate={localToolTemplate}
        className={className}
      >
        {children}
      </SimulationSceneFrame>
      {taskContext ? (
        <SimulationTaskContextPanel context={taskContext} />
      ) : null}
      {hasStructuredSlots ? (
        <SimulationStructuredSurfaces
          contextStrip={contextStrip}
          commandBar={commandBar}
          evidenceRail={evidenceRail}
          supportDrawer={supportDrawer}
        />
      ) : null}
    </AppShell>
  );
}

function SimulationTaskContextPanel({ context }: { context: SimulationTaskContext }) {
  return (
    <section
      className="mt-4 rounded-lg border border-platform-border bg-platform-surface p-4"
      data-simulation-task-context="mission-task-return-saveback"
      data-originating-task-id={context.taskId}
      data-originating-task-title={context.taskTitle}
      data-save-back-status={context.saveBackStatus}
      data-return-flow-state={context.returnFlowState}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-platform-fg-muted">任务上下文</p>
          <h2 className="mt-1 text-sm font-semibold text-platform-fg-primary">{context.taskTitle}</h2>
          <p className="mt-2 text-xs leading-5 text-platform-fg-secondary">{context.objective}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={context.returnHref}>{context.returnLabel}</Link>
        </Button>
      </div>
      <dl className="mt-4 grid gap-3 text-xs text-platform-fg-secondary md:grid-cols-3">
        <div className="rounded-md border border-platform-border bg-platform-canvas-muted px-3 py-2">
          <dt className="font-medium text-platform-fg-primary">完成标准</dt>
          <dd className="mt-1">{context.completionCriteria}</dd>
        </div>
        <div className="rounded-md border border-platform-border bg-platform-canvas-muted px-3 py-2">
          <dt className="font-medium text-platform-fg-primary">写回目标</dt>
          <dd className="mt-1">{context.saveBackTarget}</dd>
        </div>
        <div className="rounded-md border border-platform-border bg-platform-canvas-muted px-3 py-2">
          <dt className="font-medium text-platform-fg-primary">流程状态</dt>
          <dd className="mt-1">{context.returnFlowState}</dd>
        </div>
      </dl>
    </section>
  );
}

function SimulationSceneFrame({
  activeHref,
  launchProvenance,
  returnHref,
  localToolTemplate,
  className,
  children,
}: {
  activeHref: string;
  launchProvenance: string;
  returnHref: string;
  localToolTemplate?: SimulationLocalToolTemplateId;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn('relative min-h-[calc(100vh-10rem)] overflow-hidden rounded-lg border border-platform-border bg-platform-canvas text-platform-fg-primary shadow-2xl', className)}
      data-commercial-workspace="simulation-scene"
      data-task-workspace-archetype="immersive-scene"
      data-product-design-handoff-source="artifacts/product-design-audits/virtual-simulation-2026-06-13/design-handoff.md"
      data-product-design-concept-reference="concept-2-command-deck-shell"
      data-command-deck-composition="scene-primary-glass-panels-bottom-tools"
      data-simulation-theme-template="mission-workspace"
      data-simulation-scene-color-policy="feature-owned"
      data-simulation-konling-context-source="server-owned"
      data-simulation-konling-context-status="degraded-without-run"
      data-simulation-dock-collision-policy="avoid-local-tools"
      data-simulation-shell-route={activeHref}
      data-launch-provenance={launchProvenance}
      data-return-target={returnHref}
      data-evidence-flow-target="/profile/evidence"
      data-instrument-nonblank-contract="simulation-scene"
    >
      {localToolTemplate ? (
        <SimulationLocalToolWorkspace templateId={localToolTemplate} panelLayout="side-rails">
          {children}
        </SimulationLocalToolWorkspace>
      ) : (
        <section data-commercial-workspace-zone="instrument-area">
          {children}
        </section>
      )}
    </div>
  );
}

function SimulationStructuredSurfaces({
  contextStrip,
  commandBar,
  evidenceRail,
  supportDrawer,
}: {
  contextStrip?: ReactNode;
  commandBar?: ReactNode;
  evidenceRail?: ReactNode;
  supportDrawer?: ReactNode;
}) {
  return (
    <section
      className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]"
      data-simulation-shell-structured-surfaces="below-primary-scene"
      data-command-deck-context-placement="below-primary-scene"
    >
      <div className="min-w-0 space-y-4">
        {contextStrip ? (
          <div className="rounded-lg border border-platform-border bg-platform-surface px-4 py-3" data-app-shell-zone="context-header">
            {contextStrip}
          </div>
        ) : null}
        {commandBar ? (
          <div className="rounded-lg border border-platform-border bg-platform-surface px-4 py-3" data-app-shell-zone="command-bar">
            {commandBar}
          </div>
        ) : null}
      </div>
      <div className="min-w-0 space-y-4">
        {evidenceRail ? (
          <div className="rounded-lg border border-platform-border bg-platform-surface p-4" data-app-shell-zone="evidence-rail">
            {evidenceRail}
          </div>
        ) : null}
        {supportDrawer ? (
          <div className="rounded-lg border border-platform-border bg-platform-surface p-4" data-app-shell-zone="support-drawer">
            {supportDrawer}
          </div>
        ) : null}
      </div>
    </section>
  );
}
