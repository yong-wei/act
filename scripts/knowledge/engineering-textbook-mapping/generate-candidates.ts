#!/usr/bin/env tsx
/**
 * #2043 task 1.2 — generate mapping candidates by hybrid retrieval recall.
 *
 * Every denominator object queries the textbook hybrid retrieval index
 * (bge-m3 vectors + BM25 lexical) scoped to the three extraction-source
 * books, augmented by the governed act-crosswalk retrieval-term lexicon.
 * Candidates are recall only — approval always requires independent review.
 */

import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { join } from 'node:path';

import { extractProfileRetrievalTerms } from '@/lib/aggregate-governance/act-crosswalk';
import { resolveActiveShardIdentity } from '@/lib/authority-domain-shards';
import { resolveConfiguredAuthorityRoot } from '@/lib/authoritative-knowledge/engineering-authority-consumers';
import { resolveAuthorityStorePaths } from '@/lib/authoritative-knowledge/authority-store';
import {
  loadStructuralUnitIndex,
  MAPPING_CANDIDATES_CONTRACT,
  loadDenominator,
  mappingArtifactPath,
  resolveStructuralUnit,
  sha256Text,
  type MappingCandidateRow,
} from '@/lib/engineering-textbook-mapping';
import {
  retrieveTextbookHybrid,
  SiliconFlowTextbookEmbeddingClient,
} from '@/lib/textbook-retrieval';
import type { TextbookEmbeddingClient } from '@/lib/textbook-retrieval';

const ROOT = process.cwd();
const INDEX_ROOT = path.join(ROOT, 'course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3');
const SCOPED_BOOKS = [
  'dorf-modern-control-systems',
  'feedback-control-of-dynamic-systems',
  'hu-shousong-auto-control-8th',
] as const;
const TOP_K = 4;
const CONCURRENCY = 12;

interface SnapshotObject {
  canonicalId: string;
  canonicalType: string;
  payload: {
    displayName?: unknown;
    description?: unknown;
    payload?: Record<string, unknown>;
  };
}

function objectQuery(object: SnapshotObject): string {
  const nested = object.payload.payload ?? {};
  const displayName = typeof object.payload.displayName === 'string'
    ? object.payload.displayName
    : typeof nested.display_name === 'string' ? nested.display_name : '';
  const description = typeof object.payload.description === 'string'
    ? object.payload.description
    : typeof nested.description === 'string' ? nested.description : '';
  const terms = extractProfileRetrievalTerms([displayName, description].join('\n')).slice(0, 12);
  const teachingValues = Object.values(nested)
    .filter((value): value is string => typeof value === 'string' && value.length >= 2)
    .slice(0, 8);
  return [displayName, description.slice(0, 200), ...teachingValues, ...terms]
    .filter((part) => part && part.trim().length > 0)
    .join(' ')
    .slice(0, 600);
}

async function main(): Promise<void> {
  const limitIndex = process.argv.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : Number.POSITIVE_INFINITY;
  const denominator = loadDenominator(ROOT);
  const identity = resolveActiveShardIdentity({ repoRoot: ROOT });
  const authorityPaths = resolveAuthorityStorePaths(resolveConfiguredAuthorityRoot(ROOT));
  const engineeringPath = join(
    authorityPaths.releasesDir,
    identity.envelope.authority.snapshotId,
    'engineering.json',
  );
  const engineering = JSON.parse(readFileSync(engineeringPath, 'utf8')) as {
    objects: SnapshotObject[];
  };
  const objectsById = new Map(engineering.objects.map((object) => [object.canonicalId, object]));

  const domainByNode = new Map<string, string>();
  for (const domain of denominator.domains) {
    for (const id of domain.canonicalIds) domainByNode.set(id, domain.domainId);
  }

  const structuralIndex = await loadStructuralUnitIndex({ bookIds: SCOPED_BOOKS });
  const embeddingClient: TextbookEmbeddingClient = new SiliconFlowTextbookEmbeddingClient();
  const rows: MappingCandidateRow[] = [];
  const failures: Array<{ canonicalId: string; error: string }> = [];

  const queue = [...new Set(domainByNode.keys())].sort().slice(0, Number.isFinite(limit) ? limit : undefined);
  let cursor = 0;
  let processed = 0;

  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      const canonicalId = queue[cursor++]!;
      const object = objectsById.get(canonicalId);
      if (!object) {
        failures.push({ canonicalId, error: 'object missing from snapshot' });
        continue;
      }
      const query = objectQuery(object);
      try {
        const response = await retrieveTextbookHybrid(query, {
          indexRoot: INDEX_ROOT,
          topK: TOP_K,
          candidateCount: 24,
          scope: SCOPED_BOOKS.map((bookId) => ({ bookId })),
          embeddingClient,
        });
        for (const result of response.results) {
          const unit = resolveStructuralUnit(structuralIndex, {
            bookId: result.bookId,
            structuralUnitId: result.primaryUnitId,
          });
          rows.push({
            canonicalId,
            domainId: domainByNode.get(canonicalId) ?? '',
            structuralUnitId: unit.unitId,
            bookId: unit.bookId,
            edition: unit.edition,
            structuralPath: unit.structuralPath,
            unitTitle: unit.title,
            rank: response.results.indexOf(result) + 1,
            recallQuery: query,
            lexicalScore: result.scores.lexical ?? null,
            vectorScore: result.scores.vector ?? null,
          });
        }
      } catch (error) {
        failures.push({
          canonicalId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      processed += 1;
      if (processed % 500 === 0) {
        process.stderr.write(`recall progress ${processed}/${queue.length}\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  if (failures.length > 0) {
    throw new Error(`candidate recall failed for ${failures.length} objects (first: ${failures[0]!.canonicalId}: ${failures[0]!.error})`);
  }

  rows.sort((left, right) =>
    left.canonicalId.localeCompare(right.canonicalId) || left.rank - right.rank);

  const candidates = {
    contract: MAPPING_CANDIDATES_CONTRACT,
    authorityReleaseId: denominator.authorityReleaseId,
    denominatorDigest: sha256Text(readFileSync(mappingArtifactPath(ROOT, 'denominator.json'), 'utf8')),
    generatorVersion: 'engineering-textbook-candidates/v1',
    generatedAt: new Date().toISOString(),
    rows,
  };

  const outPath = mappingArtifactPath(ROOT, 'candidates.json');
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(candidates, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    objects: queue.length,
    candidateRows: rows.length,
    objectsWithCandidates: new Set(rows.map((row) => row.canonicalId)).size,
  }, null, 2)}\n`);
}

void main();
