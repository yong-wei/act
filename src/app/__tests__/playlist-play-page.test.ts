import { createElement, type ReactElement } from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('notFound');
  }),
  prisma: {
    lessonPlan: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/features/knowledge/playlist-play-launcher', () => ({
  PlaylistPlayLauncher: (props: Record<string, unknown>) => createElement('div', {
    'data-testid': 'playlist-play-launcher',
    'data-props': JSON.stringify(props),
  }),
}));

import PlaylistPlayPage from '../playlists/[id]/play/page';

function pageProps(id = 'plan-1') {
  return {
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({ intent: 'start-class' }),
  };
}

function privatePlan(authorId = 'teacher-1') {
  return {
    id: 'plan-1',
    title: '私有课程流',
    description: '仅作者可见',
    isPublic: false,
    authorId,
    _count: { items: 2 },
  };
}

function readLauncherProps(element: ReactElement) {
  return element.props as Record<string, unknown>;
}

describe('/playlists/[id]/play page access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue(null);
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue(privatePlan());
  });

  it('hides private playlist metadata from anonymous viewers', async () => {
    await expect(PlaylistPlayPage(pageProps())).rejects.toThrow('notFound');

    expect(mocks.notFound).toHaveBeenCalled();
  });

  it('lets the teacher author edit through the teacher route', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });

    const element = await PlaylistPlayPage(pageProps());
    const props = readLauncherProps(element);

    expect(props.title).toBe('私有课程流');
    expect(props.editHref).toBe('/teacher/lesson-plans/plan-1/edit?returnTo=%2Fplaylists');
    expect(props.canStartClass).toBe(true);
  });

  it('lets admins edit through the admin route', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    const element = await PlaylistPlayPage(pageProps());
    const props = readLauncherProps(element);

    expect(props.editHref).toBe('/admin/lesson-plans/plan-1/edit?returnTo=%2Fplaylists');
    expect(props.canStartClass).toBe(true);
  });

  it('shows public playlists without exposing edit controls to guests', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      ...privatePlan(),
      isPublic: true,
    });

    const element = await PlaylistPlayPage(pageProps());
    const props = readLauncherProps(element);

    expect(props.title).toBe('私有课程流');
    expect(props.editHref).toBeNull();
    expect(props.canStartClass).toBe(false);
  });
});
