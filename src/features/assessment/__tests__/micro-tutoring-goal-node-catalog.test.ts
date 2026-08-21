import { describe, expect, it } from 'vitest';

import {
  loadMicroTutoringGoalNodeCatalog,
  resolveMicroTutoringGoalNode,
  type MicroTutoringGoalNodeCatalogEntry,
} from '../micro-tutoring-goal-node-catalog';

function source(entries: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    version: 'micro-tutoring-goal-node-catalog.v1',
    baselineVersion: 'micro-tutoring-practice-baseline.v1',
    graphVersion: 'autocontrol-kaq-graph.v1',
    source: 'micro-tutoring-option-attributions.v2',
    entries,
    ...overrides,
  };
}

function sourceContext(entries: Array<Pick<MicroTutoringGoalNodeCatalogEntry, 'learningGoalId'>>) {
  return {
    practiceBaseline: {
      version: 'micro-tutoring-practice-baseline.v1',
      entries: entries.map((entry) => ({
        catalogItemId: `catalog-item:${entry.learningGoalId}`,
        contentHash: 'a'.repeat(64),
      })),
    },
    optionAttributions: {
      version: 'micro-tutoring-option-attributions.v2',
      entries: entries.map((entry) => ({
        catalogItemId: `catalog-item:${entry.learningGoalId}`,
        learningGoalId: entry.learningGoalId,
      })),
    },
  };
}

const activeEntry = {
  learningGoalId: 'feedback-loop-concept-foundations',
  aliases: ['learning-goal:feedback-loop-concept-foundations'],
  knowledgeNodeId: 'kn:autocontrol:feedback-loop',
  catalogVersion: 'micro-tutoring-goal-node-catalog.v1',
  graphVersion: 'autocontrol-kaq-graph.v1',
  sourceRefs: [
    'micro-tutoring-practice-baseline.v1#goal:feedback-loop-concept-foundations',
    'micro-tutoring-option-attributions.v2#goal:feedback-loop-concept-foundations',
  ],
  enabled: true,
};

describe('micro tutoring goal node catalog', () => {
  it('resolves canonical identifiers and explicit aliases with source evidence', () => {
    const loaded = loadMicroTutoringGoalNodeCatalog(source([activeEntry]), sourceContext([activeEntry]));

    expect(resolveMicroTutoringGoalNode(activeEntry.learningGoalId, loaded)).toMatchObject({
      ok: true,
      knowledgeNodeId: activeEntry.knowledgeNodeId,
      resolvedBy: 'canonical',
      source: 'micro-tutoring-option-attributions.v2',
      sourceRefs: activeEntry.sourceRefs,
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
    const entries = [
      activeEntry,
      { ...activeEntry, aliases: ['shared'] },
      {
        ...activeEntry,
        learningGoalId: 'other-goal',
        aliases: ['shared'],
        knowledgeNodeId: 'cap:autocontrol:model-feedback-system',
        sourceRefs: [
          'micro-tutoring-practice-baseline.v1#goal:other-goal',
          'micro-tutoring-option-attributions.v2#goal:other-goal',
        ],
      },
    ];
    const loaded = loadMicroTutoringGoalNodeCatalog(
      source(entries, { graphVersion: 'autocontrol-kaq-graph.v0' }),
      sourceContext(entries),
    );

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
    const disabledEntry = { ...activeEntry, enabled: false };
    const loaded = loadMicroTutoringGoalNodeCatalog(source([disabledEntry]), sourceContext([disabledEntry]));
    expect(resolveMicroTutoringGoalNode(activeEntry.learningGoalId, loaded)).toEqual({
      ok: false,
      reason: 'GOAL_DISABLED',
    });
  });

  it('rejects forged catalog sources and source references that do not match the goal', () => {
    const forgedCatalogSource = loadMicroTutoringGoalNodeCatalog(
      source([activeEntry], { source: 'forged-source' }),
      sourceContext([activeEntry]),
    );
    const mismatchedEntry = {
      ...activeEntry,
      sourceRefs: [
        'micro-tutoring-practice-baseline.v1#goal:other-goal',
        'micro-tutoring-option-attributions.v2#goal:other-goal',
      ],
    };
    const mismatchedRefs = loadMicroTutoringGoalNodeCatalog(
      source([mismatchedEntry]),
      sourceContext([activeEntry]),
    );

    expect(forgedCatalogSource.issues).toContainEqual({
      code: 'SOURCE_DRIFT',
      ref: 'catalog-source',
    });
    expect(mismatchedRefs.issues).toContainEqual({
      code: 'SOURCE_DRIFT',
      ref: activeEntry.learningGoalId,
    });
    expect(resolveMicroTutoringGoalNode(activeEntry.learningGoalId, mismatchedRefs)).toEqual({
      ok: false,
      reason: 'CATALOG_INVALID',
    });
  });
});
