#!/usr/bin/env tsx
/** Replay the nine covered-domain relation closures against the v0.37 scope. */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { ActTeachingScope } from '@/lib/act-canonical-teaching-relations/contracts';
import { assertScopeIntegrity } from '@/lib/act-canonical-teaching-relations/scope';
import type {
  PendingRelationRow,
  RelationFamily,
} from '@/lib/formal-resource-remediation/relations/pipeline';
import {
  applyCourseOwnerDecisions,
  runRelationPipeline,
  sealCourseOwnerDecision,
} from '@/lib/formal-resource-remediation/relations/pipeline';
import { reopenScopeArtifact } from '@/lib/formal-resource-remediation/relations/scope';
import type { RemediationAllocation } from '@/lib/formal-resource-remediation/allocation';
import { reopenRemediationAllocation } from '@/lib/formal-resource-remediation/allocation';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const SCOPE_PATH = 'course-content/authoring/knowledge/teaching-projection/act-relations/ctr-release-control-theory-engineering-v0.37/scope.json';
const PENDING_PATH = 'course-content/authoring/knowledge/teaching-projection/act-relations/ctr-release-control-theory-engineering-v0.37/pending.jsonl';
const ALLOCATION_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/allocation-v037-scope.json';
const OLD_SCOPE_PATH = 'course-content/authoring/knowledge/teaching-projection/act-relations/ctr-release-control-theory-engineering-v0.22/scope.json';
const OLD_ALLOCATION_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/v037-allocation.json';
const REMEDIATION_ROOT = 'course-content/authoring/knowledge/formal-resource-remediation';
const AUTHOR = 'course-owner-yongwei';
const FAMILIES = ['containment', 'prerequisite', 'association'] as const;
const DOMAINS = [
  'root-locus',
  'robustness-sensitivity-analysis',
  'stability-analysis',
  'nonlinear-system-analysis',
  'time-domain-analysis',
  'system-modeling',
  'classical-control-design',
  'frequency-domain-analysis',
  'state-space-control-analysis-and-design',
] as const;

type Domain = (typeof DOMAINS)[number];

interface RawDecision {
  readonly canonicalId: string;
  readonly class: string;
  readonly sameAs?: string | null;
  readonly containment: string;
  readonly prerequisite: string;
  readonly association: string;
  readonly evidenceRefs: readonly string[];
  readonly rationale: string;
}

interface OldReceipt {
  readonly sealedAt: string;
  readonly domain: string;
  readonly packId: string;
  readonly packRows: number;
  readonly totalDecisions: number;
  readonly unresolvedAfter: number;
  readonly outcomeCounts: Record<string, number>;
  readonly outcomes: readonly unknown[];
  readonly droppedInvalidIds?: number;
  readonly closureComplete: boolean;
}

interface SourceSpec {
  readonly path: string;
  readonly kind: 'jsonl' | 'stability-log';
}

const SOURCES: Record<Domain, SourceSpec> = {
  'root-locus': { path: '/tmp/remediation-run/review/root-locus-round2.jsonl', kind: 'jsonl' },
  'robustness-sensitivity-analysis': { path: '/tmp/remediation-run/review/rsa-round1.jsonl', kind: 'jsonl' },
  'nonlinear-system-analysis': { path: '/tmp/remediation-run/review/nsa2.jsonl', kind: 'jsonl' },
  'time-domain-analysis': { path: '/tmp/remediation-run/review/time-domain-analysis-review.jsonl', kind: 'jsonl' },
  'system-modeling': { path: '/tmp/remediation-run/review/system-modeling-review.jsonl', kind: 'jsonl' },
  'classical-control-design': { path: '/tmp/remediation-run/review/classical-control-design-review.jsonl', kind: 'jsonl' },
  'frequency-domain-analysis': { path: '/tmp/remediation-run/review/frequency-domain-analysis-review.jsonl', kind: 'jsonl' },
  'state-space-control-analysis-and-design': { path: '/tmp/remediation-run/review/state-space-control-analysis-and-design-review.jsonl', kind: 'jsonl' },
  'stability-analysis': { path: '/tmp/remediation-run/review/stability-analysis-review.log', kind: 'stability-log' },
};

