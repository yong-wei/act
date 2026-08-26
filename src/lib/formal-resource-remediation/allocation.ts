/**
 * Shared coordination-allocation reuse (#1515, tasks 1.2/1.7).
 *
 * Remediation and the downstream coordinated cutover seal and reopen ONE
 * identical allocation record. This module therefore delegates to the
 * `latest-authority-oss-cutover` schema and validator and adds only the
 * remediation-side mandatory extensions — terminology/locale identities,
 * source registries, processor registry, and course-owner identity — which
 * travel inside the shared record's `policyVersions` and
 * `implementationIdentities` dictionaries so the schema itself never forks.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  assertAllocationRecordSealed,
  sealCoordinationAllocationRecord,
  type SealAllocationInput,
} from '@/lib/latest-authority-oss-cutover/envelope';
import type { CoordinationAllocationRecord } from '@/lib/latest-authority-oss-cutover/contracts';

import {
  FormalResourceRemediationError,
  REMEDIATION_BUILDER_VERSION,
} from './contracts';

/** Fields remediation requires beyond the base allocation record. */
export interface RemediationAllocationExtensions {
  /** Terminology registry identity used for mapping and hotword normalization. */
  readonly terminologyRegistryId: string;
  /** Locale identity used for mapping and hotword normalization. */
  readonly localeIdentity: string;
  /** Content-addressed identity of every governed source registry. */
  readonly sourceRegistryIds: readonly string[];
  /** Hash of the sealed processor registry for this run. */
  readonly processorRegistryHash: string;
  /** Course-owner identity recorded for repository relation decisions. */
  readonly courseOwnerId: string;
}

const EXTENSION_KEYS = [
  'terminologyRegistryId',
  'localeIdentity',
  'sourceRegistryIds',
  'processorRegistryHash',
  'courseOwnerId',
] as const;

type ExtensionKey = (typeof EXTENSION_KEYS)[number];

function extensionKey(key: ExtensionKey): string {
  return `remediation.${key}`;
}

export type RemediationAllocation = CoordinationAllocationRecord & {
  readonly remediation: RemediationAllocationExtensions;
};

/**
 * Seal the one shared coordination allocation for a remediation run. The
 * remediation extensions are carried inside the shared dictionaries, so the
 * sealed record passes the shared validator byte-for-byte.
 */
export function sealRemediationAllocation(
  input: SealAllocationInput & { remediation: RemediationAllocationExtensions },
): RemediationAllocation {
  for (const key of EXTENSION_KEYS) {
    const value = input.remediation[key];
    if (typeof value === 'string' && value.length === 0) {
      throw new FormalResourceRemediationError(
        'allocation-extension-invalid',
        `Remediation allocation extension ${key} must be a non-empty string.`,
      );
    }
  }
  if (input.remediation.sourceRegistryIds.length === 0) {
    throw new FormalResourceRemediationError(
      'allocation-extension-invalid',
      'Remediation requires at least one governed source registry identity.',
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(input.remediation.processorRegistryHash)) {
    throw new FormalResourceRemediationError(
      'allocation-extension-invalid',
      'Remediation requires the sealed processor-registry hash.',
    );
  }
  const shared = sealCoordinationAllocationRecord({
    ...input,
    policyVersions: {
      ...input.policyVersions,
      [extensionKey('terminologyRegistryId')]: input.remediation.terminologyRegistryId,
      [extensionKey('localeIdentity')]: input.remediation.localeIdentity,
      [extensionKey('sourceRegistryIds')]: projectionDigest([...input.remediation.sourceRegistryIds].sort()),
      [extensionKey('processorRegistryHash')]: input.remediation.processorRegistryHash,
      [extensionKey('courseOwnerId')]: input.remediation.courseOwnerId,
    },
    implementationIdentities: {
      ...input.implementationIdentities,
      'remediation.builder': REMEDIATION_BUILDER_VERSION,
    },
  });
  return { ...shared, remediation: input.remediation };
}

/**
 * Reopen and verify one shared allocation through BOTH the shared validator
 * and the remediation extension checks; downstream cutover reuse must
 * observe the identical allocation hash.
 */
export function reopenRemediationAllocation(
  record: RemediationAllocation,
): RemediationAllocation {
  assertAllocationRecordSealed(record);
  for (const key of EXTENSION_KEYS) {
    if (record.policyVersions[extensionKey(key)] === undefined) {
      throw new FormalResourceRemediationError(
        'allocation-extension-missing',
        `The sealed allocation is missing the remediation extension ${key}.`,
      );
    }
  }
  const observedSourceRegistries = projectionDigest([...record.remediation.sourceRegistryIds].sort());
  if (record.policyVersions[extensionKey('sourceRegistryIds')] !== observedSourceRegistries) {
    throw new FormalResourceRemediationError(
      'allocation-extension-tampered',
      'The remediation source-registry identities do not match the sealed allocation.',
    );
  }
  if (record.implementationIdentities['remediation.builder'] !== REMEDIATION_BUILDER_VERSION) {
    throw new FormalResourceRemediationError(
      'allocation-extension-tampered',
      'The sealed allocation was not produced by the remediation builder.',
    );
  }
  return record;
}

/**
 * The downstream coordinator reuses this same allocation (never a second
 * one): prove the shared record it captured equals the remediation record.
 */
export function assertSameSharedAllocation(
  remediation: RemediationAllocation,
  downstreamShared: CoordinationAllocationRecord,
): void {
  if (remediation.allocationHash !== downstreamShared.allocationHash) {
    throw new FormalResourceRemediationError(
      'allocation-mismatch',
      `The downstream allocation ${downstreamShared.allocationHash.slice(0, 12)} is not the remediation allocation ${remediation.allocationHash.slice(0, 12)}; rerun remediation incrementally instead of relabeling.`,
    );
  }
}
