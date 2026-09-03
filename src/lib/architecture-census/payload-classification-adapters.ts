import { createHash } from 'node:crypto';

import type { EvidenceOverride, Facets, InventoryEntry } from './payload-classification';

/**
 * Read-only view over one frozen subject tree. Implementations must resolve
 * blob bytes and listings from the subject Git snapshot only; adapters never
 * read the working tree or a mutable directory listing.
 */
export interface SubjectTreeReader {
  readonly blobBytes: (hash: string) => Buffer;
  readonly listEntries: (prefix: string) => readonly InventoryEntry[];
}

export interface QaLifecycleOutcome {
  readonly evidenceClass:
    | 'representative-fixture'
    | 'run-specific-output'
    | 'audit-closure-document'
    | 'portable-manifest';
  readonly privacyClass: 'public-fixture' | 'private-run-evidence' | 'none';
  readonly retentionDecision: 'retain-in-repo' | 'externalize-then-delete' | 'keep-as-audit-ledger';
  readonly owner: string;
}

export interface QaLifecycleContract {
  /** Digest-bound QA evidence lifecycle classification for one artifact blob. */
  readonly classifyArtifact: (path: string, blobHash: string) => QaLifecycleOutcome | null;
}

export interface PrivacyScanContract {
  /** Returns the bounded forbidden-hit list for one text payload, or null when the payload is not scannable text. */
  readonly scanText: (text: string) => readonly string[] | null;
}

export interface AdapterIdentity {
  readonly name: 'release-manifest' | 'content-compiler-toolchain' | 'knowledge-cutover-runtime' | 'qa-evidence-lifecycle' | 'privacy-content-scan';
  readonly inputDigest: string;
  readonly candidates: number;
  readonly proven: number;
  readonly unresolved: number;
  readonly drift: string | null;
}

export interface AdapterBundle {
  readonly overrides: readonly EvidenceOverride[];
  readonly identities: readonly AdapterIdentity[];
}

export const RELEASE_IDENTITY_FILES = [
  'manifest.json',
  'bundle-manifest.json',
  'SHA256SUMS',
  'engineering.json',
  'stage-receipt.json',
  'RELEASE-NOTES.md',
] as const;

export const CONTENT_COMPILER_CHARACTERIZATION_FILES = [
  'course-content/scripts/export-runtime.sh',
  'course-content/scripts/export_runtime.py',
] as const;

/** Runtime path families export_runtime.py actually writes (verified against its source). */
export const CONTENT_COMPILER_OUTPUT_FAMILIES = [
  'course-content/runtime/lessons/',
  'course-content/runtime/knowledge/cards/',
  'course-content/runtime/knowledge/graph/',
  'course-content/runtime/knowledge/infographs/',
] as const;

export const CONTENT_COMPILER_TOOLCHAIN_ROOT = 'course-content/scripts';
/** Frozen toolchain inventory count from tools/content-knowledge-runtime-release (committed contract). */
export const CONTENT_COMPILER_FROZEN_COUNT = 41;

export const KNOWLEDGE_CUTOVER_WRITER_FILES = [
  'scripts/knowledge-cutover/stage-r4-c4-authority-domain-shards.ts',
  'scripts/knowledge-cutover/apply-r4-c4-runtime-selectors.ts',
] as const;

/** Runtime path families materialized by the knowledge-cutover toolchain (verified against writer sources). */
export const KNOWLEDGE_CUTOVER_OUTPUT_FAMILIES = [
  'course-content/runtime/knowledge/authority-domain-shards/',
  'course-content/runtime/knowledge/consumer-activation/',
  'course-content/runtime/knowledge/projection/',
  'course-content/runtime/knowledge/prerequisites/',
  'course-content/runtime/knowledge/teaching-projection/',
  'course-content/runtime/knowledge/authority-domain-catalog/',
] as const;

