import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { describeExperienceLaunch } from '@/components/platform/platform-ui-contracts';
import { getControlWorkbenchLaunchKind, getControlWorkbenchReturnHref } from '@/features/control-workbench/routing';
import { resolveControlWorkbenchSession } from '@/features/control-workbench/session-resolver';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('simulation arena workbench experience UI contracts', () => {
  it.each([
    ['standalone', '独立探索', 'standalone'],
    ['course-launched', '课程内启动', 'course'],
    ['arena-preview', 'Arena 预览', 'preview'],
    ['official-evaluation', '官方评价', 'official'],
    ['teacher-review', '教师复核', 'review'],
    ['admin-review', '管理员复核', 'review'],
  ] as const)('renders %s launch provenance', (kind, label, visualBoundary) => {
    expect(describeExperienceLaunch(kind)).toMatchObject({ label, visualBoundary });
  });

  it('keeps preview copy unofficial', () => {
    expect(describeExperienceLaunch('arena-preview').summary).toContain('不作为官方榜单证据');
  });

  it('preserves Workbench challenge context and return navigation', () => {
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-second-order-lead-pid',
      preset: 'classic-four-view',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getControlWorkbenchLaunchKind(result.session)).toBe('official-evaluation');
    expect(getControlWorkbenchReturnHref(result.session)).toBe('/arena/challenges/task-second-order-lead-pid');
    expect(describeExperienceLaunch(getControlWorkbenchLaunchKind(result.session)).visualBoundary).toBe('official');
  });

  it('keeps free-explore workbench launches unofficial', () => {
    const result = resolveControlWorkbenchSession({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getControlWorkbenchLaunchKind(result.session)).toBe('standalone');
    expect(getControlWorkbenchReturnHref(result.session)).toBe('/interactive-learning/cross-domain-exploration');
    expect(describeExperienceLaunch(getControlWorkbenchLaunchKind(result.session)).visualBoundary).toBe('standalone');
  });

  it('does not keep a simulation-arena-workbench production bridge', () => {
    const workbenchSource = readRepoFile('src/features/control-workbench/shell/control-workbench-shell.tsx');
    const cruiseSource = readRepoFile('src/app/simulations/cruise/page.tsx');

    expect(workbenchSource).not.toContain('simulation-arena-workbench');
    expect(cruiseSource).not.toContain('simulation-arena-workbench');
    expect(workbenchSource).toContain("from '@/components/platform/platform-ui-contracts'");
    expect(workbenchSource).toContain('getControlWorkbenchLaunchKind');
    expect(cruiseSource).toContain("from '@/components/platform/platform-ui-contracts'");
  });

  it('binds representative task routes to workspace archetype markers and floating dock safe areas', () => {
    const cruiseSource = readRepoFile('src/app/simulations/cruise/page.tsx');
    const simulationShellSource = readRepoFile('src/app/simulations/_components/simulation-shell.tsx');
    const workbenchSource = readRepoFile('src/features/control-workbench/shell/control-workbench-shell.tsx');
    const arenaDetailSource = readRepoFile('src/features/arena/challenge-detail.tsx');
    const lessonRuntimeShellSource = readRepoFile('src/features/interactive/shared/lesson-runtime-shell.tsx');
    const manifestRuntimeSource = readRepoFile('src/features/interactive/shared/manifest-runtime/layout-renderer.tsx');
    const premiumLessonEntrySource = readRepoFile('src/features/interactive/shared/premium-lesson-entry-page.tsx');
    const unit41StudentRuntimeSource = readRepoFile('src/features/interactive/unit-4-1-design-task-expression/student-page.tsx');
    const globalsSource = readRepoFile('src/app/globals.css');

    expect(cruiseSource).toContain('<SimulationShell');
    expect(cruiseSource).toContain('launchProvenance={launchKind}');
    expect(cruiseSource).toContain('returnHref={returnHref}');
    expect(cruiseSource).toContain('buildArenaReturnHref(arenaContext.returnHref, publicationContext?.id)');
    expect(cruiseSource).toContain("params.set('publicationId', publicationId)");
    expect(cruiseSource).toContain('data-task-workspace-zone="floating-dock-safe-area"');
    expect(simulationShellSource).toContain('data-task-workspace-archetype="immersive-scene"');
    expect(simulationShellSource).toContain('data-launch-provenance={launchProvenance}');
    expect(simulationShellSource).toContain('data-return-target={returnHref}');
    expect(simulationShellSource).toContain('data-evidence-flow-target="/profile/evidence"');
    expect(simulationShellSource).toContain('data-instrument-nonblank-contract="simulation-scene"');
    expect(workbenchSource).toContain('data-task-workspace-archetype="engineering-analysis"');
    expect(workbenchSource).toContain('data-launch-provenance={launchKind}');
    expect(workbenchSource).toContain('data-return-target={returnHref}');
    expect(workbenchSource).toContain('data-workspace-mobile-sheets="secondary-controls"');
    expect(workbenchSource).toContain('data-primary-instrument-entry="control-workbench"');
    expect(workbenchSource).toContain('data-current-workspace-step={session.designFlow.currentStep.id}');
    expect(workbenchSource).toContain('data-task-workspace-zone="floating-dock-safe-area"');
    expect(arenaDetailSource).toContain('data-task-workspace-archetype="challenge-task"');
    expect(arenaDetailSource).toContain('data-launch-provenance={launchProvenance}');
    expect(arenaDetailSource).toContain('data-evidence-flow-target="/profile/evidence"');
    expect(arenaDetailSource).toContain('data-primary-instrument-entry="arena-workbench-launch"');
    expect(arenaDetailSource).toContain('data-mobile-first-workspace-entry="true"');
    expect(arenaDetailSource).toContain('data-task-workspace-zone="floating-dock-safe-area"');
    expect(manifestRuntimeSource).not.toContain("'data-task-workspace-archetype': 'lesson-runtime'");
    expect(manifestRuntimeSource).not.toContain("'data-return-target': '/interactive-learning/courses'");
    expect(manifestRuntimeSource).toContain("'data-commercial-workspace-zone': 'instrument-area'");
    expect(manifestRuntimeSource).toContain("'data-commercial-workspace-zone': 'context-strip'");
    expect(premiumLessonEntrySource).toContain('data-task-workspace-archetype="lesson-runtime"');
    expect(premiumLessonEntrySource).toContain('data-return-target="/interactive-learning/courses"');
    expect(unit41StudentRuntimeSource).toContain('<LessonRuntimeShell');
    expect(lessonRuntimeShellSource).toContain('data-task-workspace-archetype="lesson-runtime"');
    expect(unit41StudentRuntimeSource).toContain("'data-return-target': `/interactive-learning/courses/${UNIT_4_1_ROUTE_SEGMENT}`");
    expect(unit41StudentRuntimeSource).toContain("'data-runtime-manifest-truth': runtimeManifestTruth");
    expect(unit41StudentRuntimeSource).toContain("'data-activity-submission-contract': 'manifest-runtime'");
    expect(unit41StudentRuntimeSource).toContain("'data-evidence-flow-target': '/profile/evidence'");
    expect(unit41StudentRuntimeSource).toContain('data-evidence-flow-state={isDemo ?');
    expect(unit41StudentRuntimeSource).toContain('data-task-workspace-zone="floating-dock-safe-area"');
    expect(globalsSource).toContain('[data-task-workspace-archetype]');
    expect(globalsSource).toContain('--task-workspace-floating-dock-safe-block');
    expect(globalsSource).not.toContain('--task-workspace-floating-dock-safe-inline');
  });
});
