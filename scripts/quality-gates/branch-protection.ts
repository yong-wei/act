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
  'local-workflow-inspection',
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

function qualityGateCheckIds(registry: QualityGateRegistry): Set<string> {
  return new Set(registry.checks.map((item) => item.checkId));
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
    affectedGate: 'integration-hosted-ci-boundary',
    resolutionCondition: blocked
      ? 'Do not treat unread GitHub protection as a required CI gate; keep integration merge evidence local and prove hosted quality workflows remain absent.'
      : 'Keep GitHub required status checks free of quality-gate registry IDs; do not add pull_request or integration-push generic quality CI.',
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

export function createVerifiedLocalHostedCiBoundaryReceipt(input: {
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dirty: boolean;
  readonly capturedAt: string;
}): IntegrationProtectionReceipt {
  return createIntegrationProtectionReceipt({
    ...input,
    responseClass: 'local-workflow-inspection',
    enforcement: 'disabled',
    requiredChecks: [],
    strictStatus: null,
    requiredReviews: null,
    conversationResolution: null,
    bypassActors: [],
    status: 'verified',
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
    if (receipt.enforcement === 'unknown') failures.push({ code: 'verified-receipt-claims-unknown-enforcement', identity: receipt.branch });
  }
  const forbiddenChecks = qualityGateCheckIds(registry);
  for (const checkId of receipt.requiredChecks) {
    if (forbiddenChecks.has(checkId)) failures.push({ code: 'github-required-ci-checks-forbidden', identity: checkId });
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
