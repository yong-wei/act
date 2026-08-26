import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import { privacyViolation } from '@/lib/architecture-census/privacy';

import type { QualificationFailure, ReleaseQualificationManifest } from './types';
import { RELEASE_QUALIFICATION_MANIFEST_SCHEMA_VERSION } from './types';

const FRESHNESS_MS = 14 * 24 * 60 * 60 * 1000;

export function parseReleaseManifest(text: string): ReleaseQualificationManifest {
  const parsed = JSON.parse(text) as ReleaseQualificationManifest;
  return parsed;
}

export function validateReleaseManifest(
  manifest: ReleaseQualificationManifest,
  options: {
    readonly repoRoot: string;
    readonly expectedCommit: string;
    readonly expectedTree: string;
    readonly now?: Date;
    readonly fileContents?: Readonly<Record<string, string>>;
  },
): QualificationFailure[] {
  const failures: QualificationFailure[] = [];
  if (manifest.schemaVersion !== RELEASE_QUALIFICATION_MANIFEST_SCHEMA_VERSION) {
    failures.push({ code: 'release-manifest-schema', identity: String(manifest.schemaVersion) });
  }
  if (manifest.sourceCommit !== options.expectedCommit || manifest.sourceTree !== options.expectedTree) {
    failures.push({ code: 'release-manifest-revision-drift', identity: manifest.sourceCommit });
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    failures.push({ code: 'release-manifest-empty', identity: 'artifacts' });
    return failures;
  }
  const now = options.now ?? new Date();
  for (const artifact of manifest.artifacts) {
    if (!artifact.path || isAbsolute(artifact.path) || artifact.path.includes('\\') || artifact.path.startsWith('/')) {
      failures.push({ code: 'release-artifact-path', identity: artifact.path || 'missing-path' });
      continue;
    }
    const privacy = privacyViolation(JSON.stringify(artifact));
    if (privacy) failures.push({ code: `release-privacy-${privacy}`, identity: artifact.path });
    if (artifact.sourceCommit !== manifest.sourceCommit || artifact.sourceTree !== manifest.sourceTree) {
      failures.push({ code: 'release-artifact-revision-drift', identity: artifact.path });
    }
    const capturedAt = Date.parse(artifact.capturedAt);
    if (!Number.isFinite(capturedAt) || now.getTime() - capturedAt > FRESHNESS_MS) {
      failures.push({ code: 'release-artifact-stale', identity: artifact.path });
    }
    const inline = options.fileContents?.[artifact.path];
    if (inline !== undefined) {
      const digest = sha256(inline);
      if (digest !== artifact.sha256) failures.push({ code: 'release-artifact-hash-drift', identity: artifact.path });
      continue;
    }
    const full = join(options.repoRoot, artifact.path);
    if (!existsSync(full) || statSync(full).isDirectory()) {
      failures.push({ code: 'release-artifact-missing', identity: artifact.path });
      continue;
    }
    const digest = sha256(readFileSync(full));
    if (digest !== artifact.sha256) failures.push({ code: 'release-artifact-hash-drift', identity: artifact.path });
  }
  return failures;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
