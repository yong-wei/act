#!/usr/bin/env tsx
/**
 * #2043 review preparation — build reviewer work batches from candidates.
 *
 * Each batch carries the object profile (label/description/teaching fields)
 * plus every candidate's unit title, structural path and a body excerpt so
 * an independent reviewer can judge definitional coverage without touching
 * the retrieval scores.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  loadCandidates,
  loadDenominator,
  mappingArtifactPath,
} from '@/lib/engineering-textbook-mapping';

const ROOT = process.cwd();
const WORK_REL = 'course-content/authoring/knowledge/engineering-textbook-mapping/review-work';
const BOOKS = [
  'dorf-modern-control-systems',
  'feedback-control-of-dynamic-systems',
  'hu-shousong-auto-control-8th',
] as const;
const BATCH_SIZE = 100;

interface SnapshotObject {
  canonicalId: string;
  canonicalType: string;
  payload: {
    displayName?: unknown;
    description?: unknown;
    payload?: Record<string, unknown>;
  };
}

async function main(): Promise<void> {
  const denominator = loadDenominator(ROOT);
  const candidates = loadCandidates(ROOT);
  const identity = await import('@/lib/authority-domain-shards').then((module) =>
    module.resolveActiveShardIdentity({ repoRoot: ROOT }));
  const { resolveConfiguredAuthorityRoot } = await import('@/lib/authoritative-knowledge/engineering-authority-consumers');
  const { resolveAuthorityStorePaths } = await import('@/lib/authoritative-knowledge/authority-store');
  const authorityPaths = resolveAuthorityStorePaths(resolveConfiguredAuthorityRoot(ROOT));
  const engineeringPath = path.join(
    authorityPaths.releasesDir,
    identity.envelope.authority.snapshotId,
    'engineering.json',
  );
  const engineering = JSON.parse(readFileSync(engineeringPath, 'utf8')) as {
    objects: SnapshotObject[];
  };
  const objectsById = new Map(engineering.objects.map((object) => [object.canonicalId, object]));

  // Body excerpts from the v2 runtime units.
  const excerptByUnit = new Map<string, string>();
  for (const bookId of BOOKS) {
    const unitsPath = path.join(
      ROOT,
      'course-content/runtime/resources/textbooks-v2',
      bookId,
      'units.jsonl',
    );
    for (const line of readFileSync(unitsPath, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const unit = JSON.parse(line) as { id: string; title: string; markdown: string };
      excerptByUnit.set(unit.id, `${unit.title}\n${unit.markdown}`.replace(/\s+/g, ' ').slice(0, 240));
    }
  }

  const byNode = new Map<string, typeof candidates.rows>();
  for (const row of candidates.rows) {
    const list = byNode.get(row.canonicalId) ?? [];
    list.push(row);
    byNode.set(row.canonicalId, list);
  }

  const domainOrder = denominator.domains
    .slice()
    .sort((left, right) => right.objectCount - left.objectCount)
    .map((domain) => domain.domainId);
  const domainRank = new Map(domainOrder.map((domainId, index) => [domainId, index]));
  const orderedNodes = [...byNode.keys()].sort((left, right) => {
    const leftDomain = candidates.rows.find((row) => row.canonicalId === left)!.domainId;
    const rightDomain = candidates.rows.find((row) => row.canonicalId === right)!.domainId;
    return (domainRank.get(leftDomain) ?? 99) - (domainRank.get(rightDomain) ?? 99)
      || left.localeCompare(right);
  });

  const workDir = path.join(ROOT, WORK_REL);
  mkdirSync(workDir, { recursive: true });
  let batchIndex = 0;
  for (let offset = 0; offset < orderedNodes.length; offset += BATCH_SIZE) {
    const slice = orderedNodes.slice(offset, offset + BATCH_SIZE);
    const items = slice.map((canonicalId) => {
      const object = objectsById.get(canonicalId)!;
      const nested = object.payload.payload ?? {};
      const displayName = typeof object.payload.displayName === 'string'
        ? object.payload.displayName
        : String(nested.display_name ?? '');
      const description = typeof object.payload.description === 'string'
        ? object.payload.description
        : String(nested.description ?? '');
      const teaching = Object.fromEntries(
        Object.entries(nested)
          .filter(([key, value]) =>
            typeof value === 'string'
            && value.length > 0
            && value.length < 60
            && !['entity_id', 'entity_type', 'display_name', 'display_name_language', 'display_name_source', 'node_id', 'candidate'].includes(key))
          .slice(0, 4),
      );
      return {
        canonicalId,
        type: object.canonicalType,
        label: displayName.slice(0, 120),
        description: description.slice(0, 160),
        teachingFields: teaching,
        candidates: byNode.get(canonicalId)!.map((row) => ({
          bookId: row.bookId,
          unitId: row.structuralUnitId,
          unitPath: row.structuralPath.join('/'),
          unitTitle: row.unitTitle.slice(0, 100),
          excerpt: (excerptByUnit.get(row.structuralUnitId) ?? '').slice(0, 160),
        })),
      };
    });
    const batchId = `batch-${String(batchIndex).padStart(3, '0')}`;
    writeFileSync(
      path.join(workDir, `${batchId}.json`),
      `${JSON.stringify({ batchId, items }, null, 1)}\n`,
    );
    batchIndex += 1;
  }
  process.stdout.write(`${JSON.stringify({ batches: batchIndex, nodes: orderedNodes.length }, null, 2)}\n`);
}

void main();
