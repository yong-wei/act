#!/usr/bin/env tsx

import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { PrismaClient } from '@prisma/client';
import { Client } from 'pg';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  CURRENT_AGGREGATE_RELEASE_ID,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
} from '../../src/lib/authoritative-knowledge/contracts';
import {
  assertFormalLearningFactSelectorUnchanged,
  selectLearningFactAuthority,
} from '../../src/lib/canonical-learning-fact-identity';
import {
  assertProductionSelectorUnchanged,
  selectRagAuthority,
} from '../../src/lib/canonical-rag';
import {
  canonicalJson,
  sha256,
} from '../actkg-release/authoritative-release';
import {
  importValidatedAggregateRelease,
  loadAndValidateAggregateRelease,
} from '../actkg-release/ctkg-0-2-aggregate-release';
import {
  loadAndValidatePublicBundleV1,
} from '../actkg-release/public-bundle-v1';
import {
  ACCEPTED_CANDIDATE_STATE,
  importValidatedActKGBundle,
} from '../actkg-release/standard-bundle-import';
import {
  computeReleaseSetDelta,
  parseUpstreamReleaseDiff,
} from '../actkg-release/release-set-delta-compute';
import {
  loadExactAcceptedEvidence,
  loadStandardAcceptedEvidence,
  loadUpstreamReleaseDiffRaw,
} from '../actkg-release/release-set-delta-load';
import {
  persistReleaseSetDelta,
  verifyReleaseSetDelta,
} from '../actkg-release/release-set-delta-persist';
import type {
  ComputedReleaseSetDelta,
  DeltaEvidenceRef,
  PersistedDeltaReceiptResult,
  UpstreamCrosscheckStatus,
} from '../actkg-release/release-set-delta-types';
import type { LatestStableAggregateBinding } from '../actkg-release/latest-stable-aggregate';

export const ADMISSION_PROTOCOL = 'actkg-latest-stable-aggregate-admission/1' as const;
export const FIRST_STAGED_BUNDLE_ID = 'ctb:control-theory-engineering-v0.3:r2' as const;
export const FIRST_STAGED_RELEASE_ID = 'ctr:release:control-theory-engineering-v0.3' as const;

type JsonObject = Record<string, unknown>;

export interface ChainAdmissionEntry {
  order: number;
  lockPath: string;
  lockSha256: string;
  releaseSetId: string;
  releaseId: string;
  releaseVersion: string;
  releaseHash: string;
  bundleId: string;
  bundleDigest: string;
}

export interface ChainAdmissionReceipt {
  protocol: string;
  outputRoot: string;
  bindingPath: string;
  predecessorClosurePath: string;
  predecessorClosureArtifactHash: string;
  admissionBridgePath: string;
  admissionBridgeFileSha256: string;
  admissionBridgeArtifactHash: string;
  admissionBridgeReleaseDiffDigest: string;
  resolutionDigest: string;
  chain: ChainAdmissionEntry[];
}

export interface ChainAdmissionLock {
  lock_version: string;
  release_set_id: string;
  bundle: {
    controlled_path: string;
    bundle_id: string;
    bundle_revision: number;
    bundle_digest: string;
    manifest_raw_sha256: string;
  };
  release: {
    release_id: string;
    release_version: string;
    release_hash: string;
    source_dataset_hash: string;
  };
  compatibility: {
    bundle_contract_version: string;
    schema_version: string;
    schema_sha256: string;
  };
  source_revision: { commit: string; tag: string };
  components: JsonObject[];
}

export interface AdmissionHopPlan {
  order: number;
  candidate: ChainAdmissionEntry;
  lock: ChainAdmissionLock;
  manifest: JsonObject;
  base: {
    kind: 'exact_import' | 'standard_bundle';
    releaseId: string;
    bundleId: string | null;
    bundleDigest: string | null;
  };
}

export interface AdmissionPlan {
  binding: LatestStableAggregateBinding;
  receipt: ChainAdmissionReceipt;
  hops: AdmissionHopPlan[];
  admissionBridgeReleaseDiff: JsonObject;
}

export interface AdmissionOptions {
  repoRoot: string;
  bindingPath: string;
  chainReceiptPath: string;
  outputRoot: string;
  captureRevision: string;
  /** Clean ACT checkout used for Git capture when staged intake is untracked. */
  captureRoot?: string;
  db: PrismaClient;
  /** Test-only injection; production CLI uses the real loaders/importers. */
  loadAggregate?: typeof loadAndValidateAggregateRelease;
  loadBundle?: typeof loadAndValidatePublicBundleV1;
  /** Test-only dependency seams; production CLI leaves all of these unset. */
  importAggregate?: typeof importValidatedAggregateRelease;
  importBundle?: typeof importValidatedActKGBundle;
  loadExact?: typeof loadExactAcceptedEvidence;
  loadStandard?: typeof loadStandardAcceptedEvidence;
  loadUpstream?: typeof loadUpstreamReleaseDiffRaw;
  computeDelta?: typeof computeReleaseSetDelta;
  persistDelta?: typeof persistReleaseSetDelta;
  verifyDelta?: typeof verifyReleaseSetDelta;
  selectorSnapshot?: typeof readSelectorGateSnapshot;
}

