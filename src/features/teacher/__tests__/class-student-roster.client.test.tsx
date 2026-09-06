// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getAllByRole, getByLabelText, getByRole, getByText } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClassStudentRoster } from '@/features/teacher/class-student-roster';
import type { RosterInsight, RosterStudentInput } from '@/features/teacher/class-student-roster';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

function makeStudent(
  id: string,
  name: string,
  studentNumber: string | null,
): RosterStudentInput {
  return {
    id: `enrollment-${id}`,
    studentNumber,
    techScore: 80,
    ethicsScore: 80,
    user: { id, name, email: `${id}@example.test` },
  } as RosterStudentInput & { techScore: number; ethicsScore: number };
}

function makeInsight(id: string, overrides: Partial<RosterInsight> = {}): RosterInsight {
  return {
    id,
    name: id,
    email: null,
    studentNumber: null,
    overallScore: 72,
    overallLevel: 'L2',
    overallScoreSource: null,
    riskLevel: 'high',
    riskLabel: '高风险',
    trendDirection: 'up',
    strengths: [],
    weaknesses: [],
    riskBadges: ['concentration'],
    factCount: 10,
    lastSnapshotAt: null,
    portraitV2: null,
    availabilityReason: 'available',
    evidenceStatus: {
      state: 'ready',
      refreshedAt: '2026-08-01T00:00:00.000Z',
      lastEvidenceAt: '2026-08-01T00:00:00.000Z',
      confidence: { level: 'high', score: 0.9, evidenceCount: 10, sourceCompleteness: 0.9 },
      statusMarkers: [],
    },
    ...overrides,
  } as RosterInsight;
}

const students = [
  makeStudent('alice', '张三', '2026001'),
  makeStudent('bob', '李四', null),
];

const insights = [
  makeInsight('alice'),
  makeInsight('bob', {
    riskLevel: 'none',
    riskLabel: '无风险',
    trendDirection: 'not-comparable',
    availabilityReason: 'no-eligible-evidence',
    evidenceStatus: {
      state: 'missing',
      refreshedAt: null,
      lastEvidenceAt: null,
      confidence: { level: 'none', score: 0, evidenceCount: 0, sourceCompleteness: 0 },
      statusMarkers: ['missing-source'],
    },
  }),
];

function renderRoster() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ClassStudentRoster
        classId="class-1"
        classCode="JOIN123"
        students={students}
        insights={insights}
        removingStudentId={null}
        onRemoveStudent={vi.fn()}
        onOpenAddStudents={vi.fn()}
      />,
    );
  });
  return { container, root };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('ClassStudentRoster', () => {
  let roots: Array<Root> = [];

  beforeEach(() => {
    roots = [];
  });

  afterEach(async () => {
    for (const root of roots) {
      await act(async () => {
        root.unmount();
      });
    }
    document.body.innerHTML = '';
  });

  function track(rendered: { container: HTMLElement; root: Root }) {
    roots.push(rendered.root);
    return rendered.container;
  }

  it('renders filter controls, cumulative portrait scope note, hit count and stable ordering', () => {
    const container = track(renderRoster());

    expect(getByLabelText(container, '搜索学生姓名或学号')).toBeTruthy();
    expect(getByLabelText(container, '按最后证据风险筛选学生')).toBeTruthy();
    expect(getByLabelText(container, '按最后累计趋势筛选学生')).toBeTruthy();
    expect(getByLabelText(container, '按证据缺失筛选学生')).toBeTruthy();
    expect(getByLabelText(container, '按画像可用性筛选学生')).toBeTruthy();
    expect(getByText(container, '数据口径：当前累计画像（非历史诊断报告快照）', { exact: false })).toBeTruthy();
    expect(getByText(container, '命中 2 / 2 人')).toBeTruthy();
    expect(getByRole(container, 'button', { name: '清除全部学生筛选' }).disabled).toBe(true);

    const table = getByRole(container, 'table');
    expect(table.getAttribute('data-teacher-mobile-cards')).toBe('true');
    expect(table.querySelectorAll('td[data-label="学生"]').length).toBe(2);
    expect(getAllByRole(table, 'link', { name: '查看学生 张三 详情' })[0].getAttribute('href'))
      .toBe('/teacher/classes/class-1/students/alice');
  });

  it('filters students by search and updates the hit count', async () => {
    const container = track(renderRoster());
    const search = getByLabelText(container, '搜索学生姓名或学号') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(search, { target: { value: '张三' } });
    });
    await flush();

    expect(getByText(container, '命中 1 / 2 人')).toBeTruthy();
    expect(getByText(container, '张三')).toBeTruthy();
    expect(() => getByText(container, '李四')).toThrow();
  });

  it('shows a distinct empty state with a working clear action when nothing matches', async () => {
    const container = track(renderRoster());
    const search = getByLabelText(container, '搜索学生姓名或学号') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(search, { target: { value: '不存在' } });
    });
    await flush();

    expect(getByText(container, '没有符合条件的学生')).toBeTruthy();
    expect(() => getByText(container, '暂无学生加入此班级')).toThrow();

    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: '清除筛选' }));
    });
    await flush();

    expect(getByText(container, '命中 2 / 2 人')).toBeTruthy();
    expect(getByText(container, '张三')).toBeTruthy();
  });

  it('combines risk filter with evidence missing filter', async () => {
    const container = track(renderRoster());

    await act(async () => {
      fireEvent.change(getByLabelText(container, '按证据缺失筛选学生'), { target: { value: 'missing' } });
    });
    await flush();
    expect(getByText(container, '命中 1 / 2 人')).toBeTruthy();
    expect(getByText(container, '李四')).toBeTruthy();

    await act(async () => {
      fireEvent.change(getByLabelText(container, '按最后证据风险筛选学生'), { target: { value: 'high' } });
    });
    await flush();
    expect(getByText(container, '命中 0 / 2 人')).toBeTruthy();
    expect(getByText(container, '没有符合条件的学生')).toBeTruthy();
  });

  it('keeps the no-students empty state when the class has no members', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);
    act(() => {
      root.render(
        <ClassStudentRoster
          classId="class-1"
          classCode="JOIN123"
          students={[]}
          insights={[]}
          removingStudentId={null}
          onRemoveStudent={vi.fn()}
          onOpenAddStudents={vi.fn()}
        />,
      );
    });

    expect(getByText(container, '暂无学生加入此班级')).toBeTruthy();
    expect(getByText(container, 'JOIN123')).toBeTruthy();
    expect(() => getByText(container, '没有符合条件的学生')).toThrow();
  });
});
