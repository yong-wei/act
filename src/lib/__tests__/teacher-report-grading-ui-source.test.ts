import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('teacher report and grading UI source contracts', () => {
  it('resets local report delivery state when URL action context changes', () => {
    const source = readSource('src/app/teacher/classes/[classId]/analytics-v2/page.tsx');

    expect(source).toContain('setDeliveryState(null);');
    expect(source).toContain('[deliveryQuery.action, deliveryQuery.reportId, deliveryQuery.studentId, deliveryQuery.versionId]');
    expect(source).toContain('md:hidden');
    expect(source).not.toContain('action=lock&report=control-correction');
  });

  it('turns missing persisted grading runs into blocked route states', () => {
    const source = readSource('src/app/(teacher-report-ledger)/teacher/grading-workbench/page.tsx');

    expect(source).toContain('buildTeacherGradingMissingRunState(routeQuery)');
    expect(source).toContain('return <TeacherDocumentGradingEmptyState routeState={buildTeacherGradingMissingRunState(routeQuery)} />;');
  });
});
