#!/usr/bin/env tsx
/**
 * W2: finalize the v0.37 total three-family closure across all fifteen domains
 * (#1515). Merges the nine covered-domain decision records with the 162
 * v0.37 new-member decisions, closes the six domain-level excluded domains
 * from the owner D1 ruling, and derives the total closure receipt from the
 * fifteen per-domain final receipts.
 */

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
const REMEDIATION_ROOT = 'course-content/authoring/knowledge/formal-resource-remediation';
const ASSIGNMENT_DIR = `${REMEDIATION_ROOT}/v037-new-member-domain-assignment`;
const REVIEW_162_PATH = '/tmp/remediation-run/review/v037-covered-162-review.jsonl';
const EXCLUDED_DECISIONS_PATH = `${REMEDIATION_ROOT}/excluded-domains-decisions.jsonl`;
const EXCLUDED_LEDGER_PATH = `${REMEDIATION_ROOT}/excluded-domains-ledger.json`;
const TOTAL_RECEIPT_PATH = `${REMEDIATION_ROOT}/total-closure-receipt.json`;
const CONSERVATION_PATH = `${REMEDIATION_ROOT}/total-conservation-check.json`;
const AUTHOR = 'course-owner-yongwei';
const FAMILIES = ['containment', 'prerequisite', 'association'] as const;
const COVERED_DOMAINS = [
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
const EXCLUDED_DOMAINS = [
  'robust-control-analysis-and-design',
  'discrete-time-control-analysis',
  'discrete-time-control-design',
  'optimal-control-foundations-and-linear-quadratic-design',
  'lyapunov-stability',
  'nonlinear-control-design',
] as const;
const ALL_DOMAINS = [...COVERED_DOMAINS, ...EXCLUDED_DOMAINS] as const;
type Domain = (typeof ALL_DOMAINS)[number];
// The 162 review sealed at 2026-08-24T18:49 local (review-14 continuation log).
const NEW_MEMBER_DECIDED_AT = '2026-08-24T18:49:00.000Z';
// Owner D1 domain-scope ruling recorded 2026-08-23.
const EXCLUDED_DECIDED_AT = '2026-08-23T00:00:00.000Z';
const EXCLUDED_EVIDENCE_REFS = [
  'src:docs/remediation-1515/handout-coverage-decision.md#裁决一',
  'src:course-content/syllabus-refactor/blueprint.md',
] as const;
const EXCLUDED_RATIONALE = '域级排除：课程负责人裁决课程不涵盖该域';
const SEALED_AT = '2026-08-25T02:30:00.000Z';

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

interface AssignmentRow {
  readonly canonicalId: string;
  readonly domainId: Domain;
  readonly class: string;
  readonly rationale: string;
}

interface SuccessorReceipt {
  readonly sealedAt: string;
  readonly domain: string;
  readonly packRows: number;
  readonly unresolvedAfter: number;
  readonly outcomeCounts: Record<string, number>;
  readonly outcomes: readonly { readonly canonicalId: string }[];
  readonly closureComplete: boolean;
}

interface LedgerRow {
  readonly canonicalId: string;
  readonly family: RelationFamily;
  readonly disposition: 'PUBLISHED_EDGE' | 'NO_RELATION' | 'COURSE_ROOT';
  readonly target: string | null;
  readonly evidenceRefs: readonly string[];
  readonly edgeId: string | null;
}

interface FinalLedger {
  readonly contract: 'remediation-three-family-final-ledger/v1';
  readonly domain: Domain;
  readonly allocationHash: string;
  readonly rows: readonly LedgerRow[];
}

interface EdgeEndpoints {
  readonly count: number;
  readonly byFamily: Record<RelationFamily, number>;
  readonly courseRootCount: number;
}

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

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 1)}\n`);
}

function writeImmutableBytes(filePath: string, content: Buffer): 'created' | 'skipped' {
  const target = absolute(filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (!readFileSync(target).equals(content)) throw new Error(`refusing to overwrite immutable artifact ${target}`);
    return 'skipped';
  }
  writeFileSync(target, content);
  return 'created';
}

function writeImmutableJson(filePath: string, value: unknown): 'created' | 'skipped' {
  return writeImmutableBytes(filePath, jsonBytes(value));
}

/**
 * Final ledgers exist from the W1 replay with old members only; W2 upgrades
 * them once to the merged version. Anything else (mismatched contract,
 * domain, allocation, or an unknown old shape) fails closed.
 */
function upgradeFinalLedger(filePath: string, merged: FinalLedger, oldMemberIds: ReadonlySet<string>): 'created' | 'skipped' | 'upgraded' {
  const target = absolute(filePath);
  const bytes = jsonBytes(merged);
  if (!existsSync(target)) {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    return 'created';
  }
  const existing = readFileSync(target);
  if (existing.equals(bytes)) return 'skipped';
  const parsed = JSON.parse(existing.toString('utf8')) as FinalLedger;
  const isOldShape = parsed.contract === merged.contract
    && parsed.domain === merged.domain
    && parsed.allocationHash === merged.allocationHash
    && parsed.rows.length === oldMemberIds.size * 3
    && parsed.rows.every((row) => oldMemberIds.has(row.canonicalId));
  if (!isOldShape) throw new Error(`refusing to upgrade ${target}: existing artifact is not the W1 old-member ledger`);
  writeFileSync(target, bytes);
  return 'upgraded';
}

function parseJsonl<T>(bytes: Uint8Array): readonly T[] {
  return Buffer.from(bytes)
    .toString('utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function decisionTarget(row: RawDecision, family: RelationFamily): string {
  return row[family];
}

function validateRawDecisions(rows: readonly RawDecision[], label: string): void {
  if (rows.length === 0 || rows.some((row) => !row.canonicalId)) {
    throw new Error(`${label} decision record contains no valid rows`);
  }
  const ids = new Set(rows.map((row) => row.canonicalId));
  if (ids.size !== rows.length) throw new Error(`${label} decisions contain duplicate canonical ids`);
  for (const row of rows) {
    if (!Array.isArray(row.evidenceRefs) || row.evidenceRefs.length === 0) {
      throw new Error(`${label}/${row.canonicalId} has no evidenceRefs`);
    }
    for (const family of FAMILIES) {
      const target = decisionTarget(row, family);
      if (typeof target !== 'string' || target.length === 0) throw new Error(`${label}/${row.canonicalId}/${family} has no decision`);
      if (target !== 'NO_RELATION' && target !== 'COURSE_ROOT' && !target.includes(':')) {
        throw new Error(`${label}/${row.canonicalId}/${family} has an invalid target ${target}`);
      }
    }
  }
}

function edgeEndpointCounts(rows: readonly RawDecision[]): EdgeEndpoints {
  const byFamily: Record<RelationFamily, number> = { containment: 0, prerequisite: 0, association: 0 };
  let courseRootCount = 0;
  for (const row of rows) {
    for (const family of FAMILIES) {
      const target = decisionTarget(row, family);
      if (target === 'COURSE_ROOT') courseRootCount += 1;
      if (target !== 'NO_RELATION' && target !== 'COURSE_ROOT') byFamily[family] += 1;
    }
  }
  return { count: Object.values(byFamily).reduce((sum, value) => sum + value, 0), byFamily, courseRootCount };
}

function classCounts(rows: readonly RawDecision[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.class] = (counts[row.class] ?? 0) + 1;
  return counts;
}

function loadInputs(): {
  readonly scope: ActTeachingScope;
  readonly pendingRows: readonly PendingRelationRow[];
  readonly allocation: RemediationAllocation;
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
  return { scope, pendingRows, allocation };
}

function evidenceRegistryFor(label: string) {
  return { registryId: `decisions:${label}`, knows: (ref: string) => ref.startsWith('src:') };
}

/** Stage A (W2-1): store the 162 covered-domain new-member decisions verbatim. */
function storeNewMemberDecisions(scope: ActTeachingScope): {
  readonly rows: readonly RawDecision[];
  readonly assignmentsByDomain: ReadonlyMap<Domain, readonly string[]>;
} {
  const sourceBytes = readFileSync(absolute(REVIEW_162_PATH));
  const rows = parseJsonl<RawDecision>(sourceBytes);
  validateRawDecisions(rows, 'v037-new-member');
  if (rows.length !== 162) throw new Error(`expected 162 new-member review rows, got ${rows.length}`);
  const scopeIds = new Set(scope.memberIds);
  for (const row of rows) {
    if (!scopeIds.has(row.canonicalId)) throw new Error(`new member ${row.canonicalId} is not in the v0.37 scope`);
    for (const family of FAMILIES) {
      const target = decisionTarget(row, family);
      if (target !== 'NO_RELATION' && target !== 'COURSE_ROOT' && !scopeIds.has(target)) {
        throw new Error(`new-member edge target ${target} is not in the v0.37 scope`);
      }
    }
  }
  const assignments = parseJsonl<AssignmentRow>(readFileSync(absolute(`${ASSIGNMENT_DIR}/assignments.jsonl`)));
  if (assignments.length !== 176) throw new Error(`expected 176 assignment rows, got ${assignments.length}`);
  const assignmentById = new Map(assignments.map((row) => [row.canonicalId, row]));
  const reviewIds = new Set(rows.map((row) => row.canonicalId));
  const coveredAssignmentIds = new Set(assignments.filter((row) => (COVERED_DOMAINS as readonly string[]).includes(row.domainId)).map((row) => row.canonicalId));
  const excludedAssignmentIds = assignments
    .filter((row) => (EXCLUDED_DOMAINS as readonly string[]).includes(row.domainId))
    .map((row) => row.canonicalId);
  if (coveredAssignmentIds.size !== 162 || reviewIds.size !== 162 || ![...coveredAssignmentIds].every((id) => reviewIds.has(id))) {
    throw new Error('covered assignment members and 162 review rows do not reconcile one-to-one');
  }
  if (excludedAssignmentIds.length !== 14) throw new Error(`expected 14 excluded-domain assignments, got ${excludedAssignmentIds.length}`);
  const assignmentsByDomain = new Map<Domain, readonly string[]>();
  for (const row of assignments) {
    if ((EXCLUDED_DOMAINS as readonly string[]).includes(row.domainId)) continue;
    const bucket = assignmentsByDomain.get(row.domainId) ?? [];
    assignmentsByDomain.set(row.domainId, [...bucket, row.canonicalId]);
  }
  const endpoints = edgeEndpointCounts(rows);
  const edgesByDomain: Record<string, number> = {};
  for (const row of rows) {
    const domain = assignmentById.get(row.canonicalId)?.domainId;
    if (!domain) throw new Error(`assignment missing for reviewed member ${row.canonicalId}`);
    const domainEdges = FAMILIES.filter((family) => decisionTarget(row, family) !== 'NO_RELATION').length;
    if (domainEdges > 0) edgesByDomain[domain] = (edgesByDomain[domain] ?? 0) + domainEdges;
  }
  const decisionsBytes = Buffer.from(`${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
  const decisionsState = writeImmutableBytes(`${ASSIGNMENT_DIR}/decisions.jsonl`, decisionsBytes);
  const provenance = {
    contract: 'remediation-v037-new-member-decision-provenance/v1',
    sealedAt: SEALED_AT,
    sourceAbsolutePath: REVIEW_162_PATH,
    sourceSha256: sha256Bytes(sourceBytes),
    decisionsSha256: sha256Bytes(decisionsBytes),
    reviewIdentity: 'codex act:issue-1515:review-14 continuation (gpt-5.6-sol, medium), 162/162 verified, targets validated against crosswalk-v037',
    rowCount: rows.length,
    classCounts: classCounts(rows),
    edgeCount: endpoints.count,
    edgesByDomain,
    assignmentReconciliation: {
      totalAssignments: assignments.length,
      coveredMembers: coveredAssignmentIds.size,
      reviewRows: rows.length,
      excludedMembers: excludedAssignmentIds.length,
      oneToOne: true,
    },
    allTargetsInScope: true,
  };
  const provenanceState = writeImmutableJson(`${ASSIGNMENT_DIR}/decisions-provenance.json`, provenance);
  return { rows, assignmentsByDomain };
}

