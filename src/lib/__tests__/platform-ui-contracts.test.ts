import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FORBIDDEN_SHARED_UI_IMPORT_PREFIXES,
  PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX,
  PLATFORM_COMMERCIAL_WORKSPACE_SHELLS,
  PLATFORM_COMMERCIAL_WORKSPACE_ZONES,
  PLATFORM_FLOATING_ACTION_DOCK_CONTRACT,
  PLATFORM_FLOATING_ACTION_DOCK_CONTROL_CONTRACTS,
  PLATFORM_LEGACY_SHELL_RETIREMENT_CONTRACTS,
  PLATFORM_PREMIUM_VISUAL_THEME_CONTRACTS,
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

interface ReactElementLike {
  type?: unknown;
  props?: Record<string, unknown>;
}

function readSource(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function asElement(value: unknown): ReactElementLike {
  return value as ReactElementLike;
}

function childElements(children: unknown): ReactElementLike[] {
  const values = Array.isArray(children) ? children : [children];
  return values.filter((child): child is ReactElementLike => Boolean(child) && typeof child === 'object');
}

function classNameOf(element: ReactElementLike) {
  const className = element.props?.className;
  return typeof className === 'string' ? className : '';
}

function collectElementsByType(element: unknown, type: unknown): ReactElementLike[] {
  if (!element || typeof element !== 'object') return [];
  const current = element as ReactElementLike;
  const currentMatch = current.type === type ? [current] : [];
  return [
    ...currentMatch,
    ...childElements(current.props?.children).flatMap((child) => collectElementsByType(child, type)),
  ];
}

function collectLinks(element: unknown): ReactElementLike[] {
  if (!element || typeof element !== 'object') return [];
  const current = element as ReactElementLike;
  const currentMatch = typeof current.props?.href === 'string' ? [current] : [];
  return [...currentMatch, ...childElements(current.props?.children).flatMap((child) => collectLinks(child))];
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

    const subtleActionValues = Array.from(
      globals.matchAll(/--platform-action-subtle:\s*([^;]+);/g),
      (match) => match[1].trim(),
    );
    expect(subtleActionValues).toHaveLength(2);
    for (const value of subtleActionValues) {
      expect(value).not.toContain('/');
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
      'src/components/platform/status-and-evidence.tsx',
    ]) {
      const source = readSource(relativePath);
      for (const forbiddenPrefix of FORBIDDEN_SHARED_UI_IMPORT_PREFIXES) {
        expect(source).not.toContain(`from '${forbiddenPrefix}`);
        expect(source).not.toContain(`from "${forbiddenPrefix}`);
      }
    }
  });

  it('defines premium light and dark visual-world contracts', () => {
    expect(PLATFORM_PREMIUM_VISUAL_THEME_CONTRACTS.map((contract) => contract.theme)).toEqual(['light', 'dark']);
    expect(PLATFORM_PREMIUM_VISUAL_THEME_CONTRACTS.find((contract) => contract.theme === 'light')).toMatchObject({
      requiredRoles: expect.arrayContaining(['matte-chart', 'engineering-paper', 'instrument-panel', 'evidence-state']),
      requiredTokenCategories: expect.arrayContaining(['canvas', 'surface', 'foreground', 'border', 'action', 'evidence', 'chart']),
      prohibitedFallbacks: expect.arrayContaining(['unrelated white-card administration styling']),
    });
    expect(PLATFORM_PREMIUM_VISUAL_THEME_CONTRACTS.find((contract) => contract.theme === 'dark')).toMatchObject({
      requiredRoles: expect.arrayContaining(['night-navigation', 'low-light-instrument', 'trace-signal', 'warning-success-signal']),
      prohibitedFallbacks: expect.arrayContaining(['washed-out inverted light theme']),
    });
  });

  it('defines a shared floating action dock for Konling and management controls', () => {
    expect(PLATFORM_FLOATING_ACTION_DOCK_CONTRACT).toMatchObject({
      owner: 'platform-shell',
      controls: ['konling', 'management', 'settings'],
      visibility: 'role-aware',
      minHitTargetPx: 44,
      zIndexToken: 'platform-floating-dock',
      responsiveModes: expect.arrayContaining(['expanded', 'collapsed-icons', 'hidden-by-workspace']),
    });
    expect(PLATFORM_FLOATING_ACTION_DOCK_CONTRACT.collisionRules).toEqual(
      expect.arrayContaining([
        'dock owns bottom-right fixed controls on primary platform routes',
        'page-local fixed buttons must register as dock controls or move into local tool navigation',
      ]),
    );
    expect(PLATFORM_FLOATING_ACTION_DOCK_CONTROL_CONTRACTS.map((contract) => contract.control)).toEqual([
      'konling',
      'management',
      'settings',
    ]);
    expect(PLATFORM_FLOATING_ACTION_DOCK_CONTROL_CONTRACTS.find((contract) => contract.control === 'konling')?.payloadBoundary).toContain('private memory');
    expect(PLATFORM_FLOATING_ACTION_DOCK_CONTROL_CONTRACTS.find((contract) => contract.control === 'management')?.roleScope).toEqual([
      'teacher',
      'admin',
    ]);
    expect(PLATFORM_FLOATING_ACTION_DOCK_CONTROL_CONTRACTS.flatMap((contract) => contract.roleScope)).not.toContain('audit');
  });

  it('allows legacy shells to retire when a commercial shell preserves route and role semantics', () => {
    expect(PLATFORM_LEGACY_SHELL_RETIREMENT_CONTRACTS.map((contract) => contract.legacyComponent)).toEqual([
      'UnifiedTopBar',
      'ArenaPageShell',
      'TeacherLayout',
      'AdminConsoleHeader',
      'FeaturePageNav',
    ]);

    for (const contract of PLATFORM_LEGACY_SHELL_RETIREMENT_CONTRACTS) {
      expect(contract.allowedDisposition).toBe('retire-or-adapt');
      expect(contract.preservationRequirements).toEqual(
        expect.arrayContaining(['route access', 'role actions', 'contextual navigation']),
      );
      expect(contract.retirementRule).toContain('commercial shell');
    }
  });

  it('defines derived commercial workspace shell contracts for dense tools', () => {
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ZONES.map((zone) => zone.id)).toEqual([
      'context-strip',
      'command-bar',
      'instrument-area',
      'evidence-rail',
      'support-drawer',
    ]);
    for (const zone of PLATFORM_COMMERCIAL_WORKSPACE_ZONES) {
      expect(zone.domainOwnership).toBe('feature-owned');
      expect(zone.presentationOwnership).toBe('shared-commercial-surface');
    }

    expect(PLATFORM_COMMERCIAL_WORKSPACE_SHELLS.map((shell) => shell.workspace)).toEqual([
      'simulation',
      'arena',
      'control-workbench',
      'interactive-learning',
      'adaptive-learning',
      'teacher',
      'data-center',
      'admin',
    ]);

    for (const shell of PLATFORM_COMMERCIAL_WORKSPACE_SHELLS) {
      expect(shell.inheritsTokenCategories).toEqual(
        expect.arrayContaining(['canvas', 'surface', 'foreground', 'border', 'action']),
      );
      expect(shell.requiredConventions).toEqual(
        expect.arrayContaining([
          'account/profile action remains secondary to role cockpit action',
          'contextual navigation does not duplicate global product navigation',
          'panel wrappers preserve stable width and height while controls or fallback text change',
        ]),
      );
      expect(shell.zones).toEqual(PLATFORM_COMMERCIAL_WORKSPACE_ZONES.map((zone) => zone.id));
    }

    expect(PLATFORM_COMMERCIAL_WORKSPACE_SHELLS.find((shell) => shell.workspace === 'control-workbench')?.contextualNavigation).toContain('return target');
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.map((route) => route.href)).toEqual([
      '/simulations/[id]',
      '/interactive-learning/control-workbench',
      '/arena/challenges/[taskId]',
      '/interactive-learning/[lesson]',
      '/teacher/classes/[classId]/analytics-v2',
      '/data-center',
      '/admin/data-governance',
    ]);
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/simulations/[id]')?.workspace).toBe('simulation');
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/data-center')?.expectedZones).toEqual([
      'context-strip',
      'instrument-area',
      'command-bar',
    ]);
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/teacher/classes/[classId]/analytics-v2')?.expectedZones).toEqual([
      'instrument-area',
    ]);
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/admin/data-governance')?.expectedZones).toEqual([
      'instrument-area',
    ]);
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/admin/data-governance')?.density).toBe('governance');
  });

  it('keeps representative dense workspace sources on the commercial zone contract', () => {
    const workbenchSource = readSource('src/features/control-workbench/shell/control-workbench-shell.tsx');
    const arenaDetailSource = readSource('src/features/arena/challenge-detail.tsx');
    const manifestRuntimeSource = readSource('src/features/interactive/shared/manifest-runtime/layout-renderer.tsx');
    const unit41StudentRuntimeSource = readSource('src/features/interactive/unit-4-1-design-task-expression/student-page.tsx');
    const cruiseSimulationSource = readSource('src/app/simulations/cruise/page.tsx');
    const teacherAnalyticsSource = readSource('src/app/teacher/classes/[classId]/analytics-v2/page.tsx');
    const dataCenterSource = readSource('src/features/data-center/presentation-data-center.tsx');
    const adminGovernanceSource = readSource('src/features/admin/data-governance-dashboard.tsx');

    for (const zone of PLATFORM_COMMERCIAL_WORKSPACE_ZONES) {
      expect(workbenchSource).toContain(`data-commercial-workspace-zone="${zone.id}"`);
    }
    expect(workbenchSource).toContain('data-commercial-workspace="control-workbench"');
    expect(workbenchSource).toContain('data-task-workspace-archetype="engineering-analysis"');
    expect(workbenchSource).toContain('min-h-[360px]');
    expect(arenaDetailSource).toContain('data-commercial-workspace="arena-challenge-detail"');
    expect(arenaDetailSource).toContain('data-task-workspace-archetype="challenge-task"');
    expect(arenaDetailSource).toContain('data-commercial-workspace-zone="command-bar"');
    expect(cruiseSimulationSource).toContain('data-commercial-workspace="simulation-scene"');
    expect(cruiseSimulationSource).toContain('data-task-workspace-archetype="immersive-scene"');
    expect(manifestRuntimeSource).toContain('data-commercial-module-chrome');
    expect(manifestRuntimeSource).not.toContain("'data-task-workspace-archetype': 'lesson-runtime'");
    expect(unit41StudentRuntimeSource).toContain('data-task-workspace-archetype="lesson-runtime"');
    expect(manifestRuntimeSource).toContain('data-commercial-module-state');
    expect(teacherAnalyticsSource).toContain('data-commercial-operations-workspace="teacher-analytics"');
    expect(dataCenterSource).toContain('data-commercial-operations-workspace="data-center"');
    expect(dataCenterSource).toContain('repeat(auto-fit,minmax(min(100%,420px),1fr))');
    expect(adminGovernanceSource).toContain('data-commercial-operations-workspace="admin-data-governance"');
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

  it('marks only the deepest matching sidebar route active', () => {
    const sidebar = asElement(
      AppSidebar({
        activeHref: '/teacher/classes',
        navigation: [
          { id: 'teacher-home', label: '教师首页', href: '/teacher', role: 'teacher', order: 10 },
          { id: 'teacher-classes', label: '班级', href: '/teacher/classes', role: 'teacher', order: 20 },
        ],
      }),
    );
    const nav = asElement(sidebar.props?.children);
    const links = childElements(nav.props?.children);

    expect(links).toHaveLength(2);
    expect(classNameOf(links[0])).not.toContain('bg-platform-action-subtle');
    expect(classNameOf(links[1])).toContain('bg-platform-action-subtle');
  });

  it('keeps active route matching stable when the current route has query or hash', () => {
    const sidebar = asElement(
      AppSidebar({
        activeHref: '/teacher/classes?tab=all#roster',
        navigation: [
          { id: 'teacher-home', label: '教师首页', href: '/teacher', role: 'teacher', order: 10 },
          { id: 'teacher-classes', label: '班级', href: '/teacher/classes', role: 'teacher', order: 20 },
        ],
      }),
    );
    const links = collectLinks(sidebar);

    expect(links).toHaveLength(2);
    expect(classNameOf(links[1])).toContain('bg-platform-action-subtle');
  });

  it('renders nested navigation children in sidebar and mobile shell links', () => {
    const navigation: PlatformNavigationItem[] = [
      {
        id: 'teacher-home',
        label: '教师首页',
        href: '/teacher',
        role: 'teacher',
        order: 10,
        children: [
          { id: 'teacher-classes', label: '班级', href: '/teacher/classes', role: 'teacher', order: 20 },
        ],
      },
    ];
    const sidebar = asElement(AppSidebar({ activeHref: '/teacher/classes', navigation }));
    const shell = asElement(
      AppShell({
        role: 'teacher',
        title: '教师工作台',
        activeHref: '/teacher/classes',
        navigation,
        children: null,
      }),
    );
    const grid = asElement(shell.props?.children);
    const content = childElements(grid.props?.children)[1];
    const mobileNav = childElements(content.props?.children).find(
      (child) => child.type === 'nav' && child.props?.['aria-label'] === '平台导航',
    );

    if (!mobileNav) {
      throw new Error('Expected AppShell to render mobile role navigation.');
    }

    expect(collectLinks(sidebar).map((link) => link.props?.href)).toEqual([
      '/teacher',
      '/teacher/classes',
    ]);
    expect(collectLinks(mobileNav).map((link) => link.props?.href)).toEqual([
      '/teacher',
      '/teacher/classes',
    ]);
    expect(classNameOf(collectLinks(sidebar)[1])).toContain('bg-platform-action-subtle');
  });

  it('keeps role navigation reachable in the mobile shell', () => {
    const shell = asElement(
      AppShell({
        role: 'teacher',
        title: '教师工作台',
        activeHref: '/teacher/classes',
        navigation: [
          { id: 'teacher-home', label: '教师首页', href: '/teacher', role: 'teacher', order: 10 },
          { id: 'teacher-classes', label: '班级', href: '/teacher/classes', role: 'teacher', order: 20 },
        ],
        children: null,
      }),
    );
    const grid = asElement(shell.props?.children);
    const content = childElements(grid.props?.children)[1];
    const mobileNav = childElements(content.props?.children).find(
      (child) => child.type === 'nav' && child.props?.['aria-label'] === '平台导航',
    );

    if (!mobileNav) {
      throw new Error('Expected AppShell to render mobile role navigation.');
    }

    expect(classNameOf(mobileNav)).toContain('lg:hidden');
    const linkContainer = asElement(mobileNav.props?.children);
    expect(childElements(linkContainer.props?.children).map((link) => link.props?.href)).toEqual([
      '/teacher',
      '/teacher/classes',
    ]);
  });

  it('lets dense commercial workspaces defer fixed sidebar space until xl', () => {
    const shell = asElement(
      AppShell({
        role: 'admin',
        title: '数据中心',
        activeHref: '/data-center',
        sidebarMode: 'collapsible',
        navigation: [
          { id: 'platform-home', label: '首页', href: '/', role: 'admin', order: 10 },
          { id: 'platform-data-center', label: '数据中心', href: '/data-center', role: 'admin', order: 20 },
        ],
        children: null,
      }),
    );
    const grid = asElement(shell.props?.children);
    const gridChildren = childElements(grid.props?.children);
    const sidebar = gridChildren[0];
    const content = gridChildren[1];
    const mobileNav = childElements(content.props?.children).find(
      (child) => child.type === 'nav' && child.props?.['aria-label'] === '平台导航',
    );
    if (!mobileNav) throw new Error('expected mobile platform navigation');

    expect(classNameOf(grid)).toContain('xl:grid-cols-[248px_1fr]');
    expect(classNameOf(grid)).not.toContain('lg:grid-cols-[248px_1fr]');
    expect(sidebar.type).toBe(AppSidebar);
    expect(classNameOf(sidebar)).toContain('hidden xl:block');
    expect(classNameOf(mobileNav)).toContain('xl:hidden');
  });

  it('does not reserve sidebar layout space when shell navigation is empty', () => {
    const shell = asElement(
      AppShell({
        role: 'teacher',
        title: '教师工作台',
        navigation: [],
        children: null,
      }),
    );
    const grid = asElement(shell.props?.children);
    const gridChildren = childElements(grid.props?.children);

    expect(classNameOf(grid)).not.toContain('lg:grid-cols-[248px_1fr]');
    expect(gridChildren.some((child) => child.type === AppSidebar)).toBe(false);
    expect(
      childElements(gridChildren[0].props?.children).some(
        (child) => child.type === 'nav' && child.props?.['aria-label'] === '平台导航',
      ),
    ).toBe(false);
  });
});
