/**
 * Stage complete immutable consumer activation materializations (#1276).
 *
 * Validates cross-artifact identities, deterministic hashes, and per-consumer
 * readiness before any pointer replacement.
 */

import { existsSync, readFileSync } from 'node:fs';

import {
  verifyMaterializedSnapshot,
  type AuthorityEngineeringBody,
  type AuthoritySnapshotManifest,
} from '@/lib/authoritative-knowledge/authority-snapshot';
import { verifyTeachingProjectionArtifacts } from '@/lib/teaching-projection/builder';
import type {
  TeachingBindingRuntime,
  TeachingCardIndexEntry,
  TeachingCoreNodeRuntime,
  TeachingPrerequisiteRuntime,
  TeachingProjectionArtifacts,
  TeachingProjectionManifest,
  TeachingResourceRuntime,
} from '@/lib/teaching-projection/contracts';

import {
  CONSUMER_ACTIVATION_CONTRACT,
  CONSUMER_ACTIVATION_IDS,
  CONSUMER_ACTIVATION_STAGE_RECEIPT_CONTRACT,
  ConsumerActivationError,
  isConsumerActivationStatus,
  type ConsumerActivationManifest,
  type ConsumerActivationRecord,
  type ConsumerActivationShadowReport,
  type ConsumerActivationStageReceipt,
  type ConsumerActivationId,
} from './contracts';
import { activationDigest, activationSha256, isSha256Hex } from './hash';
import {
  evaluateConsumerReadiness,
  summarizeImpact,
  type EvaluateConsumerReadinessInput,
  type StagedActivationArtifactSet,
} from './readiness';
import {
  assertShadowNoWriteInvariants,
  consumersBlockedByShadow,
} from './shadow';

export interface BuildStagedActivationManifestInput {
  artifacts: StagedActivationArtifactSet;
  priorConsumers?: EvaluateConsumerReadinessInput['priorConsumers'];
  preferPinOnBlock?: boolean;
  shadowConsumerIds?: EvaluateConsumerReadinessInput['shadowConsumerIds'];
  /**
   * When present, material shadow discrepancies auto-merge into shadowConsumerIds
   * and the report hash is verified against the report body.
   */
  shadowReport?: ConsumerActivationShadowReport | null;
  shadowReportHash?: string | null;
  priorActivationId?: string | null;
  priorActivationHash?: string | null;
  activationId?: string;
  stagedAt?: string;
  /** When false, skip fail-closed on blocked engineering (tests only). Default true. */
  requireEngineeringReady?: boolean;
}

export interface StagedActivationManifestResult {
  status: 'staged' | 'failed';
  manifest: ConsumerActivationManifest | null;
  consumers: ConsumerActivationRecord[];
  stageReceipt: ConsumerActivationStageReceipt;
  reasons: string[];
}

function assertKnownStatuses(consumers: readonly ConsumerActivationRecord[]): void {
  for (const row of consumers) {
    if (!isConsumerActivationStatus(row.status)) {
      throw new ConsumerActivationError(
        'unknown-status',
        `unknown consumer status for ${row.consumerId}: ${String(row.status)}`,
      );
    }
  }
}

/**
 * Rehash a real staged file and compare against a declared digest.
 * Missing files and digest mismatches fail closed.
 */
export function verifyArtifactFileHash(
  filePath: string | null | undefined,
  declaredHash: string | null | undefined,
  label: string,
): string | null {
  if (!filePath) {
    return `${label}-path-missing`;
  }
  if (!declaredHash || !isSha256Hex(declaredHash)) {
    return `${label}-hash-invalid`;
  }
  if (!existsSync(filePath)) {
    return `${label}-file-missing`;
  }
  try {
    const actual = activationSha256(readFileSync(filePath));
    if (actual !== declaredHash) {
      return `${label}-hash-mismatch`;
    }
  } catch {
    return `${label}-file-unreadable`;
  }
  return null;
}

