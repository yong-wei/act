#!/usr/bin/env tsx
/** Reopen r4-c5 inputs and emit the exact artifact map for CLI qualification. */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { projectionDigest } from '@/lib/teaching-projection/hash';
import { assertCandidateReceiptSelfHash } from '@/lib/latest-authority-oss-cutover/envelope';
import type { CoordinatedCandidateReceipt } from '@/lib/latest-authority-oss-cutover/contracts';

const ROOT = process.cwd();
const LEGACY_BASELINE_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';
const DEFAULT_SELECTOR_ROOT = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c6-presentation-evidence';

type RuntimeLifecycleIdentity = {
  readonly schemaVersion: 'runtime-blob-release-identity.v1';
  readonly releaseId: string;
  readonly manifestVersion: 'act-runtime-release.v2';
  readonly manifestSha256: string;
  readonly manifestWireSha256: string;
  readonly manifestWireSizeBytes: number;
  readonly treeSha256: string;
};

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`build-r4-c5-qualification-artifacts: missing ${name}`);
  return value;
}

function optionOr(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value !== undefined && (!value || value.startsWith('--'))) {
    throw new Error(`build-r4-c5-qualification-artifacts: missing ${name}`);
  }
  return value ?? fallback;
}

function absolute(value: string): string {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function readJson<T>(value: string): T {
  return JSON.parse(readFileSync(absolute(value), 'utf8')) as T;
}

function sha256File(value: string): string {
  return createHash('sha256').update(readFileSync(absolute(value))).digest('hex');
}

function writeImmutable(value: string, body: unknown): void {
  const target = absolute(value);
  const wire = Buffer.from(`${JSON.stringify(body, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target) && !readFileSync(target).equals(wire)) {
    throw new Error(`build-r4-c5-qualification-artifacts: refusing to overwrite ${value}`);
  }
  if (!existsSync(target)) writeFileSync(target, wire);
}

function requireHash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`build-r4-c5-qualification-artifacts: ${label} must be a SHA-256 digest`);
  }
  return value;
}

function assertRuntimeLifecycleIdentity(value: RuntimeLifecycleIdentity): void {
  if (value.schemaVersion !== 'runtime-blob-release-identity.v1'
    || value.manifestVersion !== 'act-runtime-release.v2'
    || !/^runtime-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(value.releaseId)
    || !Number.isInteger(value.manifestWireSizeBytes)
    || value.manifestWireSizeBytes < 1) {
    throw new Error('staged Runtime release identity is invalid');
  }
  for (const field of ['manifestSha256', 'manifestWireSha256', 'treeSha256'] as const) {
    requireHash(value[field], `staged Runtime ${field}`);
  }
}

function main(): void {
  const candidateDir = option('--candidate-dir');
  const baselineRoot = optionOr('--baseline-root', LEGACY_BASELINE_ROOT);
  const selectorRoot = optionOr('--selector-root', DEFAULT_SELECTOR_ROOT);
  const governanceRoot = optionOr('--governance-root', selectorRoot);
  const candidate = readJson<CoordinatedCandidateReceipt>(path.join(candidateDir, 'candidate-receipt.json'));
  assertCandidateReceiptSelfHash(candidate);
  const allocation = readJson<{ allocationHash: string }>(path.join(candidateDir, 'allocation.json'));
  if (allocation.allocationHash !== candidate.allocationHash) throw new Error('qualification allocation differs from candidate');
  const stage = readJson<{
    contract: string;
    runtimeRelease: RuntimeLifecycleIdentity;
    materializationReceiptSha256: string;
  }>(path.join(candidateDir, 'runtime-stage.json'));
  if (stage.contract !== 'coordinated-runtime-stage/v1') throw new Error('runtime stage contract is invalid');
  assertRuntimeLifecycleIdentity(stage.runtimeRelease);
  const extension = readJson<Record<string, unknown>>(path.join(candidateDir, 'successor-runtime-manifest-extension.json'));
  const extensionHash = projectionDigest({
    successorManifest: stage.runtimeRelease,
    materializationReceiptHash: stage.materializationReceiptSha256,
    extension,
  });
  const capture = readJson<{ captureHash: string }>(`${baselineRoot}/authority-capture/authority-capture.json`);
  const selectors = readJson<{
    selectors: {
      projection: { projectionHash: string };
      projectionScopeBinding: { projectionHash: string; scopeHash: string; bindingHash: string };
      prerequisite: { publicationHash: string };
      catalog: { catalogHash: string };
      shards: { shardSetHash: string };
      consumerActivation: { activationHash: string };
    };
  }>(`${selectorRoot}/runtime-selector-set.json`);
  const scope = readJson<{ courseId: string; scopeHash: string }>(`${governanceRoot}/domain-catalog/scope.json`);
  const presentationLabelsPath = path.join(candidateDir, 'presentation-label-qualification.json');
  const presentationLabels = readJson<{
    contract: string;
    status: string;
    reviewRequired: number;
    qualificationHash: string;
    authority: { snapshotId: string; snapshotHash: string; releaseId: string; releaseSetId: string };
    catalog: { catalogId: string; catalogHash: string };
    shards: { shardSetId: string; shardSetHash: string };
  }>(presentationLabelsPath);
  const verificationPolicy = readJson<{
    contract: string;
    semanticCacheHash: string;
    presentationLabelQualificationHash: string;
    presentationLabelQualificationSha256: string;
    projectionScopeHash: string;
    projectionScopeAdjustmentSha256: string;
    projectionScopeBindingHash: string;
    projectionScopeBindingSha256: string;
    teachingGovernanceReclosureHash: string;
    teachingGovernanceReclosureSha256: string;
    requireFinalReceiptBeforeConsumerRestart: boolean;
    sourceRevisionMustBeIntegrationAncestor: boolean;
    verificationPolicyHash: string;
  }>(path.join(candidateDir, 'verification-policy.json'));
  const successorAuthority = readJson<{
    snapshotId: string;
    snapshotHash: string;
    releaseId: string;
    releaseSetId: string;
  }>(path.join(candidateDir, 'authority-current.json'));
  if (presentationLabels.status !== 'PASS' || presentationLabels.reviewRequired !== 0) {
    throw new Error('presentation-label qualification did not pass without review');
  }
  if (
    presentationLabels.contract !== 'r4-presentation-label-qualification/v1'
    || presentationLabels.authority.snapshotId !== successorAuthority.snapshotId
    || presentationLabels.authority.snapshotHash !== successorAuthority.snapshotHash
    || presentationLabels.authority.releaseId !== successorAuthority.releaseId
    || presentationLabels.authority.releaseSetId !== successorAuthority.releaseSetId
    || presentationLabels.catalog.catalogHash !== selectors.selectors.catalog.catalogHash
    || presentationLabels.shards.shardSetHash !== selectors.selectors.shards.shardSetHash
  ) {
    throw new Error('presentation-label qualification does not close over the selected successor');
  }
  const { verificationPolicyHash: ignoredPolicyHash, ...verificationPolicyInput } = verificationPolicy;
  void ignoredPolicyHash;
  if (
    verificationPolicy.contract !== 'r4-c5-coordinated-production-verification/v1'
    || verificationPolicy.presentationLabelQualificationHash !== presentationLabels.qualificationHash
    || verificationPolicy.presentationLabelQualificationSha256 !== sha256File(presentationLabelsPath)
    || verificationPolicy.verificationPolicyHash !== projectionDigest(verificationPolicyInput)
    || verificationPolicy.verificationPolicyHash !== candidate.verificationPolicyHash
  ) {
    throw new Error('presentation-label verification policy is not bound to the candidate');
  }
  for (const value of [
    verificationPolicy.semanticCacheHash,
    verificationPolicy.presentationLabelQualificationHash,
    verificationPolicy.presentationLabelQualificationSha256,
    verificationPolicy.projectionScopeHash,
    verificationPolicy.projectionScopeAdjustmentSha256,
    verificationPolicy.projectionScopeBindingHash,
    verificationPolicy.projectionScopeBindingSha256,
    verificationPolicy.teachingGovernanceReclosureHash,
    verificationPolicy.teachingGovernanceReclosureSha256,
    verificationPolicy.verificationPolicyHash,
  ]) requireHash(value, 'presentation-label verification identity');
  requireHash(presentationLabels.qualificationHash, 'presentation-label qualification');
  const locale = sha256File('course-content/authoring/knowledge/releases/control-theory-engineering-v0.37-r4/locale-manifest.json');
  const continuity = readJson<{ receiptHash: string }>(path.join(candidateDir, 'continuity-receipt.json'));
  const teaching = readJson<{ receiptHash: string }>(path.join(candidateDir, 'teaching-closure-receipt.json'));
  const envelope = readJson<{ allocationHash: string; envelopeHash: string }>(path.join(candidateDir, 'formal-resource-envelope.json'));
  const derivation = readJson<{ allocationHash: string; receiptHash: string }>(path.join(candidateDir, 'derivation-receipt.json'));
  const governance = readJson<{
    contract: string;
    authorityCaptureHash: string;
    scopeHash: string;
    semanticCacheHash: string;
    dispositionHash: string;
    dispositions: unknown[];
  }>(`${governanceRoot}/teaching-dispositions.json`);
  const teachingReclosurePath = path.join(candidateDir, 'teaching-reclosure-receipt.json');
  const teachingReclosure = readJson<{
    contract: string;
    status: string;
    successorScopeHash: string;
    successorSnapshotHash: string;
    dispositionHash: string;
    receiptHash: string;
  }>(teachingReclosurePath);
  const projectionAdjustmentPath = path.join(candidateDir, 'projection-adjustments.json');
  const projectionAdjustment = readJson<{
    contract: string;
    scopeHash: string;
    authoritySnapshotHash: string;
  }>(projectionAdjustmentPath);
  const projectionScopeBindingPath = path.join(candidateDir, 'projection-scope-binding.json');
  const projectionScopeBinding = readJson<{
    contract: string;
    courseId: string;
    scopeHash: string;
    projectionId: string;
    projectionHash: string;
    projectionManifestSha256: string;
    authority: { snapshotId: string; snapshotHash: string; releaseId: string; releaseSetId: string };
    bindingHash: string;
  }>(projectionScopeBindingPath);
  const { bindingHash: ignoredProjectionScopeBindingHash, ...projectionScopeBindingInput } = projectionScopeBinding;
  void ignoredProjectionScopeBindingHash;
  const projectionManifestPath = path.join(
    'course-content/runtime/knowledge/projection/releases',
    projectionScopeBinding.projectionId,
    'projection-manifest.json',
  );
  if (
    governance.contract !== 'coordinated-teaching-disposition-scope-reclosure/v1'
    || governance.scopeHash !== scope.scopeHash
    || governance.authorityCaptureHash !== capture.captureHash
    || governance.dispositionHash !== projectionDigest(governance.dispositions)
    || teachingReclosure.contract !== 'r4-c6-teaching-governance-reclosure/v1'
    || teachingReclosure.status !== 'COMPLETE'
    || teachingReclosure.successorScopeHash !== scope.scopeHash
    || teachingReclosure.successorSnapshotHash !== successorAuthority.snapshotHash
    || teachingReclosure.dispositionHash !== governance.dispositionHash
    || verificationPolicy.teachingGovernanceReclosureHash !== teachingReclosure.receiptHash
    || verificationPolicy.teachingGovernanceReclosureSha256 !== sha256File(teachingReclosurePath)
    || projectionAdjustment.contract !== 'act-coordinated-projection-adjustments/v1'
    || projectionAdjustment.scopeHash !== scope.scopeHash
    || projectionAdjustment.authoritySnapshotHash !== successorAuthority.snapshotHash
    || verificationPolicy.projectionScopeHash !== projectionAdjustment.scopeHash
    || verificationPolicy.projectionScopeAdjustmentSha256 !== sha256File(projectionAdjustmentPath)
    || projectionScopeBinding.contract !== 'r4-coordinated-teaching-projection-scope-binding/v1'
    || projectionScopeBinding.courseId !== scope.courseId
    || projectionScopeBinding.scopeHash !== scope.scopeHash
    || projectionScopeBinding.projectionHash !== selectors.selectors.projection.projectionHash
    || projectionScopeBinding.projectionId !== `proj-${projectionScopeBinding.projectionHash}`
    || projectionScopeBinding.projectionManifestSha256 !== sha256File(projectionManifestPath)
    || projectionScopeBinding.authority.snapshotId !== successorAuthority.snapshotId
    || projectionScopeBinding.authority.snapshotHash !== successorAuthority.snapshotHash
    || projectionScopeBinding.authority.releaseId !== successorAuthority.releaseId
    || projectionScopeBinding.authority.releaseSetId !== successorAuthority.releaseSetId
    || projectionScopeBinding.bindingHash !== projectionDigest(projectionScopeBindingInput)
    || verificationPolicy.projectionScopeBindingHash !== projectionScopeBinding.bindingHash
    || verificationPolicy.projectionScopeBindingSha256 !== sha256File(projectionScopeBindingPath)
    || selectors.selectors.projectionScopeBinding.projectionHash !== projectionScopeBinding.projectionHash
    || selectors.selectors.projectionScopeBinding.scopeHash !== projectionScopeBinding.scopeHash
    || selectors.selectors.projectionScopeBinding.bindingHash !== projectionScopeBinding.bindingHash
  ) {
    throw new Error('reopened teaching governance does not close over the C6 successor');
  }
  const rows = [
    { artifactId: 'authority-capture', artifactHash: requireHash(capture.captureHash, 'Authority capture') },
    { artifactId: 'locale-qualification', artifactHash: locale },
    { artifactId: 'teaching-projection', artifactHash: requireHash(selectors.selectors.projection.projectionHash, 'Teaching Projection') },
    { artifactId: 'teaching-closure-receipt', artifactHash: requireHash(teaching.receiptHash, 'Teaching closure') },
    { artifactId: 'formal-resource-envelope', artifactHash: requireHash(envelope.envelopeHash, 'formal resource envelope'), allocationHash: envelope.allocationHash },
    { artifactId: 'continuity-receipt', artifactHash: requireHash(continuity.receiptHash, 'continuity receipt') },
    { artifactId: 'derivation-receipt', artifactHash: requireHash(derivation.receiptHash, 'derivation receipt'), allocationHash: derivation.allocationHash },
    { artifactId: 'successor-runtime-manifest', artifactHash: extensionHash },
    { artifactId: 'successor-runtime-materialization', artifactHash: requireHash(stage.materializationReceiptSha256, 'Runtime materialization') },
    { artifactId: 'authority-domain-shard-catalog', artifactHash: requireHash(selectors.selectors.catalog.catalogHash, 'domain catalog') },
    { artifactId: 'authority-domain-shard-set', artifactHash: requireHash(selectors.selectors.shards.shardSetHash, 'domain shards') },
    { artifactId: 'prerequisite-publication', artifactHash: requireHash(selectors.selectors.prerequisite.publicationHash, 'prerequisite publication') },
    { artifactId: 'consumer-activation', artifactHash: requireHash(selectors.selectors.consumerActivation.activationHash, 'consumer activation') },
  ];
  const expected = new Map([
    ['authority-capture', candidate.authorityCaptureHash],
    ['locale-qualification', candidate.localeQualificationHash],
    ['teaching-projection', candidate.teachingProjectionHash],
    ['teaching-closure-receipt', candidate.teachingClosureReceiptHash],
    ['formal-resource-envelope', candidate.formalResourceEnvelopeHash],
    ['continuity-receipt', candidate.continuityReceiptHash],
    ['derivation-receipt', candidate.derivationReceiptHash],
    ['successor-runtime-manifest', candidate.successorRuntimeManifestHash],
    ['successor-runtime-materialization', candidate.successorRuntimeMaterializationHash],
    ['authority-domain-shard-catalog', candidate.domainShardCatalogHash],
    ['authority-domain-shard-set', candidate.domainShardSetHash],
    ['prerequisite-publication', candidate.prerequisitePublicationHash],
    ['consumer-activation', candidate.consumerActivationHash],
  ]);
  for (const row of rows) {
    if (row.artifactHash !== expected.get(row.artifactId)) throw new Error(`reopened ${row.artifactId} differs from candidate`);
    if ('allocationHash' in row && row.allocationHash !== candidate.allocationHash) {
      throw new Error(`reopened ${row.artifactId} belongs to another allocation`);
    }
  }
  writeImmutable(path.join(candidateDir, 'outer-artifacts.json'), rows);
  process.stdout.write(`${path.resolve(ROOT, candidateDir, 'outer-artifacts.json')}\n`);
}

main();
