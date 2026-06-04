import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('control-correction path round schema', () => {
  const schema = readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

  it('extends LearningPath additively for durable control-correction rounds', () => {
    const learningPathModel = schema.match(/model LearningPath \{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(learningPathModel).toContain('goalId');
    expect(learningPathModel).toContain('plannerVersion');
    expect(learningPathModel).toContain('pathStatus');
    expect(learningPathModel).toContain('currentNodeId');
    expect(learningPathModel).toContain('learnerStateRef');
    expect(learningPathModel).toContain('inputSnapshot');
    expect(learningPathModel).toContain('pathPayload');
    expect(learningPathModel).toContain('explanationPayload');
    expect(learningPathModel).toContain('alternativePayload');
    expect(learningPathModel).toContain('entryNodeId');
    expect(learningPathModel).toContain('terminalValidation');
    expect(learningPathModel).toContain('lastExecutionMetadata');
    expect(learningPathModel).toContain('executions');
    expect(learningPathModel).toContain('deviations');
    expect(learningPathModel).toContain('interventions');
  });

  it('defines append-only execution, deviation, and intervention records with idempotency indexes', () => {
    expect(schema).toContain('model LearningPathExecution');
    expect(schema).toContain('model LearningPathDeviation');
    expect(schema).toContain('model LearningPathIntervention');
    expect(schema).toContain('@@unique([pathId, idempotencyKey])');
    expect(schema).toContain('@@index([pathId, createdAt])');
  });
});