/**
 * When artifact file paths are supplied, recompute digests against declared
 * hashes. Callers that only pass hash strings without paths get a hard fail
 * for required artifact keys so malformed/missing/cross-capture files cannot
 * become READY.
 */
/**
 * Consumer-required projection artifacts that readiness depends on.
 * Every declared hash for these (and any other declared key) must have a real
 * path and rehash successfully — inventing SHA-256 alone cannot mark READY.
 */
const AUTHORITY_REQUIRED_ARTIFACTS = [
  'manifest.json',
  'engineering.json',
] as const;

const PROJECTION_REQUIRED_ARTIFACTS = [
  'projection-manifest.json',
  'resources.jsonl',
  'bindings.jsonl',
  'cards-index.json',
  'prerequisites.jsonl',
  'core-nodes.json',
  'impact-report.json',
  'gate.json',
] as const;

function rehashDeclaredArtifacts(
  kind: 'authority' | 'projection',
  artifactHashes: Record<string, string>,
  artifactPaths: Record<string, string> | undefined,
  requiredNames: readonly string[],
): string[] {
  const reasons: string[] = [];
  const declaredNames = new Set([
    ...requiredNames,
    ...Object.keys(artifactHashes),
  ]);
  for (const name of [...declaredNames].sort()) {
    const label = `${kind}-${name.replace(/[^a-z0-9]+/gi, '-')}`;
    const declared = artifactHashes[name];
    const filePath = artifactPaths?.[name];
    const isRequired = (requiredNames as readonly string[]).includes(name);

    // Required consumer artifacts must be declared when that side is present.
    if (isRequired && (!declared || !isSha256Hex(declared))) {
      reasons.push(`${label}-hash-missing`);
      continue;
    }
    // Every declared digest (required or optional) must rehash a real file.
    if (declared) {
      if (!filePath) {
        reasons.push(`${label}-path-missing`);
        continue;
      }
      const failure = verifyArtifactFileHash(filePath, declared, label);
      if (failure) reasons.push(failure);
    }
  }
  return reasons;
}

