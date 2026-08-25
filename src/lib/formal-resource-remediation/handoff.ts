/**
 * Immutable remediation handoff reopen (#1515, tasks 12.5/12.6).
 *
 * The downstream coordinated cutover must consume the sealed handoff
 * manifest — never a copy of its inner hash strings — so this module
 * reopens the manifest exactly the way it was sealed: every body field
 * (including notes) enters the digest with a pending handoff id, and the
 * sealed id is derived from that digest. Any edited field diverges.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  FormalResourceRemediationError,
  REMEDIATION_BUILDER_VERSION,
  REMEDIATION_HANDOFF_CONTRACT,
  type RemediationHandoffManifest,
} from './contracts';

export function handoffDigest(body: Record<string, unknown>): string {
  return projectionDigest({ ...body, handoffId: 'pending' });
}

export function reopenRemediationHandoff(
  manifest: RemediationHandoffManifest,
): RemediationHandoffManifest {
  if (manifest.contract !== REMEDIATION_HANDOFF_CONTRACT) {
    throw new FormalResourceRemediationError(
      'handoff-contract-invalid',
      `The handoff manifest uses contract ${String(manifest.contract)}, expected ${REMEDIATION_HANDOFF_CONTRACT}.`,
    );
  }
  if (manifest.builderVersion !== REMEDIATION_BUILDER_VERSION) {
    throw new FormalResourceRemediationError(
      'handoff-builder-invalid',
      `The handoff manifest was sealed by ${String(manifest.builderVersion)}, expected ${REMEDIATION_BUILDER_VERSION}.`,
    );
  }
  if (manifest.selectable !== false) {
    throw new FormalResourceRemediationError(
      'handoff-selectable-invalid',
      'The remediation handoff must be sealed non-selectable.',
    );
  }
  const { handoffId: sealedId, handoffHash: sealedHash, ...body } = manifest;
  const expectedHash = handoffDigest(body);
  if (sealedHash !== expectedHash) {
    throw new FormalResourceRemediationError(
      'handoff-hash-tampered',
      'The handoff manifest does not match its own sealed hash.',
    );
  }
  if (sealedId !== `handoff-${expectedHash.slice(0, 24)}`) {
    throw new FormalResourceRemediationError(
      'handoff-id-invalid',
      'The handoff id is not derived from the sealed hash.',
    );
  }
  return manifest;
}
