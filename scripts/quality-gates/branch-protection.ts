import { privacyViolation } from '../../src/lib/architecture-census/privacy';
import { serializeDeterministic, sha256Text } from '../../src/lib/architecture-census/serialize';
import {
  DEFAULT_QUALITY_GATE_REGISTRY,
  QUALITY_GATE_REGISTRY_SCHEMA_VERSION,
  type QualityGateRegistry,
} from './registry';

export const INTEGRATION_PROTECTION_RECEIPT_SCHEMA_VERSION = 'act-integration-protection-verification/v1' as const;
export const PROTECTION_RESPONSE_CLASSES = [
  'rest-403',
  'plan-limitation',
  'permission-denied',
  'configuration-unreadable',
  'not-configured',
  'not-queried-in-patch-worker-scope',
] as const;
export type ProtectionResponseClass = (typeof PROTECTION_RESPONSE_CLASSES)[number];
export type ProtectionStatus = 'verified' | 'blocked-unverified';

export interface IntegrationProtectionReceipt {
  readonly schemaVersion: typeof INTEGRATION_PROTECTION_RECEIPT_SCHEMA_VERSION;
  readonly receiptId: string;
  readonly branch: 'integration';
  readonly status: ProtectionStatus;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dirty: boolean;
  readonly provider: 'github';
  readonly responseClass: ProtectionResponseClass;
  readonly enforcement: 'active' | 'disabled' | 'unknown';
  readonly requiredChecks: readonly string[];
  readonly strictStatus: boolean | null;
  readonly requiredReviews: boolean | null;
  readonly conversationResolution: boolean | null;
  readonly bypassActors: readonly string[];
  readonly affectedGate: string;
  readonly resolutionCondition: string;
  readonly capturedAt: string;
}

export interface ProtectionObservation {
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dirty: boolean;
  readonly responseClass: ProtectionResponseClass;
  readonly enforcement: 'active' | 'disabled' | 'unknown';
  readonly requiredChecks: readonly string[];
  readonly strictStatus: boolean | null;
  readonly requiredReviews: boolean | null;
  readonly conversationResolution: boolean | null;
  readonly bypassActors: readonly string[];
  readonly capturedAt: string;
  readonly status?: ProtectionStatus;
}

export interface ProtectionFailure {
  readonly code: string;
  readonly identity: string;
}

function expectedIntegrationChecks(registry: QualityGateRegistry): string[] {
  return registry.checks.filter((item) => item.layer === 'integration' && item.required).map((item) => item.checkId).sort();
}

export function createIntegrationProtectionReceipt(
  observation: ProtectionObservation,
  registry: QualityGateRegistry = DEFAULT_QUALITY_GATE_REGISTRY,
): IntegrationProtectionReceipt {
  const requiredChecks = [...new Set(observation.requiredChecks)].sort();
  const blocked = observation.status === 'blocked-unverified' || observation.responseClass !== 'not-configured' && observation.enforcement === 'unknown';
  const body = {
    schemaVersion: INTEGRATION_PROTECTION_RECEIPT_SCHEMA_VERSION,
    branch: 'integration' as const,
    status: blocked ? 'blocked-unverified' as const : 'verified' as const,
    sourceCommit: observation.sourceCommit,
    sourceTree: observation.sourceTree,
    dirty: observation.dirty,
    provider: 'github' as const,
    responseClass: observation.responseClass,
    enforcement: blocked ? 'unknown' as const : observation.enforcement,
    requiredChecks,
    strictStatus: blocked ? null : observation.strictStatus,
    requiredReviews: blocked ? null : observation.requiredReviews,
    conversationResolution: blocked ? null : observation.conversationResolution,
    bypassActors: [...new Set(observation.bypassActors)].sort(),
    affectedGate: 'integration-branch-protection',
    resolutionCondition: blocked
      ? 'A platform-authorized read or exported ruleset must prove enforcement and the exact integration required-check set before claiming protection.'
      : 'Re-read the platform configuration on every protected branch-policy change.',
    capturedAt: observation.capturedAt,
  } satisfies Omit<IntegrationProtectionReceipt, 'receiptId'>;
  const serialized = serializeDeterministic(body);
  const violation = privacyViolation(serialized);
  if (violation) throw new Error(`privacy-unsafe-protection-receipt:${violation}`);
  return { ...body, receiptId: sha256Text(serialized) };
}

