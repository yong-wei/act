import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    class: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    learningPath: { findFirst: vi.fn() },
  },
}));

import { sanitizeCandidateBatchForStudentResponse } from '@/app/api/learning-paths/candidate-batches/route-helpers';

describe('student candidate batch projection (#2077)', () => {
  it('hides persisted candidates when hard diversity failed', () => {
    const sanitized = sanitizeCandidateBatchForStudentResponse({
      id: 'batch-1',
      userId: 'student-1',
      classId: null,
      goalId: 'control-correction',
      generationRequestId: 'request-1',
      sourcePathId: 'path-1',
      plannerVersion: 'v1',
      status: 'succeeded',
      createdAt: '2026-08-03T00:00:00.000Z',
      sourcePathVersion: '2026-08-03T00:00:00.000Z',
      metadata: { diversityLimitations: ['insufficient-candidate-diversity'] },
      candidates: [{
        id: 'candidate-1',
        fingerprint: 'fp-1',
        ordinal: 1,
        styleId: 'foundation-remediation',
        policyFamily: 'foundation-remediation',
        label: '稳步掌握',
        snapshot: { optionId: 'path-option-1' },
      }],
    });
    expect(sanitized.candidates).toEqual([]);
    expect(sanitized.comparison.insufficientCandidateDiversity).toBe(true);
  });
});
