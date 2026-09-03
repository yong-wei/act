import { matchingOwners } from '@/lib/architecture-charter/assign';
import { REQUIRED_BASELINE, type OwnerId } from '@/lib/architecture-charter/types';

import { currentOwnerEvidence as ownerEvidenceFromPath, isTestPath } from './classify';
import { generateCensusCore } from './generate';
import { resolveImport } from './imports';
import { privacyViolation } from './privacy';
import { serializeDeterministic, sha256Text, stableId } from './serialize';
import type {
  CaptureIdentity,
  CensusCore,
  CensusObservation,
  CensusSourceSnapshot,
  DenominatorTotals,
  QualificationFailure,
} from './types';

export const CURRENT_HEAD_DELTA_SCHEMA_VERSION = 'act-architecture-current-head-delta/v1' as const;
export const CURRENT_HEAD_COMMAND_SCOPE = 'current-head-delta:assessment-adaptive-personalization';
export const CURRENT_HEAD_OUTPUT_DIR = 'docs/architecture/modular-monolith/current-head';

const SCOPE_PREFIXES = [
  'src/features/adaptive/',
  'src/features/adaptive-assessment/',
  'src/features/assessment/',
  'src/features/personalization/path-planning/',
  'src/features/personalization/learner-state/',
  'src/lib/adaptive-planning/',
] as const;

const NAMED_HOTSPOTS = [
  'src/features/personalization/path-planning/internal/assemble-plan.ts',
  'src/features/personalization/learner-state/internal.ts',
] as const;

const DELETION_UNRESOLVED = 'zero-production-consumers-and-canonical-owner-replacement-proven';
const ROLLBACK = `predecessor:${REQUIRED_BASELINE.sourceCommit}`;

export type CurrentHeadCategory = 'owner-conflict' | 'retirement' | 'hotspot';
export type CurrentHeadConsumerKind =
  | 'production'
  | 'test'
  | 'toolchain'
  | 'dynamic-load'
  | 're-export'
  | 'documentation'
  | 'historical';
export type CurrentHeadConsumerClass =
  | 'production'
  | 'test-only'
  | 'toolchain'
  | 'none-discovered'
  | 'unresolved';

export interface CurrentHeadPredecessor {
  readonly schemaVersion: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly censusCoreSha256: string;
  readonly receiptSchemaVersion: string;
  readonly receiptIds: readonly string[];
}

export interface CurrentHeadConsumer {
  readonly path: string;
  readonly kind: CurrentHeadConsumerKind;
  readonly relationship: 'import' | 'dynamic-load' | 're-export' | 'route' | 'worker' | 'script' | 'test' | 'mention';
}

export interface CurrentHeadRecord {
  readonly id: string;
  readonly category: CurrentHeadCategory;
  readonly identity: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly currentOwnerEvidence: readonly string[];
  readonly candidateTargetOwners: readonly string[];
  readonly consumers: readonly CurrentHeadConsumer[];
  readonly consumerClass: CurrentHeadConsumerClass;
  readonly deletionCondition: string;
  readonly rollbackReference: string;
  readonly evidence: readonly string[];
  readonly trustBoundary: string | null;
  readonly observationVsFinding: 'observation' | 'unresolved';
  readonly notes: readonly string[];
  readonly attributes: Readonly<Record<string, string | number | boolean | null>>;
}

export interface CurrentHeadOpenSpecConflict {
  readonly changeIds: readonly string[];
  readonly overlapKind: 'path' | 'owner' | 'deletion-set' | 'contract' | 'predecessor-delta';
  readonly paths: readonly string[];
  readonly orderImplication: string;
  readonly resolutionCondition: string;
}

export interface CurrentHeadPackage {
  readonly schemaVersion: typeof CURRENT_HEAD_DELTA_SCHEMA_VERSION;
  readonly captureIdentity: CaptureIdentity;
  readonly captureTime: string;
  readonly predecessor: CurrentHeadPredecessor;
  readonly commandScope: typeof CURRENT_HEAD_COMMAND_SCOPE;
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly slices: Readonly<Record<CurrentHeadCategory, DenominatorTotals>>;
  readonly records: readonly CurrentHeadRecord[];
  readonly openspecConflicts: readonly CurrentHeadOpenSpecConflict[];
  readonly exclusions: readonly string[];
}

