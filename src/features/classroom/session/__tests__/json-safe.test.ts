import { describe, expect, it } from 'vitest';

import { jsonSafeClassroomPayload } from '../json-safe';

describe('jsonSafeClassroomPayload', () => {
  it('stringifies bigint fields so session payloads can be JSON-encoded', () => {
    expect(jsonSafeClassroomPayload({
      id: 'session-1',
      submissionSequence: 0n,
      acceptedSubmissionWatermark: null,
      nested: { closureRevision: 1, count: 2n },
    })).toEqual({
      id: 'session-1',
      submissionSequence: '0',
      acceptedSubmissionWatermark: null,
      nested: { closureRevision: 1, count: '2' },
    });
    expect(() => JSON.stringify(jsonSafeClassroomPayload({ submissionSequence: 1n }))).not.toThrow();
  });
});
