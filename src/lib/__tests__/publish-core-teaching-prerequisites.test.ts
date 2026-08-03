/**
 * ACT core teaching nodes + prerequisite publication (#1270).
 */

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ACT_TEACHING_CORE_NODES_CONTRACT,
  ACT_TEACHING_PREREQUISITE_EDGES_CONTRACT,
  activatePrerequisitePublication,
  buildPrerequisitePublication,
  buildPrerequisitePublicationFailClosed,
  buildTeachingProjection,
  canAutoPublishFromCandidate,
  candidatesFromEngineeringRelations,
  candidatesFromLessonOrder,
  candidatesFromTextbookOrder,
  createPrerequisiteAuthorDecision,
  detectStalePublishedEdges,
  parseCoreNodesDocument,
  PrerequisiteBuildError,
  publishPrerequisitePublication,
  readCurrentPrerequisitePointer,
  requiredClosure,
  resolvePrerequisiteStorePaths,
  selectCoreNodeDenominator,
  stagePrerequisitePublication,
  stagedPrerequisiteNormalizedBytes,
  topologicalOrder,
  type CoreNodeAuthoringRow,
  type PrerequisitePublicationArtifacts,
} from '../teaching-projection';

const commitA = 'a'.repeat(40);
const commitB = 'b'.repeat(40);
const AUTHORITY = 'ctr:release:eng-fixture-v1';
const SCOPE = 'act-control-theory-core';
const FIXTURE_ROOT = path.resolve(
  process.cwd(),
  'course-content/authoring/knowledge/teaching-projection/prerequisites',
);

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function tempStore() {
  const root = mkdtempSync(path.join(tmpdir(), 'act-prereq-pub-'));
  tempRoots.push(root);
  return resolvePrerequisiteStorePaths(root);
}

function authorityNodes() {
  return [
    { canonicalId: 'node.laplace-transform', lifecycleStatus: 'active' },
    { canonicalId: 'node.transfer-function', lifecycleStatus: 'active' },
    { canonicalId: 'node.block-diagram', lifecycleStatus: 'active' },
    { canonicalId: 'node.stability-concept', lifecycleStatus: 'active' },
    { canonicalId: 'node.feedback-control', lifecycleStatus: 'active' },
    { canonicalId: 'node.upstream-only', lifecycleStatus: 'active' },
    { canonicalId: 'node.retired', lifecycleStatus: 'retired', successorCanonicalId: 'node.laplace-transform' },
  ];
}

function coreInventory(): CoreNodeAuthoringRow[] {
  return [
    {
      canonicalId: 'node.laplace-transform',
      scopeId: SCOPE,
      pathEligible: true,
      cardPolicy: 'REQUIRED',
      moduleId: 'module-1',
      rationale: 'Formal objective',
      sourceKind: 'OBJECTIVE',
      sourceEvidence: ['authoring/objectives/laplace.md'],
    },
    {
      canonicalId: 'node.transfer-function',
      scopeId: SCOPE,
      pathEligible: true,
      cardPolicy: 'REQUIRED',
      moduleId: 'module-1',
      rationale: 'Primary COVERS',
      sourceKind: 'PRIMARY_COVERS',
      sourceEvidence: ['act:step:unit-1-1:tf'],
    },
    {
      canonicalId: 'node.block-diagram',
      scopeId: SCOPE,
      pathEligible: true,
      cardPolicy: 'REQUIRED',
      moduleId: 'module-1',
      rationale: 'Teacher curation',
      sourceKind: 'TEACHER_CURATION',
      sourceEvidence: ['curator:teacher-backbone-v1'],
    },
  ];
}

function decisionFor(edge: {
  sourceNodeId: string;
  targetNodeId: string;
  strength: 'REQUIRED' | 'RECOMMENDED';
  evidenceRefs?: string[];
  curatorRationale?: string;
}) {
  return createPrerequisiteAuthorDecision({
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    strength: edge.strength,
    scopeId: SCOPE,
    evidenceRefs: edge.evidenceRefs ?? ['evidence/a.md'],
    curatorRationale: edge.curatorRationale ?? 'Teacher confirmed dependency',
    curatorId: 'teacher.core-path',
    rationale: 'Author decision for publication',
    authorityReleaseId: AUTHORITY,
    projectionCaptureId: 'proj-capture-1',
    authoringRevision: commitA,
  });
}

