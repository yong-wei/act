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
 * The CLI never writes a production selector. Deployment and activation are
 * independent explicit authorizations (see tasks 10.6/10.7).
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
  ResourceSuccessorDisposition,
  RetirementDecision,
} from '@/lib/latest-authority-oss-cutover/contracts';
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

async function runPrepare(values: Map<string, string>): Promise<void> {
  const capturePath = required(values, '--capture');
  const inputPath = required(values, '--input');
  const outDir = required(values, '--out');
  const capture = reopenAuthorityCaptureReceipt(
    (await readJson(capturePath)) as Parameters<typeof reopenAuthorityCaptureReceipt>[0],
  );
  assertCaptureCompatible(capture);
  const input = (await readJson(inputPath)) as PrepareInputs;

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
    authorityCaptureHash: capture.captureHash,
    members: input.scope.members,
    dispositions: input.teaching.dispositions,
    candidates: input.teaching.candidates,
    decisions: input.teaching.decisions,
  });
  const allocation = sealCoordinationAllocationRecord({
    sealedAt: new Date().toISOString(),
    capture: { captureHash: capture.captureHash, compatibility: capture.compatibility },
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
    successorManifest: input.inner.successorRuntimeManifest,
    materializationReceiptHash: input.inner.successorRuntimeMaterializationHash,
    denominatorHash: denominator.denominatorHash,
    captureHash: capture.captureHash,
    teachingProjectionHash: input.inner.teachingProjectionHash,
    teachingClosureReceiptHash: closure.receiptHash,
    formalResourceEnvelopeHash: input.inner.formalResourceEnvelopeHash,
    continuityReceiptHash: continuity.receiptHash,
    domainShardSetHash: input.inner.domainShardSetHash,
    prerequisitePublicationHash: input.inner.prerequisitePublicationHash,
    consumerActivationHash: input.inner.consumerActivationHash,
    allocationHash: allocation.allocationHash,
    predecessorRuntimeReleaseId: input.activeRelease.releaseId,
    predecessorRuntimeManifestSha256: input.activeRelease.manifestSha256,
    predecessorLifecycleGeneration: input.activeRelease.lifecycleGeneration,
  });
  const projectionDigestModule = await import('@/lib/teaching-projection/hash');
  const runtimeExtensionHash = projectionDigestModule.projectionDigest({
    successorManifest: input.inner.successorRuntimeManifest,
    materializationReceiptHash: input.inner.successorRuntimeMaterializationHash,
    extension: runtimeExtension,
  });
  const innerBindings = [
    bindInnerArtifact({
      allocation,
      artifactId: 'teaching-projection',
      artifactKind: 'teaching-projection',
      dependsOn: [{ artifactId: 'allocation', artifactHash: allocation.allocationHash }],
      artifactHash: input.inner.teachingProjectionHash,
    }),
    bindInnerArtifact({
      allocation,
      artifactId: 'formal-resource-envelope',
      artifactKind: 'formal-resource-envelope',
      dependsOn: [{ artifactId: 'allocation', artifactHash: allocation.allocationHash }],
      artifactHash: input.inner.formalResourceEnvelopeHash,
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
      artifactHash: input.inner.domainShardSetHash,
    }),
    bindInnerArtifact({
      allocation,
      artifactId: 'prerequisite-publication',
      artifactKind: 'prerequisite-publication',
      dependsOn: [{ artifactId: 'teaching-projection', artifactHash: input.inner.teachingProjectionHash }],
      artifactHash: input.inner.prerequisitePublicationHash,
    }),
    bindInnerArtifact({
      allocation,
      artifactId: 'consumer-activation',
      artifactKind: 'shared-consumer-activation',
      dependsOn: [{ artifactId: 'teaching-projection', artifactHash: input.inner.teachingProjectionHash }],
      artifactHash: input.inner.consumerActivationHash,
    }),
  ];
  const candidateInput: SealCandidateReceiptInput = {
    sealedAt: new Date().toISOString(),
    allocation,
    authorityCaptureHash: capture.captureHash,
    localeQualificationHash: input.inner.localeQualificationHash,
    teachingProjectionHash: input.inner.teachingProjectionHash,
    teachingClosureReceiptHash: closure.receiptHash,
    formalResourceEnvelopeHash: input.inner.formalResourceEnvelopeHash,
    continuityReceiptHash: continuity.receiptHash,
    derivationReceiptHash: input.inner.derivationReceiptHash,
    successorRuntimeManifestHash: runtimeExtensionHash,
    successorRuntimeMaterializationHash: input.inner.successorRuntimeMaterializationHash,
    domainShardCatalogHash: input.inner.domainShardCatalogHash,
    domainShardSetHash: input.inner.domainShardSetHash,
    prerequisitePublicationHash: input.inner.prerequisitePublicationHash,
    consumerActivationHash: input.inner.consumerActivationHash,
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
  assertContinuityQualified(continuity);
  assertTeachingClosureComplete(closure);
  const candidate = sealCoordinatedCandidateReceipt(candidateInput);
  await writeImmutable(path.join(outDir, 'candidate-receipt.json'), `${JSON.stringify(candidate, null, 2)}\n`);
  process.stdout.write(
    `candidate=${candidate.candidateId}\nselectable=${candidate.selectable}\ncontinuity=${continuity.status}\nteachingClosure=${closure.status}\n`,
  );
}

async function runQualify(values: Map<string, string>): Promise<void> {
  const candidatePath = required(values, '--candidate');
  const candidate = (await readJson(candidatePath)) as CoordinatedCandidateReceipt;
  assertCandidateReceiptSelfHash(candidate);
  const artifacts = new Map<string, { artifactHash: string; allocationHash?: string }>();
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
    prepare: ['--capture', '--input', '--out'],
    qualify: ['--candidate', '--artifacts'],
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
