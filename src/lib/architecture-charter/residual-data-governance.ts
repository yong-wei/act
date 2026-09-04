import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { privacyViolation } from '@/lib/architecture-census/privacy';
import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';
import { OWNER_CATALOG, REQUIRED_BASELINE, type OwnerId } from './types';

export const RESIDUAL_SCHEMA_VERSION = 'act-residual-data-governance-adjudication/v2' as const;
export const RESIDUAL_COMMAND_SCOPE = 'residual-data-governance:adjudicate' as const;
export const RESIDUAL_DENOMINATOR_PREFIX = 'src/lib/data-governance/' as const;
export const LEARNING_RECORD_WRITER = 'src/features/learning-record/ingestion' as const;

/** Upstream current payload-eligibility change this adjudication consumes (Issue #1916). */
export const UPSTREAM_PAYLOAD_CHANGE = {
  changeId: 'complete-current-repository-payload-eligibility-classification',
  issue: 1916,
  compactIndexLocator: 'docs/architecture/repository-payload-classification/current/index.json',
} as const;

/** Immutable #1876/#1883 predecessor identities kept as comparison-only history. */
export const PREDECESSOR_1883 = {
  decisionIdentity: 'f606e22c34eaa5f457e395fd476315c0cd2c7fd66c12c1763b4652f0a1894c13',
  compactIndexLocator: 'docs/architecture/modular-monolith/post-convergence/residual-data-governance/index.json',
} as const;

export const RESIDUAL_CURRENT_SUBJECT_BASE = 'origin/integration' as const;

/**
 * Buddy claim branch (= change id) this adjudicator is allowed to run on. The
 * tool code only exists on the claim branch before merge, and task 1.4 keeps
 * the tool identity independent from the subject, so any other execution
 * branch — `main`, `integration`, or another feature branch — is rejected.
 */
export const RESIDUAL_CLAIM_BRANCH = 'requalify-current-residual-data-governance-owner-migration-inputs' as const;

export const REQUIRED_SUCCESSOR = {
  schemaVersion: 'act-architecture-post-convergence-successor/v1',
  successorCaptureId: 'fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02',
  sourceCommit: '698cb2f4cd6d001bcbeee95bca9be58c56c1cca3',
  sourceTree: '41d6b3f5966493911d6ce9c1f299015189778d53',
  packageDigest: '259ce5259694268d25d9b91825f070acf46b78ec0b34d26a0f4bb7686579ab12',
  ownerResidueLocator: 'owner-residue.md',
  ownerResidueSha256: 'faef106510d395af457f92f42dd89139e5612953625422d352fd3fa7f37d5bed',
  fullInventoryLocator:
    'artifacts/architecture-census/fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02/full-inventory.ndjson',
  fullInventorySha256: '0291c93d41de223f1698ee500cfe3b9024c4af42cfa04e4cc9a06d24b94bfc43',
  predecessorBaseline: REQUIRED_BASELINE,
} as const;

export type ResidualOutcome =
  | 'business-domain'
  | 'processing-kernel'
  | 'operator-tooling'
  | 'fixture-asset'
  | 'compatibility'
  | 'unresolved';

export type ResidualStatus = 'qualified' | 'unresolved';

export type CallerClass =
  | 'production'
  | 'test'
  | 'tooling'
  | 'dynamic'
  | 're-export'
  | 'documentation'
  | 'worker'
  | 'scheduler'
  | 'prisma'
  | 'historical';

const OWNER_IDS = new Set<string>(OWNER_CATALOG.map((item) => item.id));

export interface Issue1876Snapshot {
  readonly number: 1876;
  readonly state: string;
  readonly labels: readonly string[];
  readonly blockedBy: readonly { number: number; state: string }[];
}

/** Frozen claim-time current adjudication subject: an exact clean integration commit/tree. */
export interface ResidualCurrentSubject {
  readonly baseBranch: typeof RESIDUAL_CURRENT_SUBJECT_BASE;
  readonly subjectCommit: string;
  readonly subjectTree: string;
}

export interface UpstreamPayloadEvidence {
  readonly issue: number;
  readonly closed: boolean;
  readonly archived: boolean;
  readonly subjectIdentity: string;
  readonly packageDigest: string;
  readonly schemaVersion: string;
  readonly status: 'qualified' | 'package-unqualified' | string;
  readonly unresolvedMembers: number;
}

export interface LedgerVerificationReceipt {
  readonly locator: string;
  readonly byteCount: number;
  readonly sha256: string;
  readonly memberDenominator: number;
  readonly subjectCommit: string;
  readonly subjectTree: string;
  readonly toolCommit: string;
  readonly schemaVersion: string;
  readonly memberSetDigest: string;
  readonly callerBundleDigest: string;
  readonly familiesDigest: string;
  readonly projectionsReconciled: boolean;
}

/** Immutable #1876/#1883 comparison identity; current evidence may confirm or reject it. */
export interface PredecessorComparison {
  readonly decisionIdentity: string;
  readonly recordCount: number;
  readonly qualified: boolean;
}

export interface ResidualSubjectIdentity {
  readonly successorCaptureId: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly schemaVersion: string;
  readonly packageDigest: string;
  readonly ownerResidueLocator: string;
  readonly ownerResidueSha256: string;
  readonly fullInventoryLocator: string;
  readonly fullInventorySha256: string;
  readonly memberSetDigest: string;
  readonly fullInventoryBytesVerified: boolean;
  readonly currentSubject: ResidualCurrentSubject;
  readonly upstreamPayload: UpstreamPayloadEvidence;
  readonly predecessor1883: PredecessorComparison;
}

export interface ResidualToolIdentity {
  readonly toolCommit: string;
  readonly toolTree: string;
  readonly schemaVersion: typeof RESIDUAL_SCHEMA_VERSION;
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly entryBundleDigest: string;
}

export interface ResidualMemberInput {
  readonly path: string;
  /** Frozen-subject blob identity and byte size captured from `git ls-tree -l`. */
  readonly blobOid?: string;
  readonly byteSize?: number;
  readonly currentOwnerEvidence?: readonly string[];
  readonly candidateOwnerIds?: readonly string[];
}

export interface ResidualCallerInput {
  readonly memberPath: string;
  readonly callerPath: string;
  readonly relationship: string;
}

export interface OutOfScopeSurface {
  readonly identity: string;
  readonly accountableOwner?: OwnerId | null;
  readonly residualOutcome?: ResidualOutcome;
}

export interface ResidualAdjudicationInput {
  readonly gate: Issue1876Snapshot;
  readonly subject: ResidualSubjectIdentity;
  readonly tool: ResidualToolIdentity;
  readonly members: readonly ResidualMemberInput[];
  readonly callers: readonly ResidualCallerInput[];
  readonly outOfScopeSurfaces?: readonly OutOfScopeSurface[];
  readonly ledgerVerification?: LedgerVerificationReceipt | null;
  readonly dirtySource?: boolean;
  readonly mixedSource?: boolean;
  readonly executionBranch?: string;
}

export interface ResidualCaller {
  readonly path: string;
  readonly callerClass: CallerClass;
  readonly relationship: string;
}

