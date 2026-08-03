/**
 * ACT Teaching Projection incremental rebase (#1272).
 *
 * Fixtures: label/alias, metadata/type, relation, deprecation, successor,
 * split, merge, no-successor, source-anchor. Tests call real shipped functions.
 */

import {
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  actDeltaChange,
  activateTeachingProjection,
  applyCanonicalRewrites,
  buildRebaseDecision,
  buildTeachingProjection,
  calculateImpactOnly,
  classifySupersessionTopology,
  computeActTeachingProjectionImpactSet,
  digestActDeltaChangeEvents,
  inventoryDeltaDetailsForAct,
  inventoryReleaseSetDeltaForAct,
  loadStagedTeachingProjection,
  projectionDigest,
  readCurrentTeachingProjectionPointer,
  rebaseTeachingProjection,
  resolveRebaseDecisions,
  resolveTeachingProjectionStorePaths,
  stageRebasedTeachingProjection,
  stageTeachingProjection,
  TeachingProjectionRebaseError,
  type ActDeltaChangeEvent,
  type ActReleaseSetDeltaDetailsView,
  type TeachingProjectionAuthoringInput,
} from '../teaching-projection';

const commitA = 'a'.repeat(40);
const commitB = 'b'.repeat(40);
const hashA = '1'.repeat(64);
const hashB = '2'.repeat(64);

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function tempProjectionRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'act-teaching-rebase-'));
  tempRoots.push(root);
  return resolveTeachingProjectionStorePaths(root);
}

function baseAuthorityNodes() {
  return [
    { canonicalId: 'node-a', lifecycleStatus: 'active', successorCanonicalId: null },
    { canonicalId: 'node-b', lifecycleStatus: 'active', successorCanonicalId: null },
    { canonicalId: 'node-unrelated', lifecycleStatus: 'active', successorCanonicalId: null },
  ];
}

function successorAuthorityNodes() {
  return [
    { canonicalId: 'node-a', lifecycleStatus: 'retired', successorCanonicalId: 'node-a2' },
    { canonicalId: 'node-a2', lifecycleStatus: 'active', successorCanonicalId: null },
    { canonicalId: 'node-b', lifecycleStatus: 'active', successorCanonicalId: null },
    { canonicalId: 'node-unrelated', lifecycleStatus: 'active', successorCanonicalId: null },
    { canonicalId: 'node-new', lifecycleStatus: 'active', successorCanonicalId: null },
  ];
}

function emptyAuthoring(
  overrides: Partial<TeachingProjectionAuthoringInput> = {},
): TeachingProjectionAuthoringInput {
  return {
    contract: 'act-teaching-projection-authoring/v1',
    scopeId: 'fixture-rebase-pkg',
    authoringRevision: commitA,
    authorityReleaseId: 'ctr:release:eng-v1',
    authorityReleaseSetId: 'set-1',
    authoritySnapshotHash: hashA,
    resources: [],
    bindings: [],
    prerequisites: [],
    coreNodes: [],
    cards: [],
    authorityNodes: baseAuthorityNodes(),
    ...overrides,
  };
}

function boundProjectionAuthoring(
  overrides: Partial<TeachingProjectionAuthoringInput> = {},
): TeachingProjectionAuthoringInput {
  return emptyAuthoring({
    scopeId: 'fixture-rebase-pkg',
    resources: [
      {
        resourceType: 'step',
        lessonKey: 'lesson-02',
        stepId: 'practice-1',
        projectionMode: 'REQUIRED',
        scopeId: 'fixture-rebase-pkg',
        title: 'Practice step',
      },
      {
        resourceType: 'lesson',
        lessonKey: 'lesson-02',
        projectionMode: 'OPTIONAL',
        scopeId: 'fixture-rebase-pkg',
      },
      {
        resourceType: 'textbook',
        sourceDocumentId: 'dorf-ch1',
        projectionMode: 'OPTIONAL',
        scopeId: 'fixture-rebase-pkg',
      },
      {
        resourceType: 'textbook-section',
        sectionId: 'dorf-ch1-s2',
        projectionMode: 'OPTIONAL',
        scopeId: 'fixture-rebase-pkg',
      },
    ],
    bindings: [
      {
        resourceId: 'act:step:lesson-02:practice-1',
        canonicalId: 'node-a',
        role: 'PRACTICES',
        scopeId: 'fixture-rebase-pkg',
        primary: true,
      },
      {
        resourceId: 'act:textbook:dorf-ch1',
        canonicalId: 'node-b',
        role: 'COVERS',
        scopeId: 'fixture-rebase-pkg',
      },
    ],
    prerequisites: [
      {
        sourceCanonicalId: 'node-a',
        targetCanonicalId: 'node-b',
        strength: 'REQUIRED',
        scopeId: 'fixture-rebase-pkg',
      },
    ],
    coreNodes: [
      {
        canonicalId: 'node-a',
        pathEligible: true,
        cardPolicy: 'optional',
        scopeId: 'fixture-rebase-pkg',
      },
    ],
    cards: [
      {
        cardId: 'card-a',
        canonicalId: 'node-a',
        active: true,
        required: false,
      },
    ],
    ...overrides,
  });
}

