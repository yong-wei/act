#!/usr/bin/env tsx
/**
 * Coordinated latest-Authority and active-OSS resource cutover CLI (#1509).
 *
 * Version-neutral orchestration over src/lib/latest-authority-oss-cutover:
 *   capture          seal the execution-time latest formal Authority capture
 *   prepare          build the offline non-selectable coordinated candidate
 *   qualify          reopen and hash-verify every referenced artifact
 *   activation-plan  emit the stopped-service transaction plan for the
 *                    separately authorized activation executor
 *
 * Remediation-bound mode (#1515, tasks 12.5/12.6): prepare --remediation-handoff
 * + --remediation-allocation reopens the immutable remediation handoff and its
 * ONE shared coordination allocation, sources every remediation inner hash
 * from the handoff (diverging copied hash strings fail closed), and seals no
 * second allocation. qualify --remediation-root recomputes the remediation
 * artifact identities from the materialized files themselves.
 *
 * The CLI never writes a production selector. Deployment and activation are
 * independent explicit authorizations (see tasks 10.6/10.7).
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  assertCaptureCompatible,
  reopenAuthorityCaptureReceipt,
  sealAuthorityCaptureReceipt,
  type AuthorityCaptureInput,
  type AuthorityComponentIdentity,
  type CapturedPublicContract,
  type SupportedPublicContract,
} from '@/lib/latest-authority-oss-cutover/capture';
import {
  buildActiveBaseline,
  buildCombinedDenominator,
  buildExplicitDelta,
  type ActiveBaselineEntry,
  type ActiveRuntimeReleaseIdentity,
  type ExplicitDeltaInput,
} from '@/lib/latest-authority-oss-cutover/denominator';
import {
  assertCandidateReceiptSelfHash,
  bindInnerArtifact,
  reopenAndVerifyCandidate,
  sealCoordinatedCandidateReceipt,
  sealCoordinationAllocationRecord,
  type SealCandidateReceiptInput,
} from '@/lib/latest-authority-oss-cutover/envelope';
import { evaluateContinuityGate, assertContinuityQualified } from '@/lib/latest-authority-oss-cutover/continuity-gate';
import { assertTeachingClosureComplete, evaluateTeachingClosure } from '@/lib/latest-authority-oss-cutover/teaching-closure';
import { buildCoordinatedRuntimeManifestExtension } from '@/lib/latest-authority-oss-cutover/runtime-binding';
import type {
  CoordinatedCandidateReceipt,
  CoordinationAllocationRecord,
  ResourceSuccessorDisposition,
  RetirementDecision,
} from '@/lib/latest-authority-oss-cutover/contracts';
import { reopenRemediationAllocation } from '@/lib/formal-resource-remediation/allocation';
import { reopenRemediationHandoff } from '@/lib/formal-resource-remediation/handoff';
import type { RemediationAllocation } from '@/lib/formal-resource-remediation/allocation';
import type { RemediationHandoffManifest } from '@/lib/formal-resource-remediation/contracts';
import { projectionDigest } from '@/lib/teaching-projection/hash';
import { resolveLatestStableAggregate } from '../actkg-release/latest-stable-aggregate';
import { REVIEWED_V0_18_V2_REGISTRY } from '../actkg-release/bundle-compatibility-registry-v2';

const execFileAsync = promisify(execFile);

function fail(message: string): never {
  throw new Error(`coordinate-latest-authority-oss-cutover: ${message}`);
}

function parseArgs(argv: string[]): { command: string; values: Map<string, string> } {
  const [command, ...rest] = argv;
  if (!command) fail('missing subcommand (capture|prepare|qualify|activation-plan)');
  const values = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      fail(`invalid argument near ${key ?? '<end>'}`);
    }
    if (values.has(key)) fail(`duplicate option ${key}`);
    values.set(key, value);
  }
  return { command, values };
}

async function readJson(filePath: string): Promise<unknown> {
  const source = await readFile(path.resolve(filePath), 'utf8');
  try {
    return JSON.parse(source) as unknown;
  } catch (error) {
    fail(`${filePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function writeImmutable(filePath: string, content: string): Promise<void> {
  const absolute = path.resolve(filePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  const existing = await readFile(absolute, 'utf8').catch(() => null);
  if (existing !== null && existing !== content) {
    fail(`refusing to overwrite immutable artifact ${absolute}`);
  }
  if (existing === null) await writeFile(absolute, content);
}

async function sha256File(filePath: string): Promise<string> {
  const buffer = await readFile(path.resolve(filePath));
  return createHash('sha256').update(buffer).digest('hex');
}

async function sha256JsonField(filePath: string, field: string): Promise<string> {
  const parsed = (await readJson(filePath)) as Record<string, unknown>;
  const value = parsed[field];
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    fail(`${filePath} does not carry a SHA-256 ${field}`);
  }
  return value;
}

function required(values: Map<string, string>, key: string): string {
  const value = values.get(key);
  if (!value) fail(`missing ${key}`);
  return value;
}

function defaultSupportedContract(): SupportedPublicContract {
  const registry = REVIEWED_V0_18_V2_REGISTRY;
  return {
    schemaIdentities: { [registry.schemaVersion]: registry.schemaRawSha256 },
    contractVersions: [registry.bundleContractVersion],
    requiredMembers: registry.artifactContracts
      .filter((contract) => contract.requiredForAggregate)
      .map((contract) => contract.role),
    profiles: registry.projectionProfiles.map((profile) => profile.manifestProfile),
  };
}

async function runCapture(values: Map<string, string>): Promise<void> {
  const actkgRoot = required(values, '--actkg-root');
  const outDir = required(values, '--out');
  const mainRef = values.get('--main-ref') ?? 'origin/main';
  if (values.get('--skip-fetch') !== '1') {
    // Refresh the formal remote tags before resolving the latest aggregate.
    await execFileAsync('git', ['-C', actkgRoot, 'fetch', '--tags', 'origin'], {
      stdio: 'ignore',
    }).catch((error: unknown) => {
      fail(`git fetch --tags failed in ${actkgRoot}: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  const resolution = await resolveLatestStableAggregate({
    actkgRoot,
    mainRef,
  });
  const binding = resolution.binding;
  const componentsFile = values.get('--components');
  const components: AuthorityComponentIdentity[] = componentsFile
    ? (await readJson(componentsFile)) as AuthorityComponentIdentity[]
    : fail('--components <json> with the six-kind component closure is required');
  const supported = values.get('--supported-contract')
    ? (await readJson(values.get('--supported-contract') as string)) as SupportedPublicContract
    : defaultSupportedContract();
  const capturedPublicContract: CapturedPublicContract = {
    schemaVersion: binding.schemaVersion,
    schemaSha256: binding.schemaSha256,
    contractVersion: supported.contractVersions[0] ?? 'actkg-public-bundle/2',
    requiredMembers: supported.requiredMembers,
    profiles: [...new Set(supported.profiles)],
    // resolveLatestStableAggregate already performs the complete bundle
    // validation (SHA256SUMS, manifest, validation report, closure), which
    // is the representative adapter parse for the captured tree.
    representativeParse: 'COMPLETE',
  };
  const input: AuthorityCaptureInput = {
    capturedAt: new Date().toISOString(),
    actkgMainCommit: binding.actkgMainCommit,
    sourceCommit: binding.sourceCommit,
    sourceTag: binding.sourceTag,
    packagingCommit: binding.packagingCommit,
    stableTag: binding.stableTag,
    releaseId: binding.releaseId,
    releaseVersion: binding.releaseVersion,
    bundleId: binding.bundleId,
    bundleDigest: binding.bundleDigest,
    manifestSha256: binding.manifestSha256,
    sha256sumsSha256: binding.sha256sumsSha256,
    validationReportSha256: binding.validationReportSha256,
    actkgWorktreeDirty: false,
    componentIdentities: components,
    predecessorBundleId: binding.predecessorBundleId,
    candidateChain: binding.candidateChain,
    capturedPublicContract,
    adapterContractVersion: supported.contractVersions[0] ?? 'actkg-public-bundle/2',
    supportedPublicContract: supported,
  };
  const receipt = sealAuthorityCaptureReceipt(input);
  await writeImmutable(
    path.join(outDir, 'authority-capture.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  if (receipt.compatibility.classification !== 'COMPATIBLE') {
    process.stdout.write(
      `ADAPTATION_REQUIRED\n${receipt.compatibility.incompatibleReasons.join('\n')}\n`,
    );
    process.exitCode = 2;
    return;
  }
  process.stdout.write(
    `capture=${receipt.captureId}\nrelease=${receipt.releaseId} (${receipt.releaseVersion})\ncompatibility=COMPATIBLE\n`,
  );
}

interface PrepareInputs {
  readonly activeRelease: ActiveRuntimeReleaseIdentity;
  readonly entries: ActiveBaselineEntry[];
  readonly delta?: ExplicitDeltaInput[];
  readonly dispositions: ResourceSuccessorDisposition[];
  readonly retirements?: RetirementDecision[];
  readonly scope: { scopeHash: string; members: { canonicalId: string }[] };
  readonly teaching: {
    readonly dispositions: Parameters<typeof evaluateTeachingClosure>[0]['dispositions'];
    readonly candidates: Parameters<typeof evaluateTeachingClosure>[0]['candidates'];
    readonly decisions: Parameters<typeof evaluateTeachingClosure>[0]['decisions'];
  };
  readonly inner: {
    readonly localeQualificationHash: string;
    readonly teachingProjectionHash: string;
    readonly formalResourceEnvelopeHash: string;
    readonly derivationReceiptHash: string;
    readonly successorRuntimeManifest: { releaseId: string; manifestSha256: string; treeSha256: string };
    readonly successorRuntimeMaterializationHash: string;
    readonly domainShardCatalogHash: string;
    readonly domainShardSetHash: string;
    readonly prerequisitePublicationHash: string;
    readonly consumerActivationHash: string;
  };
  readonly predecessor: { selectorId: string; identity: string }[];
  readonly predecessorRuntimeLifecycleGeneration: number;
  readonly successorSelectorExpectations: { selectorId: string; expectedSuccessorIdentity: string }[];
  readonly transactionImplementationIdentity: string;
  readonly rollbackPlanHash: string;
  readonly verificationPolicyHash: string;
}

interface RemediationBinding {
  readonly handoff: RemediationHandoffManifest;
  readonly allocation: RemediationAllocation;
}

/** Inner hash fields the remediation handoff owns; copies must never diverge. */
const REMEDIATION_INNER_FIELDS: readonly {
  readonly innerKey: 'teachingProjectionHash' | 'formalResourceEnvelopeHash' | 'domainShardSetHash' | 'prerequisitePublicationHash' | 'consumerActivationHash';
  readonly handoffKey: 'teachingProjectionHash' | 'resourceEnvelopeHash' | 'domainShardsHash' | 'prerequisitePublicationHash' | 'consumerProjectionsHash';
}[] = [
  { innerKey: 'teachingProjectionHash', handoffKey: 'teachingProjectionHash' },
  { innerKey: 'formalResourceEnvelopeHash', handoffKey: 'resourceEnvelopeHash' },
  { innerKey: 'domainShardSetHash', handoffKey: 'domainShardsHash' },
  { innerKey: 'prerequisitePublicationHash', handoffKey: 'prerequisitePublicationHash' },
  { innerKey: 'consumerActivationHash', handoffKey: 'consumerProjectionsHash' },
];