export interface ResidualRecord {
  readonly id: string;
  readonly familyId: string;
  readonly path: string;
  readonly blobOid: string | null;
  readonly byteSize: number | null;
  readonly accountableOwner: OwnerId | null;
  readonly outcome: ResidualOutcome;
  readonly status: ResidualStatus;
  readonly callerClasses: readonly CallerClass[];
  readonly callers: readonly ResidualCaller[];
  readonly publicBoundary: string;
  readonly currentOwnerEvidence: readonly string[];
  readonly candidateOwnerIds: readonly string[];
  readonly authorityFacts: readonly string[];
  readonly privacyFacts: readonly string[];
  readonly resolutionCondition: string;
  readonly rollback: string;
  readonly evidenceLocators: readonly string[];
}

export interface ResidualFamily {
  readonly familyId: string;
  readonly accountableOwner: OwnerId | null;
  readonly outcome: ResidualOutcome;
  readonly memberIds: readonly string[];
  readonly slice: string;
}

export interface FutureSlice {
  readonly slice: string;
  readonly accountableOwner: OwnerId;
  readonly outcome: ResidualOutcome;
  readonly callerClasses: readonly CallerClass[];
  readonly paths: readonly string[];
  readonly publicBoundary: string;
  readonly notTouched: readonly string[];
  readonly protectedInvariants: readonly string[];
  readonly payloadStatus: string;
  readonly zeroConsumerProof: string;
  readonly deletionCondition: string;
  readonly rollback: string;
  readonly requiredAuthorization: string;
}

export interface GateRejection {
  readonly kind: 'parent-coordination-gate-rejection';
  readonly reasons: readonly string[];
}

export interface ResidualAdjudication {
  readonly kind: 'residual-adjudication';
  readonly schemaVersion: typeof RESIDUAL_SCHEMA_VERSION;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly subject: ResidualSubjectIdentity;
  readonly tool: ResidualToolIdentity;
  readonly predecessorBaseline: typeof REQUIRED_BASELINE;
  readonly records: readonly ResidualRecord[];
  readonly families: readonly ResidualFamily[];
  readonly summaries: {
    readonly memberCount: number;
    readonly qualifiedCount: number;
    readonly unresolvedCount: number;
    readonly byOutcome: Readonly<Record<ResidualOutcome, number>>;
    readonly byOwner: Readonly<Record<string, number>>;
  };
  readonly futureSlices: readonly FutureSlice[];
  readonly fullLedger: {
    readonly logicalLocator: string;
    readonly byteCount: number;
    readonly sha256: string;
  };
  readonly ledgerBody: string;
  readonly callerBundleDigest: string;
  readonly decisionIdentity: string;
}

export type ResidualAdjudicationResult = GateRejection | ResidualAdjudication;

interface ClassifiedPath {
  readonly slice: string;
  readonly outcome: Exclude<ResidualOutcome, 'unresolved'>;
  readonly owner: OwnerId;
  readonly authorityFacts: readonly string[];
  readonly privacyFacts: readonly string[];
  readonly publicBoundary: string;
  readonly kernelCandidate: boolean;
}

const QUALIFIED_OUTCOMES: ReadonlySet<ResidualOutcome> = new Set([
  'business-domain',
  'processing-kernel',
  'operator-tooling',
  'fixture-asset',
  'compatibility',
]);

export function evaluateCoordinationGate(issue: Issue1876Snapshot): string[] {
  const reasons: string[] = [];
  if (issue.number !== 1876) reasons.push('gate-issue-mismatch');
  if (String(issue.state).toUpperCase() !== 'CLOSED') reasons.push('gate-1876-not-closed');
  const labels = issue.labels.map((label) => label.toLowerCase());
  if (!labels.includes('status:archived')) reasons.push('gate-1876-not-archived');
  const openBlockers = issue.blockedBy.filter((item) => String(item.state).toUpperCase() !== 'CLOSED');
  if (openBlockers.length > 0) reasons.push('gate-1876-blockedBy-unresolved');
  return reasons;
}

export function classifyCallerPath(path: string, relationship = ''): CallerClass {
  if (relationship === 'dynamic') return 'dynamic';
  if (relationship === 're-export') return 're-export';
  if (path.startsWith('openspec/changes/archive/')) return 'historical';
  if (path.startsWith('openspec/') || path.startsWith('docs/')) return 'documentation';
  if (path.includes('/__tests__/') || /\.test\.[cm]?[tj]sx?$/u.test(path)) return 'test';
  if (path.includes('scripts/workers/') || (path.startsWith('scripts/') && /worker/iu.test(path))) return 'worker';
  if (path.includes('scheduler')) return 'scheduler';
  if (path.startsWith('scripts/')) return 'tooling';
  if (path.includes('prisma/')) return 'prisma';
  return 'production';
}