function emptyDetails(): ActReleaseSetDeltaDetailsView {
  return {
    objects: {
      added: [],
      removed: [],
      payloadChanged: [],
      typeChanged: [],
      superseded: [],
    },
    relations: {
      added: [],
      removed: [],
      predicateChanged: [],
      directionChanged: [],
      tierChanged: [],
      endpointChanged: [],
    },
  };
}

describe('Delta inventory → ACT change events (#1272)', () => {
  it('maps unbound additions without synthesizing teaching review', () => {
    const details = emptyDetails();
    details.objects.added = ['node-new', 'node-other'];
    const events = inventoryDeltaDetailsForAct(details);
    expect(events.every((e) => e.category === 'ADDED')).toBe(true);
    expect(events.map((e) => e.identity).sort()).toEqual(['node-new', 'node-other']);
  });

  it('classifies label/alias, metadata, type, successor, split, merge, no-successor', () => {
    const details = emptyDetails();
    details.objects.payloadChanged = ['node-a', 'node-label'];
    details.objects.typeChanged = ['node-typed'];
    details.objects.superseded = [
      { from: 'node-old', to: 'node-new' },
      { from: 'node-split', to: 'part-1' },
      { from: 'node-split', to: 'part-2' },
      { from: 'merge-a', to: 'merged' },
      { from: 'merge-b', to: 'merged' },
    ];
    details.objects.removed = ['node-gone', 'node-old', 'node-split', 'merge-a', 'merge-b'];

    const events = inventoryDeltaDetailsForAct(details, {
      labelAliasOnlyIds: ['node-label'],
      baseTypes: { 'node-old': 'Concept', 'node-typed': 'Concept' },
      candidateTypes: { 'node-new': 'Concept', 'node-typed': 'Predicate' },
    });

    const byCat = (c: string) => events.filter((e) => e.category === c);
    expect(byCat('LABEL_ALIAS_CHANGED').map((e) => e.identity)).toEqual(['node-label']);
    expect(byCat('METADATA_CHANGED').map((e) => e.identity)).toEqual(['node-a']);
    expect(byCat('TYPE_CHANGED').map((e) => e.identity)).toEqual(['node-typed']);
    expect(byCat('REPLACED_BY')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          identity: 'node-old',
          successors: ['node-new'],
        }),
      ]),
    );
    expect(byCat('SPLIT')[0]).toMatchObject({
      identity: 'node-split',
      successors: ['part-1', 'part-2'],
    });
    expect(byCat('MERGED').map((e) => e.identity).sort()).toEqual(['merge-a', 'merge-b']);
    expect(byCat('REMOVED_WITHOUT_SUCCESSOR').map((e) => e.identity)).toEqual(['node-gone']);
  });

  it('maps relation add/change/retire as generic engineering signals', () => {
    const details = emptyDetails();
    details.relations.added = ['rel-1'];
    details.relations.removed = ['rel-2'];
    details.relations.predicateChanged = ['rel-3'];
    const events = inventoryDeltaDetailsForAct(details);
    expect(events.map((e) => e.category).sort()).toEqual([
      'RELATION_ADDED',
      'RELATION_CHANGED',
      'RELATION_RETIRED',
    ]);
  });

  it('accepts explicit source-anchor / source-document fixtures', () => {
    const events = inventoryDeltaDetailsForAct(emptyDetails(), {
      sourceChanges: [
        actDeltaChange({
          category: 'SOURCE_ANCHOR_CHANGED',
          identity: 'dorf-ch1-s2',
          sourceDocumentId: 'dorf-ch1',
          sectionId: 'dorf-ch1-s2',
        }),
        actDeltaChange({
          category: 'SOURCE_DOCUMENT_CHANGED',
          identity: 'dorf-ch1',
          sourceDocumentId: 'dorf-ch1',
        }),
      ],
    });
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.category).sort()).toEqual([
      'SOURCE_ANCHOR_CHANGED',
      'SOURCE_DOCUMENT_CHANGED',
    ]);
  });

  it('rejects non-ACCEPTED delta fail-closed', () => {
    expect(() => inventoryReleaseSetDeltaForAct({
      authorizationState: 'REJECTED_IDENTITY',
      details: emptyDetails(),
    })).toThrow(TeachingProjectionRebaseError);
  });

  it('classifySupersessionTopology is deterministic', () => {
    const a = classifySupersessionTopology([
      { from: 'x', to: 'y' },
      { from: 's', to: 's1' },
      { from: 's', to: 's2' },
      { from: 'm1', to: 'm' },
      { from: 'm2', to: 'm' },
    ]);
    const b = classifySupersessionTopology([
      { from: 'm2', to: 'm' },
      { from: 's', to: 's2' },
      { from: 'x', to: 'y' },
      { from: 'm1', to: 'm' },
      { from: 's', to: 's1' },
    ]);
    expect(a).toEqual(b);
  });
});