async function reopenRemediationBinding(
  handoffPath: string | undefined,
  allocationPath: string | undefined,
): Promise<RemediationBinding | null> {
  if (handoffPath === undefined && allocationPath === undefined) return null;
  if (handoffPath === undefined || allocationPath === undefined) {
    fail('--remediation-handoff and --remediation-allocation must be provided together');
  }
  const handoff = reopenRemediationHandoff(
    (await readJson(handoffPath)) as RemediationHandoffManifest,
  );
  const allocation = reopenRemediationAllocation(
    (await readJson(allocationPath)) as RemediationAllocation,
  );
  if (allocation.allocationHash !== handoff.allocationHash) {
    fail('the reopened remediation allocation does not match the handoff allocation hash');
  }
  if (allocation.captureHash !== handoff.authorityCaptureHash) {
    fail('the reopened remediation allocation capture differs from the handoff authority capture');
  }
  return { handoff, allocation };
}

async function runPrepare(values: Map<string, string>): Promise<void> {
  const inputPath = required(values, '--input');
  const outDir = required(values, '--out');
  const remediation = await reopenRemediationBinding(
    values.get('--remediation-handoff'),
    values.get('--remediation-allocation'),
  );
  const capturePath = values.get('--capture');
  if (remediation && capturePath) {
    fail('a remediation-bound prepare binds the shared allocation capture; an outer capture receipt is a separate authority');
  }
  if (!remediation && !capturePath) fail('missing --capture');
  const capture = capturePath
    ? reopenAuthorityCaptureReceipt(
        (await readJson(capturePath)) as Parameters<typeof reopenAuthorityCaptureReceipt>[0],
      )
    : null;
  if (capture) assertCaptureCompatible(capture);
  const input = (await readJson(inputPath)) as PrepareInputs;

  // Remediation-bound inner hashes come from the reopened handoff only; any
  // copied hash string in the input that diverges fails closed here.
  const inner: PrepareInputs['inner'] = { ...input.inner };
  if (remediation) {
    for (const field of REMEDIATION_INNER_FIELDS) {
      const handoffValue = remediation.handoff[field.handoffKey];
      const copied = input.inner[field.innerKey];
      if (copied !== undefined && copied !== handoffValue) {
        fail(`input.inner.${field.innerKey} is a diverging copy of the handoff ${field.handoffKey}`);
      }
      (inner as Record<string, unknown>)[field.innerKey] = handoffValue;
    }
  }
  const authorityCaptureHash = remediation
    ? remediation.handoff.authorityCaptureHash
    : capture!.captureHash;

  const baseline = buildActiveBaseline({ activeRelease: input.activeRelease, entries: input.entries });
  const delta = buildExplicitDelta(input.delta ?? []);
  const denominator = buildCombinedDenominator(baseline, delta);
  const continuity = evaluateContinuityGate({
    denominator,
    baselineReleaseId: input.activeRelease.releaseId,
    dispositions: input.dispositions,
    retirements: input.retirements ?? [],
  });
  const closure = evaluateTeachingClosure({
    scopeHash: input.scope.scopeHash,
    authorityCaptureHash,
    members: input.scope.members,
    dispositions: input.teaching.dispositions,
    candidates: input.teaching.candidates,
    decisions: input.teaching.decisions,
  });
  // A remediation-bound run reuses the ONE shared coordination allocation;
  // only an unbound run seals a fresh allocation record.
  const allocation: CoordinationAllocationRecord = remediation
    ? remediation.allocation
    : sealCoordinationAllocationRecord({
        sealedAt: new Date().toISOString(),
        capture: { captureHash: authorityCaptureHash, compatibility: capture!.compatibility },
        scopeHash: input.scope.scopeHash,
        denominatorHash: denominator.denominatorHash,
        policyVersions: {
          continuity: 'resource-continuity/v1',
          teachingClosure: 'coordinated-teaching-closure/v1',
          rollback: 'coordinated-cutover-rollback/v1',
        },
        implementationIdentities: {
          builder: 'latest-authority-oss-cutover-builder/v1',
          transaction: input.transactionImplementationIdentity,
        },
      });
  const { extension: runtimeExtension } = buildCoordinatedRuntimeManifestExtension({
    successorManifest: inner.successorRuntimeManifest,
    materializationReceiptHash: inner.successorRuntimeMaterializationHash,
    denominatorHash: denominator.denominatorHash,
    captureHash: authorityCaptureHash,
    teachingProjectionHash: inner.teachingProjectionHash,
    teachingClosureReceiptHash: closure.receiptHash,
    formalResourceEnvelopeHash: inner.formalResourceEnvelopeHash,
    continuityReceiptHash: continuity.receiptHash,
    domainShardSetHash: inner.domainShardSetHash,
    prerequisitePublicationHash: inner.prerequisitePublicationHash,
    consumerActivationHash: inner.consumerActivationHash,
    allocationHash: allocation.allocationHash,
    predecessorRuntimeReleaseId: input.activeRelease.releaseId,
    predecessorRuntimeManifestSha256: input.activeRelease.manifestSha256,
    predecessorLifecycleGeneration: input.activeRelease.lifecycleGeneration,
  });
  const runtimeExtensionHash = projectionDigest({
    successorManifest: inner.successorRuntimeManifest,
    materializationReceiptHash: inner.successorRuntimeMaterializationHash,
    extension: runtimeExtension,
  });
  const innerBindings = [
    bindInnerArtifact({
      allocation,
      artifactId: 'teaching-projection',
      artifactKind: 'teaching-projection',
      dependsOn: [{ artifactId: 'allocation', artifactHash: allocation.allocationHash }],
      artifactHash: inner.teachingProjectionHash,
    }),
    bindInnerArtifact({
      allocation,
      artifactId: 'formal-resource-envelope',
      artifactKind: 'formal-resource-envelope',
      dependsOn: [{ artifactId: 'allocation', artifactHash: allocation.allocationHash }],
      artifactHash: inner.formalResourceEnvelopeHash,
    }),
    bindInnerArtifact({
      allocation,
      artifactId: 'successor-runtime-binding',
      artifactKind: 'coordinated-runtime-manifest-extension',
      dependsOn: [{ artifactId: 'allocation', artifactHash: allocation.allocationHash }],
      artifactHash: runtimeExtensionHash,
    }),
    bindInnerArtifact({
      allocation,
      artifactId: 'domain-shard-set',
      artifactKind: 'authority-domain-shard-set',
      dependsOn: [{ artifactId: 'allocation', artifactHash: allocation.allocationHash }],
      artifactHash: inner.domainShardSetHash,
    }),
    bindInnerArtifact({
      allocation,
      artifactId: 'prerequisite-publication',
      artifactKind: 'prerequisite-publication',
      dependsOn: [{ artifactId: 'teaching-projection', artifactHash: inner.teachingProjectionHash }],
      artifactHash: inner.prerequisitePublicationHash,
    }),
    bindInnerArtifact({
      allocation,
      artifactId: 'consumer-activation',
      artifactKind: 'shared-consumer-activation',
      dependsOn: [{ artifactId: 'teaching-projection', artifactHash: inner.teachingProjectionHash }],
      artifactHash: inner.consumerActivationHash,
    }),
  ];
  const candidateInput: SealCandidateReceiptInput = {
    sealedAt: new Date().toISOString(),
    allocation,
    authorityCaptureHash,
    localeQualificationHash: inner.localeQualificationHash,
    teachingProjectionHash: inner.teachingProjectionHash,
    teachingClosureReceiptHash: closure.receiptHash,
    formalResourceEnvelopeHash: inner.formalResourceEnvelopeHash,
    continuityReceiptHash: continuity.receiptHash,
    derivationReceiptHash: inner.derivationReceiptHash,
    successorRuntimeManifestHash: runtimeExtensionHash,
    successorRuntimeMaterializationHash: inner.successorRuntimeMaterializationHash,
    domainShardCatalogHash: inner.domainShardCatalogHash,
    domainShardSetHash: inner.domainShardSetHash,
    prerequisitePublicationHash: inner.prerequisitePublicationHash,
    consumerActivationHash: inner.consumerActivationHash,
    predecessor: input.predecessor,
    predecessorRuntimeLifecycleGeneration: input.predecessorRuntimeLifecycleGeneration,
    successorSelectorExpectations: input.successorSelectorExpectations,
    transactionImplementationIdentity: input.transactionImplementationIdentity,
    rollbackPlanHash: input.rollbackPlanHash,
    verificationPolicyHash: input.verificationPolicyHash,
    innerBindings,
  };
  // Fail closed before sealing: an unresolved baseline resource or an
  // incomplete teaching closure must never be packaged as an executable
  // candidate. The evidence artifacts below remain on disk for diagnosis.
  await writeImmutable(path.join(outDir, 'denominator.json'), `${JSON.stringify(denominator, null, 2)}\n`);
  await writeImmutable(path.join(outDir, 'continuity-receipt.json'), `${JSON.stringify(continuity, null, 2)}\n`);
  await writeImmutable(path.join(outDir, 'teaching-closure-receipt.json'), `${JSON.stringify(closure, null, 2)}\n`);
  await writeImmutable(path.join(outDir, 'allocation.json'), `${JSON.stringify(allocation, null, 2)}\n`);
  await writeImmutable(path.join(outDir, 'successor-runtime-manifest-extension.json'), `${JSON.stringify(runtimeExtension, null, 2)}\n`);
  await writeImmutable(path.join(outDir, 'successor-manifest.json'), `${JSON.stringify(inner.successorRuntimeManifest, null, 2)}\n`);
  assertContinuityQualified(continuity);
  assertTeachingClosureComplete(closure);
  const candidate = sealCoordinatedCandidateReceipt(candidateInput);
  await writeImmutable(path.join(outDir, 'candidate-receipt.json'), `${JSON.stringify(candidate, null, 2)}\n`);
  process.stdout.write(
    `candidate=${candidate.candidateId}\nselectable=${candidate.selectable}\ncontinuity=${continuity.status}\nteachingClosure=${closure.status}\nallocation=${allocation.allocationHash}\n`,
  );
}

