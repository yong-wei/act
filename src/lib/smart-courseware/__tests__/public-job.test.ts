import { describe, expect, it } from 'vitest';

import { publicCoursewareJob } from '@/app/api/teacher/smart-courseware/_shared';

describe('smart courseware public job projection', () => {
  it('returns bounded completed-unit output without provider internals', () => {
    const projected = publicCoursewareJob({
      id: 'job-1', draftId: 'draft-1', state: 'RETRYABLE', units: [{
        id: 'unit-1', unitKey: 'bridge-in', orderIndex: 0, state: 'COMPLETED',
        output: { stage: { stage: 'bridge-in' }, providerAudit: { secret: 'private' } },
      }],
    }) as { units: Array<{ output?: unknown; outputTruncated?: boolean }> };
    expect(projected.units[0]).toMatchObject({ output: { stage: { stage: 'bridge-in' } }, outputTruncated: false });
    expect(JSON.stringify(projected)).not.toContain('private');
  });

  it('marks oversized unit output without returning it', () => {
    const projected = publicCoursewareJob({
      id: 'job-1', draftId: 'draft-1', state: 'RETRYABLE', units: [{
        id: 'unit-1', unitKey: 'bridge-in', orderIndex: 0, state: 'COMPLETED', output: { text: 'x'.repeat(64_001) },
      }],
    }) as { units: Array<{ output?: unknown; outputTruncated?: boolean }> };
    expect(projected.units[0]).toMatchObject({ output: null, outputTruncated: true });
  });

  it('applies the output limit to UTF-8 bytes', () => {
    const projected = publicCoursewareJob({
      id: 'job-1', draftId: 'draft-1', state: 'RETRYABLE', units: [{
        id: 'unit-1', unitKey: 'bridge-in', orderIndex: 0, state: 'COMPLETED', output: { text: '课'.repeat(30_000) },
      }],
    }) as { units: Array<{ output?: unknown; outputTruncated?: boolean }> };
    expect(projected.units[0]).toMatchObject({ output: null, outputTruncated: true });
  });
});