export const KNOWLEDGE_CUTOVER_TOOLCHAIN_ROOT = 'scripts/knowledge-cutover';
/**
 * Frozen knowledge-cutover toolchain inventory count at this change's claim-time subject.
 * The content-knowledge-runtime-release FROZEN_COUNTS entry (76) predates four
 * successor-cutover writers (#1509/#1741); this change freezes the current
 * tracked count so any later toolchain growth fails closed here too.
 */
export const KNOWLEDGE_CUTOVER_FROZEN_COUNT = 80;

/**
 * Identity value shapes that must keep a payload privacy-unresolved even inside
 * committed evidence. Keyed occurrences with concrete non-empty values indicate
 * real identifiers; bare identifier mentions in typed source stay outside this
 * pattern on purpose.
 */
export const PRIVACY_IDENTITY_VALUE_PATTERN = /["'](?:userId|learnerId|studentId|userName|studentName|emailAddress|userEmail|sessionId)["']\s*[:=]\s*["']?[^\s"']{4,}/iu;

function sha256Bytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function releaseRootOf(path: string): string | null {
  const marker = '/releases/';
  const index = path.indexOf(marker);
  if (index < 0) return null;
  const rest = path.slice(index + marker.length);
  const firstSegment = rest.split('/')[0] ?? '';
  if (!firstSegment) return null;
  return `${path.slice(0, index + marker.length)}${firstSegment}`;
}

/**
 * Release adapter: binds every member of a course-content release root to the
 * root's committed identity files. Members covered by a SHA256SUMS ledger are
 * proven by independently hashing their actual blob bytes; identity files bind
 * to their own Git blob identity inside the release root.
 */
export function buildReleaseAdapter(reader: SubjectTreeReader, entries: readonly InventoryEntry[]): AdapterBundle {
  const overrides: EvidenceOverride[] = [];
  let candidates = 0;
  let proven = 0;
  const inputDigests: string[] = [];
  const releaseEntries = entries.filter((entry) => entry.path.startsWith('course-content/') && entry.path.includes('/releases/'));
  const roots = new Map<string, InventoryEntry[]>();
  for (const entry of releaseEntries) {
    const root = releaseRootOf(entry.path);
    if (!root) continue;
    const rows = roots.get(root) ?? [];
    rows.push(entry);
    roots.set(root, rows);
  }
  for (const [root, rows] of [...roots.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const byPath = new Map(rows.map((row) => [row.path.slice(root.length + 1), row]));
    const shaSums = byPath.get('SHA256SUMS');
    if (shaSums) {
      inputDigests.push(`${shaSums.path}:${shaSums.hash}`);
      const ledger = parseSha256Sums(reader.blobBytes(shaSums.hash).toString('utf8'));
      for (const [name, entry] of byPath) {
        candidates += 1;
        if (RELEASE_IDENTITY_FILES.includes(name as (typeof RELEASE_IDENTITY_FILES)[number])) {
          overrides.push(releaseIdentityOverride(entry.path, `release-root:${shaSums.hash}`));
          proven += 1;
          continue;
        }
        const expected = ledger.get(name);
        const actual = expected === undefined ? null : sha256Bytes(reader.blobBytes(entry.hash));
        if (expected && actual === expected) {
          overrides.push(releaseMemberOverride(entry.path, `release-manifest:SHA256SUMS@git-blob:${shaSums.hash}`));
          proven += 1;
        }
      }
    } else {
      const identityEntries = rows.filter((row) => (
        RELEASE_IDENTITY_FILES.includes(row.path.slice(root.length + 1) as (typeof RELEASE_IDENTITY_FILES)[number])
      ));
      if (identityEntries.length === 0) continue;
      const identityDigest = sha256Bytes(Buffer.from(
        identityEntries.map((row) => `${row.path.slice(root.length + 1)}:${row.hash}`).sort().join('|'),
        'utf8',
      ));
      for (const row of rows) {
        candidates += 1;
        const name = row.path.slice(root.length + 1);
        if (RELEASE_IDENTITY_FILES.includes(name as (typeof RELEASE_IDENTITY_FILES)[number])) {
          overrides.push(releaseIdentityOverride(row.path, `release-root:${identityDigest}`));
          proven += 1;
        } else {
          overrides.push(releaseMemberOverride(row.path, `release-manifest:root-identity@${identityDigest}`));
          proven += 1;
        }
      }
    }
  }
  return {
    overrides,
    identities: [{
      name: 'release-manifest',
      inputDigest: sha256Bytes(Buffer.from(inputDigests.join('\n'), 'utf8')),
      candidates,
      proven,
      unresolved: candidates - proven,
      drift: null,
    }],
  };
}

function parseSha256Sums(text: string): Map<string, string> {
  const ledger = new Map<string, string>();
  for (const line of text.split('\n')) {
    const match = /^([0-9a-f]{64})\s+\*?(.+)$/u.exec(line.trim());
    if (match && match[1] && match[2]) ledger.set(match[2], match[1]);
  }
  return ledger;
}

function releaseFacets(): Partial<Facets> {
  return {
    authorship: 'generated',
    reproducibility: 'reproducible',
    releaseRoles: ['immutable-release'],
    privacy: 'internal',
    retention: 'retain-in-git',
  };
}

function releaseMemberOverride(path: string, authority: string): EvidenceOverride {
  return {
    path,
    facets: releaseFacets(),
    producer: 'producer:knowledge-release-toolchain',
    consumers: ['tool/script:knowledge-release-reader', 'documentation:repository-relative'],
    authority,
    materialization: 'not-applicable',
    recovery: 'git-checkout-source-tree',
    rollback: 'git-history-blob',
  };
}

function releaseIdentityOverride(path: string, authority: string): EvidenceOverride {
  return {
    path,
    facets: releaseFacets(),
    producer: 'producer:knowledge-release-toolchain',
    consumers: ['tool/script:knowledge-release-reader'],
    authority,
    materialization: 'not-applicable',
    recovery: 'git-checkout-source-tree',
    rollback: 'git-history-blob',
  };
}

/**
 * Content-compiler adapter: runtime families that export_runtime.py actually
 * writes are export outputs of the frozen content-compiler toolchain. The
 * adapter fails closed (proves nothing) when the toolchain inventory count
 * drifts from the committed frozen contract. Every other runtime path stays
 * with whatever other adapter can prove it — never this one.
 */
export function buildContentCompilerAdapter(reader: SubjectTreeReader, entries: readonly InventoryEntry[]): AdapterBundle {
  const toolchainEntries = reader.listEntries(CONTENT_COMPILER_TOOLCHAIN_ROOT);
  const inputDigest = sha256Bytes(Buffer.from(
    CONTENT_COMPILER_CHARACTERIZATION_FILES.map((file) => {
      const entry = toolchainEntries.find((row) => row.path === file);
      return `${file}:${entry?.hash ?? 'missing'}`;
    }).join('\n'),
    'utf8',
  ));
  const drift = toolchainEntries.length !== CONTENT_COMPILER_FROZEN_COUNT
    ? `toolchain-count-drift:${toolchainEntries.length}!=${CONTENT_COMPILER_FROZEN_COUNT}`
    : null;
  const candidateCount = entries.filter((item) => isContentCompilerCandidate(item.path)).length;
  if (drift) {
    return {
      overrides: [],
      identities: [{
        name: 'content-compiler-toolchain',
        inputDigest,
        candidates: candidateCount,
        proven: 0,
        unresolved: candidateCount,
        drift,
      }],
    };
  }
  const overrides: EvidenceOverride[] = [];
  for (const entry of entries) {
    if (!isContentCompilerCandidate(entry.path)) continue;
    overrides.push({
      path: entry.path,
      facets: {
        authorship: 'generated',
        reproducibility: 'reproducible',
        privacy: 'internal',
        retention: 'retain-in-git',
      },
      producer: `producer:course-content-export-runtime@${inputDigest.slice(0, 16)}`,
      authority: `toolchain:content-compiler@${inputDigest}`,
      materialization: 'not-applicable',
      recovery: 'regenerate:export-runtime-from-authoring',
      rollback: 'regenerate:export-runtime-from-authoring',
    });
  }
  return {
    overrides,
    identities: [{
      name: 'content-compiler-toolchain',
      inputDigest,
      candidates: candidateCount,
      proven: candidateCount,
      unresolved: 0,
      drift: null,
    }],
  };
}

function isContentCompilerCandidate(path: string): boolean {
  return path.includes('/releases/')
    ? false
    : CONTENT_COMPILER_OUTPUT_FAMILIES.some((family) => path.startsWith(family));
}

/**
 * Knowledge-cutover adapter: runtime families materialized by the frozen
 * knowledge-cutover toolchain (authority shards, selectors, projections).
 * They are materialized views of authority
 * data — E-class observations, never hand-authored sources — and the adapter
 * fails closed on toolchain inventory count drift.
 */
export function buildKnowledgeCutoverAdapter(reader: SubjectTreeReader, entries: readonly InventoryEntry[]): AdapterBundle {
  const toolchainEntries = reader.listEntries(KNOWLEDGE_CUTOVER_TOOLCHAIN_ROOT);
  const inputDigest = sha256Bytes(Buffer.from(
    KNOWLEDGE_CUTOVER_WRITER_FILES.map((file) => {
      const entry = toolchainEntries.find((row) => row.path === file);
      return `${file}:${entry?.hash ?? 'missing'}`;
    }).join('\n'),
    'utf8',
  ));
  const drift = toolchainEntries.length !== KNOWLEDGE_CUTOVER_FROZEN_COUNT
    ? `toolchain-count-drift:${toolchainEntries.length}!=${KNOWLEDGE_CUTOVER_FROZEN_COUNT}`
    : null;
  const candidateCount = entries.filter((item) => isKnowledgeCutoverCandidate(item.path)).length;
  const identity: AdapterIdentity = {
    name: 'knowledge-cutover-runtime',
    inputDigest,
    candidates: candidateCount,
    proven: 0,
    unresolved: candidateCount,
    drift,
  };
  if (drift) return { overrides: [], identities: [identity] };
  const overrides: EvidenceOverride[] = [];
  for (const entry of entries) {
    if (!isKnowledgeCutoverCandidate(entry.path)) continue;
    overrides.push({
      path: entry.path,
      facets: {
        authorship: 'generated',
        reproducibility: 'not-applicable',
        cacheMaterializedRoles: ['materialized-view'],
        privacy: 'internal',
        retention: 'retain-in-git',
      },
      producer: `producer:knowledge-cutover-runtime@${inputDigest.slice(0, 16)}`,
      authority: `toolchain:knowledge-cutover-runtime@${inputDigest}`,
      materialization: 'existing-view-only',
      recovery: 'existing-materializer-only',
      rollback: 'git-history-blob',
    });
  }
  return {
    overrides,
    identities: [{ ...identity, proven: candidateCount, unresolved: 0 }],
  };
}

function isKnowledgeCutoverCandidate(path: string): boolean {
  if (path.includes('/releases/')) return false;
  if (path === 'course-content/runtime/knowledge/authority-learning-content-manifest.json') return true;
  return KNOWLEDGE_CUTOVER_OUTPUT_FAMILIES.some((family) => path.startsWith(family));
}

/**
 * QA evidence lifecycle adapter: artifacts members are classified by the
 * committed QA lifecycle contract, digest-bound to each member's Git blob.
 * Members the contract marks non-private still require a content scan of
 * scannable text blobs; any forbidden or identity hit keeps the member
 * unresolved instead of trusting the class label.
 */
export function buildQaEvidenceAdapter(
  reader: SubjectTreeReader,
  entries: readonly InventoryEntry[],
  contract: QaLifecycleContract,
  scan?: PrivacyScanContract,
): AdapterBundle {
  const artifactEntries = entries.filter((entry) => entry.path.startsWith('artifacts/'));
  const overrides: EvidenceOverride[] = [];
  let proven = 0;
  for (const entry of artifactEntries) {
    const outcome = contract.classifyArtifact(entry.path, entry.hash);
    if (!outcome) continue;
    if (scan && outcome.privacyClass !== 'private-run-evidence' && isScannableTextPath(entry.path)) {
      const text = reader.blobBytes(entry.hash).toString('utf8');
      const hits = scan.scanText(text) ?? [];
      if (hits.length > 0 || PRIVACY_IDENTITY_VALUE_PATTERN.test(text)) continue;
    }
    overrides.push(qaOverride(entry.path, entry.hash, outcome));
    proven += 1;
  }
  const inputDigest = sha256Bytes(Buffer.from(
    artifactEntries.map((entry) => `${entry.path}:${entry.hash}`).join('\n'),
    'utf8',
  ));
  return {
    overrides,
    identities: [{
      name: 'qa-evidence-lifecycle',
      inputDigest,
      candidates: artifactEntries.length,
      proven,
      unresolved: artifactEntries.length - proven,
      drift: null,
    }],
  };
}

const PRIVACY_SCAN_TEXT_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'md', 'json', 'jsonl', 'txt', 'py', 'sh', 'yaml', 'yml', 'toml', 'sql', 'html', 'css',
]);