/**
 * Stage B (W2-2): enumerate every member of the six excluded domains from
 * the v0.37 scope and emit the domain-level exclusion ledger plus its
 * decision stream.
 */
function buildExclusionLedger(
  scope: ActTeachingScope,
  allocation: RemediationAllocation,
): readonly RawDecision[] {
  const membersByDomain = new Map<Domain, readonly { readonly canonicalId: string }[]>();
  for (const domain of EXCLUDED_DOMAINS) {
    membersByDomain.set(domain, scope.members.filter((member) => member.preferredDomainId === domain));
  }
  const ledgerRows: {
    readonly canonicalId: string;
    readonly domainId: Domain;
    readonly family: RelationFamily;
    readonly disposition: 'NO_RELATION';
    readonly evidenceRefs: readonly string[];
    readonly rationale: string;
  }[] = [];
  const decisions: RawDecision[] = [];
  for (const domain of EXCLUDED_DOMAINS) {
    const members = membersByDomain.get(domain);
    if (!members) throw new Error(`excluded domain ${domain} has no member bucket`);
    for (const member of members) {
      decisions.push({
        canonicalId: member.canonicalId,
        class: 'C-domain-excluded',
        sameAs: null,
        containment: 'NO_RELATION',
        prerequisite: 'NO_RELATION',
        association: 'NO_RELATION',
        evidenceRefs: [...EXCLUDED_EVIDENCE_REFS],
        rationale: EXCLUDED_RATIONALE,
      });
      for (const family of FAMILIES) {
        ledgerRows.push({
          canonicalId: member.canonicalId,
          domainId: domain,
          family,
          disposition: 'NO_RELATION',
          evidenceRefs: [...EXCLUDED_EVIDENCE_REFS],
          rationale: EXCLUDED_RATIONALE,
        });
      }
    }
  }
  const expectedMembers = scope.members.filter((member) => (EXCLUDED_DOMAINS as readonly string[]).includes(member.preferredDomainId));
  const decisionIds = new Set(decisions.map((row) => row.canonicalId));
  const expectedIds = new Set(expectedMembers.map((member) => member.canonicalId));
  if (decisionIds.size !== expectedIds.size || [...expectedIds].some((id) => !decisionIds.has(id))) {
    throw new Error('excluded-domain member enumeration differs from the v0.37 scope');
  }
  if (ledgerRows.length !== expectedMembers.length * 3) throw new Error('exclusion ledger row count is not members×3');
  const decisionsBytes = Buffer.from(`${decisions.map((row) => JSON.stringify(row)).join('\n')}\n`);
  const decisionsState = writeImmutableBytes(EXCLUDED_DECISIONS_PATH, decisionsBytes);
  const ledger = {
    contract: 'remediation-domain-level-exclusion-ledger/v1' as const,
    sealedAt: SEALED_AT,
    allocationHash: allocation.allocationHash,
    scopeHash: scope.scopeHash,
    ruling: {
      decisionDoc: 'docs/remediation-1515/handout-coverage-decision.md#裁决一',
      decidedAt: EXCLUDED_DECIDED_AT,
      decidedBy: AUTHOR,
      rationale: EXCLUDED_RATIONALE,
    },
    domains: EXCLUDED_DOMAINS.map((domain) => ({ domainId: domain, memberCount: membersByDomain.get(domain)?.length ?? 0 })),
    memberCount: expectedMembers.length,
    rowCount: ledgerRows.length,
    allNoRelation: ledgerRows.every((row) => row.disposition === 'NO_RELATION'),
    decisionsSha256: sha256Bytes(decisionsBytes),
    rows: ledgerRows,
  };
  const ledgerState = writeImmutableJson(EXCLUDED_LEDGER_PATH, ledger);
  console.log(JSON.stringify({
    stage: 'exclusion-ledger',
    decisionsState,
    ledgerState,
    members: expectedMembers.length,
    rows: ledgerRows.length,
    perDomain: ledger.domains,
  }, null, 2));
  return decisions;
}

