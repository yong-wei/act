import { describe, expect, it } from 'vitest';

import { repairPathConstraints } from '../adaptive-planning/path-constraint-repair';

describe('path constraint repair', () => {
  it('removes optional heavy nodes to satisfy the time budget', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro', 'heavy-lab', 'terminal'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 10, prerequisiteNodeIds: [] },
        { nodeId: 'heavy-lab', estimatedTimeMinutes: 50, prerequisiteNodeIds: [], removable: true },
        {
          nodeId: 'terminal',
          estimatedTimeMinutes: 15,
          prerequisiteNodeIds: ['intro'],
          terminalValidation: 'official',
        },
      ],
      constraints: {
        timeBudgetMinutes: 30,
        requiredCheckpointCount: 0,
        terminalValidationRequired: true,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['intro', 'terminal']);
    expect(repair.removedNodeIds).toEqual(['heavy-lab']);
    expect(repair.repairedConstraints).toEqual(expect.arrayContaining(['time-budget']));
    expect(repair.limitations).toContain('removed-optional-node:heavy-lab');
  });

  it('inserts checkpoint and terminal validation candidates before returning a repaired path', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 8, prerequisiteNodeIds: [] },
        {
          nodeId: 'checkpoint',
          estimatedTimeMinutes: 10,
          prerequisiteNodeIds: ['intro'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'terminal',
          estimatedTimeMinutes: 12,
          prerequisiteNodeIds: ['checkpoint'],
          terminalValidation: 'official',
        },
      ],
      constraints: {
        timeBudgetMinutes: 35,
        requiredCheckpointCount: 1,
        terminalValidationRequired: true,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['intro', 'checkpoint', 'terminal']);
    expect(repair.insertedNodeIds).toEqual(['checkpoint', 'terminal']);
    expect(repair.checkpointNodeIds).toEqual(['checkpoint']);
    expect(repair.terminalValidationNodeIds).toEqual(['terminal']);
    expect(repair.repairedConstraints).toEqual(expect.arrayContaining([
      'checkpoint-coverage',
      'terminal-validation',
    ]));
  });

  it('returns infeasible when required checkpoints are absent from the bounded candidate set', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 8, prerequisiteNodeIds: [] },
      ],
      constraints: {
        timeBudgetMinutes: 20,
        requiredCheckpointCount: 1,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('infeasible');
    expect(repair.infeasibleReasons).toContainEqual(expect.objectContaining({
      code: 'checkpoint-resource-missing',
      nodeIds: [],
    }));
    expect(repair.limitations).toContain('checkpoint-resource-missing');
  });

  it('inserts bounded fallback nodes before locked future milestones', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['locked-lab'],
      candidates: [
        { nodeId: 'prep-card', estimatedTimeMinutes: 8, prerequisiteNodeIds: [] },
        {
          nodeId: 'locked-lab',
          estimatedTimeMinutes: 25,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: ['prep-card'],
        },
      ],
      constraints: {
        timeBudgetMinutes: 40,
        requiredCheckpointCount: 0,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['prep-card', 'locked-lab']);
    expect(repair.insertedNodeIds).toEqual(['prep-card']);
    expect(repair.repairedConstraints).toContain('locked-node-fallback');
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('keeps fallback prerequisites before fallback nodes when repairing locked milestones', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['locked-lab'],
      candidates: [
        { nodeId: 'prep-prereq', estimatedTimeMinutes: 6, prerequisiteNodeIds: [] },
        { nodeId: 'prep-card', estimatedTimeMinutes: 8, prerequisiteNodeIds: ['prep-prereq'] },
        {
          nodeId: 'locked-lab',
          estimatedTimeMinutes: 25,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: ['prep-card'],
        },
      ],
      constraints: {
        timeBudgetMinutes: 45,
        requiredCheckpointCount: 0,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['prep-prereq', 'prep-card', 'locked-lab']);
    expect(repair.insertedNodeIds).toEqual(['prep-prereq', 'prep-card']);
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('moves existing fallback prerequisite chains before locked milestones', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['locked-lab', 'prep-prereq', 'prep-card'],
      candidates: [
        { nodeId: 'prep-prereq', estimatedTimeMinutes: 6, prerequisiteNodeIds: [] },
        { nodeId: 'prep-card', estimatedTimeMinutes: 8, prerequisiteNodeIds: ['prep-prereq'] },
        {
          nodeId: 'locked-lab',
          estimatedTimeMinutes: 25,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: ['prep-card'],
        },
      ],
      constraints: {
        timeBudgetMinutes: 45,
        requiredCheckpointCount: 0,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['prep-prereq', 'prep-card', 'locked-lab']);
    expect(repair.insertedNodeIds).toEqual([]);
    expect(repair.repairedConstraints).toContain('locked-node-fallback');
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('repairs fallback chains when only the fallback node is before the locked milestone', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['prep-card', 'locked-lab', 'prep-prereq'],
      candidates: [
        { nodeId: 'prep-prereq', estimatedTimeMinutes: 6, prerequisiteNodeIds: [] },
        { nodeId: 'prep-card', estimatedTimeMinutes: 8, prerequisiteNodeIds: ['prep-prereq'] },
        {
          nodeId: 'locked-lab',
          estimatedTimeMinutes: 25,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: ['prep-card'],
        },
      ],
      constraints: {
        timeBudgetMinutes: 45,
        requiredCheckpointCount: 0,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['prep-prereq', 'prep-card', 'locked-lab']);
    expect(repair.repairedConstraints).toContain('locked-node-fallback');
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('does not keep local failure reasons when a later fallback candidate succeeds', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['locked-lab'],
      candidates: [
        { nodeId: 'bad-prep', estimatedTimeMinutes: 8, prerequisiteNodeIds: ['missing-prep'] },
        { nodeId: 'good-prep', estimatedTimeMinutes: 7, prerequisiteNodeIds: [] },
        {
          nodeId: 'locked-lab',
          estimatedTimeMinutes: 25,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: ['bad-prep', 'good-prep'],
        },
      ],
      constraints: {
        timeBudgetMinutes: 45,
        requiredCheckpointCount: 0,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['good-prep', 'locked-lab']);
    expect(repair.insertedNodeIds).toEqual(['good-prep']);
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('tries later checkpoint candidates when the shortest checkpoint is not insertable', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 8, prerequisiteNodeIds: [] },
        {
          nodeId: 'bad-checkpoint',
          estimatedTimeMinutes: 3,
          prerequisiteNodeIds: ['missing-prep'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'good-checkpoint',
          estimatedTimeMinutes: 9,
          prerequisiteNodeIds: ['intro'],
          checkpointRole: 'formative',
        },
      ],
      constraints: {
        timeBudgetMinutes: 30,
        requiredCheckpointCount: 1,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['intro', 'good-checkpoint']);
    expect(repair.checkpointNodeIds).toEqual(['good-checkpoint']);
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('skips cyclic checkpoint candidates and tries the next feasible candidate', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 8, prerequisiteNodeIds: [] },
        {
          nodeId: 'bad-a',
          estimatedTimeMinutes: 2,
          prerequisiteNodeIds: ['bad-b'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'bad-b',
          estimatedTimeMinutes: 2,
          prerequisiteNodeIds: ['bad-a'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'good-checkpoint',
          estimatedTimeMinutes: 9,
          prerequisiteNodeIds: ['intro'],
          checkpointRole: 'formative',
        },
      ],
      constraints: {
        timeBudgetMinutes: 30,
        requiredCheckpointCount: 1,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['intro', 'good-checkpoint']);
    expect(repair.checkpointNodeIds).toEqual(['good-checkpoint']);
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('does not remove fallback support nodes to satisfy the time budget', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['locked-lab'],
      candidates: [
        { nodeId: 'prep-card', estimatedTimeMinutes: 8, prerequisiteNodeIds: [], removable: true },
        {
          nodeId: 'locked-lab',
          estimatedTimeMinutes: 25,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: ['prep-card'],
          terminalValidation: 'official',
        },
      ],
      constraints: {
        timeBudgetMinutes: 25,
        requiredCheckpointCount: 0,
        terminalValidationRequired: true,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('infeasible');
    expect(repair.repairedNodeIds).toEqual(['prep-card', 'locked-lab']);
    expect(repair.removedNodeIds).toEqual([]);
    expect(repair.infeasibleReasons).toContainEqual(expect.objectContaining({
      code: 'time-budget-insufficient',
      nodeIds: ['prep-card', 'locked-lab'],
    }));
  });

  it('returns structured infeasible reasons for missing terminal validation and locked heavy nodes', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro', 'locked-lab'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 8, prerequisiteNodeIds: [] },
        {
          nodeId: 'locked-lab',
          estimatedTimeMinutes: 25,
          prerequisiteNodeIds: ['intro'],
          locked: true,
          fallbackNodeIds: [],
          terminalValidation: 'preview',
        },
      ],
      constraints: {
        timeBudgetMinutes: 45,
        requiredCheckpointCount: 0,
        terminalValidationRequired: true,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('infeasible');
    expect(repair.infeasibleReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'terminal-validation-resource-missing',
        nodeIds: ['locked-lab'],
      }),
      expect.objectContaining({
        code: 'locked-node-without-fallback',
        nodeIds: ['locked-lab'],
      }),
    ]));
    expect(repair.repairedNodeIds).toEqual(['intro', 'locked-lab']);
    expect(repair.versionRefs.repairVersion).toBe('path-constraint-repair.v1');
  });
});
