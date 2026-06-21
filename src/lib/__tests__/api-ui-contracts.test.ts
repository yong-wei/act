import { describe, expect, it } from 'vitest';

import { buildApiUiRecoveryState, normalizeAdminUsersQueryContract } from '../api-ui-contracts';

describe('admin users API/UI query contract', () => {
  it('prefers audited q over legacy search and preserves role/page/action context', () => {
    expect(normalizeAdminUsersQueryContract({
      q: 'zzzz-no-match',
      search: 'legacy',
      role: 'STUDENT',
      page: '2',
      pageSize: '20',
      action: 'export',
    })).toMatchObject({
      search: 'zzzz-no-match',
      role: 'STUDENT',
      page: 2,
      pageSize: 20,
      action: 'export',
      source: {
        searchParam: 'q',
        roleSupported: true,
        pageValid: true,
      },
    });
  });

  it('marks unsupported role and invalid page without leaking them into filters', () => {
    expect(normalizeAdminUsersQueryContract({
      role: 'NOT_A_ROLE',
      page: '-3',
      pageSize: '200',
      action: 'reset',
      userId: 'user-1',
    })).toMatchObject({
      role: 'ALL',
      page: 1,
      pageSize: 50,
      action: 'reset',
      targetId: 'user-1',
      source: {
        roleSupported: false,
        pageValid: false,
        pageSizeValid: false,
      },
    });
  });

  it('builds role-aware bad-object and unsupported-method recovery states with safe returnTo', () => {
    expect(buildApiUiRecoveryState({
      kind: 'bad-object',
      sourceRoute: '/teacher/grading-workbench',
      targetLabel: '评分运行',
      targetId: 'missing-run',
      returnTo: '/teacher/classes/class-1',
    })).toMatchObject({
      title: '评分运行不存在',
      returnTo: '/teacher/classes/class-1',
      recoveryAction: '返回来源页面并刷新上下文',
    });

    expect(buildApiUiRecoveryState({
      kind: 'unsupported-method',
      sourceRoute: '/api/teacher/document-grading/submissions',
      targetLabel: '评分提交',
      method: 'GET',
      returnTo: 'https://evil.example',
    })).toMatchObject({
      title: '当前操作方式不受支持',
      returnTo: null,
      recoveryAction: '使用页面提供的操作入口重试',
    });

    expect(buildApiUiRecoveryState({
      kind: 'bad-object',
      sourceRoute: '/teacher/report',
      targetLabel: '报告',
      targetId: 'report-1',
      returnTo: '/\\evil.example',
    })).toMatchObject({
      returnTo: null,
    });
  });
});