export interface AdmissionDeltaReceipt {
  order: number;
  upstreamSource: 'admission_bridge' | 'bundle_artifact';
  upstreamDiffDigest: string;
  base: DeltaEvidenceRef;
  candidate: DeltaEvidenceRef;
  persisted: PersistedDeltaReceiptResult;
  computed: Pick<
    ComputedReleaseSetDelta,
    'classification' | 'authorizationState' | 'inputDigest' | 'outputDigest'
      | 'naturalKey' | 'upstream' | 'summary' | 'identityViolations' | 'captureRevision'
  >;
}

export interface SelectorGateSnapshot {
  productionAuthority: string;
  productionCanonicalWriterEnabled: boolean;
  graphRagAuthority: string;
  graphRagCanonicalExpansionVisible: boolean;
  canonicalWriterFenceDigest: string;
}

export interface AdmissionGateSummary {
  PRODUCTION_SELECTOR_CHANGE: 0;
  GRAPH_RAG_SELECTOR_CHANGE: 0;
  CANONICAL_LEARNING_FACT_WRITER_FENCE_CHANGE: 0;
  before: SelectorGateSnapshot;
  after: SelectorGateSnapshot;
}

function fail(message: string): never {
  throw new Error(`ActKG latest Aggregate admission rejected: ${message}`);
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value as JsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function hash(value: unknown, label: string): string {
  const resolved = string(value, label);
  if (!/^[a-f0-9]{64}$/u.test(resolved)) fail(`${label} must be a lowercase SHA-256`);
  return resolved;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    fail(`${label} must be a positive integer`);
  }
  return value;
}

function normalizedRelativePath(value: unknown, label: string): string {
  const raw = string(value, label).replaceAll('\\', '/');
  if (path.posix.isAbsolute(raw)) fail(`${label} must be repository-relative`);
  const normalized = path.posix.normalize(raw);
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('\u0000')) {
    fail(`${label} escapes its repository`);
  }
  return normalized;
}

function parseJsonValue(bytes: Buffer, label: string): unknown {
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) fail(`${label} is not valid JSON`);
    throw error;
  }
}

function parseJson(bytes: Buffer, label: string): JsonObject {
  return object(parseJsonValue(bytes, label), label);
}

async function readJson(filePath: string, label: string): Promise<JsonObject> {
  return parseJson(await readFile(filePath), label);
}

function bindingIdentity(binding: LatestStableAggregateBinding): JsonObject {
  const { resolutionDigest: _digest, resolvedAt: _resolvedAt, ...identity } = binding;
  return identity;
}

function assertBindingIdentity(left: LatestStableAggregateBinding, right: LatestStableAggregateBinding): void {
  if (
    left.resolutionDigest !== right.resolutionDigest
    || canonicalJson(bindingIdentity(left)) !== canonicalJson(bindingIdentity(right))
  ) {
    fail('frozen binding identity drifted');
  }
}

export function parseBinding(row: JsonObject): LatestStableAggregateBinding {
  if (row.protocol !== 'act-latest-stable-aggregate-binding/1') {
    fail('unsupported frozen binding protocol');
  }
  if (row.selectionPolicy !== 'LATEST_STABLE_AGGREGATE') {
    fail('frozen binding selectionPolicy is not LATEST_STABLE_AGGREGATE');
  }
  hash(row.resolutionDigest, 'binding.resolutionDigest');
  string(row.bundlePath, 'binding.bundlePath');
  string(row.bundleId, 'binding.bundleId');
  string(row.releaseId, 'binding.releaseId');
  string(row.releaseVersion, 'binding.releaseVersion');
  if (!Array.isArray(row.candidateChain) || row.candidateChain.length === 0) {
    fail('binding.candidateChain must be non-empty');
  }
  if (row.admittedEndpoint !== undefined) {
    const endpoint = object(row.admittedEndpoint, 'binding.admittedEndpoint');
    string(endpoint.releaseSetId, 'binding.admittedEndpoint.releaseSetId');
    string(endpoint.releaseId, 'binding.admittedEndpoint.releaseId');
    string(endpoint.releaseVersion, 'binding.admittedEndpoint.releaseVersion');
    hash(endpoint.releaseHash, 'binding.admittedEndpoint.releaseHash');
    hash(endpoint.sourceDatasetHash, 'binding.admittedEndpoint.sourceDatasetHash');
    if (endpoint.bundleId !== undefined) string(endpoint.bundleId, 'binding.admittedEndpoint.bundleId');
  }
  const bridge = object(row.admissionBridgeReleaseDiff, 'binding.admissionBridgeReleaseDiff');
  string(bridge.path, 'binding.admissionBridgeReleaseDiff.path');
  hash(bridge.artifactHash, 'binding.admissionBridgeReleaseDiff.artifactHash');
  hash(bridge.releaseDiffDigest, 'binding.admissionBridgeReleaseDiff.releaseDiffDigest');
  string(bridge.targetBundleId, 'binding.admissionBridgeReleaseDiff.targetBundleId');
  hash(bridge.targetBundleDigest, 'binding.admissionBridgeReleaseDiff.targetBundleDigest');
  return row as unknown as LatestStableAggregateBinding;
}

