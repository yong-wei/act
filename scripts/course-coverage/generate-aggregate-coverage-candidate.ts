#!/usr/bin/env tsx
/**
 * Generate an UNREVIEWED heuristic candidate CourseCoverage authoring file.
 *
 * Does NOT write aggregate/active/. Does NOT claim review.
 * Production import requires a separately reviewed active ledger with a bound
 * accepted Delta Receipt identity.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { selectCanonicalObjectMembership } from '../../src/lib/aggregate-governance';
import {
  AGGREGATE_COVERAGE_CANDIDATE_PATH,
  AGGREGATE_CANDIDATE_GENERATOR_IDENTITY,
  buildCandidateCoverageAuthoring,
  loadActCurriculumEvidence,
  loadProjectionNodes,
} from './aggregate-coverage';

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const root = process.cwd();
  const outRel = argValue('--out') ?? AGGREGATE_COVERAGE_CANDIDATE_PATH;
  if (outRel.includes('/aggregate/active/')) {
    throw new Error('Candidate generator must not write under aggregate/active/');
  }

  const releaseSetId = argValue('--release-set-id')
    ?? 'actkg-authoritative-candidate-v3-r2';
  const releaseId = argValue('--release-id')
    ?? 'ctr:release:control-theory-engineering-v0.3';
  const releaseHash = argValue('--release-hash')
    ?? '13fc60a0a4e1706095f4db89f0a0db4cba10525f4cd6e9ec08b7d44acd7a4ffc';
  const sourceDatasetHash = argValue('--source-dataset-hash')
    ?? '7ada10dbb5862ea1fa0102453bceff31c7b62c9045b2f14a1aba29bf5762911c';
  const authoringRevision = argValue('--authoring-revision') ?? '0'.repeat(40);

  const projectionPath = argValue('--projection')
    ?? 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2/control-theory-engineering-v0.3.act-projection.json';
  const releasePath = argValue('--release')
    ?? 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2/control-theory-engineering-v0.3.release.json';

  const nodesRaw = await loadProjectionNodes(root, projectionPath);
  const nodes = nodesRaw.map((node) => ({
    entityId: node.entity_id ?? node.entityId ?? '',
  }));
  const release = JSON.parse(
    await (await import('node:fs/promises')).readFile(path.join(root, releasePath), 'utf8'),
  ) as {
    entries?: Array<{ entity?: string; entity_role?: string; entityRole?: string }>;
  };
  const membership = selectCanonicalObjectMembership({
    projectionNodes: nodes,
    releaseEntries: (release.entries ?? []).map((row) => ({
      entityId: String(row.entity ?? ''),
      entityRole: row.entity_role ?? row.entityRole ?? null,
    })),
  });

  const curriculum = await loadActCurriculumEvidence(root);
  const candidate = buildCandidateCoverageAuthoring({
    releaseSetId,
    releaseId,
    releaseHash,
    sourceDatasetHash,
    deltaReceiptId: null,
    authoringRevision,
    memberIds: membership.canonicalIds,
    nodes: nodesRaw,
    curriculum,
  });

  const outPath = path.resolve(root, outRel);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8');

  const roleCounts = candidate.entries.reduce<Record<string, number>>((acc, row) => {
    acc[row.role] = (acc[row.role] ?? 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({
    wrote: outRel,
    membership: membership.canonicalIds.length,
    roleCounts,
    generatorIdentity: AGGREGATE_CANDIDATE_GENERATOR_IDENTITY,
    unreviewedCandidate: true,
    note: 'Heuristic candidate only. Not production authority. Do not place under active/ until explicit review binds deltaReceiptId.',
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
