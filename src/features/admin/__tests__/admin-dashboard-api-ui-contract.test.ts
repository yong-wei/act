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

  it('renders URL route actions as unsupported audited states', () => {
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
    expect(html).toContain('data-audited-action-status="unsupported"');
    expect(html).toContain('账号导出深链不会自动执行。');
    expect(html).toContain('确认筛选结果后从账号列表执行导出');
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
});
