/** Cross-domain Teaching Projection generation-3 (#1374). */

import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertPinnedBoundaryWorklistBytes,
  assertPinnedReviewerWorklistSemantics,
  buildDomainTeachingGenerationV3,
  generation3ArtifactRelatives,
  PINNED_PUBLISHED_BYTE_DIGESTS,
  PINNED_REVIEWER_WORKLIST_SEMANTIC_DIGESTS,
  serializeGeneration3Json,
} from '../../../scripts/knowledge-cutover/build-domain-teaching-generation-v3';
import {
  PINNED_AUTHORITY_ENGINEERING_RELATIVE,
  PINNED_AUTHORITY_MANIFEST_RELATIVE,
} from '../../../scripts/knowledge-cutover/build-domain-teaching-generation-v2';
import type {
  AuthorityEngineeringBody,
  AuthoritySnapshotManifest,
} from '../authoritative-knowledge/authority-snapshot';
import {
  assertExplicitIdentityEquivalence,
  assertPinnedFileBytes,
  buildDomainTeachingFragment,
  composeDomainTeachingProjection,
  CROSS_DOMAIN_BOUNDARY_WORKLIST_PATHS,
  CROSS_DOMAIN_FRAGMENT_KEY,
  CROSS_DOMAIN_NO_ADMISSIBLE_REASON,
  detectDomainRequiredCycles,
  DomainCompositionError,
  Generation3EquivalenceError,
  Generation3PinError,
  sha256File,
  verifyDomainTeachingFragment,
} from '../teaching-projection';

const REPO_ROOT = process.cwd();
const RELATIVES = generation3ArtifactRelatives();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')) as T;
}