describe('Impact set calculator (#1272)', () => {
  const prior = buildTeachingProjection(boundProjectionAuthoring());

  it('zero teaching review for unbound additions', () => {
    const impact = calculateImpactOnly({
      artifacts: prior,
      changes: [actDeltaChange({ category: 'ADDED', identity: 'node-new' })],
      authorityReleaseId: 'ctr:release:eng-v2',
      baseAuthorityReleaseId: 'ctr:release:eng-v1',
    });
    expect(impact.summary.unboundAdditionCount).toBe(1);
    expect(impact.summary.teachingReviewItemCount).toBe(0);
    expect(impact.summary.reviewRequiredCount).toBe(0);
    expect(impact.items.every((i) => i.disposition === 'NO_REVIEW')).toBe(true);
  });

  it('label/alias rebuilds indexes without binding identity change', () => {
    const impact = calculateImpactOnly({
      artifacts: prior,
      changes: [actDeltaChange({
        category: 'LABEL_ALIAS_CHANGED',
        identity: 'node-a',
        labelAliasOnly: true,
      })],
      authorityReleaseId: 'ctr:release:eng-v2',
    });
    expect(impact.summary.indexRebuildCount).toBeGreaterThan(0);
    expect(impact.items.some((i) =>
      i.subjectKind === 'binding' && i.disposition === 'INDEX_REBUILD')).toBe(false);
    // Bindings are not re-authored; only authority-node / resource index rebuild rows.
    expect(impact.items.every((i) =>
      i.disposition === 'INDEX_REBUILD' || i.disposition === 'NO_REVIEW')).toBe(true);
  });

  it('bound metadata expands only direct dependents', () => {
    const impact = calculateImpactOnly({
      artifacts: prior,
      changes: [actDeltaChange({
        category: 'METADATA_CHANGED',
        identity: 'node-a',
      })],
      authorityReleaseId: 'ctr:release:eng-v2',
    });
    const subjectKinds = new Set(impact.items.map((i) => i.subjectKind));
    expect(subjectKinds.has('binding')).toBe(true);
    expect(subjectKinds.has('card')).toBe(true);
    expect(subjectKinds.has('prerequisite')).toBe(true);
    // node-b textbook binding must not appear solely from node-a metadata.
    expect(impact.items.some((i) =>
      i.subjectKind === 'binding' && i.subjectId.includes('node-b'))).toBe(false);
  });

  it('single compatible successor marks ordinary bindings AUTO_REBASE and cards LOCAL_CHECK', () => {
    const impact = calculateImpactOnly({
      artifacts: prior,
      changes: [
        actDeltaChange({
          category: 'REPLACED_BY',
          identity: 'node-a',
          successors: ['node-a2'],
          predecessors: ['node-a'],
          baseType: 'Concept',
          candidateType: 'Concept',
        }),
        actDeltaChange({
          category: 'DEPRECATED',
          identity: 'node-a',
          successors: ['node-a2'],
          baseType: 'Concept',
          candidateType: 'Concept',
        }),
      ],
      authorityReleaseId: 'ctr:release:eng-v2',
    });
    const bindings = impact.items.filter((i) => i.subjectKind === 'binding');
    expect(bindings.some((i) => i.disposition === 'AUTO_REBASE_CANDIDATE')).toBe(true);
    expect(impact.items.some((i) =>
      i.subjectKind === 'card' && i.disposition === 'LOCAL_CHECK')).toBe(true);
    expect(impact.items.some((i) =>
      i.subjectKind === 'prerequisite' && i.disposition === 'LOCAL_CHECK')).toBe(true);
  });

  it('split / merge / no-successor become REVIEW_REQUIRED for affected package only', () => {
    for (const change of [
      actDeltaChange({
        category: 'SPLIT',
        identity: 'node-a',
        successors: ['p1', 'p2'],
        predecessors: ['node-a'],
      }),
      actDeltaChange({
        category: 'MERGED',
        identity: 'node-a',
        successors: ['merged'],
        predecessors: ['node-a', 'other'],
      }),
      actDeltaChange({
        category: 'REMOVED_WITHOUT_SUCCESSOR',
        identity: 'node-a',
        predecessors: ['node-a'],
      }),
    ] as ActDeltaChangeEvent[]) {
      const impact = calculateImpactOnly({
        artifacts: prior,
        changes: [change],
        authorityReleaseId: 'ctr:release:eng-v2',
        packageId: 'fixture-rebase-pkg',
      });
      expect(impact.summary.reviewRequiredCount).toBeGreaterThan(0);
      expect(impact.items.every((i) => i.packageId === 'fixture-rebase-pkg')).toBe(true);
      expect(impact.items
        .filter((i) => i.subjectKind === 'binding' || i.subjectKind === 'card')
        .every((i) => i.disposition === 'REVIEW_REQUIRED')).toBe(true);
    }
  });

  it('type-incompatible successor is REVIEW_REQUIRED not auto-rebase', () => {
    const impact = calculateImpactOnly({
      artifacts: prior,
      changes: [actDeltaChange({
        category: 'REPLACED_BY',
        identity: 'node-a',
        successors: ['node-a2'],
        baseType: 'Concept',
        candidateType: 'Relation',
      })],
      authorityReleaseId: 'ctr:release:eng-v2',
    });
    expect(impact.items.some((i) =>
      i.subjectKind === 'binding' && i.disposition === 'AUTO_REBASE_CANDIDATE')).toBe(false);
    expect(impact.items.some((i) =>
      i.subjectKind === 'binding' && i.disposition === 'REVIEW_REQUIRED')).toBe(true);
  });

  it('unbound engineering relations are ENGINEERING_ONLY', () => {
    const impact = calculateImpactOnly({
      artifacts: prior,
      changes: [actDeltaChange({
        category: 'RELATION_ADDED',
        identity: 'rel-new',
        relationSourceId: 'eng-x',
        relationTargetId: 'eng-y',
      })],
      authorityReleaseId: 'ctr:release:eng-v2',
    });
    expect(impact.summary.engineeringOnlyCount).toBe(1);
    expect(impact.summary.teachingReviewItemCount).toBe(0);
  });

  it('source-anchor changes affect matching textbook locators only', () => {
    const impact = calculateImpactOnly({
      artifacts: prior,
      changes: [actDeltaChange({
        category: 'SOURCE_ANCHOR_CHANGED',
        identity: 'dorf-ch1-s2',
        sourceDocumentId: 'dorf-ch1',
        sectionId: 'dorf-ch1-s2',
      })],
      authorityReleaseId: 'ctr:release:eng-v2',
    });
    expect(impact.items.some((i) =>
      i.subjectKind === 'textbook-locator'
      && i.subjectId === 'act:textbook-section:dorf-ch1-s2')).toBe(true);
    // Step binding must not be pulled in by textbook anchor change.
    expect(impact.items.some((i) =>
      i.subjectKind === 'binding'
      && i.subjectId.includes('practice-1'))).toBe(false);
  });

  it('impact calculation is byte-deterministic', () => {
    const changes = [actDeltaChange({
      category: 'REPLACED_BY',
      identity: 'node-a',
      successors: ['node-a2'],
      baseType: 'Concept',
      candidateType: 'Concept',
    })];
    const a = calculateImpactOnly({
      artifacts: prior,
      changes,
      authorityReleaseId: 'ctr:release:eng-v2',
      deltaOutputDigest: 'd'.repeat(64),
    });
    const b = calculateImpactOnly({
      artifacts: prior,
      changes,
      authorityReleaseId: 'ctr:release:eng-v2',
      deltaOutputDigest: 'd'.repeat(64),
    });
    expect(projectionDigest(a)).toBe(projectionDigest(b));
  });
});

