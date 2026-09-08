import { describe, expect, it } from 'vitest';

import { isColdStartLearner, extractColdStartEvidenceCount } from '@/features/personalization/path-planning/adaptive-cold-start-detection.ts';

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

  it('returns false when learner state loading failed regardless of evidenceCount', () => {
    expect(isColdStartLearner({ learnerStateLoadState: 'failed', evidenceCount: 0 })).toBe(false);
    expect(isColdStartLearner({ learnerStateLoadState: 'failed', evidenceCount: null })).toBe(false);
  });

  it('returns false when learner state is ready but evidenceCount is null/undefined', () => {
    expect(isColdStartLearner({ learnerStateLoadState: 'ready', evidenceCount: null })).toBe(false);
    expect(isColdStartLearner({ learnerStateLoadState: 'ready', evidenceCount: undefined })).toBe(false);
  });

  it('returns false when loading and null/undefined evidenceCount', () => {
    expect(isColdStartLearner({ learnerStateLoadState: 'loading', evidenceCount: null })).toBe(false);
    expect(isColdStartLearner({ learnerStateLoadState: 'loading', evidenceCount: undefined })).toBe(false);
  });

  it('returns false when ready state has a missing learner state instead of explicit zero evidence', () => {
    const evidenceCount = extractColdStartEvidenceCount(null);

    expect(isColdStartLearner({ learnerStateLoadState: 'ready', evidenceCount })).toBe(false);
  });
});

describe('extractColdStartEvidenceCount', () => {
  it('extracts evidenceCount from valid learner state', () => {
    expect(extractColdStartEvidenceCount({
      evidence: { confidence: { evidenceCount: 3 } },
    })).toBe(3);
  });

  it('returns null when learner state is null', () => {
    expect(extractColdStartEvidenceCount(null)).toBeNull();
  });

  it('returns null when learner state is undefined', () => {
    expect(extractColdStartEvidenceCount(undefined)).toBeNull();
  });

  it('returns null when evidence field is missing', () => {
    expect(extractColdStartEvidenceCount({})).toBeNull();
  });

  it('returns null when evidence.confidence is missing', () => {
    expect(extractColdStartEvidenceCount({ evidence: {} })).toBeNull();
  });

  it('returns null when evidence.confidence.evidenceCount is undefined', () => {
    expect(extractColdStartEvidenceCount({ evidence: { confidence: {} } })).toBeNull();
  });
});