function readJsonObject(
  filePath: string | undefined,
): { ok: true; value: Record<string, unknown> } | { ok: false; reason: string } {
  if (!filePath || !existsSync(filePath)) {
    return { ok: false, reason: 'file-missing' };
  }
  try {
    const value = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, reason: 'not-object' };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readJsonlArray(filePath: string | undefined): unknown[] {
  if (!filePath || !existsSync(filePath)) return [];
  const text = readFileSync(filePath, 'utf8');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
}

/**
 * After byte rehash, run the real Authority/Projection verifiers and bind
 * declared combination identity to verified manifest fields.
 */
export function validateArtifactIdentityBinding(
  artifacts: StagedActivationArtifactSet,
): string[] {
  const reasons: string[] = [];
  const authority = artifacts.authority;
  if (authority?.present) {
    const manifestPath = authority.artifactPaths?.['manifest.json'];
    const engineeringPath = authority.artifactPaths?.['engineering.json'];
    const manifestParsed = readJsonObject(manifestPath);
    const engineeringParsed = readJsonObject(engineeringPath);
    if (!manifestParsed.ok) {
      reasons.push(`authority-manifest-${manifestParsed.reason}`);
    } else if (!engineeringParsed.ok) {
      reasons.push(`authority-engineering-${engineeringParsed.reason}`);
    } else {
      const manifest = manifestParsed.value as unknown as AuthoritySnapshotManifest;
      const engineering =
        engineeringParsed.value as unknown as AuthorityEngineeringBody;
      try {
        verifyMaterializedSnapshot({ manifest, engineering });
      } catch (error) {
        reasons.push(
          `authority-verifier-failed:${
            error instanceof Error ? error.message : 'verify-failed'
          }`,
        );
      }

      if (
        authority.snapshotId
        && manifest.snapshotId
        && authority.snapshotId !== manifest.snapshotId
      ) {
        reasons.push('authority-manifest-snapshot-id-mismatch');
      }
      if (
        authority.releaseId
        && manifest.releaseId
        && authority.releaseId !== manifest.releaseId
      ) {
        reasons.push('authority-manifest-release-id-mismatch');
      }
      if (
        authority.snapshotHash
        && manifest.snapshotHash
        && authority.snapshotHash !== manifest.snapshotHash
      ) {
        reasons.push('authority-manifest-snapshot-hash-mismatch');
      }
      if (
        authority.captureRevision
        && manifest.captureRevision
        && authority.captureRevision !== manifest.captureRevision
      ) {
        reasons.push('authority-manifest-capture-revision-mismatch');
      }
      if (
        artifacts.captureRevision
        && manifest.captureRevision
        && artifacts.captureRevision !== manifest.captureRevision
      ) {
        reasons.push('authority-manifest-shared-capture-mismatch');
      }
    }
  }

  const projection = artifacts.projection;
  if (projection?.present) {
    const paths = projection.artifactPaths ?? {};
    const manifestParsed = readJsonObject(paths['projection-manifest.json']);
    if (!manifestParsed.ok) {
      reasons.push(`projection-manifest-${manifestParsed.reason}`);
    } else {
      try {
        const manifest =
          manifestParsed.value as unknown as TeachingProjectionManifest;
        const coreNodesFile = readJsonObject(paths['core-nodes.json']);
        const cardsIndexFile = readJsonObject(paths['cards-index.json']);
        const impactFile = readJsonObject(paths['impact-report.json']);
        const gateFile = readJsonObject(paths['gate.json']);
        if (
          !coreNodesFile.ok
          || !cardsIndexFile.ok
          || !impactFile.ok
          || !gateFile.ok
        ) {
          reasons.push('projection-full-artifact-set-incomplete');
        } else {
          const artifactsForVerify = {
            resources: readJsonlArray(paths['resources.jsonl']) as TeachingResourceRuntime[],
            bindings: readJsonlArray(paths['bindings.jsonl']) as TeachingBindingRuntime[],
            prerequisites: readJsonlArray(
              paths['prerequisites.jsonl'],
            ) as TeachingPrerequisiteRuntime[],
            coreNodes: (
              (coreNodesFile.value as { nodes?: TeachingCoreNodeRuntime[] }).nodes
              ?? (coreNodesFile.value as unknown as TeachingCoreNodeRuntime[])
            ),
            cardsIndex: cardsIndexFile.value as unknown as TeachingProjectionArtifacts['cardsIndex'],
            manifest,
            impactReport:
              impactFile.value as unknown as TeachingProjectionArtifacts['impactReport'],
            gate: gateFile.value as unknown as TeachingProjectionArtifacts['gate'],
          } satisfies TeachingProjectionArtifacts;
          verifyTeachingProjectionArtifacts(artifactsForVerify);

          if (
            projection.projectionId
            && manifest.projectionId
            && projection.projectionId !== manifest.projectionId
          ) {
            reasons.push('projection-manifest-id-mismatch');
          }
          if (
            projection.projectionHash
            && manifest.projectionHash
            && projection.projectionHash !== manifest.projectionHash
          ) {
            reasons.push('projection-manifest-hash-mismatch');
          }
          if (
            projection.authorityReleaseId
            && manifest.authorityReleaseId
            && projection.authorityReleaseId !== manifest.authorityReleaseId
          ) {
            reasons.push('projection-manifest-authority-release-mismatch');
          }
          // Bind Projection to the same Authority snapshot + capture, not only
          // releaseId (two valid snapshots under one release must not mix).
          if (artifacts.authority?.present) {
            const auth = artifacts.authority;
            if (
              auth.releaseId
              && manifest.authorityReleaseId
              && auth.releaseId !== manifest.authorityReleaseId
            ) {
              reasons.push(
                'projection-manifest-authority-release-cross-mismatch',
              );
            }
            if (
              auth.snapshotId
              && manifest.authoritySnapshotId
              && auth.snapshotId !== manifest.authoritySnapshotId
            ) {
              reasons.push(
                'projection-manifest-authority-snapshot-id-mismatch',
              );
            }
            if (
              auth.snapshotHash
              && manifest.authoritySnapshotHash
              && auth.snapshotHash !== manifest.authoritySnapshotHash
            ) {
              reasons.push(
                'projection-manifest-authority-snapshot-hash-mismatch',
              );
            }
            // authoringRevision is a contract field on the Projection
            // manifest. Do not fall back to non-contract captureRevision
            // extensions that are outside the projectionHash seal.
            const authoringRevision = asString(manifest.authoringRevision);
            if (!authoringRevision) {
              reasons.push('projection-manifest-authoring-revision-absent');
            } else {
              if (
                auth.captureRevision
                && auth.captureRevision !== authoringRevision
              ) {
                reasons.push(
                  'projection-manifest-authority-capture-mismatch',
                );
              }
              if (
                artifacts.captureRevision
                && artifacts.captureRevision !== authoringRevision
              ) {
                reasons.push(
                  'projection-manifest-shared-capture-mismatch',
                );
              }
            }
            // When Authority is present, require Projection to pin the same
            // snapshot identity fields when the manifest supports them.
            if (auth.snapshotId && !manifest.authoritySnapshotId) {
              reasons.push(
                'projection-manifest-authority-snapshot-id-absent',
              );
            }
            if (auth.snapshotHash && !manifest.authoritySnapshotHash) {
              reasons.push(
                'projection-manifest-authority-snapshot-hash-absent',
              );
            }
          }
        }
      } catch (error) {
        reasons.push(
          `projection-verifier-failed:${
            error instanceof Error ? error.message : 'verify-failed'
          }`,
        );
      }
    }
  }

  return reasons;
}

export function validateArtifactFileDigests(
  artifacts: StagedActivationArtifactSet,
): string[] {
  const reasons: string[] = [];
  const authority = artifacts.authority;
  if (authority?.present) {
    reasons.push(
      ...rehashDeclaredArtifacts(
        'authority',
        authority.artifactHashes,
        authority.artifactPaths,
        AUTHORITY_REQUIRED_ARTIFACTS,
      ),
    );
  }

  const projection = artifacts.projection;
  if (projection?.present) {
    // Always rehash all declared projection hashes. Also require the consumer
    // readiness set when the corresponding has* flags claim presence.
    const required = new Set<string>(['projection-manifest.json']);
    if (projection.hasResources) {
      required.add('resources.jsonl');
      required.add('bindings.jsonl');
    }
    if (projection.hasCardsIndex) required.add('cards-index.json');
    if (projection.hasPrerequisites) required.add('prerequisites.jsonl');
    if (projection.hasImpactReport) required.add('impact-report.json');
    // Union with the full teaching readiness set so inventing only
    // projection-manifest cannot unlock READY teaching consumers.
    for (const name of PROJECTION_REQUIRED_ARTIFACTS) required.add(name);

    reasons.push(
      ...rehashDeclaredArtifacts(
        'projection',
        projection.artifactHashes,
        projection.artifactPaths,
        [...required],
      ),
    );
  }

  // Identity binding only makes sense after files exist/rehash; still always
  // run so missing/mismatched manifests fail closed.
  reasons.push(...validateArtifactIdentityBinding(artifacts));

  return reasons;
}

/**
 * Validate that the staged artifact set is complete enough to materialize an
 * activation manifest. Partial / mixed-capture inputs fail closed.
 */
export function validateStagedArtifactSet(
  artifacts: StagedActivationArtifactSet,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!artifacts.authority?.present) {
    // Authority may be absent only when every consumer pins previous — still
    // allow staging so pin-only manifests can be recorded, but flag it.
    reasons.push('authority-absent-for-stage');
  } else {
    if (!artifacts.authority.snapshotId) reasons.push('authority-snapshot-id-missing');
    if (!isSha256Hex(artifacts.authority.snapshotHash)) {
      reasons.push('authority-snapshot-hash-invalid');
    }
    if (!artifacts.authority.releaseId) reasons.push('authority-release-id-missing');
    if (!artifacts.authority.artifactHashes['manifest.json']) {
      reasons.push('authority-manifest-hash-missing');
    }
    if (!artifacts.authority.artifactHashes['engineering.json']) {
      reasons.push('authority-engineering-hash-missing');
    }
  }

  if (artifacts.projection?.present) {
    if (!artifacts.projection.projectionId) reasons.push('projection-id-missing');
    if (!isSha256Hex(artifacts.projection.projectionHash)) {
      reasons.push('projection-hash-invalid');
    }
    if (!artifacts.projection.artifactHashes['projection-manifest.json']) {
      reasons.push('projection-manifest-hash-missing');
    }
    if (
      artifacts.authority?.present
      && artifacts.authority.releaseId
      && artifacts.projection.authorityReleaseId
      && artifacts.authority.releaseId !== artifacts.projection.authorityReleaseId
    ) {
      reasons.push('authority-projection-release-mismatch');
    }
    if (
      artifacts.captureRevision
      && artifacts.projection.captureRevision
      && artifacts.captureRevision !== artifacts.projection.captureRevision
    ) {
      reasons.push('projection-capture-revision-mismatch');
    }
    if (
      artifacts.captureRevision
      && artifacts.authority?.captureRevision
      && artifacts.captureRevision !== artifacts.authority.captureRevision
    ) {
      reasons.push('authority-capture-revision-mismatch');
    }
  }

  if (artifacts.bindingRelease?.present) {
    if (!artifacts.bindingRelease.bindingReleaseId) reasons.push('binding-release-id-missing');
    if (!isSha256Hex(artifacts.bindingRelease.bindingHash)) {
      reasons.push('binding-hash-invalid');
    }
    if (!artifacts.bindingRelease.artifactHashes['binding-manifest.json']) {
      reasons.push('binding-manifest-hash-missing');
    }
    if (
      artifacts.authority?.present
      && artifacts.authority.releaseId
      && artifacts.bindingRelease.authorityReleaseId
      && artifacts.authority.releaseId !== artifacts.bindingRelease.authorityReleaseId
    ) {
      reasons.push('authority-binding-release-mismatch');
    }
    if (artifacts.bindingRelease.mediaDriftReasons.length > 0) {
      reasons.push('binding-media-drift');
    }
  }

  if (artifacts.identityDriftReasons && artifacts.identityDriftReasons.length > 0) {
    reasons.push(...artifacts.identityDriftReasons);
  }

  reasons.push(...validateArtifactFileDigests(artifacts));

  // Hard fail: tampered / mixed capture that claims both sides present.
  // `authority-absent-for-stage` is soft only when callers later prove every
  // consumer successfully pins a prior combination (checked in build).
  const hardFail = reasons.some((r) => {
    if (r === 'authority-absent-for-stage') return false;
    return (
      r.includes('mismatch')
      || r.includes('drift')
      || r.includes('invalid')
      || r.includes('hash-missing')
      || r.includes('id-missing')
      || r.includes('path-missing')
      || r.includes('file-missing')
      || r.includes('file-unreadable')
      || r.includes('authoring-revision-absent')
      || r.includes('snapshot-id-absent')
      || r.includes('snapshot-hash-absent')
      || r.includes('release-id-absent')
      || r.includes('incomplete')
      || r.includes('verifier-failed')
      || r.includes('unreadable')
    );
  });

  return { ok: !hardFail, reasons };
}

