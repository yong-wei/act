import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { resolvePathAssessmentIdentity, scopedPathAssessmentSessionId } from '../path-assessment-identity';

describe('path assessment identity', () => {
  it('derives goal and stage from the owned current path node', async () => {
    const identity = await resolvePathAssessmentIdentity({
      port: {
        findOwnedCurrentPath: async () => ({
          goalId: 'control-correction',
          nodeIds: ['adaptive-quiz:control-target-check'],
          pathPayload: {
            mainPathNodeIds: ['adaptive-quiz:control-target-check'],
            planNodes: [{ nodeId: 'adaptive-quiz:control-target-check', type: 'adaptive_quiz' }],
          },
        }),
      },
      actorUserId: 'student-1',
      sessionId: scopedPathAssessmentSessionId('path-1', 'adaptive-quiz:control-target-check'),
      pathId: 'path-1',
      nodeId: 'adaptive-quiz:control-target-check',
      routeIntent: 'path-execution',
      kind: 'question',
    });

    expect(identity).toMatchObject({
      pathId: 'path-1',
      nodeId: 'adaptive-quiz:control-target-check',
      goalId: 'control-correction',
      questionScope: 'readiness',
    });
  });

  it('fails closed when the client forges another learner path', async () => {
    const port = {
      findOwnedCurrentPath: async () => null,
    };

    await expect(resolvePathAssessmentIdentity({
      port,
      actorUserId: 'student-1',
      sessionId: scopedPathAssessmentSessionId('path-other', 'adaptive-quiz:control-target-check'),
      pathId: 'path-other',
      nodeId: 'adaptive-quiz:control-target-check',
      kind: 'answer',
    })).rejects.toThrow('未找到可用的路径自适应答案上下文');
  });
});

describe('assessment public API boundary', () => {
  const routeFiles = [
    'src/app/api/assessment/next-question/route.ts',
    'src/app/api/assessment/submit-answer/route.ts',
    'src/app/api/assessment/diagnostic/route.ts',
    'src/app/api/assessment/ability-report/[userId]/route.ts',
    'src/app/api/user/profile/route.ts',
  ];

  it('does not import retired fallback entries or duplicate path parsers', () => {
    for (const file of routeFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('WithPersistenceFallback');
      expect(source).not.toContain('isAdaptiveAssessmentPersistenceEnabled');
      expect(source).not.toContain('readVerifiedPathContext');
      expect(source).not.toContain("from '@/features/assessment/adaptive-persistence'");
      expect(source).not.toContain("from '@/features/assessment/adaptive-engine'");
    }
    expect(readFileSync('src/app/api/assessment/next-question/route.ts', 'utf8'))
      .toContain("from '@/features/assessment/public-api'");
    expect(readFileSync('src/app/api/assessment/submit-answer/route.ts', 'utf8'))
      .toContain("from '@/features/assessment/public-api'");
  });
});