function absolute(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function sha256File(filePath: string): string {
  return sha256Bytes(readFileSync(absolute(filePath)));
}

function writeImmutableBytes(filePath: string, content: Buffer): 'created' | 'skipped' {
  const target = absolute(filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    const existing = readFileSync(target);
    if (!existing.equals(content)) throw new Error(`refusing to overwrite immutable artifact ${target}`);
    return 'skipped';
  }
  writeFileSync(target, content);
  return 'created';
}

function writeImmutableJson(filePath: string, value: unknown): 'created' | 'skipped' {
  return writeImmutableBytes(filePath, Buffer.from(`${JSON.stringify(value, null, 1)}\n`));
}

function parseJsonl(bytes: Uint8Array): RawDecision[] {
  return Buffer.from(bytes)
    .toString('utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RawDecision);
}

function recoverStabilityDecisionBytes(sourceBytes: Buffer): {
  readonly bytes: Buffer;
  readonly recovery: Record<string, unknown>;
} {
  const source = sourceBytes.toString('utf8');
  const separator = source.indexOf('\n{"type"');
  const envelopeText = separator > 0 ? source.slice(0, separator) : source;
  const envelope = JSON.parse(envelopeText) as { readonly result?: unknown };
  if (typeof envelope.result !== 'string') throw new Error('stability log has no result field');
  const matches = envelope.result.match(/```jsonl\s*\n([\s\S]*?)\n```/gu) ?? [];
  if (matches.length !== 1) throw new Error(`stability log must contain exactly one jsonl fence, got ${matches.length}`);
  const match = /```jsonl\s*\n([\s\S]*?)\n```/u.exec(envelope.result);
  if (!match?.[1]) throw new Error('stability jsonl fence is empty');
  const lines = match[1].split('\n').filter((line) => line.trim().length > 0);
  const bytes = Buffer.from(`${lines.join('\n')}\n`);
  return {
    bytes,
    recovery: {
      sourceFormat: 'use-codex-wrapper-json-with-markdown-jsonl-fence',
      resultFieldPresent: true,
      jsonlFenceCount: matches.length,
      extractedRowCount: lines.length,
      extractedSha256: sha256Bytes(bytes),
    },
  };
}

function loadAndStoreDecisions(domain: Domain): {
  readonly rows: readonly RawDecision[];
  readonly sourceSha256: string;
  readonly decisionsSha256: string;
  readonly recovery?: Record<string, unknown>;
} {
  const sourceSpec = SOURCES[domain];
  const sourceBytes = readFileSync(absolute(sourceSpec.path));
  const recovered = sourceSpec.kind === 'stability-log'
    ? recoverStabilityDecisionBytes(sourceBytes)
    : { bytes: sourceBytes, recovery: undefined };
  const decisionPath = `${REMEDIATION_ROOT}/${domain}-closure/decisions.jsonl`;
  writeImmutableBytes(decisionPath, recovered.bytes);
  const rows = parseJsonl(recovered.bytes);
  if (rows.length === 0 || rows.some((row) => !row.canonicalId)) {
    throw new Error(`${domain} decision record contains no valid rows`);
  }
  const ids = new Set(rows.map((row) => row.canonicalId));
  if (ids.size !== rows.length) throw new Error(`${domain} decisions contain duplicate canonical ids`);
  for (const row of rows) {
    if (!Array.isArray(row.evidenceRefs) || row.evidenceRefs.length === 0) {
      throw new Error(`${domain}/${row.canonicalId} has no evidenceRefs`);
    }
    for (const family of FAMILIES) {
      const target = row[family];
      if (typeof target !== 'string' || target.length === 0) throw new Error(`${domain}/${row.canonicalId}/${family} has no decision`);
      if (target !== 'NO_RELATION' && target !== 'COURSE_ROOT' && !target.includes(':')) {
        throw new Error(`${domain}/${row.canonicalId}/${family} has an invalid target ${target}`);
      }
    }
  }
  return {
    rows,
    sourceSha256: sha256Bytes(sourceBytes),
    decisionsSha256: sha256Bytes(recovered.bytes),
    recovery: recovered.recovery,
  };
}

function assertCountsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => (left[key] ?? 0) === (right[key] ?? 0));
}