export function createBlockedIntegrationProtectionReceipt(input: {
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dirty: boolean;
  readonly responseClass: ProtectionResponseClass;
  readonly capturedAt: string;
}): IntegrationProtectionReceipt {
  return createIntegrationProtectionReceipt({
    ...input,
    enforcement: 'unknown',
    requiredChecks: [],
    strictStatus: null,
    requiredReviews: null,
    conversationResolution: null,
    bypassActors: [],
    status: 'blocked-unverified',
  });
}

export function validateIntegrationProtectionReceipt(
  receipt: IntegrationProtectionReceipt,
  registry: QualityGateRegistry = DEFAULT_QUALITY_GATE_REGISTRY,
): ProtectionFailure[] {
  const failures: ProtectionFailure[] = [];
  if (receipt.schemaVersion !== INTEGRATION_PROTECTION_RECEIPT_SCHEMA_VERSION) failures.push({ code: 'protection-receipt-schema', identity: receipt.branch });
  if (receipt.branch !== 'integration') failures.push({ code: 'protection-branch', identity: receipt.branch });
  if (receipt.status === 'blocked-unverified') {
    if (receipt.enforcement !== 'unknown') failures.push({ code: 'blocked-receipt-claims-enforcement', identity: receipt.branch });
    if (receipt.strictStatus !== null || receipt.requiredReviews !== null || receipt.conversationResolution !== null) failures.push({ code: 'blocked-receipt-claims-configuration', identity: receipt.branch });
  }
  if (receipt.status === 'verified') {
    if (receipt.enforcement !== 'active') failures.push({ code: 'verified-receipt-not-enforced', identity: receipt.branch });
    if (serializeDeterministic(receipt.requiredChecks) !== serializeDeterministic(expectedIntegrationChecks(registry))) failures.push({ code: 'protection-check-set-drift', identity: receipt.branch });
    if (receipt.strictStatus !== true) failures.push({ code: 'protection-strict-status-missing', identity: receipt.branch });
    if (receipt.requiredReviews !== true) failures.push({ code: 'protection-review-gate-missing', identity: receipt.branch });
    if (receipt.conversationResolution !== true) failures.push({ code: 'protection-conversation-gate-missing', identity: receipt.branch });
  }
  if (!receipt.sourceCommit || !receipt.sourceTree) failures.push({ code: 'protection-source-identity-missing', identity: receipt.branch });
  const expected = createIntegrationProtectionReceipt({
    sourceCommit: receipt.sourceCommit,
    sourceTree: receipt.sourceTree,
    dirty: receipt.dirty,
    responseClass: receipt.responseClass,
    enforcement: receipt.enforcement,
    requiredChecks: receipt.requiredChecks,
    strictStatus: receipt.strictStatus,
    requiredReviews: receipt.requiredReviews,
    conversationResolution: receipt.conversationResolution,
    bypassActors: receipt.bypassActors,
    capturedAt: receipt.capturedAt,
    status: receipt.status,
  }, registry);
  if (receipt.receiptId !== expected.receiptId) failures.push({ code: 'protection-receipt-id-drift', identity: receipt.branch });
  const privacy = privacyViolation(serializeDeterministic(receipt));
  if (privacy) failures.push({ code: `protection-privacy-${privacy}`, identity: receipt.branch });
  return [...new Map(failures.map((failure) => [`${failure.code}:${failure.identity}`, failure])).values()]
    .sort((left, right) => `${left.code}:${left.identity}`.localeCompare(`${right.code}:${right.identity}`));
}

export { QUALITY_GATE_REGISTRY_SCHEMA_VERSION };
