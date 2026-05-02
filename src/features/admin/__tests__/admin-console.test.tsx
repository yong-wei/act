import { describe, expect, it } from 'vitest';

import { ADMIN_CONSOLE_ENTRIES } from '../admin-console-config';

describe('ADMIN_CONSOLE_ENTRIES', () => {
  it('should expose the admin sub-route entries', () => {
    expect(
      ADMIN_CONSOLE_ENTRIES.map((entry) => ({
        title: entry.title,
        href: entry.href,
      }))
    ).toEqual([
      { title: '用户管理', href: '/admin/users' },
      { title: '系统使用量统计', href: '/admin/states' },
      { title: '数据治理', href: '/admin/data-governance' },
      { title: '系统配置', href: '/admin/config' },
    ]);
  });
  it('should keep the labels in Chinese for the admin home cards', () => {
    expect(ADMIN_CONSOLE_ENTRIES.every((entry) => !/[A-Z][a-z]+/.test(entry.title))).toBe(true);
  });
});
