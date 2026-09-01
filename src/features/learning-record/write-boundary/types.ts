export const WRITE_BOUNDARY_C0_CAPTURE_SHA = '09fa54739c74a5005b7f3131bf3c85dcf79ff01a';
export const WRITE_BOUNDARY_C0_CLAIM_SHA = 'e86d16f4f8b759b62840d9268e12ee58eab02883';

export type WriteTransport = 'direct' | 'staged-outbox' | 'correction-replay' | 'explicit-backfill';

export type WriteDisposition =
  | 'canonical'
  | 'exception-c6-c7'
  | 'retained-authorized'
  | 'isolated-duplicate'
  | 'adapter-sink'
  | 'test-fixture';

export interface WriteBoundaryRow {
  id: string;
  producer: string;
  entry: string;
  owner: string;
  transport: WriteTransport;
  canonicalEntry: string;
  dedupeIdentity: string;
  anchors: string;
  trustedTimes: string;
  privacyClass: string;
  projectionTrigger: string;
  consumer: string;
  evidence: string;
  deletionCondition: string;
  disposition: WriteDisposition;
}

export interface HistoricalApplyAuthorization {
  operationId: string;
  authorizedBy: string;
  frozenCutoff: string;
}

export class WriteBoundaryError extends Error {
  constructor(
    public readonly code: 'write-boundary-unclassified' | 'write-boundary-incomplete' | 'historical-apply-unauthorized',
    message: string,
  ) {
    super(message);
    this.name = 'WriteBoundaryError';
  }
}
