/**
 * `verifyResourceGovernanceRetirement(manifest, currentGraph)` (#1592).
 *
 * Recomputes candidate, denominator, replacement, protection, ledger, and
 * rollback identities. Missing, mixed, stale, unauthorized, or expanded
 * inputs fail closed and authorize no deletion.
 */

import {
  RESOURCE_GOVERNANCE_RETIREMENT_CONTRACT,
  RESOURCE_GOVERNANCE_RETIREMENT_MANIFEST_CONTRACT,
  type ResourceGovernanceGraph,
  type ResourceGovernanceRetirementManifest,
  type ResourceGovernanceRetirementVerdict,
  type RetirementDisposition,
} from './contracts';
import { verifyRollbackArchive, archiveCoverageReasons } from './archive';
import { hashCandidateSet, hashDenominator, callersMatchReceipt, scanCandidateCallers, receiptIntegrityReasons } from './scan';
import { isSha256Hex, retirementDigest } from './hash';
import { compareLedgers } from './ledger';
import { scanProtectedSurfaces } from './protected';
import { changeSurfaceReasons, deletionsAuthorizedByEvidence } from './manifest';
import { replacementIsImplemented, replacementParityFails } from './replacement';

export function verifyResourceGovernanceRetirement(
  manifest: ResourceGovernanceRetirementManifest,
  currentGraph: ResourceGovernanceGraph,
): ResourceGovernanceRetirementVerdict {
  const reasons: string[] = [];

  if (manifest.contract !== RESOURCE_GOVERNANCE_RETIREMENT_MANIFEST_CONTRACT) {
    reasons.push('manifest-contract-mismatch');
  }

  const { manifestDigest: _ignored, ...manifestBody } = manifest;
  if (!isSha256Hex(manifest.manifestDigest) || retirementDigest(manifestBody) !== manifest.manifestDigest) {
    reasons.push('manifest-digest-tamper');
  }

  if (manifest.captureRevision !== currentGraph.captureRevision) {
    reasons.push('manifest-capture-stale');
  }
  if (manifest.headRevision !== currentGraph.headRevision) {
    reasons.push('manifest-head-mismatch');
  }
  if (currentGraph.captureRevision !== currentGraph.headRevision) {
    reasons.push('mixed-revision');
  }

  const liveCandidateHash = hashCandidateSet(currentGraph.candidates);
  const liveDenominatorHash = hashDenominator(currentGraph.callersByCandidate);
  if (manifest.candidateSetHash !== liveCandidateHash) {
    reasons.push('candidate-set-hash-mismatch');
  }
  if (manifest.denominatorHash !== liveDenominatorHash) {
    reasons.push('denominator-hash-mismatch');
  }

  if (
    retirementDigest(manifest.replacementIdentities)
    !== retirementDigest(currentGraph.candidates.map((row) => row.replacement))
  ) {
    reasons.push('replacement-identity-drift');
  }
  for (const candidate of currentGraph.candidates) {
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
    if (candidate.replacement.captureRevision !== currentGraph.captureRevision) {
      reasons.push(`replacement-revision-mismatch:${candidate.id}`);
    }
  }

  const liveProtected = scanProtectedSurfaces({
    captureRevision: currentGraph.captureRevision,
    candidates: currentGraph.candidates,
    protectedSurfaces: currentGraph.protectedSurfaces,
    presentPaths: currentGraph.files.map((file) => file.path),
  });
  if (liveProtected.scanDigest !== manifest.protectedSurfaceScan.scanDigest) {
    reasons.push('protected-surface-scan-stale');
  }
  if (!liveProtected.intact) {
    reasons.push('protected-surface-scan-not-intact');
  }

  for (const candidate of currentGraph.candidates) {
    const declaredHits = currentGraph.callersByCandidate[candidate.id] ?? [];
    const scannedHits = scanCandidateCallers({
      candidate,
      files: currentGraph.files,
      excludedFrameworkFiles: currentGraph.excludedFrameworkFiles,
    });
    const receipt = manifest.zeroCallerReceipts.find((row) => row.candidateId === candidate.id);
    if (!receipt) {
      reasons.push(`zero-caller-receipt-missing:${candidate.id}`);
      continue;
    }
    reasons.push(...receiptIntegrityReasons(receipt));
    if (!callersMatchReceipt(declaredHits, receipt)) {
      reasons.push(`zero-caller-race:${candidate.id}`);
    }
    const declaredPaths = new Set(declaredHits.map((hit) => hit.path.replace(/\\/gu, '/')));
    const hidden = scannedHits.filter((hit) => !declaredPaths.has(hit.path.replace(/\\/gu, '/')));
    if (hidden.length > 0) {
      reasons.push(`hidden-caller:${candidate.id}:${hidden[0]!.path}`);
    }
  }

  reasons.push(...changeSurfaceReasons(currentGraph.changeSurface));
  reasons.push(...compareLedgers(currentGraph.priorLedger, currentGraph.currentLedger));
  if (currentGraph.currentLedger.ledgerDigest !== manifest.ledgerDigest) {
    reasons.push('ledger-digest-mismatch');
  }
  reasons.push(...verifyRollbackArchive(currentGraph.rollbackArchive, currentGraph.archiveBytes));
  if (currentGraph.rollbackArchive.archiveDigest !== manifest.rollbackArchiveDigest) {
    reasons.push('rollback-archive-digest-mismatch');
  }

  let uniqueReasons = [...new Set(reasons)].sort();
  let authorized = uniqueReasons.length === 0
    ? deletionsAuthorizedByEvidence({
      graph: currentGraph,
      protectedSurfaceScan: liveProtected,
      zeroCallerReceipts: manifest.zeroCallerReceipts,
    })
    : [];

  const archiveCoverage = archiveCoverageReasons(
    currentGraph.rollbackArchive,
    currentGraph.archiveBytes,
    currentGraph.candidates.filter((candidate) => authorized.includes(candidate.id)),
  );
  if (archiveCoverage.length > 0) {
    reasons.push(...archiveCoverage);
    uniqueReasons = [...new Set(reasons)].sort();
    authorized = [];
  }

  const retained = currentGraph.candidates
    .filter((candidate) => !authorized.includes(candidate.id))
    .map((candidate) => {
      const ledger = currentGraph.currentLedger.entries.find((row) => row.id === candidate.id);
      return {
        id: candidate.id,
        deletionCondition: candidate.deletionCondition,
        state: ledger?.state ?? 'retained' as const,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  let status: RetirementDisposition = 'blocked';
  if (uniqueReasons.length === 0) {
    if (manifest.status === 'deleted' && authorized.length === 0) {
      status = 'deleted';
    } else if (manifest.reviewerDecision === 'approve-delete' && authorized.length > 0) {
      status = 'ready-for-deletion';
    } else {
      status = 'retain';
    }
  }

  const body = {
    contract: RESOURCE_GOVERNANCE_RETIREMENT_CONTRACT,
    status,
    reasons: uniqueReasons,
    candidateSetHash: liveCandidateHash,
    denominatorHash: liveDenominatorHash,
    ledgerDigest: currentGraph.currentLedger.ledgerDigest,
    deletionsAuthorized: authorized,
    retained,
    protectedSurfacesIntact: liveProtected.intact,
    rollbackArchiveDigest: currentGraph.rollbackArchive.archiveDigest,
    writesSelectorsOrReleases: false as const,
  };

  return {
    ...body,
    verdictDigest: retirementDigest(body),
  };
}
