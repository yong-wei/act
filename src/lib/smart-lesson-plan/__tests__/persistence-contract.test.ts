import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('smart lesson persistence contract', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  const migration = readFileSync(join(process.cwd(), 'prisma/migrations/20260719180000_add_smart_lesson_plan_core/migration.sql'), 'utf8');
  const archiveMigration = readFileSync(join(process.cwd(), 'prisma/migrations/20260725235000_add_smart_lesson_task_archive/migration.sql'), 'utf8');
  const generationExperienceMigration = readFileSync(join(
    process.cwd(),
    'prisma/migrations/20260726140000_harden_smart_lesson_generation_experience/migration.sql',
  ), 'utf8');

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

  it('persists action projection, bounded correction lineage, and separate delivery/retry identities', () => {
    expect(schema).toContain('enum SmartLessonGenerationActionState');
    expect(schema).toContain('enum SmartLessonProviderAttemptKind');
    expect(schema).toMatch(/actionState\s+SmartLessonGenerationActionState/);
    expect(schema).toMatch(/providerAttemptGeneration\s+Int/);
    expect(schema).toMatch(/validationReceipt\s+Json\?/);
    expect(schema).toMatch(/correctsAttemptId\s+String\?/);
    expect(schema).toContain('@@unique([stageId, providerAttemptGeneration, kind])');
    expect(generationExperienceMigration).toContain('SmartLessonProviderAttempt_correction_link_check');
    expect(generationExperienceMigration).toContain('SmartLessonProviderAttempt_stageId_providerAttemptGeneration_kind_key');
  });

  it('migrates only the completed outline of a paused confirmation job to waiting confirmation', () => {
    expect(generationExperienceMigration).toContain('FROM "SmartLessonGenerationJob" AS job');
    expect(generationExperienceMigration).toContain('WHERE job."id" = stage."jobId"');

    const pausedOutlineBranch = generationExperienceMigration.indexOf('WHEN job."state" = \'PAUSED\'');
    const completedStageBranch = generationExperienceMigration.indexOf('WHEN stage."state" = \'COMPLETED\'');
    expect(pausedOutlineBranch).toBeGreaterThan(-1);
    expect(completedStageBranch).toBeGreaterThan(pausedOutlineBranch);

    expect(generationExperienceMigration).toMatch(
      /job\."state" = 'PAUSED'[\s\S]*job\."outlineConfirmation" = true[\s\S]*stage\."kind" = 'OUTLINE'[\s\S]*stage\."state" = 'COMPLETED'[\s\S]*THEN 'WAITING_CONFIRMATION'/,
    );
  });

  it('protects approved revisions from mutation and enforces sequential uniqueness', () => {
    expect(schema).toContain('@@unique([taskId, revisionNumber])');
    expect(schema).toContain('@@unique([ownerId, approvalIdempotencyKey])');
    expect(migration).toContain('SmartLessonRevision_immutable');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "SmartLessonRevision"');
  });

  it('persists task archival independently from the immutable preparation graph', () => {
    expect(schema).toMatch(/archivedAt\s+DateTime\?/);
    expect(schema).toContain('@@index([ownerId, archivedAt, updatedAt])');
    expect(archiveMigration).toContain('ADD COLUMN "archivedAt" TIMESTAMP(3)');
    expect(archiveMigration).toContain('"SmartLessonTask_ownerId_archivedAt_updatedAt_idx"');
    expect(archiveMigration).toContain("current_setting('app.smart_lesson_task_delete', true)");
    expect(archiveMigration).toContain('CREATE OR REPLACE FUNCTION "reject_smart_lesson_revision_mutation"');
    expect(archiveMigration).toContain('CREATE OR REPLACE FUNCTION "reject_smart_courseware_revision_mutation"');
    expect(archiveMigration).toContain('CREATE OR REPLACE FUNCTION "reject_smart_courseware_module_revision_mutation"');
    expect(archiveMigration).toContain('CREATE OR REPLACE FUNCTION "reject_smart_courseware_publication_mutation"');
  });
});