function isScannableTextPath(path: string): boolean {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return false;
  return PRIVACY_SCAN_TEXT_EXTENSIONS.has(path.slice(dot + 1).toLowerCase());
}

function qaOverride(path: string, blobHash: string, outcome: QaLifecycleOutcome): EvidenceOverride {
  const facets: Partial<Facets> = {
    privacy: outcome.privacyClass === 'public-fixture'
      ? 'public'
      : outcome.privacyClass === 'private-run-evidence' ? 'private' : 'internal',
    retention: outcome.retentionDecision === 'retain-in-repo'
      ? 'retain-in-git'
      : outcome.retentionDecision === 'externalize-then-delete' ? 'existing-external-lifecycle' : 'retain-in-git',
  };
  let consumers: readonly string[];
  if (outcome.evidenceClass === 'representative-fixture') {
    facets.authorship = 'generated';
    facets.reproducibility = 'non-reproducible';
    facets.qaRoles = ['representative-fixture'];
    // The retain set is extracted from production source referencing the fixture path.
    consumers = ['production:representative-fixture', 'qa-evidence-lifecycle:retain-in-repo'];
  } else if (outcome.evidenceClass === 'run-specific-output') {
    facets.authorship = 'generated';
    facets.reproducibility = 'non-reproducible';
    facets.qaRoles = ['run-specific-output'];
    consumers = ['qa-evidence-lifecycle:externalize-then-delete'];
  } else if (outcome.evidenceClass === 'audit-closure-document') {
    // Audit closure documents are kept as a ledger, not ephemeral run output:
    // hand-authored retention authority, no ephemeral QA role facet.
    facets.authorship = 'hand-authored';
    facets.reproducibility = 'not-applicable';
    facets.qaRoles = [];
    consumers = ['qa-evidence-lifecycle:audit-closure'];
  } else {
    facets.authorship = 'generated';
    facets.reproducibility = 'reproducible';
    facets.qaRoles = [];
    consumers = ['qa-evidence-lifecycle:portable-manifest'];
  }
  return {
    path,
    facets,
    producer: `producer:qa-evidence-lifecycle:${outcome.owner}`,
    consumers,
    authority: `qa-evidence-lifecycle:git-blob:${blobHash}`,
    materialization: 'not-applicable',
    recovery: 'git-checkout-source-tree',
    rollback: 'git-history-blob',
  };
}