async function runQualify(values: Map<string, string>): Promise<void> {
  const candidatePath = required(values, '--candidate');
  const candidate = (await readJson(candidatePath)) as CoordinatedCandidateReceipt;
  assertCandidateReceiptSelfHash(candidate);
  const artifacts = new Map<string, { artifactHash: string; allocationHash?: string }>();
  const remediationRoot = values.get('--remediation-root');
  const remediationAllocationPath = values.get('--remediation-allocation');
  if (remediationRoot !== undefined && remediationAllocationPath === undefined) {
    fail('--remediation-root requires --remediation-allocation for the shared capture identity');
  }
  if (remediationRoot !== undefined && remediationAllocationPath !== undefined) {
    const allocation = reopenRemediationAllocation(
      (await readJson(remediationAllocationPath)) as RemediationAllocation,
    );
    if (allocation.allocationHash !== candidate.allocationHash) {
      fail('the remediation allocation and the candidate bind different coordination envelopes');
    }
    const optionalAllocationField = async (filePath: string): Promise<string | undefined> => {
      const parsed = (await readJson(filePath)) as Record<string, unknown>;
      const value = parsed.allocationHash;
      return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value) ? value : undefined;
    };
    const projectionDir = path.join(remediationRoot, 'teaching-projection');
    const fragmentFiles = readdirSync(path.resolve(projectionDir, 'fragments'))
      .filter((name) => name.endsWith('.json'))
      .sort();
    const consumerGraphHash = await sha256File(path.join(projectionDir, 'consumers/graph-view.json'));
    const consumerPrerequisiteHash = await sha256File(path.join(projectionDir, 'consumers/prerequisite-publication.json'));
    const remediationArtifacts: Record<string, { artifactHash: string; allocationHash?: string }> = {
      'authority-capture': { artifactHash: allocation.captureHash },
      'teaching-projection': {
        artifactHash: await sha256JsonField(path.join(projectionDir, 'projection.json'), 'projectionHash'),
        allocationHash: await optionalAllocationField(path.join(projectionDir, 'projection.json')),
      },
      'formal-resource-envelope': {
        artifactHash: await sha256JsonField(path.join(remediationRoot, 'resource-envelope.json'), 'envelopeHash'),
        allocationHash: await optionalAllocationField(path.join(remediationRoot, 'resource-envelope.json')),
      },
      // The teaching-closure receipt is a coordinated-closure evaluation over
      // the remediation ledgers, not the remediation total-closure file; it
      // is qualified from the prepare output instead.
      'authority-domain-shard-set': {
        artifactHash: projectionDigest({
          files: await Promise.all(
            fragmentFiles.map(async (name) => [name, await sha256File(path.join(projectionDir, 'fragments', name))] as const),
          ),
        }),
      },
      'prerequisite-publication': { artifactHash: consumerPrerequisiteHash },
      'consumer-activation': { artifactHash: projectionDigest({ graph: consumerGraphHash, prerequisite: consumerPrerequisiteHash }) },
    };
    for (const [artifactId, row] of Object.entries(remediationArtifacts)) artifacts.set(artifactId, row);
  }
  const artifactsFile = values.get('--artifacts');
  if (artifactsFile) {
    const rows = (await readJson(artifactsFile)) as {
      artifactId: string;
      artifactHash: string;
      allocationHash?: string;
    }[];
    for (const row of rows) artifacts.set(row.artifactId, row);
  }
  await reopenAndVerifyCandidate(candidate, async (artifactId) => {
    const observed = artifacts.get(artifactId);
    if (!observed) fail(`artifact ${artifactId} is not present in the reopen set`);
    return observed;
  });
  process.stdout.write(`qualified=1\nreceipt=${candidate.receiptHash}\n`);
}