function parseChainReceipt(row: JsonObject): ChainAdmissionReceipt {
  if (row.protocol !== 'act-latest-stable-aggregate-chain-intake/1') {
    fail('unsupported chain intake receipt protocol');
  }
  hash(row.resolutionDigest, 'chain receipt resolutionDigest');
  if (!Array.isArray(row.chain) || row.chain.length === 0) fail('chain receipt chain must be non-empty');
  const chain = row.chain.map((value, index) => {
    const entry = object(value, `chain[${index}]`);
    return {
      order: positiveInteger(entry.order, `chain[${index}].order`),
      lockPath: normalizedRelativePath(entry.lockPath, `chain[${index}].lockPath`),
      lockSha256: hash(entry.lockSha256, `chain[${index}].lockSha256`),
      releaseSetId: string(entry.releaseSetId, `chain[${index}].releaseSetId`),
      releaseId: string(entry.releaseId, `chain[${index}].releaseId`),
      releaseVersion: string(entry.releaseVersion, `chain[${index}].releaseVersion`),
      releaseHash: hash(entry.releaseHash, `chain[${index}].releaseHash`),
      bundleId: string(entry.bundleId, `chain[${index}].bundleId`),
      bundleDigest: hash(entry.bundleDigest, `chain[${index}].bundleDigest`),
    };
  });
  chain.forEach((entry, index) => {
    if (entry.order !== index + 1) fail(`chain order is not contiguous at ${index + 1}`);
  });
  return {
    protocol: row.protocol,
    outputRoot: normalizedRelativePath(row.outputRoot, 'chain receipt outputRoot'),
    bindingPath: normalizedRelativePath(row.bindingPath, 'chain receipt bindingPath'),
    predecessorClosurePath: normalizedRelativePath(
      row.predecessorClosurePath,
      'chain receipt predecessorClosurePath',
    ),
    predecessorClosureArtifactHash: hash(
      row.predecessorClosureArtifactHash,
      'chain receipt predecessorClosureArtifactHash',
    ),
    admissionBridgePath: normalizedRelativePath(
      row.admissionBridgePath,
      'chain receipt admissionBridgePath',
    ),
    admissionBridgeFileSha256: hash(
      row.admissionBridgeFileSha256,
      'chain receipt admissionBridgeFileSha256',
    ),
    admissionBridgeArtifactHash: hash(
      row.admissionBridgeArtifactHash,
      'chain receipt admissionBridgeArtifactHash',
    ),
    admissionBridgeReleaseDiffDigest: hash(
      row.admissionBridgeReleaseDiffDigest,
      'chain receipt admissionBridgeReleaseDiffDigest',
    ),
    resolutionDigest: row.resolutionDigest as string,
    chain,
  };
}

function parseLock(row: JsonObject, label: string): ChainAdmissionLock {
  const bundle = object(row.bundle, `${label}.bundle`);
  const release = object(row.release, `${label}.release`);
  const compatibility = object(row.compatibility, `${label}.compatibility`);
  const sourceRevision = object(row.source_revision, `${label}.source_revision`);
  return {
    lock_version: string(row.lock_version, `${label}.lock_version`),
    release_set_id: string(row.release_set_id, `${label}.release_set_id`),
    bundle: {
      controlled_path: normalizedRelativePath(bundle.controlled_path, `${label}.bundle.controlled_path`),
      bundle_id: string(bundle.bundle_id, `${label}.bundle.bundle_id`),
      bundle_revision: positiveInteger(bundle.bundle_revision, `${label}.bundle.bundle_revision`),
      bundle_digest: hash(bundle.bundle_digest, `${label}.bundle.bundle_digest`),
      manifest_raw_sha256: hash(bundle.manifest_raw_sha256, `${label}.bundle.manifest_raw_sha256`),
    },
    release: {
      release_id: string(release.release_id, `${label}.release.release_id`),
      release_version: string(release.release_version, `${label}.release.release_version`),
      release_hash: hash(release.release_hash, `${label}.release.release_hash`),
      source_dataset_hash: hash(release.source_dataset_hash, `${label}.release.source_dataset_hash`),
    },
    compatibility: {
      bundle_contract_version: string(compatibility.bundle_contract_version, `${label}.compatibility.bundle_contract_version`),
      schema_version: string(compatibility.schema_version, `${label}.compatibility.schema_version`),
      schema_sha256: hash(compatibility.schema_sha256, `${label}.compatibility.schema_sha256`),
    },
    source_revision: {
      commit: string(sourceRevision.commit, `${label}.source_revision.commit`),
      tag: string(sourceRevision.tag, `${label}.source_revision.tag`),
    },
    components: Array.isArray(row.components) ? row.components.map((value, index) => object(value, `${label}.components[${index}]`)) : [],
  };
}

function resolvePath(repoRoot: string, relative: string, label: string): string {
  const root = path.resolve(repoRoot);
  const resolved = path.resolve(root, relative);
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) fail(`${label} escapes repoRoot`);
  return resolved;
}

