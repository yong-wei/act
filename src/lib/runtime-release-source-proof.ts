import { createHash } from 'node:crypto';

import type {
  ActRuntimeBlobReleaseFileSource,
  ActRuntimeBlobReleaseManifest,
} from '@/lib/runtime-release';
import { stableStringify } from '@/lib/aggregate-governance/hash';

export const RUNTIME_RELEASE_SOURCE_PROOF_SCHEMA_VERSION = 'act-runtime-release-source-provenance-proof.v1';

type GitMode = '100644' | '100755';

export interface RuntimeReleaseSourceProofGitEntry {
  path: string;
  mode: GitMode;
  gitObjectId: string;
}

export interface RuntimeReleaseSourceProofExternalEntry {
  path: string;
  sizeBytes: number;
  sha256: string;
  source: ActRuntimeBlobReleaseFileSource;
}

export interface RuntimeReleaseSourceProvenanceProof {
  schemaVersion: typeof RUNTIME_RELEASE_SOURCE_PROOF_SCHEMA_VERSION;
  sourceRevision: string;
  integrationRef: string;
  integrationRevision: string;
  manifest: {
    releaseId: string;
    manifestSha256: string;
    manifestWireSha256: string;
    treeSha256: string;
    fileCount: number;
    totalBytes: number;
  };
  parent: {
    releaseId: string;
    manifestSha256: string;
    treeSha256: string;
  } | null;
  gitTree: RuntimeReleaseSourceProofGitEntry[];
  externalFiles: RuntimeReleaseSourceProofExternalEntry[];
  proofSha256: string;
}

function proofError(message: string): never {
  throw new Error(`runtime-release-source-proof:${message}`);
}

function digest(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function wire(value: unknown) {
  return `${stableStringify(value)}\n`;
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], context: string) {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    proofError(`${context} has unsupported or missing fields`);
  }
}

function object(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) proofError(`${context} must be an object`);
  return value as Record<string, unknown>;
}

function string(value: unknown, context: string) {
  if (typeof value !== 'string' || value.length === 0) proofError(`${context} must be a non-empty string`);
  return value;
}

function sha256(value: unknown, context: string) {
  const candidate = string(value, context).toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(candidate)) proofError(`${context} must be a SHA-256 digest`);
  return candidate;
}

function revision(value: unknown, context: string) {
  const candidate = string(value, context).toLowerCase();
  if (!/^[a-f0-9]{40}$/u.test(candidate)) proofError(`${context} must be a complete Git revision`);
  return candidate;
}

function integer(value: unknown, context: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) proofError(`${context} must be a non-negative safe integer`);
  return Number(value);
}

function relativePath(value: unknown, context: string) {
  const candidate = string(value, context);
  if (
    candidate.includes('\\')
    || candidate.startsWith('/')
    || /^[A-Za-z]:\//u.test(candidate)
    || /[\u0000-\u001f\u007f]/u.test(candidate)
    || candidate.split('/').some((part) => !part || part === '.' || part === '..')
  ) proofError(`${context} is unsafe`);
  return candidate;
}

function source(value: unknown, context: string): ActRuntimeBlobReleaseFileSource {
  const raw = object(value, context);
  if (Object.hasOwn(raw, 'gitObjectId')) {
    assertExactKeys(raw, ['gitObjectId'], context);
    const gitObjectId = string(raw.gitObjectId, `${context}.gitObjectId`).toLowerCase();
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(gitObjectId)) proofError(`${context}.gitObjectId is invalid`);
    return { gitObjectId };
  }
  const hasBundle = Object.hasOwn(raw, 'bundleSemanticSha256') || Object.hasOwn(raw, 'bundleWireSha256');
  assertExactKeys(raw, hasBundle
    ? ['externalInputId', 'externalInputManifestObjectId', 'bundleSemanticSha256', 'bundleWireSha256']
    : ['externalInputId', 'externalInputManifestObjectId'], context);
  const externalInputId = string(raw.externalInputId, `${context}.externalInputId`);
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u.test(externalInputId)) proofError(`${context}.externalInputId is invalid`);
  const externalInputManifestObjectId = string(raw.externalInputManifestObjectId, `${context}.externalInputManifestObjectId`).toLowerCase();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(externalInputManifestObjectId)) proofError(`${context}.externalInputManifestObjectId is invalid`);
  if (hasBundle) {
    return {
      externalInputId,
      externalInputManifestObjectId,
      bundleSemanticSha256: sha256(raw.bundleSemanticSha256, `${context}.bundleSemanticSha256`),
      bundleWireSha256: sha256(raw.bundleWireSha256, `${context}.bundleWireSha256`),
    };
  }
  return { externalInputId, externalInputManifestObjectId };
}