describe('Rebase decisions (#1272)', () => {
  const prior = buildTeachingProjection(boundProjectionAuthoring());

  it('auto-rebases single successor bindings with auditable decision', () => {
    const impact = calculateImpactOnly({
      artifacts: prior,
      changes: [actDeltaChange({
        category: 'REPLACED_BY',
        identity: 'node-a',
        successors: ['node-a2'],
        baseType: 'Concept',
        candidateType: 'Concept',
      })],
      authorityReleaseId: 'ctr:release:eng-v2',
      deltaOutputDigest: 'e'.repeat(64),
    });
    const { decisions, autoRebasedSubjectIds, unresolved } = resolveRebaseDecisions({ impact });
    expect(autoRebasedSubjectIds.length).toBeGreaterThan(0);
    expect(decisions.some((d) =>
      d.kind === 'AUTO_REBASE'
      && d.successorCanonicalId === 'node-a2'
      && d.compatibilityRule === 'single-type-compatible-successor')).toBe(true);
    expect(unresolved.some((u) => u.subjectKind === 'card')).toBe(true);
  });

  it('reuses author decisions and fails closed on delta drift', () => {
    const impact = calculateImpactOnly({
      artifacts: prior,
      changes: [actDeltaChange({
        category: 'SPLIT',
        identity: 'node-a',
        successors: ['p1', 'p2'],
      })],
      authorityReleaseId: 'ctr:release:eng-v2',
      deltaOutputDigest: 'f'.repeat(64),
    });
    const cardItem = impact.items.find((i) => i.subjectKind === 'card')!;
    const author = buildRebaseDecision({
      kind: 'AUTHOR_DECISION',
      subjectKind: 'card',
      subjectId: cardItem.subjectId,
      packageId: impact.packageId,
      sourceCanonicalId: 'node-a',
      successorCanonicalId: 'p1',
      category: 'SPLIT',
      compatibilityRule: 'author-chose-part',
      deltaIdentity: cardItem.deltaIdentity,
      deltaOutputDigest: 'f'.repeat(64),
      authorityReleaseId: 'ctr:release:eng-v2',
      reason: 'author selected part-1 after split',
    });

    const ok = resolveRebaseDecisions({ impact, authorDecisions: [author] });
    expect(ok.decisions.some((d) => d.decisionId === author.decisionId)).toBe(true);

    expect(() => resolveRebaseDecisions({
      impact: { ...impact, deltaOutputDigest: '0'.repeat(64) },
      authorDecisions: [author],
    })).toThrow(/delta digest drifted|decision-delta-drift/i);
  });

  it('fails closed when author decision body is tampered', () => {
    const author = buildRebaseDecision({
      kind: 'AUTHOR_DECISION',
      subjectKind: 'card',
      subjectId: 'card-a',
      packageId: 'fixture-rebase-pkg',
      sourceCanonicalId: 'node-a',
      successorCanonicalId: 'p1',
      category: 'SPLIT',
      compatibilityRule: null,
      deltaIdentity: 'object:split:node-a',
      deltaOutputDigest: 'f'.repeat(64),
      authorityReleaseId: 'ctr:release:eng-v2',
      reason: 'ok',
    });
    const tampered = { ...author, reason: 'tampered', decisionBodyDigest: author.decisionBodyDigest };
    const impact = calculateImpactOnly({
      artifacts: prior,
      changes: [actDeltaChange({
        category: 'SPLIT',
        identity: 'node-a',
        successors: ['p1', 'p2'],
      })],
      authorityReleaseId: 'ctr:release:eng-v2',
      deltaOutputDigest: 'f'.repeat(64),
    });
    expect(() => resolveRebaseDecisions({
      impact,
      authorDecisions: [tampered],
    })).toThrow(/body digest|decision-body-drift/i);
  });

  it('applyCanonicalRewrites rewrites binding endpoints from decisions', () => {
    const decision = buildRebaseDecision({
      kind: 'AUTO_REBASE',
      subjectKind: 'binding',
      subjectId: 'any',
      packageId: 'pkg',
      sourceCanonicalId: 'node-a',
      successorCanonicalId: 'node-a2',
      category: 'REPLACED_BY',
      compatibilityRule: 'single-type-compatible-successor',
      deltaIdentity: 'd',
      deltaOutputDigest: 'e'.repeat(64),
      authorityReleaseId: 'ctr:release:eng-v2',
      reason: 'test',
    });
    const rows = applyCanonicalRewrites(
      [{ canonicalId: 'node-a', bindingId: 'b1' }, { canonicalId: 'node-b', bindingId: 'b2' }],
      [decision],
      (r) => r.bindingId,
    );
    expect(rows[0]!.canonicalId).toBe('node-a2');
    expect(rows[1]!.canonicalId).toBe('node-b');
  });
});

