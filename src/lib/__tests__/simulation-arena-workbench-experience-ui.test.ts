import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EXPERIENCE_SHELL_MIGRATION_CONTRACTS,
  EXPERIENCE_SHELL_SLOT_ORDER,
  TASK_WORKSPACE_ARCHETYPE_CONTRACTS,
  TASK_WORKSPACE_ROUTE_CONTRACTS,
  buildCourseLaunchExperienceContext,
  buildExperienceStatusPayloads,
  buildWorkbenchExperienceContext,
  describeExperienceLaunch,
} from '@/features/simulation-arena-workbench/experience-shell-contracts';
import { buildPlatformStatusViewModel } from '@/components/platform/platform-ui-contracts';
import { buildResourceRendererLaunchContext } from '@/features/lesson-engine/resource-renderer-config';
import { resolveControlWorkbenchSession } from '@/features/control-workbench/session-resolver';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('simulation arena workbench experience UI contracts', () => {
  it('defines the shared shell slots used by simulation, Arena, and Workbench surfaces', () => {
    expect(EXPERIENCE_SHELL_SLOT_ORDER).toEqual([
      'context-header',
      'workflow-navigation',
      'main-stage',
      'side-panels',
      'status-rail',
      'bottom-tools',
      'support-drawer',
    ]);

    expect(EXPERIENCE_SHELL_MIGRATION_CONTRACTS.map((contract) => contract.surface)).toEqual([
      'simulation-hub',
      'simulation-scene',
      'arena-hall',
      'arena-challenge-detail',
      'control-workbench',
      'course-resource-launch',
    ]);
  });

  it('declares task workspace archetypes, route bindings, and local/global control boundaries', () => {
    expect(TASK_WORKSPACE_ARCHETYPE_CONTRACTS.map((contract) => contract.archetype)).toEqual([
      'immersive-scene',
      'engineering-analysis',
      'challenge-task',
      'lesson-runtime',
      'learner-data',
      'operations-analytics',
      'governance-console',
    ]);
    for (const contract of TASK_WORKSPACE_ARCHETYPE_CONTRACTS) {
      expect(contract.requiredZones).toEqual(expect.arrayContaining(['instrument-area', 'floating-dock-safe-area']));
      expect(contract.localControls.length).toBeGreaterThan(0);
      expect(contract.shellControls).toEqual(expect.arrayContaining(['Konling', 'role cockpit']));
    }
    expect(TASK_WORKSPACE_ROUTE_CONTRACTS.map((contract) => contract.href)).toEqual([
      '/simulations/cruise',
      '/interactive-learning/control-workbench',
      '/arena/challenges/[taskId]',
      '/interactive-learning/courses/[lesson]',
    ]);
    expect(TASK_WORKSPACE_ROUTE_CONTRACTS.find((contract) => contract.href === '/simulations/cruise')).toMatchObject({
      archetype: 'immersive-scene',
      returnTarget: '/simulations',
      roleScope: ['student', 'teacher', 'admin'],
    });
    expect(TASK_WORKSPACE_ROUTE_CONTRACTS.find((contract) => contract.href === '/interactive-learning/control-workbench')).toMatchObject({
      archetype: 'engineering-analysis',
    });
  });

  it('renders launch provenance distinctly for standalone, course, preview, and official workflows', () => {
    expect(describeExperienceLaunch({ kind: 'standalone' })).toMatchObject({
      label: '独立探索',
      visualBoundary: 'standalone',
    });
    expect(describeExperienceLaunch({ kind: 'course-launched', course: { sessionId: 's1', lessonItemId: 'li1' } })).toMatchObject({
      label: '课程内启动',
      visualBoundary: 'course',
    });
    expect(describeExperienceLaunch({ kind: 'arena-preview', arena: { taskId: 'task-1' } })).toMatchObject({
      label: 'Arena 预览',
      visualBoundary: 'preview',
    });
    expect(describeExperienceLaunch({ kind: 'official-evaluation', arena: { taskId: 'task-1' } })).toMatchObject({
      label: '官方评价',
      visualBoundary: 'official',
    });
    expect(describeExperienceLaunch({ kind: 'teacher-review', roleScope: ['teacher'] })).toMatchObject({
      label: '教师复核',
      visualBoundary: 'review',
    });
    expect(describeExperienceLaunch({ kind: 'admin-review', roleScope: ['admin'] })).toMatchObject({
      label: '管理员复核',
      visualBoundary: 'review',
    });
  });

  it('maps preview, official, replay, and model relation into shared status payloads', () => {
    const statuses = buildExperienceStatusPayloads({
      launch: { kind: 'arena-preview', arena: { taskId: 'task-cruise' } },
      replay: { state: 'mismatched', protocolVersion: '1.0', checksum: 'sha256:bad' },
      modelRelation: {
        relation: 'surrogate',
        registryStatus: 'registered',
        modelId: 'model-cruise-surrogate',
      },
    });

    const evaluation = buildPlatformStatusViewModel(statuses.evaluation, { role: 'teacher' });
    const replay = buildPlatformStatusViewModel(statuses.replay, { role: 'teacher' });
    const model = buildPlatformStatusViewModel(statuses.modelRelation, { role: 'teacher' });

    expect(evaluation.summaryLabel).toContain('预览评价');
    expect(evaluation.summaryLabel).not.toContain('正式评价');
    expect(replay.summaryLabel).toContain('回放过期');
    expect(replay.tone).toBe('warning');
    expect(model.summaryLabel).toContain('部分覆盖');
    expect(model.summaryLabel).toContain('中置信');
    expect(model.summaryLabel).toContain('降级可用');
    expect(model.summary).toContain('surrogate');
  });

  it('preserves teacher and admin review role scope in launch status payloads', () => {
    const teacherStatuses = buildExperienceStatusPayloads({
      launch: { kind: 'teacher-review', roleScope: ['teacher'], course: { sessionId: 'session-1' } },
    });
    const adminStatuses = buildExperienceStatusPayloads({
      launch: { kind: 'admin-review', roleScope: ['admin'] },
    });

    const teacherLaunch = buildPlatformStatusViewModel(teacherStatuses.launch, { role: 'teacher' });
    const adminLaunch = buildPlatformStatusViewModel(adminStatuses.launch, { role: 'admin' });
    const adminEvaluation = buildPlatformStatusViewModel(adminStatuses.evaluation, { role: 'admin' });

    expect(teacherLaunch.summary).toContain('教师复核');
    expect(teacherLaunch.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '角色范围', value: 'teacher' }),
    ]));
    expect(adminLaunch.summary).toContain('管理员复核');
    expect(adminEvaluation.summaryLabel).toContain('隐藏评价');
  });

  it('keeps restricted replay and surrogate model boundaries visible in compact status labels', () => {
    const statuses = buildExperienceStatusPayloads({
      launch: { kind: 'official-evaluation', arena: { taskId: 'task-1' } },
      replay: { state: 'restricted', protocolVersion: '1.0' },
      modelRelation: {
        relation: 'simplified',
        registryStatus: 'registered',
        modelId: 'model-simplified',
      },
    });

    const replay = buildPlatformStatusViewModel(statuses.replay, { role: 'student' });
    const model = buildPlatformStatusViewModel(statuses.modelRelation, { role: 'student' });

    expect(replay.summaryLabel).toContain('受限');
    expect(replay.summaryLabel).not.toContain('缺少回放');
    expect(replay.summary).toContain('restricted');
    expect(model.summaryLabel).toContain('部分覆盖');
    expect(model.summaryLabel).toContain('中置信');
    expect(model.summaryLabel).toContain('降级可用');
    expect(model.summary).toContain('simplified');
  });

  it('preserves Workbench challenge context, return navigation, and status slots', () => {
    const result = resolveControlWorkbenchSession({
      arenaTask: 'task-second-order-lead-pid',
      preset: 'classic-four-view',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const context = buildWorkbenchExperienceContext(result.session);

    expect(context.launch.kind).toBe('official-evaluation');
    expect(context.taskId).toBe('task-second-order-lead-pid');
    expect(context.returnHref).toBe('/arena/challenges/task-second-order-lead-pid');
    expect(context.breadcrumbs.map((item) => item.label)).toEqual([
      'Arena',
      '二阶对象快速稳定挑战',
      '控制工作台',
    ]);
    expect(context.slotContracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slot: 'status-rail', accepts: expect.stringContaining('submission') }),
        expect.objectContaining({ slot: 'side-panels', accepts: expect.stringContaining('metrics') }),
        expect.objectContaining({ slot: 'context-header', accepts: expect.stringContaining('return') }),
      ]),
    );
  });

  it('keeps shared experience contracts independent from client UI shell modules', () => {
    const contractSource = readRepoFile('src/features/simulation-arena-workbench/experience-shell-contracts.ts');

    expect(contractSource).toContain("@/features/control-workbench/routing");
    expect(contractSource).not.toContain('control-workbench/shell/control-workbench-shell');
    expect(contractSource).not.toContain("'use client'");
  });

  it('keeps course-launched experiences on the lesson runtime contract', () => {
    const launchContext = buildResourceRendererLaunchContext({
      resourceId: 'resource-1',
      registryId: 'sim-scene-cruise',
      sessionId: 'session-1',
      lessonItemId: 'item-1',
      lessonPlanId: 'plan-1',
      classId: 'class-1',
      stage: 'PARTICIPATORY',
    });
    const context = buildCourseLaunchExperienceContext(launchContext, { embedded: true });

    expect(context.launch.kind).toBe('course-launched');
    expect(context.course).toMatchObject({
      sessionId: 'session-1',
      lessonItemId: 'item-1',
      lessonPlanId: 'plan-1',
      classId: 'class-1',
    });
    expect(context.runtimeContracts).toEqual([
      'ResourceRenderer',
      'InteractiveProvider',
      'BaseWidgetProps',
      'embedded progress callbacks',
      'registry.defaultConfig -> TeachingResource.config -> LessonItem.overrideConfig',
    ]);
    expect(context.renderMode).toBe('embedded');
  });

  it('binds representative task routes to workspace archetype markers and floating dock safe areas', () => {
    const cruiseSource = readRepoFile('src/app/simulations/cruise/page.tsx');
    const simulationShellSource = readRepoFile('src/app/simulations/_components/simulation-shell.tsx');
    const workbenchSource = readRepoFile('src/features/control-workbench/shell/control-workbench-shell.tsx');
    const arenaDetailSource = readRepoFile('src/features/arena/challenge-detail.tsx');
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
    expect(unit41StudentRuntimeSource).toContain('data-task-workspace-archetype="lesson-runtime"');
    expect(unit41StudentRuntimeSource).toContain('data-return-target="/interactive-learning/courses/unit-4-1-design-task-expression"');
    expect(unit41StudentRuntimeSource).toContain('data-runtime-manifest-truth={runtimeManifestTruth}');
    expect(unit41StudentRuntimeSource).toContain('data-activity-submission-contract="manifest-runtime"');
    expect(unit41StudentRuntimeSource).toContain('data-evidence-flow-target="/profile/evidence"');
    expect(unit41StudentRuntimeSource).toContain('data-evidence-flow-state={isDemo ?');
    expect(unit41StudentRuntimeSource).toContain('data-task-workspace-zone="floating-dock-safe-area"');
    expect(globalsSource).toContain('[data-task-workspace-archetype]');
    expect(globalsSource).toContain('--task-workspace-floating-dock-safe-block');
    expect(globalsSource).not.toContain('--task-workspace-floating-dock-safe-inline');
  });
});
