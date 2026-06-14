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
  launchProvenance?: string;
  children: ReactNode;
  contextStrip?: ReactNode;
  evidenceRail?: ReactNode;
  supportDrawer?: ReactNode;
  commandBar?: ReactNode;
  localToolTemplate?: SimulationLocalToolTemplateId;
  className?: string;
}

export function SimulationShell({
  title,
  subtitle,
  activeHref,
  returnHref = '/simulations',
  returnLabel = '虚拟仿真',
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
      actions={(
        <Button asChild variant="outline" size="sm" data-simulation-shell-profile-action>
          <Link href="/profile">个人中心</Link>
        </Button>
      )}
      className="bg-platform-canvas"
      workspaceSlots={hasStructuredSlots ? {
        contextHeader: contextStrip,
        commandBar,
        instrumentArea: (
          <SimulationSceneFrame
            activeHref={activeHref}
            launchProvenance={launchProvenance}
            returnHref={returnHref}
            localToolTemplate={localToolTemplate}
          >
            {children}
          </SimulationSceneFrame>
        ),
        evidenceRail,
        supportDrawer,
      } : undefined}
    >
      <div
        className={cn('relative min-h-[calc(100vh-10rem)] overflow-hidden rounded-lg border border-platform-border bg-platform-canvas text-platform-fg-primary shadow-2xl', className)}
        data-commercial-workspace="simulation-scene"
        data-task-workspace-archetype="immersive-scene"
        data-simulation-theme-template="mission-workspace"
        data-simulation-scene-color-policy="feature-owned"
        data-simulation-shell-route={activeHref}
        data-launch-provenance={launchProvenance}
        data-return-target={returnHref}
        data-evidence-flow-target="/profile/evidence"
      >
        {localToolTemplate ? (
          <SimulationLocalToolWorkspace templateId={localToolTemplate}>
            {children}
          </SimulationLocalToolWorkspace>
        ) : (
          <section data-commercial-workspace-zone="instrument-area" data-instrument-nonblank-contract="simulation-scene">
            {children}
          </section>
        )}
      </div>
    </AppShell>
  );
}

function SimulationSceneFrame({
  activeHref,
  launchProvenance,
  returnHref,
  localToolTemplate,
  children,
}: {
  activeHref: string;
  launchProvenance: string;
  returnHref: string;
  localToolTemplate?: SimulationLocalToolTemplateId;
  children: ReactNode;
}) {
  return (
    <div
      className="relative min-h-[calc(100vh-10rem)] overflow-hidden rounded-lg border border-platform-border bg-platform-canvas text-platform-fg-primary shadow-2xl"
      data-commercial-workspace="simulation-scene"
      data-task-workspace-archetype="immersive-scene"
      data-simulation-theme-template="mission-workspace"
      data-simulation-scene-color-policy="feature-owned"
      data-simulation-shell-route={activeHref}
      data-launch-provenance={launchProvenance}
      data-return-target={returnHref}
      data-evidence-flow-target="/profile/evidence"
      data-instrument-nonblank-contract="simulation-scene"
    >
      {localToolTemplate ? (
        <SimulationLocalToolWorkspace templateId={localToolTemplate} panelLayout="stacked">
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
