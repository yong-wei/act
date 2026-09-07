/**
 * Fail-closed coverage gate for the engineering-textbook mapping (#2043).
 *
 * Approved mappings plus explicit exceptions must account for 100% of the
 * denominator ledger-wise; the combined coverage must reach the 95% gate
 * before runtime consumption may switch. Every object absent from both
 * ledgers fails the gate closed.
 */

import {
  candidateKeyOf,
  EngineeringTextbookMappingError,
  MAPPING_COVERAGE_GATE,
  type MappingCandidatesFile,
  type MappingCoverageFile,
  type MappingDenominatorFile,
  type MappingExceptionRow,
  type MappingReviewRow,
} from './contracts';
import { effectiveVerdicts } from './ledger';

export interface CoverageComputation {
  coverage: MappingCoverageFile;
  approvedByNode: Map<string, string[]>;
}

export function computeCoverage(input: {
  denominator: MappingDenominatorFile;
  candidates: MappingCandidatesFile;
  reviews: readonly MappingReviewRow[];
  exceptions: readonly MappingExceptionRow[];
  generatedAt: string;
}): CoverageComputation {
  if (input.candidates.authorityReleaseId !== input.denominator.authorityReleaseId) {
    throw new EngineeringTextbookMappingError(
      'authority-mismatch',
      `candidates pinned to ${input.candidates.authorityReleaseId} but denominator to ${input.denominator.authorityReleaseId}`,
    );
  }

  const denominatorIds = new Set<string>();
  for (const domain of input.denominator.domains) {
    for (const id of domain.canonicalIds) denominatorIds.add(id);
  }
  if (denominatorIds.size !== input.denominator.totalObjects) {
    throw new EngineeringTextbookMappingError(
      'denominator-invalid',
      `denominator lists ${denominatorIds.size} unique ids but declares ${input.denominator.totalObjects}`,
    );
  }

  const domainByNode = new Map<string, string>();
  for (const domain of input.denominator.domains) {
    for (const id of domain.canonicalIds) domainByNode.set(id, domain.domainId);
  }

  const verdicts = effectiveVerdicts(input.reviews);

  const candidateNodes = new Set<string>(input.candidates.rows.map((row) => row.canonicalId));
  for (const row of input.candidates.rows) {
    if (!denominatorIds.has(row.canonicalId)) {
      throw new EngineeringTextbookMappingError(
        'candidate-out-of-denominator',
        `candidate row names canonical ${row.canonicalId} absent from the denominator`,
      );
    }
  }

  const approvedByNode = new Map<string, string[]>();
  for (const row of input.candidates.rows) {
    const verdict = verdicts.get(candidateKeyOf(row));
    if (verdict?.verdict === 'approved') {
      const list = approvedByNode.get(row.canonicalId) ?? [];
      list.push(row.structuralUnitId);
      approvedByNode.set(row.canonicalId, list);
    }
  }

  const exceptionByNode = new Map<string, MappingExceptionRow>();
  for (const row of input.exceptions) {
    if (!denominatorIds.has(row.canonicalId)) {
      throw new EngineeringTextbookMappingError(
        'exception-out-of-denominator',
        `exception row names canonical ${row.canonicalId} absent from the denominator`,
      );
    }
    if (approvedByNode.has(row.canonicalId)) {
      throw new EngineeringTextbookMappingError(
        'exception-conflicts-with-approval',
        `canonical ${row.canonicalId} carries an approved mapping and an exception row; exceptions are only for unmapped nodes`,
      );
    }
    if (row.reason === 'candidates-rejected' && !candidateNodes.has(row.canonicalId)) {
      throw new EngineeringTextbookMappingError(
        'exception-reason-invalid',
        `canonical ${row.canonicalId} claims candidates-rejected but has no candidate rows`,
      );
    }
    if (row.reason === 'no-candidate' && candidateNodes.has(row.canonicalId)) {
      throw new EngineeringTextbookMappingError(
        'exception-reason-invalid',
        `canonical ${row.canonicalId} claims no-candidate but candidate rows exist`,
      );
    }
    exceptionByNode.set(row.canonicalId, row);
  }

  for (const [candidateKey, verdict] of verdicts) {
    const canonicalId = candidateKey.slice(0, candidateKey.indexOf('\u001f'));
    if (!denominatorIds.has(canonicalId)) {
      throw new EngineeringTextbookMappingError(
        'verdict-out-of-denominator',
        `review verdict names canonical ${canonicalId} absent from the denominator`,
      );
    }
    if (verdict.verdict === 'approved' && exceptionByNode.has(canonicalId)) {
      throw new EngineeringTextbookMappingError(
        'exception-conflicts-with-approval',
        `canonical ${canonicalId} carries both an approved verdict and an exception row`,
      );
    }
  }

  const unmapped = [...denominatorIds].filter(
    (id) => !approvedByNode.has(id) && !exceptionByNode.has(id),
  );
  if (unmapped.length > 0) {
    throw new EngineeringTextbookMappingError(
      'silent-unmapped-nodes',
      `${unmapped.length} denominator objects are in neither the approved mappings nor the exception ledger (first: ${unmapped[0]}); silent unmapped coverage is forbidden`,
    );
  }

  const perDomain = input.denominator.domains.map((domain) => {
    let approved = 0;
    let exceptions = 0;
    for (const id of domain.canonicalIds) {
      if (approvedByNode.has(id)) approved += 1;
      else if (exceptionByNode.has(id)) exceptions += 1;
    }
    return {
      domainId: domain.domainId,
      denominator: domain.objectCount,
      approved,
      exceptions,
      coverageRate: domain.objectCount === 0 ? 1 : (approved + exceptions) / domain.objectCount,
    };
  });

  const approvedCount = [...denominatorIds].filter((id) => approvedByNode.has(id)).length;
  const exceptionCount = [...denominatorIds].filter((id) => exceptionByNode.has(id)).length;
  const coveredCount = approvedCount + exceptionCount;
  const coverageRate = coveredCount / input.denominator.totalObjects;
  const passed = coverageRate >= MAPPING_COVERAGE_GATE;

  return {
    approvedByNode,
    coverage: {
      contract: 'engineering-textbook-mapping-coverage/v1' as const,
      authorityReleaseId: input.denominator.authorityReleaseId,
      denominatorTotal: input.denominator.totalObjects,
      denominatorDigest: '',
      candidatesDigest: '',
      reviewsDigest: '',
      exceptionsDigest: '',
      approvedCount,
      exceptionCount,
      coveredCount,
      coverageRate,
      gate: MAPPING_COVERAGE_GATE,
      passed,
      perDomain,
      generatedAt: input.generatedAt,
    },
  };
}

/** Gate assertion: callers fail closed unless the computation passed. */
export function assertCoverageGate(coverage: MappingCoverageFile): void {
  if (!coverage.passed) {
    throw new EngineeringTextbookMappingError(
      'coverage-gate-failed',
      `combined coverage ${(coverage.coverageRate * 100).toFixed(2)}% is below the ${(coverage.gate * 100).toFixed(0)}% gate; runtime consumption may not switch`,
    );
  }
}
