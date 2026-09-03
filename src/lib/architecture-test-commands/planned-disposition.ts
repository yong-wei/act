import { assignOwner } from '@/lib/architecture-charter/assign';
import { privacyViolation } from '@/lib/architecture-census/privacy';
import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';

import type { SubjectIdentity, ToolIdentity } from './investigation-identity';
import { PLANNED_DISPOSITION_SCHEMA_VERSION, isDefaultMandatory, laneIdFor } from './investigation-identity';
import type { GovernedCommandId, QualificationFailure } from './types';

export const PLANNED_DISPOSITIONS = ['FIX', 'DELETE', 'QUARANTINE', 'BLOCKED'] as const;
export const QUARANTINE_SUBTYPES = ['release-input'] as const;
export const BLOCKED_REASONS = ['external-blocker'] as const;
export const FORBIDDEN_PLANNED_VALUES = [
  'accepted',
  'silent-skip',
  'skip',
  'flaky-retry',
  'quarantine',
  'remove',
  'fix',
  'release-input',
  'external-blocker',
] as const;

export type PlannedDisposition = (typeof PLANNED_DISPOSITIONS)[number];
export type QuarantineSubtype = (typeof QUARANTINE_SUBTYPES)[number];
export type BlockedReason = (typeof BLOCKED_REASONS)[number];

export interface PlannedDispositionRecord {
  readonly schemaVersion: typeof PLANNED_DISPOSITION_SCHEMA_VERSION;
  readonly fingerprint: string;
  readonly command: GovernedCommandId;
  readonly lane: string;
  readonly testIdentity: string;
  readonly failureStage: string;
  readonly errorClass: string;
  readonly errorSummary: string;
  readonly artifactIdentity: string;
  readonly subject: SubjectIdentity;
  readonly tool: ToolIdentity;
  readonly disposition: PlannedDisposition;
  readonly owner: string;
  readonly rootCauseEvidenceLocator: string;
  readonly closureCondition: string;
  readonly clusterId: string | null;
  readonly members: readonly string[];
  readonly subtype?: QuarantineSubtype;
  readonly namedLane?: string;
  readonly expiry?: string;
  readonly migrationCondition?: string;
  readonly blockedReason?: BlockedReason;
  readonly resolutionCondition?: string;
  readonly responseClass?: string;
}

export interface PlannedDispositionInput {
  readonly command: GovernedCommandId;
  readonly testIdentity: string;
  readonly failureStage: string;
  readonly errorClass: string;
  readonly errorSummary: string;
  readonly artifactIdentity: string;
  readonly subject: SubjectIdentity;
  readonly tool: ToolIdentity;
  readonly disposition: PlannedDisposition;
  readonly owner?: string;
  readonly rootCauseEvidenceLocator: string;
  readonly closureCondition: string;
  readonly clusterId?: string | null;
  readonly members?: readonly string[];
  readonly subtype?: QuarantineSubtype;
  readonly namedLane?: string;
  readonly expiry?: string;
  readonly migrationCondition?: string;
  readonly blockedReason?: BlockedReason;
  readonly resolutionCondition?: string;
  readonly responseClass?: string;
}

export function fingerprintPlannedFailure(input: {
  readonly command: GovernedCommandId;
  readonly testIdentity: string;
  readonly failureStage: string;
  readonly errorClass: string;
  readonly errorSummary: string;
  readonly artifactIdentity: string;
  readonly subject: SubjectIdentity;
  readonly tool: ToolIdentity;
}): string {
  return sha256Text(serializeDeterministic({
    command: input.command,
    lane: laneIdFor(input.command),
    testIdentity: input.testIdentity,
    failureStage: input.failureStage,
    errorClass: input.errorClass,
    errorSummary: normalizeSummary(input.errorSummary),
    artifactIdentity: input.artifactIdentity,
    successorCaptureId: input.subject.successorCaptureId,
    sourceCommit: input.subject.sourceCommit,
    sourceTree: input.subject.sourceTree,
    toolCommit: input.tool.toolCommit,
    toolTree: input.tool.toolTree,
  }));
}

export function createPlannedDisposition(input: PlannedDispositionInput): PlannedDispositionRecord {
  const fingerprint = fingerprintPlannedFailure(input);
  const owner = input.owner?.trim() || ownerFor(input.testIdentity);
  return {
    schemaVersion: PLANNED_DISPOSITION_SCHEMA_VERSION,
    fingerprint,
    command: input.command,
    lane: laneIdFor(input.command),
    testIdentity: input.testIdentity,
    failureStage: input.failureStage,
    errorClass: input.errorClass,
    errorSummary: normalizeSummary(input.errorSummary),
    artifactIdentity: input.artifactIdentity,
    subject: input.subject,
    tool: input.tool,
    disposition: input.disposition,
    owner,
    rootCauseEvidenceLocator: input.rootCauseEvidenceLocator,
    closureCondition: input.closureCondition,
    clusterId: input.clusterId ?? null,
    members: input.members ?? [fingerprint],
    ...(input.subtype ? { subtype: input.subtype } : {}),
    ...(input.namedLane ? { namedLane: input.namedLane } : {}),
    ...(input.expiry ? { expiry: input.expiry } : {}),
    ...(input.migrationCondition ? { migrationCondition: input.migrationCondition } : {}),
    ...(input.blockedReason ? { blockedReason: input.blockedReason } : {}),
    ...(input.resolutionCondition ? { resolutionCondition: input.resolutionCondition } : {}),
    ...(input.responseClass ? { responseClass: input.responseClass } : {}),
  };
}

