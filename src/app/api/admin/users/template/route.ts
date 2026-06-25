import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin';
import {
  buildAdminOperationIdempotencyKey,
  buildAdminOperationLedgerEntry,
  operationLedgerHeaders,
} from '@/lib/admin-operation-ledger';
import { persistAdminOperationLedger } from '@/lib/admin-operation-ledger-runtime';
import { buildWorkbookBuffer } from '@/lib/server-spreadsheet';

export async function GET() {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const buffer = await buildWorkbookBuffer('导入模板', [
    ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
    ['20240001', '张三', '学生', 'zhangsan@example.com', '自动化2401', '自动化', '2024', ''],
    ['T2024001', '李老师', '教师', 'li@example.com', '', '', '', ''],
  ]);
  const completedAt = new Date().toISOString();
  const operationLedger = buildAdminOperationLedgerEntry({
    kind: 'admin-user-template-download',
    actorId: session.user.id,
    actorRole: session.user.role,
    scope: 'admin-users-template',
    startedAt: completedAt,
    completedAt,
    outcome: 'download-ready',
    idempotencyKey: buildAdminOperationIdempotencyKey([
      'admin-user-template-download',
      'users-template.xlsx',
      completedAt.slice(0, 10),
      session.user.id,
    ]),
    artifactRefs: [{
      id: 'admin-users-template:xlsx',
      kind: 'download',
      label: '用户导入模板',
      authorizedRoles: ['ADMIN'],
      piiMinimized: true,
      revocable: false,
    }],
    rollback: {
      available: false,
      rationale: '模板下载不修改系统状态，无需回滚。',
    },
    auditSummary: '用户导入模板已生成。',
    recoveryState: {
      status: 'available',
      action: '下载失败时重新请求模板',
    },
  });
  await persistAdminOperationLedger(operationLedger);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="users-template.xlsx"',
      ...operationLedgerHeaders(operationLedger),
    },
  });
}
