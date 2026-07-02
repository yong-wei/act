import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  redirect: vi.fn((target: string) => {
    throw new Error(`redirect:${target}`);
  }),
  buildLoginRedirectForPath: vi.fn((path: string) => `/login?callbackUrl=${encodeURIComponent(path)}`),
  getDataCenterShowDemoSourceLabels: vi.fn(),
  presentationDataCenter: vi.fn((props: unknown) => ({ type: 'PresentationDataCenter', props })),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/auth-redirect', () => ({
  buildLoginRedirectForPath: mocks.buildLoginRedirectForPath,
}));

vi.mock('@/lib/platform-settings', () => ({
  getDataCenterShowDemoSourceLabels: mocks.getDataCenterShowDemoSourceLabels,
}));

vi.mock('@/features/data-center/presentation-data-center', () => ({
  PresentationDataCenter: (props: unknown) => mocks.presentationDataCenter(props),
}));

import DataCenterPage from '../data-center/page';

describe('DataCenterPage role access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDataCenterShowDemoSourceLabels.mockResolvedValue(false);
  });

  it('keeps unauthenticated users on the login callback flow', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    await expect(DataCenterPage()).rejects.toThrow('redirect:/login?callbackUrl=%2Fdata-center');

    expect(mocks.buildLoginRedirectForPath).toHaveBeenCalledWith('/data-center');
    expect(mocks.presentationDataCenter).not.toHaveBeenCalled();
  });

  it('redirects authenticated students to learner evidence instead of rendering data center', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });

    await expect(DataCenterPage()).rejects.toThrow(
      'redirect:/profile/evidence?origin=%2Fdata-center&reason=student-role-boundary&targetScope=learner-evidence-review&sourceBoundary=teacher-admin-aggregate-only',
    );

    expect(mocks.presentationDataCenter).not.toHaveBeenCalled();
  });

  it('keeps learner return targets local and annotates the role boundary', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });

    await expect(DataCenterPage({
      searchParams: Promise.resolve({ returnTo: '/profile/growth?tab=evidence' }),
    })).rejects.toThrow(
      'redirect:/profile/growth?tab=evidence&origin=%2Fdata-center&reason=student-role-boundary&targetScope=learner-evidence-review&sourceBoundary=teacher-admin-aggregate-only',
    );

    await expect(DataCenterPage({
      searchParams: Promise.resolve({ returnTo: '//example.test' }),
    })).rejects.toThrow(
      'redirect:/profile/evidence?origin=%2Fdata-center&reason=student-role-boundary&targetScope=learner-evidence-review&sourceBoundary=teacher-admin-aggregate-only',
    );

    await expect(DataCenterPage({
      searchParams: Promise.resolve({ returnTo: '/\\evil.example' }),
    })).rejects.toThrow(
      'redirect:/profile/evidence?origin=%2Fdata-center&reason=student-role-boundary&targetScope=learner-evidence-review&sourceBoundary=teacher-admin-aggregate-only',
    );

    await expect(DataCenterPage({
      searchParams: Promise.resolve({ returnTo: '/profile/evidence#timeline' }),
    })).rejects.toThrow(
      'redirect:/profile/evidence?origin=%2Fdata-center&reason=student-role-boundary&targetScope=learner-evidence-review&sourceBoundary=teacher-admin-aggregate-only#timeline',
    );

    await expect(DataCenterPage({
      searchParams: Promise.resolve({ returnTo: '/data-center#export' }),
    })).rejects.toThrow(
      'redirect:/profile/evidence?origin=%2Fdata-center&reason=student-role-boundary&targetScope=learner-evidence-review&sourceBoundary=teacher-admin-aggregate-only',
    );
  });

  it('renders data center for teacher and administrator roles with demo label policy', async () => {
    mocks.getDataCenterShowDemoSourceLabels.mockResolvedValue(true);

    for (const [role, platformRole] of [['TEACHER', 'teacher'], ['ADMIN', 'admin']] as const) {
      mocks.presentationDataCenter.mockClear();
      mocks.getServerAuthSession.mockResolvedValue({ user: { id: `${platformRole}-1`, role } });

      const element = await DataCenterPage();

      expect(element).toMatchObject({
        props: { role: platformRole, showDemoSourceLabels: true },
      });
    }
  });
});