interface DomainReplayResult {
  readonly domain: Domain;
  readonly memberCount: number;
  readonly rows: number;
  readonly publishedEdges: number;
  readonly newMemberContribution: { readonly members: number; readonly rows: number; readonly publishedEdges: number } | null;
  readonly unresolvedAfter: number;
  readonly closureComplete: boolean;
  readonly ledgerState: 'created' | 'skipped' | 'upgraded';
  readonly receiptState: 'created' | 'skipped';
  readonly receiptSha256: string;
  readonly ledgerSha256: string;
}

function domainPack(
  domain: Domain,
  inputs: ReturnType<typeof loadInputs>,
): {
  readonly memberIds: readonly string[];
  readonly pack: ReturnType<typeof runRelationPipeline>['reviewPacks'][number];
} {
  const members = inputs.scope.members.filter((member) => member.preferredDomainId === domain);
  if (members.length === 0) throw new Error(`domain ${domain} has no members in the v0.37 scope`);
  const memberIds = members.map((member) => member.canonicalId);
  const memberSet = new Set(memberIds);
  const domainScope = { ...inputs.scope, members, memberCount: members.length };
  const pipeline = runRelationPipeline({
    scope: domainScope,
    pendingRows: inputs.pendingRows.filter((row) => memberSet.has(row.canonicalId)),
    evidenceRegistry: null,
  });
  const pack = pipeline.reviewPacks.find((candidate) => candidate.domainId === domain);
  if (!pack) throw new Error(`pipeline produced no review pack for ${domain}`);
  if (pack.rows.length !== members.length * 3) throw new Error(`${domain} pack is not members×3`);
  return { memberIds, pack };
}

