import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectFromRequest } from '@/lib/auth-request-redirect';
import { RoleWorkspaceShell } from '@/components/platform/role-workspace-shell';
import { ActionStatusPanel } from '@/components/platform/action-status';
import { TeacherOperationsNav } from '@/features/teacher/teacher-operations-nav';
import {
  buildTeacherReportDeliveryLedgerEntry,
  buildTeacherReportDeliveryState,
  normalizeTeacherReportDeliveryQuery,
} from '@/lib/teacher-report-grading-contracts';

export default async function TeacherReportLedgerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect(await buildLoginRedirectFromRequest());
  }

  if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const reportBookQuery = normalizeTeacherReportDeliveryQuery({
    action: 'summary',
    report: 'control-correction',
    actorId: session.user.id,
    actorRole: session.user.role,
    recipientScope: 'teacher-review',
    surface: 'report-book',
    returnTo: '/teacher/grading-workbench',
  }, 'missing-report-book-class');
  const reportBookLedgerEntry = buildTeacherReportDeliveryLedgerEntry({
    query: reportBookQuery,
    surface: 'report-book',
    reportType: 'grading-report-book',
    studentSafeSummary: '报告评分工作台缺少班级和课堂上下文，不能直接作为班级报告交付出口。',
  });
  const reportBookState = buildTeacherReportDeliveryState(reportBookQuery);

  return (
    <RoleWorkspaceShell
      workspaceRole={session.user.role === 'ADMIN' ? 'admin' : 'teacher'}
      title="报告评分工作台"
      subtitle="文档评分、证据复核、审批与回写"
      user={session.user}
      workspaceSlots={{
        commandBar: session.user.role === 'TEACHER' ? (
          <div data-commercial-operations-workspace="teacher-report-ledger" data-commercial-workspace-zone="command-bar">
            <TeacherOperationsNav />
          </div>
        ) : undefined,
        contextHeader: (
          <div
            className="rounded-lg border border-border bg-muted/35 px-4 py-3 text-sm text-subtle"
            data-commercial-operations-workspace="teacher-report-ledger"
            data-commercial-workspace-zone="context-strip"
            data-report-ledger-surface="report-book-delivery-ledger"
            data-report-ledger-action-id={reportBookLedgerEntry.actionId}
            data-report-ledger-idempotency-key={reportBookLedgerEntry.idempotencyKey}
            data-report-ledger-artifact-ref={reportBookLedgerEntry.artifactRef}
            data-report-ledger-delivery-state={reportBookLedgerEntry.deliveryStatus}
            data-report-ledger-redaction-policy={reportBookLedgerEntry.redactionPolicy}
            data-report-ledger-recovery="open-class-analytics-with-class-context"
          >
            报告评分工作台只展示评分草稿与写回状态；需要交付班级报告时，请从班级分析或课堂历史携带班级、课堂和报告上下文进入。
            {reportBookState ? <ActionStatusPanel state={reportBookState} className="mt-3" /> : null}
          </div>
        ),
      }}
    >
      {children}
    </RoleWorkspaceShell>
  );
}
