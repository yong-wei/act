#!/usr/bin/env tsx
/**
 * Rebuild the ACT teaching prerequisite publication with r6 engineering
 * learning-order candidates and any core-closed adoptions (#2059).
 *
 * Keeps the prior release on disk for rollback. Does not deploy production.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  activatePrerequisitePublication,
  applyEngineeringLearningOrderToBuildInput,
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
const ENGINEERING = path.join(
  ROOT,
  'course-content/authoring/knowledge/authority/releases/snap-b7c6992d75e8d62585f4fffe7d50752f0a4142ffb559c2c8da02195005776373/engineering.json',
);

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function main(): void {
  const pointer = readJson<{
    publicationId: string;
    publicationHash: string;
    authorityReleaseId: string;
  }>(CURRENT);
  const priorDir = path.join(ROOT, STORE, 'releases', pointer.publicationId);
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
  const engineering = readJson<{
    objects: { canonicalId: string; lifecycleStatus?: string | null }[];
  }>(ENGINEERING);

  const teachingEdges: PrerequisiteEdgeAuthoring[] = priorEdges.map((edge) => ({
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
  const teachingDecisions = priorEdges
    .filter((edge) => edge.status === 'PUBLISHED' && edge.authorDecisionId)
    .map((edge) => decisionFromPublishedEdge({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      strength: edge.strength,
      scopeId: edge.scopeId,
      evidenceRefs: edge.evidenceRefs,
      curatorRationale: edge.curatorRationale,
      authorDecisionId: edge.authorDecisionId as string,
      authorityReleaseId: manifest.authorityReleaseId,
      projectionCaptureId: manifest.projectionCaptureId,
      authoringRevision: manifest.authoringRevision,
    }));

  const merged = applyEngineeringLearningOrderToBuildInput({
    scopeId: manifest.scopeId,
    authorityReleaseId: manifest.authorityReleaseId,
    projectionCaptureId: manifest.projectionCaptureId,
    authoringRevision: manifest.authoringRevision,
    snapshotHash: fixture.snapshot.replace(/^snap-/, ''),
    coreNodeIds: priorCore.map((n) => n.canonicalId),
    authorityIds: engineering.objects.map((o) => o.canonicalId),
    teachingEdges,
    teachingDecisions,
    relations: fixture.relations,
  });

  const authorityNodes: AuthorityNodeIndexEntry[] = engineering.objects.map((object) => ({
    canonicalId: object.canonicalId,
    lifecycleStatus: object.lifecycleStatus || 'active',
  }));
  publishCoreNodes(priorCore, {
    scopeId: manifest.scopeId,
    authorityNodes,
  });

  const paths = resolvePrerequisiteStorePaths(path.join(ROOT, STORE));
  const staged = stagePrerequisitePublication(paths, {
    useCurrentAsPrior: true,
    scopeId: manifest.scopeId,
    authoringRevision: manifest.authoringRevision,
    authorityReleaseId: manifest.authorityReleaseId,
    projectionCaptureId: manifest.projectionCaptureId,
    authorityNodes,
    coreNodes: priorCore,
    edges: merged.edges,
    decisions: merged.decisions,
    candidates: merged.candidates,
  });

  if (staged.priorPreserved) {
    throw new Error(
      `publication rejected; prior preserved. findings=${JSON.stringify(staged.findings)}`,
    );
  }

  // This change already switched Git current.json. Rebuilds must pass
  // --activate to move the pointer again; default only stages the release.
  const activate = process.argv.includes('--activate');
  const pointerOut = activate
    ? activatePrerequisitePublication(paths, staged.publicationId, {
      activatedAt: '2026-09-08T04:00:00.000Z',
    })
    : readJson<unknown>(CURRENT);
  const receiptPath = path.join(
    ROOT,
    STORE,
    'releases',
    staged.publicationId,
    'engineering-learning-order-receipts.json',
  );
  writeFileSync(
    receiptPath,
    `${JSON.stringify({
      contract: 'act-engineering-learning-order-receipts/v1',
      snapshotHash: fixture.snapshot.replace(/^snap-/, ''),
      priorPublicationId: pointer.publicationId,
      publicationId: staged.publicationId,
      receipts: merged.receipts,
    }, null, 2)}\n`,
  );

  process.stdout.write(`${JSON.stringify({
    priorPublicationId: pointer.publicationId,
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