describe('Complete projection rebuild (#1272)', () => {
  it('rebuilds complete projection; unaffected digests carry forward; prior remains readable', () => {
    const paths = tempProjectionRoot();
    const authoring = boundProjectionAuthoring();
    const stagedPrior = stageTeachingProjection(paths, authoring);
    activateTeachingProjection(paths, {
      projectionId: stagedPrior.projectionId,
      activatedAt: '2026-08-03T00:00:00.000Z',
    });
    const priorPointer = readCurrentTeachingProjectionPointer(paths);

    const priorArtifacts = stagedPrior.artifacts;
    const changes = [
      actDeltaChange({
        category: 'ADDED',
        identity: 'node-new',
      }),
      actDeltaChange({
        category: 'REPLACED_BY',
        identity: 'node-a',
        successors: ['node-a2'],
        predecessors: ['node-a'],
        baseType: 'Concept',
        candidateType: 'Concept',
      }),
      actDeltaChange({
        category: 'DEPRECATED',
        identity: 'node-a',
        successors: ['node-a2'],
        baseType: 'Concept',
        candidateType: 'Concept',
      }),
    ];

    // Resolve card/prereq local checks with author decisions so gate can pass.
    const impactPreview = calculateImpactOnly({
      artifacts: priorArtifacts,
      changes,
      authorityReleaseId: 'ctr:release:eng-v2',
      deltaOutputDigest: 'a'.repeat(64),
    });
    const authorDecisions = impactPreview.items
      .filter((i) => i.disposition === 'LOCAL_CHECK' || (
        i.disposition === 'REVIEW_REQUIRED' && i.subjectKind === 'prerequisite'
      ))
      .map((i) => buildRebaseDecision({
        kind: 'AUTHOR_DECISION',
        subjectKind: i.subjectKind,
        subjectId: i.subjectId,
        packageId: i.packageId,
        sourceCanonicalId: i.canonicalId,
        successorCanonicalId: 'node-a2',
        category: i.category,
        compatibilityRule: 'author-follow-successor',
        deltaIdentity: i.deltaIdentity,
        deltaOutputDigest: 'a'.repeat(64),
        authorityReleaseId: 'ctr:release:eng-v2',
        reason: 'author accepts successor for local check',
      }));

    const rebase = rebaseTeachingProjection({
      priorArtifacts,
      priorAuthoring: authoring,
      changes,
      targetAuthority: {
        authorityReleaseId: 'ctr:release:eng-v2',
        authorityReleaseSetId: 'set-2',
        authoritySnapshotHash: hashB,
        authorityNodes: successorAuthorityNodes(),
      },
      authoringRevision: commitB,
      authorDecisions,
      deltaOutputDigest: 'a'.repeat(64),
      baseAuthorityReleaseId: 'ctr:release:eng-v1',
    });

    expect(rebase.report.rebuildCompleted).toBe(true);
    expect(rebase.artifacts).not.toBeNull();
    expect(rebase.report.newProjectionHash).not.toBe(rebase.report.priorProjectionHash);
    expect(rebase.report.rollback.ready).toBe(true);
    expect(rebase.report.rollback.projectionId).toBe(stagedPrior.projectionId);

    // Unaffected textbook binding (node-b) should appear in carried-forward when digest-stable.
    const carried = rebase.report.carriedForward;
    expect(carried.length).toBeGreaterThan(0);
    // At least one carried-forward entry remains unchanged.
    expect(carried.some((c) => c.unchanged)).toBe(true);

    // Binding moved to successor.
    expect(rebase.artifacts!.bindings.some((b) =>
      b.resourceId === 'act:step:lesson-02:practice-1' && b.canonicalId === 'node-a2')).toBe(true);
    expect(rebase.artifacts!.bindings.some((b) =>
      b.canonicalId === 'node-a')).toBe(false);

    const staged = stageRebasedTeachingProjection(paths, rebase);
    expect(staged.currentPointerUnchanged).toBe(true);
    expect(staged.priorStillReadable).toBe(true);
    expect(readCurrentTeachingProjectionPointer(paths)).toEqual(priorPointer);

    // Prior release still loads.
    const priorLoaded = loadStagedTeachingProjection(paths, stagedPrior.projectionId);
    expect(priorLoaded.projectionHash).toBe(stagedPrior.projectionHash);

    // New release is staged immutably under its own projectionId.
    expect(staged.staged).not.toBeNull();
    expect(staged.staged!.projectionId).not.toBe(stagedPrior.projectionId);
    const newLoaded = loadStagedTeachingProjection(paths, staged.staged!.projectionId);
    expect(newLoaded.projectionHash).toBe(rebase.report.newProjectionHash);
  });

  it('repeated identical rebase runs are byte-identical', () => {
    const authoring = boundProjectionAuthoring();
    const prior = buildTeachingProjection(authoring);
    const changes = [
      actDeltaChange({ category: 'ADDED', identity: 'node-new' }),
      actDeltaChange({
        category: 'LABEL_ALIAS_CHANGED',
        identity: 'node-b',
        labelAliasOnly: true,
      }),
    ];
    const input = {
      priorArtifacts: prior,
      priorAuthoring: authoring,
      changes,
      targetAuthority: {
        authorityReleaseId: 'ctr:release:eng-v2',
        authoritySnapshotHash: hashB,
        authorityNodes: [
          ...baseAuthorityNodes(),
          { canonicalId: 'node-new', lifecycleStatus: 'active', successorCanonicalId: null },
        ],
      },
      authoringRevision: commitB,
      deltaOutputDigest: 'b'.repeat(64),
    };
    const a = rebaseTeachingProjection(input);
    const b = rebaseTeachingProjection(input);
    expect(projectionDigest(a.report.impact)).toBe(projectionDigest(b.report.impact));
    expect(projectionDigest(a.report.decisions)).toBe(projectionDigest(b.report.decisions));
    expect(a.report.newProjectionHash).toBe(b.report.newProjectionHash);
    expect(projectionDigest(a.artifacts!.manifest)).toBe(projectionDigest(b.artifacts!.manifest));
  });

  it('split without author decision leaves REVIEW_REQUIRED and does not activate', () => {
    const paths = tempProjectionRoot();
    const authoring = boundProjectionAuthoring();
    const stagedPrior = stageTeachingProjection(paths, authoring);
    activateTeachingProjection(paths, {
      projectionId: stagedPrior.projectionId,
      activatedAt: '2026-08-03T00:00:00.000Z',
    });

    const rebase = rebaseTeachingProjection({
      priorArtifacts: stagedPrior.artifacts,
      priorAuthoring: authoring,
      changes: [actDeltaChange({
        category: 'SPLIT',
        identity: 'node-a',
        successors: ['p1', 'p2'],
        predecessors: ['node-a'],
      })],
      targetAuthority: {
        authorityReleaseId: 'ctr:release:eng-v2',
        authoritySnapshotHash: hashB,
        authorityNodes: [
          { canonicalId: 'node-a', lifecycleStatus: 'retired', successorCanonicalId: null },
          { canonicalId: 'p1', lifecycleStatus: 'active', successorCanonicalId: null },
          { canonicalId: 'p2', lifecycleStatus: 'active', successorCanonicalId: null },
          { canonicalId: 'node-b', lifecycleStatus: 'active', successorCanonicalId: null },
          { canonicalId: 'node-unrelated', lifecycleStatus: 'active', successorCanonicalId: null },
        ],
      },
      authoringRevision: commitB,
      deltaOutputDigest: 'c'.repeat(64),
    });

    expect(rebase.report.unresolvedReviewRequired.length).toBeGreaterThan(0);
    expect(rebase.report.gatePassed).toBe(false);

    const staged = stageRebasedTeachingProjection(paths, rebase);
    // Staged for review but current pointer untouched.
    expect(staged.currentPointerUnchanged).toBe(true);
    expect(readCurrentTeachingProjectionPointer(paths)?.projectionId)
      .toBe(stagedPrior.projectionId);

    // Attempting to activate the review-required rebuild fails closed.
    if (staged.staged) {
      const activation = activateTeachingProjection(paths, {
        projectionId: staged.staged.projectionId,
      });
      expect(activation.status).toBe('failed');
    }
  });

  it('does not patch prior runtime directory contents', () => {
    const paths = tempProjectionRoot();
    const authoring = boundProjectionAuthoring();
    const stagedPrior = stageTeachingProjection(paths, authoring);
    const before = loadStagedTeachingProjection(paths, stagedPrior.projectionId);

    const rebase = rebaseTeachingProjection({
      priorArtifacts: stagedPrior.artifacts,
      priorAuthoring: authoring,
      changes: [actDeltaChange({ category: 'ADDED', identity: 'node-new' })],
      targetAuthority: {
        authorityReleaseId: 'ctr:release:eng-v2',
        authoritySnapshotHash: hashB,
        authorityNodes: [
          ...baseAuthorityNodes(),
          { canonicalId: 'node-new', lifecycleStatus: 'active', successorCanonicalId: null },
        ],
      },
      authoringRevision: commitB,
      deltaOutputDigest: 'd'.repeat(64),
    });
    stageRebasedTeachingProjection(paths, rebase);

    const after = loadStagedTeachingProjection(paths, stagedPrior.projectionId);
    expect(after.projectionHash).toBe(before.projectionHash);
    expect(projectionDigest(after.artifacts)).toBe(projectionDigest(before.artifacts));
  });
});