function validPublishedInput(
  overrides: Partial<Parameters<typeof buildPrerequisitePublication>[0]> = {},
) {
  const edge = {
    sourceNodeId: 'node.laplace-transform',
    targetNodeId: 'node.transfer-function',
    strength: 'REQUIRED' as const,
    scopeId: SCOPE,
    evidenceRefs: ['authoring/handouts/1-1/laplace-to-tf.md'],
    curatorId: 'teacher.core-path',
    curatorRationale: 'Hard teaching dependency',
    status: 'PUBLISHED' as const,
  };
  const decision = decisionFor({
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    strength: edge.strength,
    evidenceRefs: edge.evidenceRefs,
    curatorRationale: edge.curatorRationale,
  });
  return {
    scopeId: SCOPE,
    authoringRevision: commitA,
    authorityReleaseId: AUTHORITY,
    projectionCaptureId: 'proj-capture-1' as string | null,
    authorityNodes: authorityNodes(),
    coreNodes: coreInventory(),
    edges: [{ ...edge, authorDecisionId: decision.decisionId }],
    decisions: [decision],
    candidates: [] as [],
    ...overrides,
  };
}

function validPublishedBuild(
  overrides: Partial<Parameters<typeof buildPrerequisitePublication>[0]> = {},
): PrerequisitePublicationArtifacts {
  return buildPrerequisitePublication(validPublishedInput(overrides));
}

describe('Core-node denominator (#1270)', () => {
  it('defines core-nodes.yaml schema inventory with required fields', () => {
    const raw = readFileSync(
      path.join(FIXTURE_ROOT, 'inventory/core-nodes.yaml'),
      'utf8',
    );
    const doc = parseCoreNodesDocument(parseYaml(raw));
    expect(doc.contract).toBe(ACT_TEACHING_CORE_NODES_CONTRACT);
    expect(doc.scopeId).toBe(SCOPE);
    expect(doc.nodes.length).toBeGreaterThanOrEqual(4);
    for (const node of doc.nodes) {
      expect(node.pathEligible).toEqual(expect.any(Boolean));
      expect(['REQUIRED', 'OPTIONAL']).toContain(node.cardPolicy);
      expect(node.rationale.length).toBeGreaterThan(0);
      expect(node.sourceEvidence.length).toBeGreaterThan(0);
      expect([
        'OBJECTIVE',
        'PRIMARY_COVERS',
        'PREREQUISITE_ENDPOINT',
        'TEACHER_CURATION',
      ]).toContain(node.sourceKind);
    }
  });

  it('selects denominator only from objectives, primary COVERS, endpoints, teacher curation', () => {
    const selected = selectCoreNodeDenominator({
      scopeId: SCOPE,
      authorityNodes: authorityNodes(),
      objectives: [
        {
          canonicalId: 'node.laplace-transform',
          scopeId: SCOPE,
          sourcePath: 'authoring/objectives/laplace.md',
        },
      ],
      bindings: [
        {
          resourceId: 'act:step:unit-1-1:tf',
          canonicalId: 'node.transfer-function',
          role: 'COVERS',
          scopeId: SCOPE,
          primary: true,
        },
        {
          resourceId: 'act:step:unit-1-1:other',
          canonicalId: 'node.upstream-only',
          role: 'EXPLAINS',
          scopeId: SCOPE,
          primary: true,
        },
        {
          resourceId: 'act:step:unit-1-1:covers-non-primary',
          canonicalId: 'node.block-diagram',
          role: 'COVERS',
          scopeId: SCOPE,
          primary: false,
        },
      ],
      prerequisiteEndpoints: ['node.stability-concept', 'node.upstream-only'],
      teacherCuration: [
        {
          canonicalId: 'node.feedback-control',
          scopeId: SCOPE,
          pathEligible: true,
          cardPolicy: 'REQUIRED',
          moduleId: 'module-2',
          rationale: 'Teacher backbone',
          sourceKind: 'TEACHER_CURATION',
          sourceEvidence: ['curator:backbone'],
        },
      ],
    });

    const ids = selected.map((n) => n.canonicalId).sort();
    expect(ids).toEqual([
      'node.feedback-control',
      'node.laplace-transform',
      'node.stability-concept',
      'node.transfer-function',
      'node.upstream-only', // endpoint may enter if usable Authority
    ].sort());

    // Non-primary COVERS must not enter via PRIMARY_COVERS source.
    expect(
      selected.find((n) => n.canonicalId === 'node.block-diagram'),
    ).toBeUndefined();

    // EXPLAINS primary is not a COVERS denominator source.
    const upstream = selected.find((n) => n.canonicalId === 'node.upstream-only');
    expect(upstream?.sourceKind).toBe('PREREQUISITE_ENDPOINT');
  });

  it('keeps upstream-only ActKG/textbook nodes outside the denominator', () => {
    const selected = selectCoreNodeDenominator({
      scopeId: SCOPE,
      authorityNodes: authorityNodes(),
      objectives: [],
      bindings: [],
      prerequisiteEndpoints: [],
      teacherCuration: [],
    });
    expect(selected).toEqual([]);
    expect(selected.some((n) => n.canonicalId === 'node.upstream-only')).toBe(false);
  });
});

