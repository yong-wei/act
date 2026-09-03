import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { REQUIRED_BASELINE } from '@/lib/architecture-charter';
import { isMixedWorktree } from '@/lib/architecture-census/identity';
import { privacyViolation } from '@/lib/architecture-census/privacy';
import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';
import {
  POST_CONVERGENCE_OUTPUT_DIR,
  POST_CONVERGENCE_SCHEMA_VERSION,
  type PostConvergenceEnvelope,
} from '@/lib/architecture-census/types';
import { successorPackageDigest, verifySuccessorArtifacts } from '@/lib/architecture-census/post-convergence';

import { COMMAND_CONTRACTS } from './conventions';
import type { CommandContract, GovernedCommandId, QualificationFailure } from './types';
import { TEST_COMMAND_CORE_SCHEMA_VERSION } from './types';

export const INVESTIGATION_SCHEMA_VERSION = 'act-test-failure-denominator-investigation/v1' as const;
export const INVESTIGATION_RESULT_CORE_SCHEMA_VERSION = 'act-test-investigation-result-core/v1' as const;
export const PLANNED_DISPOSITION_SCHEMA_VERSION = 'act-test-planned-disposition/v1' as const;
export const COMPACT_PACKAGE_SCHEMA_VERSION = 'act-test-denominator-compact-package/v1' as const;

export const CONSUMABLE_SUCCESSOR_STATUSES = ['digest-verified', 'qualified-for-investigation'] as const;
export const FORBIDDEN_ACTIVE_SELECTORS = ['REQUIRED_BASELINE', 'REQUIRED_FITNESS_BUDGET', 'active-baseline'] as const;

export interface CoordinationGate {
  readonly issueClosed: boolean;
  readonly statusArchived: boolean;
  readonly blockedByResolved: boolean;
}

export interface SubjectIdentity {
  readonly successorCaptureId: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly packageDigest: string;
  readonly schemaVersion: string;
  readonly status: string;
}

export interface ToolIdentity {
  readonly toolCommit: string;
  readonly toolTree: string;
  readonly schemaVersion: string;
  readonly entryBundleDigest: string;
  readonly equalToSubject: boolean;
}

export interface InvestigationCheckoutState {
  readonly commit: string;
  readonly tree: string;
  readonly dirty: boolean;
  readonly mixedWorktree: boolean;
}

export interface InvestigationFs {
  readonly readText: (path: string) => string;
  readonly exists: (path: string) => boolean;
}

export interface InvestigationGit {
  readonly revParse: (ref: string) => string;
  readonly statusPorcelain: () => string;
  readonly lsTree: (commit: string) => readonly string[];
  readonly showToplevel: () => string;
}

export interface LoadedSuccessorSubject {
  readonly subject: SubjectIdentity;
  readonly envelope: PostConvergenceEnvelope;
  readonly failures: readonly QualificationFailure[];
}

const HEX40 = /^[a-f0-9]{40}$/u;
const HEX64 = /^[a-f0-9]{64}$/u;

export function defaultInvestigationFs(repoRoot: string): InvestigationFs {
  return {
    readText: (path) => readFileSync(resolve(repoRoot, path), 'utf8'),
    exists: (path) => existsSync(resolve(repoRoot, path)),
  };
}