function sourceIdentityBody(proof: Omit<RuntimeReleaseSourceProvenanceProof, 'proofSha256'>) {
  return {
    schemaVersion: proof.schemaVersion,
    sourceRevision: proof.sourceRevision,
    integrationRef: proof.integrationRef,
    integrationRevision: proof.integrationRevision,
    manifest: proof.manifest,
    parent: proof.parent,
    gitTree: proof.gitTree,
    externalFiles: proof.externalFiles,
  };
}

export function serializeRuntimeReleaseSourceProvenanceProof(proof: RuntimeReleaseSourceProvenanceProof) {
  const body = sourceIdentityBody(proof);
  if (proof.proofSha256 !== digest(body)) proofError('proof digest does not match canonical content');
  return wire({ ...body, proofSha256: proof.proofSha256 });
}

export function runtimeReleaseSourceProvenanceProofWireSha256(proof: RuntimeReleaseSourceProvenanceProof) {
  return createHash('sha256').update(serializeRuntimeReleaseSourceProvenanceProof(proof)).digest('hex');
}

export function buildRuntimeReleaseSourceProvenanceProof(input: {
  sourceRevision: string;
  integrationRef: string;
  integrationRevision: string;
  manifest: ActRuntimeBlobReleaseManifest;
  manifestWireSha256: string;
  parentManifest?: ActRuntimeBlobReleaseManifest;
  gitTree: readonly RuntimeReleaseSourceProofGitEntry[];
}) {
  const gitTree = [...input.gitTree].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const externalFiles = input.manifest.files
    .filter((file) => file.source && !('gitObjectId' in file.source))
    .map((file) => ({ path: file.path, sizeBytes: file.sizeBytes, sha256: file.sha256, source: file.source! }))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const body = {
    schemaVersion: RUNTIME_RELEASE_SOURCE_PROOF_SCHEMA_VERSION,
    sourceRevision: input.sourceRevision.toLowerCase(),
    integrationRef: input.integrationRef,
    integrationRevision: input.integrationRevision.toLowerCase(),
    manifest: {
      releaseId: input.manifest.releaseId,
      manifestSha256: input.manifest.manifestSha256,
      manifestWireSha256: input.manifestWireSha256,
      treeSha256: input.manifest.treeSha256,
      fileCount: input.manifest.fileCount,
      totalBytes: input.manifest.totalBytes,
    },
    parent: input.parentManifest
      ? {
        releaseId: input.parentManifest.releaseId,
        manifestSha256: input.parentManifest.manifestSha256,
        treeSha256: input.parentManifest.treeSha256,
      }
      : null,
    gitTree,
    externalFiles,
  } satisfies Omit<RuntimeReleaseSourceProvenanceProof, 'proofSha256'>;
  if (!/^[a-f0-9]{40}$/u.test(body.sourceRevision) || !/^[a-f0-9]{40}$/u.test(body.integrationRevision)) proofError('source revisions are invalid');
  if (!/^[a-f0-9]{64}$/u.test(body.manifest.manifestWireSha256)) proofError('manifest wire digest is invalid');
  return { ...body, proofSha256: digest(body) } satisfies RuntimeReleaseSourceProvenanceProof;
}