function mergeShadowConsumerIds(input: {
  shadowConsumerIds?: readonly ConsumerActivationId[];
  shadowReport?: ConsumerActivationShadowReport | null;
}): {
  shadowConsumerIds: ConsumerActivationId[];
  shadowReportHash: string | null;
  reasons: string[];
} {
  const reasons: string[] = [];
  const ids = new Set<ConsumerActivationId>(input.shadowConsumerIds ?? []);
  let shadowReportHash: string | null = null;

  if (input.shadowReport) {
    try {
      assertShadowNoWriteInvariants(input.shadowReport);
    } catch (error) {
      reasons.push(
        error instanceof Error
          ? `shadow-report-invariant:${error.message}`
          : 'shadow-report-invariant-failed',
      );
    }
    // Recompute digest over the report body (without reportHash) to detect
    // tampered shadow evidence.
    const { reportHash: declared, ...body } = input.shadowReport;
    const recomputed = activationDigest(body);
    if (declared !== recomputed) {
      reasons.push('shadow-report-hash-mismatch');
    }
    shadowReportHash = declared;
    for (const consumerId of consumersBlockedByShadow(input.shadowReport)) {
      ids.add(consumerId);
    }
  }

  return {
    shadowConsumerIds: [...ids].sort(),
    shadowReportHash,
    reasons,
  };
}

