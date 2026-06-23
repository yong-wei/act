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

  it('tries later checkpoint candidates when the shortest insertable checkpoint exceeds the budget with prerequisites', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 8, prerequisiteNodeIds: [] },
        {
          nodeId: 'heavy-prep',
          estimatedTimeMinutes: 30,
          prerequisiteNodeIds: [],
          removable: true,
        },
        {
          nodeId: 'bad-checkpoint',
          estimatedTimeMinutes: 1,
          prerequisiteNodeIds: ['heavy-prep'],
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
        timeBudgetMinutes: 20,
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
    expect(repair.insertedNodeIds).toEqual(['good-checkpoint']);
    expect(repair.checkpointNodeIds).toEqual(['good-checkpoint']);
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('keeps trying checkpoint combinations until all required checkpoints fit the budget', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 5, prerequisiteNodeIds: [] },
        {
          nodeId: 'heavy-prep',
          estimatedTimeMinutes: 8,
          prerequisiteNodeIds: [],
          removable: true,
        },
        {
          nodeId: 'bad-checkpoint-1',
          estimatedTimeMinutes: 1,
          prerequisiteNodeIds: ['heavy-prep'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'good-checkpoint-1',
          estimatedTimeMinutes: 5,
          prerequisiteNodeIds: ['intro'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'good-checkpoint-2',
          estimatedTimeMinutes: 5,
          prerequisiteNodeIds: ['intro'],
          checkpointRole: 'formative',
        },
      ],
      constraints: {
        timeBudgetMinutes: 15,
        requiredCheckpointCount: 2,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['intro', 'good-checkpoint-1', 'good-checkpoint-2']);
    expect(repair.insertedNodeIds).toEqual(['good-checkpoint-1', 'good-checkpoint-2']);
    expect(repair.checkpointNodeIds).toEqual(['good-checkpoint-1', 'good-checkpoint-2']);
    expect(repair.repairedNodeIds).not.toContain('heavy-prep');
    expect(repair.repairedNodeIds).not.toContain('bad-checkpoint-1');
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('tries later checkpoint candidates when the shortest candidate only exceeds budget after terminal validation', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 5, prerequisiteNodeIds: [] },
        {
          nodeId: 'heavy-prep',
          estimatedTimeMinutes: 8,
          prerequisiteNodeIds: [],
          removable: true,
        },
        {
          nodeId: 'bad-checkpoint',
          estimatedTimeMinutes: 1,
          prerequisiteNodeIds: ['heavy-prep'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'good-checkpoint',
          estimatedTimeMinutes: 7,
          prerequisiteNodeIds: ['intro'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'terminal',
          estimatedTimeMinutes: 8,
          prerequisiteNodeIds: ['intro'],
          terminalValidation: 'official',
        },
      ],
      constraints: {
        timeBudgetMinutes: 20,
        requiredCheckpointCount: 1,
        terminalValidationRequired: true,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['intro', 'good-checkpoint', 'terminal']);
    expect(repair.insertedNodeIds).toEqual(['good-checkpoint', 'terminal']);
    expect(repair.checkpointNodeIds).toEqual(['good-checkpoint']);
    expect(repair.terminalValidationNodeIds).toEqual(['terminal']);
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('tries later official terminal validation candidates when the shortest terminal exceeds the budget with prerequisites', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro', 'checkpoint'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 5, prerequisiteNodeIds: [] },
        {
          nodeId: 'checkpoint',
          estimatedTimeMinutes: 7,
          prerequisiteNodeIds: ['intro'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'heavy-prep',
          estimatedTimeMinutes: 20,
          prerequisiteNodeIds: [],
          removable: true,
        },
        {
          nodeId: 'cheap-terminal-heavy-chain',
          estimatedTimeMinutes: 1,
          prerequisiteNodeIds: ['heavy-prep'],
          terminalValidation: 'official',
        },
        {
          nodeId: 'later-terminal-feasible',
          estimatedTimeMinutes: 8,
          prerequisiteNodeIds: ['intro'],
          terminalValidation: 'official',
        },
      ],
      constraints: {
        timeBudgetMinutes: 20,
        requiredCheckpointCount: 1,
        terminalValidationRequired: true,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['intro', 'checkpoint', 'later-terminal-feasible']);
    expect(repair.insertedNodeIds).toEqual(['later-terminal-feasible']);
    expect(repair.terminalValidationNodeIds).toEqual(['later-terminal-feasible']);
    expect(repair.repairedNodeIds).not.toContain('heavy-prep');
    expect(repair.repairedNodeIds).not.toContain('cheap-terminal-heavy-chain');
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('selects terminal validation that remains feasible after locked fallback repair', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro', 'locked-lab', 'checkpoint'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 5, prerequisiteNodeIds: [] },
        {
          nodeId: 'locked-lab',
          estimatedTimeMinutes: 5,
          prerequisiteNodeIds: ['intro'],
          locked: true,
          fallbackNodeIds: ['light-fallback'],
        },
        {
          nodeId: 'checkpoint',
          estimatedTimeMinutes: 3,
          prerequisiteNodeIds: ['intro'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'light-fallback',
          estimatedTimeMinutes: 5,
          prerequisiteNodeIds: ['intro'],
          removable: true,
        },
        {
          nodeId: 'heavy-prep',
          estimatedTimeMinutes: 4,
          prerequisiteNodeIds: [],
          removable: true,
        },
        {
          nodeId: 'cheap-terminal-heavy-chain',
          estimatedTimeMinutes: 1,
          prerequisiteNodeIds: ['heavy-prep'],
          terminalValidation: 'official',
        },
        {
          nodeId: 'later-terminal-feasible',
          estimatedTimeMinutes: 4,
          prerequisiteNodeIds: ['intro'],
          terminalValidation: 'official',
        },
      ],
      constraints: {
        timeBudgetMinutes: 22,
        requiredCheckpointCount: 1,
        terminalValidationRequired: true,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual([
      'intro',
      'light-fallback',
      'locked-lab',
      'checkpoint',
      'later-terminal-feasible',
    ]);
    expect(repair.terminalValidationNodeIds).toEqual(['later-terminal-feasible']);
    expect(repair.repairedNodeIds).not.toContain('heavy-prep');
    expect(repair.repairedNodeIds).not.toContain('cheap-terminal-heavy-chain');
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('tries later checkpoint candidates when the shortest candidate only exceeds budget after locked fallback repair', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro', 'locked-lab'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 5, prerequisiteNodeIds: [] },
        {
          nodeId: 'locked-lab',
          estimatedTimeMinutes: 5,
          prerequisiteNodeIds: ['intro'],
          locked: true,
          fallbackNodeIds: ['fallback-prep'],
        },
        {
          nodeId: 'fallback-prep',
          estimatedTimeMinutes: 7,
          prerequisiteNodeIds: ['intro'],
          removable: true,
        },
        {
          nodeId: 'heavy-prep',
          estimatedTimeMinutes: 8,
          prerequisiteNodeIds: [],
          removable: true,
        },
        {
          nodeId: 'bad-checkpoint',
          estimatedTimeMinutes: 1,
          prerequisiteNodeIds: ['heavy-prep'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'good-checkpoint',
          estimatedTimeMinutes: 3,
          prerequisiteNodeIds: ['intro'],
          checkpointRole: 'formative',
        },
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

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['intro', 'fallback-prep', 'locked-lab', 'good-checkpoint']);
    expect(repair.insertedNodeIds).toEqual(['good-checkpoint', 'fallback-prep']);
    expect(repair.checkpointNodeIds).toEqual(['good-checkpoint']);
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('tries later locked fallback candidates when the first fallback exceeds the budget', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro', 'locked-lab', 'checkpoint'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 5, prerequisiteNodeIds: [] },
        {
          nodeId: 'locked-lab',
          estimatedTimeMinutes: 5,
          prerequisiteNodeIds: ['intro'],
          locked: true,
          fallbackNodeIds: ['heavy-fallback', 'light-fallback'],
        },
        {
          nodeId: 'checkpoint',
          estimatedTimeMinutes: 3,
          prerequisiteNodeIds: ['intro'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'heavy-fallback',
          estimatedTimeMinutes: 20,
          prerequisiteNodeIds: ['intro'],
          removable: true,
        },
        {
          nodeId: 'light-fallback',
          estimatedTimeMinutes: 4,
          prerequisiteNodeIds: ['intro'],
          removable: true,
        },
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

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['intro', 'light-fallback', 'locked-lab', 'checkpoint']);
    expect(repair.insertedNodeIds).toEqual(['light-fallback']);
    expect(repair.repairedNodeIds).not.toContain('heavy-fallback');
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('selects fallback chains that keep later locked nodes feasible', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro', 'locked-a', 'locked-b', 'checkpoint'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 5, prerequisiteNodeIds: [] },
        {
          nodeId: 'locked-a',
          estimatedTimeMinutes: 4,
          prerequisiteNodeIds: ['intro'],
          locked: true,
          fallbackNodeIds: ['heavy-a-fallback', 'light-a-fallback'],
        },
        {
          nodeId: 'locked-b',
          estimatedTimeMinutes: 4,
          prerequisiteNodeIds: ['intro'],
          locked: true,
          fallbackNodeIds: ['b-fallback'],
        },
        {
          nodeId: 'checkpoint',
          estimatedTimeMinutes: 2,
          prerequisiteNodeIds: ['intro'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'heavy-a-fallback',
          estimatedTimeMinutes: 5,
          prerequisiteNodeIds: ['intro'],
          removable: true,
        },
        {
          nodeId: 'light-a-fallback',
          estimatedTimeMinutes: 2,
          prerequisiteNodeIds: ['intro'],
          removable: true,
        },
        {
          nodeId: 'b-fallback',
          estimatedTimeMinutes: 5,
          prerequisiteNodeIds: ['intro'],
          removable: true,
        },
      ],
      constraints: {
        timeBudgetMinutes: 22,
        requiredCheckpointCount: 1,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual([
      'intro',
      'light-a-fallback',
      'locked-a',
      'b-fallback',
      'locked-b',
      'checkpoint',
    ]);
    expect(repair.repairedNodeIds).not.toContain('heavy-a-fallback');
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('removes unused fallback candidates when another fallback keeps the locked node ready', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro', 'heavy-fallback', 'light-fallback', 'locked-lab'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 5, prerequisiteNodeIds: [] },
        {
          nodeId: 'heavy-fallback',
          estimatedTimeMinutes: 30,
          prerequisiteNodeIds: ['intro'],
          removable: true,
        },
        {
          nodeId: 'light-fallback',
          estimatedTimeMinutes: 4,
          prerequisiteNodeIds: ['intro'],
          removable: true,
        },
        {
          nodeId: 'locked-lab',
          estimatedTimeMinutes: 5,
          prerequisiteNodeIds: ['intro'],
          locked: true,
          fallbackNodeIds: ['heavy-fallback', 'light-fallback'],
        },
      ],
      constraints: {
        timeBudgetMinutes: 15,
        requiredCheckpointCount: 0,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['intro', 'light-fallback', 'locked-lab']);
    expect(repair.removedNodeIds).toEqual(['heavy-fallback']);
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('keeps already satisfied ready fallback paths unchanged', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro', 'heavy-fallback', 'locked-lab'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 5, prerequisiteNodeIds: [] },
        {
          nodeId: 'heavy-fallback',
          estimatedTimeMinutes: 8,
          prerequisiteNodeIds: ['intro'],
          removable: true,
        },
        {
          nodeId: 'light-fallback',
          estimatedTimeMinutes: 2,
          prerequisiteNodeIds: ['intro'],
          removable: true,
        },
        {
          nodeId: 'locked-lab',
          estimatedTimeMinutes: 5,
          prerequisiteNodeIds: ['intro'],
          locked: true,
          fallbackNodeIds: ['heavy-fallback', 'light-fallback'],
        },
      ],
      constraints: {
        timeBudgetMinutes: 20,
        requiredCheckpointCount: 0,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('satisfied');
    expect(repair.repairedNodeIds).toEqual(['intro', 'heavy-fallback', 'locked-lab']);
    expect(repair.insertedNodeIds).toEqual([]);
    expect(repair.removedNodeIds).toEqual([]);
    expect(repair.repairedConstraints).toEqual([]);
  });

  it('tries later fallback candidates when an inserted fallback is itself locked without support', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['locked-a'],
      candidates: [
        {
          nodeId: 'locked-a',
          estimatedTimeMinutes: 5,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: ['bad-locked', 'good-prep'],
        },
        {
          nodeId: 'bad-locked',
          estimatedTimeMinutes: 3,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: [],
          removable: true,
        },
        {
          nodeId: 'good-prep',
          estimatedTimeMinutes: 4,
          prerequisiteNodeIds: [],
          removable: true,
        },
      ],
      constraints: {
        timeBudgetMinutes: 12,
        requiredCheckpointCount: 0,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['good-prep', 'locked-a']);
    expect(repair.insertedNodeIds).toEqual(['good-prep']);
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('tries later fallback candidates when an existing fallback is locked without support', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['bad-locked', 'locked-a'],
      candidates: [
        {
          nodeId: 'locked-a',
          estimatedTimeMinutes: 5,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: ['bad-locked', 'good-prep'],
        },
        {
          nodeId: 'bad-locked',
          estimatedTimeMinutes: 3,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: [],
          removable: true,
        },
        {
          nodeId: 'good-prep',
          estimatedTimeMinutes: 4,
          prerequisiteNodeIds: [],
          removable: true,
        },
      ],
      constraints: {
        timeBudgetMinutes: 12,
        requiredCheckpointCount: 0,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['good-prep', 'locked-a']);
    expect(repair.insertedNodeIds).toEqual(['good-prep']);
    expect(repair.removedNodeIds).toEqual(['bad-locked']);
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('returns bounded infeasible for mutually locked fallback candidates', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['locked-a'],
      candidates: [
        {
          nodeId: 'locked-a',
          estimatedTimeMinutes: 4,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: ['locked-b'],
        },
        {
          nodeId: 'locked-b',
          estimatedTimeMinutes: 4,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: ['locked-a'],
        },
      ],
      constraints: {
        timeBudgetMinutes: 20,
        requiredCheckpointCount: 0,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('infeasible');
    expect(repair.repairedNodeIds).toEqual(['locked-a']);
    expect(repair.infeasibleReasons).toContainEqual(expect.objectContaining({
      code: 'locked-node-without-fallback',
      nodeIds: ['locked-a', 'locked-b'],
    }));
  });

  it('returns bounded infeasible when mutually locked fallback candidates are already selected', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['locked-b', 'locked-a'],
      candidates: [
        {
          nodeId: 'locked-a',
          estimatedTimeMinutes: 4,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: ['locked-b'],
        },
        {
          nodeId: 'locked-b',
          estimatedTimeMinutes: 4,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: ['locked-a'],
        },
      ],
      constraints: {
        timeBudgetMinutes: 20,
        requiredCheckpointCount: 0,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('infeasible');
    expect(repair.repairedNodeIds).toEqual(['locked-b', 'locked-a']);
    expect(repair.infeasibleReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'locked-node-without-fallback' }),
    ]));
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

  it('keeps an already-ready fallback as satisfied when the final budget is infeasible', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['prep-card', 'locked-lab'],
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
    expect(repair.infeasibleReasons).toContainEqual(expect.objectContaining({
      code: 'time-budget-insufficient',
    }));
    expect(repair.infeasibleReasons).not.toContainEqual(expect.objectContaining({
      code: 'locked-node-without-fallback',
    }));
  });

  it('audits locked fallback candidates inserted before locked milestones', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['locked-a'],
      candidates: [
        {
          nodeId: 'locked-a',
          estimatedTimeMinutes: 10,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: ['locked-b'],
        },
        {
          nodeId: 'locked-b',
          estimatedTimeMinutes: 5,
          prerequisiteNodeIds: [],
          locked: true,
          fallbackNodeIds: [],
        },
      ],
      constraints: {
        timeBudgetMinutes: 20,
        requiredCheckpointCount: 0,
        terminalValidationRequired: false,
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('infeasible');
    expect(repair.repairedNodeIds).toEqual(['locked-a']);
    expect(repair.insertedNodeIds).toEqual([]);
    expect(repair.infeasibleReasons).toContainEqual(expect.objectContaining({
      code: 'locked-node-without-fallback',
      nodeIds: ['locked-a', 'locked-b'],
    }));
  });

  it('removes optional extra checkpoints when the minimum checkpoint count remains satisfied', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro', 'required-checkpoint', 'extra-checkpoint'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 5, prerequisiteNodeIds: [] },
        {
          nodeId: 'required-checkpoint',
          estimatedTimeMinutes: 8,
          prerequisiteNodeIds: ['intro'],
          checkpointRole: 'formative',
        },
        {
          nodeId: 'extra-checkpoint',
          estimatedTimeMinutes: 15,
          prerequisiteNodeIds: ['intro'],
          checkpointRole: 'formative',
          removable: true,
        },
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

    expect(repair.status).toBe('repaired');
    expect(repair.repairedNodeIds).toEqual(['intro', 'required-checkpoint']);
    expect(repair.removedNodeIds).toEqual(['extra-checkpoint']);
    expect(repair.checkpointNodeIds).toEqual(['required-checkpoint']);
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('does not remove the only selected node covering a required target', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro', 'only-target', 'terminal'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 5, prerequisiteNodeIds: [], coverageTargetIds: ['intro-target'] },
        {
          nodeId: 'only-target',
          estimatedTimeMinutes: 15,
          prerequisiteNodeIds: ['intro'],
          removable: true,
          coverageTargetIds: ['required-target'],
        },
        {
          nodeId: 'terminal',
          estimatedTimeMinutes: 10,
          prerequisiteNodeIds: ['intro'],
          terminalValidation: 'official',
          coverageTargetIds: ['intro-target'],
        },
      ],
      constraints: {
        timeBudgetMinutes: 20,
        requiredCheckpointCount: 0,
        terminalValidationRequired: true,
        requiredCoverageTargetIds: ['intro-target', 'required-target'],
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('infeasible');
    expect(repair.removedNodeIds).toEqual([]);
    expect(repair.infeasibleReasons).toContainEqual(expect.objectContaining({
      code: 'time-budget-insufficient',
    }));
  });

  it('can remove a budget candidate when another selected node covers the same required target', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['intro', 'duplicate-target', 'target-backup', 'terminal'],
      candidates: [
        { nodeId: 'intro', estimatedTimeMinutes: 5, prerequisiteNodeIds: [], coverageTargetIds: ['intro-target'] },
        {
          nodeId: 'duplicate-target',
          estimatedTimeMinutes: 15,
          prerequisiteNodeIds: ['intro'],
          removable: true,
          coverageTargetIds: ['required-target'],
        },
        {
          nodeId: 'target-backup',
          estimatedTimeMinutes: 4,
          prerequisiteNodeIds: ['intro'],
          coverageTargetIds: ['required-target'],
        },
        {
          nodeId: 'terminal',
          estimatedTimeMinutes: 10,
          prerequisiteNodeIds: ['intro'],
          terminalValidation: 'official',
          coverageTargetIds: ['intro-target'],
        },
      ],
      constraints: {
        timeBudgetMinutes: 20,
        requiredCheckpointCount: 0,
        terminalValidationRequired: true,
        requiredCoverageTargetIds: ['intro-target', 'required-target'],
      },
      versionRefs: {
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      },
    });

    expect(repair.status).toBe('repaired');
    expect(repair.removedNodeIds).toEqual(['duplicate-target']);
    expect(repair.repairedNodeIds).toEqual(['intro', 'target-backup', 'terminal']);
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('keeps official terminal validation at the path endpoint after prerequisite sorting', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['lesson', 'terminal'],
      candidates: [
        { nodeId: 'prep', estimatedTimeMinutes: 5, prerequisiteNodeIds: [] },
        {
          nodeId: 'lesson',
          estimatedTimeMinutes: 8,
          prerequisiteNodeIds: ['prep'],
        },
        {
          nodeId: 'terminal',
          estimatedTimeMinutes: 10,
          prerequisiteNodeIds: [],
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
    expect(repair.repairedNodeIds).toEqual(['prep', 'lesson', 'terminal']);
    expect(repair.insertedNodeIds).toEqual(['prep']);
    expect(repair.terminalValidationNodeIds).toEqual(['terminal']);
    expect(repair.infeasibleReasons).toEqual([]);
  });

  it('marks paths infeasible when terminal endpoint ordering conflicts with hard prerequisites', () => {
    const repair = repairPathConstraints({
      draftNodeIds: ['lesson'],
      candidates: [
        {
          nodeId: 'terminal',
          estimatedTimeMinutes: 10,
          prerequisiteNodeIds: [],
          terminalValidation: 'official',
        },
        {
          nodeId: 'lesson',
          estimatedTimeMinutes: 8,
          prerequisiteNodeIds: ['terminal'],
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

    expect(repair.status).toBe('infeasible');
    expect(repair.repairedNodeIds).toEqual(['lesson', 'terminal']);
    expect(repair.infeasibleReasons).toContainEqual(expect.objectContaining({
      code: 'hard-prerequisite-missing',
      nodeIds: ['lesson', 'terminal'],
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