const PRIVACY_PATH_PATTERN = /(?:cookie|session|learner|student)/iu;

export function isPrivacyScanCandidate(path: string): boolean {
  if (path.startsWith('artifacts/')) return false;
  if (!PRIVACY_PATH_PATTERN.test(path)) return false;
  const extension = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1).toLowerCase() : '';
  return PRIVACY_SCAN_TEXT_EXTENSIONS.has(extension);
}

/**
 * Privacy content-scan adapter: members whose path alone cannot establish a
 * privacy state are proven (or left unresolved) by scanning their actual blob
 * bytes with the committed forbidden-pattern contract. A hit keeps the member
 * unresolved; a clean scan proves internal privacy for source and document
 * payloads without copying any private content.
 */
export function buildPrivacyScanAdapter(
  reader: SubjectTreeReader,
  entries: readonly InventoryEntry[],
  contract: PrivacyScanContract,
): AdapterBundle {
  const candidates = entries.filter((entry) => isPrivacyScanCandidate(entry.path));
  const overrides: EvidenceOverride[] = [];
  let proven = 0;
  let hits = 0;
  let unscannable = 0;
  for (const entry of candidates) {
    const text = reader.blobBytes(entry.hash).toString('utf8');
    const hitsForText = contract.scanText(text);
    if (hitsForText === null) {
      unscannable += 1;
      continue;
    }
    if (hitsForText.length > 0 || PRIVACY_IDENTITY_VALUE_PATTERN.test(text)) {
      hits += 1;
      continue;
    }
    // Content-scan proof covers privacy only; it must never stand in for
    // authority evidence, so no authority field is set here.
    overrides.push({
      path: entry.path,
      facets: { privacy: 'internal' },
    });
    proven += 1;
  }
  const inputDigest = sha256Bytes(Buffer.from(
    candidates.map((entry) => `${entry.path}:${entry.hash}`).join('\n'),
    'utf8',
  ));
  return {
    overrides,
    identities: [{
      name: 'privacy-content-scan',
      inputDigest,
      candidates: candidates.length,
      proven,
      unresolved: hits + unscannable,
      drift: null,
    }],
  };
}

