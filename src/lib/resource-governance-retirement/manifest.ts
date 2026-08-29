/**
 * Immutable resource-governance retirement manifest (#1592).
 */

import {
  RESOURCE_GOVERNANCE_RETIREMENT_BUILDER_VERSION,
  RESOURCE_GOVERNANCE_RETIREMENT_MANIFEST_CONTRACT,
  ResourceGovernanceRetirementGateError,
  type ProtectedSurfaceScan,
  type ResourceGovernanceChangeSurface,
  type ResourceGovernanceGraph,
  type ResourceGovernanceRetirementManifest,
  type RetirementDisposition,
  type ReviewerDecision,
  type ZeroCallerReceipt,
} from './contracts';
import { archiveCoverageReasons, verifyRollbackArchive } from './archive';
import { hashCandidateSet, hashDenominator, receiptIntegrityReasons } from './scan';
import { isGitRevision, isSha256Hex, retirementDigest } from './hash';
import { compareLedgers, ledgerRowIdentityMatches } from './ledger';
import { replacementIsImplemented, replacementParityFails } from './replacement';

const INVARIANTS = {
  doesNotWriteAuthority: true as const,
  doesNotWriteTeachingProjection: true as const,
  doesNotWriteRuntimeRelease: true as const,
  doesNotWriteSelectors: true as const,
  doesNotDeploy: true as const,
  doesNotIncludePrismaMigration: true as const,
  doesNotCreatePermanentFacade: true as const,
  failClosedOnMissingEvidence: true as const,
};

export function changeSurfaceReasons(
  surface: ResourceGovernanceChangeSurface,
): string[] {
  const reasons: string[] = [];
  if (surface.writesAuthority) reasons.push('writes-authority');
  if (surface.writesTeachingProjection) reasons.push('writes-teaching-projection');
  if (surface.writesRuntimeRelease) reasons.push('writes-runtime-release');
  if (surface.writesSelectors) reasons.push('writes-selectors');
  if (surface.writesProductionDeployment) reasons.push('writes-production-deployment');
  if (surface.writesLearningRecords) reasons.push('writes-learning-records');
  if (surface.writesHistoricalArtifacts) reasons.push('writes-historical-artifacts');
  if (surface.includesPrismaMigration) reasons.push('prisma-migration-not-allowed');
  if (surface.usesDirectoryOrGlobDeletion) reasons.push('directory-or-glob-deletion');
  return reasons;
}

export function collectManifestReasons(input: {
  graph: ResourceGovernanceGraph;
  reviewerDecision: ReviewerDecision;
  protectedSurfaceScan: ProtectedSurfaceScan;
  zeroCallerReceipts: readonly ZeroCallerReceipt[];
}): string[] {
  const { graph } = input;
  const reasons: string[] = [];

  if (!isGitRevision(graph.captureRevision)) reasons.push('capture-revision-invalid');
  if (!isGitRevision(graph.headRevision)) reasons.push('head-revision-invalid');
  if (
    isGitRevision(graph.captureRevision)
    && isGitRevision(graph.headRevision)
    && graph.captureRevision !== graph.headRevision
  ) {
    reasons.push('capture-head-revision-mismatch');
  }

  if (graph.candidates.length === 0) {
    reasons.push('candidate-set-empty');
  }

  const candidateIds = new Set(graph.candidates.map((row) => row.id));
  for (const id of Object.keys(graph.callersByCandidate)) {
    if (!candidateIds.has(id)) reasons.push(`denominator-unknown-candidate:${id}`);
  }
  for (const candidate of graph.candidates) {
    if (!(candidate.id in graph.callersByCandidate)) {
      reasons.push(`denominator-missing-candidate:${candidate.id}`);
    }
    if (candidate.migrationRevision !== graph.captureRevision) {
      reasons.push(`migration-revision-mismatch:${candidate.id}`);
    }
    if (candidate.replacement.captureRevision !== graph.captureRevision) {
      reasons.push(`replacement-revision-mismatch:${candidate.id}`);
    }
    reasons.push(
      ...replacementIsImplemented(candidate.replacement).map(
        (reason) => `${candidate.id}:${reason}`,
      ),
    );
    reasons.push(
      ...replacementParityFails(candidate.replacement).map(
        (reason) => `${candidate.id}:${reason}`,
      ),
    );
    if (!candidate.replacement.implemented) {
      reasons.push(`candidate-not-replaced-by-r1-r2-r3:${candidate.id}`);
    }
    const ledger = graph.currentLedger.entries.find((row) => row.id === candidate.id);
    if (ledger && !ledgerRowIdentityMatches(ledger, candidate)) {
      reasons.push(`ledger-identity-mismatch:${candidate.id}`);
    }
  }

  reasons.push(...changeSurfaceReasons(graph.changeSurface));
  reasons.push(...compareLedgers(graph.priorLedger, graph.currentLedger));
  reasons.push(...verifyRollbackArchive(graph.rollbackArchive, graph.archiveBytes));
  const wouldDelete = deletionsAuthorizedByEvidence({
    graph,
    protectedSurfaceScan: input.protectedSurfaceScan,
    zeroCallerReceipts: input.zeroCallerReceipts,
  });
  reasons.push(
    ...archiveCoverageReasons(
      graph.rollbackArchive,
      graph.archiveBytes,
      graph.candidates.filter((candidate) => wouldDelete.includes(candidate.id)),
    ),
  );

  if (graph.rollbackArchive.captureRevision !== graph.captureRevision) {
    reasons.push('archive-capture-revision-mismatch');
  }
  if (graph.currentLedger.captureRevision !== graph.captureRevision) {
    reasons.push('ledger-capture-revision-mismatch');
  }
  if (graph.protectedSurfaces.length === 0) {
    reasons.push('protected-surfaces-missing');
  }
  if (!input.protectedSurfaceScan.intact) {
    reasons.push('protected-surface-scan-not-intact');
  }
  if (input.protectedSurfaceScan.captureRevision !== graph.captureRevision) {
    reasons.push('protected-surface-revision-mismatch');
  }
  if (!isSha256Hex(input.protectedSurfaceScan.scanDigest)) {
    reasons.push('protected-surface-digest-missing');
  }
  for (const receipt of input.zeroCallerReceipts) {
    if (receipt.captureRevision !== graph.captureRevision) {
      reasons.push(`zero-caller-revision-mismatch:${receipt.candidateId}`);
    }
    if (!isSha256Hex(receipt.receiptDigest)) {
      reasons.push(`zero-caller-digest-missing:${receipt.candidateId}`);
    }
    reasons.push(...receiptIntegrityReasons(receipt));
  }
  if (input.reviewerDecision === 'unreviewed') {
    reasons.push('reviewer-unreviewed');
  }

  return [...new Set(reasons)].sort();
}

