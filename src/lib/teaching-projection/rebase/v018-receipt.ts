/** Candidate receipt and selector-safety helpers for #1409. */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { projectionSha256, projectionDigest } from '../hash';
import type {
  V018AuthorityBinding,
  V018CaptureReceipt,
  V018DatabaseObservationCheck,
  V018DualBuildIdentity,
  V018ImpactEvidence,
  V018PointerSnapshot,
  V018RebaseReceipt,
} from './v018-contracts';

export class V018ReceiptError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'V018ReceiptError';
    this.code = code;
  }
}

export function readV018PointerSnapshot(repoRoot: string, relativePath: string): V018PointerSnapshot {
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

export function readV018PointerSnapshots(repoRoot: string, relativePaths: readonly string[]): V018PointerSnapshot[] {
  return [...relativePaths].sort().map((relativePath) => readV018PointerSnapshot(repoRoot, relativePath));
}

export function assertV018PointerBytesUnchanged(
  before: readonly V018PointerSnapshot[],
  after: readonly V018PointerSnapshot[],
): void {
  const beforeMap = new Map(before.map((pointer) => [pointer.path, pointer]));
  const afterMap = new Map(after.map((pointer) => [pointer.path, pointer]));
  if (beforeMap.size !== afterMap.size) throw new V018ReceiptError('pointer-drift', 'pointer set changed during inactive candidate build');
  for (const [path, source] of beforeMap) {
    const target = afterMap.get(path);
    if (!target || target.sha256 !== source.sha256 || target.bytes !== source.bytes || target.content !== source.content) {
      throw new V018ReceiptError('pointer-drift', `current pointer bytes changed: ${path}`);
    }
  }
}

export function assertV018CandidateSelectorSafety(input: {
  mode: string;
  unqualified: boolean;
  nonActivation: boolean;
  selectorConsumption: boolean;
  outputRoot: string;
  currentPointerPaths?: readonly string[];
}): void {
  if (input.mode !== 'local-disposable-non-activation') throw new V018ReceiptError('candidate-mode-invalid', 'v0.18 output must be local-disposable-non-activation');
  if (!input.unqualified || !input.nonActivation || input.selectorConsumption) throw new V018ReceiptError('candidate-selector-unsafe', 'v0.18 candidate must be explicitly unqualified/nonActivation and selector-ineligible');
  if (input.outputRoot.endsWith('/current.json') || input.outputRoot.includes('/runtime/knowledge/')) throw new V018ReceiptError('candidate-output-root-invalid', 'v0.18 candidate output cannot be a runtime/current selector path');
  if ((input.currentPointerPaths ?? []).some((path) => path.includes(input.outputRoot))) throw new V018ReceiptError('candidate-output-root-invalid', 'v0.18 candidate output overlaps a current pointer');
}

export function buildV018DualBuildIdentity(input: {
  firstProjectionId: string;
  firstProjectionHash: string;
  secondProjectionId: string;
  secondProjectionHash: string;
  firstPrerequisitePublicationId: string;
  firstPrerequisitePublicationHash: string;
  secondPrerequisitePublicationId: string;
  secondPrerequisitePublicationHash: string;
}): V018DualBuildIdentity {
  const projectionEqual = input.firstProjectionId === input.secondProjectionId && input.firstProjectionHash === input.secondProjectionHash;
  const prerequisiteEqual = input.firstPrerequisitePublicationId === input.secondPrerequisitePublicationId && input.firstPrerequisitePublicationHash === input.secondPrerequisitePublicationHash;
  if (!projectionEqual || !prerequisiteEqual) throw new V018ReceiptError('dual-build-drift', 'v0.18 dual build identities differ');
  return { ...input, byteEquivalent: true };
}

export function buildV018RebaseReceipt(input: {
  authority: V018AuthorityBinding;
  capture: V018CaptureReceipt;
  databaseObservation: V018DatabaseObservationCheck;
  mapping: V018ImpactEvidence;
  denominator: V018RebaseReceipt['denominator'];
  projection: V018RebaseReceipt['projection'];
  prerequisite: V018RebaseReceipt['prerequisite'];
  pointersBefore: readonly V018PointerSnapshot[];
  pointersAfter: readonly V018PointerSnapshot[];
  dualBuild: V018DualBuildIdentity | null;
  blockers?: readonly string[];
}): V018RebaseReceipt {
  assertV018PointerBytesUnchanged(input.pointersBefore, input.pointersAfter);
  const blockers = [...(input.blockers ?? [])];
  if (!input.databaseObservation.accepted) blockers.push(...input.databaseObservation.findingCodes);
  if (input.mapping.reviewRequiredCount > 0) blockers.push('identity-mapping-review-required');
  if (!input.projection.gatePassed) blockers.push('projection-gate-failed');
  if (!input.prerequisite.gatePassed) blockers.push('prerequisite-gate-failed');
  const uniqueBlockers = [...new Set(blockers)].sort();
  const body = {
    contract: 'act-teaching-projection-rebase-v018/v1' as const,
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