export function parseRuntimeReleaseSourceProvenanceProof(value: unknown): RuntimeReleaseSourceProvenanceProof {
  const raw = object(value, 'proof');
  assertExactKeys(raw, ['schemaVersion', 'sourceRevision', 'integrationRef', 'integrationRevision', 'manifest', 'parent', 'gitTree', 'externalFiles', 'proofSha256'], 'proof');
  if (raw.schemaVersion !== RUNTIME_RELEASE_SOURCE_PROOF_SCHEMA_VERSION) proofError('unsupported proof schema version');
  const manifestRaw = object(raw.manifest, 'proof.manifest');
  assertExactKeys(manifestRaw, ['releaseId', 'manifestSha256', 'manifestWireSha256', 'treeSha256', 'fileCount', 'totalBytes'], 'proof.manifest');
  const parsedManifest = {
    releaseId: string(manifestRaw.releaseId, 'proof.manifest.releaseId'),
    manifestSha256: sha256(manifestRaw.manifestSha256, 'proof.manifest.manifestSha256'),
    manifestWireSha256: sha256(manifestRaw.manifestWireSha256, 'proof.manifest.manifestWireSha256'),
    treeSha256: sha256(manifestRaw.treeSha256, 'proof.manifest.treeSha256'),
    fileCount: integer(manifestRaw.fileCount, 'proof.manifest.fileCount'),
    totalBytes: integer(manifestRaw.totalBytes, 'proof.manifest.totalBytes'),
  };
  let parent: RuntimeReleaseSourceProvenanceProof['parent'] = null;
  if (raw.parent !== null) {
    const parentRaw = object(raw.parent, 'proof.parent');
    assertExactKeys(parentRaw, ['releaseId', 'manifestSha256', 'treeSha256'], 'proof.parent');
    parent = {
      releaseId: string(parentRaw.releaseId, 'proof.parent.releaseId'),
      manifestSha256: sha256(parentRaw.manifestSha256, 'proof.parent.manifestSha256'),
      treeSha256: sha256(parentRaw.treeSha256, 'proof.parent.treeSha256'),
    };
  }
  if (!Array.isArray(raw.gitTree) || !Array.isArray(raw.externalFiles)) proofError('proof source lists are invalid');
  const gitTree = raw.gitTree.map((value, index) => {
    const entry = object(value, `proof.gitTree[${index}]`);
    assertExactKeys(entry, ['path', 'mode', 'gitObjectId'], `proof.gitTree[${index}]`);
    const mode = string(entry.mode, `proof.gitTree[${index}].mode`);
    if (mode !== '100644' && mode !== '100755') proofError(`proof.gitTree[${index}].mode is invalid`);
    const gitObjectId = string(entry.gitObjectId, `proof.gitTree[${index}].gitObjectId`).toLowerCase();
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(gitObjectId)) proofError(`proof.gitTree[${index}].gitObjectId is invalid`);
    return { path: relativePath(entry.path, `proof.gitTree[${index}].path`), mode, gitObjectId } as RuntimeReleaseSourceProofGitEntry;
  });
  const externalFiles = raw.externalFiles.map((value, index) => {
    const entry = object(value, `proof.externalFiles[${index}]`);
    assertExactKeys(entry, ['path', 'sizeBytes', 'sha256', 'source'], `proof.externalFiles[${index}]`);
    return {
      path: relativePath(entry.path, `proof.externalFiles[${index}].path`),
      sizeBytes: integer(entry.sizeBytes, `proof.externalFiles[${index}].sizeBytes`),
      sha256: sha256(entry.sha256, `proof.externalFiles[${index}].sha256`),
      source: source(entry.source, `proof.externalFiles[${index}].source`),
    };
  });
  const sorted = (left: { path: string }, right: { path: string }) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
  if (gitTree.some((entry, index) => index > 0 && sorted(gitTree[index - 1]!, entry) >= 0)) proofError('proof.gitTree must be strictly path sorted');
  if (externalFiles.some((entry, index) => index > 0 && sorted(externalFiles[index - 1]!, entry) >= 0)) proofError('proof.externalFiles must be strictly path sorted');
  const parsed = {
    schemaVersion: RUNTIME_RELEASE_SOURCE_PROOF_SCHEMA_VERSION,
    sourceRevision: revision(raw.sourceRevision, 'proof.sourceRevision'),
    integrationRef: string(raw.integrationRef, 'proof.integrationRef'),
    integrationRevision: revision(raw.integrationRevision, 'proof.integrationRevision'),
    manifest: parsedManifest,
    parent,
    gitTree,
    externalFiles,
    proofSha256: sha256(raw.proofSha256, 'proof.proofSha256'),
  } satisfies RuntimeReleaseSourceProvenanceProof;
  if (parsed.proofSha256 !== digest(sourceIdentityBody(parsed))) proofError('proof digest does not match canonical content');
  return parsed;
}

export function assertRuntimeReleaseSourceProvenanceProofMatchesManifest(
  proof: RuntimeReleaseSourceProvenanceProof,
  manifest: ActRuntimeBlobReleaseManifest,
  manifestWireSha256: string,
) {
  if (
    proof.sourceRevision !== manifest.sourceRevision
    || proof.manifest.releaseId !== manifest.releaseId
    || proof.manifest.manifestSha256 !== manifest.manifestSha256
    || proof.manifest.manifestWireSha256 !== manifestWireSha256
    || proof.manifest.treeSha256 !== manifest.treeSha256
    || proof.manifest.fileCount !== manifest.fileCount
    || proof.manifest.totalBytes !== manifest.totalBytes
  ) proofError('proof does not match the submitted manifest identity');
}
