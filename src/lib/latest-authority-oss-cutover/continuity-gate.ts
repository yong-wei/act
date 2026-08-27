/**
 * Production teaching-resource continuity gate (#1509, tasks 5.x).
 *
 * Every retained active-baseline teaching resource must complete its atomic
 * binding and keep a qualified launch contract. A technical failure blocks
 * coordinated qualification and is never converted into exclusion: the
 * resource stays in the denominator with its unresolved reason. Only an
 * explicit course-owner retirement decision may remove it. A failed new or
 * changed resource remains development-only outside the successor formal
 * manifest without weakening the active baseline.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  LatestAuthorityCutoverError,
  type CombinedDenominator,
  type ContinuityFailureKind,
  type ResourceContinuityObligationKind,
  type ResourceContinuityReceipt,
  type ResourceSuccessorDisposition,
  type RetirementDecision,
} from './contracts';

export interface EvaluateContinuityGateInput {
  readonly denominator: CombinedDenominator;
  /** The active Release id the baseline was frozen from; retirements bind it exactly. */
  readonly baselineReleaseId: string;
  readonly dispositions: readonly ResourceSuccessorDisposition[];
  readonly retirements: readonly RetirementDecision[];
}

function assertRetirementDecision(decision: RetirementDecision, baselineReleaseId: string): void {
  if (decision.contract !== 'resource-owner-retirement-decision/v1') {
    throw new LatestAuthorityCutoverError(
      'retirement-contract-invalid',
      'Retirement decisions must use the retirement decision contract.',
    );
  }
  if (!decision.retirementId || typeof decision.retirementId !== 'string') {
    throw new LatestAuthorityCutoverError(
      'retirement-decision-invalid',
      'A retirement decision needs a decision identity.',
    );
  }
  if (!decision.resourceId || typeof decision.resourceId !== 'string') {
    throw new LatestAuthorityCutoverError(
      'retirement-decision-invalid',
      `Retirement decision ${decision.retirementId} names no resource.`,
    );
  }
  if (decision.activeReleaseId !== baselineReleaseId) {
    throw new LatestAuthorityCutoverError(
      'retirement-release-mismatch',
      `Retirement decision ${decision.retirementId} must bind the exact active Release ${baselineReleaseId}.`,
    );
  }
  if (!decision.reason || typeof decision.reason !== 'string') {
    throw new LatestAuthorityCutoverError(
      'retirement-decision-invalid',
      `Retirement decision ${decision.retirementId} records no reason.`,
    );
  }
  if (decision.evidenceRefs.length === 0) {
    throw new LatestAuthorityCutoverError(
      'retirement-decision-invalid',
      `Retirement decision ${decision.retirementId} carries no evidence.`,
    );
  }
  if (!decision.decidedBy || typeof decision.decidedBy !== 'string') {
    throw new LatestAuthorityCutoverError(
      'retirement-decision-invalid',
      `Retirement decision ${decision.retirementId} has no course-owner identity.`,
    );
  }
  if (!decision.decidedAt || typeof decision.decidedAt !== 'string') {
    throw new LatestAuthorityCutoverError(
      'retirement-decision-invalid',
      `Retirement decision ${decision.retirementId} has no decision timestamp.`,
    );
  }
  if (decision.invalidationRules.length === 0) {
    throw new LatestAuthorityCutoverError(
      'retirement-decision-invalid',
      `Retirement decision ${decision.retirementId} declares no invalidation rules.`,
    );
  }
}

function ledgerHash(items: readonly string[]): string {
  return projectionDigest([...items].sort((a, b) => a.localeCompare(b)));
}

/**
 * Evaluate the continuity gate over the combined denominator. The result is
 * QUALIFIED only when every retained baseline resource satisfies its sealed
 * obligation. Current-path teaching remains fail-closed on complete atomic
 * dispositions, Canonical binding, and safe launch; explicit-non-teaching and
 * supporting records remain in the denominator without fabricated bindings.
 */
