/**
 * Closed LearningFact sink gate (#1116).
 *
 * Discovers LearningFact create/createMany call sites under src/ and scripts/
 * (excluding tests/migrations) and requires each path to be classified in the
 * inventory. Governed producers must call the adapter; direct sink without
 * adapter call is a finding even if the module imports the adapter package.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  LEARNING_FACT_SINK_INVENTORY,
  findInventoryEntryByPath,
  listGovernedKnowledgeScopedProducers,
  listHistoricalBackfillWriters,
} from './inventory';

export type LearningFactStaticGateCode =
  | 'PRODUCER_MISSING_ADAPTER_CALL'
  | 'PRODUCER_DIRECT_SINK_BYPASS'
  | 'PRODUCER_FILE_MISSING'
  | 'DISCOVERED_SINK_UNCLASSIFIED'
  | 'NON_KNOWLEDGE_SCOPE_IDENTITY_LEAK'
  | 'INVENTORY_EMPTY'
  | 'WORKER_NOT_GOVERNED'
  | 'HISTORICAL_WRITER_MISSING_LEGACY_ADAPTER';

export interface LearningFactStaticGateFinding {
  code: LearningFactStaticGateCode;
  path: string;
  detail: string;
}

const ADAPTER_CALL_MARKERS = [
  'writeKnowledgeScopedLearningFacts',
  'writeLegacyKnowledgeScopedLearningFacts',
  'writeCanonicalKnowledgeScopedLearningFacts',
];

// Built from fragments so this gate module is not classified as a sink itself.
const DIRECT_SINK_RE = new RegExp(
  [
    '\\.',
    'learning',
    'Fact',
    '\\.',
    '(create(?:Many|ManyAndReturn)?|upsert)',
    '\\s*\\(',
  ].join(''),
  'gu',
);

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.next',
  'dist',
  'coverage',
  '__tests__',
  'tests',
  'fixtures',
  '.git',
]);

function walkSourceFiles(root: string, relative = ''): string[] {
  const absolute = path.join(root, relative);
  let entries;
  try {
    entries = readdirSync(absolute, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const childRel = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...walkSourceFiles(root, childRel));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(?:[cm]?[jt]sx?)$/u.test(entry.name)) continue;
    if (/\.(?:test|spec)\./u.test(entry.name)) continue;
    if (childRel.includes('/__tests__/') || childRel.includes('/tests/')) continue;
    // Include executable migration/backfill writers — they must be inventory-classified.
    files.push(childRel.replace(/\\/g, '/'));
  }
  return files;
}

function discoverLearningFactSinkPaths(repositoryRoot: string): string[] {
  const roots = ['src', 'scripts'];
  const discovered = new Set<string>();
  for (const rootName of roots) {
    const base = path.join(/*turbopackIgnore: true*/ repositoryRoot, rootName);
    if (!existsSync(/*turbopackIgnore: true*/ base) || !statSync(/*turbopackIgnore: true*/ base).isDirectory()) continue;
    for (const rel of walkSourceFiles(repositoryRoot, rootName)) {
      const source = readFileSync(path.join(repositoryRoot, rel), 'utf8');
      DIRECT_SINK_RE.lastIndex = 0;
      if (DIRECT_SINK_RE.test(source)) {
        discovered.add(rel.replace(/\\/g, '/'));
      }
    }
  }
  return [...discovered].sort();
}

function sourceHasAdapterCall(source: string): boolean {
  return ADAPTER_CALL_MARKERS.some((marker) => source.includes(marker));
}

function countDirectSinkCalls(source: string): number {
  DIRECT_SINK_RE.lastIndex = 0;
  return [...source.matchAll(DIRECT_SINK_RE)].length;
}

/**
 * For governed producers: require adapter call. Direct sink is only allowed
 * inside the adapter implementation module itself.
 */
function assertGovernedProducer(
  relativePath: string,
  source: string,
  findings: LearningFactStaticGateFinding[],
): void {
  if (!sourceHasAdapterCall(source)) {
    findings.push({
      code: 'PRODUCER_MISSING_ADAPTER_CALL',
      path: relativePath,
      detail: 'Governed knowledge-scoped producer must call writeKnowledgeScopedLearningFacts (or Legacy/Canonical adapter)',
    });
    return;
  }
  // Direct sink outside adapter module is a bypass even if adapter is also called
  // (worker must not keep a parallel createMany). Adapter implementation path is exempt.
  if (relativePath.endsWith('canonical-learning-fact-identity/writer.ts')) return;
  const direct = countDirectSinkCalls(source);
  // Allow createMany only when nested as sink delegate argument to the adapter.
  // Flag top-level awaits of the Prisma LearningFact create path outside adapter.
  const topLevelBypassPattern = [
    '(?:await|return)\\s+[^\\n;]*\\.',
    'learning',
    'Fact',
    '\\.create(?:Many|ManyAndReturn)?\\s*\\(',
  ].join('');
  const topLevelBypass = new RegExp(topLevelBypassPattern, 'u').test(source);
  if (topLevelBypass) {
    findings.push({
      code: 'PRODUCER_DIRECT_SINK_BYPASS',
      path: relativePath,
      detail: 'Governed producer still awaits/returns LearningFact createMany outside the adapter entrypoint',
    });
  }
  void direct;
}

