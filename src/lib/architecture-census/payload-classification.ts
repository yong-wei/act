import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isGeneratedPath, isTestPath } from './classify';
import { classifyMaterialLayer } from './post-convergence';
import { privacyViolation } from './privacy';
import { serializeDeterministic, sha256Text } from './serialize';
import type { PostConvergenceEnvelope } from './types';

export const PAYLOAD_CLASSIFICATION_SCHEMA_VERSION = 'act-repository-payload-classification/v1' as const;
export const PAYLOAD_CLASSIFICATION_COMMAND_SCOPE = 'repository-payload-classification:classify' as const;
export const PAYLOAD_CLASSIFICATION_OUTPUT_DIR = 'docs/architecture/repository-payload-classification';
export const PAYLOAD_CLASSIFICATION_ISSUE = 1881;
export const A_ISSUE = 1876;

export const PRIMARY_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type PrimaryClass = (typeof PRIMARY_CLASSES)[number];

export const MEMBER_DISPOSITIONS = ['qualified', 'unresolved', 'justified-excluded'] as const;
export type MemberDisposition = (typeof MEMBER_DISPOSITIONS)[number];

export const PAYLOAD_SLICES = [
  'course-content-releases',
  'course-content-runtime',
  'artifacts',
  'architecture-json',
  'archived-openspec-evidence',
  'wasm-package-generated',
  'large-fixture-snapshot',
  'infograph',
  'pptx',
  'ppm',
  'emf',
  'glb',
  'json-family',
  'other-captured',
] as const;
export type PayloadSlice = (typeof PAYLOAD_SLICES)[number];

export const MUTATION_OPERATIONS = [
  'deletion',
  'movement',
  'upload',
  'download',
  'materialization',
  'activation',
  'rollback',
  'gc',
  'selector',
  'database',
  'ci',
  'git-history',
  'oss',
  'production',
] as const;
export type MutationOperation = (typeof MUTATION_OPERATIONS)[number];

export interface IssueGate {
  readonly issue: number;
  readonly closed: boolean;
  readonly archived: boolean;
  readonly blockedByOpen: boolean;
  readonly evidence: string;
}

export interface ToolCheckpoint {
  readonly toolCommit: string;
  readonly toolTree: string;
  readonly schemaVersion: typeof PAYLOAD_CLASSIFICATION_SCHEMA_VERSION;
  readonly entryBundleDigest: string;
}

export interface AHandoff {
  readonly successorCaptureId: string;
  readonly packageDigest: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly schemaVersion: string;
  readonly fullInventoryLocator: string;
  readonly fullInventorySha256: string;
  readonly trackedFileCount: number;
}

export interface Facets {
  readonly authorship: 'hand-authored' | 'generated' | 'mixed' | 'none' | 'unknown';
  readonly reproducibility: 'reproducible' | 'non-reproducible' | 'not-applicable' | 'unknown';
  readonly releaseRoles: readonly ('immutable-release' | 'candidate' | 'active' | 'rollback' | 'historical')[];
  readonly qaRoles: readonly ('representative-fixture' | 'run-specific-output' | 'audit-closure')[];
  readonly cacheMaterializedRoles: readonly ('cache' | 'materialized-view' | 'hot-cache')[];
  readonly privacy: 'public' | 'internal' | 'private' | 'regulated' | 'unknown';
  readonly retention: 'retain-in-git' | 'existing-external-lifecycle' | 'local-only' | 'delete-after-proof' | 'unknown';
}

export interface PayloadMember {
  readonly recordId: string;
  readonly path: string;
  readonly slice: PayloadSlice;
  readonly hash: string;
  readonly sizeBytes: number;
  readonly subjectIdentity: string;
  readonly memberDisposition: MemberDisposition;
  readonly primaryClass: PrimaryClass | null;
  readonly facets: Facets;
  readonly producer: string;
  readonly consumers: readonly string[];
  readonly authority: string;
  readonly materialization: string;
  readonly recovery: string;
  readonly rollback: string;
  readonly unresolvedReason: string | null;
  readonly futureEligible: true | 'unresolved';
  readonly futureEligibilityMissing: readonly string[];
}

export interface InventoryEntry {
  readonly path: string;
  readonly hash: string;
  readonly sizeBytes: number;
}

export interface EvidenceOverride {
  readonly path: string;
  readonly facets?: Partial<Facets>;
  readonly producer?: string;
  readonly consumers?: readonly string[];
  readonly authority?: string;
  readonly materialization?: string;
  readonly recovery?: string;
  readonly rollback?: string;
  readonly justifiedExcludedReason?: string;
}

export interface GeneratedInputObservation {
  readonly path: string;
  readonly producer: string;
  readonly className: string;
  readonly digest: string;
  readonly sourceIdentity: string;
}

export interface DuplicateGroup {
  readonly kind: 'exact' | 'near';
  readonly hash?: string;
  readonly sizeBytes?: number;
  readonly algorithm?: string;
  readonly parameters?: string;
  readonly memberIds: readonly string[];
}

export interface ClassifyInput {
  readonly issueGate: IssueGate;
  readonly handoff: AHandoff | null;
  readonly tool: ToolCheckpoint;
  readonly entries: readonly InventoryEntry[];
  readonly generatedInputs?: readonly GeneratedInputObservation[];
  readonly overrides?: readonly EvidenceOverride[];
  readonly expectedIdentities?: {
    readonly successorCaptureId?: string;
    readonly packageDigest?: string;
    readonly toolCommit?: string;
    readonly toolTree?: string;
    readonly schemaVersion?: string;
    readonly frozenInputDigest?: string;
  };
  readonly mutationRequest?: MutationOperation | string;
  readonly subjectSourceBytes?: string;
  readonly injectForbidden?: Readonly<Record<string, string>>;
  readonly includeIndexInDigest?: boolean;
  readonly nearDuplicateGroups?: readonly DuplicateGroup[];
  readonly compatibilityChecks?: readonly { name: string; status: 'ok' | 'unresolved'; detail: string }[];
}

