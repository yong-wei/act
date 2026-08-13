/**
 * Optional domain Teaching Projection overlay for Authority shards (#1375).
 *
 * The current pointer is an identity selector only.  Published relations are
 * read from the immutable composed release selected by that pointer and are
 * accepted only after the composed projection is recomputed and its identity
 * is checked against the pointer and the active Authority.
 */

import { join } from 'node:path';

import type { RegisteredPeerDomainId } from '@/lib/authority-domain-catalog/contracts';
import {
  DOMAIN_TEACHING_CURRENT_CONTRACT,
  teachingCacheFamilyFor,
  verifyDomainTeachingComposedArtifacts,
  composeDomainTeachingProjection,
  type DomainFragmentAuthorityBindingComplete,
  type DomainTeachingComposedArtifacts,
  type DomainTeachingComposedManifest,
  type DomainTeachingCurrentPointer,
  type DomainTeachingFragment,
  type TeachingCoverageState,
} from '@/lib/teaching-projection/domain-fragments';

import {
  TEACHING_LAYER,
  type AuthorityShardRelation,
  type AuthorityShardTeachingCoverage,
} from './contracts';
import { defaultShardIo, readJsonViaIo, type ShardIo } from './store';

export const DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE =
  'course-content/runtime/knowledge/teaching-projection/domain-fragments' as const;

export type { DomainTeachingComposedArtifacts };

/** The runtime consumes the published pointer's exact identity-only contract. */
export type DomainTeachingRuntimePointer = DomainTeachingCurrentPointer;

export interface DomainTeachingRuntimePaths {
  root: string;
  currentPath: string;
  releasesDir: string;
}

export interface DomainTeachingAuthorityIdentity {
  releaseId: string;
  releaseSetId: string;
  snapshotId: string;
  snapshotHash: string;
}

export interface DomainTeachingProjectionLoad {
  pointer: DomainTeachingRuntimePointer | null;
  artifacts: DomainTeachingComposedArtifacts | null;
  reason?: string;
}

export interface TeachingOverlay {
  pointer: DomainTeachingRuntimePointer | null;
  coverage(domainId: RegisteredPeerDomainId): AuthorityShardTeachingCoverage;
  relations(domainId: RegisteredPeerDomainId): AuthorityShardRelation[];
}

const UNAVAILABLE_NOTE = '教学关系暂不可用';

export function resolveDomainTeachingRuntimePaths(
  repoRoot = process.cwd(),
  relative: string = DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE,
): DomainTeachingRuntimePaths {
  const root = join(repoRoot, relative);
  return {
    root,
    currentPath: join(root, 'current.json'),
    releasesDir: join(root, 'releases'),
  };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pointerFromUnknown(value: unknown): DomainTeachingRuntimePointer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (
    raw.contract !== DOMAIN_TEACHING_CURRENT_CONTRACT
    || !nonEmptyString(raw.projectionId)
    || !nonEmptyString(raw.projectionHash)
    || !nonEmptyString(raw.authorityReleaseId)
    || !nonEmptyString(raw.authorityDigest)
    || !nonEmptyString(raw.teachingCacheFamily)
    || !nonEmptyString(raw.activatedAt)
  ) {
    return null;
  }

  // Do not spread the input: a pointer is deliberately identity-only.
  return {
    contract: DOMAIN_TEACHING_CURRENT_CONTRACT,
    projectionId: raw.projectionId,
    projectionHash: raw.projectionHash,
    authorityReleaseId: raw.authorityReleaseId,
    authorityDigest: raw.authorityDigest,
    teachingCacheFamily: raw.teachingCacheFamily,
    activatedAt: raw.activatedAt,
  };
}

export function loadOptionalDomainTeachingPointer(
  repoRoot = process.cwd(),
  io: ShardIo = defaultShardIo,
  relative: string = DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE,
): DomainTeachingRuntimePointer | null {
  const pointerPath = resolveDomainTeachingRuntimePaths(repoRoot, relative).currentPath;
  if (!io.exists(pointerPath)) return null;
  try {
    return pointerFromUnknown(JSON.parse(io.readFile(pointerPath)) as unknown);
  } catch {
    return null;
  }
}