export function classifyResidualPath(path: string): ClassifiedPath | { outcome: 'unresolved'; slice: 'unresolved' } {
  if (!path.startsWith(RESIDUAL_DENOMINATOR_PREFIX)) return { outcome: 'unresolved', slice: 'unresolved' };
  const file = path.slice(RESIDUAL_DENOMINATOR_PREFIX.length);
  const base = file.replace(/^__tests__\//u, '').replace(/\.test\.ts$/u, '.ts');
  const isTest = file.startsWith('__tests__/');
  const isAsset = file.startsWith('assets/');
  const classified = classifyProductionFile(base === file ? file : base);
  if (isAsset) {
    return {
      slice: 'compatibility-assets-tests',
      outcome: 'fixture-asset',
      owner: classified && classified.outcome !== 'unresolved' ? classified.owner : 'learning-record',
      authorityFacts: ['non-production-asset'],
      privacyFacts: ['font-license-only'],
      publicBoundary: 'none',
      kernelCandidate: false,
    };
  }
  if (isTest || file === 'yangfan-diagnostic-fixture.ts' || /demo-package\.ts$/u.test(file)) {
    const owner = classified && classified.outcome !== 'unresolved' ? classified.owner : 'learning-record';
    return {
      slice: 'compatibility-assets-tests',
      outcome: 'fixture-asset',
      owner,
      authorityFacts: ['non-production-fixture'],
      privacyFacts: ['synthetic-or-redacted-only'],
      publicBoundary: 'none',
      kernelCandidate: false,
    };
  }
  if (file === 'index.ts') {
    return {
      slice: 'compatibility-assets-tests',
      outcome: 'compatibility',
      owner: 'learning-record',
      authorityFacts: ['barrel-not-deleted-in-d'],
      privacyFacts: ['no-payload'],
      publicBoundary: 'src/lib/data-governance/index.ts',
      kernelCandidate: false,
    };
  }
  return classified;
}

function classifyProductionFile(file: string): ClassifiedPath | { outcome: 'unresolved'; slice: 'unresolved' } {
  if (/^teacher-ai-grading-lab/u.test(file) || file === 'teacher-ai-grading-publication-candidate.ts' || file === 'teacher-ai-grading-visual-diagnostics.ts') {
    return {
      slice: 'operator-backfill',
      outcome: 'operator-tooling',
      owner: 'assignment',
      authorityFacts: ['operator-only', 'no-online-writer', 'no-current-pointer'],
      privacyFacts: ['redaction-required', 'independent-learner-suppression'],
      publicBoundary: 'scripts/data-governance/teacher-ai-grading-lab-cli.ts',
      kernelCandidate: false,
    };
  }
  if (
    /backfill/u.test(file)
    || file === 'historical-evidence-materialization.ts'
    || file === 'data-completeness-audit.ts'
    || file === 'cumulative-snapshot-jobs.ts'
    || /historical/u.test(file)
  ) {
    const owner: OwnerId = /simulation/u.test(file) ? 'practice-lab' : /portrait|cumulative|growth/u.test(file) ? 'personalization' : 'learning-record';
    return {
      slice: 'operator-backfill',
      outcome: 'operator-tooling',
      owner,
      authorityFacts: ['operator-only', 'dry-run-or-frozen-input', 'no-online-writer', 'no-current-pointer'],
      privacyFacts: ['no-raw-payload-in-projection'],
      publicBoundary: 'scripts/db/**',
      kernelCandidate: false,
    };
  }
  if (
    /^(math-document-|assignment-attachment-|teacher-assignment-)/u.test(file)
    || file === 'submission-evidence-quality.ts'
  ) {
    return {
      slice: 'assignment-evidence',
      outcome: 'business-domain',
      owner: 'learning-record',
      authorityFacts: [
        'c16-assignment-owns-orchestration',
        'processing-policy-retained-in-governance',
        'approved-snapshot-port-only',
      ],
      privacyFacts: ['no-raw-answers', 'no-contextJson'],
      publicBoundary: 'src/lib/assignments/public-api.ts approved-snapshot port',
      kernelCandidate: false,
    };
  }
  if (file === 'competency-engine.ts' || file === 'competency-model.ts') {
    return {
      slice: 'portrait-profile',
      outcome: 'compatibility',
      owner: 'personalization',
      authorityFacts: ['portrait-v2-primary', 'student-competency-compatibility'],
      privacyFacts: ['profile-redaction'],
      publicBoundary: 'Portrait V2 read/refresh ports',
      kernelCandidate: false,
    };
  }
  if (
    /^(portrait-|profile-|competency-|cumulative-|growth-evaluation|student-evidence-feature-cache|risk-detector)/u.test(file)
  ) {
    return {
      slice: 'portrait-profile',
      outcome: 'business-domain',
      owner: 'personalization',
      authorityFacts: ['portrait-v2-primary', 'student-competency-compatibility'],
      privacyFacts: ['profile-redaction', 'independent-learner-suppression'],
      publicBoundary: 'Portrait V2/profile read and refresh ports',
      kernelCandidate: false,
    };
  }
  if (
    /^(class-|session-(?!fact-replay)|interactive-session-finalization|course-review-prepost)/u.test(file)
  ) {
    return {
      slice: 'classroom-session',
      outcome: 'business-domain',
      owner: 'classroom',
      authorityFacts: ['teacher-class-authorization', 'backfill-isolated-from-online-writer'],
      privacyFacts: ['redaction', 'independent-learner-suppression'],
      publicBoundary: 'authorized class/session read and finalization ports',
      kernelCandidate: false,
    };
  }
  if (/^(simulation-|control-workbench-run-context|control-correction-demo-package)/u.test(file)) {
    return {
      slice: 'simulation-arena',
      outcome: 'business-domain',
      owner: 'practice-lab',
      authorityFacts: ['ArenaSubmission-official-score', 'simulation-learningfact-auxiliary-only'],
      privacyFacts: ['preview-open-isolated-excluded', 'profileWeight-0-excluded'],
      publicBoundary: 'governed simulation-task evidence ports',
      kernelCandidate: false,
    };
  }
  if (
    /^(autocontrol-kaq|kaq-|graph-center|knowledge-truth|course-evidence-specs|resource-coverage|new-resource-semantic|learning-evidence-rag|structured-associative-retrieval|sar-|openspec-change-evidence|teacher-prep-pack|teacher-kaq|visual-evidence)/u.test(file)
  ) {
    return {
      slice: 'knowledge-resource-sar',
      outcome: 'business-domain',
      owner: 'knowledge',
      authorityFacts: ['no-release-selector-mutation', 'canonical-resource-binding'],
      privacyFacts: ['no-raw-corpus-payload'],
      publicBoundary: 'knowledge/resource/SAR public adapters',
      kernelCandidate: false,
    };
  }
  if (
    /^(event-|interactive-event-ingestion|learning-fact-|session-fact-replay|trusted-learning-fact-filter|derived-learning-materialization|worker-client|evidence-source-catalog|evidence-timeline|interactive-evidence-scoring|unit-\d+-\d+-submission-telemetry)/u.test(file)
  ) {
    return {
      slice: 'learning-record-ingress',
      outcome: 'business-domain',
      owner: 'learning-record',
      authorityFacts: [`sole-online-writer:${LEARNING_RECORD_WRITER}`, 'not-a-second-writer'],
      privacyFacts: ['no-raw-event-payload', 'no-user-identifiers'],
      publicBoundary: LEARNING_RECORD_WRITER,
      kernelCandidate: /^(event-protocol|event-types|event-normalization|event-buffer)\.ts$/u.test(file),
    };
  }
  return { outcome: 'unresolved', slice: 'unresolved' };
}

function featureDomain(path: string): string | null {
  const match = path.match(/^src\/features\/([^/]+)\//u);
  return match?.[1] ?? null;
}

function kernelProof(recordPath: string, callers: readonly ResidualCaller[]): string[] {
  const missing: string[] = [];
  const production = callers.filter((caller) => caller.callerClass === 'production');
  const domains = [...new Set(production.map((caller) => featureDomain(caller.path)).filter(Boolean))];
  if (domains.length < 2) missing.push('kernel-two-real-domain-consumers');
  if (production.some((caller) => caller.path.startsWith('src/app/'))) missing.push('kernel-page-ownership');
  if (/backfill/u.test(recordPath)) missing.push('kernel-one-off-backfill');
  if (production.length === 0) missing.push('kernel-unique-public-api');
  return missing;
}

function ownerOrNull(value: string | null | undefined): OwnerId | null {
  return value && OWNER_IDS.has(value) ? (value as OwnerId) : null;
}

function emptyOutcomeCounts(): Record<ResidualOutcome, number> {
  return {
    'business-domain': 0,
    'processing-kernel': 0,
    'operator-tooling': 0,
    'fixture-asset': 0,
    compatibility: 0,
    unresolved: 0,
  };
}

export function memberSetDigest(paths: readonly string[]): string {
  return sha256Text(serializeDeterministic([...paths].sort()));
}

const RELATIVE_SPEC = /(?:export\s+\*\s+from|from|import)\s*\(?\s*['"](\.[^'"]+)['"]/gu;

function resolveRelativeSpecs(fromPath: string, spec: string): string[] {
  const parts = fromPath.split('/').slice(0, -1);
  for (const segment of spec.split('/')) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  const base = parts.join('/');
  return [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`];
}

export function collectRelativeCallers(
  files: readonly { path: string; content: string }[],
  memberPaths: readonly string[],
): ResidualCallerInput[] {
  const members = new Set(memberPaths);
  const callers: ResidualCallerInput[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    RELATIVE_SPEC.lastIndex = 0;
    let match: RegExpExecArray | null = RELATIVE_SPEC.exec(file.content);
    while (match) {
      const snippet = match[0] ?? '';
      const relationship = /export\s+\*\s+from/u.test(snippet)
        ? 're-export'
        : /import\s*\(/u.test(snippet)
          ? 'dynamic'
          : 'import';
      const candidates = resolveRelativeSpecs(file.path, match[1] ?? '');
      for (const candidate of candidates) {
        if (!members.has(candidate) || candidate === file.path) continue;
        const key = `${candidate}|${file.path}|${relationship}`;
        if (seen.has(key)) continue;
        seen.add(key);
        callers.push({
          memberPath: candidate,
          callerPath: file.path,
          relationship,
        });
      }
      match = RELATIVE_SPEC.exec(file.content);
    }
  }
  return callers;
}

export function directoryPathReadCaller(callerPath: string, text: string, barrelPath: string): ResidualCallerInput | null {
  if (!/(?:^|['"`=\s])src\/lib\/data-governance(?!\/)/u.test(text) && ! /['"`]src\/lib\/data-governance['"`]/u.test(text)) {
    return null;
  }
  return { memberPath: barrelPath, callerPath, relationship: 'path-read' };
}

const MODULE_EXTENSION_PATTERN = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/u;

/**
 * Indexes every textual form a member can be referenced by: the tracked path,
 * the `lib/`-relative form, and both without extension, because alias imports
 * like `@/lib/data-governance/session-reports` carry no `.ts` suffix.
 */
export function buildMemberReferenceTokens(memberPaths: readonly string[]): ReadonlyMap<string, readonly string[]> {
  const tokens = new Map<string, string[]>();
  for (const path of memberPaths) {
    const relative = path.replace(/^src\/lib\//u, '');
    const base = path.replace(MODULE_EXTENSION_PATTERN, '');
    const relativeBase = relative.replace(MODULE_EXTENSION_PATTERN, '');
    tokens.set(path, [...new Set([path, relative, base, relativeBase])]
      .sort((left, right) => right.length - left.length));
  }
  return tokens;
}

/**
 * Boundary-aware reference test so `session-reports` matches the alias import
 * and the `.ts` path but not sibling names like `session-reports-extra`.
 */
export function textReferencesMember(text: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`${escaped}(?![\\w-])`, 'u').test(text);
}

export function adjudicateResidualDataGovernance(
  input: ResidualAdjudicationInput,
): ResidualAdjudicationResult {
  const gateReasons = evaluateCoordinationGate(input.gate);
  if (gateReasons.length > 0) {
    return { kind: 'parent-coordination-gate-rejection', reasons: gateReasons };
  }

  const blockers: string[] = [];
  if (input.dirtySource) blockers.push('dirty-source');
  if (input.mixedSource) blockers.push('mixed-source');
  // Task 1.3: adjudication may only execute on this change's claim branch; a
  // named non-claim branch (e.g. main) must not publish qualified projections.
  if (input.executionBranch !== RESIDUAL_CLAIM_BRANCH) blockers.push('execution-branch-not-claim-branch');

  const subject = input.subject;
  // Upstream dependency: the current payload-eligibility change must be archived.
  if (subject.upstreamPayload.issue !== UPSTREAM_PAYLOAD_CHANGE.issue
    || !subject.upstreamPayload.closed
    || !subject.upstreamPayload.archived) {
    blockers.push('upstream-payload-change-not-archived');
  }
  if (!subject.upstreamPayload.subjectIdentity || !subject.upstreamPayload.packageDigest
    || subject.upstreamPayload.schemaVersion !== 'act-repository-payload-classification/v2') {
    blockers.push('upstream-payload-identity-incomplete');
  }
  // Task 5.1: the upstream payload package must itself be qualified before any
  // migration-input slice can be emitted from it.
  if (subject.upstreamPayload.status !== 'qualified' || subject.upstreamPayload.unresolvedMembers > 0) {
    blockers.push('upstream-payload-package-unqualified');
  }
  // Frozen current subject must be an exact clean integration identity, kept
  // independent from the adjudicator tool commit.
  if (subject.currentSubject.baseBranch !== RESIDUAL_CURRENT_SUBJECT_BASE
    || !/^[0-9a-f]{40}$/iu.test(subject.currentSubject.subjectCommit)
    || !/^[0-9a-f]{40}$/iu.test(subject.currentSubject.subjectTree)) {
    blockers.push('current-subject-incomplete');
  }
  if (input.tool.toolCommit === subject.currentSubject.subjectCommit) blockers.push('tool-subject-identity-collision');
  // Immutable #1876/#1883 identities are comparison-only history: they must be
  // present and digest-shaped, but never gate or donate current decisions.
  if (subject.successorCaptureId !== REQUIRED_SUCCESSOR.successorCaptureId
    || subject.packageDigest !== REQUIRED_SUCCESSOR.packageDigest) {
    blockers.push('predecessor-1883-identity-mismatch');
  }
  if (!subject.predecessor1883.decisionIdentity
    || subject.predecessor1883.decisionIdentity !== PREDECESSOR_1883.decisionIdentity) {
    blockers.push('predecessor-1883-decision-identity-mismatch');
  }
  if (!input.tool.toolCommit || !input.tool.toolTree || !input.tool.entryBundleDigest) blockers.push('tool-identity-missing');
  if (input.tool.schemaVersion !== RESIDUAL_SCHEMA_VERSION) blockers.push('tool-schema-mismatch');

  const paths = input.members.map((member) => member.path);
  if (memberSetDigest(paths) !== subject.memberSetDigest) blockers.push('member-set-digest-mismatch');
  // Task 2.1: every member must carry its frozen-subject blob identity and byte
  // size; a member that cannot be bound to one blob stays unqualified.
  if (input.members.some((member) => !member.blobOid || typeof member.byteSize !== 'number' || member.byteSize < 0)) {
    blockers.push('member-blob-identity-missing');
  }
  const seen = new Set<string>();
  for (const path of paths) {
    if (!path.startsWith(RESIDUAL_DENOMINATOR_PREFIX)) blockers.push(`out-of-denominator:${path}`);
    if (seen.has(path)) blockers.push(`duplicate-id:${path}`);
    seen.add(path);
  }
  if (paths.length === 0) blockers.push('empty-denominator');

  const callersByMember = new Map<string, ResidualCaller[]>();
  for (const caller of input.callers) {
    if (!seen.has(caller.memberPath)) blockers.push(`omitted-member-for-caller:${caller.memberPath}`);
    const bucket = callersByMember.get(caller.memberPath) ?? [];
    bucket.push({
      path: caller.callerPath,
      callerClass: classifyCallerPath(caller.callerPath, caller.relationship),
      relationship: caller.relationship,
    });
    callersByMember.set(caller.memberPath, bucket);
  }

  const records: ResidualRecord[] = input.members.map((member) => {
    const classified = classifyResidualPath(member.path);
    const callers = (callersByMember.get(member.path) ?? [])
      .sort((left, right) => left.path.localeCompare(right.path) || left.relationship.localeCompare(right.relationship));
    const callerClasses = [...new Set(callers.map((item) => item.callerClass))].sort();
    const candidates = [...new Set([
      ...(member.candidateOwnerIds ?? []),
      classified.outcome === 'unresolved' ? '' : classified.owner,
    ].filter(Boolean))].sort();
    let outcome: ResidualOutcome = classified.outcome === 'unresolved' ? 'unresolved' : classified.outcome;
    let owner = classified.outcome === 'unresolved' ? ownerOrNull(member.candidateOwnerIds?.[0] ?? null) : classified.owner;
    let resolutionCondition = 'none';
    const authorityFacts = classified.outcome === 'unresolved' ? ['unresolved-authority'] : [...classified.authorityFacts];
    const privacyFacts = classified.outcome === 'unresolved' ? ['unresolved-privacy'] : [...classified.privacyFacts];
    const kernelMissing = classified.outcome !== 'unresolved' && classified.kernelCandidate
      ? kernelProof(member.path, callers)
      : ['not-kernel-candidate'];

    if (classified.outcome !== 'unresolved' && classified.kernelCandidate && kernelMissing.length === 0) {
      outcome = 'processing-kernel';
    } else if (classified.outcome !== 'unresolved' && classified.kernelCandidate && kernelMissing.length > 0) {
      outcome = 'business-domain';
    }

    if (candidates.length > 1) {
      outcome = 'unresolved';
      owner = null;
      resolutionCondition = 'exactly-one-accountable-owner';
    }
    if (outcome !== 'unresolved' && !owner) {
      outcome = 'unresolved';
      resolutionCondition = 'missing-accountable-owner';
    }
    if (classified.outcome === 'unresolved') {
      outcome = 'unresolved';
      owner = null;
      resolutionCondition = 'no-defensible-owner-or-outcome';
    }
    if (outcome === 'processing-kernel' && kernelMissing.length > 0) {
      outcome = 'unresolved';
      resolutionCondition = kernelMissing.join(',');
    }

    const status: ResidualStatus = outcome === 'unresolved' || !owner ? 'unresolved' : 'qualified';
    const familyId = status === 'unresolved'
      ? `unresolved:${member.path}`
      : `${outcome}:${owner}:${classified.outcome === 'unresolved' ? 'unresolved' : classified.slice}:${authorityFacts.join('|')}:${privacyFacts.join('|')}`;

    return {
      id: `residual:${member.path}`,
      familyId,
      path: member.path,
      blobOid: member.blobOid ?? null,
      byteSize: typeof member.byteSize === 'number' ? member.byteSize : null,
      accountableOwner: status === 'qualified' ? owner : null,
      outcome: status === 'qualified' ? outcome : 'unresolved',
      status,
      callerClasses,
      callers,
      publicBoundary: classified.outcome === 'unresolved' ? 'unresolved' : classified.publicBoundary,
      currentOwnerEvidence: member.currentOwnerEvidence ?? [`path:${member.path}`],
      candidateOwnerIds: candidates,
      authorityFacts,
      privacyFacts,
      resolutionCondition,
      rollback: 'discard-additive-decision-package-only',
      evidenceLocators: [
        REQUIRED_SUCCESSOR.ownerResidueLocator,
        REQUIRED_SUCCESSOR.fullInventoryLocator,
        member.path,
      ],
    };
  });

  for (const surface of input.outOfScopeSurfaces ?? []) {
    if (surface.identity.startsWith(RESIDUAL_DENOMINATOR_PREFIX)) continue;
    if (surface.residualOutcome && !surface.accountableOwner) {
      blockers.push(`out-of-scope-compatibility-without-owner:${surface.identity}`);
    }
  }

  const familyMap = new Map<string, ResidualFamily>();
  for (const record of records) {
    const existing = familyMap.get(record.familyId);
    if (existing) {
      familyMap.set(record.familyId, { ...existing, memberIds: [...existing.memberIds, record.id] });
    } else {
      familyMap.set(record.familyId, {
        familyId: record.familyId,
        accountableOwner: record.accountableOwner,
        outcome: record.outcome,
        memberIds: [record.id],
        slice: record.familyId.split(':')[2] ?? 'unresolved',
      });
    }
  }
  const families = [...familyMap.values()].sort((left, right) => left.familyId.localeCompare(right.familyId));

  const byOutcome = emptyOutcomeCounts();
  const byOwner: Record<string, number> = {};
  for (const record of records) {
    byOutcome[record.outcome] += 1;
    const ownerKey = record.accountableOwner ?? 'none';
    byOwner[ownerKey] = (byOwner[ownerKey] ?? 0) + 1;
  }
  const unresolvedCount = records.filter((record) => record.status === 'unresolved').length;
  if (unresolvedCount > 0) blockers.push('unresolved-records');

  const candidateSlices = buildFutureSlices(records);
  const callerBundleDigest = sha256Text(serializeDeterministic(input.callers));
  const ledgerBody = serializeDeterministic({
    identity: {
      subjectCommit: subject.currentSubject.subjectCommit,
      subjectTree: subject.currentSubject.subjectTree,
      toolCommit: input.tool.toolCommit,
      schemaVersion: RESIDUAL_SCHEMA_VERSION,
      memberSetDigest: subject.memberSetDigest,
      callerBundleDigest,
    },
    records,
    families,
  });
  const fullLedger = {
    logicalLocator: `artifacts/architecture-census/${subject.currentSubject.subjectCommit}/residual-data-governance-ledger.ndjson`,
    byteCount: Buffer.byteLength(ledgerBody),
    sha256: sha256Text(ledgerBody),
  };
  const receipt = input.ledgerVerification ?? null;
  const receiptValid = receipt
    && receipt.sha256 === fullLedger.sha256
    && receipt.byteCount === fullLedger.byteCount
    && receipt.memberDenominator === records.length
    && receipt.subjectCommit === subject.currentSubject.subjectCommit
    && receipt.toolCommit === input.tool.toolCommit
    && receipt.callerBundleDigest === callerBundleDigest
    && receipt.memberSetDigest === subject.memberSetDigest
    && receipt.projectionsReconciled === true;
  if (!receiptValid) blockers.push('full-ledger-bytes-unverified');
  const summaries = {
    memberCount: records.length,
    qualifiedCount: records.length - unresolvedCount,
    unresolvedCount,
    byOutcome,
    byOwner,
  };
  const privacyTarget = serializeDeterministic({
    summaries,
    families,
    futureSlices: candidateSlices,
    records: records.map(({ callers: _callers, ...rest }) => rest),
  });
  const privacy = residualPrivacyViolation(privacyTarget) ?? residualPrivacyViolation(ledgerBody);
  if (privacy) blockers.push(`privacy:${privacy}`);

  const uniqueBlockers = [...new Set(blockers)].sort();
  const qualified = uniqueBlockers.length === 0
    && unresolvedCount === 0
    && records.every((record) => (
      Boolean(record.accountableOwner)
      && QUALIFIED_OUTCOMES.has(record.outcome)
      && record.status === 'qualified'
    ));

  // Task 6.1/6.3: a migration-input slice may exist only inside a fully
  // qualified package; any global gate failure leaves a blocker-only projection.
  const futureSlices = qualified ? candidateSlices : [];

  const decisionIdentity = sha256Text(serializeDeterministic({
    schemaVersion: RESIDUAL_SCHEMA_VERSION,
    currentSubject: subject.currentSubject,
    upstreamPayload: {
      packageDigest: subject.upstreamPayload.packageDigest,
      subjectIdentity: subject.upstreamPayload.subjectIdentity,
    },
    predecessor1883: subject.predecessor1883,
    subject: subject.successorCaptureId,
    packageDigest: subject.packageDigest,
    tool: input.tool.entryBundleDigest,
    memberSetDigest: subject.memberSetDigest,
    ledger: fullLedger.sha256,
  }));

  return {
    kind: 'residual-adjudication',
    schemaVersion: RESIDUAL_SCHEMA_VERSION,
    qualified,
    blockers: uniqueBlockers,
    subject,
    tool: input.tool,
    predecessorBaseline: REQUIRED_BASELINE,
    records,
    families,
    summaries,
    futureSlices,
    fullLedger,
    ledgerBody,
    callerBundleDigest,
    decisionIdentity,
  };
}

function residualPrivacyViolation(text: string): string | null {
  const shared = privacyViolation(text);
  if (shared) return shared;
  if (/"contextJson"\s*:/u.test(text) || /"rawAnswer"\s*:/u.test(text) || /"eventPayload"\s*:/u.test(text)) {
    return 'forbidden-payload';
  }
  return null;
}

function buildFutureSlices(records: readonly ResidualRecord[]): FutureSlice[] {
  const bySlice = new Map<string, ResidualRecord[]>();
  for (const record of records) {
    const slice = record.familyId.split(':')[2] ?? 'unresolved';
    const bucket = bySlice.get(slice) ?? [];
    bucket.push(record);
    bySlice.set(slice, bucket);
  }
  interface SliceSpec {
    readonly slice: string;
    readonly owner: OwnerId;
    readonly boundary: string;
    readonly notTouched: readonly string[];
    readonly protectedInvariants: readonly string[];
    readonly payloadStatus: string;
    readonly zeroConsumerProof: string;
    readonly deletion: string;
    readonly rollback: string;
    readonly requiredAuthorization: string;
  }
  const specs: readonly SliceSpec[] = [
    {
      slice: 'learning-record-ingress',
      owner: 'learning-record',
      boundary: LEARNING_RECORD_WRITER,
      notTouched: ['writers', 'anchors', 'times', 'dedupe', 'outbox', 'pointer', 'watermark', 'schema', 'retention'],
      protectedInvariants: ['sole-online-learning-record-writer', 'fact-identity-dedup-trusted-time', 'outbox-pointer-watermark'],
      payloadStatus: 'governance-policies-no-raw-payload',
      zeroConsumerProof: 'zero-direct-and-staged-callers-and-one-online-writer-proven',
      deletion: 'zero-direct-and-staged-callers-and-one-online-writer-proven',
      rollback: 'preserve-append-only-facts-and-original-anchors',
      requiredAuthorization: 'future-openspec-change-with-explicit-writer-boundary-authorization',
    },
    {
      slice: 'assignment-evidence',
      owner: 'learning-record',
      boundary: 'Assignment public API plus approved-snapshot port',
      notTouched: ['C16-orchestration', 'LearningFact-from-routes', 'CAS', 'idempotency'],
      protectedInvariants: ['approved-snapshots', 'CAS', 'idempotency', 'processing-derivative-outbox-boundaries'],
      payloadStatus: 'no-raw-answers-no-contextJson',
      zeroConsumerProof: 'zero-unclassified-callers-and-complete-snapshot-lineage',
      deletion: 'zero-unclassified-callers-and-complete-snapshot-lineage',
      rollback: 'preserve-approved-snapshots-CAS-idempotency-derivatives-outbox',
      requiredAuthorization: 'future-assignment-owned-change-authorization',
    },
    {
      slice: 'portrait-profile',
      owner: 'personalization',
      boundary: 'Portrait V2/profile read and refresh ports',
      notTouched: ['portrait-algorithms', 'StudentCompetency-compatibility', 'freshness', 'current-pointers'],
      protectedInvariants: ['portrait-v2-primary', 'current-pointer-freshness', 'student-competency-compatibility'],
      payloadStatus: 'profile-redaction-required',
      zeroConsumerProof: 'all-readers-use-governed-ports',
      deletion: 'all-readers-use-governed-ports',
      rollback: 'keep-last-qualified-generation',
      requiredAuthorization: 'future-personalization-owned-change-authorization',
    },
    {
      slice: 'classroom-session',
      owner: 'classroom',
      boundary: 'authorized class/session read and finalization ports',
      notTouched: ['class-student-authorization', 'redaction', 'independent-learner-suppression', 'backfill-isolation'],
      protectedInvariants: ['class-student-authorization', 'redaction', 'independent-learner-suppression', 'backfill-isolation-from-online-writer'],
      payloadStatus: 'session-snapshots-no-raw-identity',
      zeroConsumerProof: 'worker-scheduler-and-report-callers-closed',
      deletion: 'worker-scheduler-and-report-callers-closed',
      rollback: 'preserve-immutable-session-snapshots-and-receipts',
      requiredAuthorization: 'future-classroom-owned-change-authorization',
    },
    {
      slice: 'simulation-arena',
      owner: 'practice-lab',
      boundary: 'official Arena submission and governed simulation-task evidence ports',
      notTouched: ['ArenaSubmission-scoring', 'preview-open-isolated-as-official', 'UI-as-writer'],
      protectedInvariants: ['ArenaSubmission-official-scoring', 'context-only-LearningFacts', 'preview-isolated-as-official'],
      payloadStatus: 'declared-context-only',
      zeroConsumerProof: 'official-result-and-context-only-paths-proven',
      deletion: 'official-result-and-context-only-paths-proven',
      rollback: 'preserve-ArenaSubmission-and-fact-identity',
      requiredAuthorization: 'future-practice-lab-owned-change-authorization',
    },
    {
      slice: 'knowledge-resource-sar',
      owner: 'knowledge',
      boundary: 'knowledge/resource/SAR public adapters',
      notTouched: ['knowledge-authority', 'release-selectors', 'resource-registry', 'teaching-admission'],
      protectedInvariants: ['knowledge-authority', 'release-selectors', 'teaching-admission'],
      payloadStatus: 'no-raw-corpus-payload',
      zeroConsumerProof: 'public-adapters-and-privacy-scopes-singular',
      deletion: 'public-adapters-and-privacy-scopes-singular',
      rollback: 'leave-release-and-catalog-identities-unchanged',
      requiredAuthorization: 'future-knowledge-owned-change-authorization',
    },
    {
      slice: 'operator-backfill',
      owner: 'learning-record',
      boundary: 'scripts/db/** scripts/ops/** scripts/data-governance/** worker/scheduler',
      notTouched: ['online-writer', 'current-pointer'],
      protectedInvariants: ['online-writer-isolation', 'current-pointer-isolation', 'dry-run-or-frozen-input'],
      payloadStatus: 'no-raw-payload-in-projection',
      zeroConsumerProof: 'zero-production-consumers-proven',
      deletion: 'zero-production-consumers-and-rollback-rehearsal',
      rollback: 'operator-receipt-and-frozen-input',
      requiredAuthorization: 'operator-runbook-and-frozen-input-authorization',
    },
    {
      slice: 'compatibility-assets-tests',
      owner: 'learning-record',
      boundary: 'index.ts, assets/**, __tests__/**',
      notTouched: ['barrel-deletion', 'fixture-deletion', 'asset-deletion'],
      protectedInvariants: ['barrel-not-deleted-in-d', 'fixture-regeneration-retention'],
      payloadStatus: 'synthetic-or-redacted-only',
      zeroConsumerProof: 'zero-consumers-and-regeneration-retention-evidence',
      deletion: 'zero-consumers-and-regeneration-evidence',
      rollback: 'reversible-compatibility-surface',
      requiredAuthorization: 'future-compatibility-retirement-change-authorization',
    },
  ];
  // Task 6.2: a migration-input slice carries exactly one accountable owner and
  // one orthogonal outcome; mixed groups split per owner and per outcome instead
  // of forcing a slice-wide identity.
  const slices: FutureSlice[] = [];
  for (const spec of specs) {
    const rows = (bySlice.get(spec.slice) ?? []).filter((record) => record.status === 'qualified' && record.accountableOwner);
    const grouped = new Map<string, { owner: OwnerId; outcome: ResidualOutcome; paths: string[]; callerClasses: Set<CallerClass> }>();
    for (const record of rows) {
      const owner = record.accountableOwner as OwnerId;
      const key = `${owner}|${record.outcome}`;
      const bucket = grouped.get(key) ?? { owner, outcome: record.outcome, paths: [], callerClasses: new Set<CallerClass>() };
      bucket.paths.push(record.path);
      for (const callerClass of record.callerClasses) bucket.callerClasses.add(callerClass);
      grouped.set(key, bucket);
    }
    const entries = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
    const ownerOutcomeCounts = new Map<string, number>();
    for (const [key] of entries) {
      const owner = key.split('|')[0] ?? '';
      ownerOutcomeCounts.set(owner, (ownerOutcomeCounts.get(owner) ?? 0) + 1);
    }
    for (const [key, group] of entries) {
      const [owner, outcome] = key.split('|');
      const ownerHasMixedOutcomes = (ownerOutcomeCounts.get(owner) ?? 0) > 1;
      slices.push({
        slice: `${spec.slice}${owner === spec.owner ? '' : `:${owner}`}${ownerHasMixedOutcomes ? `:${outcome}` : ''}`,
        accountableOwner: group.owner,
        outcome: group.outcome,
        callerClasses: [...group.callerClasses].sort(),
        paths: group.paths.sort(),
        publicBoundary: spec.boundary,
        notTouched: spec.notTouched,
        protectedInvariants: spec.protectedInvariants,
        payloadStatus: spec.payloadStatus,
        zeroConsumerProof: spec.zeroConsumerProof,
        deletionCondition: spec.deletion,
        rollback: spec.rollback,
        requiredAuthorization: spec.requiredAuthorization,
      });
    }
  }
  return slices;
}

export function projectResidualDocuments(result: ResidualAdjudication): Record<string, string> {
  const byOutcome = result.summaries.byOutcome;
  const matrixRows = result.families.map((family) => [
    family.familyId,
    family.accountableOwner ?? 'none',
    family.outcome,
    String(family.memberIds.length),
    family.memberIds.join(' '),
  ]);
  return {
    'decision-matrix.md': [
      '# Residual Data Governance decision matrix',
      '',
      `- schemaVersion: \`${result.schemaVersion}\``,
      `- currentSubjectCommit: \`${result.subject.currentSubject.subjectCommit}\``,
      `- currentSubjectTree: \`${result.subject.currentSubject.subjectTree}\``,
      `- memberSetDigest: \`${result.subject.memberSetDigest}\``,
      `- tool.entryBundleDigest: \`${result.tool.entryBundleDigest}\``,
      `- predecessor1883.successorCaptureId: \`${result.subject.successorCaptureId}\``,
      `- predecessor1883.sourceCommit: \`${result.subject.sourceCommit}\``,
      `- predecessor1883.sourceTree: \`${result.subject.sourceTree}\``,
      `- predecessor1883.packageDigest: \`${result.subject.packageDigest}\``,
      `- predecessor1883.ownerResidueSha256: \`${result.subject.ownerResidueSha256}\``,
      `- predecessor1883.fullInventoryLocator: \`${result.subject.fullInventoryLocator}\``,
      `- predecessor1883.fullInventorySha256: \`${result.subject.fullInventorySha256}\``,
      `- predecessorBaseline.sourceCommit: \`${REQUIRED_BASELINE.sourceCommit}\``,
      `- qualified: \`${result.qualified ? 'yes' : 'no'}\``,
      `- decisionIdentity: \`${result.decisionIdentity}\``,
      '',
      '| familyId | accountableOwner | outcome | count | memberIds |',
      '| --- | --- | --- | --- | --- |',
      ...matrixRows.map((row) => `| ${row.map((cell) => cell.replaceAll('|', '\\|')).join(' | ')} |`),
      '',
    ].join('\n'),
    'summaries.md': [
      '# Residual Data Governance summaries',
      '',
      `- members: ${result.summaries.memberCount}`,
      `- recordQualified: ${result.summaries.qualifiedCount}`,
      `- packageQualified: ${result.qualified ? 'yes' : 'no'}`,
      `- unresolved: ${result.summaries.unresolvedCount}`,
      `- blockers: ${result.blockers.join(', ') || 'none'}`,
      '',
      '| outcome | count |',
      '| --- | --- |',
      ...Object.entries(byOutcome).map(([outcome, count]) => `| ${outcome} | ${count} |`),
      '',
      '| accountableOwner | count |',
      '| --- | --- |',
      ...Object.entries(result.summaries.byOwner).sort().map(([owner, count]) => `| ${owner} | ${count} |`),
      '',
      'Owner and outcome are serialized separately. Unresolved records block scoped and global charter qualification.',
      '',
    ].join('\n'),
    'future-slices.md': [
      '# Residual Data Governance future slices',
      '',
      ...(result.futureSlices.length === 0
        ? [
          'No migration-input slice is emitted: the whole package must qualify before any slice can become a migration input.',
          `- packageQualified: \`${result.qualified ? 'yes' : 'no'}\``,
          `- blockers: ${result.blockers.join(', ') || 'none'}`,
          '',
        ]
        : ['Each slice is a migration input, not authorization to act. Readers must verify subject/tool/schema identities.', '']),
      ...result.futureSlices.flatMap((slice) => [
        `## ${slice.slice}`,
        '',
        `- accountableOwner: \`${slice.accountableOwner}\``,
        `- outcome: \`${slice.outcome}\``,
        `- callerClasses: ${slice.callerClasses.join(', ') || 'none'}`,
        `- publicBoundary: ${slice.publicBoundary}`,
        `- notTouched: ${slice.notTouched.join(', ')}`,
        `- protectedInvariants: ${slice.protectedInvariants.join(', ')}`,
        `- payloadStatus: ${slice.payloadStatus}`,
        `- zeroConsumerProof: ${slice.zeroConsumerProof}`,
        `- deletionCondition: ${slice.deletionCondition}`,
        `- rollback: ${slice.rollback}`,
        `- requiredAuthorization: ${slice.requiredAuthorization}`,
        `- paths: ${slice.paths.length === 0 ? '_none_' : slice.paths.map((path) => `\`${path}\``).join(' ')}`,
        '',
      ]),
    ].join('\n'),
    'handoff.md': [
      '# Residual Data Governance handoff',
      '',
      `- status: \`${result.qualified ? 'COMPLETE-qualified' : 'COMPLETE-non-qualified-BLOCKER'}\``,
      `- currentSubjectCommit: \`${result.subject.currentSubject.subjectCommit}\``,
      `- decisionIdentity: \`${result.decisionIdentity}\``,
      `- successorCaptureId: \`${result.subject.successorCaptureId}\``,
      `- packageDigest: \`${result.subject.packageDigest}\``,
      `- tool.entryBundleDigest: \`${result.tool.entryBundleDigest}\``,
      `- fullLedger.locator: \`${result.fullLedger.logicalLocator}\``,
      `- fullLedger.bytes: ${result.fullLedger.byteCount}`,
      `- fullLedger.sha256: \`${result.fullLedger.sha256}\``,
      `- unresolvedCount: ${result.summaries.unresolvedCount}`,
      `- blockers: ${result.blockers.join(', ') || 'none'}`,
      '',
      'This change does not move source, alter Prisma, deploy, open an Issue, or activate a production selector.',
      '',
    ].join('\n'),
  };
}


/** Loads the upstream #1916 payload-eligibility compact index from its committed location. */
export function loadUpstreamPayloadEvidence(repoRoot: string): UpstreamPayloadEvidence {
  const raw = readFileSync(join(repoRoot, UPSTREAM_PAYLOAD_CHANGE.compactIndexLocator), 'utf8');
  const index = JSON.parse(raw) as {
    packageDigest?: string;
    schemaVersion?: string;
    subjectIdentity?: string;
    status?: string;
    slices?: { unresolved?: number }[];
  };
  if (!index.packageDigest || index.schemaVersion !== 'act-repository-payload-classification/v2' || !index.subjectIdentity
    || !index.status) {
    throw new Error('upstream-payload-identity-unreadable');
  }
  const unresolvedMembers = (index.slices ?? []).reduce((sum, slice) => sum + (slice.unresolved ?? 0), 0);
  return {
    issue: UPSTREAM_PAYLOAD_CHANGE.issue,
    closed: true,
    archived: true,
    subjectIdentity: index.subjectIdentity,
    packageDigest: index.packageDigest,
    schemaVersion: index.schemaVersion,
    status: index.status,
    unresolvedMembers,
  };
}

/** Loads the immutable #1883 predecessor comparison identity from its archived compact index. */
export function loadPredecessorComparison(repoRoot: string): PredecessorComparison {
  const raw = readFileSync(join(repoRoot, PREDECESSOR_1883.compactIndexLocator), 'utf8');
  const index = JSON.parse(raw) as {
    decisionIdentity?: string;
    families?: unknown[];
    records?: unknown[];
    qualified?: boolean;
  };
  const recordCount = Array.isArray(index.records) ? index.records.length
    : Array.isArray(index.families) ? index.families.reduce((sum: number, family) => {
      const members = (family as { memberIds?: unknown[] }).memberIds;
      return sum + (Array.isArray(members) ? members.length : 0);
    }, 0)
    : 0;
  if (!index.decisionIdentity) throw new Error('predecessor-1883-unreadable');
  return {
    decisionIdentity: index.decisionIdentity,
    recordCount,
    qualified: index.qualified === true,
  };
}

/** Independently reads the written full-ledger bytes back and verifies every embedded identity against them. */
export function verifyResidualLedgerArtifact(params: {
  readonly ledgerAbsolutePath: string;
  readonly expectedLocator: string;
  readonly expectedSha256: string;
  readonly expectedByteCount: number;
  readonly expectedMemberDenominator: number;
  readonly projectionsReconciled: boolean;
}): LedgerVerificationReceipt | { error: string } {
  let bytes: Buffer;
  try {
    bytes = readFileSync(params.ledgerAbsolutePath);
  } catch {
    return { error: 'ledger-unreadable' };
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== params.expectedSha256) return { error: 'ledger-sha256-mismatch' };
  if (bytes.byteLength !== params.expectedByteCount) return { error: 'ledger-byte-count-mismatch' };
  const parsed = JSON.parse(bytes.toString('utf8')) as {
    identity?: {
      subjectCommit?: string;
      subjectTree?: string;
      toolCommit?: string;
      schemaVersion?: string;
      memberSetDigest?: string;
      callerBundleDigest?: string;
    };
    records?: unknown[];
    families?: unknown[];
  };
  const memberDenominator = Array.isArray(parsed.records) ? parsed.records.length : -1;
  if (memberDenominator !== params.expectedMemberDenominator) return { error: 'ledger-member-mismatch' };
  const identity = parsed.identity;
  if (!identity?.subjectCommit || !identity.subjectTree || !identity.toolCommit
    || !identity.schemaVersion || !identity.memberSetDigest || !identity.callerBundleDigest) {
    return { error: 'ledger-identity-missing' };
  }
  if (identity.schemaVersion !== RESIDUAL_SCHEMA_VERSION) return { error: 'ledger-schema-mismatch' };
  const familiesDigest = sha256Text(serializeDeterministic(parsed.families ?? []));
  return {
    locator: params.expectedLocator,
    byteCount: bytes.byteLength,
    sha256,
    memberDenominator,
    subjectCommit: identity.subjectCommit,
    subjectTree: identity.subjectTree,
    toolCommit: identity.toolCommit,
    schemaVersion: identity.schemaVersion,
    memberSetDigest: identity.memberSetDigest,
    callerBundleDigest: identity.callerBundleDigest,
    familiesDigest,
    projectionsReconciled: params.projectionsReconciled,
  };
}

export interface ResidualProjectionVerification {
  readonly reconciled: boolean;
  readonly reason?: string;
  readonly fileDigests: Readonly<Record<string, string>>;
}

/**
 * Re-reads the actually written compact projections and reconciles their bytes
 * against a fresh render of the final adjudication plus the receipt-bound
 * subject identity. The receipt may claim reconciliation only after this check.
 */
export function verifyResidualProjectionArtifacts(params: {
  readonly outputDir: string;
  readonly result: ResidualAdjudication;
  readonly receiptSubjectCommit: string;
}): ResidualProjectionVerification {
  const expected = projectResidualDocuments(params.result);
  const fileDigests: Record<string, string> = {};
  for (const [name, content] of Object.entries(expected)) {
    let written: string;
    try {
      written = readFileSync(join(params.outputDir, name), 'utf8');
    } catch {
      return { reconciled: false, reason: `projection-missing:${name}`, fileDigests };
    }
    if (normalizeProjection(written) !== normalizeProjection(content)) {
      return { reconciled: false, reason: `projection-content-mismatch:${name}`, fileDigests };
    }
    fileDigests[name] = sha256Text(normalizeProjection(content));
  }
  const matrix = normalizeProjection(expected['decision-matrix.md'] ?? '');
  if (!matrix.includes(`currentSubjectCommit: \`${params.receiptSubjectCommit}\``)) {
    return { reconciled: false, reason: 'projection-subject-mismatch', fileDigests };
  }
  return { reconciled: true, fileDigests };
}

function normalizeProjection(text: string): string {
  return text.replace(/\n+$/u, '\n');
}

/** Resolves the claim-time current adjudication subject from the frozen integration ref. */
export function resolveResidualCurrentSubject(repoRoot: string): ResidualCurrentSubject {
  const subjectCommit = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'origin/integration^{commit}'], { encoding: 'utf8' }).trim();
  const subjectTree = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'origin/integration^{tree}'], { encoding: 'utf8' }).trim();
  return { baseBranch: RESIDUAL_CURRENT_SUBJECT_BASE, subjectCommit, subjectTree };
}