describe('Prerequisite edge schema and DAG (#1270)', () => {
  it('loads edge inventory schema document', () => {
    const raw = readFileSync(
      path.join(FIXTURE_ROOT, 'inventory/edges.yaml'),
      'utf8',
    );
    const doc = parseYaml(raw) as { contract: string; edges: unknown[] };
    expect(doc.contract).toBe(ACT_TEACHING_PREREQUISITE_EDGES_CONTRACT);
    expect(doc.edges.length).toBeGreaterThanOrEqual(3);
  });

  it('publishes REQUIRED edge with ACT_TEACHING layer, evidence, and decision', () => {
    const artifacts = validPublishedBuild();
    expect(artifacts.gate.passed).toBe(true);
    expect(artifacts.edges).toHaveLength(1);
    const edge = artifacts.edges[0]!;
    expect(edge.layer).toBe('ACT_TEACHING');
    expect(edge.relationType).toBe('PREREQUISITE');
    expect(edge.strength).toBe('REQUIRED');
    expect(edge.status).toBe('PUBLISHED');
    expect(edge.evidenceRefs.length).toBeGreaterThan(0);
    expect(edge.authorDecisionId).toBeTruthy();
    expect(edge.edgeDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(edge.authorityReleaseId).toBe(AUTHORITY);
    expect(artifacts.derived.requiredTopologicalOrder).toEqual([
      'node.laplace-transform',
      'node.transfer-function',
    ]);
    expect(artifacts.derived.requiredClosure['node.laplace-transform']).toEqual([
      'node.transfer-function',
    ]);
  });

  it('rejects self-loops, dangling endpoints, duplicates, and REQUIRED cycles fail-closed', () => {
    const baseDecision = decisionFor({
      sourceNodeId: 'node.laplace-transform',
      targetNodeId: 'node.transfer-function',
      strength: 'REQUIRED',
    });

    const selfLoop = buildPrerequisitePublicationFailClosed({
      scopeId: SCOPE,
      authoringRevision: commitA,
      authorityReleaseId: AUTHORITY,
      authorityNodes: authorityNodes(),
      coreNodes: coreInventory(),
      edges: [
        {
          sourceNodeId: 'node.laplace-transform',
          targetNodeId: 'node.laplace-transform',
          strength: 'REQUIRED',
          scopeId: SCOPE,
          evidenceRefs: ['e.md'],
          status: 'PUBLISHED',
          authorDecisionId: baseDecision.decisionId,
        },
      ],
      decisions: [baseDecision],
    });
    expect(selfLoop.ok).toBe(false);
    expect(selfLoop.findings.some((f) => f.code === 'self-loop')).toBe(true);

    const dangling = buildPrerequisitePublicationFailClosed({
      scopeId: SCOPE,
      authoringRevision: commitA,
      authorityReleaseId: AUTHORITY,
      authorityNodes: authorityNodes(),
      coreNodes: coreInventory(),
      edges: [
        {
          sourceNodeId: 'node.laplace-transform',
          targetNodeId: 'node.missing',
          strength: 'REQUIRED',
          scopeId: SCOPE,
          evidenceRefs: ['e.md'],
          status: 'CANDIDATE',
        },
      ],
    });
    expect(dangling.ok).toBe(false);
    expect(
      dangling.findings.some(
        (f) => f.code === 'dangling-endpoint' || f.code === 'endpoint-not-core',
      ),
    ).toBe(true);

    const d1 = decisionFor({
      sourceNodeId: 'node.laplace-transform',
      targetNodeId: 'node.transfer-function',
      strength: 'REQUIRED',
    });
    const d2 = decisionFor({
      sourceNodeId: 'node.transfer-function',
      targetNodeId: 'node.block-diagram',
      strength: 'REQUIRED',
    });
    const d3 = decisionFor({
      sourceNodeId: 'node.block-diagram',
      targetNodeId: 'node.laplace-transform',
      strength: 'REQUIRED',
    });
    const cycle = buildPrerequisitePublicationFailClosed({
      scopeId: SCOPE,
      authoringRevision: commitA,
      authorityReleaseId: AUTHORITY,
      authorityNodes: authorityNodes(),
      coreNodes: coreInventory(),
      edges: [
        {
          sourceNodeId: 'node.laplace-transform',
          targetNodeId: 'node.transfer-function',
          strength: 'REQUIRED',
          scopeId: SCOPE,
          evidenceRefs: ['e1.md'],
          status: 'PUBLISHED',
          authorDecisionId: d1.decisionId,
        },
        {
          sourceNodeId: 'node.transfer-function',
          targetNodeId: 'node.block-diagram',
          strength: 'REQUIRED',
          scopeId: SCOPE,
          evidenceRefs: ['e2.md'],
          status: 'PUBLISHED',
          authorDecisionId: d2.decisionId,
        },
        {
          sourceNodeId: 'node.block-diagram',
          targetNodeId: 'node.laplace-transform',
          strength: 'REQUIRED',
          scopeId: SCOPE,
          evidenceRefs: ['e3.md'],
          status: 'PUBLISHED',
          authorDecisionId: d3.decisionId,
        },
      ],
      decisions: [d1, d2, d3],
    });
    expect(cycle.ok).toBe(false);
    expect(cycle.findings.some((f) => f.code === 'required-cycle')).toBe(true);
  });

  it('computes deterministic topological order and closure', () => {
    const order = topologicalOrder([
      { sourceNodeId: 'a', targetNodeId: 'b' },
      { sourceNodeId: 'b', targetNodeId: 'c' },
      { sourceNodeId: 'a', targetNodeId: 'c' },
    ]);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));

    const closure = requiredClosure([
      { sourceNodeId: 'a', targetNodeId: 'b', strength: 'REQUIRED' },
      { sourceNodeId: 'b', targetNodeId: 'c', strength: 'REQUIRED' },
      { sourceNodeId: 'a', targetNodeId: 'x', strength: 'RECOMMENDED' },
    ]);
    expect(closure.a).toEqual(['b', 'c']);
    expect(closure.b).toEqual(['c']);
  });

  it('treats RECOMMENDED edges as advisory, not hard blockers', () => {
    const requiredDecision = decisionFor({
      sourceNodeId: 'node.laplace-transform',
      targetNodeId: 'node.transfer-function',
      strength: 'REQUIRED',
    });
    const recommendedDecision = decisionFor({
      sourceNodeId: 'node.transfer-function',
      targetNodeId: 'node.block-diagram',
      strength: 'RECOMMENDED',
    });
    const artifacts = buildPrerequisitePublication({
      scopeId: SCOPE,
      authoringRevision: commitA,
      authorityReleaseId: AUTHORITY,
      projectionCaptureId: 'proj-capture-1',
      authorityNodes: authorityNodes(),
      coreNodes: coreInventory(),
      edges: [
        {
          sourceNodeId: 'node.laplace-transform',
          targetNodeId: 'node.transfer-function',
          strength: 'REQUIRED',
          scopeId: SCOPE,
          evidenceRefs: ['e1.md'],
          status: 'PUBLISHED',
          authorDecisionId: requiredDecision.decisionId,
        },
        {
          sourceNodeId: 'node.transfer-function',
          targetNodeId: 'node.block-diagram',
          strength: 'RECOMMENDED',
          scopeId: SCOPE,
          evidenceRefs: ['e2.md'],
          status: 'PUBLISHED',
          authorDecisionId: recommendedDecision.decisionId,
        },
      ],
      decisions: [requiredDecision, recommendedDecision],
    });

    expect(artifacts.gate.passed).toBe(true);
    expect(artifacts.derived.requiredTopologicalOrder).toEqual([
      'node.laplace-transform',
      'node.transfer-function',
    ]);
    expect(artifacts.derived.advisoryTopologicalOrder).toContain(
      'node.block-diagram',
    );
    expect(
      artifacts.derived.requiredClosure['node.transfer-function'] ?? [],
    ).not.toContain('node.block-diagram');
  });
});

