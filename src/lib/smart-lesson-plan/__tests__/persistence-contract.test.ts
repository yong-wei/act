import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('smart lesson persistence contract', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  const migration = readFileSync(join(process.cwd(), 'prisma/migrations/20260719180000_add_smart_lesson_plan_core/migration.sql'), 'utf8');

  it('persists the owner-scoped aggregate, durable stages, provider audit, advisory review, and approval ledger', () => {
    for (const model of [
      'SmartLessonTask',
      'SmartLessonSourceSelection',
      'SmartLessonKnowledgePoint',
      'SmartLessonGoal',
      'SmartLessonDraft',
      'SmartLessonRevision',
      'SmartLessonGenerationJob',
      'SmartLessonGenerationStage',
      'SmartLessonProviderAttempt',
      'SmartLessonGenerationCommand',
      'SmartLessonAdvisoryReview',
    ]) {
      expect(schema).toContain(`model ${model}`);
      expect(migration).toContain(`CREATE TABLE "${model}"`);
    }
    expect(schema).toContain('@@unique([ownerId, action, idempotencyKey])');
    expect(schema).toContain('@@unique([stageId, attemptNumber])');
    expect(schema).toMatch(/attemptGeneration\s+Int/);
    expect(schema).toMatch(/taskRevision\s+Int/);
    expect(schema).toMatch(/inputHash\s+String/);
    expect(schema).toMatch(/deliveryGeneration\s+Int/);
    expect(schema).toMatch(/supersededAt\s+DateTime\?/);
    expect(schema).toMatch(/supersededByTaskRevision\s+Int\?/);
    expect(schema).toMatch(/requestSnapshot\s+Json/);
    expect(schema).toMatch(/claimToken\s+String\?/);
    expect(schema).toContain('@@unique([ownerId, idempotencyKey])');
    expect(schema).toMatch(/activeIdentity\s+String\?/);
    expect(migration).toContain('SmartLessonTask_duration_check');
    expect(migration).toContain('SmartLessonAdvisoryReview_advisory_only_check');
    expect(migration).toContain('SmartLessonProviderAttempt_stageId_attemptNumber_key');
    expect(migration).toContain('SmartLessonGenerationJob_delivery_generation_check');
    expect(migration).toContain('SmartLessonGenerationJob_superseded_revision_check');
    expect(migration).toContain('SmartLessonAdvisoryReview_ownerId_idempotencyKey_key');
  });

  it('protects approved revisions from mutation and enforces sequential uniqueness', () => {
    expect(schema).toContain('@@unique([taskId, revisionNumber])');
    expect(schema).toContain('@@unique([ownerId, approvalIdempotencyKey])');
    expect(migration).toContain('SmartLessonRevision_immutable');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "SmartLessonRevision"');
  });
});
