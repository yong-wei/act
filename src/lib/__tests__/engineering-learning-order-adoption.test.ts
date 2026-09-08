/**
 * Engineering learning-order adoption (#2059).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  adoptEngineeringLearningOrder,
  applyEngineeringLearningOrderToBuildInput,
  buildPrerequisitePublication,
  canAutoPublishFromCandidate,
  candidatesFromEngineeringRelations,
  createPrerequisiteAuthorDecision,
  isEngineeringLearningOrderPredicate,
  type CoreNodeAuthoringRow,
} from '../teaching-projection';

const SCOPE = 'act-control-theory-core';
const AUTHORITY = 'ctr:release:eng-fixture-v1';
const SNAPSHOT = 'b'.repeat(64);
const REVISION = 'a'.repeat(40);
const FIXTURE_ROOT = path.resolve(
  process.cwd(),
  'course-content/authoring/knowledge/teaching-projection/prerequisites',
);

function teachingDecision(edge: {
  sourceNodeId: string;
  targetNodeId: string;
  strength: 'REQUIRED' | 'RECOMMENDED';
  evidenceRefs: string[];
}) {
  return createPrerequisiteAuthorDecision({
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    strength: edge.strength,
    scopeId: SCOPE,
    evidenceRefs: edge.evidenceRefs,
    curatorRationale: null,
    curatorId: 'teacher.core-path',
    rationale: 'teaching evidence',
    authorityReleaseId: AUTHORITY,
    projectionCaptureId: 'proj-capture-1',
    authoringRevision: REVISION,
  });
}

describe('engineering learning-order adoption (#2059)', () => {
  it('puts minted prerequisite through the post-requisite adoption channel', () => {
    expect(isEngineeringLearningOrderPredicate('prerequisite')).toBe(true);
    expect(isEngineeringLearningOrderPredicate('provides_foundation')).toBe(true);
    expect(isEngineeringLearningOrderPredicate('association')).toBe(false);
    expect(isEngineeringLearningOrderPredicate('derived_from')).toBe(false);
  });

  it('generates 79 ENGINEERING candidates from the r6 prerequisite fixture', () => {
    const fixture = JSON.parse(
      readFileSync(path.join(FIXTURE_ROOT, 'fixtures/r6-prerequisite-edges.json'), 'utf8'),
    ) as {
      relations: { id: string; sourceId: string; targetId: string; predicate: string }[];
    };
    expect(fixture.relations).toHaveLength(79);
    const candidates = candidatesFromEngineeringRelations(
      fixture.relations.map((rel) => ({ ...rel, scopeId: SCOPE })),
    );
    expect(candidates).toHaveLength(79);
    expect(new Set(candidates.map((c) => c.origin))).toEqual(new Set(['ENGINEERING_RELATION']));
    expect(candidates.every((c) => c.publishable === false)).toBe(true);
    expect(candidates.every((c) => canAutoPublishFromCandidate(c) === false)).toBe(true);
    expect(candidates.every((c) => c.note?.includes('eligible for ACT teaching adoption'))).toBe(true);
  });

  it('adopts when both endpoints are current authority and core, else keeps a candidate', () => {
    const adopted = adoptEngineeringLearningOrder({
      relations: [
        {
          id: 'ctkg:m4-u2u5:prerequisite:keep',
          sourceId: 'node.laplace-transform',
          targetId: 'node.transfer-function',
          predicate: 'prerequisite',
        },
        {
          id: 'ctkg:m4-u2u5:prerequisite:outside',
          sourceId: 'node.upstream-only',
          targetId: 'node.feedback-control',
          predicate: 'prerequisite',
        },
      ],
      teachingEdges: [],
      coreNodeIds: new Set(['node.laplace-transform', 'node.transfer-function']),
      authorityIds: new Set([
        'node.laplace-transform',
        'node.transfer-function',
        'node.upstream-only',
        'node.feedback-control',
      ]),
      scopeId: SCOPE,
      authorityReleaseId: AUTHORITY,
      projectionCaptureId: 'proj-capture-1',
      authoringRevision: REVISION,
      snapshotHash: SNAPSHOT,
    });

    expect(adopted.receipts.map((r) => r.disposition).sort()).toEqual([
      'adopted',
      'rejected-not-core',
    ]);
    expect(adopted.adoptedEdges).toHaveLength(1);
    expect(adopted.adoptedEdges[0]?.candidateOrigin).toBe('ENGINEERING_RELATION');
    expect(adopted.adoptedEdges[0]?.strength).toBe('REQUIRED');
    expect(adopted.candidates).toHaveLength(1);
    expect(adopted.candidates[0]?.note).toContain('disposition=rejected-not-core');
    expect(adopted.candidates[0]?.note).toContain(`snapshot=${SNAPSHOT}`);
    expect(adopted.receipts.every((r) => r.snapshotHash === SNAPSHOT)).toBe(true);
    expect(adopted.receipts.every((r) => r.authorityReleaseId === AUTHORITY)).toBe(true);
  });

  it('keeps teaching evidence when the engineering order conflicts', () => {
    const teaching = {
      sourceNodeId: 'node.transfer-function',
      targetNodeId: 'node.laplace-transform',
      strength: 'REQUIRED' as const,
      evidenceRefs: ['teaching.md'],
    };
    const adopted = adoptEngineeringLearningOrder({
      relations: [
        {
          id: 'ctkg:m4-u2u5:prerequisite:conflict',
          sourceId: 'node.laplace-transform',
          targetId: 'node.transfer-function',
          predicate: 'prerequisite',
        },
      ],
      teachingEdges: [teaching],
      coreNodeIds: new Set(['node.laplace-transform', 'node.transfer-function']),
      authorityIds: new Set(['node.laplace-transform', 'node.transfer-function']),
      scopeId: SCOPE,
      authorityReleaseId: AUTHORITY,
      projectionCaptureId: 'proj-capture-1',
      authoringRevision: REVISION,
      snapshotHash: SNAPSHOT,
    });
    expect(adopted.adoptedEdges).toHaveLength(0);
    expect(adopted.receipts[0]?.disposition).toBe('exception-teaching-conflict');
    expect(adopted.candidates).toHaveLength(1);
    expect(adopted.candidates[0]?.note).toContain('disposition=exception-teaching-conflict');
    expect(adopted.candidates[0]?.note).toContain(`snapshot=${SNAPSHOT}`);
  });

  it('publishes adopted edges with receipts and keeps association-family candidates unpublished', () => {
    const teaching = {
      sourceNodeId: 'node.laplace-transform',
      targetNodeId: 'node.block-diagram',
      strength: 'RECOMMENDED' as const,
      evidenceRefs: ['teaching.md'],
      scopeId: SCOPE,
      status: 'PUBLISHED' as const,
    };
    const decision = teachingDecision(teaching);
    const coreNodes: CoreNodeAuthoringRow[] = [
      {
        canonicalId: 'node.laplace-transform',
        scopeId: SCOPE,
        pathEligible: true,
        cardPolicy: 'REQUIRED',
        moduleId: 'module-1',
        rationale: 'objective',
        sourceKind: 'OBJECTIVE',
        sourceEvidence: ['obj.md'],
      },
      {
        canonicalId: 'node.transfer-function',
        scopeId: SCOPE,
        pathEligible: true,
        cardPolicy: 'REQUIRED',
        moduleId: 'module-1',
        rationale: 'covers',
        sourceKind: 'PRIMARY_COVERS',
        sourceEvidence: ['cover.md'],
      },
      {
        canonicalId: 'node.block-diagram',
        scopeId: SCOPE,
        pathEligible: true,
        cardPolicy: 'OPTIONAL',
        moduleId: 'module-1',
        rationale: 'endpoint',
        sourceKind: 'PREREQUISITE_ENDPOINT',
        sourceEvidence: ['endpoint.md'],
      },
    ];
    const merged = applyEngineeringLearningOrderToBuildInput({
      scopeId: SCOPE,
      authorityReleaseId: AUTHORITY,
      projectionCaptureId: 'proj-capture-1',
      authoringRevision: REVISION,
      snapshotHash: SNAPSHOT,
      coreNodeIds: coreNodes.map((n) => n.canonicalId),
      authorityIds: coreNodes.map((n) => n.canonicalId),
      teachingEdges: [{ ...teaching, authorDecisionId: decision.decisionId }],
      teachingDecisions: [decision],
      relations: [
        {
          id: 'ctkg:m4-u2u5:prerequisite:adopt',
          sourceId: 'node.laplace-transform',
          targetId: 'node.transfer-function',
          predicate: 'prerequisite',
        },
        {
          id: 'eng:association:skip',
          sourceId: 'node.block-diagram',
          targetId: 'node.transfer-function',
          predicate: 'association',
        },
      ],
    });

    const artifacts = buildPrerequisitePublication({
      scopeId: SCOPE,
      authoringRevision: REVISION,
      authorityReleaseId: AUTHORITY,
      projectionCaptureId: 'proj-capture-1',
      authorityNodes: coreNodes.map((n) => ({
        canonicalId: n.canonicalId,
        lifecycleStatus: 'active',
      })),
      coreNodes,
      edges: merged.edges,
      decisions: merged.decisions,
      candidates: merged.candidates,
    });

    expect(artifacts.gate.passed).toBe(true);
    const adopted = artifacts.edges.filter((e) => e.candidateOrigin === 'ENGINEERING_RELATION');
    expect(adopted).toHaveLength(1);
    expect(adopted[0]?.status).toBe('PUBLISHED');
    expect(adopted[0]?.layer).toBe('ACT_TEACHING');
    expect(artifacts.candidates).toHaveLength(1);
    expect(artifacts.candidates[0]?.origin).toBe('ENGINEERING_RELATION');
    expect(adopted[0]?.evidenceRefs).toEqual([
      'engineering-relation:ctkg:m4-u2u5:prerequisite:adopt',
    ]);
    expect(artifacts.projectionPrerequisites.some((e) => (
      e.sourceCanonicalId === 'node.laplace-transform'
      && e.targetCanonicalId === 'node.transfer-function'
    ))).toBe(true);

    const tamperedCandidates = artifacts.candidates.map((candidate, index) => (
      index === 0
        ? {
          ...candidate,
          note: `${candidate.note ?? ''} tampered`,
        }
        : candidate
    ));
    const tampered = buildPrerequisitePublication({
      scopeId: SCOPE,
      authoringRevision: REVISION,
      authorityReleaseId: AUTHORITY,
      projectionCaptureId: 'proj-capture-1',
      authorityNodes: coreNodes.map((n) => ({
        canonicalId: n.canonicalId,
        lifecycleStatus: 'active',
      })),
      coreNodes,
      edges: merged.edges,
      decisions: merged.decisions,
      candidates: tamperedCandidates,
    });
    expect(tampered.manifest.publicationHash).not.toBe(artifacts.manifest.publicationHash);
    expect(tampered.manifest.sourceHashes.candidates).not.toBe(
      artifacts.manifest.sourceHashes.candidates,
    );
  });
});
