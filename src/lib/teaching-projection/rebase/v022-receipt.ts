/** Candidate receipt and selector-safety helpers for #1443. */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { projectionSha256, projectionDigest } from '../hash';
import type {
  V022AuthorityBinding,
  V022CaptureReceipt,
  V022DatabaseObservationCheck,
  V022DualBuildIdentity,
  V022ImpactEvidence,
  V022PointerSnapshot,
  V022RebaseReceipt,
} from './v022-contracts';

export class V022ReceiptError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'V022ReceiptError';
    this.code = code;
  }
}

export function readV022PointerSnapshot(repoRoot: string, relativePath: string): V022PointerSnapshot {
  const path = resolve(repoRoot, relativePath);
  if (!existsSync(path)) {
    return {
      path: relativePath.split('\\').join('/'),
      sha256: '',
      bytes: 0,
      content: '',
    };
  }
  const bytes = readFileSync(path);
  return {
    path: relativePath.split('\\').join('/'),
    sha256: projectionSha256(bytes),
    bytes: bytes.byteLength,
    content: bytes.toString('utf8'),
  };
}

export function readV022PointerSnapshots(repoRoot: string, relativePaths: readonly string[]): V022PointerSnapshot[] {
  return [...relativePaths].sort().map((relativePath) => readV022PointerSnapshot(repoRoot, relativePath));
}

export function assertV022PointerBytesUnchanged(
  before: readonly V022PointerSnapshot[],
  after: readonly V022PointerSnapshot[],
): void {
  const beforeMap = new Map(before.map((pointer) => [pointer.path, pointer]));
  const afterMap = new Map(after.map((pointer) => [pointer.path, pointer]));
  if (beforeMap.size !== afterMap.size) throw new V022ReceiptError('pointer-drift', 'pointer set changed during inactive candidate build');
  for (const [path, source] of beforeMap) {
    const target = afterMap.get(path);
    if (!target || target.sha256 !== source.sha256 || target.bytes !== source.bytes || target.content !== source.content) {
      throw new V022ReceiptError('pointer-drift', `current pointer bytes changed: ${path}`);
    }
  }
}

export function assertV022CandidateSelectorSafety(input: {
  mode: string;
  unqualified: boolean;
  nonActivation: boolean;
  selectorConsumption: boolean;
  outputRoot: string;
  currentPointerPaths?: readonly string[];
}): void {
  if (input.mode !== 'local-disposable-non-activation') throw new V022ReceiptError('candidate-mode-invalid', 'v0.22 output must be local-disposable-non-activation');
  if (!input.unqualified || !input.nonActivation || input.selectorConsumption) throw new V022ReceiptError('candidate-selector-unsafe', 'v0.22 candidate must be explicitly unqualified/nonActivation and selector-ineligible');
  if (input.outputRoot.endsWith('/current.json') || input.outputRoot.includes('/runtime/knowledge/')) throw new V022ReceiptError('candidate-output-root-invalid', 'v0.22 candidate output cannot be a runtime/current selector path');
  if ((input.currentPointerPaths ?? []).some((path) => path.includes(input.outputRoot))) throw new V022ReceiptError('candidate-output-root-invalid', 'v0.22 candidate output overlaps a current pointer');
}

export function buildV022DualBuildIdentity(input: {
  firstProjectionId: string;
  firstProjectionHash: string;
  secondProjectionId: string;
  secondProjectionHash: string;
  firstPrerequisitePublicationId: string;
  firstPrerequisitePublicationHash: string;
  secondPrerequisitePublicationId: string;
  secondPrerequisitePublicationHash: string;
}): V022DualBuildIdentity {
  const projectionEqual = input.firstProjectionId === input.secondProjectionId && input.firstProjectionHash === input.secondProjectionHash;
  const prerequisiteEqual = input.firstPrerequisitePublicationId === input.secondPrerequisitePublicationId && input.firstPrerequisitePublicationHash === input.secondPrerequisitePublicationHash;
  if (!projectionEqual || !prerequisiteEqual) throw new V022ReceiptError('dual-build-drift', 'v0.22 dual build identities differ');
  return { ...input, byteEquivalent: true };
}

export function buildV022RebaseReceipt(input: {
  authority: V022AuthorityBinding;
  capture: V022CaptureReceipt;
  databaseObservation: V022DatabaseObservationCheck;
  mapping: V022ImpactEvidence;
  denominator: V022RebaseReceipt['denominator'];
  projection: V022RebaseReceipt['projection'];
  prerequisite: V022RebaseReceipt['prerequisite'];
  pointersBefore: readonly V022PointerSnapshot[];
  pointersAfter: readonly V022PointerSnapshot[];
  dualBuild: V022DualBuildIdentity | null;
  blockers?: readonly string[];
}): V022RebaseReceipt {
  assertV022PointerBytesUnchanged(input.pointersBefore, input.pointersAfter);
  const blockers = [...(input.blockers ?? [])];
  if (!input.databaseObservation.accepted) blockers.push(...input.databaseObservation.findingCodes);
  if (input.mapping.reviewRequiredCount > 0) blockers.push('identity-mapping-review-required');
  if (!input.projection.gatePassed) blockers.push('projection-gate-failed');
  if (!input.prerequisite.gatePassed) blockers.push('prerequisite-gate-failed');
  const uniqueBlockers = [...new Set(blockers)].sort();
  const body = {
    contract: 'act-teaching-projection-rebase-v022/v1' as const,
    policy: 'identity-only/v1' as const,
    status: uniqueBlockers.length === 0 ? 'READY' as const : 'BLOCKED' as const,
    mode: 'local-disposable-non-activation' as const,
    unqualified: true as const,
    nonActivation: true as const,
    selectorConsumption: false as const,
    authority: input.authority,
    capture: input.capture,
    databaseObservation: input.databaseObservation,
    denominator: input.denominator,
    mapping: input.mapping,
    projection: input.projection,
    prerequisite: input.prerequisite,
    pointersBefore: [...input.pointersBefore],
    pointersAfter: [...input.pointersAfter],
    pointerBytesUnchanged: true as const,
    dualBuild: input.dualBuild,
    blockers: uniqueBlockers,
  };
  return { ...body, receiptDigest: projectionDigest(body) };
}
