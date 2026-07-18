// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  qrToDataURL: vi.fn<(...args: unknown[]) => Promise<string>>(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/components/platform/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PlatformSurface: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
vi.mock('qrcode/lib/browser', () => ({
  toDataURL: mocks.qrToDataURL,
}));

import { TeacherClassroomWaitingPage } from '@/features/interactive/shared/teacher-classroom-waiting-page';
import { UNIT_1_4CourseHeader } from '@/features/interactive/unit-1-4-time-frequency-views/course-header';
import { UNIT_1_4_LESSON_STEPS } from '@/lib/unit-1-4-course';

describe('shared classroom UI recovery', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.qrToDataURL.mockResolvedValue('data:image/png;base64,qr');
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('disables all student header navigation while browse is locked', async () => {
    await act(async () => root.render(
      <UNIT_1_4CourseHeader
        steps={UNIT_1_4_LESSON_STEPS}
        activeIndex={2}
        navigationEnabled={false}
        onIndexChange={() => undefined}
      />,
    ));

    expect(container.querySelector('select')?.disabled).toBe(true);
    expect(Array.from(container.querySelectorAll('button')).every((button) => button.disabled)).toBe(true);
    expect(container.textContent).toContain('教师开放浏览后可切换环节');
  });

  it('shows waiting request failures with retry and keeps finished sessions terminal', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'session failed' }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'state failed' }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 's1', joinCode: '123456', status: 'FINISHED' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ summary: { totalStudents: 2 } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(<TeacherClassroomWaitingPage routeSegment="unit-1-4-time-frequency-views" sessionId="s1" />));
    await act(async () => undefined);
    expect(container.textContent).toContain('课堂状态读取失败');

    const retry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('重试'));
    expect(retry).toBeDefined();
    await act(async () => retry?.click());
    await act(async () => undefined);

    expect(container.textContent).toContain('课堂已结束');
    const start = container.querySelector('[data-start-class-action="teacher-runtime"]') as HTMLButtonElement;
    expect(start.disabled).toBe(true);
  });

  it('does not mark QR or student join as complete while QR generation fails and nobody has joined', async () => {
    mocks.qrToDataURL.mockRejectedValueOnce(new Error('qr failed'));
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 's1', joinCode: '123456', status: 'ACTIVE' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ summary: { totalStudents: 0 } }), { status: 200 })));

    await act(async () => root.render(<TeacherClassroomWaitingPage routeSegment="unit-1-4-time-frequency-views" sessionId="s1" />));
    await act(async () => undefined);

    expect(container.textContent).toContain('二维码生成失败');
    expect(container.querySelectorAll('[data-flow-step-complete="true"]')).toHaveLength(0);
  });

  it('marks only QR generation complete when QR succeeds but nobody has joined', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 's1', joinCode: '123456', status: 'ACTIVE' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ summary: { totalStudents: 0 } }), { status: 200 })));

    await act(async () => root.render(<TeacherClassroomWaitingPage routeSegment="unit-1-4-time-frequency-views" sessionId="s1" />));
    await act(async () => undefined);

    expect(container.querySelectorAll('[data-flow-step-complete="true"]')).toHaveLength(1);
  });

  it('marks QR generation and student join complete only after both conditions are true', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 's1', joinCode: '123456', status: 'ACTIVE' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ summary: { totalStudents: 2 } }), { status: 200 })));

    await act(async () => root.render(<TeacherClassroomWaitingPage routeSegment="unit-1-4-time-frequency-views" sessionId="s1" />));
    await act(async () => undefined);

    expect(container.querySelectorAll('[data-flow-step-complete="true"]')).toHaveLength(2);
  });
});