export function deletionsAuthorizedByEvidence(input: {
  graph: ResourceGovernanceGraph;
  protectedSurfaceScan: ProtectedSurfaceScan;
  zeroCallerReceipts: readonly ZeroCallerReceipt[];
}): string[] {
  return input.graph.candidates
    .filter((candidate) => {
      if (!candidate.retireable) return false;
      if (input.protectedSurfaceScan.reachableFromProtected.includes(candidate.id)) {
        return false;
      }
      const receipt = input.zeroCallerReceipts.find((row) => row.candidateId === candidate.id);
      if (!receipt) return false;
      if (receiptIntegrityReasons(receipt).length > 0) return false;
      if (receipt.hits.length !== 0) return false;
      const ledger = input.graph.currentLedger.entries.find((row) => row.id === candidate.id);
      if (!ledger || ledger.state !== 'retained') return false;
      if (!ledgerRowIdentityMatches(ledger, candidate)) return false;
      return candidate.replacement.implemented
        && candidate.replacement.parity.facade === false;
    })
    .map((candidate) => candidate.id)
    .sort();
}

export function buildResourceGovernanceRetirementManifest(input: {
  retirementId: string;
  graph: ResourceGovernanceGraph;
  reviewedAt?: string | null;
  reviewerDecision: ReviewerDecision;
  protectedSurfaceScan: ProtectedSurfaceScan;
  zeroCallerReceipts: readonly ZeroCallerReceipt[];
}): ResourceGovernanceRetirementManifest {
  const reasons = collectManifestReasons(input);
  const authorized = deletionsAuthorizedByEvidence(input);

  let status: RetirementDisposition = 'blocked';
  if (reasons.length === 0) {
    if (input.reviewerDecision === 'approve-delete' && authorized.length > 0) {
      status = 'ready-for-deletion';
    } else {
      status = 'retain';
    }
  }

  const body = {
    contract: RESOURCE_GOVERNANCE_RETIREMENT_MANIFEST_CONTRACT,
    builderVersion: RESOURCE_GOVERNANCE_RETIREMENT_BUILDER_VERSION,
    retirementId: input.retirementId,
    captureRevision: input.graph.captureRevision,
    headRevision: input.graph.headRevision,
    reviewedAt: input.reviewedAt ?? null,
    reviewerDecision: input.reviewerDecision,
    candidateSetHash: hashCandidateSet(input.graph.candidates),
    denominatorHash: hashDenominator(input.graph.callersByCandidate),
    replacementIdentities: input.graph.candidates.map((row) => row.replacement),
    migrationRevision: input.graph.captureRevision,
    zeroCallerReceipts: [...input.zeroCallerReceipts],
    protectedSurfaceScan: input.protectedSurfaceScan,
    rollbackArchiveDigest: input.graph.rollbackArchive.archiveDigest,
    ledgerDigest: input.graph.currentLedger.ledgerDigest,
    reviewerReasons: reasons,
    invariants: INVARIANTS,
    status,
    reasons,
  };

  return {
    ...body,
    manifestDigest: retirementDigest(body),
  };
}

export function assertManifestReadyForDeletion(
  manifest: ResourceGovernanceRetirementManifest,
): void {
  if (manifest.contract !== RESOURCE_GOVERNANCE_RETIREMENT_MANIFEST_CONTRACT) {
    throw new ResourceGovernanceRetirementGateError(
      'manifest-contract-mismatch',
      'retirement manifest contract mismatch',
    );
  }
  const { manifestDigest: _ignored, ...rest } = manifest;
  const expected = retirementDigest(rest);
  if (expected !== manifest.manifestDigest) {
    throw new ResourceGovernanceRetirementGateError(
      'manifest-digest-tamper',
      'retirement manifest digest does not match content',
      ['manifest-digest-tamper'],
    );
  }
  if (manifest.status !== 'ready-for-deletion' && manifest.status !== 'deleted') {
    throw new ResourceGovernanceRetirementGateError(
      'retirement-blocked',
      'deletion refused until the retirement manifest is ready-for-deletion',
      [...manifest.reasons],
    );
  }
  if (manifest.reviewerDecision !== 'approve-delete') {
    throw new ResourceGovernanceRetirementGateError(
      'reviewer-not-approved',
      'deletion requires reviewerDecision=approve-delete',
    );
  }
  if (!manifest.invariants.doesNotWriteSelectors) {
    throw new ResourceGovernanceRetirementGateError(
      'selector-write-forbidden',
      'retirement must not write selectors',
    );
  }
}
