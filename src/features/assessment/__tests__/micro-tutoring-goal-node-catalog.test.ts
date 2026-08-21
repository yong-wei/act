import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  loadMicroTutoringGoalNodeCatalog,
  resolveMicroTutoringGoalNode,
  type MicroTutoringGoalNodeCatalogEntry,
} from '../micro-tutoring-goal-node-catalog';
import { microTutoringOptionAttributionReviewSourceHash } from '../micro-tutoring-option-attribution-evidence';

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
  const learningGoalIds = [...new Set(entries.map((entry) => entry.learningGoalId))];
  const optionAttributions = learningGoalIds.flatMap((learningGoalId) => ['A', 'B'].map((optionKey) => {
    const attribution = {
      catalogItemId: `catalog-item:${learningGoalId}`,
      contentHash: 'a'.repeat(64),
      optionKey,
      learningGoalId,
      knowledgeNodeId: learningGoalId === 'other-goal'
        ? 'cap:autocontrol:model-feedback-system'
        : 'kn:autocontrol:feedback-loop',
      itemReviewSourceHash: `sha256:${'b'.repeat(64)}`,
    };
    return {
      ...attribution,
      reviewSourceHash: microTutoringOptionAttributionReviewSourceHash(attribution),
    };
  }));
  return {
    practiceBaseline: {
      version: 'micro-tutoring-practice-baseline.v1',
      entries: learningGoalIds.map((learningGoalId) => ({
        catalogItemId: `catalog-item:${learningGoalId}`,
        contentHash: 'a'.repeat(64),
      })),
    },
    optionAttributions: {
      version: 'micro-tutoring-option-attributions.v2',
      entries: optionAttributions,
    },
  };
}

function sourceRef(learningGoalId: string): string {
  const knowledgeNodeId = learningGoalId === 'other-goal'
    ? 'cap:autocontrol:model-feedback-system'
    : 'kn:autocontrol:feedback-loop';
  const binding = `catalog-item:${learningGoalId}\0${'a'.repeat(64)}\0sha256:${'b'.repeat(64)}\0${knowledgeNodeId}`;
  const digest = createHash('sha256').update(binding).digest('hex');
  return `micro-tutoring-practice-baseline.v1+micro-tutoring-option-attributions.v2#goal:${learningGoalId}#sha256:${digest}`;
}

const activeEntry = {
  learningGoalId: 'feedback-loop-concept-foundations',
  aliases: ['learning-goal:feedback-loop-concept-foundations'],
  knowledgeNodeId: 'kn:autocontrol:feedback-loop',
  catalogVersion: 'micro-tutoring-goal-node-catalog.v1',
  graphVersion: 'autocontrol-kaq-graph.v1',
  sourceRefs: [sourceRef('feedback-loop-concept-foundations')],
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
        sourceRefs: [sourceRef('other-goal')],
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

  it('rejects forged item-goal bindings, baseline content drift and invalid attribution hashes', () => {
    const forgedGoalContext = sourceContext([activeEntry]);
    const forgedAttribution = {
      ...forgedGoalContext.optionAttributions.entries[0],
      learningGoalId: 'other-goal',
      knowledgeNodeId: 'cap:autocontrol:model-feedback-system',
    };
    forgedGoalContext.optionAttributions.entries[0] = {
      ...forgedAttribution,
      reviewSourceHash: microTutoringOptionAttributionReviewSourceHash(forgedAttribution),
    };
    const contentDriftContext = sourceContext([activeEntry]);
    contentDriftContext.optionAttributions.entries[0].contentHash = 'c'.repeat(64);
    contentDriftContext.optionAttributions.entries[0].reviewSourceHash =
      microTutoringOptionAttributionReviewSourceHash(contentDriftContext.optionAttributions.entries[0]);
    const invalidHashContext = sourceContext([activeEntry]);
    invalidHashContext.optionAttributions.entries[0].reviewSourceHash = `sha256:${'d'.repeat(64)}`;

    for (const context of [forgedGoalContext, contentDriftContext, invalidHashContext]) {
      const loaded = loadMicroTutoringGoalNodeCatalog(source([activeEntry]), context);
      expect(loaded.issues).toContainEqual({
        code: 'SOURCE_DRIFT',
        ref: activeEntry.learningGoalId,
      });
      expect(resolveMicroTutoringGoalNode(activeEntry.learningGoalId, loaded)).toEqual({
        ok: false,
        reason: 'CATALOG_INVALID',
      });
    }
  });
});
