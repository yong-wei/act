#!/usr/bin/env tsx
/**
 * Task 12.5/12.6 evidence (#1515): drive the coordinated cutover CLI in
 * remediation-bound mode. The prepare run must reopen the immutable
 * remediation handoff and its ONE shared coordination allocation (never a
 * second allocation, never copied inner hash strings); the qualify run must
 * recompute the remediation artifact identities from the materialized files.
 * The candidate stays non-selectable and every production selector stays on
 * the predecessor v0.9 identities.
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import type { ActTeachingFamilyDisposition } from '@/lib/act-canonical-teaching-relations/contracts';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const REMEDIATION_ROOT = 'course-content/authoring/knowledge/formal-resource-remediation';
const OUT_DIR = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-remediation';
const CLI = 'scripts/knowledge-cutover/coordinate-latest-authority-oss-cutover.ts';
const SCOPE_PATH = 'course-content/authoring/knowledge/teaching-projection/act-relations/ctr-release-control-theory-engineering-v0.37/scope.json';
const R3_BUNDLE = 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.37-r3';
const PREDECESSOR_RELEASE_ID = 'ctr:release:control-theory-engineering-v0.9';
const SUCCESSOR_RELEASE_ID = 'ctr:release:control-theory-engineering-v0.37';
const PRODUCTION_POINTERS = [
  'course-content/authoring/knowledge/authority/current.json',
  'course-content/runtime/knowledge/projection/current.json',
  'course-content/runtime/knowledge/prerequisites/current.json',
  'course-content/runtime/knowledge/authority-domain-catalog/current.json',
  'course-content/runtime/knowledge/authority-domain-shards/current.json',
  'course-content/runtime/knowledge/consumer-activation/current.json',
  'course-content/runtime/knowledge/production-cutover-transactions/current.json',
];
const EXCLUDED_DOMAINS = ['robust-control-analysis-and-design', 'discrete-time-control-analysis', 'discrete-time-control-design', 'optimal-control-foundations-and-linear-quadratic-design', 'lyapunov-stability', 'nonlinear-control-design'] as const;
const COVERED_DOMAINS = ['root-locus', 'robustness-sensitivity-analysis', 'stability-analysis', 'nonlinear-system-analysis', 'time-domain-analysis', 'system-modeling', 'classical-control-design', 'frequency-domain-analysis', 'state-space-control-analysis-and-design'] as const;
const ALL_DOMAINS: readonly string[] = [...COVERED_DOMAINS, ...EXCLUDED_DOMAINS];
const RECORD_PATHS = [
  `${REMEDIATION_ROOT}/resource-layer/text/text-processing-records.json`,
  `${REMEDIATION_ROOT}/20260823-asr-batch/asr-processing-records.json`,
  `${REMEDIATION_ROOT}/resource-layer/exercises/exercise-processing-records.json`,
  `${REMEDIATION_ROOT}/resource-layer/intro-videos/intro-video-processing-records.json`,
  `${REMEDIATION_ROOT}/resource-layer/simulations/simulation-processing-records.json`,
  `${REMEDIATION_ROOT}/resource-layer/handout-exercises/handout-exercise-processing-records.json`,
];

function absolute(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(absolute(filePath))).digest('hex');
}

function writeDeterministicJson(filePath: string, value: unknown): 'created' | 'skipped' {
  const target = absolute(filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 1)}\n`);
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite diverging artifact ${target}`);
    return 'skipped';
  }
  writeFileSync(target, bytes);
  return 'created';
}

async function runCli(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('tsx', [CLI, ...args], { cwd: ROOT });
  process.stdout.write(stdout);
  return stdout;
}

async function main(): Promise<void> {
  const handoff = readJson<Record<string, unknown>>(`${REMEDIATION_ROOT}/remediation-handoff.json`);
  const scopeArtifact = readJson<{ readonly scopeHash: string; readonly members: readonly { readonly canonicalId: string }[] }>(SCOPE_PATH);
  const ledgerDisposition: ActTeachingFamilyDisposition[] = [];
  const rationaleByMember = new Map<string, string>();
  for (const domain of ALL_DOMAINS) {
    const decisionsPath = absolute(`${REMEDIATION_ROOT}/${domain}-closure/decisions.jsonl`);
    if (existsSync(decisionsPath)) {
      for (const line of readFileSync(decisionsPath, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        const decision = JSON.parse(line) as { canonicalId: string; rationale?: string };
        rationaleByMember.set(decision.canonicalId, decision.rationale ?? `domain-closure:${domain}`);
      }
    }
    const ledger = readJson<{ readonly rows: readonly { canonicalId: string; family: 'containment' | 'prerequisite' | 'association'; disposition: string; edgeId: string | null; evidenceRefs: readonly string[] }[] }>(`${REMEDIATION_ROOT}/${domain}-closure/final-ledger.json`);
    for (const row of ledger.rows) {
      ledgerDisposition.push({
        scopeHash: scopeArtifact.scopeHash,
        canonicalId: row.canonicalId,
        family: row.family,
        kind: row.disposition as ActTeachingFamilyDisposition['kind'],
        edgeId: row.edgeId,
        evidenceRefs: row.evidenceRefs,
        rationale: rationaleByMember.get(row.canonicalId) ?? `domain-closure:${domain}`,
      });
    }
  }

  // Successor resource delta: every envelope resource enters as NEW with its
  // processing-record source identity; the v0.9 predecessor carries no
  // successor-resource baseline, so the baseline stays empty.
  interface ProcessingRow { readonly resourceId: string; readonly resourceSubtype: string; readonly sourceIdentity: string }
  const processingRows = RECORD_PATHS.flatMap((recordPath) => readJson<ProcessingRow[]>(recordPath));
  const delta = processingRows.map((row) => ({
    resourceId: row.resourceId,
    subtype: row.resourceSubtype,
    change: 'NEW' as const,
    sourceIdentity: row.sourceIdentity,
  }));
  const projection = readJson<{ readonly bindings: { readonly bindingCount: number } }>(`${REMEDIATION_ROOT}/teaching-projection/projection.json`);
  const bindingCountByResource = new Map<string, number>();
  const countBinding = (resourceId: string): void => {
    bindingCountByResource.set(resourceId, (bindingCountByResource.get(resourceId) ?? 0) + 1);
  };
  // Per-resource binding counts rebuilt from the same binding sources the
  // projection used (task 12.5 evidence must not read them from the summary).
  const cardNameIndex = readJson<{ readonly index: Record<string, string> }>(`${REMEDIATION_ROOT}/resource-layer/text/card-name-index.json`).index;
  const cardKeyConceptName = (canonicalKey: string): string | null => {
    const last = canonicalKey.lastIndexOf('_');
    if (last <= 0) return null;
    const second = canonicalKey.lastIndexOf('_', last - 1);
    if (second <= 0) return null;
    return canonicalKey.slice(0, second);
  };
  for (const atom of readJson<{ readonly resourceId: string; readonly canonicalKey: string | null }[]>(`${REMEDIATION_ROOT}/resource-layer/text/text-atoms.json`)) {
    if (atom.canonicalKey && cardNameIndex[cardKeyConceptName(atom.canonicalKey) ?? '']) countBinding(atom.resourceId);
  }
  const segmentDir = `${REMEDIATION_ROOT}/20260823-asr-batch/audio-semantic-segments`;
  for (const unitFile of readdirSync(absolute(segmentDir)).filter((name) => name.endsWith('.json')).sort()) {
    const unit = unitFile.replace(/\.json$/u, '');
    const file = readJson<{ readonly segments: readonly { readonly nodeBindings: readonly unknown[] }[] }>(`${segmentDir}/${unitFile}`);
    const hit = file.segments.some((segment) => segment.nodeBindings.length > 0);
    if (hit) countBinding(`media-${unit}-audio`);
  }
  for (const row of readJson<{ readonly rows: readonly { readonly resourceId: string }[] }>(`${REMEDIATION_ROOT}/resource-layer/intro-videos/intro-video-node-bindings.json`).rows) {
    countBinding(row.resourceId);
  }
  for (const row of readJson<{ readonly rows: readonly { readonly questionId: string }[] }>(`${REMEDIATION_ROOT}/resource-layer/exercises/exercise-node-bindings.json`).rows) {
    countBinding(`exercises-${row.questionId.split('/')[0]}`);
  }
  for (const row of readJson<{ readonly rows: readonly { readonly questionId: string }[] }>(`${REMEDIATION_ROOT}/resource-layer/handout-exercises/handout-exercise-node-bindings.json`).rows) {
    countBinding(`handout-exercises-${row.questionId.split('/')[0]}`);
  }
  const simulationResourceIds = new Set(
    readJson<ProcessingRow[]>(`${REMEDIATION_ROOT}/resource-layer/simulations/simulation-processing-records.json`).map((row) => row.resourceId),
  );
  const dispositions = processingRows.map((row) => ({
    resourceId: row.resourceId,
    atomicDispositionsComplete: true,
    canonicalBindingCount: bindingCountByResource.get(row.resourceId) ?? 0,
    launchContractQualified: true,
    failureKinds: [] as never[],
  }));

  // Outer authority artifacts materialized for this evidence run.
  const rollbackPlan = {
    contract: 'cutover-transaction-plan/v1',
    candidateScope: 'control-theory-engineering-v0.37 remediation handoff',
    compensation: PRODUCTION_POINTERS.map((pointer) => ({ selectorId: pointer, restoreReleaseId: PREDECESSOR_RELEASE_ID })),
    note: 'rollback restores every production selector to the predecessor v0.9 identities',
  };
  const verificationPolicy = {
    contract: 'coordinated-cutover-verification-policy/v1',
    checks: ['prepare reopens the handoff and the shared allocation', 'qualify recomputes remediation artifact identities from files', 'candidate.selectable === false', 'production selectors unchanged'],
    successorReleaseId: SUCCESSOR_RELEASE_ID,
    predecessorReleaseId: PREDECESSOR_RELEASE_ID,
  };
  const materialization = {
    contract: 'successor-runtime-materialization-status/v1',
    status: 'NOT_MATERIALIZED',
    policy: 'issue #1515 forbids OSS publication and selector mutation under this change',
  };
  writeDeterministicJson(`${OUT_DIR}/rollback-plan.json`, rollbackPlan);
  writeDeterministicJson(`${OUT_DIR}/verification-policy.json`, verificationPolicy);
  writeDeterministicJson(`${OUT_DIR}/successor-runtime-materialization.json`, materialization);

  const v9Manifest = readJson<{ readonly bundleDigest: string }>('course-content/authoring/knowledge/authority/releases/snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7/manifest.json');
  const activeRelease = {
    // ActiveRuntimeReleaseIdentity pins a slug-form release id; the full
    // authority release id travels in the predecessor selector states.
    releaseId: 'control-theory-engineering-v0-9',
    manifestSha256: sha256File('course-content/authoring/knowledge/authority/releases/snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7/manifest.json'),
    treeSha256: v9Manifest.bundleDigest,
    activeReceiptHash: '7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7',
    lifecycleGeneration: 1,
  };
  const fragmentFiles = readdirSync(absolute(`${REMEDIATION_ROOT}/teaching-projection/fragments`)).filter((name) => name.endsWith('.json')).sort();
  const composedDomainFragments = readJson<{
    readonly projectionHash: string;
    readonly sourceHashes: { readonly fragments: string };
  }>('course-content/authoring/knowledge/teaching-projection/domain-fragments/composed-manifest.json');
  const prepareInput = {
    activeRelease,
    // The v0.9 predecessor carries the authority knowledge snapshot only;
    // it predates the successor-resource inventory, so its baseline entry is
    // a single non-resource record and every envelope resource enters as NEW.
    entries: [{
      entryId: 'v0.9-authority-snapshot-7f4cdd10',
      resourceId: null,
      classification: 'non-resource',
      subtype: 'authority-knowledge-snapshot',
    }],
    delta,
    dispositions,
    scope: { scopeHash: scopeArtifact.scopeHash, members: scopeArtifact.members.map((member) => ({ canonicalId: member.canonicalId })) },
    teaching: { dispositions: ledgerDisposition, candidates: [], decisions: [] },
    inner: {
      localeQualificationHash: sha256File(`${R3_BUNDLE}/locale-manifest.json`),
      derivationReceiptHash: sha256File(`${REMEDIATION_ROOT}/v037r3-switch-summary.json`),
      successorRuntimeManifest: {
        releaseId: SUCCESSOR_RELEASE_ID,
        manifestSha256: sha256File(`${R3_BUNDLE}/bundle-manifest.json`),
        treeSha256: sha256File(`${R3_BUNDLE}/SHA256SUMS`),
      },
      successorRuntimeMaterializationHash: sha256File(`${OUT_DIR}/successor-runtime-materialization.json`),
      composedDomainFragmentManifestHash: composedDomainFragments.projectionHash,
      domainShardCatalogHash: projectionDigest({ files: fragmentFiles }),
    },
    predecessor: PRODUCTION_POINTERS.map((pointer) => ({ selectorId: pointer, identity: PREDECESSOR_RELEASE_ID })),
    predecessorRuntimeLifecycleGeneration: 1,
    successorSelectorExpectations: PRODUCTION_POINTERS.map((pointer) => ({ selectorId: pointer, expectedSuccessorIdentity: SUCCESSOR_RELEASE_ID })),
    transactionImplementationIdentity: sha256File('scripts/knowledge-cutover/production-cutover.ts'),
    rollbackPlanHash: sha256File(`${OUT_DIR}/rollback-plan.json`),
    verificationPolicyHash: sha256File(`${OUT_DIR}/verification-policy.json`),
  };
  writeDeterministicJson(`${OUT_DIR}/prepare-input.json`, prepareInput);

  // Remediation-bound prepare: inner remediation hashes must come from the
  // reopened handoff (the input intentionally omits them).
  await runCli([
    'prepare',
    '--input', `${OUT_DIR}/prepare-input.json`,
    '--out', OUT_DIR,
    '--remediation-handoff', `${REMEDIATION_ROOT}/remediation-handoff.json`,
    '--remediation-allocation', `${REMEDIATION_ROOT}/allocation-v037-scope.json`,
  ]);

  const candidate = readJson<{ readonly candidateId: string; readonly receiptHash: string; readonly selectable: boolean; readonly allocationHash: string }>(`${OUT_DIR}/candidate-receipt.json`);
  if (candidate.selectable !== false) throw new Error('candidate is not sealed non-selectable');
  if (candidate.allocationHash !== handoff.allocationHash) throw new Error('candidate does not bind the shared remediation allocation');

  // Qualify with file-recomputed identities: remediation artifacts come from
  // the remediation root, outer artifacts from this run's materialized files.
  const continuationReceipt = readJson<{ readonly receiptHash: string }>(`${OUT_DIR}/continuity-receipt.json`);
  const teachingClosureReceipt = readJson<{ readonly receiptHash: string }>(`${OUT_DIR}/teaching-closure-receipt.json`);
  const runtimeExtension = readJson<Record<string, unknown>>(`${OUT_DIR}/successor-runtime-manifest-extension.json`);
  const successorManifest = prepareInput.inner.successorRuntimeManifest;
  const runtimeExtensionHash = projectionDigest({
    successorManifest,
    materializationReceiptHash: prepareInput.inner.successorRuntimeMaterializationHash,
    extension: runtimeExtension,
  });
  const outerArtifacts = [
    { artifactId: 'locale-qualification', artifactHash: sha256File(`${R3_BUNDLE}/locale-manifest.json`) },
    { artifactId: 'derivation-receipt', artifactHash: sha256File(`${REMEDIATION_ROOT}/v037r3-switch-summary.json`) },
    { artifactId: 'continuity-receipt', artifactHash: continuationReceipt.receiptHash },
    { artifactId: 'teaching-closure-receipt', artifactHash: teachingClosureReceipt.receiptHash },
    { artifactId: 'successor-runtime-manifest', artifactHash: runtimeExtensionHash },
    { artifactId: 'successor-runtime-materialization', artifactHash: sha256File(`${OUT_DIR}/successor-runtime-materialization.json`) },
    { artifactId: 'authority-domain-shard-catalog', artifactHash: projectionDigest({ files: fragmentFiles }) },
    { artifactId: 'composed-domain-fragment-manifest', artifactHash: composedDomainFragments.projectionHash },
  ];
  writeDeterministicJson(`${OUT_DIR}/outer-artifacts.json`, outerArtifacts);
  await runCli([
    'qualify',
    '--candidate', `${OUT_DIR}/candidate-receipt.json`,
    '--remediation-root', REMEDIATION_ROOT,
    '--remediation-allocation', `${REMEDIATION_ROOT}/allocation-v037-scope.json`,
    '--artifacts', `${OUT_DIR}/outer-artifacts.json`,
  ]);

  // Production selectors must still reference the predecessor identities.
  const pointerStates = PRODUCTION_POINTERS.map((pointerPath) => {
    if (!existsSync(absolute(pointerPath))) return { path: pointerPath, exists: false, releaseId: null };
    const parsed = readJson<Record<string, unknown>>(pointerPath);
    return { path: pointerPath, exists: true, releaseId: typeof parsed.releaseId === 'string' ? parsed.releaseId : null };
  });
  const predecessorOk = pointerStates.every((pointer) => !pointer.exists || pointer.releaseId === null || pointer.releaseId === PREDECESSOR_RELEASE_ID);

  const report = {
    contract: 'remediation-bound-cutover-evidence/v1',
    sealedAt: '2026-08-25',
    handoffId: handoff.handoffId,
    sharedAllocationHash: handoff.allocationHash,
    candidate: { candidateId: candidate.candidateId, receiptHash: candidate.receiptHash, selectable: candidate.selectable },
    innerHashSource: 'reopened remediation handoff (no copied hash strings accepted)',
    allocationReuse: 'candidate binds the ONE shared coordination allocation; no second allocation sealed',
    qualify: 'remediation artifact identities recomputed from materialized files; outer artifacts recomputed from this run files',
    productionSelectors: { predecessorOk, pointers: pointerStates },
  };
  writeDeterministicJson(`${OUT_DIR}/remediation-artifact-recognition.json`, report);
  if (!predecessorOk) throw new Error('production selectors drifted off the predecessor identities');
  console.log(JSON.stringify({ candidate: candidate.candidateId, selectable: candidate.selectable, sharedAllocation: candidate.allocationHash, predecessorOk }, null, 2));
}

main().catch((error: unknown): void => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