describe('End-to-end inventory → impact → decisions (#1272)', () => {
  it('consumes ReleaseSet Delta details without changing Delta authority', () => {
    const prior = buildTeachingProjection(boundProjectionAuthoring());
    const details = emptyDetails();
    details.objects.added = ['node-new'];
    details.objects.superseded = [{ from: 'node-a', to: 'node-a2' }];
    details.objects.removed = ['node-a'];
    details.relations.added = ['rel-eng'];

    const events = inventoryReleaseSetDeltaForAct({
      authorizationState: 'ACCEPTED',
      details,
      outputDigest: 'z'.repeat(64),
    }, {
      baseTypes: { 'node-a': 'Concept' },
      candidateTypes: { 'node-a2': 'Concept' },
    });

    const impact = computeActTeachingProjectionImpactSet({
      changes: events,
      projection: {
        resources: prior.resources,
        bindings: prior.bindings,
        prerequisites: prior.prerequisites,
        coreNodes: prior.coreNodes,
        cards: prior.cardsIndex.cards,
        projectionId: prior.manifest.projectionId,
        scopeId: prior.manifest.scopeId,
      },
      authorityReleaseId: 'ctr:release:eng-v2',
      baseAuthorityReleaseId: 'ctr:release:eng-v1',
      deltaOutputDigest: 'z'.repeat(64),
    });

    expect(impact.summary.unboundAdditionCount).toBeGreaterThanOrEqual(1);
    expect(impact.summary.autoRebaseCandidateCount).toBeGreaterThan(0);
    expect(impact.summary.engineeringOnlyCount).toBeGreaterThanOrEqual(1);
    // Digest helper remains stable.
    expect(digestActDeltaChangeEvents(events)).toMatch(/^[a-f0-9]{64}$/);
  });
});