async function runActivationPlan(values: Map<string, string>): Promise<void> {
  const candidatePath = required(values, '--candidate');
  const outPath = required(values, '--out');
  const candidate = (await readJson(candidatePath)) as CoordinatedCandidateReceipt;
  assertCandidateReceiptSelfHash(candidate);
  if (candidate.selectable !== false) fail('only non-selectable candidates can be planned for activation');
  const predecessorById = new Map(candidate.predecessor.map((state) => [state.selectorId, state.identity]));
  const orderedMutations = candidate.successorSelectorExpectations.map((expectation) => ({
    selectorId: expectation.selectorId,
    expectedPredecessorIdentity: predecessorById.get(expectation.selectorId) ?? fail(
      `selector ${expectation.selectorId} has no sealed predecessor identity`,
    ),
    successorIdentity: expectation.expectedSuccessorIdentity,
  }));
  const plan = {
    contract: 'cutover-transaction-plan/v1' as const,
    candidateReceiptHash: candidate.receiptHash,
    transactionImplementationIdentity: candidate.transactionImplementationIdentity,
    orderedMutations,
    compensationPlan: candidate.predecessor.map((state) => ({
      selectorId: state.selectorId,
      restoreIdentity: state.identity,
    })),
    authorizationNote:
      'Deployment and production activation are separate explicit authorizations; this plan alone stops no service and writes no selector.',
  };
  await writeImmutable(outPath, `${JSON.stringify(plan, null, 2)}\n`);
  process.stdout.write(`planSelectors=${orderedMutations.length}\n`);
}

async function main(): Promise<void> {
  const { command, values } = parseArgs(process.argv.slice(2));
  const allowedByCommand: Record<string, readonly string[]> = {
    capture: ['--actkg-root', '--main-ref', '--out', '--components', '--supported-contract', '--skip-fetch'],
    prepare: ['--capture', '--input', '--out', '--remediation-handoff', '--remediation-allocation'],
    qualify: ['--candidate', '--artifacts', '--remediation-root', '--remediation-allocation'],
    'activation-plan': ['--candidate', '--out'],
  };
  const allowed = allowedByCommand[command];
  if (!allowed) fail(`unknown subcommand ${command}`);
  for (const key of values.keys()) {
    if (!allowed.includes(key)) fail(`unknown option ${key} for ${command}`);
  }
  if (command === 'capture') await runCapture(values);
  else if (command === 'prepare') await runPrepare(values);
  else if (command === 'qualify') await runQualify(values);
  else await runActivationPlan(values);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