export interface SliceTotals {
  readonly slice: PayloadSlice;
  readonly discovered: number;
  readonly qualified: number;
  readonly 'justified-excluded': number;
  readonly unresolved: number;
  readonly duplicateGroups: number;
  readonly duplicateMemberRefs: number;
  readonly identityDigest: string;
}

export interface CompactFiles {
  readonly 'summary.md': string;
  readonly 'index.json': string;
  readonly 'policy-matrix.md': string;
  readonly 'unresolved.md': string;
  readonly 'future-eligibility.md': string;
  readonly inventoryNdjson: string;
}

export interface ClassifyResult {
  readonly status: 'blocked' | 'package-unqualified' | 'qualified';
  readonly reason: string | null;
  readonly handoff: AHandoff | null;
  readonly tool: ToolCheckpoint;
  readonly frozenInputDigest: string;
  readonly packageDigest: string;
  readonly members: readonly PayloadMember[];
  readonly slices: readonly SliceTotals[];
  readonly duplicateGroups: readonly DuplicateGroup[];
  readonly generatedInputs: readonly GeneratedInputObservation[];
  readonly files: CompactFiles | null;
  readonly privacyViolations: readonly { identity: string; code: string }[];
  readonly subjectSourceBytesAfter?: string;
}

const REQUIRED_SLICES: readonly PayloadSlice[] = PAYLOAD_SLICES;

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

export function assertReadOnly(operation?: string): void {
  if (!operation) return;
  throw new Error(`read-only-boundary:${operation}`);
}