export interface CurrentHeadFiles {
  readonly 'summary.md': string;
  readonly 'owner-conflicts.md': string;
  readonly 'retirement-candidates.md': string;
  readonly 'hotspot-priority.md': string;
  readonly 'delta.json': string;
}

function inScopePath(path: string): boolean {
  if (SCOPE_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  return /^src\/lib\/adaptive-[^/]+\.(?:ts|tsx)$/u.test(path);
}

function productionSource(path: string): boolean {
  return inScopePath(path) && !isTestPath(path) && /\.(?:ts|tsx)$/u.test(path);
}

function consumerKind(path: string): CurrentHeadConsumerKind {
  if (path.startsWith('openspec/changes/archive/')) return 'historical';
  if (isTestPath(path)) return 'test';
  if (path.startsWith('scripts/')) return 'toolchain';
  if (path.startsWith('docs/') || path.startsWith('openspec/')) return 'documentation';
  return 'production';
}

function consumerClassOf(consumers: readonly CurrentHeadConsumer[]): CurrentHeadConsumerClass {
  const live = consumers.filter((item) => item.kind !== 'historical' && item.kind !== 'documentation');
  if (live.some((item) => item.kind === 'production')) return 'production';
  if (live.some((item) => item.kind === 'test')) return 'test-only';
  if (live.some((item) => item.kind === 'toolchain' || item.kind === 'dynamic-load' || item.kind === 're-export')) {
    return live.some((item) => item.kind === 'toolchain') ? 'toolchain' : 'unresolved';
  }
  return live.length === 0 ? 'none-discovered' : 'unresolved';
}

function totals(discovered: number, represented: number, unresolved: number): DenominatorTotals {
  return {
    discovered,
    represented,
    excluded: Math.max(0, discovered - represented - unresolved),
    duplicate: 0,
    unresolved,
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function cell(value: string): string {
  return value.replaceAll('|', '/').replaceAll('\n', ' ');
}

function table(headers: readonly string[], body: readonly (readonly string[])[]): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

function ownersFor(identity: string, extra: readonly string[] = []): string[] {
  return uniqueSorted(matchingOwners([identity, ...extra].join(' ')));
}

function hitsTarget(to: string, identities: readonly string[]): boolean {
  return identities.some((identity) => to === identity || to.startsWith(`${identity}/`) || identity === to);
}

function relationshipFor(
  from: string,
  to: string,
  snapshot: CensusSourceSnapshot,
): CurrentHeadConsumer['relationship'] {
  if (isTestPath(from)) return 'test';
  if (from.startsWith('src/app/') && /\/route\.ts$/u.test(from)) return 'route';
  if (from.startsWith('scripts/')) return 'script';
  const content = snapshot.files.find((file) => file.path === from)?.content ?? '';
  const names = new Set(snapshot.files.map((file) => file.path));
  for (const match of content.matchAll(/export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/gu)) {
    if (resolveImport(from, match[1]!, names).to === to) return 're-export';
  }
  for (const match of content.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/gu)) {
    if (resolveImport(from, match[1]!, names).to === to) return 'dynamic-load';
  }
  return 'import';
}

function censusConsumers(
  core: CensusCore,
  identities: readonly string[],
  snapshot: CensusSourceSnapshot,
): CurrentHeadConsumer[] {
  const found = new Map<string, CurrentHeadConsumer>();
  for (const row of core.observations) {
    if (row.kind !== 'dependency-edge' && row.kind !== 'deep-import') continue;
    const from = String(row.attributes.from ?? '');
    const to = String(row.attributes.to ?? '');
    if (!hitsTarget(to, identities) || !from || from === to) continue;
    const kind = consumerKind(from);
    const relationship = relationshipFor(from, to, snapshot);
    const key = `${from}:${kind}:${relationship}`;
    if (!found.has(key)) {
      found.set(key, { path: from, kind, relationship });
    }
  }
  const names = new Set(snapshot.files.map((file) => file.path));
  for (const file of snapshot.files) {
    if (!file.content) continue;
    for (const match of file.content.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/gu)) {
      const to = resolveImport(file.path, match[1]!, names).to;
      if (!to || !hitsTarget(to, identities) || file.path === to) continue;
      const kind = consumerKind(file.path);
      const relationship = relationshipFor(file.path, to, snapshot);
      const key = `${file.path}:${kind}:${relationship}`;
      if (!found.has(key)) {
        found.set(key, { path: file.path, kind, relationship });
      }
    }
  }
  return [...found.values()].sort((left, right) => left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind));
}

