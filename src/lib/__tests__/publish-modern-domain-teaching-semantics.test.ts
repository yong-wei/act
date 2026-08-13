/** Modern-control Teaching Projection increment (#1373). */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  composeDomainTeachingProjection,
  detectDomainRequiredCycles,
  liveAuthorityEnvelopeForModernControl,
  MODERN_DISCRETE_DOMAIN,
  MODERN_DISCRETE_NODE_ID,
  MODERN_CONTROL_COURSE_COVERAGE_EVIDENCE,
  MODERN_STATE_SPACE_DOMAIN,
  MODERN_STATE_SPACE_NODE_ID,
  modernControlArtifactRelatives,
  modernControlDomainDefinitions,
  buildModernControlDomainArtifacts,
  serializeModernControlJson,
  verifyDomainTeachingFragment,
} from '../teaching-projection';

const REPO_ROOT = process.cwd();
const DOMAIN_IDS = [MODERN_DISCRETE_DOMAIN, MODERN_STATE_SPACE_DOMAIN] as const;

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')) as T;
}

describe('publish-modern-domain-teaching-semantics', () => {
  const envelope = liveAuthorityEnvelopeForModernControl(REPO_ROOT);
  const built = DOMAIN_IDS.map((domainId) =>
    buildModernControlDomainArtifacts(domainId, envelope),
  );

  it('pins exactly the two approved and published catalog members', () => {
    expect(envelope.nodes.map((node) => node.canonicalId).sort()).toEqual([
      MODERN_DISCRETE_NODE_ID,
      MODERN_STATE_SPACE_NODE_ID,
    ].sort());
    for (const definition of modernControlDomainDefinitions()) {
      expect(definition.canonicalId).toBe(
        definition.domainId === MODERN_DISCRETE_DOMAIN
          ? MODERN_DISCRETE_NODE_ID
          : MODERN_STATE_SPACE_NODE_ID,
      );
    }
    expect(envelope.nodes.every((node) => node.lifecycleStatus === 'active')).toBe(true);
    expect(envelope.binding.snapshotId).toBe(
      'snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7',
    );
  });

  it('publishes empty fragments while keeping the unresolved node outside the denominator', () => {
    for (const artifact of built) {
      expect(artifact.source.denominatorNodeIds).toEqual([]);
      expect(artifact.worklist.denominatorNodeIds).toEqual([]);
      expect(artifact.worklist.coreNodes).toEqual([]);
      expect(artifact.worklist.acceptedLocalRelationCount).toBe(0);
      expect(artifact.fragment.coreNodeCount).toBe(0);
      expect(artifact.fragment.relationCount).toBe(0);
      expect(artifact.fragment.relations).toEqual([]);
      expect(artifact.authoring.relations).toEqual([]);
      expect(artifact.coverage.acceptedLocalRelationCount).toBe(0);
      expect(artifact.coverage.blocking).toBe(false);
    }
  });

  it('keeps each exact node as a DEFER candidate with CourseCoverage evidence', () => {
    for (const artifact of built) {
      expect(artifact.worklist.unresolvedCoreCandidates).toHaveLength(1);
      expect(artifact.worklist.unresolvedCoreCandidates[0]).toEqual({
        canonicalId: artifact.definition.canonicalId,
        status: 'DEFER',
        authorityResolution: 'unresolved',
        evidenceRefs: [MODERN_CONTROL_COURSE_COVERAGE_EVIDENCE[artifact.definition.domainId]],
        reason: expect.stringContaining('无 lesson、syllabus 或 curriculum 的独立 ACT admission evidence'),
      });
      const evidencePath = MODERN_CONTROL_COURSE_COVERAGE_EVIDENCE[artifact.definition.domainId];
      const coverage = readJson<{
        members: Array<{
          canonicalId: string;
          stageConclusion: string;
          authorityResolution?: string | null;
          rationale: string;
        }>;
      }>(evidencePath);
      const coverageMember = coverage.members.find(
        (member) => member.canonicalId === artifact.definition.canonicalId,
      );
      expect(coverageMember).toBeDefined();
      expect(coverageMember?.stageConclusion).toBe('DEFER');
      expect(coverageMember?.rationale).toMatch(
        /DEFER|authority.*unresolved|unresolved.*authority|independent-course/iu,
      );
      expect(artifact.source.unresolvedCoreCandidates).toEqual(
        artifact.worklist.unresolvedCoreCandidates,
      );
      expect(artifact.coverage.denominatorEvidence).toEqual({});
      expect(artifact.coverage.coverage.find(
        (entry) => entry.domainId === artifact.definition.domainId,
      )?.coverage).toBe('empty');
    }
  });

  it('keeps cross-domain and non-catalog boundaries range-level and outside ACT_TEACHING', () => {
    const forbiddenRelationFields = /sourceNodeId|targetNodeId|relationType|strength|ENGINEERING_PREDICATE|candidate/iu;
    for (const artifact of built) {
      expect(artifact.worklist.deferredBoundaries).toEqual([
        expect.objectContaining({
          scope: 'cross-domain-entry',
          disposition: 'deferred',
        }),
      ]);
      expect(artifact.worklist.excludedScopes).toEqual([
        expect.objectContaining({
          scope: 'non-catalog-engineering-adjacency',
          disposition: 'excluded',
        }),
      ]);
      expect(artifact.source).not.toHaveProperty('relationCandidates');
      expect(artifact.worklist).not.toHaveProperty('relationCandidates');
      expect(artifact.coverage).not.toHaveProperty('pendingCandidateCount');
      expect(JSON.stringify({
        deferredBoundaries: artifact.worklist.deferredBoundaries,
        excludedScopes: artifact.worklist.excludedScopes,
      })).not.toMatch(forbiddenRelationFields);
      expect(artifact.worklist.deferredBoundaries[0]?.reason).toContain(
        '独立 cross-domain 变更',
      );
      expect(artifact.worklist.excludedScopes[0]?.reason).toContain(
        '不是 ACT_TEACHING 证据',
      );
      expect(artifact.fragment.relations.every((relation) =>
        relation.layer === 'ACT_TEACHING',
      )).toBe(true);
      expect(artifact.fragment.relations).toEqual([]);
    }
  });

  it('proves empty payload acceptance, acyclicity and nonblocking coverage', () => {
    for (const artifact of built) {
      expect(artifact.authoring.nodeIndexDigest).toBe(envelope.nodeIndexDigest);
      expect(artifact.fragment.authoritySelection.nodeIndexDigest).toBe(
        envelope.nodeIndexDigest,
      );
      verifyDomainTeachingFragment(artifact.fragment);
      expect(detectDomainRequiredCycles(artifact.fragment.relations)).toEqual([]);
      const current = artifact.coverage.coverage.find(
        (entry) => entry.domainId === artifact.definition.domainId,
      );
      expect(current?.coverage).toBe('empty');
      expect(current?.coreNodeCount).toBe(0);
      expect(current?.relationCount).toBe(0);
      expect(current?.uncoveredCoreNodeCount).toBe(0);
      expect(current?.coverage).toBe('empty');
    }
  });

  it('can compose both independent fragments without changing their identities', () => {
    const composed = composeDomainTeachingProjection({
      fragments: built.map((artifact) => artifact.fragment),
      authoringRevision: envelope.authoringRevision,
    });
    expect(composed.manifest.coreNodeCount).toBe(0);
    expect(composed.manifest.relationCount).toBe(0);
    expect(composed.fragments.map((fragment) => fragment.fragmentKey)).toEqual([
      'modern-discrete-time-v1',
      'modern-state-space-v1',
    ]);
  });

  it('rebuilds and persists each artifact byte-identically', () => {
    for (const artifact of built) {
      const rebuilt = buildModernControlDomainArtifacts(
        artifact.definition.domainId,
        envelope,
      );
      const relatives = modernControlArtifactRelatives(artifact.definition.domainId);
      expect(readFileSync(path.join(REPO_ROOT, relatives.source), 'utf8')).toBe(
        serializeModernControlJson(rebuilt.source),
      );
      expect(readFileSync(path.join(REPO_ROOT, relatives.worklist), 'utf8')).toBe(
        serializeModernControlJson(rebuilt.worklist),
      );
      expect(readFileSync(path.join(REPO_ROOT, relatives.authoring), 'utf8')).toBe(
        serializeModernControlJson(rebuilt.authoring),
      );
      expect(readFileSync(path.join(REPO_ROOT, relatives.fragment), 'utf8')).toBe(
        serializeModernControlJson(rebuilt.fragment),
      );
      expect(readFileSync(path.join(REPO_ROOT, relatives.coverage), 'utf8')).toBe(
        serializeModernControlJson(rebuilt.coverage),
      );
    }
  });

  it('keeps persisted worklists explicit about omitted boundary reasons', () => {
    for (const domainId of DOMAIN_IDS) {
      const relatives = modernControlArtifactRelatives(domainId);
      const worklist = readJson<{
        unresolvedCoreCandidates: Array<{
          canonicalId: string;
          status: string;
          authorityResolution: string;
          evidenceRefs: string[];
          reason: string;
        }>;
        deferredBoundaries: Array<{ reason: string; disposition: string }>;
        excludedScopes: Array<{ reason: string; disposition: string }>;
      }>(relatives.worklist);
      expect(worklist.unresolvedCoreCandidates).toHaveLength(1);
      expect(worklist.unresolvedCoreCandidates[0]?.status).toBe('DEFER');
      expect(worklist.unresolvedCoreCandidates[0]?.authorityResolution).toBe('unresolved');
      expect(worklist.unresolvedCoreCandidates[0]?.evidenceRefs).toEqual([
        MODERN_CONTROL_COURSE_COVERAGE_EVIDENCE[domainId],
      ]);
      expect(worklist.deferredBoundaries.every((boundary) =>
        boundary.disposition === 'deferred' && boundary.reason.length > 0,
      )).toBe(true);
      expect(worklist.excludedScopes.every((boundary) =>
        boundary.disposition === 'excluded' && boundary.reason.length > 0,
      )).toBe(true);
    }
  });
});