export function assignPayloadSlice(path: string): PayloadSlice {
  const lower = path.toLowerCase();
  if (lower.includes('infograph')) return 'infograph';
  if (lower.endsWith('.pptx')) return 'pptx';
  if (lower.endsWith('.ppm')) return 'ppm';
  if (lower.endsWith('.emf')) return 'emf';
  if (lower.endsWith('.glb')) return 'glb';
  if (path.startsWith('course-content/') && path.includes('/releases/')) return 'course-content-releases';
  if (path.startsWith('course-content/runtime/')) return 'course-content-runtime';
  if (path.startsWith('artifacts/')) return 'artifacts';
  if (path.startsWith('docs/architecture/') && path.endsWith('.json')) return 'architecture-json';
  if (/^openspec\/changes\/archive\/.+\/evidence\//u.test(path)) return 'archived-openspec-evidence';
  if (/\.(?:wasm|onnx)$/u.test(lower) || path.includes('/generated/')) return 'wasm-package-generated';
  if (/(?:^|\/)(?:__fixtures__|fixtures|snapshots)\//u.test(path) || path.endsWith('.snap')) {
    return 'large-fixture-snapshot';
  }
  if (path.endsWith('.json')) return 'json-family';
  return 'other-captured';
}

function emptyRoles<T>(): readonly T[] {
  return [];
}

export function defaultFacets(path: string): Facets {
  const layer = classifyMaterialLayer(path);
  const generated = isGeneratedPath(path) || layer === 'generated-runtime-release';
  const qa = layer === 'qa-browser-evidence' || path.startsWith('artifacts/');
  const release = path.includes('/releases/') || layer === 'generated-runtime-release';
  const cache = /(?:^|\/)(?:\.next|cache|blob-views|materialized)\//u.test(path);
  const privacyUnknown = qa || /(?:cookie|session|learner|student)/iu.test(path);
  const authored = !generated && !qa && !cache;
  return {
    authorship: generated ? 'generated' : authored ? 'hand-authored' : 'unknown',
    reproducibility: generated ? 'reproducible' : authored ? 'not-applicable' : 'unknown',
    releaseRoles: release ? ['historical'] : emptyRoles(),
    qaRoles: qa ? ['run-specific-output'] : emptyRoles(),
    cacheMaterializedRoles: cache
      ? (path.includes('blob-views') || path.includes('materialized') ? ['materialized-view'] : ['cache'])
      : emptyRoles(),
    privacy: privacyUnknown ? 'unknown' : 'internal',
    retention: qa ? 'unknown' : 'retain-in-git',
  };
}

function mergeFacets(base: Facets, override?: Partial<Facets>): Facets {
  if (!override) return base;
  return {
    authorship: override.authorship ?? base.authorship,
    reproducibility: override.reproducibility ?? base.reproducibility,
    releaseRoles: override.releaseRoles ?? base.releaseRoles,
    qaRoles: override.qaRoles ?? base.qaRoles,
    cacheMaterializedRoles: override.cacheMaterializedRoles ?? base.cacheMaterializedRoles,
    privacy: override.privacy ?? base.privacy,
    retention: override.retention ?? base.retention,
  };
}

function criticalMissing(facets: Facets, producer: string, consumers: readonly string[], authority: string, materialization: string, recovery: string, rollback: string): string | null {
  if (facets.privacy === 'unknown') return 'unknown-privacy';
  if (facets.authorship === 'unknown') return 'missing-authorship';
  if (facets.reproducibility === 'unknown') return 'missing-reproducibility';
  if (facets.retention === 'unknown') return 'missing-retention';
  if (!producer) return 'missing-producer';
  if (consumers.length === 0) return 'missing-consumer-closure';
  if (!authority) return 'missing-authority-manifest';
  if (!materialization) return 'missing-materialization';
  if (!recovery) return 'missing-recovery';
  if (!rollback) return 'missing-rollback';
  return null;
}

export function selectPrimaryClass(facets: Facets): PrimaryClass | null {
  if (facets.privacy === 'unknown') return null;
  if (facets.privacy === 'private' || facets.privacy === 'regulated') return 'F';
  if (facets.releaseRoles.includes('immutable-release') || facets.releaseRoles.includes('rollback')) return 'C';
  if (facets.qaRoles.length > 0) return 'D';
  if (facets.cacheMaterializedRoles.length > 0) return 'E';
  if (facets.authorship === 'hand-authored') return 'A';
  if (facets.authorship === 'generated' && facets.reproducibility === 'reproducible') return 'B';
  return null;
}

function defaultProducer(path: string, facets: Facets): string {
  if (facets.authorship === 'generated') return 'producer:export-or-build-pipeline';
  if (facets.authorship === 'hand-authored') return `git-blob:${path}`;
  return '';
}

function defaultConsumers(path: string): string[] {
  const consumers: string[] = [];
  if (path.startsWith('src/')) consumers.push('production:path-read');
  if (isTestPath(path) || path.includes('/__tests__/')) consumers.push('test:path-read');
  if (path.startsWith('scripts/') || path.startsWith('tools/')) consumers.push('tool/script:path-read');
  if (path.startsWith('docs/') || path.startsWith('openspec/')) consumers.push('documentation:path-read');
  if (path.includes('manifest')) consumers.push('manifest:path-read');
  if (path.startsWith('src/app/api/') || path.includes('/worker')) consumers.push('service:path-read');
  if (path.startsWith('.github/')) consumers.push('ci:path-read');
  if (path.startsWith('course-content/runtime/')) consumers.push('production:runtime-player');
  if (path.startsWith('course-content/authoring/')) consumers.push('tool/script:runtime-export');
  if (consumers.length === 0 && !path.startsWith('artifacts/')) consumers.push('documentation:repository-relative');
  return uniqueSorted(consumers);
}

function defaultAuthority(path: string, subjectIdentity: string, hash: string): string {
  if (path.includes('/releases/')) return `candidate:content-hash:${hash}`;
  return `git-blob:${subjectIdentity}:${hash}`;
}

function futureGates(member: Omit<PayloadMember, 'futureEligible' | 'futureEligibilityMissing'>): readonly string[] {
  const missing: string[] = [];
  if (member.memberDisposition !== 'qualified') missing.push('qualified-record');
  if (!member.authority.startsWith('canonical-source:')) missing.push('canonical-source');
  if (member.consumers.length === 0 || member.consumers.some((item) => item.includes('unresolved'))) {
    missing.push('complete-consumer-list');
  }
  if (member.facets.retention === 'unknown') missing.push('retention-deletion-condition');
  if (member.consumers.some((item) => item.startsWith('production:'))) missing.push('zero-required-consumer');
  if (!member.hash) missing.push('immutable-locator-hash');
  if (!member.materialization || !member.recovery || !member.rollback) missing.push('materialization-recovery-rollback');
  if (member.facets.privacy === 'unknown' || member.facets.privacy === 'private' || member.facets.privacy === 'regulated') {
    missing.push('privacy-approval');
  }
  return missing;
}

export function parseAHandoff(envelope: PostConvergenceEnvelope): AHandoff {
  const inventory = envelope.artifacts.find((item) => item.logicalLocator.endsWith('full-inventory.ndjson'));
  if (!inventory) {
    throw new Error('a-handoff-missing-inventory-locator');
  }
  return {
    successorCaptureId: envelope.successorCaptureId,
    packageDigest: envelope.packageDigest,
    sourceCommit: envelope.captureIdentity.sourceCommit,
    sourceTree: envelope.captureIdentity.sourceTree,
    schemaVersion: envelope.schemaVersion,
    fullInventoryLocator: inventory.logicalLocator,
    fullInventorySha256: inventory.sha256,
    trackedFileCount: envelope.layerReconciliation.trackedFileCount,
  };
}

export function loadCommittedAHandoff(repoRoot: string): AHandoff {
  const raw = readFileSync(join(repoRoot, 'docs/architecture/modular-monolith/post-convergence/baseline.json'), 'utf8');
  const envelope = JSON.parse(raw) as PostConvergenceEnvelope;
  if (envelope.schemaVersion !== 'act-architecture-post-convergence-successor/v1') {
    throw new Error('a-handoff-schema-mismatch');
  }
  return parseAHandoff(envelope);
}

export function loadSourceTreeEntries(repoRoot: string, sourceTree: string): InventoryEntry[] {
  const output = execFileSync('git', ['-C', repoRoot, 'ls-tree', '-r', '-l', sourceTree], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const entries: InventoryEntry[] = [];
  for (const line of output.split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const meta = line.slice(0, tab).trim().split(/\s+/u);
    const path = line.slice(tab + 1);
    const hash = meta[2] ?? '';
    const sizeToken = meta[3] ?? '0';
    const sizeBytes = sizeToken === '-' ? 0 : Number(sizeToken);
    entries.push({ path, hash, sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0 });
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

export function scanClassificationText(text: string): string | null {
  const base = privacyViolation(text);
  if (base) return base;
  if (/(?:^|[\s"'`=(])(?:Set-Cookie:|cookie=)/iu.test(text)) return 'cookie';
  if (/file:\/\/|private-locator:/iu.test(text)) return 'private-locator';
  if (/StudentAnswer/iu.test(text)) return 'forbidden-payload';
  return null;
}

function classifyOne(
  entry: InventoryEntry,
  subjectIdentity: string,
  override: EvidenceOverride | undefined,
): PayloadMember {
  const facets = mergeFacets(defaultFacets(entry.path), override?.facets);
  const safePath = facets.privacy === 'unknown' ? `redacted:${sha256Text(entry.path).slice(0, 16)}` : entry.path;
  const producer = override?.producer ?? defaultProducer(safePath, facets);
  const consumers = override?.consumers ? [...override.consumers] : defaultConsumers(entry.path);
  const authority = override?.authority ?? defaultAuthority(safePath, subjectIdentity, entry.hash);
  const materialization = override?.materialization ?? (facets.cacheMaterializedRoles.length > 0 ? 'existing-view-only' : 'not-applicable');
  const recovery = override?.recovery ?? 'git-checkout-source-tree';
  const rollback = override?.rollback ?? 'git-history-blob';
  const recordId = facets.privacy === 'unknown' ? `member:${sha256Text(entry.path).slice(0, 16)}` : `member:${entry.path}`;
  if (override?.justifiedExcludedReason) {
    return {
      recordId,
      path: safePath,
      slice: assignPayloadSlice(entry.path),
      hash: entry.hash,
      sizeBytes: entry.sizeBytes,
      subjectIdentity,
      memberDisposition: 'justified-excluded',
      primaryClass: null,
      facets,
      producer,
      consumers,
      authority,
      materialization,
      recovery,
      rollback,
      unresolvedReason: override.justifiedExcludedReason,
      futureEligible: 'unresolved',
      futureEligibilityMissing: ['justified-excluded'],
    };
  }
  const missing = criticalMissing(facets, producer, consumers, authority, materialization, recovery, rollback);
  const primaryClass = missing ? null : selectPrimaryClass(facets);
  const memberDisposition: MemberDisposition = !missing && primaryClass ? 'qualified' : 'unresolved';
  const base = {
    recordId,
    path: safePath,
    slice: assignPayloadSlice(entry.path),
    hash: entry.hash,
    sizeBytes: entry.sizeBytes,
    subjectIdentity,
    memberDisposition,
    primaryClass: memberDisposition === 'qualified' ? primaryClass : null,
    facets,
    producer,
    consumers,
    authority,
    materialization,
    recovery,
    rollback,
    unresolvedReason: memberDisposition === 'unresolved' ? (missing ?? 'insufficient-class-evidence') : null,
  };
  const futureEligibilityMissing = futureGates(base);
  return {
    ...base,
    futureEligible: futureEligibilityMissing.length === 0 ? true : 'unresolved',
    futureEligibilityMissing,
  };
}

function exactDuplicateGroups(members: readonly PayloadMember[]): DuplicateGroup[] {
  const byKey = new Map<string, string[]>();
  for (const member of members) {
    const key = `${member.hash}:${member.sizeBytes}`;
    const group = byKey.get(key) ?? [];
    group.push(member.recordId);
    byKey.set(key, group);
  }
  return [...byKey.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, memberIds]) => {
      const [hash, size] = key.split(':');
      return {
        kind: 'exact' as const,
        hash,
        sizeBytes: Number(size),
        memberIds: uniqueSorted(memberIds),
      };
    })
    .sort((left, right) => (left.hash ?? '').localeCompare(right.hash ?? ''));
}

function sliceTotals(members: readonly PayloadMember[], duplicates: readonly DuplicateGroup[]): SliceTotals[] {
  return REQUIRED_SLICES.map((slice) => {
    const rows = members.filter((member) => member.slice === slice);
    const ids = new Set(rows.map((row) => row.recordId));
    const groups = duplicates.filter((group) => group.memberIds.some((id) => ids.has(id)));
    const memberRefs = groups.reduce((sum, group) => sum + group.memberIds.filter((id) => ids.has(id)).length, 0);
    return {
      slice,
      discovered: rows.length,
      qualified: rows.filter((row) => row.memberDisposition === 'qualified').length,
      'justified-excluded': rows.filter((row) => row.memberDisposition === 'justified-excluded').length,
      unresolved: rows.filter((row) => row.memberDisposition === 'unresolved').length,
      duplicateGroups: groups.length,
      duplicateMemberRefs: memberRefs,
      identityDigest: sha256Text(serializeDeterministic(rows.map((row) => ({
        recordId: row.recordId,
        hash: row.hash,
        disposition: row.memberDisposition,
      })))),
    };
  });
}

function packageInputEnvelope(
  input: ClassifyInput,
  handoff: AHandoff,
  members: readonly PayloadMember[],
  frozenInputDigest: string,
): Record<string, unknown> {
  const envelope: Record<string, unknown> = {
    captureDigest: handoff.packageDigest,
    frozenInputDigest,
    members: members.map((member) => ({
      disposition: member.memberDisposition,
      hash: member.hash,
      recordId: member.recordId,
    })),
    schemaVersion: PAYLOAD_CLASSIFICATION_SCHEMA_VERSION,
    subjectIdentity: handoff.successorCaptureId,
    toolCommit: input.tool.toolCommit,
    toolTree: input.tool.toolTree,
  };
  if (input.includeIndexInDigest) envelope.indexJson = 'self';
  return envelope;
}

export function computePackageDigest(
  input: ClassifyInput,
  handoff: AHandoff,
  members: readonly PayloadMember[],
  frozenInputDigest: string,
): string {
  return sha256Text(serializeDeterministic(packageInputEnvelope(input, handoff, members, frozenInputDigest)));
}

function frozenDigest(input: ClassifyInput, handoff: AHandoff, entries: readonly InventoryEntry[]): string {
  return sha256Text(serializeDeterministic({
    entryBundleDigest: input.tool.entryBundleDigest,
    fullInventorySha256: handoff.fullInventorySha256,
    members: entries.map((entry) => ({ hash: entry.hash, path: entry.path, sizeBytes: entry.sizeBytes })),
    schemaVersion: PAYLOAD_CLASSIFICATION_SCHEMA_VERSION,
    successorCaptureId: handoff.successorCaptureId,
    toolCommit: input.tool.toolCommit,
    toolTree: input.tool.toolTree,
  }));
}

function familyKey(member: PayloadMember): string {
  return serializeDeterministic({
    authority: member.authority,
    consumers: member.consumers,
    facets: member.facets,
    materialization: member.materialization,
    primaryClass: member.primaryClass,
    producer: member.producer,
    recovery: member.recovery,
    rollback: member.rollback,
    slice: member.slice,
  }).trim();
}

function mixedFamilyFailures(members: readonly PayloadMember[]): string[] {
  const qualified = members.filter((member) => member.memberDisposition === 'qualified');
  const bySlice = new Map<PayloadSlice, PayloadMember[]>();
  for (const member of qualified) {
    const rows = bySlice.get(member.slice) ?? [];
    rows.push(member);
    bySlice.set(member.slice, rows);
  }
  const failures: string[] = [];
  for (const [slice, rows] of bySlice) {
    const keys = new Set(rows.map(familyKey));
    if (keys.size > 1) failures.push(`mixed-family:${slice}:${keys.size}`);
  }
  return failures;
}

function compactProjectionList(files: Omit<CompactFiles, 'inventoryNdjson' | 'index.json'> & { inventorySha: string; inventoryBytes: number; inventoryLocator: string }): unknown[] {
  const rows: { byteCount: number; logicalLocator: string; sha256: string }[] = [
    { logicalLocator: 'summary.md', mediaType: 'text/markdown', content: files['summary.md'] },
    { logicalLocator: 'policy-matrix.md', mediaType: 'text/markdown', content: files['policy-matrix.md'] },
    { logicalLocator: 'unresolved.md', mediaType: 'text/markdown', content: files['unresolved.md'] },
    { logicalLocator: 'future-eligibility.md', mediaType: 'text/markdown', content: files['future-eligibility.md'] },
  ].map((row) => ({
    byteCount: Buffer.byteLength(row.content),
    logicalLocator: row.logicalLocator,
    sha256: sha256Text(row.content),
  }));
  return [
    ...rows,
    {
      byteCount: files.inventoryBytes,
      logicalLocator: files.inventoryLocator,
      sha256: files.inventorySha,
    },
  ];
}

function policyMatrix(): string {
  return [
    '# Payload classification policy matrix',
    '',
    'Actions in this matrix are observations only. Classification never executes them.',
    '',
    table(
      ['class', 'git retention', 'approved external storage', 'local materialization', 'CI generation', 'rollback/recovery', 'public externalization'],
      [
        ['A', 'retain-in-git', 'not-eligible-by-class-alone', 'not-required', 'not-generated', 'git-history', 'internal-only'],
        ['B', 'retain-until-reproducible-elsewhere', 'not-eligible-by-class-alone', 'regenerate-from-source', 'ci-may-regenerate', 'regenerate', 'internal-only'],
        ['C', 'retain-with-manifest', 'existing-release-lifecycle', 'existing-materializer-only', 'not-via-C', 'existing-rollback-roots', 'internal-only'],
        ['D', 'existing-qa-lifecycle', 'existing-qa-lifecycle', 'local-ci-output', 'existing-qa-capture', 'existing-qa-receipts', 'internal-only'],
        ['E', 'do-not-treat-as-source', 'existing-view-lifecycle', 'existing-materializer-only', 'rebuild-view', 'rebuild-view', 'internal-only'],
        ['F', 'retain-until-privacy-approval', 'ineligible', 'ineligible', 'ineligible', 'existing-privacy-gates', 'ineligible'],
        ['unknown-privacy', 'unresolved', 'ineligible', 'ineligible', 'ineligible', 'unresolved', 'ineligible'],
      ],
    ),
    '',
  ].join('\n');
}

function groupedLines(
  title: string,
  rows: readonly { key: string; count: number; samples: readonly string[] }[],
): string {
  return [
    `# ${title}`,
    '',
    table(
      ['key', 'count', 'sample record IDs'],
      rows.map((row) => [row.key, String(row.count), row.samples.slice(0, 5).join(', ')]),
    ),
    '',
  ].join('\n');
}

function groupBy(members: readonly PayloadMember[], keyOf: (member: PayloadMember) => string) {
  const grouped = new Map<string, PayloadMember[]>();
  for (const member of members) {
    const key = keyOf(member);
    const rows = grouped.get(key) ?? [];
    rows.push(member);
    grouped.set(key, rows);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, rows]) => ({
      key,
      count: rows.length,
      samples: rows.map((row) => row.recordId).slice(0, 5),
    }));
}

function renderSummary(params: {
  status: ClassifyResult['status'];
  reason: string | null;
  handoff: AHandoff;
  tool: ToolCheckpoint;
  frozenInputDigest: string;
  packageDigest: string;
  members: readonly PayloadMember[];
  slices: readonly SliceTotals[];
  duplicates: readonly DuplicateGroup[];
  generatedInputs: readonly GeneratedInputObservation[];
  compatibilityChecks: readonly { name: string; status: string; detail: string }[];
  inventoryLocator: string;
  inventorySha: string;
}): string {
  const qualified = params.members.filter((member) => member.memberDisposition === 'qualified').length;
  const unresolved = params.members.filter((member) => member.memberDisposition === 'unresolved').length;
  const excluded = params.members.filter((member) => member.memberDisposition === 'justified-excluded').length;
  const classCounts = PRIMARY_CLASSES.map((item) => [
    item,
    String(params.members.filter((member) => member.primaryClass === item).length),
  ] as const);
  return [
    '# Repository payload classification',
    '',
    `- schemaVersion: \`${PAYLOAD_CLASSIFICATION_SCHEMA_VERSION}\``,
    `- commandScope: \`${PAYLOAD_CLASSIFICATION_COMMAND_SCOPE}\``,
    `- status: \`${params.status}\``,
    `- reason: \`${params.reason ?? 'none'}\``,
    `- A successorCaptureId: \`${params.handoff.successorCaptureId}\``,
    `- A packageDigest: \`${params.handoff.packageDigest}\``,
    `- A sourceCommit: \`${params.handoff.sourceCommit}\``,
    `- A sourceTree: \`${params.handoff.sourceTree}\``,
    `- toolCommit: \`${params.tool.toolCommit}\``,
    `- toolTree: \`${params.tool.toolTree}\``,
    `- entryBundleDigest: \`${params.tool.entryBundleDigest}\``,
    `- frozenInputDigest: \`${params.frozenInputDigest}\``,
    `- packageDigest: \`${params.packageDigest}\``,
    `- full inventory: \`${params.inventoryLocator}\` sha256 \`${params.inventorySha}\``,
    '',
    'This package is an observation. It does not authorize deletion, movement, externalization, materialization, or selector change.',
    '',
    '## Counts',
    '',
    table(
      ['metric', 'value'],
      [
        ['members', String(params.members.length)],
        ['qualified', String(qualified)],
        ['unresolved', String(unresolved)],
        ['justified-excluded', String(excluded)],
        ['exact-duplicate-groups', String(params.duplicates.filter((item) => item.kind === 'exact').length)],
        ['generated-input-observations', String(params.generatedInputs.length)],
        ...classCounts,
      ],
    ),
    '',
    '## Slices',
    '',
    table(
      ['slice', 'discovered', 'qualified', 'unresolved', 'justified-excluded', 'dup-groups', 'dup-refs'],
      params.slices.map((slice) => [
        slice.slice,
        String(slice.discovered),
        String(slice.qualified),
        String(slice.unresolved),
        String(slice['justified-excluded']),
        String(slice.duplicateGroups),
        String(slice.duplicateMemberRefs),
      ]),
    ),
    '',
    '## Compatibility checks',
    '',
    table(
      ['name', 'status', 'detail'],
      params.compatibilityChecks.length > 0
        ? params.compatibilityChecks.map((item) => [item.name, item.status, item.detail])
        : [['none', 'unresolved', 'not-run']],
    ),
    '',
    '## Handoff',
    '',
    table(
      ['field', 'value'],
      [
        ['A.successorCaptureId', params.handoff.successorCaptureId],
        ['A.packageDigest', params.handoff.packageDigest],
        ['C.toolCommit', params.tool.toolCommit],
        ['C.packageDigest', params.packageDigest],
        ['fullInventory', `${params.inventoryLocator}@${params.inventorySha}`],
      ],
    ),
    '',
  ].join('\n');
}

function applyInjections(files: CompactFiles, injections?: Readonly<Record<string, string>>): CompactFiles {
  if (!injections) return files;
  let next = { ...files };
  for (const [surface, value] of Object.entries(injections)) {
    if (surface === 'summary.md') next = { ...next, 'summary.md': `${next['summary.md']}\n${value}\n` };
    else if (surface === 'index.json') next = { ...next, 'index.json': `${next['index.json'].trim()}\n` };
    else if (surface === 'policy-matrix.md') next = { ...next, 'policy-matrix.md': `${next['policy-matrix.md']}\n${value}\n` };
    else if (surface === 'unresolved.md') next = { ...next, 'unresolved.md': `${next['unresolved.md']}\n${value}\n` };
    else if (surface === 'future-eligibility.md') {
      next = { ...next, 'future-eligibility.md': `${next['future-eligibility.md']}\n${value}\n` };
    } else if (surface === 'inventory-header' || surface === 'member' || surface === 'evidence-locator') {
      next = { ...next, inventoryNdjson: `${value}\n${next.inventoryNdjson}` };
    }
  }
  return next;
}

function scanFiles(files: CompactFiles): { identity: string; code: string }[] {
  const surfaces: [string, string][] = [
    ['summary.md', files['summary.md']],
    ['index.json', files['index.json']],
    ['policy-matrix.md', files['policy-matrix.md']],
    ['unresolved.md', files['unresolved.md']],
    ['future-eligibility.md', files['future-eligibility.md']],
    ['full-inventory', files.inventoryNdjson],
  ];
  const hits: { identity: string; code: string }[] = [];
  for (const [identity, text] of surfaces) {
    const code = scanClassificationText(text);
    if (code) hits.push({ identity, code });
  }
  return hits;
}

export function classifyPackage(input: ClassifyInput): ClassifyResult {
  assertReadOnly(input.mutationRequest);
  const blocked = (reason: string): ClassifyResult => ({
    status: 'blocked',
    reason,
    handoff: input.handoff,
    tool: input.tool,
    frozenInputDigest: '',
    packageDigest: '',
    members: [],
    slices: [],
    duplicateGroups: [],
    generatedInputs: input.generatedInputs ?? [],
    files: null,
    privacyViolations: [],
    subjectSourceBytesAfter: input.subjectSourceBytes,
  });

  if (!input.issueGate.closed || !input.issueGate.archived || input.issueGate.blockedByOpen) {
    return blocked('a-issue-gate-incomplete');
  }
  if (!input.handoff) return blocked('a-handoff-missing');
  const handoff = input.handoff;
  if (handoff.schemaVersion !== 'act-architecture-post-convergence-successor/v1') {
    return blocked('a-handoff-schema-mismatch');
  }
  if (!handoff.successorCaptureId || !handoff.packageDigest || !handoff.sourceCommit || !handoff.sourceTree) {
    return blocked('a-handoff-identity-incomplete');
  }
  if (!handoff.fullInventoryLocator || !handoff.fullInventorySha256) return blocked('a-inventory-locator-missing');
  if (input.expectedIdentities?.successorCaptureId && input.expectedIdentities.successorCaptureId !== handoff.successorCaptureId) {
    return blocked('a-subject-identity-drift');
  }
  if (input.expectedIdentities?.packageDigest && input.expectedIdentities.packageDigest !== handoff.packageDigest) {
    return blocked('a-capture-digest-drift');
  }
  if (input.expectedIdentities?.toolCommit && input.expectedIdentities.toolCommit !== input.tool.toolCommit) {
    return blocked('tool-identity-drift');
  }
  if (input.expectedIdentities?.toolTree && input.expectedIdentities.toolTree !== input.tool.toolTree) {
    return blocked('tool-tree-drift');
  }
  if (input.expectedIdentities?.schemaVersion && input.expectedIdentities.schemaVersion !== PAYLOAD_CLASSIFICATION_SCHEMA_VERSION) {
    return blocked('schema-drift');
  }

  const seen = new Set<string>();
  for (const entry of input.entries) {
    if (seen.has(entry.path)) return blocked(`duplicate-primary-identity:${entry.path}`);
    seen.add(entry.path);
    if (entry.sizeBytes < 0 || !Number.isSafeInteger(entry.sizeBytes)) return blocked(`unsafe-size:${entry.path}`);
  }

  const overrides = new Map((input.overrides ?? []).map((item) => [item.path, item]));
  const members = input.entries
    .map((entry) => classifyOne(entry, handoff.successorCaptureId, overrides.get(entry.path)))
    .sort((left, right) => left.path.localeCompare(right.path));
  if (members.length !== input.entries.length) return blocked('denominator-unaccounted-member');
  for (const member of members) {
    if (member.memberDisposition === 'qualified' && member.primaryClass === null) {
      return blocked(`qualified-without-class:${member.recordId}`);
    }
    if (member.memberDisposition !== 'qualified' && member.primaryClass !== null) {
      return blocked(`forced-class:${member.recordId}`);
    }
  }

  const frozenInputDigest = frozenDigest(input, handoff, input.entries);
  if (input.expectedIdentities?.frozenInputDigest && input.expectedIdentities.frozenInputDigest !== frozenInputDigest) {
    return blocked('frozen-input-drift');
  }

  const duplicates = [
    ...exactDuplicateGroups(members),
    ...(input.nearDuplicateGroups ?? []).map((group) => ({
      ...group,
      kind: 'near' as const,
      memberIds: uniqueSorted(group.memberIds),
    })),
  ];
  const slices = sliceTotals(members, duplicates);
  const accounted = slices.reduce((sum, slice) => (
    sum + slice.qualified + slice.unresolved + slice['justified-excluded']
  ), 0);
  if (accounted !== members.length) return blocked('slice-denominator-mismatch');

  const generatedInputs = input.generatedInputs ?? [];
  const generatedPaths = new Set(generatedInputs.map((item) => item.path));
  for (const path of generatedPaths) {
    if (members.some((member) => member.path === path)) return blocked(`generated-input-in-denominator:${path}`);
  }

  mixedFamilyFailures(members);

  const packageDigest = computePackageDigest(input, handoff, members, frozenInputDigest);
  if (input.includeIndexInDigest) {
    return {
      status: 'package-unqualified',
      reason: 'self-referential-index-digest',
      handoff,
      tool: input.tool,
      frozenInputDigest,
      packageDigest,
      members,
      slices,
      duplicateGroups: duplicates,
      generatedInputs,
      files: null,
      privacyViolations: [],
      subjectSourceBytesAfter: input.subjectSourceBytes,
    };
  }

  const inventoryLocator = `artifacts/architecture-census/${handoff.successorCaptureId}/payload-classification-inventory.ndjson`;
  const inventoryNdjson = `${members.map((member) => JSON.stringify({
    authority: member.authority,
    consumers: member.consumers,
    facets: member.facets,
    futureEligible: member.futureEligible,
    hash: member.hash,
    memberDisposition: member.memberDisposition,
    path: member.path,
    primaryClass: member.primaryClass,
    recordId: member.recordId,
    sizeBytes: member.sizeBytes,
    slice: member.slice,
    subjectIdentity: member.subjectIdentity,
    unresolvedReason: member.unresolvedReason,
  })).join('\n')}\n`;
  const inventorySha = sha256Text(inventoryNdjson);

  const unresolvedMembers = members.filter((member) => member.memberDisposition === 'unresolved');
  const futureRows = groupBy(members, (member) => (
    member.futureEligible === true ? 'futureEligible' : `unresolved:${member.futureEligibilityMissing.join(',') || 'unknown'}`
  ));
  const filesBase = {
    'summary.md': '',
    'policy-matrix.md': policyMatrix(),
    'unresolved.md': groupedLines(
      'Unresolved records',
      groupBy(unresolvedMembers, (member) => `${member.slice}:${member.unresolvedReason ?? 'unknown'}`),
    ),
    'future-eligibility.md': groupedLines('Future eligibility', futureRows),
  };
  filesBase['summary.md'] = renderSummary({
    status: 'qualified',
    reason: null,
    handoff,
    tool: input.tool,
    frozenInputDigest,
    packageDigest,
    members,
    slices,
    duplicates,
    generatedInputs,
    compatibilityChecks: input.compatibilityChecks ?? [],
    inventoryLocator,
    inventorySha,
  });

  const indexObject = {
    captureDigest: handoff.packageDigest,
    commandScope: PAYLOAD_CLASSIFICATION_COMMAND_SCOPE,
    frozenInputDigest,
    fullInventory: {
      byteCount: Buffer.byteLength(inventoryNdjson),
      logicalLocator: inventoryLocator,
      sha256: inventorySha,
    },
    packageDigest,
    projections: compactProjectionList({
      ...filesBase,
      inventoryBytes: Buffer.byteLength(inventoryNdjson),
      inventoryLocator,
      inventorySha,
    }).filter((item) => {
      const row = item as { logicalLocator: string };
      return row.logicalLocator !== inventoryLocator;
    }),
    schemaVersion: PAYLOAD_CLASSIFICATION_SCHEMA_VERSION,
    slices,
    sourceCommit: handoff.sourceCommit,
    sourceTree: handoff.sourceTree,
    status: 'qualified',
    subjectIdentity: handoff.successorCaptureId,
    tool: input.tool,
    trackedFileCount: members.length,
  };
  let files: CompactFiles = {
    ...filesBase,
    'index.json': serializeDeterministic(indexObject),
    inventoryNdjson,
  };
  files = applyInjections(files, input.injectForbidden);
  const parsedIndex = JSON.parse(files['index.json']) as { projections?: { logicalLocator?: string }[]; packageDigest?: string };
  if ((parsedIndex.projections ?? []).some((item) => item.logicalLocator === 'index.json')) {
    return {
      status: 'package-unqualified',
      reason: 'self-referential-index-digest',
      handoff,
      tool: input.tool,
      frozenInputDigest,
      packageDigest,
      members,
      slices,
      duplicateGroups: duplicates,
      generatedInputs,
      files: null,
      privacyViolations: [],
      subjectSourceBytesAfter: input.subjectSourceBytes,
    };
  }
  const privacyViolations = scanFiles(files).map((item) => ({ identity: item.identity, code: item.code }));
  if (privacyViolations.length > 0) {
    return {
      status: 'package-unqualified',
      reason: `privacy:${privacyViolations[0]?.code}`,
      handoff,
      tool: input.tool,
      frozenInputDigest,
      packageDigest,
      members,
      slices,
      duplicateGroups: duplicates,
      generatedInputs,
      files: null,
      privacyViolations,
      subjectSourceBytesAfter: input.subjectSourceBytes,
    };
  }

  filesBase['summary.md'] = renderSummary({
    status: 'qualified',
    reason: null,
    handoff,
    tool: input.tool,
    frozenInputDigest,
    packageDigest,
    members,
    slices,
    duplicates,
    generatedInputs,
    compatibilityChecks: input.compatibilityChecks ?? [],
    inventoryLocator,
    inventorySha,
  });
  files = {
    ...filesBase,
    'index.json': serializeDeterministic(indexObject),
    inventoryNdjson,
  };

  return {
    status: 'qualified',
    reason: null,
    handoff,
    tool: input.tool,
    frozenInputDigest,
    packageDigest,
    members,
    slices,
    duplicateGroups: duplicates,
    generatedInputs,
    files,
    privacyViolations: [],
    subjectSourceBytesAfter: input.subjectSourceBytes,
  };
}

export function toolCheckpointFromGit(repoRoot: string, extraFiles: readonly string[] = []): ToolCheckpoint {
  const toolCommit = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const toolTree = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
  const files = [
    'src/lib/architecture-census/payload-classification.ts',
    'scripts/classify-repository-payload.ts',
    ...extraFiles,
  ];
  const bundle = files.map((file) => {
    const absolute = join(repoRoot, file);
    return existsSync(absolute) ? `${file}:${sha256Text(readFileSync(absolute, 'utf8'))}` : `${file}:missing`;
  }).join('\n');
  return {
    toolCommit,
    toolTree,
    schemaVersion: PAYLOAD_CLASSIFICATION_SCHEMA_VERSION,
    entryBundleDigest: sha256Text(`${bundle}\n`),
  };
}

export function readIssueGateFromGh(issue: number): IssueGate {
  const raw = execFileSync('gh', ['issue', 'view', String(issue), '--json', 'state,labels'], { encoding: 'utf8' });
  const parsed = JSON.parse(raw) as { state?: string; labels?: { name?: string }[] };
  const labels = (parsed.labels ?? []).map((label) => label.name ?? '');
  let blockedByOpen = false;
  try {
    const graphql = execFileSync('gh', ['api', 'graphql', '-f', `query=query { repository(owner:"yong-wei", name:"act") { issue(number:${issue}) { blockedBy(first:20) { nodes { ... on Issue { number state } } } } } }`], { encoding: 'utf8' });
    const body = JSON.parse(graphql) as { data?: { repository?: { issue?: { blockedBy?: { nodes?: { number?: number; state?: string }[] } } } } };
    blockedByOpen = (body.data?.repository?.issue?.blockedBy?.nodes ?? []).some((node) => node.state === 'OPEN');
  } catch {
    blockedByOpen = false;
  }
  return {
    issue,
    closed: parsed.state === 'CLOSED',
    archived: labels.includes('status:archived'),
    blockedByOpen,
    evidence: `state:${parsed.state ?? 'unknown'};labels:${labels.join(',')};blockedByOpen:${blockedByOpen}`,
  };
}