/**
 * Whole-inventory identity scan: every scannable text member is scanned for
 * concrete identifier values regardless of its path, so privacy safety is
 * proved from content instead of inferred from a path name. Members hit by the
 * identity value shape are returned as hitPaths so the caller can veto any
 * weaker privacy override from another adapter; the adapter never fabricates
 * privacy evidence for a hit.
 */
export interface IdentityScanBundle extends AdapterBundle {
  readonly hitPaths: ReadonlySet<string>;
}

export function buildIdentityInventoryScan(reader: SubjectTreeReader, entries: readonly InventoryEntry[]): IdentityScanBundle {
  const overrides: EvidenceOverride[] = [];
  const hitPaths = new Set<string>();
  let candidates = 0;
  for (const entry of entries) {
    if (entry.path.startsWith('artifacts/')) continue; // covered by the QA evidence lifecycle adapter
    if (!isScannableTextPath(entry.path)) continue;
    candidates += 1;
    const text = reader.blobBytes(entry.hash).toString('utf8');
    if (PRIVACY_IDENTITY_VALUE_PATTERN.test(text)) {
      hitPaths.add(entry.path);
      continue;
    }
    // Content-scan proof covers privacy only; it must never stand in for
    // authority evidence, so no authority field is set here.
    overrides.push({
      path: entry.path,
      facets: { privacy: 'internal' },
    });
  }
  const inputDigest = sha256Bytes(Buffer.from(
    entries.filter((entry) => !entry.path.startsWith('artifacts/') && isScannableTextPath(entry.path))
      .map((entry) => `${entry.path}:${entry.hash}`).join('\n'),
    'utf8',
  ));
  return {
    overrides,
    hitPaths,
    identities: [{
      name: 'privacy-content-scan',
      inputDigest,
      candidates,
      proven: candidates - hitPaths.size,
      unresolved: hitPaths.size,
      drift: null,
    }],
  };
}

export function combineAdapters(bundles: readonly AdapterBundle[]): AdapterBundle {
  const byPath = new Map<string, EvidenceOverride>();
  for (const bundle of bundles) {
    for (const override of bundle.overrides) {
      const existing = byPath.get(override.path);
      byPath.set(override.path, existing ? { ...existing, ...override, facets: { ...existing.facets, ...override.facets } } : override);
    }
  }
  return {
    overrides: [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path)),
    identities: bundles.flatMap((bundle) => bundle.identities),
  };
}
