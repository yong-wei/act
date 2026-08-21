import { describe, expect, it } from 'vitest';

import {
  loadMicroTutoringGoalNodeCatalog,
  resolveMicroTutoringGoalNode,
} from '../micro-tutoring-goal-node-catalog';

function source(entries: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    version: 'micro-tutoring-goal-node-catalog.v1',
    baselineVersion: 'micro-tutoring-practice-baseline.v1',
    graphVersion: 'autocontrol-kaq-graph.v1',
    source: 'test-source',
    entries,
    ...overrides,
  };
}

const activeEntry = {
  learningGoalId: 'feedback-loop-concept-foundations',
  aliases: ['learning-goal:feedback-loop-concept-foundations'],
  knowledgeNodeId: 'kn:autocontrol:feedback-loop',
  catalogVersion: 'micro-tutoring-goal-node-catalog.v1',
  graphVersion: 'autocontrol-kaq-graph.v1',
  sourceRefs: ['learning-goal:feedback-loop-concept-foundations'],
  enabled: true,
};

describe('micro tutoring goal node catalog', () => {
  it('resolves canonical identifiers and explicit aliases with source evidence', () => {
    const loaded = loadMicroTutoringGoalNodeCatalog(source([activeEntry]));

    expect(resolveMicroTutoringGoalNode(activeEntry.learningGoalId, loaded)).toMatchObject({
      ok: true,
      knowledgeNodeId: activeEntry.knowledgeNodeId,
      resolvedBy: 'canonical',
      source: 'test-source',
    });
    expect(resolveMicroTutoringGoalNode(activeEntry.aliases[0], loaded)).toMatchObject({
      ok: true,
      learningGoalId: activeEntry.learningGoalId,
      resolvedBy: 'alias',
    });
    expect(resolveMicroTutoringGoalNode('unknown', loaded)).toEqual({
      ok: false,
      reason: 'GOAL_UNKNOWN',
    });
  });

  it('rejects duplicate goals, conflicting aliases, non-knowledge nodes and version drift', () => {
    const loaded = loadMicroTutoringGoalNodeCatalog(source([
      activeEntry,
      { ...activeEntry, aliases: ['shared'] },
      {
        ...activeEntry,
        learningGoalId: 'other-goal',
        aliases: ['shared'],
        knowledgeNodeId: 'cap:autocontrol:model-feedback-system',
        sourceRefs: ['learning-goal:other-goal'],
      },
    ], { graphVersion: 'autocontrol-kaq-graph.v0' }));

    expect(loaded.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'VERSION_DRIFT',
      'DUPLICATE_GOAL',
      'ALIAS_CONFLICT',
      'NODE_DOMAIN_INVALID',
    ]));
    expect(resolveMicroTutoringGoalNode(activeEntry.learningGoalId, loaded)).toEqual({
      ok: false,
      reason: 'CATALOG_INVALID',
    });
  });

  it('rejects disabled goals without returning their node', () => {
    const loaded = loadMicroTutoringGoalNodeCatalog(source([{ ...activeEntry, enabled: false }]));
    expect(resolveMicroTutoringGoalNode(activeEntry.learningGoalId, loaded)).toEqual({
      ok: false,
      reason: 'GOAL_DISABLED',
    });
  });
});