function loadScopeAndAllocation(): {
  readonly scope: ActTeachingScope;
  readonly pendingRows: readonly PendingRelationRow[];
  readonly allocation: RemediationAllocation;
  readonly oldScope: ActTeachingScope;
} {
  const scopeArtifact = readJson<ActTeachingScope & { readonly memberCount: number }>(SCOPE_PATH);
  const reopened = {
    ...reopenScopeArtifact({
      courseId: 'act-control-theory',
      scope: scopeArtifact,
      expectedAuthorityReleaseId: 'ctr:release:control-theory-engineering-v0.37',
      expectedAuthoritySnapshotHash: 'cc73fa150a94fb0a3891c4b5d26eba9ca190f28334782a974333016f734fea39',
    }),
  };
  if (reopened.memberCount !== 7476) throw new Error(`reopened v0.37 scope has ${reopened.memberCount} members`);
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
  const pendingRows = readFileSync(absolute(PENDING_PATH), 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as PendingRelationRow);
  if (pendingRows.length !== 22428 || pendingRows.some((row) => row.scopeHash !== scope.scopeHash)) {
    throw new Error('v0.37 pending ledger is not 7476×3 or has scope-hash drift');
  }
  const allocation = readJson<RemediationAllocation>(ALLOCATION_PATH);
  reopenRemediationAllocation(allocation);
  if (allocation.scopeHash !== scope.scopeHash) throw new Error('allocation and v0.37 scope hashes differ');
  return { scope, pendingRows, allocation, oldScope: readJson<ActTeachingScope>(OLD_SCOPE_PATH) };
}

function decisionTarget(row: RawDecision, family: RelationFamily): string {
  return row[family];
}

function edgeEndpointCounts(rows: readonly RawDecision[]): {
  readonly count: number;
  readonly byFamily: Record<RelationFamily, number>;
  readonly courseRootCount: number;
} {
  const byFamily: Record<RelationFamily, number> = {
    containment: 0,
    prerequisite: 0,
    association: 0,
  };
  let courseRootCount = 0;
  for (const row of rows) {
    for (const family of FAMILIES) {
      const target = decisionTarget(row, family);
      if (target === 'COURSE_ROOT') courseRootCount += 1;
      if (target !== 'NO_RELATION' && target !== 'COURSE_ROOT') byFamily[family] += 1;
    }
  }
  return {
    count: Object.values(byFamily).reduce((sum, value) => sum + value, 0),
    byFamily,
    courseRootCount,
  };
}

function buildFinalLedger(
  domain: Domain,
  allocationHash: string,
  packRows: readonly { readonly canonicalId: string; readonly family: RelationFamily }[],
  rawById: ReadonlyMap<string, RawDecision>,
): {
  readonly contract: 'remediation-three-family-final-ledger/v1';
  readonly domain: Domain;
  readonly allocationHash: string;
  readonly rows: readonly Record<string, unknown>[];
} {
  const rows = packRows.map((packRow) => {
    const raw = rawById.get(packRow.canonicalId);
    if (!raw) throw new Error(`missing ${domain} decision for ${packRow.canonicalId}`);
    const target = decisionTarget(raw, packRow.family);
    const evidenceRefs = [...raw.evidenceRefs];
    if (target === 'NO_RELATION') {
      return { canonicalId: raw.canonicalId, family: packRow.family, disposition: 'NO_RELATION', target: null, evidenceRefs, edgeId: null };
    }
    if (target === 'COURSE_ROOT') {
      return { canonicalId: raw.canonicalId, family: packRow.family, disposition: 'COURSE_ROOT', target: null, evidenceRefs, edgeId: null };
    }
    if (!target.includes(':')) throw new Error(`invalid final-ledger target ${target}`);
    return {
      canonicalId: raw.canonicalId,
      family: packRow.family,
      disposition: 'PUBLISHED_EDGE',
      target,
      evidenceRefs,
      edgeId: projectionDigest({ allocationHash, source: raw.canonicalId, family: packRow.family, target, evidenceRefs }),
    };
  });
  return { contract: 'remediation-three-family-final-ledger/v1', domain, allocationHash, rows };
}

