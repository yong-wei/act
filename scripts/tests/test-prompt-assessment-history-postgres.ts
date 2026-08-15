import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import {
  PromptAssessmentHistoryError,
  attachPromptConsistencyResult,
  createPromptAssessmentAttempt,
  listPromptAssessmentHistory,
} from '../../src/features/evaluation/prompt-assessment-history';
import { prisma } from '../../src/lib/prisma';

const suffix = randomUUID();
const userId = `prompt-assessment-test-${suffix}`;
const sessionId = `prompt-session-${suffix}`;

const assessmentRequest = {
  prompt: '控制对象：邮轮航向系统\n性能目标：超调 < 15%，调节时间 < 20s\n约束条件：相位裕度 > 30°',
  structuredData: {
    'control-object': '邮轮航向系统',
    'performance-goals': '超调 < 15%，调节时间 < 20s',
    constraints: '相位裕度 > 30°',
  },
  auditTaskContext: {
    source: 'prompt-assessment',
    assignment: 'PID 参数整定',
    intent: 'prompt-history-review',
    outputTarget: 'prompt-history' as const,
  },
  context: {
    taskType: 'controller-design' as const,
    difficulty: 'intermediate' as const,
  },
};

async function main() {
  try {
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.test`,
        name: 'Prompt Assessment Verification',
        role: 'STUDENT',
      },
    });

    const [first, second] = await Promise.all([
      createPromptAssessmentAttempt({ userId, sessionId, request: assessmentRequest }),
      createPromptAssessmentAttempt({ userId, sessionId, request: assessmentRequest }),
    ]);
    assert.notEqual(first.version, second.version);

    const history = await listPromptAssessmentHistory(userId);
    assert.deepEqual(history.map((record) => record.version), [1, 2]);
    assert.equal(history[0]?.auditTaskContext?.source, 'prompt-assessment');
    assert.equal(history[0]?.promptContent, assessmentRequest.prompt);

    const consistency = await attachPromptConsistencyResult({
      userId,
      sessionId,
      version: 1,
      request: {
        promptContent: '无关的客户端提示词不能替换已持久化的学习目标。',
        auditTaskContext: assessmentRequest.auditTaskContext,
        designActions: [
          { timestamp: 1, action: 'adjust_kp', params: { kp: 1.2 } },
          { timestamp: 2, action: 'adjust_ki', params: { ki: 0.1 } },
        ],
        finalResult: { overshoot: 0.1 },
      },
    });
    assert.ok(consistency.alignmentAnalysis.statedGoals.includes('控制超调'));

    const historyWithConsistency = await listPromptAssessmentHistory(userId);
    assert.equal(historyWithConsistency[0]?.consistency?.consistencyScore, consistency.consistencyScore);
    assert.equal(await prisma.learningFact.count({ where: { userId } }), 0);

    await assert.rejects(
      attachPromptConsistencyResult({
        userId: `${userId}-foreign`,
        sessionId,
        version: 1,
        request: {
          promptContent: assessmentRequest.prompt,
          designActions: [],
          finalResult: {},
        },
      }),
      (error: unknown) => error instanceof PromptAssessmentHistoryError,
    );

    console.log('prompt assessment history PostgreSQL verification passed');
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

void main();
