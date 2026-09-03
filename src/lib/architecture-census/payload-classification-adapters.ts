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
  readonly name: 'release-manifest' | 'content-compiler-toolchain' | 'qa-evidence-lifecycle' | 'privacy-content-scan';
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

export const CONTENT_COMPILER_TOOLCHAIN_ROOT = 'course-content/scripts';
/** Frozen toolchain inventory count from tools/content-knowledge-runtime-release (committed contract). */
export const CONTENT_COMPILER_FROZEN_COUNT = 41;

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
 * Content-compiler adapter: course-content/runtime members (outside releases)
 * are export outputs of the frozen content-compiler toolchain. The adapter
 * fails closed (proves nothing) when the toolchain inventory count drifts from
 * the committed frozen contract.
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
  return path.startsWith('course-content/runtime/') && !path.includes('/releases/');
}

/**
 * QA evidence lifecycle adapter: artifacts members are classified by the
 * committed QA lifecycle contract, digest-bound to each member's Git blob.
 */
export function buildQaEvidenceAdapter(
  reader: SubjectTreeReader,
  entries: readonly InventoryEntry[],
  contract: QaLifecycleContract,
): AdapterBundle {
  const artifactEntries = entries.filter((entry) => entry.path.startsWith('artifacts/'));
  const overrides: EvidenceOverride[] = [];
  let proven = 0;
  for (const entry of artifactEntries) {
    const outcome = contract.classifyArtifact(entry.path, entry.hash);
    if (!outcome) continue;
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

function qaOverride(path: string, blobHash: string, outcome: QaLifecycleOutcome): EvidenceOverride {
  const facets: Partial<Facets> = {
    privacy: outcome.privacyClass === 'public-fixture'
      ? 'public'
      : outcome.privacyClass === 'private-run-evidence' ? 'private' : 'internal',
    retention: outcome.retentionDecision === 'retain-in-repo'
      ? 'retain-in-git'
      : outcome.retentionDecision === 'externalize-then-delete' ? 'existing-external-lifecycle' : 'retain-in-git',
  };
  if (outcome.evidenceClass === 'representative-fixture') {
    facets.authorship = 'generated';
    facets.reproducibility = 'non-reproducible';
    facets.qaRoles = ['representative-fixture'];
  } else if (outcome.evidenceClass === 'run-specific-output') {
    facets.authorship = 'generated';
    facets.reproducibility = 'non-reproducible';
    facets.qaRoles = ['run-specific-output'];
  } else if (outcome.evidenceClass === 'audit-closure-document') {
    // Audit closure documents are kept as a ledger, not ephemeral run output:
    // hand-authored retention authority, no ephemeral QA role facet.
    facets.authorship = 'hand-authored';
  } else {
    facets.authorship = 'generated';
    facets.reproducibility = 'reproducible';
  }
  return {
    path,
    facets,
    producer: `producer:qa-evidence-lifecycle:${outcome.owner}`,
    authority: `qa-evidence-lifecycle:git-blob:${blobHash}`,
    materialization: 'not-applicable',
    recovery: 'git-checkout-source-tree',
    rollback: 'git-history-blob',
  };
}

const PRIVACY_SCAN_TEXT_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'md', 'json', 'jsonl', 'txt', 'py', 'sh', 'yaml', 'yml', 'toml', 'sql', 'html', 'css',
]);

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
    const bytes = reader.blobBytes(entry.hash);
    const hitsForText = contract.scanText(bytes.toString('utf8'));
    if (hitsForText === null) {
      unscannable += 1;
      continue;
    }
    if (hitsForText.length > 0) {
      hits += 1;
      continue;
    }
    overrides.push({
      path: entry.path,
      facets: { privacy: 'internal' },
      authority: `content-scan:git-blob:${entry.hash}`,
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