function replayOne(
  domain: Domain,
  inputs: ReturnType<typeof loadScopeAndAllocation>,
): Record<string, unknown> {
  const raw = loadAndStoreDecisions(domain);
  const oldReceipt = readJson<OldReceipt>(`${REMEDIATION_ROOT}/${domain}-closure/closure-receipt.json`);
  const rawIds = new Set(raw.rows.map((row) => row.canonicalId));
  const oldIds = new Set(oldReceipt.outcomes.map((outcome) => (outcome as { canonicalId: string }).canonicalId));
  if (raw.rows.length * 3 !== oldReceipt.packRows || rawIds.size !== oldReceipt.packRows / 3) {
    throw new Error(`${domain} decision rows do not reconcile with old receipt packRows`);
  }
  if (rawIds.size !== oldIds.size || [...rawIds].some((id) => !oldIds.has(id))) {
    throw new Error(`${domain} decision member set differs from old sealed receipt`);
  }
  const selectedMembers = inputs.scope.members.filter((member) => rawIds.has(member.canonicalId));
  if (selectedMembers.length !== rawIds.size || selectedMembers.some((member) => member.preferredDomainId !== domain)) {
    throw new Error(`${domain} decision members are not an exact covered-domain subset of v0.37 scope`);
  }
  const selectedIds = new Set(selectedMembers.map((member) => member.canonicalId));
  const pendingRows = inputs.pendingRows.filter((row) => selectedIds.has(row.canonicalId));
  const domainScope = { ...inputs.scope, members: selectedMembers, memberCount: selectedMembers.length };
  const pipeline = runRelationPipeline({ scope: domainScope, pendingRows, evidenceRegistry: null });
  const pack = pipeline.reviewPacks.find((candidate) => candidate.domainId === domain);
  if (!pack || pack.rows.length !== oldReceipt.packRows) throw new Error(`${domain} v0.37 replay pack does not reconcile`);
  const rawById = new Map(raw.rows.map((row) => [row.canonicalId, row]));
  const decidedAt = oldReceipt.sealedAt.includes('T') ? oldReceipt.sealedAt : `${oldReceipt.sealedAt}T00:00:00.000Z`;
  const decisions = pack.rows.map((row) => {
    const source = rawById.get(row.canonicalId);
    if (!source) throw new Error(`missing raw decision ${domain}/${row.canonicalId}`);
    const target = decisionTarget(source, row.family);
    return sealCourseOwnerDecision({
      allocationHash: inputs.allocation.allocationHash,
      reviewPackId: pack.packId,
      canonicalId: row.canonicalId,
      family: row.family,
      decision: target === 'NO_RELATION' ? 'no-relation' : 'accept',
      decidedBy: AUTHOR,
      decidedAt,
      evidenceRefs: source.evidenceRefs,
      rationale: `[${source.class}] ${source.rationale}`,
      replacementDigest: null,
    });
  });
  const applied = applyCourseOwnerDecisions({
    scope: domainScope,
    reviewPacks: [pack],
    decisions,
    evidenceRegistry: { registryId: `decisions:${domain}`, knows: (ref) => ref.startsWith('src:') },
    expectedCourseOwnerId: inputs.allocation.remediation.courseOwnerId,
    expectedAllocationHash: inputs.allocation.allocationHash,
  });
  if (applied.unresolvedAfterApplication !== 0) throw new Error(`${domain} replay has unresolved rows`);
  const counts: Record<string, number> = { PUBLISHED_EDGE: 0, NO_RELATION: 0, COURSE_ROOT: 0, REJECTED: 0 };
  for (const outcome of applied.outcomes) counts[outcome.finalDisposition.kind] += 1;
  if (!assertCountsEqual(counts, oldReceipt.outcomeCounts)) {
    throw new Error(`${domain} successor outcomeCounts differ from old receipt`);
  }
  const finalLedger = buildFinalLedger(domain, inputs.allocation.allocationHash, pack.rows, rawById);
  const ledgerPath = `${REMEDIATION_ROOT}/${domain}-closure/final-ledger.json`;
  writeImmutableJson(ledgerPath, finalLedger);
  const endpoints = edgeEndpointCounts(raw.rows);
  const provenance = {
    contract: 'remediation-decision-record-provenance/v1',
    domain,
    sourceAbsolutePath: SOURCES[domain].path,
    sourceSha256: raw.sourceSha256,
    rowCount: raw.rows.length,
    memberCount: rawIds.size,
    edgeCount: endpoints.count,
    receiptReconciliation: {
      packRows: pack.rows.length,
      publishedEdgeInReceipt: oldReceipt.outcomeCounts.PUBLISHED_EDGE ?? 0,
      jsonlEdgeCount: endpoints.count,
      match: pack.rows.length === oldReceipt.packRows
        && (oldReceipt.outcomeCounts.PUBLISHED_EDGE ?? 0) === endpoints.count + endpoints.courseRootCount,
      ...(endpoints.courseRootCount > 0 ? { courseRootCount: endpoints.courseRootCount } : {}),
    },
    ...(raw.recovery ? { recovery: raw.recovery } : {}),
    ...(domain === 'nonlinear-system-analysis' ? {
      superseded: {
        sourceAbsolutePath: '/tmp/remediation-run/review/nsa-round1.jsonl',
        rowCount: 20,
        proposedEdgeCount: 7,
        reason: 'The 20-row truncated fragment proposed seven edges; the complete nsa2 re-review has zero gap and supersedes those proposals.',
      },
    } : {}),
  };
  const provenancePath = `${REMEDIATION_ROOT}/${domain}-closure/decisions-provenance.json`;
  writeImmutableJson(provenancePath, provenance);
  const oldReceiptSha256 = sha256File(`${REMEDIATION_ROOT}/${domain}-closure/closure-receipt.json`);
  const successorReceipt = {
    ...oldReceipt,
    allocationHash: inputs.allocation.allocationHash,
    supersedes: { sha256: oldReceiptSha256 },
    decisionsProvenanceSha256: sha256File(provenancePath),
    edgeEndpoints: endpoints.count,
    edgeEndpointsByFamily: endpoints.byFamily,
    droppedInvalidIds: 0,
    unresolvedAfter: applied.unresolvedAfterApplication,
    closureComplete: applied.unresolvedAfterApplication === 0,
    outcomeCounts: counts,
    outcomes: applied.outcomes,
  };
  const receiptPath = `${REMEDIATION_ROOT}/${domain}-closure/successor-closure-receipt.json`;
  writeImmutableJson(receiptPath, successorReceipt);
  return {
    domain,
    memberCount: rawIds.size,
    packRows: pack.rows.length,
    rowCount: finalLedger.rows.length,
    edgeCount: endpoints.count,
    outcomeCounts: counts,
    oldOutcomeCounts: oldReceipt.outcomeCounts,
    outcomeCountsMatch: assertCountsEqual(counts, oldReceipt.outcomeCounts),
    unresolvedAfter: applied.unresolvedAfterApplication,
    closureComplete: successorReceipt.closureComplete,
    droppedInvalidIds: 0,
    decisionsSha256: raw.decisionsSha256,
    decisionsProvenanceSha256: sha256File(provenancePath),
    successorReceiptSha256: sha256File(receiptPath),
    finalLedgerSha256: sha256File(ledgerPath),
    oldReceiptSha256,
    edgeEndpoints: endpoints,
  };
}

