/**
 * Empty global cross-domain teaching fragment (#1374 / generation-3).
 *
 * Reviews collected boundary candidates and publishes no new ACT_TEACHING
 * edges. Semantic reseals may change only the explicit identity allowlist.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { REGISTERED_PEER_DOMAIN_IDS } from '@/lib/authority-domain-catalog/contracts';
import { projectionDigest } from '../hash';
import { buildDomainTeachingFragment } from './builder';
import { buildDomainCoverageReport } from './coverage';
import {
  assertDomainTeachingAuthorityEnvelope,
  authoritySelectionFromEnvelope,
} from './validate';
import type { DomainTeachingAuthorityEnvelope } from './contracts';
import type {
  DomainCoverageReportEntry,
  DomainTeachingFragment,
  DomainTeachingFragmentAuthoring,
} from './contracts';

export const CROSS_DOMAIN_SOURCE_CONTRACT =
  'act-cross-domain-teaching-source/v1' as const;
export const CROSS_DOMAIN_WORKLIST_CONTRACT =
  'act-cross-domain-teaching-worklist/v1' as const;
export const CROSS_DOMAIN_COVERAGE_CONTRACT =
  'act-cross-domain-teaching-coverage/v1' as const;
export const CROSS_DOMAIN_PIN_CONTRACT =
  'act-generation-3-upstream-pin/v1' as const;
export const CROSS_DOMAIN_CONVERSION_CONTRACT =
  'act-generation-3-conversion-protocol/v1' as const;
export const CROSS_DOMAIN_FRAGMENT_KEY = 'cross-domain-v1' as const;
export const CROSS_DOMAIN_FRAGMENT_VERSION = '1' as const;
export const CROSS_DOMAIN_ARTIFACT_ROOT =
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3' as const;

export const GENERATION_3_FOUNDATION_FRAGMENT_KEY =
  'foundation-published-v3' as const;
export const GENERATION_3_FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY =
  'foundation-three-domain-published-v3' as const;
export const GENERATION_3_CLASSICAL_FRAGMENT_KEY =
  'classical-control-published-v3' as const;
export const GENERATION_3_MODERN_DISCRETE_FRAGMENT_KEY =
  'modern-discrete-time-published-v3' as const;
export const GENERATION_3_MODERN_STATE_SPACE_FRAGMENT_KEY =
  'modern-state-space-published-v3' as const;

export const GENERATION_3_ALLOWED_IDENTITY_PATHS = [
  'fragmentKey',
  'fragmentId',
  'fragmentDigest',
  'nodeIndexDigest',
  'authorityDigest',
  'authorityNodeIds',
  'authoritySelection.nodeIndexDigest',
  'sourceDigest',
  'inputDigest',
] as const;

export type Generation3AllowedIdentityPath =
  (typeof GENERATION_3_ALLOWED_IDENTITY_PATHS)[number];

export const CROSS_DOMAIN_NO_ADMISSIBLE_REASON =
  '已收集的 foundation / classical / modern 边界候选均不是可接纳的直接 ACT_TEACHING 边：已发布边留在原领域分片，未解决项仍非直接教学顺序，工程邻接与无端点跨域入口不得造边。';

export interface CrossDomainCollectedCandidate {
  candidateId: string;
  originWorklist: string;
  sourceNodeId: string | null;
  targetNodeId: string | null;
  originStatus: string;
  admissibleDirectActTeaching: false;
  reason: string;
}

export interface CrossDomainSource {
  contract: typeof CROSS_DOMAIN_SOURCE_CONTRACT;
  fragmentKey: typeof CROSS_DOMAIN_FRAGMENT_KEY;
  fragmentVersion: typeof CROSS_DOMAIN_FRAGMENT_VERSION;
  domainKeys: typeof REGISTERED_PEER_DOMAIN_IDS;
  authorityBinding: DomainTeachingAuthorityEnvelope['binding'];
  authoritySelection: ReturnType<typeof authoritySelectionFromEnvelope>;
  denominatorNodeIds: [];
  coreNodes: [];
  relations: [];
  collectedCandidates: CrossDomainCollectedCandidate[];
  acceptedDirectActTeachingCandidates: [];
  noAdmissibleDirectActTeachingCandidate: true;
  reason: typeof CROSS_DOMAIN_NO_ADMISSIBLE_REASON;
  sourceDigest: string;
}

export interface CrossDomainWorklist {
  contract: typeof CROSS_DOMAIN_WORKLIST_CONTRACT;
  fragmentKey: typeof CROSS_DOMAIN_FRAGMENT_KEY;
  fragmentVersion: typeof CROSS_DOMAIN_FRAGMENT_VERSION;
  domainKeys: typeof REGISTERED_PEER_DOMAIN_IDS;
  authorityBinding: DomainTeachingAuthorityEnvelope['binding'];
  authoritySelection: ReturnType<typeof authoritySelectionFromEnvelope>;
  denominatorNodeIds: [];
  coreNodes: [];
  relations: [];
  collectedCandidates: CrossDomainCollectedCandidate[];
  acceptedDirectActTeachingCandidates: [];
  noAdmissibleDirectActTeachingCandidate: true;
  reason: typeof CROSS_DOMAIN_NO_ADMISSIBLE_REASON;
  inputDigest: string;
}

export interface CrossDomainCoverageArtifact {
  contract: typeof CROSS_DOMAIN_COVERAGE_CONTRACT;
  fragmentKey: typeof CROSS_DOMAIN_FRAGMENT_KEY;
  fragmentVersion: typeof CROSS_DOMAIN_FRAGMENT_VERSION;
  fragmentId: string;
  fragmentDigest: string;
  sourceInventoryDigest: string;
  denominatorNodeIds: [];
  acceptedRelationCount: 0;
  coverage: DomainCoverageReportEntry[];
  coverageRationale: typeof CROSS_DOMAIN_NO_ADMISSIBLE_REASON;
  blocking: false;
}

export interface CrossDomainArtifacts {
  source: CrossDomainSource;
  worklist: CrossDomainWorklist;
  authoring: DomainTeachingFragmentAuthoring;
  fragment: DomainTeachingFragment;
  coverage: CrossDomainCoverageArtifact;
}

export interface Generation3UpstreamPin {
  role: string;
  path: string;
  originalBytesDigest: string;
  originalPublishedDigest: string;
  originalSemanticDigest: string;
  resealedDigest: string;
  snapshotBinding: DomainTeachingAuthorityEnvelope['binding'];
  conversionProtocol: typeof CROSS_DOMAIN_CONVERSION_CONTRACT;
}

export class Generation3EquivalenceError extends Error {
  readonly code = 'generation-3-semantic-drift' as const;

  constructor(message: string) {
    super(message);
    this.name = 'Generation3EquivalenceError';
  }
}

export class Generation3PinError extends Error {
  readonly code = 'generation-3-pin-mismatch' as const;

  constructor(message: string) {
    super(message);
    this.name = 'Generation3PinError';
  }
}

function compareCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function readJson<T>(repoRoot: string, relativePath: string): T {
  return JSON.parse(
    readFileSync(path.join(repoRoot, relativePath), 'utf8'),
  ) as T;
}

export function sha256Bytes(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256File(repoRoot: string, relativePath: string): string {
  return sha256Bytes(readFileSync(path.join(repoRoot, relativePath)));
}

export function assertPinnedFileBytes(
  repoRoot: string,
  relativePath: string,
  expectedDigest: string,
): string {
  const actual = sha256File(repoRoot, relativePath);
  if (actual !== expectedDigest) {
    throw new Generation3PinError(
      `source bytes mismatch for ${relativePath}: expected ${expectedDigest}, got ${actual}`,
    );
  }
  return actual;
}

export function teachingSemanticPayload(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  return {
    domainKeys: record.domainKeys ?? null,
    evidenceRefs: record.evidenceRefs ?? null,
    coreNodes: record.coreNodes ?? null,
    relations: record.relations ?? null,
    denominatorNodeIds: record.denominatorNodeIds ?? null,
    acceptedLocalRelationCount: record.acceptedLocalRelationCount ?? null,
    acceptedRelationCount: record.acceptedRelationCount ?? null,
    unresolvedCoreCandidates: record.unresolvedCoreCandidates ?? null,
    deferredBoundaries: record.deferredBoundaries ?? null,
    excludedScopes: record.excludedScopes ?? null,
    coverage: record.coverage ?? null,
    coverageRationale: record.coverageRationale ?? null,
    blocking: record.blocking ?? null,
    denominatorEvidence: record.denominatorEvidence ?? null,
  };
}

export function publishedIdentityDigest(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of ['fragmentDigest', 'sourceDigest', 'inputDigest'] as const) {
      if (typeof record[key] === 'string') return record[key];
    }
  }
  return projectionDigest(value);
}

function deleteAllowedPath(target: Record<string, unknown>, pathExpr: string): void {
  const parts = pathExpr.split('.');
  let cursor: unknown = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return;
    cursor = (cursor as Record<string, unknown>)[parts[index]!];
  }
  if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return;
  delete (cursor as Record<string, unknown>)[parts[parts.length - 1]!];
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function assertExplicitIdentityEquivalence(
  original: unknown,
  resealed: unknown,
  label: string,
  allowedPaths: readonly Generation3AllowedIdentityPath[] = GENERATION_3_ALLOWED_IDENTITY_PATHS,
): void {
  const left = cloneJson(original);
  const right = cloneJson(resealed);
  if (left && typeof left === 'object' && right && typeof right === 'object') {
    for (const allowed of allowedPaths) {
      deleteAllowedPath(left as Record<string, unknown>, allowed);
      deleteAllowedPath(right as Record<string, unknown>, allowed);
    }
  }
  if (projectionDigest(left) !== projectionDigest(right)) {
    throw new Generation3EquivalenceError(
      `semantic payload drift for ${label}: non-allowlisted fields changed`,
    );
  }
}

function candidate(
  input: Omit<CrossDomainCollectedCandidate, 'admissibleDirectActTeaching'>,
): CrossDomainCollectedCandidate {
  return {
    ...input,
    admissibleDirectActTeaching: false,
  };
}

export function collectCrossDomainBoundaryCandidates(
  repoRoot = process.cwd(),
): CrossDomainCollectedCandidate[] {
  const foundation = readJson<{
    candidates?: Array<{
      candidateId?: string;
      sourceNodeId?: string;
      targetNodeId?: string;
      status?: string;
      unpublishedReason?: string | null;
      directness?: string;
    }>;
  }>(
    repoRoot,
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.worklist.json',
  );
  const classical = readJson<{
    candidates?: Array<{
      candidateId?: string;
      sourceCanonicalId?: string;
      targetCanonicalId?: string;
      status?: string;
      disposition?: string;
      rationale?: string;
    }>;
  }>(
    repoRoot,
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-worklist.json',
  );
  const modernWorklists = [
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.worklist.json',
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.worklist.json',
  ] as const;

  const collected: CrossDomainCollectedCandidate[] = [];
  for (const item of foundation.candidates ?? []) {
    const alreadyPublished = item.status === 'published';
    collected.push(candidate({
      candidateId: String(item.candidateId ?? 'foundation-unknown'),
      originWorklist: 'foundation-three-domain-v1.worklist.json',
      sourceNodeId: item.sourceNodeId ?? null,
      targetNodeId: item.targetNodeId ?? null,
      originStatus: String(item.status ?? 'unknown'),
      reason: alreadyPublished
        ? '已在 foundation 领域分片发布，不是新增跨领域 ACT_TEACHING 候选。'
        : String(item.unpublishedReason ?? 'foundation 候选不是直接教学边。'),
    }));
  }
  for (const item of classical.candidates ?? []) {
    const accepted = item.status === 'ACCEPTED';
    collected.push(candidate({
      candidateId: String(item.candidateId ?? 'classical-unknown'),
      originWorklist: 'generation-2/classical-worklist.json',
      sourceNodeId: item.sourceCanonicalId ?? null,
      targetNodeId: item.targetCanonicalId ?? null,
      originStatus: String(item.status ?? 'unknown'),
      reason: accepted
        ? '已在 classical 领域分片发布，不是新增跨领域 ACT_TEACHING 候选。'
        : String(item.rationale ?? 'classical 工程邻接不得转写为 ACT_TEACHING。'),
    }));
  }
  for (const relative of modernWorklists) {
    const worklist = readJson<{
      fragmentKey?: string;
      deferredBoundaries?: Array<{ scope?: string; reason?: string }>;
      excludedScopes?: Array<{ scope?: string; reason?: string }>;
      unresolvedCoreCandidates?: Array<{ canonicalId?: string; reason?: string }>;
    }>(repoRoot, relative);
    for (const item of worklist.deferredBoundaries ?? []) {
      collected.push(candidate({
        candidateId: `${worklist.fragmentKey ?? 'modern'}:${item.scope ?? 'deferred'}`,
        originWorklist: relative.split('/').slice(-1)[0] ?? relative,
        sourceNodeId: null,
        targetNodeId: null,
        originStatus: 'deferred',
        reason: String(item.reason ?? '跨域入口没有可发布端点。'),
      }));
    }
    for (const item of worklist.excludedScopes ?? []) {
      collected.push(candidate({
        candidateId: `${worklist.fragmentKey ?? 'modern'}:${item.scope ?? 'excluded'}`,
        originWorklist: relative.split('/').slice(-1)[0] ?? relative,
        sourceNodeId: null,
        targetNodeId: null,
        originStatus: 'excluded',
        reason: String(item.reason ?? '非教学邻接不得造边。'),
      }));
    }
    for (const item of worklist.unresolvedCoreCandidates ?? []) {
      collected.push(candidate({
        candidateId: `${worklist.fragmentKey ?? 'modern'}:unresolved:${item.canonicalId ?? 'unknown'}`,
        originWorklist: relative.split('/').slice(-1)[0] ?? relative,
        sourceNodeId: item.canonicalId ?? null,
        targetNodeId: null,
        originStatus: 'DEFER',
        reason: String(item.reason ?? '现代控制候选仍为 DEFER，不得提升为跨领域边。'),
      }));
    }
  }
  return collected.sort((left, right) => compareCodePoint(
    `${left.originWorklist}:${left.candidateId}`,
    `${right.originWorklist}:${right.candidateId}`,
  ));
}

export function buildCrossDomainArtifacts(
  authority: DomainTeachingAuthorityEnvelope,
  repoRoot = process.cwd(),
): CrossDomainArtifacts {
  const envelope = assertDomainTeachingAuthorityEnvelope(
    authority,
    'cross-domain.authority',
  );
  const authoritySelection = authoritySelectionFromEnvelope(envelope);
  const collectedCandidates = collectCrossDomainBoundaryCandidates(repoRoot);
  if (collectedCandidates.some((item) => item.admissibleDirectActTeaching)) {
    throw new Error('cross-domain review produced an admissible candidate without authoring');
  }
  if (collectedCandidates.length === 0) {
    throw new Error('cross-domain review must record collected worklist candidates');
  }
  const domainKeys = [...REGISTERED_PEER_DOMAIN_IDS];
  const sourceDigest = projectionDigest({
    contract: CROSS_DOMAIN_SOURCE_CONTRACT,
    fragmentKey: CROSS_DOMAIN_FRAGMENT_KEY,
    fragmentVersion: CROSS_DOMAIN_FRAGMENT_VERSION,
    domainKeys,
    authoritySelection,
    denominatorNodeIds: [],
    coreNodes: [],
    relations: [],
    collectedCandidates,
    acceptedDirectActTeachingCandidates: [],
    noAdmissibleDirectActTeachingCandidate: true,
    reason: CROSS_DOMAIN_NO_ADMISSIBLE_REASON,
  });
  const source: CrossDomainSource = {
    contract: CROSS_DOMAIN_SOURCE_CONTRACT,
    fragmentKey: CROSS_DOMAIN_FRAGMENT_KEY,
    fragmentVersion: CROSS_DOMAIN_FRAGMENT_VERSION,
    domainKeys: REGISTERED_PEER_DOMAIN_IDS,
    authorityBinding: envelope.binding,
    authoritySelection,
    denominatorNodeIds: [],
    coreNodes: [],
    relations: [],
    collectedCandidates,
    acceptedDirectActTeachingCandidates: [],
    noAdmissibleDirectActTeachingCandidate: true,
    reason: CROSS_DOMAIN_NO_ADMISSIBLE_REASON,
    sourceDigest,
  };
  const inputDigest = projectionDigest({
    contract: CROSS_DOMAIN_WORKLIST_CONTRACT,
    sourceDigest,
    denominatorNodeIds: [],
    collectedCandidates,
    acceptedDirectActTeachingCandidates: [],
    noAdmissibleDirectActTeachingCandidate: true,
  });
  const worklist: CrossDomainWorklist = {
    contract: CROSS_DOMAIN_WORKLIST_CONTRACT,
    fragmentKey: CROSS_DOMAIN_FRAGMENT_KEY,
    fragmentVersion: CROSS_DOMAIN_FRAGMENT_VERSION,
    domainKeys: REGISTERED_PEER_DOMAIN_IDS,
    authorityBinding: envelope.binding,
    authoritySelection,
    denominatorNodeIds: [],
    coreNodes: [],
    relations: [],
    collectedCandidates,
    acceptedDirectActTeachingCandidates: [],
    noAdmissibleDirectActTeachingCandidate: true,
    reason: CROSS_DOMAIN_NO_ADMISSIBLE_REASON,
    inputDigest,
  };
  const authoring: DomainTeachingFragmentAuthoring = {
    contract: 'act-domain-teaching-fragment/v1',
    fragmentKey: CROSS_DOMAIN_FRAGMENT_KEY,
    fragmentVersion: CROSS_DOMAIN_FRAGMENT_VERSION,
    domainKeys,
    authorityBinding: envelope.binding,
    authoritySelection,
    authoringRevision: envelope.authoringRevision,
    captureRevision: envelope.captureRevision,
    sourceDatasetHash: envelope.sourceDatasetHash,
    nodeIndexDigest: envelope.nodeIndexDigest,
    evidenceRefs: [],
    coreNodes: [],
    relations: [],
  };
  const fragment = buildDomainTeachingFragment(authoring, envelope);
  const coverage: CrossDomainCoverageArtifact = {
    contract: CROSS_DOMAIN_COVERAGE_CONTRACT,
    fragmentKey: CROSS_DOMAIN_FRAGMENT_KEY,
    fragmentVersion: CROSS_DOMAIN_FRAGMENT_VERSION,
    fragmentId: fragment.fragmentId,
    fragmentDigest: fragment.fragmentDigest,
    sourceInventoryDigest: fragment.sourceInventoryDigest,
    denominatorNodeIds: [],
    acceptedRelationCount: 0,
    coverage: buildDomainCoverageReport({
      declaredDomainKeys: domainKeys,
      coreNodes: fragment.coreNodes,
      relations: fragment.relations,
    }),
    coverageRationale: CROSS_DOMAIN_NO_ADMISSIBLE_REASON,
    blocking: false,
  };
  return { source, worklist, authoring, fragment, coverage };
}

export function crossDomainArtifactRelatives() {
  return {
    source: `${CROSS_DOMAIN_ARTIFACT_ROOT}/cross-domain.source.json`,
    worklist: `${CROSS_DOMAIN_ARTIFACT_ROOT}/cross-domain.worklist.json`,
    authoring: `${CROSS_DOMAIN_ARTIFACT_ROOT}/cross-domain.authoring.json`,
    fragment: `${CROSS_DOMAIN_ARTIFACT_ROOT}/cross-domain.json`,
    coverage: `${CROSS_DOMAIN_ARTIFACT_ROOT}/cross-domain.coverage.json`,
  } as const;
}

export function serializeCrossDomainJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function rebindFragmentAuthoring(
  authoring: DomainTeachingFragmentAuthoring,
  fragmentKey: string,
  nodeIndexDigest: string,
): DomainTeachingFragmentAuthoring {
  return {
    ...authoring,
    fragmentKey,
    nodeIndexDigest,
  };
}
