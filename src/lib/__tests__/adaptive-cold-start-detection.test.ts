import { describe, expect, it } from 'vitest';

import { isColdStartLearner, extractColdStartEvidenceCount } from '../adaptive-cold-start-detection';

describe('isColdStartLearner', () => {
  it('returns true when learner state is ready and evidenceCount is 0', () => {
    expect(isColdStartLearner({ learnerStateLoadState: 'ready', evidenceCount: 0 })).toBe(true);
  });

  it('returns false when learner state is ready but evidenceCount > 0', () => {
    expect(isColdStartLearner({ learnerStateLoadState: 'ready', evidenceCount: 1 })).toBe(false);
    expect(isColdStartLearner({ learnerStateLoadState: 'ready', evidenceCount: 10 })).toBe(false);
  });

  it('returns false when learner state is loading regardless of evidenceCount', () => {
    expect(isColdStartLearner({ learnerStateLoadState: 'loading', evidenceCount: 0 })).toBe(false);
    expect(isColdStartLearner({ learnerStateLoadState: 'loading', evidenceCount: 5 })).toBe(false);
  });

  it('returns false when learner state is idle regardless of evidenceCount', () => {
    expect(isColdStartLearner({ learnerStateLoadState: 'idle', evidenceCount: 0 })).toBe(false);
    expect(isColdStartLearner({ learnerStateLoadState: 'idle', evidenceCount: 3 })).toBe(false);
  });

  it('treats null/undefined evidenceCount as 0 for ready state', () => {
    expect(isColdStartLearner({ learnerStateLoadState: 'ready', evidenceCount: null })).toBe(true);
    expect(isColdStartLearner({ learnerStateLoadState: 'ready', evidenceCount: undefined })).toBe(true);
  });

  it('returns false when loading and null/undefined evidenceCount', () => {
    expect(isColdStartLearner({ learnerStateLoadState: 'loading', evidenceCount: null })).toBe(false);
    expect(isColdStartLearner({ learnerStateLoadState: 'loading', evidenceCount: undefined })).toBe(false);
  });
});

describe('extractColdStartEvidenceCount', () => {
  it('extracts evidenceCount from valid learner state', () => {
    expect(extractColdStartEvidenceCount({
      evidence: { confidence: { evidenceCount: 3 } },
    })).toBe(3);
  });

  it('returns 0 when learner state is null', () => {
    expect(extractColdStartEvidenceCount(null)).toBe(0);
  });

  it('returns 0 when learner state is undefined', () => {
    expect(extractColdStartEvidenceCount(undefined)).toBe(0);
  });

  it('returns 0 when evidence field is missing', () => {
    expect(extractColdStartEvidenceCount({})).toBe(0);
  });

  it('returns 0 when evidence.confidence is missing', () => {
    expect(extractColdStartEvidenceCount({ evidence: {} })).toBe(0);
  });

  it('returns 0 when evidence.confidence.evidenceCount is undefined', () => {
    expect(extractColdStartEvidenceCount({ evidence: { confidence: {} } })).toBe(0);
  });
});
