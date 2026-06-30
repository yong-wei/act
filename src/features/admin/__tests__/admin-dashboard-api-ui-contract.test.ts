import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AdminDashboard, shouldBlockInvalidAdminUsersQuery } from '../admin-dashboard';

const currentUser = {
  id: 'admin-1',
  name: '管理员',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
};

const adminDashboardSource = readFileSync(
  join(process.cwd(), 'src/features/admin/admin-dashboard.tsx'),
  'utf8',
);
const globalsSource = readFileSync(
  join(process.cwd(), 'src/app/globals.css'),
  'utf8',
);

describe('AdminDashboard API/UI query contract states', () => {
  it('renders the no-match message from the initial URL search and role filters', () => {
    const html = renderToStaticMarkup(createElement(AdminDashboard, {
      currentUser,
      initialUsersQuery: {
        search: 'zzzz-no-match',
        role: 'STUDENT',
        page: 1,
        pageSize: 12,
        action: null,
        targetId: null,
        source: {
          searchParam: 'q',
          roleSupported: true,
          pageValid: true,
          pageSizeValid: true,
        },
      },
    }));

    expect(html).toContain('没有找到匹配的账号。当前条件：zzzz-no-match / 学生。');
  });

  it('renders URL export route actions as audited pending states', () => {
    const html = renderToStaticMarkup(createElement(AdminDashboard, {
      currentUser,
      initialUsersQuery: {
        search: '',
        role: 'ALL',
        page: 1,
        pageSize: 12,
        action: 'export',
        targetId: 'user-1',
        source: {
          searchParam: null,
          roleSupported: true,
          pageValid: true,
          pageSizeValid: true,
        },
      },
    }));

    expect(html).toContain('data-audited-action-id="admin-users-route-action:export"');
    expect(html).toContain('data-audited-action-status="pending"');
    expect(html).toContain('账号导出深链已保留当前筛选条件');
    expect(html).toContain('按当前筛选集导出账号清单');
    expect(html).toContain('导出当前筛选');
    expect(html).toContain('aria-label="批量导入用户 Excel 文件"');
    expect(adminDashboardSource).toContain('data-admin-operation-zone="users-import-export"');
    expect(adminDashboardSource).toContain('setTemplateDownloadState(createAuditedActionState');
    expect(adminDashboardSource).toContain('data-admin-operation-ledger-state="user-import"');
    expect(adminDashboardSource).toContain('账号指纹');
    expect(adminDashboardSource).not.toContain('`（${item.account}）`');
  });

  it('blocks URL export actions when the role filter is unsupported', () => {
    const html = renderToStaticMarkup(createElement(AdminDashboard, {
      currentUser,
      initialUsersQuery: {
        search: '',
        role: 'ALL',
        page: 1,
        pageSize: 12,
        action: 'export',
        targetId: null,
        source: {
          searchParam: null,
          roleSupported: false,
          pageValid: true,
          pageSizeValid: true,
        },
      },
    }));

    expect(html).toContain('data-audited-action-id="admin-users-route-action:export"');
    expect(html).toContain('data-audited-action-status="blocked"');
    expect(html).toContain('账号导出参数包含无效角色筛选，已阻止生成文件。');
    expect(html).toContain('清空无效角色参数后重新导出');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>导出当前筛选/);
  });

  it('renders invalid query parameters as a blocked recovery state without normal empty copy', () => {
    const initialUsersQuery = {
      search: 'zzzz-no-match',
      role: 'ALL' as const,
      page: 1,
      pageSize: 12,
      action: null,
      targetId: null,
      source: {
        searchParam: null,
        roleSupported: false,
        pageValid: false,
        pageSizeValid: false,
      },
    };
    const html = renderToStaticMarkup(createElement(AdminDashboard, {
      currentUser,
      initialUsersQuery,
    }));

    expect(html).toContain('data-audited-action-id="admin-users-query:invalid"');
    expect(html).toContain('data-audited-action-status="blocked"');
    expect(html).toContain('账号筛选参数无效：角色筛选、分页参数、分页大小。');
    expect(html).toContain('清空无效参数后重新筛选');
    expect(html).toContain('账号筛选参数无效，请清空无效参数后重新筛选。');
    expect(html).not.toContain('没有找到匹配的账号');
    expect(html).not.toContain('暂无账号数据');
    expect(shouldBlockInvalidAdminUsersQuery(initialUsersQuery, false)).toBe(true);
    expect(shouldBlockInvalidAdminUsersQuery(initialUsersQuery, true)).toBe(false);
  });

  it('uses the shared CSV serializer for failed import row downloads', () => {
    const start = adminDashboardSource.indexOf('const downloadFailedImportRows = async () => {');
    const end = adminDashboardSource.indexOf('const handleImport = async', start);
    const downloadFailedRowsSource = adminDashboardSource.slice(start, end);

    expect(adminDashboardSource).toContain('const [failedRowsDownloadState, setFailedRowsDownloadState]');
    expect(adminDashboardSource).toContain('<ActionStatusPanel state={failedRowsDownloadState} className="mt-4" />');
    expect(adminDashboardSource).toContain('const downloadFailedImportRows = async () => {');
    expect(downloadFailedRowsSource).toContain('setFailedRowsDownloadState(createAuditedActionState');
    expect(downloadFailedRowsSource).toContain("requestedAction: 'download-failed-rows'");
    expect(downloadFailedRowsSource).toContain("const res = await fetch(importResult.failedRowArtifact.downloadUrl, { cache: 'no-store' });");
    expect(downloadFailedRowsSource).toContain('const failure = await readArtifactDownloadFailure(res);');
    expect(downloadFailedRowsSource).toContain('httpStatus: failure.httpStatus');
    expect(downloadFailedRowsSource).toContain("res.headers.get('x-admin-operation-id')");
    expect(downloadFailedRowsSource).toContain('下载操作已写入管理员操作账本');
    expect(downloadFailedRowsSource).toContain('toCsv(csv)');
    expect(downloadFailedRowsSource).toContain("['row', 'accountFingerprint', 'reason']");
    expect(downloadFailedRowsSource).toContain('failedRows.map');
    expect(downloadFailedRowsSource).toContain('failedRowArtifact?.downloadUrl');
    expect(downloadFailedRowsSource).not.toContain('replace(/"/g');
    expect(downloadFailedRowsSource).not.toContain("['row', 'account', 'reason']");
    expect(adminDashboardSource).toContain('async function readArtifactDownloadFailure(res: Response)');
    expect(adminDashboardSource).toContain("typeof payload.error === 'string'");
    expect(adminDashboardSource).toContain("typeof payload.message === 'string'");
    expect(adminDashboardSource).toContain('artifactDownloadRecoveryAction(res.status)');
    expect(adminDashboardSource).toContain("if (status === 401) return '重新登录后再下载失败行';");
    expect(adminDashboardSource).toContain("if (status === 403) return '确认管理员权限后再下载失败行';");
    expect(adminDashboardSource).toContain('if (status === 404 || status === 410)');
  });

  it('clears stale failed-row download state when a new import starts', () => {
    const start = adminDashboardSource.indexOf('const handleImport = async');
    const end = adminDashboardSource.indexOf('const overviewCards = useMemo', start);
    const handleImportSource = adminDashboardSource.slice(start, end);

    expect(handleImportSource).toContain('setFailedRowsDownloadState(null);');
    expect(handleImportSource.indexOf('setFailedRowsDownloadState(null);')).toBeLessThan(
      handleImportSource.indexOf("fetch('/api/admin/users/import'"),
    );
  });

  it('keeps the admin users table mobile-carded and announces list state changes', () => {
    const html = renderToStaticMarkup(createElement(AdminDashboard, {
      currentUser,
      initialUsersQuery: {
        search: '',
        role: 'ALL',
        page: 1,
        pageSize: 12,
        action: null,
        targetId: null,
        source: {
          searchParam: null,
          roleSupported: true,
          pageValid: true,
          pageSizeValid: true,
        },
      },
    }));

    expect(html).toContain('data-admin-mobile-cards="true"');
    expect(html).toContain('data-admin-users-list-status');
    expect(html).toContain('role="status"');
    expect(adminDashboardSource).toContain('data-label="账号信息"');
    expect(adminDashboardSource).toContain('aria-label={`删除账号 ${user.name || user.email || user.id}`}');
    expect(adminDashboardSource).toContain('aria-label="按角色筛选账号"');
    expect(adminDashboardSource).toContain('className="admin-console-input w-full pl-9 sm:w-64"');
    expect(adminDashboardSource).toContain('ref={createDialogRef}');
    expect(adminDashboardSource).toContain('ref={resetDialogRef}');
    expect(adminDashboardSource).toContain(`event.key === 'Escape'`);
    expect(adminDashboardSource).toContain('document.activeElement === dialog');
    expect(adminDashboardSource).toContain('getDialogFocusableElements(dialog)[0]?.focus() ?? dialog.focus()');
    expect(globalsSource).toContain('.admin-console-table[data-admin-mobile-cards="true"]');
    expect(globalsSource).toContain('content: attr(data-label)');
  });
});