export function validatePlannedDisposition(input: unknown): QualificationFailure[] {
  if (!isRecord(input)) return [{ code: 'planned-disposition-shape', identity: 'root' }];
  const failures: QualificationFailure[] = [];
  if (input.schemaVersion !== PLANNED_DISPOSITION_SCHEMA_VERSION) {
    failures.push({ code: 'planned-disposition-schema', identity: String(input.schemaVersion ?? 'missing') });
  }
  required(input, failures, 'fingerprint');
  required(input, failures, 'command');
  required(input, failures, 'lane');
  required(input, failures, 'testIdentity');
  required(input, failures, 'failureStage');
  required(input, failures, 'errorClass');
  required(input, failures, 'errorSummary');
  required(input, failures, 'artifactIdentity');
  required(input, failures, 'owner');
  required(input, failures, 'rootCauseEvidenceLocator');
  required(input, failures, 'closureCondition');
  if (!isPlanned(input.disposition)) {
    const code = isForbidden(input.disposition) ? 'planned-disposition-forbidden' : 'planned-disposition-invalid';
    failures.push({ code, identity: String(input.disposition ?? 'missing') });
  }
  if (!isRecord(input.subject)) failures.push({ code: 'planned-disposition-subject-missing', identity: 'subject' });
  if (!isRecord(input.tool)) failures.push({ code: 'planned-disposition-tool-missing', identity: 'tool' });
  if (!Array.isArray(input.members) || input.members.length === 0) {
    failures.push({ code: 'planned-disposition-members-missing', identity: 'members' });
  }
  if (input.disposition === 'QUARANTINE') {
    if (input.subtype !== 'release-input') {
      failures.push({ code: 'planned-quarantine-subtype-invalid', identity: String(input.subtype ?? 'missing') });
    }
    required(input, failures, 'namedLane', 'planned-quarantine-lane-missing');
    required(input, failures, 'expiry', 'planned-quarantine-expiry-missing');
    required(input, failures, 'migrationCondition', 'planned-quarantine-migration-missing');
    if (typeof input.namedLane === 'string' && (input.namedLane === 'default' || isDefaultLaneName(input.namedLane))) {
      failures.push({ code: 'planned-quarantine-default-lane', identity: input.namedLane });
    }
  }
  if (input.disposition === 'BLOCKED') {
    if (input.blockedReason !== 'external-blocker') {
      failures.push({ code: 'planned-blocked-reason-invalid', identity: String(input.blockedReason ?? 'missing') });
    }
    required(input, failures, 'resolutionCondition', 'planned-blocked-resolution-missing');
    required(input, failures, 'responseClass', 'planned-blocked-response-missing');
  }
  if (input.disposition === 'DELETE') {
    if (!String(input.rootCauseEvidenceLocator ?? '').includes('retirement') && !String(input.closureCondition ?? '').includes('retir')) {
      failures.push({ code: 'planned-delete-retirement-evidence-missing', identity: String(input.testIdentity ?? 'testIdentity') });
    }
  }
  const privacy = privacyViolation(JSON.stringify(input));
  if (privacy) failures.push({ code: `privacy-${privacy}`, identity: 'planned-disposition' });
  if (workaroundText(input)) failures.push({ code: 'planned-disposition-workaround', identity: 'closureCondition' });
  return uniqueFailures(failures);
}

export function plannedDispositionBlocksDefault(record: PlannedDispositionRecord): boolean {
  if (isDefaultMandatory(record.command) || record.lane === 'default') return true;
  if (record.disposition === 'QUARANTINE' && (record.lane === 'default' || !record.namedLane || !record.expiry)) return true;
  return false;
}

export function clusterPlannedDispositions(
  records: readonly PlannedDispositionRecord[],
): readonly PlannedDispositionRecord[] {
  const groups = new Map<string, PlannedDispositionRecord[]>();
  for (const record of records) {
    const key = `${record.command}:${record.errorClass}:${record.errorSummary}:${record.disposition}`;
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  const clustered: PlannedDispositionRecord[] = [];
  for (const members of groups.values()) {
    if (members.length === 1) {
      clustered.push(members[0]!);
      continue;
    }
    const clusterId = sha256Text(serializeDeterministic(members.map((item) => item.fingerprint).sort()));
    const fingerprints = members.map((item) => item.fingerprint).sort();
    for (const member of members) {
      clustered.push({ ...member, clusterId, members: fingerprints });
    }
  }
  return clustered.sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));
}

function ownerFor(identity: string): string {
  return assignOwner({
    id: `test:${identity}`,
    kind: 'test',
    identity,
    evidence: [identity],
  });
}

function normalizeSummary(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().slice(0, 200);
}

function isPlanned(value: unknown): value is PlannedDisposition {
  return typeof value === 'string' && PLANNED_DISPOSITIONS.includes(value as PlannedDisposition);
}

function isForbidden(value: unknown): boolean {
  return typeof value === 'string' && FORBIDDEN_PLANNED_VALUES.includes(value as typeof FORBIDDEN_PLANNED_VALUES[number]);
}

function isDefaultLaneName(lane: string): boolean {
  return lane === 'default' || lane === 'test' || lane.includes('pr-default');
}

function required(
  input: Record<string, unknown>,
  failures: QualificationFailure[],
  field: string,
  code = `planned-disposition-${field}-missing`,
): void {
  const value = input[field];
  if (typeof value !== 'string' || value.trim().length === 0) failures.push({ code, identity: field });
}

function workaroundText(input: Record<string, unknown>): boolean {
  const blob = JSON.stringify({
    closureCondition: input.closureCondition,
    rootCauseEvidenceLocator: input.rootCauseEvidenceLocator,
    errorSummary: input.errorSummary,
  });
  return /accepted|silent[-_ ]?skip|flaky[-_ ]?retry|permanent[-_ ]?quarantine|widen(?:ed)? assertions|timeout inflation/iu.test(blob);
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
