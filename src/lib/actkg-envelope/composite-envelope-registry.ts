/**
 * Named, qualified composite release envelopes. Selector identities load from
 * a sealed JSON configuration artifact, not compiled-in v0.18 constants.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const COMPOSITE_ENVELOPE_REGISTRY_CONTRACT = 'actkg-composite-envelope-registry/v1' as const;
export const COMPOSITE_ENVELOPE_REGISTRY_RELATIVE =
  'course-content/authoring/knowledge/cutover/envelopes/actkg-composite-envelope-registry.json' as const;

export interface CompositeEnvelopeRecord {
  name: string;
  qualified: boolean;
  authorityReleaseId: string;
  authoritySnapshotId: string;
  authoritySnapshotHash: string;
  multilingualLabelCount: number | null;
  runtimeProfileSha256: string | null;
  projectionId: string;
  projectionHash: string;
  publicationId: string;
  publicationHash: string;
  catalogId: string;
  catalogHash: string;
  shardSetId: string;
  shardSetHash: string;
  activationId: string;
  activationHash: string | null;
  profileId: string;
}

export class CompositeEnvelopeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CompositeEnvelopeError';
    this.code = code;
  }
}

const cache = new Map<string, readonly CompositeEnvelopeRecord[]>();

function assertNotLatest(value: string): void {
  if (value === 'latest' || value.endsWith('/latest') || value.includes('@latest')) {
    throw new CompositeEnvelopeError('latest-forbidden', 'composite envelope must not resolve latest');
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseEnvelope(value: unknown): CompositeEnvelopeRecord {
  const row = asRecord(value);
  const name = String(row.name ?? '');
  assertNotLatest(name);
  if (!name || row.qualified !== true) {
    throw new CompositeEnvelopeError('envelope-unknown', `unknown or unqualified composite envelope: ${name || '<missing>'}`);
  }
  return {
    name,
    qualified: true,
    authorityReleaseId: String(row.authorityReleaseId ?? ''),
    authoritySnapshotId: String(row.authoritySnapshotId ?? ''),
    authoritySnapshotHash: String(row.authoritySnapshotHash ?? ''),
    multilingualLabelCount: typeof row.multilingualLabelCount === 'number' ? row.multilingualLabelCount : null,
    runtimeProfileSha256: typeof row.runtimeProfileSha256 === 'string' ? row.runtimeProfileSha256 : null,
    projectionId: String(row.projectionId ?? ''),
    projectionHash: String(row.projectionHash ?? ''),
    publicationId: String(row.publicationId ?? ''),
    publicationHash: String(row.publicationHash ?? ''),
    catalogId: String(row.catalogId ?? ''),
    catalogHash: String(row.catalogHash ?? ''),
    shardSetId: String(row.shardSetId ?? ''),
    shardSetHash: String(row.shardSetHash ?? ''),
    activationId: String(row.activationId ?? ''),
    activationHash: typeof row.activationHash === 'string' ? row.activationHash : null,
    profileId: String(row.profileId ?? ''),
  };
}

export function loadCompositeEnvelopeRegistry(repoRoot = process.cwd()): readonly CompositeEnvelopeRecord[] {
  const root = path.resolve(repoRoot);
  const cached = cache.get(root);
  if (cached) return cached;
  const filePath = path.join(root, COMPOSITE_ENVELOPE_REGISTRY_RELATIVE);
  if (!existsSync(filePath)) {
    throw new CompositeEnvelopeError('envelope-registry-missing', `sealed envelope registry missing: ${COMPOSITE_ENVELOPE_REGISTRY_RELATIVE}`);
  }
  const parsed = asRecord(JSON.parse(readFileSync(filePath, 'utf8')));
  if (parsed.contract !== COMPOSITE_ENVELOPE_REGISTRY_CONTRACT) {
    throw new CompositeEnvelopeError('envelope-registry-contract', 'sealed envelope registry contract is invalid');
  }
  const envelopes = Array.isArray(parsed.envelopes) ? parsed.envelopes.map(parseEnvelope) : [];
  if (envelopes.length === 0) {
    throw new CompositeEnvelopeError('envelope-registry-empty', 'sealed envelope registry has no qualified envelopes');
  }
  const frozen = Object.freeze(envelopes);
  cache.set(root, frozen);
  return frozen;
}

export function envelopeByName(name: string, repoRoot = process.cwd()): CompositeEnvelopeRecord {
  assertNotLatest(name);
  const match = loadCompositeEnvelopeRegistry(repoRoot).find((row) => row.name === name);
  if (!match || !match.qualified) {
    throw new CompositeEnvelopeError('envelope-unknown', `unknown or unqualified composite envelope: ${name}`);
  }
  return match;
}

export function multilingualLabelCountForRelease(releaseId: string, repoRoot = process.cwd()): number | null {
  return loadCompositeEnvelopeRegistry(repoRoot).find((row) => row.authorityReleaseId === releaseId)?.multilingualLabelCount
    ?? null;
}

export function matchCompositeEnvelope(
  identity: {
    authorityReleaseId: string;
    authoritySnapshotId: string;
    authoritySnapshotHash: string;
    projectionId: string;
    projectionHash: string;
    publicationId: string;
    publicationHash: string;
    shardSetId: string;
    shardSetHash: string;
    catalogId: string;
    catalogHash: string;
    activationId: string;
    activationHash: string | null;
  },
  repoRoot = process.cwd(),
): CompositeEnvelopeRecord {
  for (const value of Object.values(identity)) {
    if (typeof value === 'string') assertNotLatest(value);
  }
  const matches = loadCompositeEnvelopeRegistry(repoRoot).filter((row) => (
    row.authorityReleaseId === identity.authorityReleaseId
    && row.authoritySnapshotId === identity.authoritySnapshotId
    && row.authoritySnapshotHash === identity.authoritySnapshotHash
    && row.projectionId === identity.projectionId
    && row.projectionHash === identity.projectionHash
    && row.publicationId === identity.publicationId
    && row.publicationHash === identity.publicationHash
    && row.shardSetId === identity.shardSetId
    && row.shardSetHash === identity.shardSetHash
    && row.catalogId === identity.catalogId
    && row.catalogHash === identity.catalogHash
    && row.activationId === identity.activationId
    && row.activationHash === identity.activationHash
  ));
  if (matches.length !== 1) {
    throw new CompositeEnvelopeError(
      'envelope-mix',
      'selector identities do not resolve one qualified composite envelope',
    );
  }
  return matches[0]!;
}

export type EnvelopePointerComponent =
  | 'authority'
  | 'projection'
  | 'prerequisite'
  | 'authority-domain-shards'
  | 'consumer-activation';

export function pointerIdentitiesForEnvelope(
  name: string,
  repoRoot = process.cwd(),
): Record<EnvelopePointerComponent, { id: string; hash: string | null }> {
  const envelope = envelopeByName(name, repoRoot);
  return {
    authority: { id: envelope.authoritySnapshotId, hash: envelope.authoritySnapshotHash },
    projection: { id: envelope.projectionId, hash: envelope.projectionHash },
    prerequisite: { id: envelope.publicationId, hash: envelope.publicationHash },
    'authority-domain-shards': { id: envelope.shardSetId, hash: envelope.shardSetHash },
    'consumer-activation': { id: envelope.activationId, hash: envelope.activationHash },
  };
}
