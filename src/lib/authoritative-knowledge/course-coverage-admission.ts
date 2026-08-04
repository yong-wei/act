import type {
  CourseCoverageAuditIdentity,
  CourseCoverageResult,
} from './contracts';

export type CourseCoverageAdmissionTarget =
  | 'recommendation'
  | 'kaq'
  | 'path'
  | 'assessment'
  | 'new-fact';

export interface CourseCoverageAdmissionProjection {
  target: CourseCoverageAdmissionTarget;
  coveredCanonicalIds: string[];
  audit: CourseCoverageAuditIdentity | null;
  diagnostics: CourseCoverageResult['diagnostics'];
  productionAuthoritative: false;
  /**
   * #1265: historical DEFER / incomplete CourseCoverage never invents a global
   * Engineering Authority block from this admission projection.
   */
  blocksEngineeringAuthority: false;
  historicalDeferBlocksAuthority: false;
}

export function buildCourseCoverageAdmissionProjection(
  result: CourseCoverageResult,
  target: CourseCoverageAdmissionTarget,
): CourseCoverageAdmissionProjection {
  if (result.status !== 'available') {
    return {
      target,
      coveredCanonicalIds: [],
      audit: result.status === 'drift' ? result.audit : null,
      diagnostics: result.diagnostics,
      productionAuthoritative: false,
      blocksEngineeringAuthority: false,
      historicalDeferBlocksAuthority: false,
    };
  }
  return {
    target,
    coveredCanonicalIds: [...new Set(result.entries.map((entry) => entry.canonicalId))].sort(),
    audit: result.audit,
    diagnostics: [],
    productionAuthoritative: false,
    blocksEngineeringAuthority: false,
    historicalDeferBlocksAuthority: false,
  };
}