export function buildAdmissionPlan(input: {
  repoRoot: string;
  binding: LatestStableAggregateBinding;
  receipt: ChainAdmissionReceipt;
  locks: readonly ChainAdmissionLock[];
  manifests: readonly JsonObject[];
  admissionBridgeReleaseDiff?: JsonObject;
}): AdmissionPlan {
  const { binding, receipt, locks, manifests } = input;
  const bridgeBinding = binding.admissionBridgeReleaseDiff;
  if (!bridgeBinding) fail('frozen binding does not contain the admission bridge');
  if (
    receipt.admissionBridgeArtifactHash !== bridgeBinding.artifactHash
    || receipt.admissionBridgeReleaseDiffDigest !== bridgeBinding.releaseDiffDigest
  ) {
    fail('chain receipt admission bridge identity differs from frozen binding');
  }
  if (receipt.resolutionDigest !== binding.resolutionDigest) {
    fail('chain receipt and frozen binding resolutionDigest differ');
  }
  if (locks.length !== receipt.chain.length || manifests.length !== receipt.chain.length) {
    fail('chain lock/Manifest count differs from receipt chain');
  }
  const candidateChain = binding.candidateChain.map((value) => string(value, 'binding.candidateChain item'));
  const admittedEndpoint = binding.admittedEndpoint;
  const admittedBundleId = admittedEndpoint && typeof admittedEndpoint === 'object'
    && !Array.isArray(admittedEndpoint)
    && typeof (admittedEndpoint as JsonObject).bundleId === 'string'
    ? (admittedEndpoint as JsonObject).bundleId as string
    : undefined;
  const admittedIndex = admittedBundleId === undefined
    ? -1
    : candidateChain.indexOf(admittedBundleId);
  if (admittedBundleId !== undefined && admittedIndex < 0) {
    fail(`admitted endpoint bundleId is not in binding candidateChain: ${admittedBundleId}`);
  }
  const expectedChain = admittedBundleId === undefined
    ? candidateChain
    : candidateChain.slice(admittedIndex + 1);
  if (canonicalJson(expectedChain) !== canonicalJson(receipt.chain.map((entry) => entry.bundleId))) {
    fail('chain receipt candidate order differs from frozen binding');
  }
  if (expectedChain.length === 0) fail('chain receipt has no post-admission candidates');
  if (receipt.chain[0]!.bundleId !== FIRST_STAGED_BUNDLE_ID || receipt.chain[0]!.releaseId !== FIRST_STAGED_RELEASE_ID) {
    fail('first Delta candidate must be the staged v0.3:r2 Bundle');
  }
  if (
    bridgeBinding.targetBundleId !== receipt.chain[0]!.bundleId
    || bridgeBinding.targetBundleDigest !== receipt.chain[0]!.bundleDigest
  ) {
    fail('admission bridge target differs from the first staged candidate');
  }

  const hops: AdmissionHopPlan[] = [];
  for (let index = 0; index < receipt.chain.length; index += 1) {
    const candidate = receipt.chain[index]!;
    const lock = locks[index]!;
    const manifest = manifests[index]!;
    if (
      lock.release_set_id !== candidate.releaseSetId
      || lock.bundle.bundle_id !== candidate.bundleId
      || lock.bundle.bundle_digest !== candidate.bundleDigest
      || lock.release.release_id !== candidate.releaseId
      || lock.release.release_version !== candidate.releaseVersion
      || lock.release.release_hash !== candidate.releaseHash
    ) {
      fail(`chain lock identity drift at order ${candidate.order}`);
    }
    if (
      manifest.bundle_id !== candidate.bundleId
      || manifest.bundle_digest !== candidate.bundleDigest
      || object(manifest.release, `chain[${index}].Manifest.release`).release_id !== candidate.releaseId
    ) {
      fail(`Manifest identity drift at order ${candidate.order}`);
    }
    const previous = index === 0 ? null : hops[index - 1];
    const previousBundle = manifest.previous_bundle === null || manifest.previous_bundle === undefined
      ? null
      : object(manifest.previous_bundle, `chain[${index}].Manifest.previous_bundle`);
    if (index > 0) {
      if (
        !previous
        || !previousBundle
        || previousBundle.bundle_id !== previous.candidate.bundleId
      ) {
        fail(`successor predecessor identity drift at order ${candidate.order}`);
      }
      const previousSums = previousBundle.sha256sums_sha256;
      if (typeof previousSums !== 'string' || !/^[a-f0-9]{64}$/u.test(previousSums)) {
        fail(`successor predecessor SHA256SUMS identity missing at order ${candidate.order}`);
      }
    } else if (!previousBundle || previousBundle.kind !== 'legacy_exact') {
      fail('first staged Bundle must retain its legacy predecessor closure reference');
    }
    hops.push({
      order: candidate.order,
      candidate,
      lock,
      manifest,
      base: index === 0
        ? {
            kind: 'exact_import',
            releaseId: CURRENT_AGGREGATE_RELEASE_ID,
            bundleId: null,
            bundleDigest: null,
          }
        : {
            kind: 'standard_bundle',
            releaseId: hops[index - 1]!.candidate.releaseId,
            bundleId: hops[index - 1]!.candidate.bundleId,
            bundleDigest: hops[index - 1]!.candidate.bundleDigest,
          },
    });
  }
  return {
    binding,
    receipt,
    hops,
    admissionBridgeReleaseDiff: input.admissionBridgeReleaseDiff ?? {},
  };
}

