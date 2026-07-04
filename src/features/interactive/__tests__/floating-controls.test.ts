import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildFloatingControlMenu,
  type PageFloatingControlRegistration,
} from '@/components/shared/page-floating-controls';
import { buildClassroomJoinUrl } from '@/features/interactive/shared/teacher-join-qr-dialog';
import {
  buildLoginRedirectForPath,
  normalizeSafeCallbackPath,
  resolvePostLoginRedirect,
} from '@/lib/auth-redirect';

const repoRoot = process.cwd();

describe('page floating controls', () => {
  it('keeps theme switching as the default menu outside interactive lesson steps', () => {
    const menu = buildFloatingControlMenu([]);

    expect(menu.map((item) => item.id)).toEqual(['theme']);
    expect(menu[0]?.label).toBe('主题切换');
  });

  it('adds context registered lesson controls after the default theme item', () => {
    const registrations: PageFloatingControlRegistration[] = [
      {
        id: 'knowledge-card',
        label: '知识卡片',
        priority: 20,
        onSelect: () => undefined,
      },
    ];

    const menu = buildFloatingControlMenu(registrations);

    expect(menu.map((item) => item.id)).toEqual(['theme', 'knowledge-card']);
  });

  it('moves the knowledge card entry out of fixed per-lesson button markup', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/interactive/shared/step-knowledge-drawer.tsx'),
      'utf8',
    );

    expect(source).toContain('usePageFloatingControls');
    expect(source).not.toContain('fixed bottom-4 right-4');
    expect(source).not.toContain('data-lesson-floating-tools');
  });

  it('gives the shared floating dock a named panel and live status updates', () => {
    const source = readFileSync(
      join(repoRoot, 'src/components/shared/page-floating-controls.tsx'),
      'utf8',
    );

    expect(source).toContain('role="region"');
    expect(source).toContain('aria-labelledby={panelTitleId}');
    expect(source).toContain('aria-controls={isMenuOpen ? panelId : undefined}');
    expect(source).toContain('data-platform-floating-dock-status');
    expect(source).toContain('主题已切换为');
  });

  it('keeps the global AI sidebar named and focus contained while open', () => {
    const source = readFileSync(
      join(repoRoot, 'src/components/ai/global-ai-sidebar.tsx'),
      'utf8',
    );

    expect(source).toContain(`role={isOpen ? 'dialog' : undefined}`);
    expect(source).toContain(`aria-modal={isOpen ? 'true' : undefined}`);
    expect(source).toContain('inert={!isOpen}');
    expect(source).toContain(`panel.addEventListener('keydown', handleTab)`);
    expect(source).toContain('document.activeElement === panel');
    expect(source).toContain('getFocusableElements(panel)[0]?.focus() ?? panel.focus()');
    expect(source).toContain('aria-label="关闭 AI 侧栏"');
  });
});

describe('teacher classroom QR join link', () => {
  it('builds a classroom join URL that preserves the existing join-code validation flow', () => {
    expect(buildClassroomJoinUrl('123456', 'https://act.example.edu.cn')).toBe(
      'https://act.example.edu.cn/classroom/join?code=123456',
    );
  });
});

describe('classroom QR authentication redirect', () => {
  it('preserves the scanned join code through login', () => {
    expect(buildLoginRedirectForPath('/classroom/join?code=123456')).toBe(
      '/login?callbackUrl=%2Fclassroom%2Fjoin%3Fcode%3D123456',
    );
  });

  it('uses only safe local callback URLs after login', () => {
    expect(resolvePostLoginRedirect({
      callbackUrl: '/classroom/join?code=123456',
      origin: 'https://act.example.edu.cn',
      role: 'STUDENT',
    })).toBe('/classroom/join?code=123456');

    expect(normalizeSafeCallbackPath('https://evil.example/login', 'https://act.example.edu.cn')).toBeNull();
    expect(resolvePostLoginRedirect({
      callbackUrl: 'https://evil.example/login',
      origin: 'https://act.example.edu.cn',
      role: 'STUDENT',
    })).toBe('/profile');
  });
});
