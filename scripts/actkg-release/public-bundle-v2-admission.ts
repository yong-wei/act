import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';

import {
  matchedV2RegistryIdentities,
  publicBundleV2RegistryIdentity,
  REVIEWED_V0_18_V2_REGISTRY,
  type PublicBundleV2Registry,
} from './bundle-compatibility-registry-v2';
import { PublicBundleRejection } from './public-bundle-v1';
import type {
  PublicBundleV2AdmissionResult,
  RevisionIdentity,
} from './public-bundle-types';

const ADMISSION_CONTRACT_VERSION = 'actkg-public-bundle-v2-admission/1' as const;
const GIT_COMMIT = /^[a-f0-9]{40}$/u;
const SAFE_TAG = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/u;

function rejectAdmission(
  reason: string,
  registry: PublicBundleV2Registry,
): never {
  throw new PublicBundleRejection({
    code: 'INTEGRITY_REJECTED',
    reasons: [`v2 admission failed: ${reason}`],
    matchedIdentities: matchedV2RegistryIdentities(registry),
  });
}

function runGit(
  upstreamGitRoot: string,
  args: string[],
  registry: PublicBundleV2Registry,
): string {
  try {
    return execFileSync('git', args, {
      cwd: upstreamGitRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    rejectAdmission(`git ${args.join(' ')} could not be resolved`, registry);
  }
}

function assertRevisionShape(
  revision: RevisionIdentity,
  label: string,
  registry: PublicBundleV2Registry,
): void {
  if (!SAFE_TAG.test(revision.tag) || revision.tag.startsWith('-')) {
    rejectAdmission(`${label} tag is invalid`, registry);
  }
  if (!GIT_COMMIT.test(revision.commit)) {
    rejectAdmission(`${label} commit is invalid`, registry);
  }
}

function assertRepositoryIdentity(
  upstreamGitRoot: string,
  registry: PublicBundleV2Registry,
): void {
  const topLevel = runGit(upstreamGitRoot, ['rev-parse', '--show-toplevel'], registry);
  const canonicalTopLevel = realpathSync(topLevel);
  const canonicalRoot = realpathSync(upstreamGitRoot);
  if (canonicalTopLevel !== canonicalRoot) {
    rejectAdmission('upstreamGitRoot is not the repository top-level', registry);
  }
  const remoteUrl = runGit(upstreamGitRoot, ['config', '--get', 'remote.origin.url'], registry);
  if (remoteUrl !== registry.upstreamRepository.remoteUrl) {
    rejectAdmission(
      `upstream repository identity ${remoteUrl || '<missing>'} does not match ${registry.upstreamRepository.repositoryId}`,
      registry,
    );
  }
}

function resolveTag(
  upstreamGitRoot: string,
  revision: RevisionIdentity,
  label: string,
  registry: PublicBundleV2Registry,
): string {
  assertRevisionShape(revision, label, registry);
  // Resolve an explicit refs/tags path so a branch or HEAD cannot satisfy a
  // missing tag. `^{commit}` also dereferences annotated tags deterministically.
  const actual = runGit(
    upstreamGitRoot,
    ['rev-parse', '--verify', `refs/tags/${revision.tag}^{commit}`],
    registry,
  );
  if (!GIT_COMMIT.test(actual) || actual !== revision.commit) {
    rejectAdmission(
      `${label} tag ${revision.tag} points to ${actual || '<missing>'}, expected ${revision.commit}`,
      registry,
    );
  }
  return actual;
}

/**
 * Verify the frozen publication and source identities against a controlled
 * upstream Git checkout. This is an admission-time check only; the production
 * Bundle loader does not call it and remains portable over a bare export.
 */
export function admitPublicBundleV2(options: {
  upstreamGitRoot: string;
  registry?: PublicBundleV2Registry;
}): PublicBundleV2AdmissionResult {
  const registry = options.registry ?? REVIEWED_V0_18_V2_REGISTRY;
  const upstreamGitRoot = path.resolve(options.upstreamGitRoot);
  assertRepositoryIdentity(upstreamGitRoot, registry);

  const publicationRevision: RevisionIdentity = {
    tag: registry.publicationTag,
    commit: registry.publicationCommit,
  };
  const sourceRevision: RevisionIdentity = {
    tag: registry.sourceTag,
    commit: registry.sourceCommit,
  };
  resolveTag(upstreamGitRoot, publicationRevision, 'publication', registry);
  resolveTag(upstreamGitRoot, sourceRevision, 'source', registry);

  return {
    contractVersion: ADMISSION_CONTRACT_VERSION,
    status: 'PASS',
    registryIdentity: publicBundleV2RegistryIdentity(registry),
    upstreamRepository: { ...registry.upstreamRepository },
    publicationRevision,
    sourceRevision,
  };
}

/** Alias kept explicit for callers that prefer the registry/admission wording. */
export const admitRegisteredPublicBundleV2 = admitPublicBundleV2;

export const PUBLIC_BUNDLE_V2_ADMISSION_CONTRACT_VERSION = ADMISSION_CONTRACT_VERSION;