async function loadAdmissionPlan(repoRoot: string, bindingPath: string, chainReceiptPath: string): Promise<AdmissionPlan> {
  const binding = parseBinding(await readJson(bindingPath, 'frozen binding'));
  const receipt = parseChainReceipt(await readJson(chainReceiptPath, 'chain intake receipt'));
  const relativeBindingPath = normalizedRelativePath(
    path.relative(path.resolve(repoRoot), path.resolve(bindingPath)),
    'binding path',
  );
  if (receipt.bindingPath !== relativeBindingPath) {
    fail('chain receipt bindingPath does not identify the frozen binding file');
  }
  const relativeOutputRoot = normalizedRelativePath(
    path.relative(path.resolve(repoRoot), path.dirname(path.resolve(chainReceiptPath))),
    'chain receipt outputRoot',
  );
  if (receipt.outputRoot !== relativeOutputRoot) {
    fail('chain receipt outputRoot does not contain the chain receipt');
  }
  const bridgePath = resolvePath(repoRoot, receipt.admissionBridgePath, 'admission bridge path');
  const bridgeBytes = await readFile(bridgePath);
  if (sha256(bridgeBytes) !== receipt.admissionBridgeFileSha256) {
    fail('staged admission bridge file bytes drift');
  }
  const bridgeEnvelope = parseJson(bridgeBytes, 'staged admission bridge');
  const claimedArtifactHash = hash(
    bridgeEnvelope.artifact_hash,
    'staged admission bridge artifact_hash',
  );
  const bridgeBody = { ...bridgeEnvelope };
  delete bridgeBody.artifact_hash;
  if (
    sha256(canonicalJson(bridgeBody)) !== claimedArtifactHash
    || claimedArtifactHash !== receipt.admissionBridgeArtifactHash
  ) {
    fail('staged admission bridge artifact_hash mismatch');
  }
  const bridgeReleaseDiff = object(
    bridgeEnvelope.release_diff,
    'staged admission bridge release_diff',
  );
  if (
    sha256(canonicalJson(bridgeReleaseDiff)) !== receipt.admissionBridgeReleaseDiffDigest
    || bridgeEnvelope.release_diff_digest !== receipt.admissionBridgeReleaseDiffDigest
  ) {
    fail('staged admission bridge release_diff_digest mismatch');
  }
  const expectedReceiptPath = path.resolve(repoRoot, receipt.outputRoot, 'chain-intake-receipt.json');
  if (expectedReceiptPath !== path.resolve(chainReceiptPath)) {
    fail('chain receipt path is not the immutable chain-intake-receipt.json');
  }
  const locks: ChainAdmissionLock[] = [];
  const manifests: JsonObject[] = [];
  for (const [index, entry] of receipt.chain.entries()) {
    const lockPath = resolvePath(repoRoot, entry.lockPath, `chain[${index}].lockPath`);
    const lockBytes = await readFile(lockPath);
    if (sha256(lockBytes) !== entry.lockSha256) fail(`chain lock bytes drift at order ${entry.order}`);
    const lock = parseLock(parseJson(lockBytes, `chain lock ${entry.lockPath}`), `chain lock ${entry.lockPath}`);
    const manifestPath = resolvePath(repoRoot, lock.bundle.controlled_path + '/bundle-manifest.json', 'candidate Manifest path');
    const manifestBytes = await readFile(manifestPath);
    if (sha256(manifestBytes) !== lock.bundle.manifest_raw_sha256) fail(`candidate Manifest bytes drift at order ${entry.order}`);
    locks.push(lock);
    manifests.push(parseJson(manifestBytes, `candidate Manifest ${entry.bundleId}`));
  }
  return buildAdmissionPlan({
    repoRoot,
    binding,
    receipt,
    locks,
    manifests,
    admissionBridgeReleaseDiff: bridgeReleaseDiff,
  });
}

const SELECTOR_FENCE_PATHS = [
  'src/lib/canonical-learning-fact-identity/authority.ts',
  'src/lib/canonical-learning-fact-identity/writer.ts',
  'src/lib/canonical-rag/authority.ts',
] as const;

