import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'prisma/migrations/20260727020000_unify_assignment_response_contract/migration.sql',
  'utf8',
);
const backfill = readFileSync(
  'scripts/db/backfill-assignment-attachment-order.ts',
  'utf8',
);

describe('unified assignment response migration', () => {
  it('adds aggregate revision, asset order, role, position, and provenance fields', () => {
    for (const field of [
      'answerContractVersion',
      'attachmentOrderProvenance',
      'answerSnapshot',
      'assetRole',
      'orderIndex',
      'embeddedPosition',
    ]) {
      expect(migration).toContain(`"${field}"`);
    }
    expect(migration).toContain('SubmissionAsset_answerId_state_orderIndex_idx');
    expect(migration).toContain('SubmissionAsset_attemptId_orderIndex_idx');
  });

  it('uses deterministic legacy fallback without rewriting frozen publications', () => {
    expect(migration).toContain("'assignment-response.legacy.v1'");
    expect(migration).toContain("SET DEFAULT 'assignment-response.v2'");
    expect(migration).not.toMatch(/UPDATE\s+"AssignmentRevision"/i);
    expect(migration).not.toMatch(/UPDATE\s+"AssignmentQuestion"/i);
    expect(backfill).toContain("process.argv.includes('--apply')");
    expect(backfill).toContain("mode: Mode = process.argv.includes('--apply') ? 'apply' : 'dry-run'");
    expect(backfill).toContain("attachmentOrderProvenance === 'student-arranged'");
    expect(backfill).toContain("attachmentOrderProvenance: 'legacy-fallback'");
  });
});