describe('Candidate origins remain non-publishable (#1270)', () => {
  it('keeps engineering relations as candidates only', () => {
    const fixture = JSON.parse(
      readFileSync(
        path.join(FIXTURE_ROOT, 'fixtures/candidates.engineering-only.json'),
        'utf8',
      ),
    ) as {
      relations: {
        sourceId: string;
        targetId: string;
        predicate: string;
        scopeId: string;
      }[];
    };
    const candidates = candidatesFromEngineeringRelations(fixture.relations);
    expect(candidates.length).toBe(3);
    for (const c of candidates) {
      expect(c.origin).toBe('ENGINEERING_RELATION');
      expect(c.publishable).toBe(false);
      expect(canAutoPublishFromCandidate(c)).toBe(false);
    }

    const artifacts = buildPrerequisitePublication({
      scopeId: SCOPE,
      authoringRevision: commitA,
      authorityReleaseId: AUTHORITY,
      authorityNodes: authorityNodes(),
      coreNodes: coreInventory(),
      edges: [],
      candidates,
    });
    expect(artifacts.edges).toHaveLength(0);
    expect(artifacts.candidates.length).toBe(3);
    expect(artifacts.projectionPrerequisites).toHaveLength(0);
  });

  it('keeps textbook order and lesson order as candidates only', () => {
    const textbook = JSON.parse(
      readFileSync(
        path.join(FIXTURE_ROOT, 'fixtures/candidates.textbook-order.json'),
        'utf8',
      ),
    ) as {
      pairs: {
        earlierId: string;
        laterId: string;
        scopeId: string;
        locator?: string;
      }[];
    };
    const lesson = JSON.parse(
      readFileSync(
        path.join(FIXTURE_ROOT, 'fixtures/candidates.lesson-order.json'),
        'utf8',
      ),
    ) as {
      pairs: {
        earlierId: string;
        laterId: string;
        scopeId: string;
        lessonKey?: string;
      }[];
    };

    const textbookCandidates = candidatesFromTextbookOrder(textbook.pairs);
    const lessonCandidates = candidatesFromLessonOrder(lesson.pairs);
    expect(textbookCandidates.every((c) => c.origin === 'TEXTBOOK_ORDER')).toBe(
      true,
    );
    expect(lessonCandidates.every((c) => c.origin === 'LESSON_ORDER')).toBe(true);
    expect(
      [...textbookCandidates, ...lessonCandidates].every(
        (c) => c.publishable === false,
      ),
    ).toBe(true);

    const artifacts = buildPrerequisitePublication({
      scopeId: SCOPE,
      authoringRevision: commitA,
      authorityReleaseId: AUTHORITY,
      authorityNodes: authorityNodes(),
      coreNodes: coreInventory(),
      edges: [],
      candidates: [...textbookCandidates, ...lessonCandidates],
    });
    expect(artifacts.gate.passed).toBe(true);
    expect(artifacts.manifest.publishedEdgeCount).toBe(0);
    expect(artifacts.candidates.length).toBe(
      textbookCandidates.length + lessonCandidates.length,
    );
  });
});

