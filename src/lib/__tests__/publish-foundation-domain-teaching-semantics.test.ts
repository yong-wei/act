/**
 * Foundation three-domain Teaching Projection increment (#1371).
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildDomainTeachingFragment,
  composeDomainTeachingProjectionFailClosed,
  composeFoundationThreeDomainWithFirstFragment,
  detectDomainRequiredCycles,
  FOUNDATION_THREE_DOMAIN_CORE_NODE_IDS,
  FOUNDATION_THREE_DOMAIN_EVIDENCE,
  FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY,
  FOUNDATION_THREE_DOMAIN_GAIN_ID,
  FOUNDATION_THREE_DOMAIN_SETTLING_TIME_ID,
  FOUNDATION_THREE_DOMAIN_STABILITY_ID,
  FOUNDATION_THREE_DOMAIN_UNIT_STEP_ID,
  foundationThreeDomainArtifactRelatives,
  liveAuthorityEnvelopeForFoundationThreeDomain,
  serializeFoundationThreeDomainJson,
  stripClaimedAuthorityNodeIndex,
  translateAndBuildFirstDomainFragment,
  translateAndBuildFoundationThreeDomainFragment,
  verifyDomainTeachingFragment,
  type DomainTeachingFragment,
  type DomainTeachingFragmentAuthoring,
} from '../teaching-projection';

const REPO_ROOT = process.cwd();
const ARTIFACTS = foundationThreeDomainArtifactRelatives();
const FIRST_FRAGMENT_DIR = path.resolve(
  REPO_ROOT,
  'course-content/authoring/knowledge/teaching-projection/domain-fragments',
);

const FIRST_FRAGMENT_SHA256 = {
  authoring: 'b38ee2a36c39004d78d0bfb3d769b6ca15b2d8d1437d3f97617c687d0c548582',
  fragment: 'a09bd4109efc017674d6334e85eab86e07fe2ce96fc0c7207ffbc7bb1ca22daf',
  composedManifest:
    '08bbf9d1e8b07de21bb2bf2f939c642f7bfcc8ad0f463c2ae13fa416a9d511ff',
} as const;

const RETAINED_FIRST_ENDPOINT_IDS = [
  'ctc:modeling-2088bbde171b2e9ef66070d5',
  'ctc:modeling-865eb1c8824e157c2f05a903',
  'ctc:modeling-e442dacbfef4a0d7ea3c4c15',
  FOUNDATION_THREE_DOMAIN_STABILITY_ID,
  'ctkg:v3e-object-8c4354096b719a1d5e090da4',
] as const;

function sha256File(relativePath: string): string {
  return createHash('sha256')
    .update(readFileSync(path.join(REPO_ROOT, relativePath)))
    .digest('hex');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')) as T;
}

function liveEngineeringRelationsAmong(
  ids: readonly string[],
): Array<{ sourceId: string; targetId: string; relationType: string }> {
  const engineeringPath = path.join(
    REPO_ROOT,
    'course-content/authoring/knowledge/authority/releases/snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7/engineering.json',
  );
  const parsed = JSON.parse(readFileSync(engineeringPath, 'utf8')) as {
    relations?: Array<{
      sourceId?: string;
      targetId?: string;
      relationType?: string;
    }>;
  };
  const idSet = new Set(ids);
  return (parsed.relations ?? []).flatMap((relation) => {
    if (!relation.sourceId || !relation.targetId) return [];
    if (!idSet.has(relation.sourceId) || !idSet.has(relation.targetId)) {
      return [];
    }
    return [
      {
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        relationType: String(relation.relationType ?? ''),
      },
    ];
  });
}

describe('publish-foundation-domain-teaching-semantics', () => {
  const envelope = liveAuthorityEnvelopeForFoundationThreeDomain(REPO_ROOT);
  const built = translateAndBuildFoundationThreeDomainFragment({
    authority: envelope,
    repoRoot: REPO_ROOT,
  });

  it('deduplicates the five retained endpoints and four-node denominator into eight live nodes', () => {
    const secondEnvelope = liveAuthorityEnvelopeForFoundationThreeDomain(REPO_ROOT);
    const envelopeIds = envelope.nodes.map((node) => node.canonicalId);
    const expectedUnion = [...new Set([
      ...RETAINED_FIRST_ENDPOINT_IDS,
      ...FOUNDATION_THREE_DOMAIN_CORE_NODE_IDS,
    ])].sort();

    expect(RETAINED_FIRST_ENDPOINT_IDS).toHaveLength(5);
    expect(envelope.nodes).toHaveLength(8);
    expect(new Set(envelopeIds)).toHaveLength(8);
    expect(envelopeIds).toEqual(expectedUnion);
    expect(envelopeIds.filter((id) => id === FOUNDATION_THREE_DOMAIN_STABILITY_ID))
      .toHaveLength(1);
    expect(secondEnvelope.nodes.map((node) => node.canonicalId)).toEqual(envelopeIds);
    expect(secondEnvelope.nodeIndexDigest).toBe(envelope.nodeIndexDigest);
    expect(secondEnvelope.authorityDigest).toBe(envelope.authorityDigest);
    expect(secondEnvelope.binding).toEqual(envelope.binding);
    expect(secondEnvelope.sourceDatasetHash).toBe(envelope.sourceDatasetHash);
    expect(secondEnvelope.captureRevision).toBe(envelope.captureRevision);
    expect(secondEnvelope.authoringRevision).toBe(envelope.authoringRevision);
  });

  it('fixes the four-node live denominator and records evidence', () => {
    expect(built.worklist.coreNodes.map((node) => node.canonicalId)).toEqual([
      ...FOUNDATION_THREE_DOMAIN_CORE_NODE_IDS,
    ]);
    expect(new Set(built.fragment.coreNodes.map((node) => node.canonicalId))).toEqual(
      new Set(FOUNDATION_THREE_DOMAIN_CORE_NODE_IDS),
    );
    expect(built.fragment.coreNodeCount).toBe(4);
    expect(built.fragment.coreNodes).toHaveLength(4);

    const byId = new Map(
      built.worklist.coreNodes.map((node) => [node.canonicalId, node]),
    );
    expect(byId.get(FOUNDATION_THREE_DOMAIN_GAIN_ID)?.domainKeys).toEqual([
      'system-modeling',
    ]);
    expect(byId.get(FOUNDATION_THREE_DOMAIN_UNIT_STEP_ID)?.domainKeys).toEqual([
      'time-domain-analysis',
    ]);
    expect(byId.get(FOUNDATION_THREE_DOMAIN_STABILITY_ID)?.domainKeys).toEqual([
      'stability-analysis',
    ]);
    expect(byId.get(FOUNDATION_THREE_DOMAIN_SETTLING_TIME_ID)?.domainKeys).toEqual([
      'stability-analysis',
      'time-domain-analysis',
    ]);
    for (const node of built.worklist.coreNodes) {
      expect(node.status).toBe('selected-core');
      expect(node.denominatorReason.length).toBeGreaterThan(0);
      expect(node.sourceEvidence.length).toBeGreaterThan(0);
    }
  });

  it('resolves all four endpoints from the complete live Authority envelope', () => {
    const liveIds = new Set(envelope.nodes.map((node) => node.canonicalId));
    for (const canonicalId of FOUNDATION_THREE_DOMAIN_CORE_NODE_IDS) {
      expect(liveIds.has(canonicalId)).toBe(true);
    }
    expect(built.authoring.nodeIndexDigest).toBe(envelope.nodeIndexDigest);
    expect(built.fragment.authoritySelection.nodeIndexDigest).toBe(
      envelope.nodeIndexDigest,
    );
    expect(built.fragment.authorityBinding).toEqual(envelope.binding);
  });

  it('publishes only the direct REQUIRED step-to-settling edge', () => {
    expect(built.fragment.relationCount).toBe(1);
    expect(built.fragment.relations).toHaveLength(1);
    const [relation] = built.fragment.relations;
    expect(relation?.sourceNodeId).toBe(FOUNDATION_THREE_DOMAIN_UNIT_STEP_ID);
    expect(relation?.targetNodeId).toBe(FOUNDATION_THREE_DOMAIN_SETTLING_TIME_ID);
    expect(relation?.layer).toBe('ACT_TEACHING');
    expect(relation?.relationType).toBe('PREREQUISITE');
    expect(relation?.strength).toBe('REQUIRED');
    expect(relation?.evidenceRefs).toEqual([
      FOUNDATION_THREE_DOMAIN_EVIDENCE.lesson22,
    ]);
    const published = built.worklist.relationCandidates.find(
      (candidate) => candidate.status === 'published',
    );
    expect(published?.directness).toBe('direct');
    expect(published?.evidencePath).toBe(
      FOUNDATION_THREE_DOMAIN_EVIDENCE.lesson22,
    );
  });

  it('keeps the two unresolved candidates unpublished', () => {
    const unresolved = built.worklist.relationCandidates.filter(
      (candidate) => candidate.status === 'unresolved',
    );
    expect(unresolved).toHaveLength(2);
    expect(unresolved.map((candidate) => [
      candidate.sourceNodeId,
      candidate.targetNodeId,
    ])).toEqual([
      [FOUNDATION_THREE_DOMAIN_GAIN_ID, FOUNDATION_THREE_DOMAIN_STABILITY_ID],
      [
        FOUNDATION_THREE_DOMAIN_STABILITY_ID,
        FOUNDATION_THREE_DOMAIN_SETTLING_TIME_ID,
      ],
    ]);
    for (const candidate of unresolved) {
      expect(candidate.directness).toBe('not-direct');
      expect(candidate.unpublishedReason).toMatch(/不得发布 ACT_TEACHING/);
      expect(
        built.fragment.relations.some(
          (relation) =>
            relation.sourceNodeId === candidate.sourceNodeId
            && relation.targetNodeId === candidate.targetNodeId,
        ),
      ).toBe(false);
    }
  });

  it('does not convert engineering predicates into teaching prerequisites', () => {
    const engineeringHits = liveEngineeringRelationsAmong(
      FOUNDATION_THREE_DOMAIN_CORE_NODE_IDS,
    );
    expect(engineeringHits).toEqual([]);
    expect(
      built.fragment.relations.every((relation) => relation.layer === 'ACT_TEACHING'),
    ).toBe(true);
    expect(
      built.worklist.relationCandidates
        .filter((candidate) => candidate.status === 'published')
        .map((candidate) => `${candidate.sourceNodeId}->${candidate.targetNodeId}`),
    ).toEqual([
      `${FOUNDATION_THREE_DOMAIN_UNIT_STEP_ID}->${FOUNDATION_THREE_DOMAIN_SETTLING_TIME_ID}`,
    ]);
  });

  it('keeps REQUIRED edges acyclic and rebuilds byte-identically', () => {
    expect(
      detectDomainRequiredCycles(built.fragment.relations),
    ).toEqual([]);
    verifyDomainTeachingFragment(built.fragment);

    const rebuilt = translateAndBuildFoundationThreeDomainFragment({
      authority: envelope,
      repoRoot: REPO_ROOT,
    });
    expect(serializeFoundationThreeDomainJson(rebuilt.worklist)).toBe(
      serializeFoundationThreeDomainJson(built.worklist),
    );
    expect(serializeFoundationThreeDomainJson(rebuilt.authoring)).toBe(
      serializeFoundationThreeDomainJson(built.authoring),
    );
    expect(serializeFoundationThreeDomainJson(rebuilt.fragment)).toBe(
      serializeFoundationThreeDomainJson(built.fragment),
    );
    expect(serializeFoundationThreeDomainJson(rebuilt.coverage)).toBe(
      serializeFoundationThreeDomainJson(built.coverage),
    );
    expect(rebuilt.coverage.blocking).toBe(false);
  });

  it('persisted increment artifacts match a live rebuild', () => {
    expect(readFileSync(path.join(REPO_ROOT, ARTIFACTS.worklist), 'utf8')).toBe(
      serializeFoundationThreeDomainJson(built.worklist),
    );
    expect(readFileSync(path.join(REPO_ROOT, ARTIFACTS.authoring), 'utf8')).toBe(
      serializeFoundationThreeDomainJson(built.authoring),
    );
    expect(readFileSync(path.join(REPO_ROOT, ARTIFACTS.fragment), 'utf8')).toBe(
      serializeFoundationThreeDomainJson(built.fragment),
    );
    expect(readFileSync(path.join(REPO_ROOT, ARTIFACTS.coverage), 'utf8')).toBe(
      serializeFoundationThreeDomainJson(built.coverage),
    );
  });

  it('leaves first-fragment authoring, fragment and first-only manifest bytes unchanged', () => {
    expect(sha256File(path.join(
      'course-content/authoring/knowledge/teaching-projection/domain-fragments/first-fragment.authoring.json',
    ))).toBe(FIRST_FRAGMENT_SHA256.authoring);
    expect(sha256File(path.join(
      'course-content/authoring/knowledge/teaching-projection/domain-fragments/first-fragment.json',
    ))).toBe(FIRST_FRAGMENT_SHA256.fragment);
    expect(sha256File(path.join(
      'course-content/authoring/knowledge/teaching-projection/domain-fragments/composed-manifest.json',
    ))).toBe(FIRST_FRAGMENT_SHA256.composedManifest);

    const { fragment: firstFromInventory } = translateAndBuildFirstDomainFragment({
      authority: envelope,
    });
    expect(firstFromInventory.fragmentKey).toBe('foundation-published-v1');
    expect(firstFromInventory.fragmentDigest).not.toBe(built.fragment.fragmentDigest);
  });

  it('composes with the first fragment while keeping both provenances and avoiding silent collision', () => {
    const firstAuthoring = readJson<DomainTeachingFragmentAuthoring>(
      path.join(
        'course-content/authoring/knowledge/teaching-projection/domain-fragments/first-fragment.authoring.json',
      ),
    );
    const rebuiltFirst = buildDomainTeachingFragment(
      stripClaimedAuthorityNodeIndex(firstAuthoring),
      envelope,
    );
    const composed = composeFoundationThreeDomainWithFirstFragment({
      firstFragment: rebuiltFirst,
      foundationFragment: built.fragment,
      authoringRevision: envelope.authoringRevision,
    });

    expect(composed.manifest.fragments).toHaveLength(2);
    expect(composed.manifest.fragments.map((ref) => ref.fragmentKey)).toEqual([
      'foundation-published-v1',
      FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY,
    ]);
    expect(composed.manifest.fragments[0]?.fragmentDigest).toBe(
      rebuiltFirst.fragmentDigest,
    );
    expect(composed.manifest.fragments[1]?.fragmentDigest).toBe(
      built.fragment.fragmentDigest,
    );
    expect(composed.manifest.gatePassed).toBe(true);

    const stability = composed.coreNodes.find(
      (node) => node.canonicalId === FOUNDATION_THREE_DOMAIN_STABILITY_ID,
    );
    expect(stability?.cardPolicy).toBe('OPTIONAL');
    expect(stability?.pathEligible).toBe(true);
    expect(stability?.sourceEvidence).toEqual([
      FOUNDATION_THREE_DOMAIN_EVIDENCE.lesson15,
      'course-content/authoring/lessons/3-1/design/3-1-boppps.md',
    ]);

    const publishedEdges = composed.relations.map(
      (relation) => `${relation.sourceNodeId}->${relation.targetNodeId}:${relation.strength}`,
    );
    expect(publishedEdges).toContain(
      `${FOUNDATION_THREE_DOMAIN_UNIT_STEP_ID}->${FOUNDATION_THREE_DOMAIN_SETTLING_TIME_ID}:REQUIRED`,
    );
    expect(publishedEdges).not.toContain(
      `${FOUNDATION_THREE_DOMAIN_GAIN_ID}->${FOUNDATION_THREE_DOMAIN_STABILITY_ID}:REQUIRED`,
    );
    expect(publishedEdges).not.toContain(
      `${FOUNDATION_THREE_DOMAIN_STABILITY_ID}->${FOUNDATION_THREE_DOMAIN_SETTLING_TIME_ID}:REQUIRED`,
    );

    const persistedManifest = readFileSync(
      path.join(REPO_ROOT, ARTIFACTS.twoFragmentManifest),
      'utf8',
    );
    expect(persistedManifest).toBe(
      serializeFoundationThreeDomainJson(composed.manifest),
    );
    expect(persistedManifest).not.toBe(
      readFileSync(path.join(FIRST_FRAGMENT_DIR, 'composed-manifest.json'), 'utf8'),
    );

    const persistedFirst = readJson<DomainTeachingFragment>(
      path.join(
        'course-content/authoring/knowledge/teaching-projection/domain-fragments/first-fragment.json',
      ),
    );
    const persistedCompose = composeDomainTeachingProjectionFailClosed({
      fragments: [persistedFirst, built.fragment],
      authoringRevision: envelope.authoringRevision,
    });
    expect(persistedCompose.ok).toBe(false);
    expect(
      persistedCompose.findings.some(
        (finding) => finding.code === 'authority-selection-mismatch',
      ),
    ).toBe(true);
  });
});
