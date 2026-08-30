export type RetirementKind =
  | 'producer'
  | 'consumer'
  | 'worker'
  | 'queue'
  | 'materializer'
  | 'backfill'
  | 'report'
  | 'test';

export type RetirementDisposition =
  | 'code-retired'
  | 'retained-authorized'
  | 'current-replacement';

export interface RetirementRow {
  id: string;
  kind: RetirementKind;
  replacement: string;
  owner: string;
  disposition: RetirementDisposition;
  deletionConditionClosed: boolean;
  privacyProof: string;
}

export const RETIREMENT_FREEZE_REVISION = 'beb80a691';
