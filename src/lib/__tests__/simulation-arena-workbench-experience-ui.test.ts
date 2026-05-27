import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EXPERIENCE_SHELL_MIGRATION_CONTRACTS,
  EXPERIENCE_SHELL_SLOT_ORDER,
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
});
