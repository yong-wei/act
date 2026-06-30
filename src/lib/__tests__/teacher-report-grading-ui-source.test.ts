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
    expect(source).toContain('deliveryQuery.sessionId');
    expect(source).toContain('deliveryQuery.lessonId');
    expect(source).toContain('deliveryQuery.surface');
    expect(source).toContain('deliveryQuery.returnTo');
    expect(source).toContain('md:hidden');
    expect(source).toContain('data-report-ledger-action-id={ledgerEntry.actionId}');
    expect(source).toContain('data-report-ledger-idempotency-key={ledgerEntry.idempotencyKey}');
    expect(source).toContain('data-report-ledger-artifact-ref={ledgerEntry.artifactRef}');
    expect(source).toContain('data-report-ledger-redaction-policy={ledgerEntry.redactionPolicy}');
    expect(source).toContain('surface: searchParams.get(\'surface\')');
    expect(source).toContain('surface: deliveryQuery.surface');
    expect(source).toContain("identity: buildDeliveryActionIdentity(deliveryLedgerEntry, '教师报告导出', 'export')");
    expect(source).toContain("identity: buildDeliveryActionIdentity(deliveryLedgerEntry, '教师报告摘要', 'summary')");
    expect(source).toContain("const canDeliverReport = deliveryLedgerEntry.contextState === 'ready';");
    expect(source).toContain('导出、摘要复制和评分交接暂不可执行');
    expect(source).toContain("status: 'blocked',");
    expect(source).toContain('disabled={!canDeliver}');
    expect(source).toContain("data-report-ledger-action-disabled={canDeliver ? 'false' : 'missing-context'}");
    expect(source).toContain('entry.actionId.replace(`:${entry.action}:`, `:${requestedAction}:`)');
    expect(source).toContain('targetId: entry.artifactRef');
    expect(source).toContain('data-teacher-report-handoff-states="delivery-status-contract"');
    expect(source).toContain('data-report-ledger-send-publish-state="degraded"');
    expect(source).toContain('data-teacher-intervention-action-id={entry.interventionAction.id}');
    expect(source).toContain('data-teacher-intervention-action-status={entry.interventionAction.status}');
    expect(source).toContain('data-teacher-intervention-persistence-target={entry.interventionAction.persistenceTarget}');
    expect(source).toContain("fetch('/api/teacher/evidence-interventions'");
    expect(source).toContain('data-teacher-intervention-record-action={canDeliver ?');
    expect(source).toContain('entry.interventionAction.privacySafeSummary');
    expect(source).toContain('data-report-ledger-grading-handoff-state="ready"');
    expect(source).toContain('data-report-ledger-grading-handoff-state="blocked"');
    expect(source).not.toContain('action=lock&report=control-correction');
  });

  it('turns missing persisted grading runs into blocked route states', () => {
    const source = readSource('src/app/(teacher-report-ledger)/teacher/grading-workbench/page.tsx');

    expect(source).toContain('buildTeacherGradingMissingRunState(routeQuery)');
    expect(source).toContain('return <TeacherDocumentGradingEmptyState routeState={buildTeacherGradingMissingRunState(routeQuery)} />;');
  });

  it('keeps teacher student evidence actions on the shared intervention contract', () => {
    const source = readSource('src/app/teacher/classes/[classId]/students/[studentId]/evidence/page.tsx');

    expect(source).toContain('buildTeacherEvidenceInterventionAction');
    expect(source).toContain("surface: 'teacher-evidence'");
    expect(source).toContain('data-teacher-intervention-action-id={interventionAction.id}');
    expect(source).toContain('data-teacher-intervention-action-status={interventionAction.status}');
    expect(source).toContain('data-teacher-intervention-persistence-target={interventionAction.persistenceTarget}');
    expect(source).toContain('interventionAction.privacySafeSummary');
    expect(source).toContain('data-teacher-evidence-remediation-task={interventionAction.status}');
  });

  it('connects teacher home, history, classroom review, and report-book surfaces to report delivery ledger', () => {
    const dashboard = readSource('src/features/teacher/teacher-dashboard.tsx');
    const history = readSource('src/app/teacher/history/page.tsx');
    const classroomReview = readSource('src/app/classroom/teacher/[sessionId]/review/page.tsx');
    const reportBookLayout = readSource('src/app/(teacher-report-ledger)/teacher/layout.tsx');

    expect(dashboard).toContain("data-report-ledger-surface={item.id === 'analytics' || item.id === 'history-report' ? 'teacher-home-report-delivery' : undefined}");
    expect(dashboard).toContain('activeSessions.find((sessionItem) => sessionItem.classId)?.classId');
    expect(dashboard).toContain('data-report-ledger-delivery-state="degraded"');
    expect(dashboard).toContain('data-report-ledger-export="deferred"');
    expect(history).toContain('data-report-ledger-surface="teacher-history-report-delivery"');
    expect(history).toContain('data-teacher-report-delivery-link="history"');
    expect(classroomReview).toContain('data-report-ledger-surface="classroom-review-report-delivery"');
    expect(classroomReview).toContain('data-teacher-report-delivery-link="classroom-review-footer"');
    expect(classroomReview).toContain('plan: {');
    expect(classroomReview).toContain('id: true,');
    expect(classroomReview).toContain('const reviewLessonId = lessonIds[0] ?? session.plan.id');
    expect(classroomReview).not.toContain('href="/review/extracurricular-showcase"');
    expect(reportBookLayout).toContain('buildTeacherReportDeliveryLedgerEntry');
    expect(reportBookLayout).toContain('buildTeacherReportDeliveryState');
    expect(reportBookLayout).toContain('normalizeTeacherReportDeliveryQuery');
    expect(reportBookLayout).toContain('data-report-ledger-surface="report-book-delivery-ledger"');
    expect(reportBookLayout).toContain('data-report-ledger-action-id={reportBookLedgerEntry.actionId}');
    expect(reportBookLayout).toContain('data-report-ledger-artifact-ref={reportBookLedgerEntry.artifactRef}');
    expect(reportBookLayout).toContain('data-report-ledger-recovery="open-class-analytics-with-class-context"');
  });
});
