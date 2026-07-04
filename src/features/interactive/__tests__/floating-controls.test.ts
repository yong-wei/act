import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildFloatingControlMenu,
  selectPrimaryFloatingControl,
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
  it('does not inject theme switching into the bottom floating menu', () => {
    const menu = buildFloatingControlMenu([]);

    expect(menu).toEqual([]);
  });

  it('keeps context registered controls ordered without a theme fallback', () => {
    const registrations: PageFloatingControlRegistration[] = [
      {
        id: 'knowledge-card',
        label: '知识卡片',
        priority: 20,
        onSelect: () => undefined,
      },
    ];

    const menu = buildFloatingControlMenu(registrations);

    expect(menu.map((item) => item.id)).toEqual(['knowledge-card']);
  });

  it('keeps an enabled global Konling launcher primary when a page Konling control is disabled', () => {
    const registrations: PageFloatingControlRegistration[] = [
      {
        id: 'konling-global-ai',
        label: '控灵全局助手',
        priority: 10,
        onSelect: () => undefined,
      },
      {
        id: 'adaptive-path-konling',
        label: '控灵路径顾问',
        priority: 20,
        disabled: true,
        onSelect: () => undefined,
      },
    ];

    const primary = selectPrimaryFloatingControl(buildFloatingControlMenu(registrations));

    expect(primary?.id).toBe('konling-global-ai');
    expect(primary?.disabled).toBeFalsy();
  });

  it('keeps an enabled page Konling launcher primary over the global launcher', () => {
    const registrations: PageFloatingControlRegistration[] = [
      {
        id: 'konling-global-ai',
        label: '控灵全局助手',
        priority: 10,
        onSelect: () => undefined,
      },
      {
        id: 'adaptive-path-konling',
        label: '控灵路径顾问',
        priority: 20,
        onSelect: () => undefined,
      },
    ];

    const primary = selectPrimaryFloatingControl(buildFloatingControlMenu(registrations));

    expect(primary?.id).toBe('adaptive-path-konling');
    expect(primary?.disabled).toBeFalsy();
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
    expect(source).toContain('selectPrimaryFloatingControl(menu)');
    expect(source).toContain('konlingControls.filter((item) => !item.disabled).at(-1)');
    expect(source).toContain('menu.filter((item) => item.id !== primaryControl.id)');
    expect(source).toContain('data-platform-floating-dock-primary="konling"');
    expect(source).toContain('data-platform-floating-dock-direct-action="true"');
    expect(source).toContain('data-platform-floating-dock-secondary-trigger="true"');
    expect(source).not.toContain('konlingControl ?? menu[0]');
    expect(source).not.toContain('&& !isKonlingControl(item)');
    expect(source).not.toContain('主题已切换为');
  });

  it('keeps non-Konling AppShell dock controls in the header action area', () => {
    const source = readFileSync(
      join(repoRoot, 'src/components/platform/app-shell.tsx'),
      'utf8',
    );

    expect(source).toContain("dockControls.filter((control) => control.control === 'konling')");
    expect(source).toContain("dockControls.filter((control) => control.control !== 'konling')");
    expect(source).toContain('data-platform-shell-dock-action={control.control}');
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
