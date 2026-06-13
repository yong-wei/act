import { describe, expect, it } from 'vitest';

import {
  TEACHER_DASHBOARD_PRIMARY_STATS,
  TEACHER_DASHBOARD_QUICK_ACTIONS,
} from '../teacher-dashboard-config';

describe('teacher dashboard config', () => {
  it('exposes a clickable class stat card and a history stat card on the first row', () => {
    expect(
      TEACHER_DASHBOARD_PRIMARY_STATS.map((item) => ({
        label: item.label,
        href: item.href ?? null,
      }))
    ).toEqual([
      { label: '我的班级', href: '/teacher/classes' },
      { label: '班级学生', href: null },
      { label: '教案数量', href: null },
      { label: '进行中课堂', href: null },
      { label: '上课历史', href: '/teacher/history' },
    ]);
  });

  it('keeps only the non-duplicated quick actions for the teacher home', () => {
    expect(
      TEACHER_DASHBOARD_QUICK_ACTIONS.map((item) => ({
        title: item.title,
        href: item.href,
      }))
    ).toEqual([
      { title: '新建班级', href: '/teacher/classes/new?returnTo=%2Fteacher' },
      { title: '新建教案', href: '/teacher/lesson-plans/new?returnTo=%2Fteacher' },
      { title: '预置教案', href: '/teacher/preset-lessons' },
      { title: '教学资源管理', href: '/teacher/resources' },
      { title: '上课历史', href: '/teacher/history' },
    ]);
  });
});