function readJsonIfPresent(io: ShardIo, filePath: string): unknown | null {
  if (!io.exists(filePath)) return null;
  return readJsonViaIo<unknown>(io, filePath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function manifestFromUnknown(value: unknown): DomainTeachingComposedManifest | null {
  if (!isRecord(value)) return null;
  const candidate = isRecord(value.manifest) ? value.manifest : value;
  if (candidate.contract !== 'act-domain-teaching-composed-manifest/v1') return null;
  return candidate as unknown as DomainTeachingComposedManifest;
}

function inlineArtifactsFromUnknown(value: unknown): DomainTeachingComposedArtifacts | null {
  if (!isRecord(value)) return null;
  const candidate = isRecord(value.artifacts) ? value.artifacts : value;
  if (
    !isRecord(candidate.manifest)
    || !Array.isArray(candidate.fragments)
    || !Array.isArray(candidate.relations)
    || !Array.isArray(candidate.coreNodes)
    || !Array.isArray(candidate.coverage)
    || !isRecord(candidate.gate)
  ) {
    return null;
  }
  return candidate as unknown as DomainTeachingComposedArtifacts;
}

function readFirstExisting(
  io: ShardIo,
  candidates: readonly string[],
): { path: string; value: unknown } | null {
  for (const candidate of candidates) {
    const value = readJsonIfPresent(io, candidate);
    if (value !== null) return { path: candidate, value };
  }
  return null;
}

function readComposedArtifacts(
  io: ShardIo,
  releaseDir: string,
): DomainTeachingComposedArtifacts {
  const inline = readFirstExisting(io, [
    join(releaseDir, 'artifacts.json'),
    join(releaseDir, 'composed.json'),
    join(releaseDir, 'composed-artifacts.json'),
  ]);
  if (inline) {
    const artifacts = inlineArtifactsFromUnknown(inline.value);
    if (artifacts) return verifyDomainTeachingComposedArtifacts(artifacts);
  }

  const manifestFile = readFirstExisting(io, [
    join(releaseDir, 'manifest.json'),
    join(releaseDir, 'composed-manifest.json'),
  ]);
  const manifest = manifestFromUnknown(manifestFile?.value);
  if (!manifest) {
    throw new Error('immutable composed Teaching manifest is unavailable');
  }

  const fragments: DomainTeachingFragment[] = [];
  for (const ref of [...manifest.fragments].sort((left, right) => left.order - right.order)) {
    const fragmentFile = readFirstExisting(io, [
      join(releaseDir, 'fragments', `${ref.fragmentId}.json`),
      join(releaseDir, 'fragments', `${ref.fragmentKey}.json`),
      join(releaseDir, `${ref.fragmentId}.json`),
      join(releaseDir, `${ref.fragmentKey}.json`),
    ]);
    if (!fragmentFile || !isRecord(fragmentFile.value)) {
      throw new Error(`immutable composed Teaching fragment ${ref.fragmentId} is unavailable`);
    }
    fragments.push(fragmentFile.value as unknown as DomainTeachingFragment);
  }

  // Recomposition derives relations, core nodes and coverage from the sealed
  // fragment bytes; no caller-provided relation array is trusted.
  const composed = composeDomainTeachingProjection({
    fragments,
    authoringRevision: manifest.authoringRevision,
    authorityBinding: manifest.authorityBinding,
    authoritySelection: manifest.authoritySelection,
  });
  return verifyDomainTeachingComposedArtifacts({
    ...composed,
    manifest,
  });
}

function authorityBindingMatches(
  manifest: DomainTeachingComposedManifest,
  expected: DomainTeachingAuthorityIdentity,
): boolean {
  const binding = manifest.authorityBinding;
  return (
    binding.releaseId === expected.releaseId
    && binding.releaseSetId === expected.releaseSetId
    && binding.snapshotId === expected.snapshotId
    && binding.snapshotHash === expected.snapshotHash
  );
}

/**
 * Resolve the live pointer and its immutable composed artifact independently.
 * A bad artifact leaves the pointer identity available for diagnostics/public
 * envelope matching, but returns no Teaching relations.
 */
export function loadOptionalDomainTeachingProjection(options: {
  repoRoot?: string;
  io?: ShardIo;
  relative?: string;
  authority?: DomainTeachingAuthorityIdentity;
  pointer?: DomainTeachingRuntimePointer | null;
} = {}): DomainTeachingProjectionLoad {
  const repoRoot = options.repoRoot ?? process.cwd();
  const io = options.io ?? defaultShardIo;
  const relative = options.relative ?? DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE;
  const pointer = options.pointer !== undefined
    ? options.pointer
    : loadOptionalDomainTeachingPointer(repoRoot, io, relative);
  if (!pointer) {
    return { pointer: null, artifacts: null, reason: 'teaching-pointer-unavailable' };
  }

  try {
    const paths = resolveDomainTeachingRuntimePaths(repoRoot, relative);
    const artifacts = readComposedArtifacts(
      io,
      join(paths.releasesDir, pointer.projectionId),
    );
    const manifest = artifacts.manifest;
    if (
      manifest.projectionId !== pointer.projectionId
      || manifest.projectionHash !== pointer.projectionHash
      || manifest.authorityBinding.releaseId !== pointer.authorityReleaseId
      || manifest.authorityDigest !== pointer.authorityDigest
      || teachingCacheFamilyFor(manifest) !== pointer.teachingCacheFamily
    ) {
      throw new Error('Teaching pointer does not match its immutable composed artifact');
    }
    if (options.authority && !authorityBindingMatches(manifest, options.authority)) {
      throw new Error('composed Teaching artifact does not match active Authority identity');
    }
    return { pointer, artifacts };
  } catch (error) {
    return {
      pointer,
      artifacts: null,
      reason: error instanceof Error ? error.message : 'teaching-artifact-unavailable',
    };
  }
}

export function teachingCoverageFromState(
  domainId: RegisteredPeerDomainId,
  status: TeachingCoverageState,
  counts: {
    relationCount?: number;
    coreNodeCount?: number;
    uncoveredCoreNodeCount?: number;
    note?: string;
  } = {},
): AuthorityShardTeachingCoverage {
  const notes: Record<TeachingCoverageState, string> = {
    available: '该领域已发布可用的教学关系覆盖',
    partial: '该领域仅有部分教学关系已发布',
    empty: '该领域尚无已发布的教学关系',
    unavailable: UNAVAILABLE_NOTE,
  };
  return {
    status,
    domainId,
    relationCount: counts.relationCount ?? 0,
    coreNodeCount: counts.coreNodeCount ?? 0,
    uncoveredCoreNodeCount: counts.uncoveredCoreNodeCount ?? 0,
    note: counts.note ?? notes[status],
  };
}

export function projectTeachingRelation(
  relation: DomainTeachingComposedArtifacts['relations'][number],
): AuthorityShardRelation {
  return {
    id: relation.edgeId,
    predicate: relation.relationType,
    sourceId: relation.sourceNodeId,
    targetId: relation.targetNodeId,
    direction: 'source_to_target',
    direct: true,
    qualityTier: 'GOLD',
    governance: {
      reviewStatus: 'approved',
      publicationStatus: 'published',
    },
    semanticSupport: { supported: true, readOnly: true },
    layer: TEACHING_LAYER,
    relationFamily: 'teaching-prerequisite',
  };
}

export function createTeachingOverlay(
  pointer: DomainTeachingRuntimePointer | null,
  options: {
    artifacts?: DomainTeachingComposedArtifacts | null;
    coverageByDomain?: Partial<Record<RegisteredPeerDomainId, AuthorityShardTeachingCoverage>>;
    forceUnavailable?: boolean;
  } = {},
): TeachingOverlay {
  const artifacts = options.artifacts ?? null;
  if (options.forceUnavailable || !pointer || !artifacts) {
    return {
      pointer: null,
      coverage(domainId) {
        return options.coverageByDomain?.[domainId]
          ?? teachingCoverageFromState(domainId, 'unavailable');
      },
      relations() {
        return [];
      },
    };
  }

  const coverageByDomain = new Map(artifacts.coverage.map((entry) => [entry.domainId, entry]));
  return {
    pointer,
    coverage(domainId) {
      const entry = coverageByDomain.get(domainId);
      if (!entry) {
        return options.coverageByDomain?.[domainId]
          ?? teachingCoverageFromState(domainId, 'unavailable');
      }
      return {
        status: entry.coverage,
        domainId,
        relationCount: entry.relationCount,
        coreNodeCount: entry.coreNodeCount,
        uncoveredCoreNodeCount: entry.uncoveredCoreNodeCount,
        note: entry.note,
      };
    },
    relations(domainId) {
      return artifacts.relations
        .filter((relation) => (
          relation.layer === 'ACT_TEACHING'
          && relation.domainKeys.includes(domainId)
        ))
        .map(projectTeachingRelation);
    },
  };
}
