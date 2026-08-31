/**
 * Stage an optional domain Teaching Projection runtime from a sealed candidate.
 *
 * This writes the identity-only current pointer plus the immutable composed
 * release. It does not rematerialize Authority shards or write production
 * selectors.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadCandidateDomainFragments } from '@/lib/latest-authority-oss-cutover/domain-fragment-files';
import { teachingCacheFamilyFor } from '@/lib/teaching-projection/domain-fragments/activation';
import {
  composeDomainTeachingProjection,
  verifyDomainTeachingComposedArtifacts,
} from '@/lib/teaching-projection/domain-fragments/compose';
import {
  DOMAIN_TEACHING_CURRENT_CONTRACT,
  type DomainTeachingComposedArtifacts,
  type DomainTeachingComposedManifest,
  type DomainTeachingCurrentPointer,
} from '@/lib/teaching-projection/domain-fragments/contracts';

import {
  DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE,
  resolveDomainTeachingRuntimePaths,
  type DomainTeachingRuntimePaths,
} from './teaching';

export const DEFAULT_SUCCESSOR_CANDIDATE_RELATIVE =
  'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c5' as const;

export function writeDomainTeachingRuntime(options: {
  repoRoot: string;
  pointer: DomainTeachingCurrentPointer;
  artifacts: DomainTeachingComposedArtifacts;
  relative?: string;
}): { paths: DomainTeachingRuntimePaths; files: string[] } {
  const paths = resolveDomainTeachingRuntimePaths(
    options.repoRoot,
    options.relative ?? DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE,
  );
  const releaseDir = join(paths.releasesDir, options.pointer.projectionId);
  mkdirSync(join(releaseDir, 'fragments'), { recursive: true });
  const files: string[] = [];
  const write = (filePath: string, value: unknown) => {
    writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
    files.push(filePath);
  };
  write(paths.currentPath, options.pointer);
  write(join(releaseDir, 'composed-manifest.json'), options.artifacts.manifest);
  for (const fragment of options.artifacts.fragments) {
    write(join(releaseDir, 'fragments', `${fragment.fragmentId}.json`), fragment);
  }
  return { paths, files };
}

export function stageDomainTeachingRuntimeFromCandidate(options: {
  repoRoot: string;
  candidateDir: string;
  relative?: string;
  activatedAt?: string;
}): {
  pointer: DomainTeachingCurrentPointer;
  artifacts: DomainTeachingComposedArtifacts;
  files: string[];
} {
  const manifest = JSON.parse(
    readFileSync(join(options.candidateDir, 'composed-domain-fragment-manifest.json'), 'utf8'),
  ) as DomainTeachingComposedManifest;
  const fragments = loadCandidateDomainFragments(options.candidateDir, manifest);
  const recomputed = composeDomainTeachingProjection({
    fragments,
    authoringRevision: manifest.authoringRevision,
    authorityBinding: manifest.authorityBinding,
    authoritySelection: manifest.authoritySelection,
  });
  const artifacts = verifyDomainTeachingComposedArtifacts({
    ...recomputed,
    manifest,
  });
  const receipt = JSON.parse(
    readFileSync(join(options.candidateDir, 'candidate-receipt.json'), 'utf8'),
  ) as { sealedAt?: string; composedDomainFragmentManifestHash?: string };
  if (
    typeof receipt.composedDomainFragmentManifestHash === 'string'
    && receipt.composedDomainFragmentManifestHash !== manifest.projectionHash
  ) {
    throw new Error('candidate receipt composedDomainFragmentManifestHash does not match the sealed manifest');
  }
  const pointer: DomainTeachingCurrentPointer = {
    contract: DOMAIN_TEACHING_CURRENT_CONTRACT,
    projectionId: artifacts.manifest.projectionId,
    projectionHash: artifacts.manifest.projectionHash,
    authorityReleaseId: artifacts.manifest.authorityBinding.releaseId,
    authorityDigest: artifacts.manifest.authorityDigest,
    teachingCacheFamily: teachingCacheFamilyFor(artifacts.manifest),
    activatedAt: options.activatedAt
      ?? (typeof receipt.sealedAt === 'string' ? receipt.sealedAt : '2026-08-30T05:18:28.334Z'),
  };
  const { files } = writeDomainTeachingRuntime({
    repoRoot: options.repoRoot,
    pointer,
    artifacts,
    relative: options.relative,
  });
  return { pointer, artifacts, files };
}