export function evaluateContinuityGate(
  input: EvaluateContinuityGateInput,
): ResourceContinuityReceipt {
  const baselineReleaseId = input.baselineReleaseId;
  if (!baselineReleaseId || typeof baselineReleaseId !== 'string') {
    throw new LatestAuthorityCutoverError(
      'denominator-release-unbound',
      'The baseline active Release id must be a non-empty string.',
    );
  }
  for (const decision of input.retirements) {
    assertRetirementDecision(decision, baselineReleaseId);
  }
  const retiredByResource = new Map(input.retirements.map((decision) => [decision.resourceId, decision]));
  const dispositionsByResource = new Map(input.dispositions.map((entry) => [entry.resourceId, entry]));

  const blocked: { resourceId: string; failureKinds: readonly ContinuityFailureKind[] }[] = [];
  const included: string[] = [];
  const retired: string[] = [];
  const developmentOnly: string[] = [];
  const failed: string[] = [];

  for (const entry of input.denominator.entries) {
    const disposition = dispositionsByResource.get(entry.resourceId);
    if (entry.origin === 'BASELINE') {
      const retirement = retiredByResource.get(entry.resourceId);
      if (retirement) {
        retired.push(entry.resourceId);
        // The retirement is an omission decision, never a technical success.
        continue;
      }
      if (!disposition) {
        blocked.push({
          resourceId: entry.resourceId,
          failureKinds: ['incomplete-atomic-dispositions'],
        });
        continue;
      }
      const technicalFailures = collectTechnicalFailures(disposition);
      if (technicalFailures.length > 0) {
        blocked.push({ resourceId: entry.resourceId, failureKinds: technicalFailures });
        continue;
      }
      included.push(entry.resourceId);
      continue;
    }
    // DELTA entries: a failing new or changed resource remains development-only.
    if (!disposition || collectTechnicalFailures(disposition).length > 0) {
      developmentOnly.push(entry.resourceId);
      failed.push(entry.resourceId);
      continue;
    }
    included.push(entry.resourceId);
  }

  const ledgers = {
    includedHash: ledgerHash(included),
    retiredHash: ledgerHash(retired),
    developmentOnlyHash: ledgerHash(developmentOnly),
    failedHash: ledgerHash(failed),
    atomHash: projectionDigest(
      input.dispositions
        .filter((entry) => included.includes(entry.resourceId))
        .map((entry) => ({
          resourceId: entry.resourceId,
          obligation: obligationFor(entry),
          atomicDispositionsComplete: entry.atomicDispositionsComplete,
          obligationEvidenceHash: entry.obligationEvidenceHash ?? null,
        }))
        .sort((a, b) => a.resourceId.localeCompare(b.resourceId)),
    ),
    bindingHash: projectionDigest(
      input.dispositions
        .filter((entry) => included.includes(entry.resourceId))
        .map((entry) => ({
          resourceId: entry.resourceId,
          obligation: obligationFor(entry),
          canonicalBindingCount: entry.canonicalBindingCount,
          currentPathEligible: entry.currentPathEligible ?? false,
        }))
        .sort((a, b) => a.resourceId.localeCompare(b.resourceId)),
    ),
    launcherHash: projectionDigest(
      input.dispositions
        .filter((entry) => included.includes(entry.resourceId))
        .map((entry) => ({ resourceId: entry.resourceId, launchContractQualified: entry.launchContractQualified }))
        .sort((a, b) => a.resourceId.localeCompare(b.resourceId)),
    ),
    qualificationHash: projectionDigest({
      denominatorHash: input.denominator.denominatorHash,
      includedCount: included.length,
      retiredCount: retired.length,
      developmentOnlyCount: developmentOnly.length,
      failedCount: failed.length,
      blockedCount: blocked.length,
    }),
  };
  const receiptHash = projectionDigest({
    contract: 'resource-continuity-receipt/v1',
    denominatorHash: input.denominator.denominatorHash,
    blocked,
    ledgers,
  });
  return {
    contract: 'resource-continuity-receipt/v1',
    builderVersion: 'latest-authority-oss-cutover-builder/v1',
    denominatorHash: input.denominator.denominatorHash,
    status: blocked.length === 0 ? 'QUALIFIED' : 'BLOCKED',
    blocked,
    included,
    retired,
    developmentOnly,
    failed,
    ledgers,
    receiptHash,
  };
}