function mentionConsumers(files: CensusSourceSnapshot['files'], identities: readonly string[]): CurrentHeadConsumer[] {
  const found: CurrentHeadConsumer[] = [];
  for (const file of files) {
    if (!file.content || productionSource(file.path)) continue;
    if (!identities.some((identity) => file.content.includes(identity))) continue;
    const kind = consumerKind(file.path);
    if (kind === 'production') continue;
    found.push({
      path: file.path,
      kind,
      relationship: 'mention',
    });
  }
  return found.sort((left, right) => left.path.localeCompare(right.path));
}

function mergeConsumers(...groups: readonly (readonly CurrentHeadConsumer[])[]): CurrentHeadConsumer[] {
  const found = new Map<string, CurrentHeadConsumer>();
  for (const group of groups) {
    for (const item of group) {
      const key = `${item.path}:${item.kind}:${item.relationship}`;
      if (!found.has(key)) found.set(key, item);
    }
  }
  return [...found.values()].sort((left, right) => left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind));
}

function record(input: Omit<CurrentHeadRecord, 'id' | 'sourceCommit' | 'sourceTree' | 'consumerClass'> & {
  id?: string;
  sourceCommit: string;
  sourceTree: string;
}): CurrentHeadRecord {
  const consumers = [...input.consumers].sort((left, right) => left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind));
  return {
    id: input.id ?? stableId(input.category, input.identity),
    category: input.category,
    identity: input.identity,
    sourceCommit: input.sourceCommit,
    sourceTree: input.sourceTree,
    currentOwnerEvidence: uniqueSorted(input.currentOwnerEvidence),
    candidateTargetOwners: uniqueSorted(input.candidateTargetOwners),
    consumers,
    consumerClass: consumerClassOf(consumers),
    deletionCondition: input.deletionCondition,
    rollbackReference: input.rollbackReference,
    evidence: uniqueSorted(input.evidence),
    trustBoundary: input.trustBoundary,
    observationVsFinding: input.observationVsFinding,
    notes: uniqueSorted(input.notes),
    attributes: Object.fromEntries(Object.entries(input.attributes).sort(([left], [right]) => left.localeCompare(right))),
  };
}

function filesUnder(snapshot: CensusSourceSnapshot, prefix: string): string[] {
  return snapshot.files.map((file) => file.path).filter((path) => path.startsWith(prefix) && productionSource(path)).sort();
}

function libAdaptiveFiles(snapshot: CensusSourceSnapshot): string[] {
  return snapshot.files.map((file) => file.path).filter((path) => /^src\/lib\/adaptive-[^/]+\.(?:ts|tsx)$/u.test(path) && productionSource(path)).sort();
}

function byteLength(snapshot: CensusSourceSnapshot, path: string): number {
  return snapshot.files.find((file) => file.path === path)?.byteLength ?? 0;
}

