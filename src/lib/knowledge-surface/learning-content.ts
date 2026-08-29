import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  KnowledgeSurfaceAuthorityIdentity,
  KnowledgeSurfaceBlockStatus,
} from './types';

export const LEARNING_CONTENT_MANIFEST_V2_CONTRACT =
  'act-authority-learning-content-manifest/v2' as const;
export const LEARNING_CONTENT_MANIFEST_V1_CONTRACT =
  'act-authority-learning-content-manifest/v1' as const;
export const LEARNING_CONTENT_MANIFEST_V1_ALIAS =
  'authority-learning-content-manifest/v1' as const;

const MANIFEST_RELATIVE =
  'course-content/runtime/knowledge/authority-learning-content-manifest.json' as const;

export interface LearningContentManifestClassification {
  status: Extract<
    KnowledgeSurfaceBlockStatus,
    'available' | 'unavailable' | 'identity-mismatch' | 'version-drift' | 'missing'
  >;
  contract: string | null;
  reason: string;
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isV1Contract(contract: string): boolean {
  return (
    contract === LEARNING_CONTENT_MANIFEST_V1_CONTRACT
    || contract === LEARNING_CONTENT_MANIFEST_V1_ALIAS
    || contract.endsWith('learning-content-manifest/v1')
  );
}

export function classifyLearningContentManifest(
  manifest: unknown,
  authority: KnowledgeSurfaceAuthorityIdentity,
): LearningContentManifestClassification {
  if (manifest == null) {
    return { status: 'missing', contract: null, reason: 'manifest-missing' };
  }
  if (!manifest || typeof manifest !== 'object') {
    return { status: 'unavailable', contract: null, reason: 'manifest-malformed' };
  }
  const record = manifest as Record<string, unknown>;
  const contract = typeof record.contract === 'string' ? record.contract : null;
  if (!contract) {
    return { status: 'unavailable', contract: null, reason: 'manifest-contract-missing' };
  }
  if (isV1Contract(contract) || contract !== LEARNING_CONTENT_MANIFEST_V2_CONTRACT) {
    return { status: 'version-drift', contract, reason: 'learning-content-manifest-version-drift' };
  }
  if (
    !isNonEmptyString(record.authorityReleaseId)
    || !isNonEmptyString(record.authorityReleaseSetId)
    || !isNonEmptyString(record.authoritySnapshotId)
    || !isSha256(record.authoritySnapshotHash)
    || !Array.isArray(record.nodes)
  ) {
    return { status: 'unavailable', contract, reason: 'manifest-malformed' };
  }
  const canonicalIds = record.nodes.map((node) => (
    node && typeof node === 'object' ? (node as { canonicalId?: unknown }).canonicalId : null
  ));
  if (canonicalIds.some((id) => !isNonEmptyString(id))) {
    return { status: 'unavailable', contract, reason: 'manifest-malformed' };
  }
  if (new Set(canonicalIds).size !== canonicalIds.length) {
    return { status: 'unavailable', contract, reason: 'manifest-duplicate' };
  }
  if (
    record.authorityReleaseId !== authority.releaseId
    || record.authorityReleaseSetId !== authority.releaseSetId
    || record.authoritySnapshotId !== authority.snapshotId
    || record.authoritySnapshotHash !== authority.snapshotHash
  ) {
    return { status: 'identity-mismatch', contract, reason: 'learning-content-authority-mismatch' };
  }
  return { status: 'available', contract, reason: 'learning-content-v2' };
}

export function readLearningContentManifestClassification(
  authority: KnowledgeSurfaceAuthorityIdentity,
  repoRoot = process.cwd(),
): LearningContentManifestClassification {
  const path = join(repoRoot, MANIFEST_RELATIVE);
  if (!existsSync(path)) {
    return { status: 'missing', contract: null, reason: 'manifest-missing' };
  }
  try {
    return classifyLearningContentManifest(JSON.parse(readFileSync(path, 'utf8')), authority);
  } catch {
    return { status: 'unavailable', contract: null, reason: 'manifest-unreadable' };
  }
}