function obligationFor(disposition: ResourceSuccessorDisposition): ResourceContinuityObligationKind {
  return disposition.obligation ?? 'FORMAL_TEACHING';
}

function hasObligationEvidence(disposition: ResourceSuccessorDisposition): boolean {
  return typeof disposition.obligationEvidenceHash === 'string'
    && /^[a-f0-9]{64}$/u.test(disposition.obligationEvidenceHash);
}

function collectTechnicalFailures(disposition: ResourceSuccessorDisposition): ContinuityFailureKind[] {
  const failures: ContinuityFailureKind[] = [...disposition.failureKinds];
  const obligation = obligationFor(disposition);
  if (obligation === 'FORMAL_TEACHING') {
    if (!disposition.atomicDispositionsComplete && !failures.includes('incomplete-atomic-dispositions')) {
      failures.push('incomplete-atomic-dispositions');
    }
    if (disposition.canonicalBindingCount < 1 && !failures.includes('no-canonical-binding')) {
      failures.push('no-canonical-binding');
    }
    if (!disposition.launchContractQualified && !failures.includes('unqualified-launch-contract')) {
      failures.push('unqualified-launch-contract');
    }
    return failures;
  }

  if (!hasObligationEvidence(disposition) && !failures.includes('incomplete-atomic-dispositions')) {
    failures.push('incomplete-atomic-dispositions');
  }
  if (disposition.currentPathEligible === true && !failures.includes('no-canonical-binding')) {
    failures.push('no-canonical-binding');
  }
  if (obligation === 'FORMAL_EXPLICIT_NONE' && disposition.canonicalBindingCount !== 0
    && !failures.includes('weak-canonical-mapping')) {
    failures.push('weak-canonical-mapping');
  }
  if ((obligation === 'RUNTIME_SUPPORT' || obligation === 'CATALOG_ONLY')
    && disposition.canonicalBindingCount !== 0
    && !failures.includes('weak-canonical-mapping')) {
    failures.push('weak-canonical-mapping');
  }
  return failures;
}

/**
 * The continuity gate must block coordinated qualification: a technical
 * failure never silently removes an active teaching resource from the
 * successor.
 */
export function assertContinuityQualified(receipt: ResourceContinuityReceipt): void {
  if (receipt.status !== 'QUALIFIED') {
    const detail = receipt.blocked
      .map((item) => `${item.resourceId} (${item.failureKinds.join(', ')})`)
      .join('; ');
    throw new LatestAuthorityCutoverError(
      'continuity-gate-blocked',
      `Coordinated qualification is blocked by unresolved baseline resources: ${detail}`,
    );
  }
}

/**
 * A development-only resource must never enter the successor formal
 * manifest: its presence in the candidate ledger is bookkeeping, not
 * publication.
 */
export function assertDevelopmentOnlyExcludedFromManifest(
  manifestResourceIds: readonly string[],
  receipt: ResourceContinuityReceipt,
): void {
  const excluded = new Set([...receipt.developmentOnly, ...receipt.failed]);
  const leaked = manifestResourceIds.filter((id) => excluded.has(id));
  if (leaked.length > 0) {
    throw new LatestAuthorityCutoverError(
      'development-only-leaked',
      `Development-only resources must not enter the successor formal manifest: ${leaked.join(', ')}`,
    );
  }
}
