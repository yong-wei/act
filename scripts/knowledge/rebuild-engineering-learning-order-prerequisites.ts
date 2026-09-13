#!/usr/bin/env tsx
/**
 * Rebuild the ACT teaching prerequisite publication with r6 engineering
 * learning-order candidates and any core-closed adoptions (#2059).
 *
 * Keeps the prior release on disk for rollback. Does not deploy production.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  activatePrerequisitePublication,
  applyEngineeringLearningOrderToBuildInput,
  assertAdoptedSnapshotMatchesAuthority,
  decisionFromPublishedEdge,
  publishCoreNodes,
  resolvePrerequisiteStorePaths,
  stagePrerequisitePublication,
  type CoreNodeAuthoringRow,
  type PrerequisiteEdgeAuthoring,
  type PrerequisiteEdgePublished,
} from '@/lib/teaching-projection/prerequisites';
import type { AuthorityNodeIndexEntry } from '@/lib/teaching-projection/contracts';

const ROOT = process.cwd();
const STORE = 'course-content/runtime/knowledge/prerequisites';
const CURRENT = path.join(ROOT, STORE, 'current.json');
const FIXTURE = path.join(
  ROOT,
  'course-content/authoring/knowledge/teaching-projection/prerequisites/fixtures/r6-prerequisite-edges.json',
);
const AUTHORITY_RELEASES = path.join(
  ROOT,
  'course-content/authoring/knowledge/authority/releases',
);

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value !== undefined && (!value || value.startsWith('--'))) {
    throw new Error(`missing ${name}`);
  }
  return value;
}

function main(): void {
  const pointer = readJson<{
    publicationId: string;
    publicationHash: string;
    authorityReleaseId: string;
  }>(CURRENT);
  const fromArg = process.argv.find((arg) => arg.startsWith('--from='));
  const priorPublicationId = fromArg?.slice('--from='.length) || pointer.publicationId;
  const priorDir = path.join(ROOT, STORE, 'releases', priorPublicationId);
  const priorCore = readJson<CoreNodeAuthoringRow[]>(path.join(priorDir, 'core-nodes.json'));
  const priorEdges = readJson<PrerequisiteEdgePublished[]>(path.join(priorDir, 'edges.json'));
  const manifest = readJson<{
    scopeId: string;
    authoringRevision: string;
    authorityReleaseId: string;
    projectionCaptureId: string | null;
  }>(path.join(priorDir, 'publication-manifest.json'));
  const fixture = readJson<{
    relations: { id: string; sourceId: string; targetId: string; predicate: string }[];
    snapshot: string;
  }>(FIXTURE);
  const snapshotId = option('--snapshot') ?? fixture.snapshot;
  const authorityDir = path.join(AUTHORITY_RELEASES, snapshotId);
  const authorityManifest = readJson<{
    releaseId: string;
    snapshotId: string;
    snapshotHash: string;
  }>(path.join(authorityDir, 'manifest.json'));
  const authorityReleaseId = option('--authority-release-id') ?? manifest.authorityReleaseId;
  const projectionCaptureId = option('--projection-capture-id') ?? manifest.projectionCaptureId;
  assertAdoptedSnapshotMatchesAuthority({
    publicationAuthorityReleaseId: authorityReleaseId,
    authoritySnapshotReleaseId: authorityManifest.releaseId,
    fixtureSnapshotId: snapshotId,
    authoritySnapshotId: authorityManifest.snapshotId,
  });
  const engineering = readJson<{
    objects: { canonicalId: string; lifecycleStatus?: string | null }[];
    relations: {
      relationId: string;
      sourceId: string;
      targetId: string;
      relationType: string;
      direct?: boolean;
    }[];
  }>(path.join(authorityDir, 'engineering.json'));
  const liveAuthorityIds = new Set(engineering.objects.map((object) => object.canonicalId));
  const livePriorCore = priorCore.filter((node) => liveAuthorityIds.has(node.canonicalId));
  const livePriorEdges = priorEdges.filter((edge) => (
    liveAuthorityIds.has(edge.sourceNodeId)
    && liveAuthorityIds.has(edge.targetNodeId)
    && edge.candidateOrigin !== 'ENGINEERING_RELATION'
  ));
  const liveFixtureRelations = option('--snapshot')
    ? engineering.relations
      .filter((relation) => relation.relationType === 'prerequisite' && relation.direct === true)
      .map((relation) => ({
        id: relation.relationId,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        predicate: relation.relationType,
      }))
    : fixture.relations.filter((relation) => (
      liveAuthorityIds.has(relation.sourceId) && liveAuthorityIds.has(relation.targetId)
    ));

  const teachingEdges: PrerequisiteEdgeAuthoring[] = livePriorEdges.map((edge) => ({
    edgeId: edge.edgeId,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    strength: edge.strength,
    scopeId: edge.scopeId,
    evidenceRefs: edge.evidenceRefs,
    curatorId: edge.curatorId,
    curatorRationale: edge.curatorRationale,
    status: edge.status,
    authorDecisionId: edge.authorDecisionId,
    candidateOrigin: edge.candidateOrigin,
  }));
  const teachingDecisions = livePriorEdges
    .filter((edge) => edge.status === 'PUBLISHED' && edge.authorDecisionId)
    .map((edge) => decisionFromPublishedEdge({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      strength: edge.strength,
      scopeId: edge.scopeId,
      evidenceRefs: edge.evidenceRefs,
      curatorRationale: edge.curatorRationale,
      authorDecisionId: edge.authorDecisionId as string,
      authorityReleaseId,
      projectionCaptureId,
      authoringRevision: manifest.authoringRevision,
    }));

  const merged = applyEngineeringLearningOrderToBuildInput({
    scopeId: manifest.scopeId,
    authorityReleaseId,
    projectionCaptureId,
    authoringRevision: manifest.authoringRevision,
    snapshotHash: authorityManifest.snapshotHash,
    coreNodeIds: livePriorCore.map((n) => n.canonicalId),
    authorityIds: engineering.objects.map((o) => o.canonicalId),
    teachingEdges,
    teachingDecisions,
    relations: liveFixtureRelations,
  });

  const authorityNodes: AuthorityNodeIndexEntry[] = engineering.objects.map((object) => ({
    canonicalId: object.canonicalId,
    lifecycleStatus: object.lifecycleStatus || 'active',
  }));
  publishCoreNodes(livePriorCore, {
    scopeId: manifest.scopeId,
    authorityNodes,
  });

  const paths = resolvePrerequisiteStorePaths(path.join(ROOT, STORE));
  const staged = stagePrerequisitePublication(paths, {
    useCurrentAsPrior: true,
    scopeId: manifest.scopeId,
    authoringRevision: manifest.authoringRevision,
    authorityReleaseId,
    projectionCaptureId,
    authorityNodes,
    coreNodes: livePriorCore,
    edges: merged.edges,
    decisions: merged.decisions,
    candidates: merged.candidates,
    receipts: merged.receipts,
  });

  if (staged.priorPreserved) {
    throw new Error(
      `publication rejected; prior preserved. findings=${JSON.stringify(staged.findings)}`,
    );
  }

  // Receipts live in hashed candidates/edges, not a post-stage sidecar.
  // This change already switched Git current.json. Rebuilds must pass
  // --activate to move the pointer again; default only stages the release.
  const activate = process.argv.includes('--activate');
  const pointerOut = activate
    ? activatePrerequisitePublication(paths, staged.publicationId, {
      activatedAt: '2026-09-08T04:00:00.000Z',
    })
    : readJson<unknown>(CURRENT);

  process.stdout.write(`${JSON.stringify({
    priorPublicationId,
    publicationId: staged.publicationId,
    publicationHash: staged.publicationHash,
    reused: staged.reused,
    adopted: merged.receipts.filter((r) => r.disposition === 'adopted').length,
    candidates: merged.candidates.length,
    receipts: merged.receipts.length,
    current: pointerOut,
  }, null, 2)}\n`);
}

main();