/**
 * Build a complete activation manifest from staged artifacts and readiness.
 * Does not write to disk — callers persist via the store.
 */
export function buildStagedActivationManifest(
  input: BuildStagedActivationManifestInput,
): StagedActivationManifestResult {
  const stagedAt = input.stagedAt ?? new Date().toISOString();
  const receiptId = `stage-${stagedAt.replace(/[:.]/g, '-')}`;
  const validation = validateStagedArtifactSet(input.artifacts);
  const shadowMerge = mergeShadowConsumerIds({
    shadowConsumerIds: input.shadowConsumerIds,
    shadowReport: input.shadowReport,
  });
  const shadowReportHash =
    input.shadowReportHash
    ?? shadowMerge.shadowReportHash
    ?? null;

  const consumers = evaluateConsumerReadiness({
    artifacts: input.artifacts,
    priorConsumers: input.priorConsumers,
    preferPinOnBlock: input.preferPinOnBlock,
    shadowConsumerIds: shadowMerge.shadowConsumerIds,
    activatedAt: stagedAt,
  });

  try {
    assertKnownStatuses(consumers);
  } catch (error) {
    const reasons = [
      error instanceof Error ? error.message : 'unknown-status',
    ];
    return {
      status: 'failed',
      manifest: null,
      consumers,
      stageReceipt: {
        contract: CONSUMER_ACTIVATION_STAGE_RECEIPT_CONTRACT,
        receiptId,
        activationId: 'failed',
        activationHash: '0'.repeat(64),
        stagedAt,
        status: 'failed',
        reasons,
        artifactHashes: collectArtifactHashes(input.artifacts),
      },
      reasons,
    };
  }

  // Authority-absent is soft only when every named consumer is PINNED_PREVIOUS
  // (complete prior map). Partial priors leave blocked consumers and must fail.
  const authorityAbsent = validation.reasons.includes('authority-absent-for-stage');
  const allConsumersPinned =
    consumers.length === CONSUMER_ACTIVATION_IDS.length
    && consumers.every((row) => row.status === 'PINNED_PREVIOUS');
  const authorityAbsentNotFullyPinned =
    authorityAbsent && !allConsumersPinned;

  // Fail closed when staging validation hard-fails (mixed/tampered) or shadow
  // report integrity fails.
  if (
    !validation.ok
    || shadowMerge.reasons.length > 0
    || authorityAbsentNotFullyPinned
  ) {
    const reasons = [
      ...(validation.ok ? [] : ['staged-artifact-set-invalid']),
      ...validation.reasons,
      ...shadowMerge.reasons,
      ...(authorityAbsentNotFullyPinned
        ? ['authority-absent-requires-full-prior-pins']
        : []),
    ];
    return {
      status: 'failed',
      manifest: null,
      consumers,
      stageReceipt: {
        contract: CONSUMER_ACTIVATION_STAGE_RECEIPT_CONTRACT,
        receiptId,
        activationId: 'failed',
        activationHash: '0'.repeat(64),
        stagedAt,
        status: 'failed',
        reasons,
        artifactHashes: collectArtifactHashes(input.artifacts),
      },
      reasons,
    };
  }

  const impact = summarizeImpact(consumers);
  if (
    input.requireEngineeringReady !== false
    && impact.readyConsumerIds.every(
      (id) => id !== 'engineering-graph' && id !== 'engineering-rag',
    )
    && impact.readyConsumerIds.length === 0
    && impact.pinnedConsumerIds.length === 0
  ) {
    // Completely empty readiness is still stageable for diagnostics, but
    // activation will refuse to claim READY consumers.
  }

  const bodyWithoutHash = {
    contract: CONSUMER_ACTIVATION_CONTRACT,
    captureRevision: input.artifacts.captureRevision,
    stagedAt,
    consumers,
    impact,
    shadowReportHash,
    priorActivationId: input.priorActivationId ?? null,
    priorActivationHash: input.priorActivationHash ?? null,
  };
  const activationHash = activationDigest(bodyWithoutHash);
  const activationId =
    input.activationId ?? `activation-${activationHash.slice(0, 24)}`;

  const manifest: ConsumerActivationManifest = {
    ...bodyWithoutHash,
    activationId,
    activationHash,
  };

  // Re-hash including activationId for stable identity (activationId is derived
  // from body hash, so re-including it is deterministic).
  const finalHash = activationDigest({
    contract: manifest.contract,
    activationId: manifest.activationId,
    captureRevision: manifest.captureRevision,
    stagedAt: manifest.stagedAt,
    consumers: manifest.consumers,
    impact: manifest.impact,
    shadowReportHash: manifest.shadowReportHash,
    priorActivationId: manifest.priorActivationId,
    priorActivationHash: manifest.priorActivationHash,
  });
  manifest.activationHash = finalHash;

  return {
    status: 'staged',
    manifest,
    consumers,
    stageReceipt: {
      contract: CONSUMER_ACTIVATION_STAGE_RECEIPT_CONTRACT,
      receiptId,
      activationId,
      activationHash: finalHash,
      stagedAt,
      status: 'staged',
      reasons: ['complete-staged-materialization', ...validation.reasons],
      artifactHashes: collectArtifactHashes(input.artifacts),
    },
    reasons: ['complete-staged-materialization'],
  };
}