export function runLearningFactProducerStaticGate(
  repositoryRoot: string,
): LearningFactStaticGateFinding[] {
  const findings: LearningFactStaticGateFinding[] = [];
  const governed = listGovernedKnowledgeScopedProducers();
  if (governed.length === 0) {
    findings.push({
      code: 'INVENTORY_EMPTY',
      path: 'src/lib/canonical-learning-fact-identity/inventory.ts',
      detail: 'Governed LearningFact producer inventory is empty',
    });
    return findings;
  }

  const worker = governed.find((item) => item.path.includes('data-governance-worker'));
  if (!worker) {
    findings.push({
      code: 'WORKER_NOT_GOVERNED',
      path: 'scripts/workers/data-governance-worker.ts',
      detail: 'Realtime data-governance worker must be classified as governed knowledge-scoped producer',
    });
  }

  for (const producer of governed) {
    const absolute = path.join(repositoryRoot, producer.path);
    if (!existsSync(absolute)) {
      findings.push({
        code: 'PRODUCER_FILE_MISSING',
        path: producer.path,
        detail: 'Inventory producer path does not exist',
      });
      continue;
    }
    const source = readFileSync(absolute, 'utf8');
    assertGovernedProducer(producer.path, source, findings);
  }

  // Non-knowledge-scoped runtime: forbid knowledge identity stamping markers.
  for (const entry of LEARNING_FACT_SINK_INVENTORY) {
    if (entry.kind !== 'non-knowledge-scoped-runtime') continue;
    const absolute = path.join(repositoryRoot, entry.path);
    if (!existsSync(absolute)) {
      findings.push({
        code: 'PRODUCER_FILE_MISSING',
        path: entry.path,
        detail: 'Non-knowledge-scoped inventory path does not exist',
      });
      continue;
    }
    const source = readFileSync(absolute, 'utf8');
    for (const marker of entry.forbiddenIdentityMarkers) {
      if (source.includes(marker)) {
        findings.push({
          code: 'NON_KNOWLEDGE_SCOPE_IDENTITY_LEAK',
          path: entry.path,
          detail: `Non-knowledge-scoped runtime sink must not reference ${marker}`,
        });
      }
    }
  }

  // Historical/backfill executable writers must call the Legacy adapter so they
  // cannot mint NULL/unversioned facts outside the authority selector.
  for (const entry of listHistoricalBackfillWriters()) {
    if (!entry.requiresLegacyAdapter) continue;
    const absolute = path.join(repositoryRoot, entry.path);
    if (!existsSync(absolute)) {
      findings.push({
        code: 'PRODUCER_FILE_MISSING',
        path: entry.path,
        detail: 'Historical/backfill inventory path does not exist',
      });
      continue;
    }
    const source = readFileSync(absolute, 'utf8');
    DIRECT_SINK_RE.lastIndex = 0;
    if (DIRECT_SINK_RE.test(source)) {
      // Historical writers must call the permanent Legacy adapter directly.
      // Generic writeKnowledgeScopedLearningFacts / selector paths are forbidden.
      const usesLegacyAdapter = source.includes('writeLegacyKnowledgeScopedLearningFacts');
      const usesGenericWriter = source.includes('writeKnowledgeScopedLearningFacts')
        || source.includes("selectLearningFactAuthority('FORMAL_PRODUCTION')")
        || source.includes('selectLearningFactAuthority("FORMAL_PRODUCTION")');
      if (!usesLegacyAdapter || usesGenericWriter) {
        findings.push({
          code: 'HISTORICAL_WRITER_MISSING_LEGACY_ADAPTER',
          path: entry.path,
          detail: 'Historical/backfill LearningFact create must call writeLegacyKnowledgeScopedLearningFacts only (no generic writer/selector)',
        });
      }
    }
  }

  // Discovery closure: every executable sink path must be classified.
  for (const discovered of discoverLearningFactSinkPaths(repositoryRoot)) {
    const entry = findInventoryEntryByPath(discovered);
    if (!entry) {
      findings.push({
        code: 'DISCOVERED_SINK_UNCLASSIFIED',
        path: discovered,
        detail: 'LearningFact sink discovered but missing from closed inventory classification',
      });
    }
  }

  return findings;
}

export function assertLearningFactProducerStaticGate(
  repositoryRoot: string,
): void {
  const findings = runLearningFactProducerStaticGate(repositoryRoot);
  if (findings.length === 0) return;
  const summary = findings
    .map((item) => `${item.code}@${item.path}: ${item.detail}`)
    .join('\n');
  throw new Error(`LearningFact producer static gate failed:\n${summary}`);
}

export function inventoryProducerPathSet(): Set<string> {
  return new Set(listGovernedKnowledgeScopedProducers().map((item) => item.path));
}