function gitBlob(root: string, revision: string, relativePath: string): string {
  const result = spawnSync('git', ['-C', root, 'show', `${revision}:${relativePath}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') {
    fail(`selector/writer fence cannot read ${relativePath} at ${revision}`);
  }
  return sha256(result.stdout);
}

export function readSelectorGateSnapshot(repoRoot: string, captureRevision: string): SelectorGateSnapshot {
  const learning = selectLearningFactAuthority('FORMAL_PRODUCTION');
  const rag = selectRagAuthority('PRODUCTION_ANSWER');
  assertFormalLearningFactSelectorUnchanged({
    requestedConsumer: 'FORMAL_PRODUCTION',
    selected: learning,
    shadowSucceeded: false,
    admissionReady: true,
  });
  assertProductionSelectorUnchanged({
    requestedConsumer: 'PRODUCTION_ANSWER',
    selected: rag,
    shadowSucceeded: false,
  });
  const fence = SELECTOR_FENCE_PATHS.map((relativePath) => ({
    relativePath,
    sha256: gitBlob(repoRoot, captureRevision, relativePath),
  }));
  return {
    productionAuthority: learning.authority,
    productionCanonicalWriterEnabled: learning.canonicalWriterEnabled,
    graphRagAuthority: rag.authority,
    graphRagCanonicalExpansionVisible: rag.canonicalExpansionVisible,
    canonicalWriterFenceDigest: sha256(canonicalJson(fence)),
  };
}

export function compareSelectorGateSnapshots(
  before: SelectorGateSnapshot,
  after: SelectorGateSnapshot,
): AdmissionGateSummary {
  if (canonicalJson(before) !== canonicalJson(after)) {
    fail('production selector, Graph-RAG selector, or Canonical writer fence changed during admission');
  }
  return {
    PRODUCTION_SELECTOR_CHANGE: 0,
    GRAPH_RAG_SELECTOR_CHANGE: 0,
    CANONICAL_LEARNING_FACT_WRITER_FENCE_CHANGE: 0,
    before,
    after,
  };
}

function deltaReceipt(
  order: number,
  computed: ComputedReleaseSetDelta,
  persisted: PersistedDeltaReceiptResult,
  upstreamSource: 'admission_bridge' | 'bundle_artifact',
  upstreamDiffDigest: string,
): AdmissionDeltaReceipt {
  return {
    order,
    upstreamSource,
    upstreamDiffDigest,
    base: computed.baseEvidence,
    candidate: computed.candidateEvidence,
    persisted,
    computed: {
      classification: computed.classification,
      authorizationState: computed.authorizationState,
      inputDigest: computed.inputDigest,
      outputDigest: computed.outputDigest,
      naturalKey: computed.naturalKey,
      upstream: computed.upstream,
      summary: computed.summary,
      identityViolations: computed.identityViolations,
      captureRevision: computed.captureRevision,
    },
  };
}

async function requireAbsent(target: string, label: string): Promise<void> {
  try {
    await stat(target);
    fail(`${label} already exists; rerun is refused`);
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
}

export async function writeVerifiedJson(target: string, value: unknown): Promise<void> {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(target, bytes);
  const roundTrip = await readFile(target, 'utf8');
  if (roundTrip !== bytes) fail(`post-write verification failed for ${target}`);
  parseJsonValue(Buffer.from(roundTrip), target);
}

function assertEvidenceCaptureRevision(
  evidence: { evidence: DeltaEvidenceRef },
  captureRevision: string,
  label: string,
): void {
  if (evidence.evidence.evidenceCaptureRevision !== captureRevision) {
    fail(`${label} captureRevision does not match the frozen ACT capture`);
  }
}

async function loadUpstreamCrosscheck(
  db: PrismaClient,
  candidate: Awaited<ReturnType<typeof loadStandardAcceptedEvidence>>,
  loadRaw: typeof loadUpstreamReleaseDiffRaw,
): Promise<{
  upstreamDiff: Awaited<ReturnType<typeof parseUpstreamReleaseDiff>> | null;
  upstreamParseError: string | null;
  upstreamRequired: boolean;
}> {
  const raw = await loadRaw(db, candidate);
  if (raw.parseError) return { upstreamDiff: null, upstreamParseError: raw.parseError, upstreamRequired: raw.required };
  if (raw.raw === null) return { upstreamDiff: null, upstreamParseError: null, upstreamRequired: raw.required };
  try {
    return {
      upstreamDiff: parseUpstreamReleaseDiff(raw.raw),
      upstreamParseError: null,
      upstreamRequired: raw.required,
    };
  } catch (error) {
    return {
      upstreamDiff: null,
      upstreamParseError: error instanceof Error ? error.message : String(error),
      upstreamRequired: raw.required,
    };
  }
}

export interface AdmissionResult {
  protocol: typeof ADMISSION_PROTOCOL;
  status: 'PASS';
  captureRevision: string;
  bindingResolutionDigest: string;
  exactBase: { releaseSetId: string; releaseId: string };
  candidates: string[];
  deltaReceipts: AdmissionDeltaReceipt[];
  gates: AdmissionGateSummary;
}

export async function admitLatestActkgAggregate(options: AdmissionOptions): Promise<AdmissionResult> {
  const repoRoot = path.resolve(options.repoRoot);
  const outputRoot = path.resolve(options.outputRoot);
  await requireAbsent(outputRoot, 'admission outputRoot');
  const plan = await loadAdmissionPlan(
    repoRoot,
    path.resolve(options.bindingPath),
    path.resolve(options.chainReceiptPath),
  );
  const selectorSnapshot = options.selectorSnapshot ?? readSelectorGateSnapshot;
  const before = selectorSnapshot(options.captureRoot ?? repoRoot, options.captureRevision);

  const loadAggregate = options.loadAggregate ?? loadAndValidateAggregateRelease;
  const loadBundle = options.loadBundle ?? loadAndValidatePublicBundleV1;
  const importAggregate = options.importAggregate ?? importValidatedAggregateRelease;
  const importBundle = options.importBundle ?? importValidatedActKGBundle;
  const loadExact = options.loadExact ?? loadExactAcceptedEvidence;
  const loadStandard = options.loadStandard ?? loadStandardAcceptedEvidence;
  const loadRawUpstream = options.loadUpstream ?? loadUpstreamReleaseDiffRaw;
  const computeDelta = options.computeDelta ?? computeReleaseSetDelta;
  const persistDelta = options.persistDelta ?? persistReleaseSetDelta;
  const verifyDelta = options.verifyDelta ?? verifyReleaseSetDelta;
  const exact = await loadAggregate({ root: repoRoot, captureRevision: options.captureRevision });
  if (
    exact.lock.release_set_id !== CURRENT_AGGREGATE_RELEASE_SET_ID
    || exact.entry.release_id !== CURRENT_AGGREGATE_RELEASE_ID
  ) {
    fail('exact ACT aggregate baseline identity is not the admitted v0.2 contract');
  }
  await importAggregate(options.db, exact);
  let base = await loadExact(options.db, CURRENT_AGGREGATE_RELEASE_ID);
  assertEvidenceCaptureRevision(base, options.captureRevision, 'exact baseline');

  const receipts: AdmissionDeltaReceipt[] = [];
  for (const hop of plan.hops) {
    const validated = await loadBundle({
      root: repoRoot,
      lockPath: hop.candidate.lockPath,
      captureRevision: options.captureRevision,
      gitRoot: options.captureRoot ?? repoRoot,
    });
    if (
      validated.captureRevision !== options.captureRevision
      || validated.bundleIdentity.bundleId !== hop.candidate.bundleId
      || validated.bundleIdentity.bundleDigest !== hop.candidate.bundleDigest
      || validated.releaseIdentity.releaseId !== hop.candidate.releaseId
      || validated.releaseSetIdentity.releaseSetId !== hop.candidate.releaseSetId
    ) {
      fail(`validated candidate identity drift at order ${hop.order}`);
    }
    await importBundle(options.db, validated);
    const candidateReceipt = await options.db.actkgBundleReceipt.findUnique({
      where: { bundleDigest: hop.candidate.bundleDigest },
    });
    if (!candidateReceipt || candidateReceipt.candidateState !== ACCEPTED_CANDIDATE_STATE) {
      fail(`candidate Bundle receipt is not ACCEPTED_CANDIDATE at order ${hop.order}`);
    }
    const candidate = await loadStandard(options.db, candidateReceipt.id);
    assertEvidenceCaptureRevision(candidate, options.captureRevision, `candidate order ${hop.order}`);
    if (base.evidence.releaseId !== hop.base.releaseId || (hop.base.bundleId !== null && base.evidence.bundleId !== hop.base.bundleId)) {
      fail(`explicit predecessor identity drift at order ${hop.order}`);
    }
    const upstream = hop.order === 1
      ? await (async () => {
          const rawBundle = await loadRawUpstream(options.db, candidate);
          if (rawBundle.raw !== null || rawBundle.required || rawBundle.parseError !== null) {
            fail('first admission hop has conflicting in-bundle Release Diff evidence');
          }
          try {
            return {
              upstreamDiff: parseUpstreamReleaseDiff(plan.admissionBridgeReleaseDiff),
              upstreamParseError: null,
              upstreamRequired: true,
            };
          } catch (error) {
            return {
              upstreamDiff: null,
              upstreamParseError: error instanceof Error ? error.message : String(error),
              upstreamRequired: true,
            };
          }
        })()
      : await loadUpstreamCrosscheck(options.db, candidate, loadRawUpstream);
    if (!upstream.upstreamRequired) {
      fail(`upstream Release Diff is required for admission hop ${hop.order}`);
    }
    const computed = computeDelta({
      candidateSnapshot: candidate.snapshot,
      candidateEvidence: candidate.evidence,
      baseSnapshot: base.snapshot,
      baseEvidence: base.evidence,
      captureRevision: options.captureRevision,
      upstreamDiff: upstream.upstreamDiff,
      upstreamParseError: upstream.upstreamParseError,
      upstreamRequired: upstream.upstreamRequired,
    });
    if (computed.upstream.status !== 'AGREED') {
      fail(`upstream Release Diff crosscheck did not agree at admission hop ${hop.order}: ${computed.upstream.status}`);
    }
    const persisted = await persistDelta(options.db, computed);
    const verified = await verifyDelta(options.db, computed);
    if (verified.inputDigest !== persisted.inputDigest || verified.outputDigest !== persisted.outputDigest) {
      fail(`persisted Delta receipt failed round-trip verification at order ${hop.order}`);
    }
    if (computed.authorizationState !== 'ACCEPTED') {
      fail(`Delta authorization rejected at order ${hop.order}: ${computed.authorizationState}`);
    }
    receipts.push(deltaReceipt(
      hop.order,
      computed,
      persisted,
      hop.order === 1 ? 'admission_bridge' : 'bundle_artifact',
      hop.order === 1
        ? plan.receipt.admissionBridgeReleaseDiffDigest
        : sha256(canonicalJson(upstream.upstreamDiff)),
    ));
    base = candidate;
  }

  const after = selectorSnapshot(options.captureRoot ?? repoRoot, options.captureRevision);
  const gates = compareSelectorGateSnapshots(before, after);
  await mkdir(path.dirname(outputRoot), { recursive: true });
  const stagingRoot = await mkdtemp(path.join(path.dirname(outputRoot), `.${path.basename(outputRoot)}.tmp-`));
  const result: AdmissionResult = {
    protocol: ADMISSION_PROTOCOL,
    status: 'PASS',
    captureRevision: options.captureRevision,
    bindingResolutionDigest: plan.binding.resolutionDigest,
    exactBase: { releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID, releaseId: CURRENT_AGGREGATE_RELEASE_ID },
    candidates: plan.hops.map((hop) => hop.candidate.bundleId),
    deltaReceipts: receipts,
    gates,
  };
  try {
    await writeVerifiedJson(path.join(stagingRoot, 'admission-receipt.json'), result);
    await writeVerifiedJson(path.join(stagingRoot, 'delta-receipts.json'), receipts);
    await writeVerifiedJson(path.join(stagingRoot, 'gate-summary.json'), gates);
    await rename(stagingRoot, outputRoot);
    return result;
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

class AdmissionDatabaseDeferred extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdmissionDatabaseDeferred';
  }
}

function schemaUrl(baseUrl: string, schema: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('schema', schema);
  url.searchParams.set('options', `-csearch_path=${schema},public`);
  return url.toString();
}

export interface IsolatedAdmissionDatabase {
  db: PrismaClient;
  cleanup: () => Promise<void>;
  mode: 'database' | 'schema';
  name: string;
}

export interface IsolatedAdmissionDatabaseOptions {
  /**
   * Use a disposable schema in the configured database and never attempt
   * CREATE DATABASE. This is required by cutover preparation runs that must
   * not create or mutate another database on the local PostgreSQL service.
   */
  schemaOnly?: boolean;
  /** Test seams; production callers leave these unset. */
  adminClientFactory?: (connectionString: string) => Client;
  migrationRunner?: typeof spawnSync;
  prismaClientFactory?: typeof createPrismaClient;
}

/**
 * Provision an isolated PostgreSQL database (or an explicitly requested
 * schema) and run the checked-in Prisma migrations against it.
 */
export async function createIsolatedAdmissionDatabase(
  repoRoot: string,
  options: IsolatedAdmissionDatabaseOptions = {},
): Promise<IsolatedAdmissionDatabase> {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new AdmissionDatabaseDeferred('DATABASE_URL is not configured');
  const name = `actkg_admission_${process.pid}_${Date.now()}`.replace(/[^a-zA-Z0-9_]/gu, '_').toLowerCase();
  const admin = (options.adminClientFactory ?? ((connectionString: string) => new Client({ connectionString })))(baseUrl);
  const migrationRunner = options.migrationRunner ?? spawnSync;
  const prismaClientFactory = options.prismaClientFactory ?? createPrismaClient;
  await admin.connect();
  let mode: 'database' | 'schema' = options.schemaOnly ? 'schema' : 'database';
  let isolatedUrl = baseUrl;
  let created = false;
  try {
    if (options.schemaOnly) {
      await admin.query(`CREATE SCHEMA "${name}"`);
      isolatedUrl = schemaUrl(baseUrl, name);
      created = true;
    } else {
      try {
        await admin.query(`CREATE DATABASE "${name}"`);
        const databaseUrl = new URL(baseUrl);
        databaseUrl.pathname = `/${name}`;
        databaseUrl.searchParams.delete('schema');
        databaseUrl.searchParams.delete('options');
        isolatedUrl = databaseUrl.toString();
        created = true;
      } catch (error) {
        if ((error as { code?: string }).code !== '42501') throw error;
        mode = 'schema';
        await admin.query(`CREATE SCHEMA "${name}"`);
        isolatedUrl = schemaUrl(baseUrl, name);
        created = true;
      }
    }
    const migration = migrationRunner(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: isolatedUrl },
      stdio: 'pipe',
    });
    if (migration.status !== 0) fail(`isolated Prisma migration failed: ${migration.stderr || migration.stdout}`);
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = isolatedUrl;
    const db = prismaClientFactory();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    return {
      db,
      mode,
      name,
      cleanup: async () => {
        await db.$disconnect();
        if (mode === 'database') {
          await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
        } else {
          await admin.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
        }
        await admin.end();
      },
    };
  } catch (error) {
    if (created) {
      await (mode === 'database'
        ? admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
        : admin.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`)).catch(() => undefined);
    }
    await admin.end().catch(() => undefined);
    throw error;
  }
}

