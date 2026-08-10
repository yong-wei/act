#!/usr/bin/env tsx

/** Materialize ACT-owned BOPPPS decisions for the first ActKG cutover. */

import path from 'node:path';

import {
  assertBlueprintBindingsMatchRevision,
  buildActkgCutoverBlueprintAuthorDecisions,
  loadActkgCutoverBlueprintBindings,
} from '../../src/lib/teaching-projection/actkg-cutover-blueprint-bindings';
import {
  defaultAuthorDecisionsPath,
  writeAuthorDecisionsJsonl,
} from '../../src/lib/teaching-projection/author-decisions';
import { loadCardCrosswalk } from '../../src/lib/teaching-projection/cards/crosswalk';
import { loadLegacyCrosswalk } from '../../src/lib/teaching-projection/crosswalk';
import type { ActiveCardMappingEntry, MappingContext } from '../../src/lib/teaching-projection/migration-contracts';
import {
  buildTeachingProjectionCandidate,
  loadStagedAuthority,
} from './prepare-actkg-cutover-teaching-projection';

const COMMIT = /^[a-f0-9]{40}$/u;

function requiredOption(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  if (!value || value.startsWith('--')) throw new Error(`${name} is required`);
  return value;
}

function main(): void {
  const repoRoot = path.resolve(requiredOption('--repo-root'));
  const authoringRevision = requiredOption('--authoring-revision');
  const authorityManifestPath = path.resolve(requiredOption('--authority-manifest'));
  if (!COMMIT.test(authoringRevision)) {
    throw new Error('--authoring-revision must be a 40-character Git SHA');
  }

  const bindings = loadActkgCutoverBlueprintBindings({ repoRoot });
  assertBlueprintBindingsMatchRevision({ repoRoot, authoringRevision });
  const authority = loadStagedAuthority({
    manifestPath: authorityManifestPath,
    authorityCaptureRevision: authoringRevision,
  });
  const legacy = loadLegacyCrosswalk(path.join(
    repoRoot,
    'course-content/authoring/knowledge/teaching-projection/legacy-crosswalk.jsonl',
  ));
  const cardDocument = loadCardCrosswalk(path.join(
    repoRoot,
    'course-content/authoring/knowledge/teaching-projection/cards/card-crosswalk.jsonl',
  ));
  const cards: ActiveCardMappingEntry[] = cardDocument.entries.map((entry) => ({
    cardId: entry.cardId ?? entry.legacyNodeId,
    canonicalId: entry.canonicalId,
    active: !entry.stale,
    legacyNodeId: entry.legacyNodeId,
  }));
  const initial = buildTeachingProjectionCandidate({
    repoRoot,
    authoringRevision,
    authority,
    crosswalk: legacy.entries,
    cards,
    authorDecisionContextDigest: bindings.digest,
    assertRealInventoryCounts: true,
  });
  const context: MappingContext = {
    crosswalk: legacy.entries,
    cards,
    authorityLabels: initial.authorityLabels,
    authorityCanonicalIds: new Set(initial.authorityNodes
      .filter((node) => !['retired', 'draft'].includes(String(node.lifecycleStatus).toLowerCase()))
      .map((node) => node.canonicalId)),
    authorDecisions: [],
    authorDecisionContextDigest: bindings.digest,
  };
  const decisions = buildActkgCutoverBlueprintAuthorDecisions({
    repoRoot,
    inventory: initial.inventory,
    records: initial.migration.records,
    mappingContext: context,
    bindings,
  });
  const decisionPath = defaultAuthorDecisionsPath(path.join(
    repoRoot,
    'course-content/authoring/knowledge/teaching-projection',
  ));
  writeAuthorDecisionsJsonl(decisionPath, decisions);
  const resolved = buildTeachingProjectionCandidate({
    repoRoot,
    authoringRevision,
    authority,
    crosswalk: legacy.entries,
    cards,
    authorDecisions: decisions,
    authorDecisionContextDigest: bindings.digest,
    assertRealInventoryCounts: true,
  });
  if (resolved.migration.summary.reviewRequiredCount !== 0 || !resolved.packageReports.every((report) => report.ready)) {
    throw new Error('derived decisions did not resolve every active package');
  }
  process.stdout.write(`${JSON.stringify({
    authoringRevision,
    authorityReleaseId: authority.manifest.releaseId,
    authoritySnapshotId: authority.manifest.snapshotId,
    blueprintBindingsDigest: bindings.digest,
    decisionPath: path.relative(repoRoot, decisionPath),
    decisionCount: decisions.length,
    migration: resolved.migration.summary,
    packageReadyCount: resolved.packageReports.filter((report) => report.ready).length,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