function buildFinalLedger(
  domain: Domain,
  allocationHash: string,
  packRows: readonly { readonly canonicalId: string; readonly family: RelationFamily }[],
  rawById: ReadonlyMap<string, RawDecision>,
): FinalLedger {
  const rows: LedgerRow[] = packRows.map((packRow) => {
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

function applyDomainDecisions(
  domain: Domain,
  inputs: ReturnType<typeof loadInputs>,
  pack: ReturnType<typeof runRelationPipeline>['reviewPacks'][number],
  memberIds: readonly string[],
  rawById: ReadonlyMap<string, RawDecision>,
  decidedAt: (canonicalId: string) => string,
): {
  readonly outcomeCounts: Record<string, number>;
  readonly unresolvedAfter: number;
  readonly publishedEdges: number;
} {
  const decisions = pack.rows.map((row) => {
    const source = rawById.get(row.canonicalId);
    if (!source) throw new Error(`missing ${domain} decision for ${row.canonicalId}`);
    const target = decisionTarget(source, row.family);
    return sealCourseOwnerDecision({
      allocationHash: inputs.allocation.allocationHash,
      reviewPackId: pack.packId,
      canonicalId: row.canonicalId,
      family: row.family,
      decision: target === 'NO_RELATION' ? 'no-relation' : 'accept',
      decidedBy: AUTHOR,
      decidedAt: decidedAt(row.canonicalId),
      evidenceRefs: source.evidenceRefs,
      rationale: `[${source.class}] ${source.rationale}`,
      replacementDigest: null,
    });
  });
  const memberSet = new Set(memberIds);
  const decidedIds = new Set(rawById.keys());
  if (decidedIds.size !== memberSet.size || [...memberSet].some((id) => !decidedIds.has(id))) {
    throw new Error(`${domain} decision member set differs from the scope domain members`);
  }
  const domainScope = {
    ...inputs.scope,
    members: inputs.scope.members.filter((member) => memberSet.has(member.canonicalId)),
    memberCount: memberSet.size,
  };
  const applied = applyCourseOwnerDecisions({
    scope: domainScope,
    reviewPacks: [pack],
    decisions,
    evidenceRegistry: evidenceRegistryFor(domain),
    expectedCourseOwnerId: inputs.allocation.remediation.courseOwnerId,
    expectedAllocationHash: inputs.allocation.allocationHash,
  });
  const counts: Record<string, number> = { PUBLISHED_EDGE: 0, NO_RELATION: 0, COURSE_ROOT: 0, REJECTED: 0 };
  for (const outcome of applied.outcomes) counts[outcome.finalDisposition.kind] += 1;
  return {
    outcomeCounts: counts,
    unresolvedAfter: applied.unresolvedAfterApplication,
    publishedEdges: counts.PUBLISHED_EDGE ?? 0,
  };
}

/** Stage C (W2-3): merged replay of one covered domain (old + new decisions). */
function replayCoveredDomain(
  domain: (typeof COVERED_DOMAINS)[number],
  inputs: ReturnType<typeof loadInputs>,
  newRows: readonly RawDecision[],
  newMemberIdsForDomain: readonly string[],
): DomainReplayResult {
  const { memberIds, pack } = domainPack(domain, inputs);
  const oldBytes = readFileSync(absolute(`${REMEDIATION_ROOT}/${domain}-closure/decisions.jsonl`));
  const oldRows = parseJsonl<RawDecision>(oldBytes);
  validateRawDecisions(oldRows, `${domain}/old`);
  const successor = readJson<SuccessorReceipt>(`${REMEDIATION_ROOT}/${domain}-closure/successor-closure-receipt.json`);
  const oldIds = new Set(oldRows.map((row) => row.canonicalId));
  const successorIds = new Set(successor.outcomes.map((outcome) => outcome.canonicalId));
  if (oldIds.size !== successorIds.size || [...oldIds].some((id) => !successorIds.has(id))) {
    throw new Error(`${domain} old decisions differ from the successor receipt member set`);
  }
  const newIdsForDomain = new Set(newMemberIdsForDomain);
  const domainNewRows = newRows.filter((row) => newIdsForDomain.has(row.canonicalId));
  if (domainNewRows.length !== newIdsForDomain.size) throw new Error(`${domain} new-member decisions are incomplete`);
  if ([...newIdsForDomain].some((id) => oldIds.has(id))) throw new Error(`${domain} new members overlap old members`);
  const memberSet = new Set(memberIds);
  if (memberSet.size !== oldIds.size + newIdsForDomain.size) {
    throw new Error(`${domain} merged decision set does not equal the scope domain members`);
  }
  if (![...oldIds].every((id) => memberSet.has(id)) || ![...newIdsForDomain].every((id) => memberSet.has(id))) {
    throw new Error(`${domain} merged decision ids fall outside the scope domain members`);
  }
  const rawById = new Map([...oldRows, ...domainNewRows].map((row) => [row.canonicalId, row]));
  const oldDecidedAt = successor.sealedAt.includes('T') ? successor.sealedAt : `${successor.sealedAt}T00:00:00.000Z`;
  const applied = applyDomainDecisions(domain, inputs, pack, memberIds, rawById, (canonicalId) => (
    newIdsForDomain.has(canonicalId) ? NEW_MEMBER_DECIDED_AT : oldDecidedAt
  ));
  if (applied.unresolvedAfter !== 0) throw new Error(`${domain} final replay has unresolved rows`);
  const oldPublishedEdges = successor.outcomeCounts.PUBLISHED_EDGE ?? 0;
  const newEndpoints = edgeEndpointCounts(domainNewRows);
  const newPublishedEdges = newEndpoints.count + newEndpoints.courseRootCount;
  if (applied.publishedEdges !== oldPublishedEdges + newPublishedEdges) {
    throw new Error(`${domain} published edges do not reconcile (old ${oldPublishedEdges} + new ${newPublishedEdges} != ${applied.publishedEdges})`);
  }
  const ledger = buildFinalLedger(domain, inputs.allocation.allocationHash, pack.rows, rawById);
  const ledgerPath = `${REMEDIATION_ROOT}/${domain}-closure/final-ledger.json`;
  const ledgerState = upgradeFinalLedger(ledgerPath, ledger, oldIds);
  const successorSha256 = sha256File(`${REMEDIATION_ROOT}/${domain}-closure/successor-closure-receipt.json`);
  const endpoints = edgeEndpointCounts([...oldRows, ...domainNewRows]);
  const receipt = {
    contract: 'remediation-final-closure-receipt/v1' as const,
    sealedAt: SEALED_AT,
    domain,
    allocationHash: inputs.allocation.allocationHash,
    scopeHash: inputs.scope.scopeHash,
    memberCount: memberSet.size,
    packRows: pack.rows.length,
    unresolvedAfter: applied.unresolvedAfter,
    outcomeCounts: applied.outcomeCounts,
    edgeEndpoints: endpoints,
    newMemberContribution: {
      members: domainNewRows.length,
      rows: domainNewRows.length * 3,
      publishedEdges: newPublishedEdges,
    },
    supersedes: { artifact: 'successor-closure-receipt.json', sha256: successorSha256 },
    decisionsProvenanceSha256: sha256File(`${REMEDIATION_ROOT}/${domain}-closure/decisions-provenance.json`),
    newMemberDecisionsProvenanceSha256: sha256File(`${ASSIGNMENT_DIR}/decisions-provenance.json`),
    closureComplete: applied.unresolvedAfter === 0 && pack.rows.length === memberSet.size * 3,
  };
  const receiptPath = `${REMEDIATION_ROOT}/${domain}-closure/final-closure-receipt.json`;
  const receiptState = writeImmutableJson(receiptPath, receipt);
  return {
    domain,
    memberCount: memberSet.size,
    rows: pack.rows.length,
    publishedEdges: applied.publishedEdges,
    newMemberContribution: receipt.newMemberContribution,
    unresolvedAfter: applied.unresolvedAfter,
    closureComplete: receipt.closureComplete,
    ledgerState,
    receiptState,
    receiptSha256: sha256File(receiptPath),
    ledgerSha256: sha256File(ledgerPath),
  };
}

/** Stage C (W2-4): close one excluded domain from the D1 ruling ledger. */
function replayExcludedDomain(
  domain: (typeof EXCLUDED_DOMAINS)[number],
  inputs: ReturnType<typeof loadInputs>,
  excludedDecisions: readonly RawDecision[],
): DomainReplayResult {
  const { memberIds, pack } = domainPack(domain, inputs);
  const domainIds = new Set(memberIds);
  const domainRows = excludedDecisions.filter((row) => domainIds.has(row.canonicalId));
  if (domainRows.length !== memberIds.length) throw new Error(`${domain} exclusion decisions are incomplete`);
  const rawById = new Map(domainRows.map((row) => [row.canonicalId, row]));
  const applied = applyDomainDecisions(domain, inputs, pack, memberIds, rawById, () => EXCLUDED_DECIDED_AT);
  if (applied.unresolvedAfter !== 0) throw new Error(`${domain} exclusion replay has unresolved rows`);
  if (applied.publishedEdges !== 0 || (applied.outcomeCounts.NO_RELATION ?? 0) !== memberIds.length * 3) {
    throw new Error(`${domain} exclusion replay is not a pure NO_RELATION closure`);
  }
  const ledger = buildFinalLedger(domain, inputs.allocation.allocationHash, pack.rows, rawById);
  const ledgerPath = `${REMEDIATION_ROOT}/${domain}-closure/final-ledger.json`;
  const ledgerState = upgradeFinalLedger(ledgerPath, ledger, new Set());
  const excludedLedgerSha256 = sha256File(EXCLUDED_LEDGER_PATH);
  const receipt = {
    contract: 'remediation-final-closure-receipt/v1' as const,
    sealedAt: SEALED_AT,
    domain,
    allocationHash: inputs.allocation.allocationHash,
    scopeHash: inputs.scope.scopeHash,
    memberCount: memberIds.length,
    packRows: pack.rows.length,
    unresolvedAfter: applied.unresolvedAfter,
    outcomeCounts: applied.outcomeCounts,
    edgeEndpoints: { count: 0, byFamily: { containment: 0, prerequisite: 0, association: 0 }, courseRootCount: 0 },
    domainRuling: {
      decisionDoc: 'docs/remediation-1515/handout-coverage-decision.md#裁决一',
      decidedAt: EXCLUDED_DECIDED_AT,
      decidedBy: AUTHOR,
      excludedDomainsLedgerSha256: excludedLedgerSha256,
    },
    closureComplete: applied.unresolvedAfter === 0 && pack.rows.length === memberIds.length * 3,
  };
  const receiptPath = `${REMEDIATION_ROOT}/${domain}-closure/final-closure-receipt.json`;
  const receiptState = writeImmutableJson(receiptPath, receipt);
  return {
    domain,
    memberCount: memberIds.length,
    rows: pack.rows.length,
    publishedEdges: 0,
    newMemberContribution: null,
    unresolvedAfter: applied.unresolvedAfter,
    closureComplete: receipt.closureComplete,
    ledgerState,
    receiptState,
    receiptSha256: sha256File(receiptPath),
    ledgerSha256: sha256File(ledgerPath),
  };
}

/** Stage D/E (W2-5/6): derive the total receipt and run global conservation. */
function finalizeTotal(
  inputs: ReturnType<typeof loadInputs>,
  results: readonly DomainReplayResult[],
): {
  readonly total: Record<string, unknown>;
  readonly conservation: Record<string, unknown>;
} {
  const perDomain = results.map((result) => ({
    domain: result.domain,
    members: result.memberCount,
    rows: result.rows,
    publishedEdges: result.publishedEdges,
    complete: result.closureComplete,
  }));
  const memberCount = perDomain.reduce((sum, row) => sum + row.members, 0);
  const rowCount = perDomain.reduce((sum, row) => sum + row.rows, 0);
  const publishedEdges = perDomain.reduce((sum, row) => sum + row.publishedEdges, 0);
  const unresolved = results.reduce((sum, row) => sum + row.unresolvedAfter, 0);
  const closureComplete = memberCount === 7476 && rowCount === 22428 && unresolved === 0
    && perDomain.length === 15 && perDomain.every((row) => row.complete);
  const total = {
    contract: 'remediation-total-closure-receipt/v1' as const,
    sealedAt: SEALED_AT,
    allocationHash: inputs.allocation.allocationHash,
    scopeHash: inputs.scope.scopeHash,
    memberCount,
    rowCount,
    unresolved,
    publishedEdges,
    perDomain,
    domainReceipts: results.map((result) => ({ domain: result.domain, sha256: result.receiptSha256 })),
    closureComplete,
  };

  // Global conservation: every scope member × family must be dispositioned
  // exactly once across the fifteen final ledgers.
  const seen = new Map<string, number>();
  const targetIds = new Set<string>();
  for (const result of results) {
    const ledger = readJson<FinalLedger>(`${REMEDIATION_ROOT}/${result.domain}-closure/final-ledger.json`);
    if (ledger.rows.length !== result.rows) throw new Error(`${result.domain} ledger rows differ from its receipt`);
    for (const row of ledger.rows) {
      const key = `${row.canonicalId}\u0000${row.family}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      if (row.target) targetIds.add(row.target);
    }
  }
  let duplicates = 0;
  let ledgerRowCount = 0;
  for (const [key, count] of seen) {
    ledgerRowCount += count;
    if (count !== 1) duplicates += 1;
    if (!key.includes('\u0000')) throw new Error(`malformed ledger conservation key: ${key.slice(0, 40)}`);
  }
  const scopeMemberIds = new Set(inputs.scope.memberIds);
  const missing: string[] = [];
  for (const memberId of scopeMemberIds) {
    for (const family of FAMILIES) {
      if (!seen.has(`${memberId}\u0000${family}`)) missing.push(`${memberId}/${family}`);
    }
  }
  const targetsOutsideScope = [...targetIds].filter((target) => !scopeMemberIds.has(target));
  const conservation = {
    contract: 'remediation-total-conservation-check/v1' as const,
    sealedAt: SEALED_AT,
    allocationHash: inputs.allocation.allocationHash,
    scopeMemberCount: scopeMemberIds.size,
    ledgerRowCount,
    expectedRowCount: 22428,
    duplicates,
    missingRowCount: missing.length,
    targetsOutsideScopeCount: targetsOutsideScope.length,
    publishedEdges,
    expectedPublishedEdges: 420,
    unresolved,
    conserved: ledgerRowCount === 22428 && duplicates === 0 && missing.length === 0 && targetsOutsideScope.length === 0,
  };
  if (!conservation.conserved || !closureComplete) {
    throw new Error(`total closure validation failed: ${JSON.stringify({ ...conservation, closureComplete })}`);
  }
  const totalState = writeImmutableJson(TOTAL_RECEIPT_PATH, total);
  const conservationState = writeImmutableJson(CONSERVATION_PATH, conservation);
  return { total: { ...total, totalState }, conservation: { ...conservation, conservationState } };
}

function main(): void {
  const inputs = loadInputs();
  const stageA = storeNewMemberDecisions(inputs.scope);
  console.log(JSON.stringify({ stage: 'new-member-decisions', rowCount: stageA.rows.length }, null, 2));
  const excludedDecisions = buildExclusionLedger(inputs.scope, inputs.allocation);
  const results: DomainReplayResult[] = [];
  for (const domain of COVERED_DOMAINS) {
    const newMemberIds = stageA.assignmentsByDomain.get(domain) ?? [];
    results.push(replayCoveredDomain(domain, inputs, stageA.rows, newMemberIds));
  }
  for (const domain of EXCLUDED_DOMAINS) {
    results.push(replayExcludedDomain(domain, inputs, excludedDecisions));
  }
  const { total, conservation } = finalizeTotal(inputs, results);
  console.log(JSON.stringify({
    stage: 'final',
    scopeHash: inputs.scope.scopeHash,
    allocationHash: inputs.allocation.allocationHash,
    domains: results.map((result) => ({
      domain: result.domain,
      members: result.memberCount,
      rows: result.rows,
      publishedEdges: result.publishedEdges,
      newMemberContribution: result.newMemberContribution,
      unresolvedAfter: result.unresolvedAfter,
      closureComplete: result.closureComplete,
      ledgerState: result.ledgerState,
      receiptState: result.receiptState,
    })),
    total,
    conservation,
  }, null, 2));
}

main();
