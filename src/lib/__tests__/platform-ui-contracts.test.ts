import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FORBIDDEN_SHARED_UI_IMPORT_PREFIXES,
  PLATFORM_SEMANTIC_TOKENS,
  PLATFORM_SHELL_ADAPTERS,
  PLATFORM_SHELL_ROLLBACK_FLAG,
  createPlatformNavigation,
  filterPlatformNavigation,
  type PlatformNavigationItem,
} from '@/components/platform/platform-ui-contracts';
import {
  AppBreadcrumb,
  AppHeader,
  AppShell,
  AppSidebar,
  PlatformSurface,
  ThemeSwitcher,
} from '@/components/platform/app-shell';

const rootDir = path.resolve(__dirname, '../../..');

function readSource(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

describe('platform UI contracts', () => {
  it('defines semantic tokens in contracts, globals, and Tailwind', () => {
    const globals = readSource('src/app/globals.css');
    const tailwindConfig = readSource('tailwind.config.ts');
    const tokenNames = PLATFORM_SEMANTIC_TOKENS.map((token) => token.name);

    expect(PLATFORM_SEMANTIC_TOKENS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'canvas', name: 'platform-canvas' }),
        expect.objectContaining({ category: 'surface', name: 'platform-surface-raised' }),
        expect.objectContaining({ category: 'foreground', name: 'platform-fg-secondary' }),
        expect.objectContaining({ category: 'border', name: 'platform-border-strong' }),
        expect.objectContaining({ category: 'action', name: 'platform-action-primary' }),
        expect.objectContaining({ category: 'evidence', name: 'platform-evidence-eligible' }),
        expect.objectContaining({ category: 'privacy', name: 'platform-privacy-restricted' }),
        expect.objectContaining({ category: 'replay', name: 'platform-replay-ready' }),
        expect.objectContaining({ category: 'evaluation', name: 'platform-evaluation-official' }),
      ]),
    );

    for (const tokenName of tokenNames) {
      expect(globals).toContain(`--${tokenName}:`);
      expect(tailwindConfig).toContain(`'${tokenName}'`);
      expect(tailwindConfig).toContain(`hsl(var(--${tokenName}))`);
    }
  });

  it('keeps role navigation ordered and feature-flag aware', () => {
    const items: PlatformNavigationItem[] = [
      { id: 'teacher-governance', label: '治理', href: '/teacher/governance', role: 'teacher', order: 30 },
      { id: 'student-home', label: '首页', href: '/dashboard', role: 'student', order: 10 },
      {
        id: 'student-adaptive',
        label: '自适应',
        href: '/profile/growth',
        role: 'student',
        order: 20,
        featureFlag: 'adaptive-center',
      },
      { id: 'student-knowledge', label: '知识图谱', href: '/knowledge', role: 'student', order: 15 },
    ];

    expect(createPlatformNavigation(items).map((item) => item.id)).toEqual([
      'student-home',
      'student-knowledge',
      'student-adaptive',
      'teacher-governance',
    ]);
    expect(filterPlatformNavigation(items, { role: 'student', enabledFeatureFlags: [] }).map((item) => item.id)).toEqual([
      'student-home',
      'student-knowledge',
    ]);
    expect(filterPlatformNavigation(items, { role: 'student', enabledFeatureFlags: ['adaptive-center'] }).map((item) => item.id)).toEqual([
      'student-home',
      'student-knowledge',
      'student-adaptive',
    ]);
  });

  it('defines shell primitives, adapters, rollback, and ownership guardrails', () => {
    expect(AppShell).toBeTypeOf('function');
    expect(AppHeader).toBeTypeOf('function');
    expect(AppSidebar).toBeTypeOf('function');
    expect(AppBreadcrumb).toBeTypeOf('function');
    expect(ThemeSwitcher).toBeTypeOf('function');
    expect(PlatformSurface).toBeTypeOf('function');

    expect(PLATFORM_SHELL_ROLLBACK_FLAG).toBe('platform.unifiedShell');
    expect(PLATFORM_SHELL_ADAPTERS.map((adapter) => adapter.legacyComponent)).toEqual([
      'FeaturePageNav',
      'UnifiedTopBar',
      'ArenaPageShell',
      'TeacherLayout',
      'AdminConsoleHeader',
    ]);
    expect(FORBIDDEN_SHARED_UI_IMPORT_PREFIXES).toEqual(
      expect.arrayContaining([
        '@/features/',
        '@/resources/',
        '@/lib/resource-registry',
        '@/features/lesson-engine',
      ]),
    );

    for (const relativePath of [
      'src/components/platform/platform-ui-contracts.ts',
      'src/components/platform/app-shell.tsx',
    ]) {
      const source = readSource(relativePath);
      for (const forbiddenPrefix of FORBIDDEN_SHARED_UI_IMPORT_PREFIXES) {
        expect(source).not.toContain(`from '${forbiddenPrefix}`);
        expect(source).not.toContain(`from "${forbiddenPrefix}`);
      }
    }
  });

  it('forwards the active route from AppShell to AppSidebar', () => {
    const shell = AppShell({
      role: 'teacher',
      title: '教师工作台',
      activeHref: '/teacher/classes',
      navigation: [
        { id: 'teacher-home', label: '教师首页', href: '/teacher', role: 'teacher', order: 10 },
        { id: 'teacher-classes', label: '班级', href: '/teacher/classes', role: 'teacher', order: 20 },
      ],
      children: null,
    });

    const grid = shell.props.children;
    const sidebar = Array.isArray(grid.props.children) ? grid.props.children[0] : null;

    expect(sidebar?.type).toBe(AppSidebar);
    expect(sidebar?.props.activeHref).toBe('/teacher/classes');
  });
});