function cliOption(argv: string[], name: string): string {
  const index = argv.indexOf(name);
  if (index < 0 || !argv[index + 1] || argv[index + 1]!.startsWith('--')) fail(`missing ${name}`);
  return argv[index + 1]!;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const repoRoot = cliOption(argv, '--repo-root');
  const bindingPath = cliOption(argv, '--binding');
  const chainReceiptPath = cliOption(argv, '--chain-receipt');
  const outputRoot = cliOption(argv, '--output-root');
  const captureRevision = cliOption(argv, '--capture-revision');
  const captureRoot = argv.includes('--capture-root') ? cliOption(argv, '--capture-root') : undefined;
  let isolated: IsolatedAdmissionDatabase | undefined;
  try {
    isolated = await createIsolatedAdmissionDatabase(repoRoot);
    const result = await admitLatestActkgAggregate({
      repoRoot,
      bindingPath,
      chainReceiptPath,
      outputRoot,
      captureRevision,
      captureRoot,
      db: isolated.db,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    if (error instanceof AdmissionDatabaseDeferred) {
      const required = process.env.ACTKG_POSTGRES_REQUIRED === '1';
      process.stderr.write(`${JSON.stringify({ status: 'DEFERRED', reason: error.message })}\n`);
      if (required) process.exitCode = 1;
      return;
    }
    throw error;
  } finally {
    await isolated?.cleanup();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
