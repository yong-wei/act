#!/usr/bin/env tsx

/**
 * Rebuild the inactive v0.22 domain display catalog from the admitted composite
 * envelope. Never writes production catalog or current pointers.
 */

import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  V022_CURRENT_POINTER_PATHS,
  V022_DOMAIN_CATALOG_CANDIDATE_RELATIVE,
  buildV022DomainCatalogAuthoring,
  loadPinnedV022Envelope,
} from '../../src/lib/actkg-v022-display-projections';
import { catalogCanonicalJson } from '../../src/lib/authority-domain-catalog';
import { sha256 } from '../actkg-release/authoritative-release';

const PRODUCTION_AUTHORING =
  'course-content/authoring/knowledge/authority-domain-catalog/catalog.json';
const PRODUCTION_RUNTIME =
  'course-content/runtime/knowledge/authority-domain-catalog/catalog.json';

function snapshotPointers(repoRoot: string): Array<{
  relativePath: string;
  exists: boolean;
  sha256: string | null;
  byteLength: number | null;
}> {
  return V022_CURRENT_POINTER_PATHS.map((relativePath) => {
    const absolute = path.join(repoRoot, relativePath);
    if (!existsSync(absolute)) {
      return { relativePath, exists: false, sha256: null, byteLength: null };
    }
    const bytes = readFileSync(absolute);
    return {
      relativePath,
      exists: true,
      sha256: sha256(bytes),
      byteLength: bytes.byteLength,
    };
  });
}

export function prepareV022DisplayCatalog(repoRoot = process.cwd()): {
  envelopeSnapshotId: string;
  catalogId: string;
  catalogHash: string;
  domainCount: number;
  membershipCount: number;
  publishedConceptCount: number;
  pointersUnchanged: true;
} {
  const envelope = loadPinnedV022Envelope(repoRoot);
  const before = snapshotPointers(repoRoot);
  const built = buildV022DomainCatalogAuthoring({ repoRoot, envelope });
  const after = snapshotPointers(repoRoot);
  if (catalogCanonicalJson(before) !== catalogCanonicalJson(after)) {
    throw new Error('v0.22 display catalog rebuild moved a production pointer');
  }
  const outputRoot = path.join(repoRoot, V022_DOMAIN_CATALOG_CANDIDATE_RELATIVE);
  mkdirSync(outputRoot, { recursive: true });
  const authoringPath = path.join(outputRoot, 'catalog.json');
  const runtimePath = path.join(outputRoot, 'runtime.json');
  const receiptPath = path.join(outputRoot, 'candidate-receipt.json');
  const authoringBytes = Buffer.from(`${catalogCanonicalJson(built.authoring)}\n`);
  const runtimeBytes = Buffer.from(`${catalogCanonicalJson(built.runtime)}\n`);
  const receipt = {
    protocol: 'actkg-v022-display-catalog/1',
    status: 'staged',
    nonActivation: true,
    envelope,
    catalogId: built.runtime.catalogId,
    catalogHash: built.runtime.catalogHash,
    domainCount: built.runtime.domains.length,
    membershipCount: built.runtime.memberships.length,
    publishedConceptCount: built.publishedConceptCount,
    orphanCount: built.orphanCount,
    outputs: [
      { path: path.relative(repoRoot, authoringPath), sha256: sha256(authoringBytes) },
      { path: path.relative(repoRoot, runtimePath), sha256: sha256(runtimeBytes) },
    ],
    pointers: { before, after, unchanged: true },
    productionAuthoringUntouched: sha256(readFileSync(path.join(repoRoot, PRODUCTION_AUTHORING))),
    productionRuntimeUntouched: existsSync(path.join(repoRoot, PRODUCTION_RUNTIME))
      ? sha256(readFileSync(path.join(repoRoot, PRODUCTION_RUNTIME)))
      : null,
  };
  writeFileSync(authoringPath, authoringBytes);
  writeFileSync(runtimePath, runtimeBytes);
  writeFileSync(receiptPath, `${catalogCanonicalJson(receipt)}\n`);
  return {
    envelopeSnapshotId: envelope.snapshotId,
    catalogId: built.runtime.catalogId,
    catalogHash: built.runtime.catalogHash,
    domainCount: built.runtime.domains.length,
    membershipCount: built.runtime.memberships.length,
    publishedConceptCount: built.publishedConceptCount,
    pointersUnchanged: true,
  };
}

function main(): void {
  const argv = process.argv.slice(2);
  const repoRoot = argv.includes('--repo-root')
    ? argv[argv.indexOf('--repo-root') + 1]
    : execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  process.stdout.write(`${catalogCanonicalJson(prepareV022DisplayCatalog(repoRoot))}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
