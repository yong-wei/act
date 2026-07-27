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
    };
  }
  return {
    target,
    coveredCanonicalIds: [...new Set(result.entries.map((entry) => entry.canonicalId))].sort(),
    audit: result.audit,
    diagnostics: [],
    productionAuthoritative: false,
  };
}
