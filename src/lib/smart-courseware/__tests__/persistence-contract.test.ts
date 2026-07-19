import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('smart courseware persistence contract', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  const migration = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260719210000_add_smart_courseware_foundation/migration.sql'),
    'utf8',
  );

  it('persists independent drafts, active module identities, and immutable module history', () => {
    for (const model of ['SmartCoursewareDraft', 'SmartCoursewareModule', 'SmartCoursewareModuleRevision']) {
      expect(schema).toContain(`model ${model}`);
      expect(migration).toContain(`CREATE TABLE "${model}"`);
    }
    expect(schema).toContain('@@unique([ownerId, creationIdempotencyKey])');
    expect(schema).toMatch(/activeIdentity\s+String\?/);
    expect(migration).toContain('SmartCoursewareModule_gap_check');
    expect(migration).toContain('SmartCoursewareModule_active_identity_check');
    expect(migration).toContain('SmartCoursewareModuleRevision_immutable');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "SmartCoursewareModuleRevision"');
  });

  it('binds every draft to an approved immutable plan revision', () => {
    expect(schema).toMatch(/planRevision\s+SmartLessonRevision/);
    expect(schema).toMatch(/planRevisionNumber\s+Int/);
    expect(schema).toMatch(/planContentHash\s+String/);
    expect(migration).toContain('SmartCoursewareDraft_planRevisionId_fkey');
    expect(migration).toContain('REFERENCES "SmartLessonRevision"("id") ON DELETE RESTRICT');
  });

  it('adds independent durable courseware jobs, units, attempts, and command receipts', () => {
    const generationMigration = readFileSync(
      join(process.cwd(), 'prisma/migrations/20260719220000_add_smart_courseware_generation/migration.sql'),
      'utf8',
    );
    for (const model of [
      'SmartCoursewareGenerationJob',
      'SmartCoursewareGenerationUnit',
      'SmartCoursewareProviderAttempt',
      'SmartCoursewareGenerationCommand',
    ]) {
      expect(schema).toContain(`model ${model}`);
      expect(generationMigration).toContain(`CREATE TABLE "${model}"`);
    }
    expect(schema).toMatch(/activeIdentity\s+String\?/);
    expect(schema).toContain('@@unique([jobId, unitKey])');
    expect(schema).toContain('@@unique([ownerId, action, idempotencyKey])');
    expect(generationMigration).toContain('SmartCoursewareGenerationJob_first_unit_check');
    expect(generationMigration).toContain('SmartCoursewareGenerationUnit_attempt_generation_check');
  });

  it('persists module regeneration candidates separately from the accepted draft', () => {
    const moduleMigration = readFileSync(
      join(process.cwd(), 'prisma/migrations/20260719230000_add_smart_courseware_module_regeneration/migration.sql'),
      'utf8',
    );
    expect(schema).toContain('enum SmartCoursewareGenerationJobMode');
    expect(schema).toMatch(/mode\s+SmartCoursewareGenerationJobMode\s+@default\(INITIAL\)/);
    for (const field of [
      'targetModuleId',
      'targetModuleHash',
      'sourceBindingsSnapshot',
      'candidateRuntimeModule',
      'candidateModuleMetadata',
      'candidateHash',
      'providerAudit',
      'acceptedAt',
    ]) {
      expect(schema).toContain(field);
      expect(moduleMigration).toContain(`"${field}"`);
    }
    expect(moduleMigration).toContain('SmartCoursewareGenerationJob_module_target_check');
  });

  it('persists immutable whole-course approval revisions', () => {
    const approvalMigration = readFileSync(
      join(process.cwd(), 'prisma/migrations/20260719240000_add_smart_courseware_approval/migration.sql'),
      'utf8',
    );
    expect(schema).toContain('model SmartCoursewareRevision');
    expect(schema).toContain('@@unique([ownerId, approvalIdempotencyKey])');
    expect(approvalMigration).toContain('CREATE TABLE "SmartCoursewareRevision"');
    expect(approvalMigration).toContain('SmartCoursewareRevision_immutable');
    expect(approvalMigration).toContain('BEFORE UPDATE OR DELETE ON "SmartCoursewareRevision"');
  });

  it('links every module revision to unambiguous generation and acceptance audit evidence', () => {
    const auditMigration = readFileSync(
      join(process.cwd(), 'prisma/migrations/20260719250000_finalize_smart_courseware_module_audit/migration.sql'),
      'utf8',
    );
    for (const field of [
      'generationJobId',
      'providerAttemptId',
      'candidateHash',
      'candidateDiffId',
      'acceptedCommandId',
      'originalAttemptIdSnapshot',
    ]) {
      expect(schema).toContain(field);
      expect(auditMigration).toContain(`"${field}"`);
    }
    expect(auditMigration).toContain('SmartCoursewareModuleRevision_generationJobId_fkey');
    expect(auditMigration).toContain('SmartCoursewareModuleRevision_providerAttemptId_fkey');
    expect(auditMigration).toContain('SmartCoursewareModuleRevision_acceptedCommandId_fkey');
    expect(auditMigration).toContain('SmartCoursewareModuleRevision_candidateDiffId_key');
  });

  it('links module provider attempts directly to their generation job without a synthetic unit', () => {
    const attemptMigration = readFileSync(
      join(process.cwd(), 'prisma/migrations/20260719260000_link_module_provider_attempts/migration.sql'),
      'utf8',
    );
    expect(schema).toMatch(/generationJobId\s+String/);
    expect(schema).toMatch(/unitId\s+String\?/);
    expect(schema).toMatch(/generationJob\s+SmartCoursewareGenerationJob/);
    expect(attemptMigration).toContain('ADD COLUMN "generationJobId" TEXT');
    expect(attemptMigration).toContain('SET "generationJobId" = unit."jobId"');
    expect(attemptMigration).toContain('ALTER COLUMN "unitId" DROP NOT NULL');
    expect(attemptMigration).toContain('SmartCoursewareProviderAttempt_generationJobId_fkey');
    expect(attemptMigration).toContain('SmartCoursewareProviderAttempt_unit_scope_check');
  });
});
