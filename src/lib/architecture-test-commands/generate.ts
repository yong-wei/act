import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isMixedWorktree, loadGitSourceSnapshot, readCaptureIdentity } from '@/lib/architecture-census/identity';
import { privacyViolation } from '@/lib/architecture-census/privacy';
import { sha256Text } from '@/lib/architecture-census/serialize';
import { REQUIRED_BASELINE } from '@/lib/architecture-charter';

import { COMMAND_CONTRACTS } from './conventions';
import { discoverTests } from './discover';
import { assertQualified, qualifyDiscovery } from './qualify';
import { parseReleaseManifest, validateReleaseManifest } from './release';
import type { DiscoveryCore, GovernedCommandId, QualificationFailure } from './types';
import { REQUIRED_CHARTER } from './types';

export interface LiveDiscoveryOptions {
  readonly repoRoot: string;
  readonly writeQualified?: boolean;
}

export function loadPinnedCharterHash(repoRoot: string): string {
  return readFileSync(join(repoRoot, 'docs/architecture/modular-monolith-charter.sha256'), 'utf8').trim();
}

export function generateLiveDiscovery(options: LiveDiscoveryOptions): {
  core: DiscoveryCore;
  failures: QualificationFailure[];
  dirty: boolean;
  mixedWorktree: boolean;
} {
  const snapshot = loadGitSourceSnapshot(options.repoRoot);
  const charterSha256 = loadPinnedCharterHash(options.repoRoot);
  const core = discoverTests({
    paths: snapshot.files.map((file) => file.path),
    sourceCommit: snapshot.identity.sourceCommit,
    sourceTree: snapshot.identity.sourceTree,
    charterSha256,
  });
  const failures = qualifyDiscovery(core, {
    charterSha256,
    charterPresent: true,
    dirty: snapshot.dirty,
    mixedWorktree: snapshot.mixedWorktree,
    writeQualified: options.writeQualified,
  });
  const serialized = JSON.stringify(core);
  const privacy = privacyViolation(serialized);
  if (privacy) failures.push({ code: `privacy-${privacy}`, identity: 'discovery-core' });
  return {
    core,
    failures,
    dirty: snapshot.dirty,
    mixedWorktree: snapshot.mixedWorktree,
  };
}

export function qualifyLiveDiscovery(options: LiveDiscoveryOptions): DiscoveryCore {
  const generated = generateLiveDiscovery(options);
  assertQualified(generated.failures);
  return generated.core;
}

export function defaultProductCommandsReadReleaseEvidence(commandId: GovernedCommandId): boolean {
  if (commandId === 'test:release') return true;
  const command = COMMAND_CONTRACTS.find((item) => item.id === commandId);
  return Boolean(command?.layers.includes('release') || command?.requiredInputs.includes('qualification-manifest'));
}

export function releaseCommandFailures(
  repoRoot: string,
  manifestPath: string | null,
  expectedCommit?: string,
  expectedTree?: string,
): QualificationFailure[] {
  if (!manifestPath) return [{ code: 'release-manifest-missing', identity: 'qualification-manifest' }];
  const identity = expectedCommit && expectedTree
    ? { sourceCommit: expectedCommit, sourceTree: expectedTree }
    : readCaptureIdentity(repoRoot);
  let text: string;
  try {
    text = readFileSync(manifestPath.startsWith('/') ? manifestPath : join(repoRoot, manifestPath), 'utf8');
  } catch {
    return [{ code: 'release-manifest-missing', identity: manifestPath }];
  }
  const privacy = privacyViolation(text);
  if (privacy) return [{ code: `release-privacy-${privacy}`, identity: manifestPath }];
  const manifest = parseReleaseManifest(text);
  return validateReleaseManifest(manifest, {
    repoRoot,
    expectedCommit: identity.sourceCommit,
    expectedTree: identity.sourceTree,
  });
}

export function pinnedPrerequisiteHashes(): { baseline: string; charter: string } {
  return {
    baseline: REQUIRED_BASELINE.censusCoreSha256,
    charter: REQUIRED_CHARTER.sha256,
  };
}

export function hashText(text: string): string {
  return sha256Text(text);
}

export { isMixedWorktree };
