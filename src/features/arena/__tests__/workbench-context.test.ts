import { describe, it, expect } from 'vitest';
import { resolveArenaWorkbenchContext } from '../workbench/context';
import { inferArenaObjectCapabilities } from '../workbench/capabilities';
import { ARENA_CHALLENGE_OBJECTS, ARENA_CHALLENGE_TASKS } from '../data/seed-challenges';

describe('resolveArenaWorkbenchContext', () => {
  it('resolves context for task-second-order-lead-pid', () => {
    const ctx = resolveArenaWorkbenchContext('task-second-order-lead-pid');
    expect(ctx).not.toBeNull();
    expect(ctx!.task.id).toBe('task-second-order-lead-pid');
    expect(ctx!.object.id).toBe('plant-second-order-underdamped');
    expect(ctx!.entryMode).toBe('challenge');
    expect(ctx!.locked).toBe(true);
    expect(ctx!.capabilities.supportsRootLocus).toBe(true);
    expect(ctx!.capabilities.supportsBode).toBe(true);
    expect(ctx!.capabilities.supportsPid).toBe(true);
    expect(ctx!.capabilities.supportsSerialCorrection).toBe(true);
    expect(ctx!.allowedMethods).toContain('pid');
    expect(ctx!.allowedMethods).toContain('serial-compensator');
    expect(ctx!.recommendedWorkspaceMode).toBe('multi-representation-linkage');
    expect(ctx!.returnHref).toBe('/arena/challenges/task-second-order-lead-pid');
  });

  it('resolves context for black-box task', () => {
    const ctx = resolveArenaWorkbenchContext('task-cruise-roll-blackbox-identification');
    expect(ctx).not.toBeNull();
    expect(ctx!.task.id).toBe('task-cruise-roll-blackbox-identification');
    expect(ctx!.object.id).toBe('plant-cruise-roll-blackbox');
    expect(ctx!.object.visibility).toBe('black-box');
    expect(ctx!.capabilities.supportsIdentification).toBe(true);
    expect(ctx!.capabilities.supportsRootLocus).toBe(false);
    expect(ctx!.capabilities.supportsBode).toBe(false);
    expect(ctx!.capabilities.hasTransferFunction).toBe(false);
    expect(ctx!.recommendedWorkspaceMode).toBe('black-box-identification');
  });

  it('returns null for missing task', () => {
    const ctx = resolveArenaWorkbenchContext('non-existent-task');
    expect(ctx).toBeNull();
  });

  it('resolves odyssey task with correct entry mode', () => {
    const ctx = resolveArenaWorkbenchContext('task-odyssey-level-one-growth');
    expect(ctx).not.toBeNull();
    expect(ctx!.entryMode).toBe('odyssey');
    expect(ctx!.locked).toBe(true);
    expect(ctx!.recommendedWorkspaceMode).toBe('control-odyssey');
  });

  it('resolves context for unstable first-order stabilization', () => {
    const ctx = resolveArenaWorkbenchContext('task-unstable-first-order-stabilization');
    expect(ctx).not.toBeNull();
    expect(ctx!.object.id).toBe('plant-unstable-first-order');
    expect(ctx!.capabilities.supportsRootLocus).toBe(true);
    expect(ctx!.allowedMethods).toContain('pid');
    expect(ctx!.allowedMethods).toContain('serial-compensator');
  });
});

describe('every task has required entities', () => {
  for (const task of ARENA_CHALLENGE_TASKS) {
    it(`task ${task.id} resolves context successfully`, () => {
      const ctx = resolveArenaWorkbenchContext(task.id);
      expect(ctx).not.toBeNull();
      if (ctx) {
        expect(ctx.object.id).toBe(task.objectId);
        expect(ctx.metricProfile.id).toBe(task.metricProfileId);
        expect(ctx.leaderboardPolicy.id).toBe(task.leaderboardPolicyId);
      }
    });
  }
});

describe('inferArenaObjectCapabilities', () => {
  it('white-box transfer-function object supports analysis', () => {
    const obj = ARENA_CHALLENGE_OBJECTS.find((o) => o.id === 'plant-second-order-underdamped')!;
    const caps = inferArenaObjectCapabilities(obj);
    expect(caps.isLti).toBe(true);
    expect(caps.isSiso).toBe(true);
    expect(caps.hasTransferFunction).toBe(true);
    expect(caps.supportsStepResponse).toBe(true);
    expect(caps.supportsRootLocus).toBe(true);
    expect(caps.supportsBode).toBe(true);
    expect(caps.supportsNyquist).toBe(true);
    expect(caps.supportsSerialCorrection).toBe(true);
    expect(caps.supportsPid).toBe(true);
    expect(caps.supportsOfficialEvaluation).toBe(true);
    expect(caps.supportsIdentification).toBe(false);
  });

  it('black-box object has identification but no analysis', () => {
    const obj = ARENA_CHALLENGE_OBJECTS.find((o) => o.id === 'plant-cruise-roll-blackbox')!;
    const caps = inferArenaObjectCapabilities(obj);
    expect(caps.supportsIdentification).toBe(true);
    expect(caps.supportsVirtualSimulationPreview).toBe(true);
    expect(caps.supportsOfficialEvaluation).toBe(true);
    expect(caps.hasTransferFunction).toBe(false);
    expect(caps.supportsRootLocus).toBe(false);
    expect(caps.supportsBode).toBe(false);
    expect(caps.supportsNyquist).toBe(false);
    expect(caps.supportsSerialCorrection).toBe(false);
  });

  it('all white-box transfer-function objects support official evaluation', () => {
    const objs = ARENA_CHALLENGE_OBJECTS.filter(
      (o) => o.visibility === 'white-box' && o.model !== undefined,
    );
    for (const obj of objs) {
      const caps = inferArenaObjectCapabilities(obj);
      expect(caps.supportsOfficialEvaluation).toBe(true);
    }
  });

  it('all objects with workbenchSeed are multi-representation compatible', () => {
    const objs = ARENA_CHALLENGE_OBJECTS.filter((o) => o.workbenchSeed !== undefined);
    for (const obj of objs) {
      const caps = inferArenaObjectCapabilities(obj);
      expect(caps.supportsRootLocus).toBe(true);
      expect(caps.supportsBode).toBe(true);
    }
  });
});

describe('allowedMethods and workspaceMode consistency', () => {
  for (const task of ARENA_CHALLENGE_TASKS) {
    it(`task ${task.id} methods do not conflict with workspace mode ${task.workspaceMode}`, () => {
      const ctx = resolveArenaWorkbenchContext(task.id);
      expect(ctx).not.toBeNull();

      if (task.workspaceMode === 'multi-representation-linkage') {
        for (const method of task.allowedMethods) {
          expect(['serial-compensator', 'pid']).toContain(method);
        }
      }

      if (task.workspaceMode === 'black-box-identification') {
        for (const method of task.allowedMethods) {
          expect(['black-box-control']).toContain(method);
        }
      }
    });
  }
});