describe('publish-cross-domain-teaching-semantics', () => {
  const built = buildDomainTeachingGenerationV3();

  it('rebuilds deterministic generation-3 artifacts from the pinned snapshot', () => {
    expect(readJson(RELATIVES.authoritySource)).toEqual(built.authoritySource);
    expect(readJson(RELATIVES.conversionProtocol)).toEqual(built.conversionProtocol);
    expect(readJson(RELATIVES.upstreamPins)).toEqual(built.pinLedger);
    expect(readJson(RELATIVES.foundationAuthoring)).toEqual(built.foundationAuthoring);
    expect(readJson(RELATIVES.foundationFragment)).toEqual(built.foundationFragment);
    expect(readJson(RELATIVES.foundationThreeDomainAuthoring)).toEqual(
      built.foundationThreeDomainAuthoring,
    );
    expect(readJson(RELATIVES.foundationThreeDomainFragment)).toEqual(
      built.foundationThreeDomainFragment,
    );
    expect(readJson(RELATIVES.classicalAuthoring)).toEqual(built.classicalAuthoring);
    expect(readJson(RELATIVES.classicalFragment)).toEqual(built.classicalFragment);
    expect(readJson(RELATIVES.modernDiscreteSource)).toEqual(built.modernDiscrete.source);
    expect(readJson(RELATIVES.modernDiscreteWorklist)).toEqual(
      built.modernDiscrete.worklist,
    );
    expect(readJson(RELATIVES.modernDiscreteAuthoring)).toEqual(
      built.modernDiscrete.authoring,
    );
    expect(readJson(RELATIVES.modernDiscreteFragment)).toEqual(
      built.modernDiscrete.fragment,
    );
    expect(readJson(RELATIVES.modernDiscreteCoverage)).toEqual(
      built.modernDiscrete.coverage,
    );
    expect(readJson(RELATIVES.modernStateSpaceSource)).toEqual(
      built.modernStateSpace.source,
    );
    expect(readJson(RELATIVES.modernStateSpaceWorklist)).toEqual(
      built.modernStateSpace.worklist,
    );
    expect(readJson(RELATIVES.modernStateSpaceAuthoring)).toEqual(
      built.modernStateSpace.authoring,
    );
    expect(readJson(RELATIVES.modernStateSpaceFragment)).toEqual(
      built.modernStateSpace.fragment,
    );
    expect(readJson(RELATIVES.modernStateSpaceCoverage)).toEqual(
      built.modernStateSpace.coverage,
    );
    expect(readJson(RELATIVES.crossDomainSource)).toEqual(built.crossDomain.source);
    expect(readJson(RELATIVES.crossDomainWorklist)).toEqual(built.crossDomain.worklist);
    expect(readJson(RELATIVES.crossDomainAuthoring)).toEqual(
      built.crossDomain.authoring,
    );
    expect(readJson(RELATIVES.crossDomainFragment)).toEqual(built.crossDomain.fragment);
    expect(readJson(RELATIVES.crossDomainCoverage)).toEqual(built.crossDomain.coverage);
    expect(readJson(RELATIVES.composedManifest)).toEqual(built.composed.manifest);
    expect(serializeGeneration3Json(built.composed.manifest)).toBe(
      readFileSync(path.join(REPO_ROOT, RELATIVES.composedManifest), 'utf8'),
    );
  });

  it('leaves published generation-2, modern, foundation and classical bytes unchanged', () => {
    for (const [relativePath, expected] of Object.entries(PINNED_PUBLISHED_BYTE_DIGESTS)) {
      expect(sha256File(REPO_ROOT, relativePath)).toBe(expected);
    }
  });

  it('binds every resealed shard to the same complete snapshot selection', () => {
    const selection = built.authoritySource;
    expect(built.authority.nodes).toHaveLength(7476);
    expect(selection.nodeIndexDigest).toBe(
      '76bc76cac975c8ace294fb4d51d726a927ec0dd2b537181cd6fee1dc389dacf5',
    );
    const fragments = [
      built.foundationFragment,
      built.foundationThreeDomainFragment,
      built.classicalFragment,
      built.modernDiscrete.fragment,
      built.modernStateSpace.fragment,
      built.crossDomain.fragment,
    ];
    for (const fragment of fragments) {
      expect(fragment.authorityBinding).toEqual(selection.authorityBinding);
      expect(fragment.authoritySelection.sourceDatasetHash).toBe(
        selection.sourceDatasetHash,
      );
      expect(fragment.authoritySelection.captureRevision).toBe(
        selection.captureRevision,
      );
      expect(fragment.authoritySelection.nodeIndexDigest).toBe(
        selection.nodeIndexDigest,
      );
      verifyDomainTeachingFragment(fragment);
    }
    expect(built.composed.manifest.authoritySelection).toEqual({
      authorityBinding: selection.authorityBinding,
      sourceDatasetHash: selection.sourceDatasetHash,
      captureRevision: selection.captureRevision,
      nodeIndexDigest: selection.nodeIndexDigest,
    });
    expect(built.composed.manifest.gatePassed).toBe(true);
  });

  it('keeps foundation, classical and modern teaching semantics equivalent', () => {
    const pairs: Array<[string, string]> = [
      [
        'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-fragment.authoring.json',
        RELATIVES.foundationAuthoring,
      ],
      [
        'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-fragment.json',
        RELATIVES.foundationFragment,
      ],
      [
        'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-fragment.authoring.json',
        RELATIVES.classicalAuthoring,
      ],
      [
        'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-fragment.json',
        RELATIVES.classicalFragment,
      ],
      [
        'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.json',
        RELATIVES.modernDiscreteFragment,
      ],
      [
        'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.json',
        RELATIVES.modernStateSpaceFragment,
      ],
    ];
    for (const [originalPath, resealedPath] of pairs) {
      expect(() => assertExplicitIdentityEquivalence(
        readJson(originalPath),
        readJson(resealedPath),
        originalPath,
      )).not.toThrow();
    }
  });

  it('does not promote modern unresolved DEFER candidates or empty denominators', () => {
    for (const artifact of [built.modernDiscrete, built.modernStateSpace]) {
      expect(artifact.source.denominatorNodeIds).toEqual([]);
      expect(artifact.worklist.denominatorNodeIds).toEqual([]);
      expect(artifact.fragment.coreNodes).toEqual([]);
      expect(artifact.fragment.relations).toEqual([]);
      expect(artifact.coverage.blocking).toBe(false);
      expect(artifact.worklist.unresolvedCoreCandidates).toHaveLength(1);
      expect(artifact.worklist.unresolvedCoreCandidates[0]?.status).toBe('DEFER');
      expect(artifact.worklist.unresolvedCoreCandidates[0]?.authorityResolution)
        .toBe('unresolved');
      expect(artifact.coverage.coverage.find(
        (entry) => entry.domainId === artifact.definition.domainId,
      )?.coverage).toBe('empty');
    }
  });

  it('publishes an empty cross-domain fragment and records no admissible candidate', () => {
    expect(built.crossDomain.fragment.fragmentKey).toBe(CROSS_DOMAIN_FRAGMENT_KEY);
    expect(built.crossDomain.fragment.coreNodes).toEqual([]);
    expect(built.crossDomain.fragment.relations).toEqual([]);
    expect(built.crossDomain.source.denominatorNodeIds).toEqual([]);
    expect(built.crossDomain.source.acceptedDirectActTeachingCandidates).toEqual([]);
    expect(built.crossDomain.source.noAdmissibleDirectActTeachingCandidate).toBe(true);
    expect(built.crossDomain.worklist.collectedCandidates.length).toBeGreaterThan(0);
    expect(
      built.crossDomain.worklist.collectedCandidates.every(
        (item) => item.admissibleDirectActTeaching === false,
      ),
    ).toBe(true);
    expect(built.crossDomain.worklist.reason).toBe(CROSS_DOMAIN_NO_ADMISSIBLE_REASON);
    expect(built.crossDomain.coverage.blocking).toBe(false);
    expect(built.composed.relations).toHaveLength(7);
    expect(built.composed.relations.every((relation) =>
      relation.layer === 'ACT_TEACHING',
    )).toBe(true);
    expect(detectDomainRequiredCycles(built.composed.relations)).toEqual([]);
  });

  it('records upstream path, byte, published, semantic and resealed digests', () => {
    expect(built.pinLedger.artifacts).toHaveLength(20);
    for (const pin of built.pinLedger.artifacts) {
      expect(pin.path.length).toBeGreaterThan(0);
      expect(pin.originalBytesDigest).toMatch(/^[a-f0-9]{64}$/u);
      expect(pin.originalPublishedDigest).toMatch(/^[a-f0-9]{64}$/u);
      expect(pin.originalSemanticDigest).toMatch(/^[a-f0-9]{64}$/u);
      expect(pin.resealedDigest).toMatch(/^[a-f0-9]{64}$/u);
      expect(pin.snapshotBinding).toEqual(built.authority.binding);
      expect(pin.conversionProtocol).toBe('act-generation-3-conversion-protocol/v1');
    }
    expect(built.conversionProtocol.allowedIdentityPaths).toContain(
      'authoritySelection.nodeIndexDigest',
    );
    expect(built.conversionProtocol.forbidden).toContain('recursive-field-deletion');
  });

  it('replays identically and proves the composed graph has no new cross edges', () => {
    const replayed = buildDomainTeachingGenerationV3();
    expect(replayed.composed.manifest).toEqual(built.composed.manifest);
    expect(replayed.crossDomain.fragment.relations).toEqual([]);
    const prior = readJson<{ relationCount: number }>(
      'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/composed-manifest.json',
    );
    expect(built.composed.manifest.relationCount).toBe(prior.relationCount);
    expect(built.composed.manifest.coreNodeCount).toBe(11);
    const crossEndpoints = new Set(
      built.crossDomain.worklist.collectedCandidates.flatMap((item) => [
        item.sourceNodeId,
        item.targetNodeId,
      ]).filter((value): value is string => typeof value === 'string'),
    );
    expect(built.composed.relations.some((relation) =>
      relation.authorDecisionId?.startsWith('cross-domain'),
    )).toBe(false);
    expect(built.crossDomain.fragment.relations.some((relation) =>
      crossEndpoints.has(relation.sourceNodeId),
    )).toBe(false);
  });

  it('fails closed when the pinned Authority engineering body drifts', () => {
    const manifest = readJson<AuthoritySnapshotManifest>(
      PINNED_AUTHORITY_MANIFEST_RELATIVE,
    );
    const engineering = readJson<AuthorityEngineeringBody>(
      PINNED_AUTHORITY_ENGINEERING_RELATIVE,
    );
    const objects = [...engineering.objects];
    objects[0] = {
      ...objects[0]!,
      canonicalId: `${objects[0]!.canonicalId}-tampered`,
    };
    expect(() => buildDomainTeachingGenerationV3({
      authoritySnapshot: {
        manifest,
        engineering: { ...engineering, objects },
      },
    })).toThrow(/engineeringDigest does not match engineering body/);
  });

  it('pins every collected boundary worklist to the shared empty cross-domain output', () => {
    const expectedPaths: string[] = [...CROSS_DOMAIN_BOUNDARY_WORKLIST_PATHS].sort();
    const reviewerPins = built.pinLedger.artifacts.filter((pin) =>
      pin.role.startsWith('cross-domain-boundary-'),
    );
    expect(reviewerPins.map((pin) => pin.path).sort()).toEqual(expectedPaths);
    expect(new Set(reviewerPins.map((pin) => pin.path)).size).toBe(4);

    const ledgerWorklistPaths = [...new Set(
      built.pinLedger.artifacts
        .filter((pin) => expectedPaths.includes(pin.path))
        .map((pin) => pin.path),
    )].sort();
    expect(ledgerWorklistPaths).toEqual(expectedPaths);

    for (const pin of reviewerPins) {
      const original = readJson(pin.path);
      expect(pin.originalBytesDigest).toBe(
        PINNED_PUBLISHED_BYTE_DIGESTS[
          pin.path as keyof typeof PINNED_PUBLISHED_BYTE_DIGESTS
        ],
      );
      expect(pin.originalSemanticDigest).toBe(
        PINNED_REVIEWER_WORKLIST_SEMANTIC_DIGESTS[
          pin.path as keyof typeof PINNED_REVIEWER_WORKLIST_SEMANTIC_DIGESTS
        ],
      );
      expect(pin.resealedDigest).toBe(built.crossDomain.worklist.inputDigest);
      expect(pin.snapshotBinding).toEqual(built.authority.binding);
      expect(pin.conversionProtocol).toBe('act-generation-3-conversion-protocol/v1');
      expect(pin.auditOutput).toBe('multi-source-cross-domain-worklist');
      expect(pin.auditOutputSources).toEqual(CROSS_DOMAIN_BOUNDARY_WORKLIST_PATHS);
      expect(() => assertExplicitIdentityEquivalence(
        original,
        built.crossDomain.worklist,
        pin.role,
      )).toThrow(Generation3EquivalenceError);
    }

    const replayed = buildDomainTeachingGenerationV3();
    expect(replayed.pinLedger).toEqual(built.pinLedger);
    expect(replayed.crossDomain.worklist).toEqual(built.crossDomain.worklist);
    expect(replayed.crossDomain.source).toEqual(built.crossDomain.source);
  });

  it('fails closed when a collected boundary worklist changes bytes', () => {
    const fixture = mkdtempSync(path.join(tmpdir(), 'generation-3-worklist-pin-'));
    try {
      for (const relativePath of CROSS_DOMAIN_BOUNDARY_WORKLIST_PATHS) {
        const destination = path.join(fixture, relativePath);
        mkdirSync(path.dirname(destination), { recursive: true });
        cpSync(path.join(REPO_ROOT, relativePath), destination);
      }
      expect(() => assertPinnedBoundaryWorklistBytes(fixture)).not.toThrow();

      for (const drifted of CROSS_DOMAIN_BOUNDARY_WORKLIST_PATHS) {
        const destination = path.join(fixture, drifted);
        const original = readFileSync(destination);
        writeFileSync(
          destination,
          `${JSON.stringify({ tampered: true }, null, 2)}\n`,
          'utf8',
        );
        expect(() => assertPinnedBoundaryWorklistBytes(fixture)).toThrow(Generation3PinError);
        expect(() => buildDomainTeachingGenerationV3({ repoRoot: fixture })).toThrow(
          Generation3PinError,
        );
        writeFileSync(destination, original);
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('fails closed when a collected boundary worklist changes semantic payload', () => {
    for (const relativePath of CROSS_DOMAIN_BOUNDARY_WORKLIST_PATHS) {
      const original = readJson<Record<string, unknown>>(relativePath);
      expect(() => assertPinnedReviewerWorklistSemantics(
        relativePath,
        original,
      )).not.toThrow();

      const drifted = {
        ...original,
        candidates: [
          ...((original.candidates as unknown[] | undefined) ?? []),
          { candidateId: `${relativePath}:tampered` },
        ],
        unresolvedCoreCandidates: [
          ...((original.unresolvedCoreCandidates as unknown[] | undefined) ?? []),
          { canonicalId: `${relativePath}:tampered` },
        ],
      };
      expect(() => assertPinnedReviewerWorklistSemantics(
        relativePath,
        drifted,
      )).toThrow(Generation3EquivalenceError);
    }
  });

  it('fails closed on source-byte and semantic-payload drift', () => {
    const fixture = mkdtempSync(path.join(tmpdir(), 'generation-3-pin-'));
    try {
      const relative = 'tampered.json';
      writeFileSync(path.join(fixture, relative), '{"ok":true}\n', 'utf8');
      expect(() => assertPinnedFileBytes(
        fixture,
        relative,
        'a'.repeat(64),
      )).toThrow(Generation3PinError);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }

    const drifted = {
      ...built.foundationAuthoring,
      coreNodes: built.foundationAuthoring.coreNodes.map((node, index) => (
        index === 0
          ? { ...node, rationale: `${node.rationale} tampered` }
          : node
      )),
    };
    expect(() => assertExplicitIdentityEquivalence(
      built.foundationAuthoring,
      drifted,
      'foundation-authoring',
    )).toThrow(Generation3EquivalenceError);
  });

  it('rejects REQUIRED cycles and duplicate fragment keys without changing prior shards', () => {
    const published = built.foundationThreeDomainAuthoring.relations[0];
    expect(published?.strength).toBe('REQUIRED');
    const reverse = buildDomainTeachingFragment(
      {
        ...built.foundationThreeDomainAuthoring,
        fragmentKey: 'cross-domain-cycle-fixture',
        relations: [
          {
            sourceNodeId: published!.targetNodeId,
            targetNodeId: published!.sourceNodeId,
            relationType: 'PREREQUISITE',
            strength: 'REQUIRED',
            domainKeys: published!.domainKeys,
            evidenceRefs: published!.evidenceRefs,
            authorDecisionId: 'cross-domain-cycle-fixture',
          },
        ],
      },
      built.authority,
    );
    expect(() => composeDomainTeachingProjection({
      fragments: [built.foundationThreeDomainFragment, reverse],
      authoringRevision: built.authority.authoringRevision,
      authority: built.authority,
    })).toThrow(DomainCompositionError);

    expect(() => composeDomainTeachingProjection({
      fragments: [built.classicalFragment, built.classicalFragment],
      authoringRevision: built.authority.authoringRevision,
      authority: built.authority,
    })).toThrow(/duplicate-fragment-key/);

    expect(readJson(RELATIVES.crossDomainFragment)).toEqual(built.crossDomain.fragment);
    expect(sha256File(
      REPO_ROOT,
      'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/composed-manifest.json',
    )).toBe(
      PINNED_PUBLISHED_BYTE_DIGESTS[
        'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/composed-manifest.json'
      ],
    );
  });
});
