#!/usr/bin/env tsx
/**
 * #2043 tasks 2.2/4.1 inputs — emit governed crosswalk v2 rows and the
 * materialization sources input from the passed coverage gate.
 *
 * Crosswalk rows bind the active v0.37 Authority identity from the sealed
 * bundle manifest; sources entries are capped per node at the governed limit
 * with the cap recorded on the artifact.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  assertCoverageGate,
  computeCoverage,
  artifactDigest,
  buildGovernedSourcesEntries,
  candidateKeyOf,
  effectiveVerdicts,
  loadCandidates,
  loadDenominator,
  loadExceptionLedger,
  loadReviewLedger,
  mappingArtifactPath,
  MAPPING_SOURCES_INPUT_CONTRACT,
  NODE_SOURCES_LIMIT,
  sourceDocumentIdForReaderBook,
  type MappingCandidateRow,
} from '@/lib/engineering-textbook-mapping';
import { TEXTBOOK_LOCATOR_CROSSWALK_CONTRACT_V2 } from '@/lib/teaching-projection/textbook-locators/contracts';

const ROOT = process.cwd();
const CROSSWALK_REL = 'course-content/authoring/knowledge/teaching-projection/textbook-locators/source-resource-crosswalk.jsonl';
const BUNDLE_MANIFEST_REL = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.37-r4/bundle-manifest.json';

interface BundleManifest {
  release: { release_id: string; release_hash: string };
  bundle_digest: string;
  source_revision: { commit: string };
}

function main(): void {
  const denominator = loadDenominator(ROOT);
  const candidates = loadCandidates(ROOT);
  const reviews = loadReviewLedger({ filePath: mappingArtifactPath(ROOT, 'reviews.jsonl') });
  const exceptions = loadExceptionLedger({ filePath: mappingArtifactPath(ROOT, 'exceptions.jsonl') });

  const bundle = JSON.parse(
    readFileSync(path.join(ROOT, BUNDLE_MANIFEST_REL), 'utf8'),
  ) as BundleManifest;
  if (bundle.release.release_id !== denominator.authorityReleaseId) {
    throw new Error(`bundle manifest release ${bundle.release.release_id} != denominator ${denominator.authorityReleaseId}`);
  }

  const computation = computeCoverage({
    denominator,
    candidates,
    reviews,
    exceptions,
    generatedAt: new Date().toISOString(),
  });
  assertCoverageGate(computation.coverage);

  const verdicts = effectiveVerdicts(reviews);
  const rowsByNode = new Map<string, MappingCandidateRow[]>();
  for (const row of candidates.rows) {
    if (verdicts.get(candidateKeyOf(row))?.verdict !== 'approved') continue;
    const list = rowsByNode.get(row.canonicalId) ?? [];
    list.push(row);
    rowsByNode.set(row.canonicalId, list);
  }

  // Crosswalk rows aggregate per structural unit; sources cap per node.
  const unitRow = new Map<string, {
    sourceDocumentId: string;
    bookId: string;
    edition: string;
    structuralUnitId: string;
    structuralPath: string[];
    unitTitle: string;
    canonicalIds: string[];
  }>();
  let cappedNodes = 0;

  for (const canonicalId of [...rowsByNode.keys()].sort()) {
    const rows = rowsByNode.get(canonicalId)!
      .slice()
      .sort((left, right) => left.rank - right.rank);
    const capped = rows.slice(0, NODE_SOURCES_LIMIT);
    if (rows.length > NODE_SOURCES_LIMIT) cappedNodes += 1;
    for (const row of capped) {
      const sourceEditionId = sourceDocumentIdForReaderBook(row.bookId);
      const key = row.structuralUnitId;
      const crosswalkRow = unitRow.get(key);
      if (crosswalkRow) {
        if (!crosswalkRow.canonicalIds.includes(canonicalId)) crosswalkRow.canonicalIds.push(canonicalId);
      } else {
        unitRow.set(key, {
          sourceDocumentId: sourceEditionId,
          bookId: row.bookId,
          edition: row.edition,
          structuralUnitId: row.structuralUnitId,
          structuralPath: row.structuralPath,
          unitTitle: row.unitTitle,
          canonicalIds: [canonicalId],
        });
      }
    }
  }

  const entries = buildGovernedSourcesEntries({
    candidateRows: candidates.rows,
    reviews,
    nodeLimit: NODE_SOURCES_LIMIT,
  });

  const crosswalkLines = [...unitRow.values()]
    .sort((left, right) => left.structuralUnitId.localeCompare(right.structuralUnitId))
    .map((row) => JSON.stringify({
      contract: TEXTBOOK_LOCATOR_CROSSWALK_CONTRACT_V2,
      sourceDocumentId: row.sourceDocumentId,
      bookId: row.bookId,
      edition: row.edition,
      structuralUnitId: row.structuralUnitId,
      structuralPath: row.structuralPath,
      unitTitle: row.unitTitle,
      canonicalIds: [...row.canonicalIds].sort(),
      accessMode: 'REFERENCE_ONLY',
      authorityReleaseId: bundle.release.release_id,
      authorityReleaseHash: bundle.release.release_hash,
      bundleDigest: bundle.bundle_digest,
      captureRevision: bundle.source_revision.commit,
    }));

  const existing = readFileSync(path.join(ROOT, CROSSWALK_REL), 'utf8');
  const existingContracts = existing
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => { const parsed = JSON.parse(line); return parsed.contract ?? null; });
  if (existingContracts.some((value) => value === TEXTBOOK_LOCATOR_CROSSWALK_CONTRACT_V2)) {
    throw new Error('source-resource-crosswalk.jsonl already carries v2 rows; regenerate from a clean sidecar');
  }
  writeFileSync(
    path.join(ROOT, CROSSWALK_REL),
    existing.trimEnd() + '\n' + crosswalkLines.join('\n') + '\n',
  );

  const sourcesInput = {
    contract: MAPPING_SOURCES_INPUT_CONTRACT,
    authorityReleaseId: denominator.authorityReleaseId,
    coverageDigest: artifactDigest(mappingArtifactPath(ROOT, 'coverage.json')),
    nodeLimit: NODE_SOURCES_LIMIT,
    entries,
  };
  const sourcesPath = mappingArtifactPath(ROOT, 'sources-input.json');
  mkdirSync(path.dirname(sourcesPath), { recursive: true });
  writeFileSync(sourcesPath, `${JSON.stringify(sourcesInput, null, 2)}\n`);

  process.stdout.write(`${JSON.stringify({
    crosswalkV2Rows: crosswalkLines.length,
    nodesWithSources: entries.length,
    nodesCapped: cappedNodes,
    approvedNodes: rowsByNode.size,
  }, null, 2)}\n`);
}

void main();