function collectArtifactHashes(
  artifacts: StagedActivationArtifactSet,
): Record<string, string> {
  return {
    ...(artifacts.authority?.artifactHashes ?? {}),
    ...(artifacts.projection?.artifactHashes
      ? Object.fromEntries(
          Object.entries(artifacts.projection.artifactHashes).map(
            ([key, value]) => [`projection:${key}`, value],
          ),
        )
      : {}),
    ...(artifacts.bindingRelease?.artifactHashes
      ? Object.fromEntries(
          Object.entries(artifacts.bindingRelease.artifactHashes).map(
            ([key, value]) => [`binding:${key}`, value],
          ),
        )
      : {}),
  };
}

/**
 * Verify a loaded activation manifest's digest and known statuses.
 */
export function verifyActivationManifest(
  manifest: ConsumerActivationManifest,
): void {
  if (manifest.contract !== CONSUMER_ACTIVATION_CONTRACT) {
    throw new ConsumerActivationError(
      'contract-mismatch',
      `unexpected activation contract: ${manifest.contract}`,
    );
  }
  assertKnownStatuses(manifest.consumers);
  const expected = activationDigest({
    contract: manifest.contract,
    activationId: manifest.activationId,
    captureRevision: manifest.captureRevision,
    stagedAt: manifest.stagedAt,
    consumers: manifest.consumers,
    impact: manifest.impact,
    shadowReportHash: manifest.shadowReportHash,
    priorActivationId: manifest.priorActivationId,
    priorActivationHash: manifest.priorActivationHash,
  });
  if (expected !== manifest.activationHash) {
    throw new ConsumerActivationError(
      'hash-invalid',
      'activation manifest digest mismatch',
    );
  }
  if (!isSha256Hex(manifest.activationHash)) {
    throw new ConsumerActivationError(
      'hash-invalid',
      'activationHash is not sha256 hex',
    );
  }
}