function writeSummary(
  inputs: ReturnType<typeof loadScopeAndAllocation>,
  domains: readonly Record<string, unknown>[],
): void {
  const oldAllocation = readJson<{ readonly allocationHash: string }>(OLD_ALLOCATION_PATH);
  const summary = {
    contract: 'remediation-domain-replay-summary/v1',
    allocation: {
      oldAllocationHash: oldAllocation.allocationHash,
      newAllocationHash: inputs.allocation.allocationHash,
      allocationArtifactSha256: sha256File(ALLOCATION_PATH),
    },
    scope: {
      scopeHash: inputs.scope.scopeHash,
      memberCount: inputs.scope.members.length,
      scopeArtifactSha256: sha256File(SCOPE_PATH),
      pendingRowCount: inputs.pendingRows.length,
      pendingArtifactSha256: sha256File(PENDING_PATH),
    },
    domains,
    consistency: {
      domainCount: domains.length,
      replayedMemberCount: domains.reduce((sum, row) => sum + Number(row.memberCount), 0),
      replayedRowCount: domains.reduce((sum, row) => sum + Number(row.rowCount), 0),
      deferredNewMemberCount: 176,
      allUnresolvedZero: domains.every((row) => row.unresolvedAfter === 0),
      allClosureComplete: domains.every((row) => row.closureComplete === true),
      allDroppedInvalidIdsZero: domains.every((row) => row.droppedInvalidIds === 0),
      allOutcomeCountsMatch: domains.every((row) => row.outcomeCountsMatch === true),
      allNonNsaOutcomeCountsMatch: domains.filter((row) => row.domain !== 'nonlinear-system-analysis').every((row) => row.outcomeCountsMatch === true),
      nsaPublishedEdgeCount: Number(domains.find((row) => row.domain === 'nonlinear-system-analysis')?.outcomeCounts && (domains.find((row) => row.domain === 'nonlinear-system-analysis')?.outcomeCounts as Record<string, number>).PUBLISHED_EDGE),
      nonSelectable: true,
    },
  };
  writeImmutableJson(`${REMEDIATION_ROOT}/replay-summary.json`, summary);
}

function main(): void {
  const requested = process.argv[2];
  const domains = requested && requested !== '--all' ? [requested as Domain] : [...DOMAINS];
  if (domains.some((domain) => !DOMAINS.includes(domain))) throw new Error(`unsupported domain: ${requested}`);
  const inputs = loadScopeAndAllocation();
  const results = domains.map((domain) => replayOne(domain, inputs));
  if (domains.length === DOMAINS.length) writeSummary(inputs, results);
  console.log(JSON.stringify({ scopeHash: inputs.scope.scopeHash, allocationHash: inputs.allocation.allocationHash, domains: results }, null, 2));
}

main();
