#!/usr/bin/env tsx
/**
 * Task families 11.1/11.3 and 12.1/12.2 (#1515): reopen the sealed
 * remediation candidate end-to-end from the shared allocation, recompute
 * every identity from the materialized files, verify the production
 * selectors still reference the predecessor identities, and seal the
 * non-selectable handoff manifest.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { ActTeachingScope } from '@/lib/act-canonical-teaching-relations/contracts';
import { assertScopeIntegrity } from '@/lib/act-canonical-teaching-relations/scope';
import type { RemediationAllocation } from '@/lib/formal-resource-remediation/allocation';
import { reopenRemediationAllocation } from '@/lib/formal-resource-remediation/allocation';
import {
  reopenResourceEnvelope,
  type RemediationResourceEnvelope,
} from '@/lib/formal-resource-remediation/envelope';
import {
  deriveProjectionCompleteness,
  validateRemediationTeachingProjection,
  type FinalLedgerProjectionRow,
  type ProjectionBindingRow,
  type ProjectionEdgeRow,
} from '@/lib/formal-resource-remediation/projection';
import { reopenScopeArtifact } from '@/lib/formal-resource-remediation/relations/scope';
import type { ResourceProcessingRecord } from '@/lib/formal-resource-remediation/contracts';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const SCOPE_PATH = 'course-content/authoring/knowledge/teaching-projection/act-relations/ctr-release-control-theory-engineering-v0.37/scope.json';
const ALLOCATION_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/allocation-v037-scope.json';
const REMEDIATION_ROOT = 'course-content/authoring/knowledge/formal-resource-remediation';
const ENVELOPE_PATH = `${REMEDIATION_ROOT}/resource-envelope.json`;
const PROJECTION_DIR = `${REMEDIATION_ROOT}/teaching-projection`;
const HANDOFF_PATH = `${REMEDIATION_ROOT}/remediation-handoff.json`;
const REPORT_PATH = `${REMEDIATION_ROOT}/end-to-end-verification-report.json`;
const EXCLUDED_DOMAINS = ['robust-control-analysis-and-design', 'discrete-time-control-analysis', 'discrete-time-control-design', 'optimal-control-foundations-and-linear-quadratic-design', 'lyapunov-stability', 'nonlinear-control-design'] as const;
const COVERED_DOMAINS = ['root-locus', 'robustness-sensitivity-analysis', 'stability-analysis', 'nonlinear-system-analysis', 'time-domain-analysis', 'system-modeling', 'classical-control-design', 'frequency-domain-analysis', 'state-space-control-analysis-and-design'] as const;
const ALL_DOMAINS: readonly string[] = [...COVERED_DOMAINS, ...EXCLUDED_DOMAINS];
const PRODUCTION_POINTERS = [
  'course-content/authoring/knowledge/authority/current.json',
  'course-content/runtime/knowledge/projection/current.json',
  'course-content/runtime/knowledge/prerequisites/current.json',
  'course-content/runtime/knowledge/authority-domain-catalog/current.json',
  'course-content/runtime/knowledge/authority-domain-shards/current.json',
  'course-content/runtime/knowledge/consumer-activation/current.json',
  'course-content/runtime/knowledge/production-cutover-transactions/current.json',
];
const PREDECESSOR_RELEASE_ID = 'ctr:release:control-theory-engineering-v0.9';
const SEALED_AT = '2026-08-24T20:30:00.000Z';

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

function main(): void {
  const checks: { name: string; passed: boolean; detail: string }[] = [];
  const check = (name: string, passed: boolean, detail: string): void => {
    checks.push({ name, passed, detail });
    if (!passed) throw new Error(`end-to-end verification failed at ${name}: ${detail}`);
  };

  // 1. Shared allocation and scope reopen from sealed files.
  const allocation = readJson<RemediationAllocation>(ALLOCATION_PATH);
  reopenRemediationAllocation(allocation);
  const scopeArtifact = readJson<ActTeachingScope & { readonly memberCount: number }>(SCOPE_PATH);
  const reopened = reopenScopeArtifact({
    courseId: 'act-control-theory',
    scope: scopeArtifact,
    expectedAuthorityReleaseId: 'ctr:release:control-theory-engineering-v0.37',
    expectedAuthoritySnapshotHash: 'cc73fa150a94fb0a3891c4b5d26eba9ca190f28334782a974333016f734fea39',
  });
  const scope: ActTeachingScope = {
    contract: scopeArtifact.contract,
    courseId: scopeArtifact.courseId,
    authority: scopeArtifact.authority,
    catalog: scopeArtifact.catalog,
    contractVersion: scopeArtifact.contractVersion,
    members: reopened.members,
    memberIds: reopened.members.map((member) => member.canonicalId),
    scopeHash: reopened.scopeHash,
  };
  assertScopeIntegrity(scope);
  check('scope-reopen', reopened.memberCount === 7476 && allocation.scopeHash === scope.scopeHash, `scope ${scope.scopeHash.slice(0, 8)} / ${reopened.memberCount} members matches the allocation`);

  // 2. Resource envelope reopen with artifact hash recomputation.
  const envelope = readJson<RemediationResourceEnvelope>(ENVELOPE_PATH);
  const recordPaths = [
    `${REMEDIATION_ROOT}/resource-layer/text/text-processing-records.json`,
    `${REMEDIATION_ROOT}/20260823-asr-batch/asr-processing-records.json`,
    `${REMEDIATION_ROOT}/resource-layer/exercises/exercise-processing-records.json`,
    `${REMEDIATION_ROOT}/resource-layer/intro-videos/intro-video-processing-records.json`,
    `${REMEDIATION_ROOT}/resource-layer/simulations/simulation-processing-records.json`,
    `${REMEDIATION_ROOT}/resource-layer/handout-exercises/handout-exercise-processing-records.json`,
  ];
  const processingRecords = recordPaths.flatMap((recordPath) => readJson<ResourceProcessingRecord[]>(recordPath));
  const envelopeReopen = reopenResourceEnvelope({
    envelope,
    processingRecords,
    artifactSha256: (artifactPath) => sha256File(artifactPath),
  });
  check('envelope-reopen', envelopeReopen.state === 'SEALED', `envelope ${envelope.envelopeHash.slice(0, 8)} reopens over ${processingRecords.length} records and ${envelope.artifacts.length} artifacts`);

  // 3. Three-family closure reopen: fifteen ledgers against the total receipt.
  const totalReceipt = readJson<{
    readonly allocationHash: string;
    readonly memberCount: number;
    readonly rowCount: number;
    readonly unresolved: number;
    readonly publishedEdges: number;
    readonly closureComplete: boolean;
    readonly perDomain: readonly { readonly domain: string; readonly members: number; readonly rows: number; readonly publishedEdges: number; readonly complete: boolean }[];
  }>(`${REMEDIATION_ROOT}/total-closure-receipt.json`);
  const conservation = readJson<{ readonly ledgerRowCount: number; readonly duplicates: number; readonly missingRowCount: number; readonly targetsOutsideScopeCount: number }>(`${REMEDIATION_ROOT}/total-conservation-check.json`);
  const ledgerByDomain = new Map<string, readonly FinalLedgerProjectionRow[]>();
  let ledgerRowCount = 0;
  const seen = new Map<string, number>();
  const memberIds = new Set(scope.memberIds);
  for (const domain of ALL_DOMAINS) {
    const ledger = readJson<{ readonly rows: readonly FinalLedgerProjectionRow[] }>(`${REMEDIATION_ROOT}/${domain}-closure/final-ledger.json`);
    ledgerByDomain.set(domain, ledger.rows);
    ledgerRowCount += ledger.rows.length;
    for (const row of ledger.rows) {
      const key = `${row.canonicalId}\u0000${row.family}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  let duplicates = 0;
  for (const count of seen.values()) if (count !== 1) duplicates += 1;
  let missingRowCount = 0;
  for (const memberId of memberIds) {
    for (const family of ['containment', 'prerequisite', 'association'] as const) {
      if (!seen.has(`${memberId}\u0000${family}`)) missingRowCount += 1;
    }
  }
  const perDomainMatch = totalReceipt.perDomain.every((row) => ledgerByDomain.get(row.domain)?.length === row.rows);
  check(
    'closure-reopen',
    ledgerRowCount === totalReceipt.rowCount && ledgerRowCount === 22428 && duplicates === 0 && missingRowCount === 0 && perDomainMatch && totalReceipt.unresolved === 0 && totalReceipt.closureComplete,
    `15 ledgers ${ledgerRowCount} rows reconcile with the total receipt; duplicates ${duplicates}, missing ${missingRowCount}`,
  );

  // 4. Projection, fragments, and consumers reopen from the same identity.
  const projection = readJson<{
    readonly projectionHash: string;
    readonly allocationHash: string;
    readonly scopeHash: string;
    readonly envelopeHash: string;
    readonly membership: { readonly memberCount: number; readonly coveredMemberCount: number; readonly excludedMemberCount: number };
    readonly relations: { readonly edgeCount: number; readonly courseRootCount: number };
    readonly zeroResourceNodes: { readonly count: number };
    readonly limitations: readonly string[];
  }>(`${PROJECTION_DIR}/projection.json`);
  const members = scope.members.map((member) => ({
    canonicalId: member.canonicalId,
    domain: member.preferredDomainId,
    excluded: (EXCLUDED_DOMAINS as readonly string[]).includes(member.preferredDomainId),
  }));
  const domainByMember = new Map(members.map((member) => [member.canonicalId, member.domain]));
  const edges: ProjectionEdgeRow[] = [];
  const bindings: ProjectionBindingRow[] = [];
  const coveredMemberIds = new Set(members.filter((member) => !member.excluded).map((member) => member.canonicalId));
  for (const [domain, rows] of ledgerByDomain) {
    for (const row of rows) {
      if (row.disposition === 'NO_RELATION') continue;
      edges.push({
        source: row.canonicalId,
        family: row.family,
        target: row.target,
        kind: row.disposition === 'COURSE_ROOT' ? 'COURSE_ROOT' : 'PUBLISHED_EDGE',
        edgeId: row.edgeId,
        domain: domainByMember.get(row.canonicalId) ?? domain,
      });
    }
  }
  // Rebuild the modality-independent bindings from the envelope sources.
  const cardNameIndex = readJson<{ readonly index: Record<string, string> }>(`${REMEDIATION_ROOT}/resource-layer/text/card-name-index.json`).index;
  const cardKeyConceptName = (canonicalKey: string): string | null => {
    const last = canonicalKey.lastIndexOf('_');
    if (last <= 0) return null;
    const second = canonicalKey.lastIndexOf('_', last - 1);
    if (second <= 0) return null;
    return canonicalKey.slice(0, second);
  };
  for (const atom of readJson<{ readonly atomId: string; readonly resourceId: string; readonly canonicalKey: string | null }[]>(`${REMEDIATION_ROOT}/resource-layer/text/text-atoms.json`)) {
    if (!atom.canonicalKey) continue;
    const canonicalId = cardNameIndex[cardKeyConceptName(atom.canonicalKey) ?? ''];
    if (canonicalId && coveredMemberIds.has(canonicalId)) {
      bindings.push({ modality: 'card', resourceId: atom.resourceId, anchorId: atom.atomId, canonicalId, evidence: 'card-name-index:crosswalk-exact-name' });
    }
  }
  const segmentDir = `${REMEDIATION_ROOT}/20260823-asr-batch/audio-semantic-segments`;
  for (const unitName of readdirSync(absolute(segmentDir)).filter((name) => name.endsWith('.json')).sort()) {
    const unit = unitName.replace(/\.json$/u, '');
    const file = readJson<{ readonly segments: readonly { readonly nodeBindings: readonly { readonly canonicalId: string }[] }[] }>(`${segmentDir}/${unitName}`);
    file.segments.forEach((segment, index) => {
      for (const binding of segment.nodeBindings) {
        if (!coveredMemberIds.has(binding.canonicalId)) continue;
        bindings.push({ modality: 'audio', resourceId: `audio-${unit}`, anchorId: `${unit}-seg-${index + 1}`, canonicalId: binding.canonicalId, evidence: 'term-overlap-binding-model:modality-independent' });
      }
    });
  }
  const introVideoBindingsFile = readJson<{ readonly rows: readonly { readonly atomId: string; readonly resourceId: string; readonly canonicalId: string }[] }>(`${REMEDIATION_ROOT}/resource-layer/intro-videos/intro-video-node-bindings.json`);
  for (const row of introVideoBindingsFile.rows) {
    if (!coveredMemberIds.has(row.canonicalId)) continue;
    bindings.push({ modality: 'intro-video', resourceId: row.resourceId, anchorId: row.atomId, canonicalId: row.canonicalId, evidence: 'term-overlap-binding-model:modality-independent' });
  }
  const exerciseBindingsFile = readJson<{ readonly rows: readonly { readonly questionId: string; readonly canonicalId: string }[] }>(`${REMEDIATION_ROOT}/resource-layer/exercises/exercise-node-bindings.json`);
  for (const row of exerciseBindingsFile.rows) {
    if (!coveredMemberIds.has(row.canonicalId)) continue;
    bindings.push({ modality: 'exercise', resourceId: `exercises-${row.questionId.split('/')[0]}`, anchorId: row.questionId, canonicalId: row.canonicalId, evidence: 'codex-semantic-mapping:round1+round2' });
  }
  const handoutExerciseBindingsFile = readJson<{ readonly rows: readonly { readonly questionId: string; readonly canonicalId: string }[] }>(`${REMEDIATION_ROOT}/resource-layer/handout-exercises/handout-exercise-node-bindings.json`);
  for (const row of handoutExerciseBindingsFile.rows) {
    if (!coveredMemberIds.has(row.canonicalId)) continue;
    bindings.push({ modality: 'exercise', resourceId: `handout-exercises-${row.questionId.split('/')[0]}`, anchorId: row.questionId, canonicalId: row.canonicalId, evidence: 'codex-semantic-mapping:round2-layered' });
  }
  const projectionValid = validateRemediationTeachingProjection({
    projection: projection as never,
    members,
    edges,
    bindings,
    envelope,
    closure: { memberCount: totalReceipt.memberCount, rowCount: totalReceipt.rowCount, publishedEdges: totalReceipt.publishedEdges },
  });
  check('projection-validate', projectionValid.length === 0, `materialized projection passes validation with zero findings (${edges.length} edges, ${bindings.length} bindings reopened)`);

  const completeness = deriveProjectionCompleteness({
    reopenedScope: { scopeHash: scope.scopeHash, memberCount: reopened.memberCount },
    reopenedEnvelope: { state: envelopeReopen.state, envelope },
    closure: {
      allocationHash: totalReceipt.allocationHash,
      memberCount: totalReceipt.memberCount,
      rowCount: totalReceipt.rowCount,
      unresolved: totalReceipt.unresolved,
      closureComplete: totalReceipt.closureComplete,
      domainReceiptCount: totalReceipt.perDomain.length,
    },
    conservation: { ledgerRowCount, duplicates, missingRowCount },
    allocationHash: allocation.allocationHash,
    projection: projection as never,
  });
  check('projection-complete', completeness.state === 'COMPLETE', 'derived projection state recomputes to COMPLETE');

  const fragmentFiles = readdirSync(absolute(`${PROJECTION_DIR}/fragments`)).filter((name) => name.endsWith('.json')).sort();
  const fragmentsHash = projectionDigest({ files: fragmentFiles.map((name) => [name, sha256File(`${PROJECTION_DIR}/fragments/${name}`)]) });
  const fragmentIdentityOk = fragmentFiles.every((name) => {
    const fragment = readJson<{ readonly projectionHash: string }>(`${PROJECTION_DIR}/fragments/${name}`);
    return fragment.projectionHash === projection.projectionHash;
  });
  check('fragments-identity', fragmentFiles.length === 15 && fragmentIdentityOk, `15 fragments all bind projection ${projection.projectionHash.slice(0, 8)}`);
  const graphView = readJson<{ readonly projectionHash: string }>(`${PROJECTION_DIR}/consumers/graph-view.json`);
  const prerequisite = readJson<{ readonly projectionHash: string }>(`${PROJECTION_DIR}/consumers/prerequisite-publication.json`);
  const consumersHash = projectionDigest({ graph: sha256File(`${PROJECTION_DIR}/consumers/graph-view.json`), prerequisite: sha256File(`${PROJECTION_DIR}/consumers/prerequisite-publication.json`) });
  check('consumers-identity', graphView.projectionHash === projection.projectionHash && prerequisite.projectionHash === projection.projectionHash, 'graph and prerequisite consumers bind the same projection identity');

  // 5. Production selectors stay on the predecessor identities (task 12.2).
  const pointerStates = PRODUCTION_POINTERS.map((pointerPath) => {
    if (!existsSync(absolute(pointerPath))) return { path: pointerPath, exists: false, releaseId: null, sha256: null };
    const parsed = readJson<Record<string, unknown>>(pointerPath);
    const releaseId = typeof parsed.releaseId === 'string' ? parsed.releaseId : null;
    return { path: pointerPath, exists: true, releaseId, sha256: sha256File(pointerPath) };
  });
  const predecessorOk = pointerStates
    .filter((pointer) => pointer.exists && pointer.releaseId !== null)
    .every((pointer) => pointer.releaseId === PREDECESSOR_RELEASE_ID);
  check(
    'production-predecessor',
    predecessorOk && pointerStates.every((pointer) => !pointer.exists || pointer.releaseId === null || pointer.releaseId === PREDECESSOR_RELEASE_ID),
    `all existing production pointers reference ${PREDECESSOR_RELEASE_ID}; remediation candidate is non-selectable`,
  );

  // 6. Seal the non-selectable handoff manifest (task 12.1).
  const denominatorHash = projectionDigest({
    resourceCount: envelope.resourceCount,
    atomCount: envelope.atomCount,
    subtypes: envelope.subtypes,
  });
  const reportsHash = projectionDigest({
    conservation: sha256File(`${REMEDIATION_ROOT}/total-conservation-check.json`),
    validationReport: sha256File(`${PROJECTION_DIR}/projection-validation-report.json`),
  });
  const handoffBody = {
    contract: 'remediation-handoff-manifest/v1' as const,
    builderVersion: 'formal-resource-remediation-builder/v1' as const,
    handoffId: '',
    sealedAt: SEALED_AT,
    selectable: false as const,
    allocationHash: allocation.allocationHash,
    authorityCaptureHash: scope.authority?.snapshotHash ?? scope.scopeHash,
    denominatorHash,
    resourceEnvelopeHash: envelope.envelopeHash,
    closureReceiptHash: sha256File(`${REMEDIATION_ROOT}/total-closure-receipt.json`),
    teachingProjectionHash: projection.projectionHash,
    prerequisitePublicationHash: sha256File(`${PROJECTION_DIR}/consumers/prerequisite-publication.json`),
    domainFragmentsHash: fragmentsHash,
    domainShardsHash: fragmentsHash,
    consumerProjectionsHash: consumersHash,
    processorRegistryHash: sha256File(`${REMEDIATION_ROOT}/20260823-asr-batch/processor-registry.json`),
    reportsHash,
    notes: [
      'domain fragments currently also serve the shard/overlay role: excluded members carry in-fragment excluded flags and zero-resource markers',
      'exercise and intro-video subtypes remain explicitly limited in the envelope; see resource-envelope.json limitations',
    ],
  };
  const handoffHash = projectionDigest({ ...handoffBody, handoffId: 'pending' });
  const handoffId = `handoff-${handoffHash.slice(0, 24)}`;
  const handoff = { ...handoffBody, handoffId, handoffHash };
  const handoffState = writeDeterministicJson(HANDOFF_PATH, handoff);

  const report = {
    contract: 'remediation-end-to-end-verification-report/v1' as const,
    sealedAt: SEALED_AT,
    allocationHash: allocation.allocationHash,
    scopeHash: scope.scopeHash,
    checks,
    derivedProjectionState: completeness.state,
    counts: {
      members: totalReceipt.memberCount,
      closureRows: ledgerRowCount,
      publishedEdges: totalReceipt.publishedEdges,
      resources: envelope.resourceCount,
      atoms: envelope.atomCount,
      fragments: fragmentFiles.length,
    },
    productionPointers: pointerStates,
    handoff: { handoffId, handoffHash, selectable: false, state: handoffState },
  };
  const reportState = writeDeterministicJson(REPORT_PATH, report);
  console.log(JSON.stringify({ state: completeness.state, checks: checks.length, allPassed: checks.every((one) => one.passed), counts: report.counts, handoff: report.handoff, reportState }, null, 2));
}

main();