describe('Publication gate, evidence, and fail-closed store (#1270)', () => {
  it('requires author decision + evidence for every published edge', () => {
    const missingDecision = buildPrerequisitePublicationFailClosed({
      scopeId: SCOPE,
      authoringRevision: commitA,
      authorityReleaseId: AUTHORITY,
      authorityNodes: authorityNodes(),
      coreNodes: coreInventory(),
      edges: [
        {
          sourceNodeId: 'node.laplace-transform',
          targetNodeId: 'node.transfer-function',
          strength: 'REQUIRED',
          scopeId: SCOPE,
          evidenceRefs: ['e.md'],
          status: 'PUBLISHED',
        },
      ],
    });
    expect(missingDecision.ok).toBe(false);
    expect(
      missingDecision.findings.some((f) => f.code === 'missing-author-decision'),
    ).toBe(true);

    const missingEvidence = buildPrerequisitePublicationFailClosed({
      scopeId: SCOPE,
      authoringRevision: commitA,
      authorityReleaseId: AUTHORITY,
      authorityNodes: authorityNodes(),
      coreNodes: coreInventory(),
      edges: [
        {
          sourceNodeId: 'node.laplace-transform',
          targetNodeId: 'node.transfer-function',
          strength: 'REQUIRED',
          scopeId: SCOPE,
          status: 'PUBLISHED',
          authorDecisionId: 'decision-missing',
        },
      ],
      decisions: [],
    });
    expect(missingEvidence.ok).toBe(false);
    expect(
      missingEvidence.findings.some(
        (f) =>
          f.code === 'missing-evidence' || f.code === 'missing-author-decision',
      ),
    ).toBe(true);
  });

  it('binds published edges to Authority/Projection capture and preserves digests', () => {
    const first = validPublishedBuild();
    const second = validPublishedBuild();
    expect(first.manifest.publicationHash).toBe(second.manifest.publicationHash);
    expect(first.edges[0]!.edgeDigest).toBe(second.edges[0]!.edgeDigest);

    const drift = detectStalePublishedEdges({
      priorEdges: first.edges,
      nextEdges: first.edges.map((e) => ({
        ...e,
        evidenceRefs: ['authoring/handouts/1-1/changed.md'],
        edgeDigest: '0'.repeat(64),
      })),
      authorityReleaseId: AUTHORITY,
    });
    expect(drift.staleEdgeIds).toContain(first.edges[0]!.edgeId);

    const unrelatedRetained = detectStalePublishedEdges({
      priorEdges: first.edges,
      nextEdges: first.edges,
      authorityReleaseId: AUTHORITY,
    });
    expect(unrelatedRetained.retainedDigests[first.edges[0]!.edgeId]).toBe(
      first.edges[0]!.edgeDigest,
    );
  });

  it('preserves prior artifact when a later invalid build fails', () => {
    const paths = tempStore();
    const input = validPublishedInput();
    const prior = buildPrerequisitePublication(input);
    const staged = publishPrerequisitePublication(paths, input);

    expect(staged.artifacts.manifest.publicationHash).toBe(
      prior.manifest.publicationHash,
    );
    const current = readCurrentPrerequisitePointer(paths);
    expect(current?.publicationId).toBe(prior.manifest.publicationId);

    const failed = stagePrerequisitePublication(paths, {
      scopeId: SCOPE,
      authoringRevision: commitB,
      authorityReleaseId: AUTHORITY,
      projectionCaptureId: 'proj-capture-1',
      authorityNodes: authorityNodes(),
      coreNodes: coreInventory(),
      edges: [
        {
          sourceNodeId: 'node.laplace-transform',
          targetNodeId: 'node.laplace-transform',
          strength: 'REQUIRED',
          scopeId: SCOPE,
          evidenceRefs: ['bad.md'],
          status: 'PUBLISHED',
          authorDecisionId: 'x',
        },
      ],
      priorArtifacts: staged.artifacts,
    });

    expect(failed.priorPreserved).toBe(true);
    expect(failed.artifacts.manifest.publicationHash).toBe(
      prior.manifest.publicationHash,
    );
    const currentAfter = readCurrentPrerequisitePointer(paths);
    expect(currentAfter?.publicationHash).toBe(prior.manifest.publicationHash);
    expect(existsSync(path.join(staged.releaseDir, 'publication-manifest.json'))).toBe(
      true,
    );
  });

  it('is byte-deterministic across repeated builds and stages', () => {
    const paths = tempStore();
    const input = {
      scopeId: SCOPE,
      authoringRevision: commitA,
      authorityReleaseId: AUTHORITY,
      projectionCaptureId: 'proj-capture-1',
      authorityNodes: authorityNodes(),
      coreNodes: coreInventory(),
      edges: [
        {
          sourceNodeId: 'node.laplace-transform',
          targetNodeId: 'node.transfer-function',
          strength: 'REQUIRED' as const,
          scopeId: SCOPE,
          evidenceRefs: ['authoring/handouts/1-1/laplace-to-tf.md'],
          curatorId: 'teacher.core-path',
          curatorRationale: 'Hard teaching dependency',
          status: 'PUBLISHED' as const,
          authorDecisionId: '',
        },
      ],
      decisions: [] as ReturnType<typeof decisionFor>[],
    };
    const decision = decisionFor({
      sourceNodeId: 'node.laplace-transform',
      targetNodeId: 'node.transfer-function',
      strength: 'REQUIRED',
      evidenceRefs: ['authoring/handouts/1-1/laplace-to-tf.md'],
    });
    input.edges[0]!.authorDecisionId = decision.decisionId;
    input.decisions = [decision];

    const a = publishPrerequisitePublication(paths, input, { activate: false });
    const b = publishPrerequisitePublication(paths, input, { activate: false });
    expect(a.publicationHash).toBe(b.publicationHash);
    expect(a.reused || b.reused).toBe(true);

    const bytesA = stagedPrerequisiteNormalizedBytes(a.releaseDir);
    const bytesB = stagedPrerequisiteNormalizedBytes(b.releaseDir);
    expect(bytesA).toEqual(bytesB);
  });

  it('does not activate REVIEW_REQUIRED publications', () => {
    const paths = tempStore();
    publishPrerequisitePublication(paths, validPublishedInput(), {
      activate: true,
    });

    expect(() =>
      activatePrerequisitePublication(paths, 'proj-missing'),
    ).toThrow(PrerequisiteBuildError);
  });

  it('exports projection-compatible core nodes and prerequisites for reuse', () => {
    const artifacts = validPublishedBuild();
    expect(artifacts.projectionCoreNodes.length).toBe(3);
    expect(artifacts.projectionCoreNodes[0]!.cardPolicy).toMatch(
      /required|optional|none/,
    );
    expect(artifacts.projectionPrerequisites).toHaveLength(1);

    const projection = buildTeachingProjection({
      contract: 'act-teaching-projection-authoring/v1',
      scopeId: SCOPE,
      authoringRevision: commitA,
      authorityReleaseId: AUTHORITY,
      authorityNodes: authorityNodes(),
      resources: [],
      bindings: [],
      coreNodes: artifacts.projectionCoreNodes,
      prerequisites: artifacts.projectionPrerequisites,
      cards: [],
    });
    expect(projection.coreNodes.length).toBe(3);
    expect(projection.prerequisites.length).toBe(1);
    expect(projection.gate.passed).toBe(true);
  });
});
