/**
 * Evaluate the published latest qualified composite against complete-locale.
 *
 * Future translation-release adoption still requires a separate exact-version
 * OpenSpec after that release's immutable locale manifest and coverage
 * evidence exist. This module never follows `latest` and never writes
 * production selectors.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { envelopeByName } from '@/lib/actkg-envelope/composite-envelope-registry';

import {
  FUTURE_TRANSLATION_RELEASE_REQUIRES_EXACT_OPENSPEC,
  LOCALE_MANIFEST_CONTRACT,
  PUBLISHED_LATEST_COMPOSITE_NAME,
  type AuthorityLocaleManifest,
  type ReleaseLocaleQualification,
} from './contracts';
import { V022_ENVELOPE_IDENTITY } from './fixtures';
import { qualifyReleaseLocales } from './qualify';

export { FUTURE_TRANSLATION_RELEASE_REQUIRES_EXACT_OPENSPEC };

export const PUBLISHED_LOCALE_MANIFEST_RELATIVE = (
  `course-content/authoring/knowledge/cutover/envelopes/locale-manifests/${PUBLISHED_LATEST_COMPOSITE_NAME}.json`
);

export function loadPublishedLatestEnvelopeIdentity(repoRoot = process.cwd()) {
  const envelope = envelopeByName(PUBLISHED_LATEST_COMPOSITE_NAME, repoRoot);
  if (
    envelope.authorityReleaseId !== V022_ENVELOPE_IDENTITY.authorityReleaseId
    || envelope.authoritySnapshotId !== V022_ENVELOPE_IDENTITY.authoritySnapshotId
    || envelope.authoritySnapshotHash !== V022_ENVELOPE_IDENTITY.authoritySnapshotHash
  ) {
    throw new Error('published latest composite identity drifted from the pinned v0.22 contract');
  }
  return {
    name: envelope.name,
    authorityReleaseId: envelope.authorityReleaseId,
    authoritySnapshotId: envelope.authoritySnapshotId,
    authoritySnapshotHash: envelope.authoritySnapshotHash,
  };
}

export function readPublishedLocaleManifest(
  repoRoot = process.cwd(),
): AuthorityLocaleManifest | null {
  const filePath = path.join(repoRoot, PUBLISHED_LOCALE_MANIFEST_RELATIVE);
  if (!existsSync(filePath)) return null;
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as AuthorityLocaleManifest;
  if (parsed.contract !== LOCALE_MANIFEST_CONTRACT) return parsed;
  return parsed;
}

export function qualifyPublishedLatestComposite(
  repoRoot = process.cwd(),
): ReleaseLocaleQualification {
  const envelope = loadPublishedLatestEnvelopeIdentity(repoRoot);
  const manifest = readPublishedLocaleManifest(repoRoot);
  return qualifyReleaseLocales(manifest, envelope);
}

export const FUTURE_RELEASE_BOUNDARY = FUTURE_TRANSLATION_RELEASE_REQUIRES_EXACT_OPENSPEC;