function activeChangeIds(snapshot: CensusSourceSnapshot): string[] {
  const ids = new Set<string>();
  for (const file of snapshot.files) {
    const match = file.path.match(/^openspec\/changes\/(?!archive\/)([^/]+)\//u);
    if (match?.[1]) ids.add(match[1]);
  }
  return [...ids].sort();
}

function mentionedPaths(content: string): string[] {
  return uniqueSorted([...(content.match(/src\/[A-Za-z0-9._\/-]+/gu) ?? [])].filter(inScopePath));
}

const IN_SCOPE_OWNERS = new Set(['assessment', 'personalization']);

function ownersFromPaths(paths: readonly string[]): string[] {
  return uniqueSorted(paths.flatMap((path) => ownersFor(path)).filter((owner) => IN_SCOPE_OWNERS.has(owner)));
}

function deletionSets(paths: readonly string[]): string[] {
  const prefixes = SCOPE_PREFIXES.filter((prefix) => paths.some((path) => path.startsWith(prefix)));
  const lib = paths.some((path) => /^src\/lib\/adaptive-[^/]+/u.test(path) || path.startsWith('src/lib/adaptive-planning/'));
  return uniqueSorted(lib ? [...prefixes, 'src/lib/adaptive-*'] : [...prefixes]);
}

function mentionedContracts(content: string): string[] {
  return uniqueSorted(mentionedPaths(content).filter((path) => /(?:public-api|ports|contract)/u.test(path)));
}

function changeText(snapshot: CensusSourceSnapshot, changeId: string): string {
  return snapshot.files
    .filter((file) => file.path.startsWith(`openspec/changes/${changeId}/`))
    .map((file) => file.content)
    .join('\n');
}

function buildOpenSpecConflicts(snapshot: CensusSourceSnapshot): CurrentHeadOpenSpecConflict[] {
  const changes = activeChangeIds(snapshot);
  const texts = new Map(changes.map((changeId) => [changeId, changeText(snapshot, changeId)]));
  const conflicts: CurrentHeadOpenSpecConflict[] = [];
  for (let i = 0; i < changes.length; i += 1) {
    for (let j = i + 1; j < changes.length; j += 1) {
      const left = changes[i]!;
      const right = changes[j]!;
      const leftText = texts.get(left) ?? '';
      const rightText = texts.get(right) ?? '';
      const leftPaths = mentionedPaths(leftText);
      const rightPaths = mentionedPaths(rightText);
      const pathOverlap = uniqueSorted(leftPaths.filter((path) => rightPaths.includes(path)));
      const contractOverlap = uniqueSorted(mentionedContracts(leftText).filter((path) => mentionedContracts(rightText).includes(path)));
      const deletionOverlap = uniqueSorted(deletionSets(leftPaths).filter((prefix) => deletionSets(rightPaths).includes(prefix)));
      const ownerOverlap = uniqueSorted(ownersFromPaths(leftPaths).filter((owner) => ownersFromPaths(rightPaths).includes(owner)));
      const predecessor = left === 'capture-current-head-consolidation-delta' || right === 'capture-current-head-consolidation-delta';
      let overlapKind: CurrentHeadOpenSpecConflict['overlapKind'] | null = null;
      let paths: string[] = [];
      if (predecessor && (pathOverlap.length > 0 || contractOverlap.length > 0 || deletionOverlap.length > 0 || ownerOverlap.length > 0)) {
        overlapKind = 'predecessor-delta';
        paths = uniqueSorted([...pathOverlap, ...contractOverlap, ...deletionOverlap]);
      } else if (pathOverlap.length > 0) {
        overlapKind = 'path';
        paths = pathOverlap;
      } else if (contractOverlap.length > 0) {
        overlapKind = 'contract';
        paths = contractOverlap;
      } else if (deletionOverlap.length > 0) {
        overlapKind = 'deletion-set';
        paths = deletionOverlap;
      } else if (ownerOverlap.length > 0 && leftPaths.length > 0 && rightPaths.length > 0) {
        overlapKind = 'owner';
        paths = ownerOverlap;
      }
      if (!overlapKind) continue;
      conflicts.push({
        changeIds: [left, right],
        overlapKind,
        paths,
        orderImplication: predecessor
          ? 'later-owner-migration-must-consume-qualified-current-head-delta'
          : overlapKind === 'owner'
            ? 'shared-owner-changes-must-be-sequenced-before-simplification'
            : 'overlapping-active-changes-must-not-claim-the-same-deletion-set',
        resolutionCondition: predecessor
          ? 'c1-and-later-read-this-delta-before-migrating'
          : 'keep-both-changes-unclaimed-until-shared-paths-are-sequenced',
      });
    }
  }
  return conflicts.sort((left, right) => left.changeIds.join(',').localeCompare(right.changeIds.join(',')));
}

function ownerConflictRecords(snapshot: CensusSourceSnapshot, core: CensusCore): CurrentHeadRecord[] {
  const sourceCommit = snapshot.identity.sourceCommit;
  const sourceTree = snapshot.identity.sourceTree;
  const adaptive = filesUnder(snapshot, 'src/features/adaptive/');
  const adaptiveAssessment = filesUnder(snapshot, 'src/features/adaptive-assessment/');
  const assessment = filesUnder(snapshot, 'src/features/assessment/');
  const personalization = [
    ...filesUnder(snapshot, 'src/features/personalization/path-planning/'),
    ...filesUnder(snapshot, 'src/features/personalization/learner-state/'),
  ];
  const libAdaptive = libAdaptiveFiles(snapshot);
  const groups: Array<{ identity: string; files: string[]; evidence: string[]; candidates: OwnerId[] }> = [
    {
      identity: 'src/features/adaptive-assessment vs src/features/assessment',
      files: [...adaptiveAssessment, ...assessment],
      evidence: ['feature:adaptive-assessment', 'feature:assessment'],
      candidates: ['assessment'],
    },
    {
      identity: 'src/features/adaptive vs src/features/personalization',
      files: [...adaptive, ...personalization],
      evidence: ['feature:adaptive', 'feature:personalization'],
      candidates: ['personalization'],
    },
    {
      identity: 'src/lib/adaptive-* and src/lib/adaptive-planning',
      files: [...libAdaptive, ...filesUnder(snapshot, 'src/lib/adaptive-planning/')],
      evidence: ['lib:shared'],
      candidates: ['assessment', 'personalization', 'platform'],
    },
  ];
  return groups
    .filter((group) => group.files.length > 0)
    .map((group) => {
      const consumers = mergeConsumers(censusConsumers(core, group.files, snapshot), mentionConsumers(snapshot.files, group.files));
      const candidates = uniqueSorted([...group.candidates, ...group.files.flatMap((path) => ownersFor(path))]);
      return record({
        category: 'owner-conflict',
        identity: group.identity,
        sourceCommit,
        sourceTree,
        currentOwnerEvidence: group.evidence,
        candidateTargetOwners: candidates,
        consumers,
        deletionCondition: DELETION_UNRESOLVED,
        rollbackReference: ROLLBACK,
        evidence: group.files,
        trustBoundary: 'domain-public-api',
        observationVsFinding: candidates.length > 1 ? 'unresolved' : 'observation',
        notes: ['do-not-resolve-owner-in-this-delta', 'directory-presence-is-not-consumer-proof'],
        attributes: {
          productionFileCount: group.files.length,
        },
      });
    });
}

function retirementRecords(snapshot: CensusSourceSnapshot, core: CensusCore): CurrentHeadRecord[] {
  const sourceCommit = snapshot.identity.sourceCommit;
  const sourceTree = snapshot.identity.sourceTree;
  const compat = core.observations.filter((row) => row.kind === 'compatibility-surface' && inScopePath(row.identity));
  const libAdaptive = [...libAdaptiveFiles(snapshot), ...filesUnder(snapshot, 'src/lib/adaptive-planning/')];
  const adaptiveUi = filesUnder(snapshot, 'src/features/adaptive/');
  const identities = uniqueSorted([...compat.map((row) => row.identity), ...libAdaptive, ...adaptiveUi]);
  return identities.map((identity) => {
    const observation: CensusObservation | undefined = compat.find((row) => row.identity === identity);
    const consumers = mergeConsumers(censusConsumers(core, [identity], snapshot), mentionConsumers(snapshot.files, [identity]));
    const classified = consumerClassOf(consumers);
    return record({
      category: 'retirement',
      identity,
      sourceCommit,
      sourceTree,
      currentOwnerEvidence: observation?.ownership.currentOwnerEvidence ?? ownerEvidenceFromPath(identity),
      candidateTargetOwners: ownersFor(identity),
      consumers,
      deletionCondition: DELETION_UNRESOLVED,
      rollbackReference: ROLLBACK,
      evidence: [identity],
      trustBoundary: 'compatibility-or-shared-lib',
      observationVsFinding: classified === 'production' || classified === 'none-discovered' ? 'unresolved' : 'observation',
      notes: [
        'not-deletable-without-zero-production-consumers',
        classified === 'none-discovered' ? 'no-safe-deletion-proof' : `consumer-class:${classified}`,
      ],
      attributes: {
        compatibility: Boolean(observation?.compatibility),
        consumerClass: classified,
      },
    });
  });
}

function hotspotRecords(snapshot: CensusSourceSnapshot, core: CensusCore): CurrentHeadRecord[] {
  const sourceCommit = snapshot.identity.sourceCommit;
  const sourceTree = snapshot.identity.sourceTree;
  const surfaces: Array<{ identity: string; files: string[]; note: string }> = [
    {
      identity: NAMED_HOTSPOTS[0],
      files: [NAMED_HOTSPOTS[0]].filter((path) => snapshot.files.some((file) => file.path === path)),
      note: 'path-assembly-size',
    },
    {
      identity: NAMED_HOTSPOTS[1],
      files: [NAMED_HOTSPOTS[1]].filter((path) => snapshot.files.some((file) => file.path === path)),
      note: 'learner-state-size',
    },
    {
      identity: 'src/features/adaptive',
      files: filesUnder(snapshot, 'src/features/adaptive/'),
      note: 'adaptive-ui-surface',
    },
    {
      identity: 'src/features/adaptive-assessment',
      files: filesUnder(snapshot, 'src/features/adaptive-assessment/'),
      note: 'adaptive-assessment-surface',
    },
    {
      identity: 'src/lib/adaptive-*',
      files: [...libAdaptiveFiles(snapshot), ...filesUnder(snapshot, 'src/lib/adaptive-planning/')],
      note: 'shared-lib-adaptive-surface',
    },
  ];
  const centers = core.observations.filter((row) => (
    row.kind === 'change-center' && inScopePath(row.identity) && !isTestPath(row.identity)
  ));
  const records = surfaces
    .filter((surface) => surface.files.length > 0)
    .map((surface) => {
      const bytes = surface.files.reduce((sum, path) => sum + byteLength(snapshot, path), 0);
      return record({
        category: 'hotspot',
        identity: surface.identity,
        sourceCommit,
        sourceTree,
        currentOwnerEvidence: uniqueSorted(surface.files.flatMap((path) => core.observations.find((row) => row.identity === path)?.ownership.currentOwnerEvidence ?? [])),
        candidateTargetOwners: uniqueSorted(surface.files.flatMap((path) => ownersFor(path))),
        consumers: mergeConsumers(censusConsumers(core, surface.files, snapshot)),
        deletionCondition: DELETION_UNRESOLVED,
        rollbackReference: ROLLBACK,
        evidence: surface.files,
        trustBoundary: null,
        observationVsFinding: 'observation',
        notes: ['size-is-not-a-finding', surface.note],
        attributes: {
          byteLength: bytes,
          productionFileCount: surface.files.length,
        },
      });
    });
  for (const center of centers) {
    if (records.some((row) => row.identity === center.identity || row.evidence.includes(center.identity))) continue;
    records.push(record({
      category: 'hotspot',
      identity: center.identity,
      sourceCommit,
      sourceTree,
      currentOwnerEvidence: center.ownership.currentOwnerEvidence,
      candidateTargetOwners: ownersFor(center.identity),
      consumers: censusConsumers(core, [center.identity], snapshot),
      deletionCondition: DELETION_UNRESOLVED,
      rollbackReference: ROLLBACK,
      evidence: [center.identity],
      trustBoundary: null,
      observationVsFinding: 'observation',
      notes: ['size-is-not-a-finding', 'census-change-center'],
      attributes: {
        byteLength: Number(center.attributes.byteLength ?? 0),
        productionFileCount: 1,
      },
    }));
  }
  return records.sort((left, right) => Number(right.attributes.byteLength ?? 0) - Number(left.attributes.byteLength ?? 0) || left.id.localeCompare(right.id));
}

export function projectCurrentHeadFiles(pack: CurrentHeadPackage): CurrentHeadFiles {
  const byCategory = (category: CurrentHeadCategory) => pack.records.filter((row) => row.category === category);
  const summary = [
    '# Current-head consolidation delta',
    '',
    `- schemaVersion: \`${pack.schemaVersion}\``,
    `- sourceCommit: \`${pack.captureIdentity.sourceCommit}\``,
    `- sourceTree: \`${pack.captureIdentity.sourceTree}\``,
    `- captureTime: \`${pack.captureTime}\``,
    `- predecessor.sourceCommit: \`${pack.predecessor.sourceCommit}\``,
    `- predecessor.sourceTree: \`${pack.predecessor.sourceTree}\``,
    `- predecessor.schemaVersion: \`${pack.predecessor.schemaVersion}\``,
    `- predecessor.censusCoreSha256: \`${pack.predecessor.censusCoreSha256}\``,
    `- commandScope: \`${pack.commandScope}\``,
    `- nodeVersion: \`${pack.toolVersions.nodeVersion}\``,
    `- npmVersion: \`${pack.toolVersions.npmVersion}\``,
    `- typescriptVersion: \`${pack.toolVersions.typescriptVersion}\``,
    '',
    'This package is a delta, not a second baseline. It does not rewrite the historical census, charter, or deprecation ledger.',
    '',
    '## Slice denominators',
    '',
    table(
      ['slice', 'discovered', 'represented', 'excluded', 'duplicate', 'unresolved'],
      (['owner-conflict', 'retirement', 'hotspot'] as const).map((slice) => [
        slice,
        String(pack.slices[slice].discovered),
        String(pack.slices[slice].represented),
        String(pack.slices[slice].excluded),
        String(pack.slices[slice].duplicate),
        String(pack.slices[slice].unresolved),
      ]),
    ),
    '',
    '## Exclusions',
    '',
    pack.exclusions.map((item) => `- ${item}`).join('\n'),
    '',
    '## Active OpenSpec overlaps',
    '',
    pack.openspecConflicts.length === 0
      ? '_None._'
      : table(
        ['changes', 'kind', 'paths', 'order'],
        pack.openspecConflicts.map((item) => [
          item.changeIds.join(', '),
          item.overlapKind,
          item.paths.slice(0, 8).join('; '),
          item.orderImplication,
        ]),
      ),
    '',
  ].join('\n');

  const conflictDoc = [
    '# Owner conflicts',
    '',
    'Ambiguity is retained. This projection does not choose an owner or migrate callers.',
    '',
    table(
      ['id', 'identity', 'current evidence', 'candidates', 'consumer class', 'finding'],
      byCategory('owner-conflict').map((row) => [
        row.id,
        row.identity,
        row.currentOwnerEvidence.join('; '),
        row.candidateTargetOwners.join('; '),
        row.consumerClass,
        row.observationVsFinding,
      ]),
    ),
    '',
  ].join('\n');

  const retirementDoc = [
    '# Retirement candidates',
    '',
    'A replacement path is not deletion proof. Records stay unresolved until a later migration proves zero production consumers.',
    '',
    table(
      ['id', 'identity', 'consumer class', 'deletion condition', 'finding'],
      byCategory('retirement').map((row) => [
        row.id,
        row.identity,
        row.consumerClass,
        row.deletionCondition,
        row.observationVsFinding,
      ]),
    ),
    '',
  ].join('\n');

  const hotspotDoc = [
    '# Hotspot priority',
    '',
    'Byte size and file counts are prioritization evidence only. They are not defects.',
    '',
    table(
      ['id', 'identity', 'bytes', 'files', 'candidates'],
      byCategory('hotspot').map((row) => [
        row.id,
        row.identity,
        String(row.attributes.byteLength ?? 0),
        String(row.attributes.productionFileCount ?? 0),
        row.candidateTargetOwners.join('; '),
      ]),
    ),
    '',
  ].join('\n');

  return {
    'summary.md': summary,
    'owner-conflicts.md': conflictDoc,
    'retirement-candidates.md': retirementDoc,
    'hotspot-priority.md': hotspotDoc,
    'delta.json': serializeDeterministic(pack),
  };
}

export function generateCurrentHeadDelta(
  snapshot: CensusSourceSnapshot,
  predecessor: CurrentHeadPredecessor = REQUIRED_BASELINE,
  census?: { core: CensusCore; failures: QualificationFailure[] },
): {
  pack: CurrentHeadPackage;
  files: CurrentHeadFiles;
  failures: QualificationFailure[];
} {
  const generated = census ?? generateCensusCore(snapshot);
  const failures: QualificationFailure[] = [...generated.failures];
  if (predecessor.sourceCommit !== REQUIRED_BASELINE.sourceCommit
    || predecessor.sourceTree !== REQUIRED_BASELINE.sourceTree
    || predecessor.censusCoreSha256 !== REQUIRED_BASELINE.censusCoreSha256) {
    failures.push({ code: 'predecessor-identity-mismatch', identity: predecessor.sourceCommit });
  }

  const ownerConflicts = ownerConflictRecords(snapshot, generated.core);
  const retirements = retirementRecords(snapshot, generated.core);
  const hotspots = hotspotRecords(snapshot, generated.core);
  const records = [...ownerConflicts, ...retirements, ...hotspots].sort((left, right) => left.id.localeCompare(right.id));
  const openspecConflicts = buildOpenSpecConflicts(snapshot);
  const pack: CurrentHeadPackage = {
    schemaVersion: CURRENT_HEAD_DELTA_SCHEMA_VERSION,
    captureIdentity: snapshot.identity,
    captureTime: snapshot.identity.commitTime,
    predecessor: {
      schemaVersion: predecessor.schemaVersion,
      sourceCommit: predecessor.sourceCommit,
      sourceTree: predecessor.sourceTree,
      censusCoreSha256: predecessor.censusCoreSha256,
      receiptSchemaVersion: predecessor.receiptSchemaVersion,
      receiptIds: [...predecessor.receiptIds],
    },
    commandScope: CURRENT_HEAD_COMMAND_SCOPE,
    toolVersions: {
      nodeVersion: snapshot.identity.nodeVersion,
      npmVersion: snapshot.identity.npmVersion,
      typescriptVersion: snapshot.identity.typescriptVersion,
    },
    slices: {
      'owner-conflict': totals(
        ownerConflicts.length,
        ownerConflicts.filter((row) => row.observationVsFinding === 'observation').length,
        ownerConflicts.filter((row) => row.observationVsFinding === 'unresolved').length,
      ),
      retirement: totals(
        retirements.length,
        retirements.filter((row) => row.observationVsFinding === 'observation').length,
        retirements.filter((row) => row.observationVsFinding === 'unresolved').length,
      ),
      hotspot: totals(
        hotspots.length,
        hotspots.filter((row) => row.observationVsFinding === 'observation').length,
        hotspots.filter((row) => row.observationVsFinding === 'unresolved').length,
      ),
    },
    records,
    openspecConflicts,
    exclusions: [
      'openspec/changes/archive',
      'docs/architecture/modular-monolith/baseline',
      'generated:.next',
      'generated:node_modules',
      'secrets-learner-payloads-media-screenshots-absolute-paths-command-logs',
    ],
  };
  const files = projectCurrentHeadFiles(pack);
  for (const [name, content] of Object.entries(files)) {
    const violation = privacyViolation(content);
    if (violation) failures.push({ code: violation, identity: `${CURRENT_HEAD_OUTPUT_DIR}/${name}` });
  }
  const seen = new Set<string>();
  for (const item of records) {
    if (seen.has(item.id)) failures.push({ code: 'duplicate-id', identity: item.id });
    seen.add(item.id);
  }
  return { pack, files, failures };
}

export function qualifyCurrentHeadDelta(pack: CurrentHeadPackage, failures: QualificationFailure[]): void {
  if (pack.schemaVersion !== CURRENT_HEAD_DELTA_SCHEMA_VERSION) {
    throw new Error('unsupported-schema-version');
  }
  const drifted = pack.records.find((row) => (
    row.sourceCommit !== pack.captureIdentity.sourceCommit || row.sourceTree !== pack.captureIdentity.sourceTree
  ));
  if (drifted) {
    throw new Error(`mixed-identity:${drifted.id}`);
  }
  if (failures.length > 0) {
    const extra = failures.length > 1 ? ` (+${failures.length - 1} more)` : '';
    throw new Error(`${failures[0]!.code}:${failures[0]!.identity}${extra}`);
  }
}

export function currentHeadPackageHash(files: CurrentHeadFiles): string {
  return sha256Text(files['delta.json']);
}

export function captureDriftFailures(
  before: CensusSourceSnapshot,
  after: CensusSourceSnapshot,
): QualificationFailure[] {
  const failures: QualificationFailure[] = [];
  if (after.dirty) failures.push({ code: 'dirty-worktree', identity: after.identity.sourceCommit });
  if (after.mixedWorktree) failures.push({ code: 'mixed-worktree', identity: after.identity.sourceCommit });
  if (after.detachedUnresolved) failures.push({ code: 'unresolved-identity', identity: after.identity.sourceCommit });
  if (after.identity.sourceCommit !== before.identity.sourceCommit || after.identity.sourceTree !== before.identity.sourceTree) {
    failures.push({ code: 'mixed-identity', identity: after.identity.sourceCommit });
  }
  return failures;
}

export function captureWriteGate(
  expected: CaptureIdentity,
  porcelain: string,
  commit: string,
  tree: string,
): QualificationFailure[] {
  const failures: QualificationFailure[] = [];
  if (porcelain.trim().length > 0) failures.push({ code: 'dirty-worktree', identity: commit || expected.sourceCommit });
  if (commit !== expected.sourceCommit || tree !== expected.sourceTree) {
    failures.push({ code: 'mixed-identity', identity: commit || expected.sourceCommit });
  }
  return failures;
}