export function defaultInvestigationGit(repoRoot: string): InvestigationGit {
  const git = (args: readonly string[]): string => execFileSync('git', [...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
  return {
    revParse: (ref) => git(['rev-parse', ref]),
    statusPorcelain: () => git(['status', '--porcelain']),
    lsTree: (commit) => git(['ls-tree', '-r', '--name-only', commit]).split('\n').filter(Boolean),
    showToplevel: () => git(['rev-parse', '--show-toplevel']),
  };
}

export function coordinationGateFailures(gate: CoordinationGate | null): QualificationFailure[] {
  if (!gate) return [{ code: 'a-gate-unverified', identity: 'issue-1876' }];
  const failures: QualificationFailure[] = [];
  if (!gate.issueClosed) failures.push({ code: 'a-gate-issue-open', identity: 'issue-1876' });
  if (!gate.statusArchived) failures.push({ code: 'a-gate-not-archived', identity: 'issue-1876' });
  if (!gate.blockedByResolved) failures.push({ code: 'a-gate-blocked-by-unresolved', identity: 'issue-1876' });
  return failures;
}

export function successorArtifactLocator(locator: string): string {
  if (locator.startsWith('artifacts/') || locator.startsWith('docs/')) return locator;
  return `${POST_CONVERGENCE_OUTPUT_DIR}/${locator}`;
}

export function successorArtifactPath(repoRoot: string, locator: string): string {
  return join(repoRoot, successorArtifactLocator(locator));
}

export function loadSuccessorSubject(
  repoRoot: string,
  options: { readonly fs?: InvestigationFs } = {},
): LoadedSuccessorSubject {
  const fs = options.fs ?? defaultInvestigationFs(repoRoot);
  const envelopePath = `${POST_CONVERGENCE_OUTPUT_DIR}/baseline.json`;
  const failures: QualificationFailure[] = [];
  if (!fs.exists(envelopePath)) {
    return {
      subject: emptySubject(),
      envelope: emptyEnvelope(),
      failures: [{ code: 'successor-envelope-missing', identity: envelopePath }],
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readText(envelopePath));
  } catch {
    return {
      subject: emptySubject(),
      envelope: emptyEnvelope(),
      failures: [{ code: 'successor-envelope-unreadable', identity: envelopePath }],
    };
  }
  if (!isRecord(parsed)) {
    return {
      subject: emptySubject(),
      envelope: emptyEnvelope(),
      failures: [{ code: 'successor-envelope-shape', identity: envelopePath }],
    };
  }
  const envelope = parsed as PostConvergenceEnvelope;
  if (envelope.schemaVersion !== POST_CONVERGENCE_SCHEMA_VERSION) {
    failures.push({ code: 'successor-schema-mismatch', identity: String(envelope.schemaVersion ?? 'missing') });
  }
  if (!CONSUMABLE_SUCCESSOR_STATUSES.includes(envelope.status as typeof CONSUMABLE_SUCCESSOR_STATUSES[number])) {
    failures.push({ code: 'successor-status-not-consumable', identity: String(envelope.status ?? 'missing') });
  }
  if (FORBIDDEN_ACTIVE_SELECTORS.includes(envelope.status as typeof FORBIDDEN_ACTIVE_SELECTORS[number])) {
    failures.push({ code: 'successor-active-selector-forbidden', identity: envelope.status });
  }
  if (typeof envelope.successorCaptureId !== 'string' || !HEX64.test(envelope.successorCaptureId)) {
    failures.push({ code: 'successor-capture-id-missing', identity: 'successorCaptureId' });
  }
  const sourceCommit = envelope.captureIdentity?.sourceCommit;
  const sourceTree = envelope.captureIdentity?.sourceTree;
  if (typeof sourceCommit !== 'string' || !HEX40.test(sourceCommit)) {
    failures.push({ code: 'successor-source-commit-missing', identity: 'captureIdentity.sourceCommit' });
  }
  if (typeof sourceTree !== 'string' || !HEX40.test(sourceTree)) {
    failures.push({ code: 'successor-source-tree-missing', identity: 'captureIdentity.sourceTree' });
  }
  if (typeof envelope.packageDigest !== 'string' || !HEX64.test(envelope.packageDigest)) {
    failures.push({ code: 'successor-package-digest-missing', identity: 'packageDigest' });
  } else if (successorPackageDigest(envelope) !== envelope.packageDigest) {
    failures.push({ code: 'successor-package-digest-mismatch', identity: envelope.packageDigest });
  }
  if (sourceCommit === REQUIRED_BASELINE.sourceCommit && sourceTree === REQUIRED_BASELINE.sourceTree) {
    failures.push({ code: 'successor-must-not-be-required-baseline', identity: sourceCommit ?? 'sourceCommit' });
  }
  const artifactFailures = verifySuccessorArtifacts(envelope, (locator) => {
    const relative = successorArtifactLocator(locator);
    if (!fs.exists(relative)) throw new Error('missing');
    return fs.readText(relative);
  });
  failures.push(...artifactFailures);
  const privacy = privacyViolation(JSON.stringify({
    successorCaptureId: envelope.successorCaptureId,
    sourceCommit,
    sourceTree,
    packageDigest: envelope.packageDigest,
    status: envelope.status,
  }));
  if (privacy) failures.push({ code: `privacy-${privacy}`, identity: 'subject-identity' });

  return {
    subject: {
      successorCaptureId: envelope.successorCaptureId,
      sourceCommit: sourceCommit ?? '',
      sourceTree: sourceTree ?? '',
      packageDigest: envelope.packageDigest,
      schemaVersion: envelope.schemaVersion,
      status: envelope.status,
    },
    envelope,
    failures: uniqueFailures(failures),
  };
}

export function createToolIdentity(input: {
  readonly toolCommit: string;
  readonly toolTree: string;
  readonly subject: SubjectIdentity;
  readonly entryBundleDigest: string;
  readonly schemaVersion?: string;
}): ToolIdentity {
  return {
    toolCommit: input.toolCommit,
    toolTree: input.toolTree,
    schemaVersion: input.schemaVersion ?? INVESTIGATION_SCHEMA_VERSION,
    entryBundleDigest: input.entryBundleDigest,
    equalToSubject: input.toolCommit === input.subject.sourceCommit && input.toolTree === input.subject.sourceTree,
  };
}

export function entryBundleDigest(files: Readonly<Record<string, string>>): string {
  const entries = Object.keys(files).sort().map((path) => ({ path, sha256: sha256Text(files[path] ?? '') }));
  return sha256Text(serializeDeterministic({ schemaVersion: INVESTIGATION_SCHEMA_VERSION, entries }));
}

export function readCheckoutState(
  repoRoot: string,
  options: { readonly git?: InvestigationGit } = {},
): InvestigationCheckoutState {
  const git = options.git ?? defaultInvestigationGit(repoRoot);
  const toplevel = resolve(git.showToplevel());
  const mixed = toplevel !== resolve(repoRoot) || isMixedWorktree(repoRoot);
  return {
    commit: git.revParse('HEAD'),
    tree: git.revParse('HEAD^{tree}'),
    dirty: git.statusPorcelain().length > 0,
    mixedWorktree: mixed,
  };
}

export function subjectCheckoutFailures(
  subject: SubjectIdentity,
  checkout: InvestigationCheckoutState,
): QualificationFailure[] {
  const failures: QualificationFailure[] = [];
  if (checkout.commit !== subject.sourceCommit) {
    failures.push({ code: 'subject-commit-drift', identity: checkout.commit });
  }
  if (checkout.tree !== subject.sourceTree) {
    failures.push({ code: 'subject-tree-drift', identity: checkout.tree });
  }
  if (checkout.dirty) failures.push({ code: 'dirty-worktree', identity: checkout.commit });
  if (checkout.mixedWorktree) failures.push({ code: 'mixed-worktree', identity: checkout.commit });
  return failures;
}

export function toolCheckoutFailures(
  tool: ToolIdentity,
  checkout: InvestigationCheckoutState,
): QualificationFailure[] {
  const failures: QualificationFailure[] = [];
  if (checkout.commit !== tool.toolCommit) failures.push({ code: 'tool-commit-drift', identity: checkout.commit });
  if (checkout.tree !== tool.toolTree) failures.push({ code: 'tool-tree-drift', identity: checkout.tree });
  if (checkout.dirty) failures.push({ code: 'dirty-worktree', identity: checkout.commit });
  if (checkout.mixedWorktree) failures.push({ code: 'mixed-worktree', identity: checkout.commit });
  return failures;
}

export function identityPairFailures(subject: SubjectIdentity, tool: ToolIdentity): QualificationFailure[] {
  const failures: QualificationFailure[] = [];
  if (!HEX64.test(subject.successorCaptureId)) failures.push({ code: 'subject-capture-id-missing', identity: 'successorCaptureId' });
  if (!HEX40.test(subject.sourceCommit)) failures.push({ code: 'subject-commit-missing', identity: 'sourceCommit' });
  if (!HEX40.test(subject.sourceTree)) failures.push({ code: 'subject-tree-missing', identity: 'sourceTree' });
  if (!HEX64.test(subject.packageDigest)) failures.push({ code: 'subject-digest-missing', identity: 'packageDigest' });
  if (!HEX40.test(tool.toolCommit)) failures.push({ code: 'tool-commit-missing', identity: 'toolCommit' });
  if (!HEX40.test(tool.toolTree)) failures.push({ code: 'tool-tree-missing', identity: 'toolTree' });
  if (!HEX64.test(tool.entryBundleDigest)) failures.push({ code: 'tool-entry-bundle-missing', identity: 'entryBundleDigest' });
  const equal = tool.toolCommit === subject.sourceCommit && tool.toolTree === subject.sourceTree;
  if (tool.equalToSubject !== equal) failures.push({ code: 'tool-equal-to-subject-mismatch', identity: tool.toolCommit });
  return failures;
}

export function secondIdentityReadFailures(
  first: { readonly subject: SubjectIdentity; readonly tool: ToolIdentity },
  second: { readonly subject: SubjectIdentity; readonly tool: ToolIdentity },
): QualificationFailure[] {
  const failures: QualificationFailure[] = [];
  if (serializeDeterministic(first.subject) !== serializeDeterministic(second.subject)) {
    failures.push({ code: 'subject-identity-reread-drift', identity: second.subject.sourceCommit });
  }
  if (serializeDeterministic(first.tool) !== serializeDeterministic(second.tool)) {
    failures.push({ code: 'tool-identity-reread-drift', identity: second.tool.toolCommit });
  }
  return failures;
}

export function defaultMandatoryCommands(): readonly CommandContract[] {
  return COMMAND_CONTRACTS.filter((command) => command.scope.includes('pr-default'));
}

export function isDefaultMandatory(commandId: GovernedCommandId): boolean {
  return defaultMandatoryCommands().some((command) => command.id === commandId);
}

export function laneIdFor(commandId: GovernedCommandId): string {
  if (commandId === 'test') return 'default';
  if (commandId === 'test:e2e:critical') return 'e2e-critical';
  return commandId.replace(/^test:/u, '');
}

export function listSubjectPaths(
  repoRoot: string,
  subject: SubjectIdentity,
  options: { readonly git?: InvestigationGit } = {},
): { readonly paths: readonly string[]; readonly failures: readonly QualificationFailure[] } {
  const git = options.git ?? defaultInvestigationGit(repoRoot);
  const tree = git.revParse(`${subject.sourceCommit}^{tree}`);
  if (tree !== subject.sourceTree) {
    return { paths: [], failures: [{ code: 'subject-tree-drift', identity: tree }] };
  }
  return { paths: git.lsTree(subject.sourceCommit), failures: [] };
}

function emptySubject(): SubjectIdentity {
  return {
    successorCaptureId: '',
    sourceCommit: '',
    sourceTree: '',
    packageDigest: '',
    schemaVersion: POST_CONVERGENCE_SCHEMA_VERSION,
    status: '',
  };
}

function emptyEnvelope(): PostConvergenceEnvelope {
  return {
    schemaVersion: POST_CONVERGENCE_SCHEMA_VERSION,
    successorCaptureId: '',
    status: 'captured',
    statusEvidence: [],
    captureIdentity: {
      sourceCommit: '',
      sourceTree: '',
      commitTime: '',
      nodeVersion: '',
      npmVersion: '',
      typescriptVersion: '',
    },
    originIntegrationCommit: '',
    commandScope: 'post-convergence-successor:capture',
    toolVersions: {},
    schemaVersions: {},
    predecessorBaseline: {
      schemaVersion: REQUIRED_BASELINE.schemaVersion,
      sourceCommit: REQUIRED_BASELINE.sourceCommit,
      sourceTree: REQUIRED_BASELINE.sourceTree,
      censusCoreSha256: REQUIRED_BASELINE.censusCoreSha256,
      receiptSchemaVersion: REQUIRED_BASELINE.receiptSchemaVersion,
      receiptIds: [...REQUIRED_BASELINE.receiptIds],
    },
    predecessorCurrentHead: {
      schemaVersion: 'act-architecture-current-head-delta/v1',
      sourceCommit: '',
      sourceTree: '',
      packageSha256: '',
    },
    successorCoreSha256: '',
    inventoryKindSet: [],
    predecessorKindSet: [],
    materialLayers: [],
    layerReconciliation: { trackedFileCount: 0, layerAssignedCount: 0, unassignedCount: 0 },
    denominatorSlices: [],
    ownerResidueTotals: { total: 0, observation: 0, ambiguous: 0, unresolved: 0 },
    hotspotTotals: { limit: 0, ranked: 0, unresolvedMetrics: 0 },
    payloadClassTotals: { duplicateBlobCount: 0, classes: [], unresolvedCount: 0 },
    frozenReceiptIds: [],
    handoff: [],
    artifacts: [],
    digestScope: '',
    packageDigest: '',
  } as PostConvergenceEnvelope;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function uniqueFailures(failures: readonly QualificationFailure[]): QualificationFailure[] {
  const seen = new Set<string>();
  return failures.filter((item) => {
    const key = `${item.code}:${item.identity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export { TEST_COMMAND_CORE_SCHEMA_VERSION };
