import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { PageFloatingControlsProvider } from '@/components/shared/page-floating-controls';
import { PLATFORM_LAYERS, platformLayerStyle } from '@/components/platform/platform-layers';
import {
  FORBIDDEN_SHARED_UI_IMPORT_PREFIXES,
  PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX,
  PLATFORM_COMMERCIAL_WORKSPACE_SHELLS,
  PLATFORM_COMMERCIAL_WORKSPACE_ZONES,
  PLATFORM_DOCK_CONTROL_DISPOSITION_CONTRACTS,
  PLATFORM_FLOATING_ACTION_DOCK_CONTRACT,
  PLATFORM_FLOATING_ACTION_DOCK_CONTROL_CONTRACTS,
  PLATFORM_LEGACY_SHELL_RETIREMENT_CONTRACTS,
  PLATFORM_PREMIUM_VISUAL_THEME_CONTRACTS,
  PLATFORM_SIMULATION_STATE_ROLE_TOKENS,
  PLATFORM_SIMULATION_THEME_TEMPLATES,
  PLATFORM_SEMANTIC_TOKENS,
  PLATFORM_SHELL_ADAPTERS,
  PLATFORM_SHELL_ROLLBACK_FLAG,
  createPlatformNavigation,
  filterPlatformNavigation,
  type PlatformNavigationItem,
  type PlatformRole,
} from '@/components/platform/platform-ui-contracts';
import {
  APP_SHELL_NAVIGATION_PREFERENCE_STORAGE_KEY,
  AppBreadcrumb,
  AppHeader,
  AppShell,
  AppSidebar,
  PlatformSurface,
  ThemeSwitcher,
  getBrowserNavigationPreferenceStorage,
  getAppShellDesktopGridClassName,
  readAppShellNavigationPreference,
  resolveAppShellNavigationPreference,
  writeAppShellNavigationPreference,
} from '@/components/platform/app-shell';
import {
  isTeacherOperationsNavActive,
  resolveTeacherOperationsNavHref,
} from '@/features/teacher/teacher-operations-nav';
import { resolveTeacherOperationsClassHref } from '@/features/teacher/teacher-dashboard';
import {
  PLATFORM_PRIMARY_ROUTE_INVENTORY,
  STUDENT_PRIMARY_NAVIGATION_ENTRY_IDS,
  getPlatformRouteNavigation,
  resolvePlatformRouteInventory,
} from '@/lib/platform-role-navigation';

const rootDir = path.resolve(__dirname, '../../..');

interface ReactElementLike {
  type?: unknown;
  props?: Record<string, unknown>;
}

function readSource(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function expectNeedlesInOrder(source: string, needles: readonly string[]) {
  let previousIndex = -1;
  for (const needle of needles) {
    const nextIndex = source.indexOf(needle);
    expect(nextIndex).toBeGreaterThan(previousIndex);
    previousIndex = nextIndex;
  }
}

function listSourceFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(rootDir, relativeDir);
  return readdirSync(absoluteDir).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry);
    const absolutePath = path.join(rootDir, relativePath);
    if (statSync(absolutePath).isDirectory()) return listSourceFiles(relativePath);
    return relativePath.endsWith('.tsx') ? [relativePath] : [];
  });
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

function collectElementsByDataAttribute(element: unknown, attribute: string, value?: string): ReactElementLike[] {
  if (!element || typeof element !== 'object') return [];
  const current = element as ReactElementLike;
  const currentValue = current.props?.[attribute];
  const currentMatch =
    typeof currentValue === 'string' && (value === undefined || currentValue === value) ? [current] : [];
  return [
    ...currentMatch,
    ...childElements(current.props?.children).flatMap((child) =>
      collectElementsByDataAttribute(child, attribute, value),
    ),
  ];
}

function renderAppShellMarkup(props: Parameters<typeof AppShell>[0]) {
  const OptionalChildrenThemeProvider = ThemeProvider as ComponentType<{
    children?: ReactNode;
    defaultTheme?: 'light' | 'dark' | 'system';
  }>;

  return renderToStaticMarkup(
    createElement(
      OptionalChildrenThemeProvider,
      { defaultTheme: 'light' },
      createElement(PageFloatingControlsProvider, null, createElement(AppShell, props)),
    ),
  );
}

function createPreferenceStorage(initialValue?: string) {
  const values = new Map<string, string>();
  if (initialValue !== undefined) {
    values.set(APP_SHELL_NAVIGATION_PREFERENCE_STORAGE_KEY, initialValue);
  }
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe('platform UI contracts', () => {
  it('defines semantic tokens in contracts, globals, and Tailwind', () => {
    const globals = readSource('src/app/globals.css');
    const tailwindConfig = readSource('tailwind.config.ts');
    const tokenNames = PLATFORM_SEMANTIC_TOKENS.map((token) => token.name);

    expect(PLATFORM_SEMANTIC_TOKENS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'canvas',
          name: 'platform-canvas',
        }),
        expect.objectContaining({
          category: 'surface',
          name: 'platform-surface-raised',
        }),
        expect.objectContaining({
          category: 'foreground',
          name: 'platform-fg-secondary',
        }),
        expect.objectContaining({
          category: 'border',
          name: 'platform-border-strong',
        }),
        expect.objectContaining({
          category: 'action',
          name: 'platform-action-primary',
        }),
        expect.objectContaining({
          category: 'evidence',
          name: 'platform-evidence-eligible',
        }),
        expect.objectContaining({
          category: 'privacy',
          name: 'platform-privacy-restricted',
        }),
        expect.objectContaining({
          category: 'replay',
          name: 'platform-replay-ready',
        }),
        expect.objectContaining({
          category: 'evaluation',
          name: 'platform-evaluation-official',
        }),
      ]),
    );

    for (const tokenName of tokenNames) {
      expect(globals).toContain(`--${tokenName}:`);
      expect(tailwindConfig).toContain(`'${tokenName}'`);
      expect(tailwindConfig).toContain(`hsl(var(--${tokenName}))`);
    }

    const subtleActionValues = Array.from(globals.matchAll(/--platform-action-subtle:\s*([^;]+);/g), (match) =>
      match[1].trim(),
    );
    expect(subtleActionValues).toHaveLength(2);
    for (const value of subtleActionValues) {
      expect(value).not.toContain('/');
    }
  });

  it('keeps role navigation ordered and feature-flag aware', () => {
    const items: PlatformNavigationItem[] = [
      {
        id: 'teacher-governance',
        label: '治理',
        href: '/teacher/governance',
        role: 'teacher',
        order: 30,
      },
      {
        id: 'student-home',
        label: '首页',
        href: '/dashboard',
        role: 'student',
        order: 10,
      },
      {
        id: 'student-adaptive',
        label: '自适应',
        href: '/profile/growth',
        role: 'student',
        order: 20,
        featureFlag: 'adaptive-center',
      },
      {
        id: 'student-knowledge',
        label: '知识图谱',
        href: '/knowledge',
        role: 'student',
        order: 15,
      },
    ];

    expect(createPlatformNavigation(items).map((item) => item.id)).toEqual([
      'student-home',
      'student-knowledge',
      'student-adaptive',
      'teacher-governance',
    ]);
    expect(
      filterPlatformNavigation(items, {
        role: 'student',
        enabledFeatureFlags: [],
      }).map((item) => item.id),
    ).toEqual(['student-home', 'student-knowledge']);
    expect(
      filterPlatformNavigation(items, {
        role: 'student',
        enabledFeatureFlags: ['adaptive-center'],
      }).map((item) => item.id),
    ).toEqual(['student-home', 'student-knowledge', 'student-adaptive']);
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
      expect.arrayContaining(['@/features/', '@/resources/', '@/lib/resource-registry', '@/features/lesson-engine']),
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
      requiredTokenCategories: expect.arrayContaining([
        'canvas',
        'surface',
        'foreground',
        'border',
        'action',
        'evidence',
        'chart',
      ]),
      prohibitedFallbacks: expect.arrayContaining(['unrelated white-card administration styling']),
    });
    expect(PLATFORM_PREMIUM_VISUAL_THEME_CONTRACTS.find((contract) => contract.theme === 'dark')).toMatchObject({
      requiredRoles: expect.arrayContaining([
        'night-navigation',
        'low-light-instrument',
        'trace-signal',
        'warning-success-signal',
      ]),
      prohibitedFallbacks: expect.arrayContaining(['washed-out inverted light theme']),
    });
  });

  it('defines governed simulation light and dark templates with state roles', () => {
    expect(PLATFORM_SIMULATION_THEME_TEMPLATES.map((template) => template.theme)).toEqual(['light', 'dark']);
    expect(PLATFORM_SIMULATION_THEME_TEMPLATES.find((template) => template.theme === 'light')).toMatchObject({
      visualWorld: expect.stringContaining('daylight engineering chart'),
      roles: expect.arrayContaining([
        'scene-canvas',
        'translucent-shell',
        'local-panel',
        'bottom-toolbar',
        'hint-strip',
      ]),
      tokenNames: expect.arrayContaining([
        'platform-canvas',
        'platform-surface-overlay',
        'platform-fg-primary',
        'platform-border',
        'platform-action-primary',
        'platform-evidence-context',
        'platform-replay-ready',
        'platform-evaluation-official',
      ]),
      prohibitedFallbacks: expect.arrayContaining(['generic white administration cards', 'decorative glow blobs']),
    });
    expect(PLATFORM_SIMULATION_THEME_TEMPLATES.find((template) => template.theme === 'dark')).toMatchObject({
      visualWorld: expect.stringContaining('night bridge'),
      roles: expect.arrayContaining([
        'scene-canvas',
        'translucent-shell',
        'local-panel',
        'bottom-toolbar',
        'hint-strip',
      ]),
      tokenNames: expect.arrayContaining([
        'platform-canvas-muted',
        'platform-surface-overlay',
        'platform-fg-secondary',
        'platform-border-strong',
        'platform-chart-1',
      ]),
      prohibitedFallbacks: expect.arrayContaining(['one-note navy card skin', 'cyan-only chrome']),
    });

    expect(PLATFORM_SIMULATION_STATE_ROLE_TOKENS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'preview',
          tokenName: 'platform-evaluation-preview',
        }),
        expect.objectContaining({
          role: 'official',
          tokenName: 'platform-evaluation-official',
        }),
        expect.objectContaining({
          role: 'replay',
          tokenName: 'platform-replay-ready',
        }),
        expect.objectContaining({
          role: 'warning',
          tokenName: 'platform-evidence-context',
        }),
        expect.objectContaining({
          role: 'success',
          tokenName: 'platform-evidence-eligible',
        }),
        expect.objectContaining({
          role: 'danger',
          tokenName: 'platform-evidence-unsupported',
        }),
        expect.objectContaining({
          role: 'unavailable',
          tokenName: 'platform-replay-missing',
        }),
      ]),
    );
  });

  it('defines a shared floating action dock for Konling and management controls', () => {
    expect(PLATFORM_FLOATING_ACTION_DOCK_CONTRACT).toMatchObject({
      owner: 'platform-shell',
      controls: ['konling', 'management', 'settings', 'page-tools', 'issue-badge'],
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
      'page-tools',
      'issue-badge',
    ]);
    expect(
      PLATFORM_FLOATING_ACTION_DOCK_CONTROL_CONTRACTS.find((contract) => contract.control === 'konling')
        ?.payloadBoundary,
    ).toContain('private memory');
    expect(
      PLATFORM_FLOATING_ACTION_DOCK_CONTROL_CONTRACTS.find((contract) => contract.control === 'management')?.roleScope,
    ).toEqual(['teacher', 'admin']);
    expect(PLATFORM_FLOATING_ACTION_DOCK_CONTROL_CONTRACTS.flatMap((contract) => contract.roleScope)).not.toContain(
      'audit',
    );
    expect(PLATFORM_DOCK_CONTROL_DISPOSITION_CONTRACTS.map((contract) => contract.legacyComponent)).toEqual([
      'PageFloatingControls',
      'GlobalAIFloatingButton',
    ]);
    for (const contract of PLATFORM_DOCK_CONTROL_DISPOSITION_CONTRACTS) {
      expect(contract.owner).toBe('platform-shell');
      expect(contract.disposition).toBe('register-or-retire');
      expect(contract.removalCondition).toContain('dock');
      expect(contract.collisionRequirements).toEqual(
        expect.arrayContaining(['safe-area', 'z-index', 'keyboard reachability', 'primary task control clearance']),
      );
    }
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

    expect(
      PLATFORM_COMMERCIAL_WORKSPACE_SHELLS.find((shell) => shell.workspace === 'control-workbench')
        ?.contextualNavigation,
    ).toContain('return target');
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.map((route) => route.href)).toEqual([
      '/simulations/[id]',
      '/interactive-learning/control-workbench',
      '/arena/challenges/[taskId]',
      '/interactive-learning/[lesson]',
      '/teacher',
      '/teacher/classes',
      '/teacher/lesson-plans',
      '/teacher/resources',
      '/teacher/history',
      '/teacher/classes/[classId]/analytics-v2',
      '/admin',
      '/admin/users',
      '/admin/config',
      '/admin/states',
      '/data-center',
      '/admin/data-governance',
    ]);
    expect(
      PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/simulations/[id]')?.workspace,
    ).toBe('simulation');
    expect(
      PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/data-center')?.expectedZones,
    ).toEqual(['context-strip', 'instrument-area', 'command-bar']);
    expect(
      PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find(
        (route) => route.href === '/teacher/classes/[classId]/analytics-v2',
      )?.expectedZones,
    ).toEqual(['instrument-area']);
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/teacher')?.density).toBe(
      'analytics',
    );
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/admin')?.density).toBe(
      'governance',
    );
    expect(
      PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/admin/data-governance')
        ?.expectedZones,
    ).toEqual(['instrument-area']);
    expect(
      PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/admin/data-governance')?.density,
    ).toBe('governance');
  });

  it('keeps representative dense workspace sources on the commercial zone contract', () => {
    const appShellSource = readSource('src/components/platform/app-shell.tsx');
    const workbenchSource = readSource('src/features/control-workbench/shell/control-workbench-shell.tsx');
    const arenaDetailSource = readSource('src/features/arena/challenge-detail.tsx');
    const manifestRuntimeSource = readSource('src/features/interactive/shared/manifest-runtime/layout-renderer.tsx');
    const unit41StudentRuntimeSource = [
      readSource('src/features/interactive/shared/lesson-runtime-shell.tsx'),
      readSource('src/features/interactive/unit-4-1-design-task-expression/student-page.tsx'),
    ].join('\n');
    const cruiseSimulationSource = readSource('src/app/simulations/cruise/page.tsx');
    const simulationsCatalogSource = readSource('src/app/simulations/page.tsx');
    const simulationShellSource = readSource('src/app/simulations/_components/simulation-shell.tsx');
    const simulationLocalToolsSource = readSource('src/app/simulations/_components/simulation-local-tools.tsx');
    const simulationResourceUiSource = readSource('src/resources/simulations/components/simulation-ui.tsx');
    const teacherAnalyticsSource = readSource('src/app/teacher/classes/[classId]/analytics-v2/page.tsx');
    const teacherLayoutSource = readSource('src/app/teacher/layout.tsx');
    const teacherOperationsNavSource = readSource('src/features/teacher/teacher-operations-nav.tsx');
    const roleWorkspaceShellSource = readSource('src/components/platform/role-workspace-shell.tsx');
    const teacherDashboardSource = readSource('src/features/teacher/teacher-dashboard.tsx');
    const teacherGradingSource = readSource('src/features/assessment/document-rubric-grading-ui.tsx');
    const teacherReportLedgerLayoutSource = readSource('src/app/(teacher-report-ledger)/teacher/layout.tsx');
    const teacherGradingPageSource = readSource('src/app/(teacher-report-ledger)/teacher/grading-workbench/page.tsx');
    const teacherClassesSource = readSource('src/app/teacher/classes/page.tsx');
    const teacherLessonPlansSource = readSource('src/app/teacher/lesson-plans/page.tsx');
    const teacherResourcesSource = readSource('src/app/teacher/resources/page.tsx');
    const teacherHistorySource = readSource('src/app/teacher/history/page.tsx');
    const adminLayoutSource = readSource('src/app/admin/layout.tsx');
    const adminHeaderSource = readSource('src/features/admin/admin-console-header.tsx');
    const adminHomeSource = readSource('src/features/admin/admin-console-home.tsx');
    const adminUsersSource = readSource('src/features/admin/admin-dashboard.tsx');
    const adminConfigSource = readSource('src/features/admin/system-config-dashboard.tsx');
    const adminStatesSource = readSource('src/features/admin/states/admin-states-dashboard.tsx');
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
    expect(cruiseSimulationSource).toContain('SimulationShell');
    expect(simulationShellSource).toContain('data-commercial-workspace="simulation-scene"');
    expect(simulationShellSource).toContain('data-task-workspace-archetype="immersive-scene"');
    expect(simulationShellSource).toContain('data-simulation-theme-template="mission-workspace"');
    expect(simulationShellSource).toContain('data-simulation-scene-color-policy="feature-owned"');
    expect(simulationShellSource).not.toContain('data-simulation-shell-profile-action');
    expect(simulationShellSource).toContain('SimulationLocalToolWorkspace');
    expect(simulationShellSource).toContain('panelLayout="side-rails"');
    expect(simulationShellSource).toContain('data-simulation-shell-structured-surfaces="below-primary-scene"');
    expect(simulationShellSource).toContain('data-command-deck-context-placement="below-primary-scene"');
    expect(simulationShellSource).not.toContain('workspaceSlots={hasStructuredSlots');
    expect(simulationsCatalogSource).toContain('data-simulation-theme-template="catalog"');
    expect(simulationsCatalogSource).toContain('data-simulation-visual-world="instrument-atlas"');
    expect(simulationsCatalogSource).toContain('data-simulation-state-role="preview"');
    expect(simulationsCatalogSource).toContain('data-simulation-state-role="official"');
    expect(simulationsCatalogSource).not.toMatch(
      /\b(?:bg|text|border)-(?:green|yellow|red|black|white|slate|cyan|blue)-/,
    );
    expect(simulationsCatalogSource).not.toContain('bg-gradient');
    expect(simulationLocalToolsSource).toContain('data-simulation-local-workspace={template.id}');
    expect(simulationLocalToolsSource).toContain('data-simulation-theme-template="local-tools"');
    expect(simulationLocalToolsSource).toContain('data-simulation-state-role="hint"');
    expect(simulationLocalToolsSource).toContain('data-simulation-local-panel-layout={panelLayout}');
    expect(simulationLocalToolsSource).toContain('data-simulation-local-hint-strip');
    expect(simulationLocalToolsSource).toContain('data-simulation-panel-collapsible="true"');
    expect(simulationLocalToolsSource).toContain('data-simulation-mobile-secondary-controls="stacked-sheets"');
    expect(simulationLocalToolsSource).toContain('order-1 flex min-w-0 flex-1 flex-col');
    expect(simulationLocalToolsSource).toContain(
      "side === 'left' && panelLayout === 'side-rails' ? 'order-2 lg:hidden'",
    );
    expect(simulationLocalToolsSource).toContain("side === 'left' && panelLayout === 'stacked' ? 'order-2'");
    expect(simulationLocalToolsSource).toContain(
      "side === 'right' && panelLayout === 'side-rails' ? 'order-3 lg:hidden'",
    );
    expect(simulationLocalToolsSource).toContain("side === 'right' && panelLayout === 'stacked' ? 'order-3'");
    expect(simulationLocalToolsSource).toContain('ChevronDown');
    expect(simulationLocalToolsSource).toContain('focus-visible:ring-2 focus-visible:ring-platform-action-primary');
    expect(simulationLocalToolsSource).not.toContain('platform-action-ring');
    expect(simulationLocalToolsSource).not.toContain('platform-fg-tertiary');
    // 唯一的按钮是提示条关闭钮（占位命令条已移除，其余均为非交互结构）。
    expect(simulationLocalToolsSource.match(/<button/g)?.length ?? 0).toBe(1);
    expect(simulationLocalToolsSource).not.toContain('sticky bottom-3');
    expect(simulationLocalToolsSource).toContain('data-simulation-local-panel-zone={side ===');
    expect(simulationLocalToolsSource).toContain('data-task-workspace-zone={side ===');
    expect(simulationLocalToolsSource).not.toContain('data-commercial-workspace-zone={side ===');
    expect(simulationLocalToolsSource.indexOf('data-simulation-local-primary-column')).toBeLessThan(
      simulationLocalToolsSource.indexOf('<SimulationLocalPanel side="left"'),
    );
    expect(simulationResourceUiSource).toContain('data-simulation-scene-local-chrome="removed"');
    expect(simulationResourceUiSource).toContain('data-command-deck-panel-anchor="top-command-area"');
    expect(simulationResourceUiSource).not.toContain('返回上一层');
    expect(simulationResourceUiSource).not.toContain('<Link');
    expect(manifestRuntimeSource).toContain('data-commercial-module-chrome');
    expect(manifestRuntimeSource).not.toContain("'data-task-workspace-archetype': 'lesson-runtime'");
    expect(unit41StudentRuntimeSource).toContain('data-task-workspace-archetype="lesson-runtime"');
    expect(manifestRuntimeSource).toContain('data-commercial-module-state');
    expect(teacherAnalyticsSource).toContain('data-commercial-operations-workspace="teacher-operations"');
    expect(teacherAnalyticsSource).toContain('data-report-ledger-surface="teacher-class-analytics-report"');
    expect(roleWorkspaceShellSource).toContain('<AppShell');
    expect(roleWorkspaceShellSource).toContain('activeHref={pathname}');
    expect(roleWorkspaceShellSource).toContain('sidebarMode="collapsible"');
    expect(roleWorkspaceShellSource).not.toContain("variant={workspaceRole === 'admin' ? 'admin' : 'default'}");
    expect(roleWorkspaceShellSource).toContain("teacher: { href: '/teacher', label: '个人中心' }");
    expect(roleWorkspaceShellSource).toContain("admin: { href: '/admin', label: '个人中心' }");
    expect(roleWorkspaceShellSource).toContain('accountHref={accountTarget.href}');
    expect(roleWorkspaceShellSource).toContain('accountLabel={accountTarget.label}');
    expect(roleWorkspaceShellSource).toContain('userMenu={(');
    expect(roleWorkspaceShellSource).toContain('<UserMenu');
    expect(appShellSource).toContain('function hasRightRailWorkspaceSlots');
    expect(appShellSource).toContain("data-app-shell-workspace-right-rail={hasRightRail ? 'present' : 'absent'}");
    expect(appShellSource).toContain(
      "className={cn('grid gap-4', hasRightRail && 'xl:grid-cols-[minmax(0,1fr)_320px]')}",
    );
    expect(teacherLayoutSource).toContain('TeacherOperationsNav');
    expect(teacherLayoutSource).toContain('<RoleWorkspaceShell');
    expect(teacherLayoutSource).toContain('workspaceRole="teacher"');
    expect(teacherLayoutSource).toContain('data-commercial-workspace-zone="command-bar"');
    expect(teacherOperationsNavSource).toContain('TEACHER_OPERATIONS_NAVIGATION');
    expect(teacherOperationsNavSource).toContain('data-teacher-operations-continuous-nav');
    expect(teacherOperationsNavSource).toContain('data-teacher-operations-current-route');
    expect(teacherDashboardSource).toContain('data-commercial-operations-workspace="teacher-operations"');
    expect(teacherDashboardSource).toContain('data-operations-first-viewport="teacher-attention"');
    expect(teacherDashboardSource).toContain('data-teacher-operations-active-work');
    expect(teacherDashboardSource).toContain('data-teacher-operations-pending-action');
    expect(teacherDashboardSource).toContain('/teacher/classes');
    expect(teacherDashboardSource).toContain('/teacher/history');
    expect(teacherDashboardSource).toContain('resolveTeacherOperationsClassHref(activeSessions, recentClasses)');
    expect(teacherDashboardSource).toContain("activeClassHref === '/teacher/classes' ? '' : '/analytics-v2'");
    expect(teacherDashboardSource).toContain('TEACHER_OPERATIONS_ANALYTICS_SLOTS');
    expect(teacherDashboardSource).toContain('data-operations-unavailable-slot');
    expect(teacherDashboardSource).toContain(
      'data-operations-fabricates-metrics={String(unavailableSlot.fabricatesMetrics)}',
    );
    expect(teacherDashboardSource).toContain('data-report-ledger-surface="teacher-prep-pack-review-slot"');
    expect(teacherDashboardSource).toContain(
      'data-operations-overlay-lifecycle="preview review activate archive rollback"',
    );
    expect(teacherDashboardSource).toContain('data-operations-mutates-base-manifest="false"');
    expect(teacherDashboardSource).toContain('不修改基础 manifest');
    expect(teacherDashboardSource).toContain('data-report-ledger-surface="assistant-effect-report-export"');
    expect(teacherGradingSource).toContain('data-report-ledger-surface="document-grading-workbench-ledger"');
    expect(teacherGradingSource).toContain('data-report-ledger-privacy-scope="teacher-review"');
    expect(teacherGradingSource).toContain('状态图例：等待选择');
    expect(teacherGradingPageSource).toContain(
      'session.user.role !== UserRole.TEACHER && session.user.role !== UserRole.ADMIN',
    );
    expect(teacherLayoutSource).toContain("session.user.role !== 'TEACHER'");
    expect(teacherLayoutSource).not.toContain('adminGradingWorkbenchAccess');
    expect(teacherReportLedgerLayoutSource).toContain(
      "session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN'",
    );
    expect(teacherReportLedgerLayoutSource).toContain('<RoleWorkspaceShell');
    expect(teacherReportLedgerLayoutSource).toContain(
      "workspaceRole={session.user.role === 'ADMIN' ? 'admin' : 'teacher'}",
    );
    expect(teacherReportLedgerLayoutSource).toContain("commandBar: session.user.role === 'TEACHER'");
    expect(teacherReportLedgerLayoutSource).toContain('data-commercial-operations-workspace="teacher-report-ledger"');
    expect(teacherClassesSource).toContain('data-commercial-operations-workspace="teacher-operations"');
    expect(teacherLessonPlansSource).toContain('data-commercial-operations-workspace="teacher-operations"');
    expect(teacherResourcesSource).toContain('data-commercial-operations-workspace="teacher-operations"');
    expect(teacherHistorySource).toContain('data-commercial-operations-workspace="teacher-operations"');
    expect(dataCenterSource).toContain('data-commercial-operations-workspace="data-center"');
    expect(dataCenterSource).toContain('repeat(auto-fit,minmax(min(100%,420px),1fr))');
    expect(adminLayoutSource).toContain('<RoleWorkspaceShell');
    expect(adminLayoutSource).toContain('workspaceRole="admin"');
    expect(adminLayoutSource).toContain('session.user.role !== UserRole.ADMIN');
    expect(adminHeaderSource).not.toContain('<UserMenu');
    expect(adminHomeSource).toContain('data-commercial-operations-workspace="admin-operations"');
    expect(adminHomeSource).toContain('data-operations-first-viewport="admin-risk-actions"');
    expect(adminHomeSource).toContain('data-admin-operations-risk-queue');
    expect(adminHomeSource).toContain('data-admin-operations-pending-action');
    expect(adminHomeSource).toContain('/admin/users');
    expect(adminHomeSource).toContain('/admin/config');
    expect(adminHomeSource).toContain('/admin/data-governance');
    expect(adminUsersSource).toContain('data-commercial-operations-workspace="admin-operations"');
    expect(adminConfigSource).toContain('data-commercial-operations-workspace="admin-operations"');
    expect(adminStatesSource).toContain('data-commercial-operations-workspace="admin-operations"');
    expect(adminHomeSource).toContain('ADMIN_OPERATIONS_CONSOLE_DOMAINS');
    expect(adminHomeSource).toContain('data-admin-operations-future-domains');
    expect(adminGovernanceSource).toContain('data-commercial-operations-workspace="admin-operations"');
    expect(adminGovernanceSource).toContain('data-report-ledger-surface="governance-data-quality-snapshot"');
    expect(adminGovernanceSource).toContain('data-report-ledger-privacy-scope="admin-governance"');
  });

  it('does not render an empty AppShell workspace right rail for command-only role workspaces', () => {
    const commandOnlyMarkup = renderAppShellMarkup({
      viewerRole: 'teacher',
      title: '教师工作台',
      workspaceSlots: {
        commandBar: createElement('nav', { 'data-test-command': 'teacher' }, '教师操作'),
      },
      children: createElement('main', null, '正文'),
    });

    expect(commandOnlyMarkup).toContain('data-app-shell-workspace="true"');
    expect(commandOnlyMarkup).toContain('data-app-shell-workspace-right-rail="absent"');
    expect(commandOnlyMarkup).not.toContain('xl:grid-cols-[minmax(0,1fr)_320px]');
    expect(commandOnlyMarkup).not.toContain('data-app-shell-zone="evidence-rail"');

    const rightRailMarkup = renderAppShellMarkup({
      viewerRole: 'admin',
      title: '管理员后台',
      workspaceSlots: {
        contextHeader: createElement('div', null, '上下文'),
        statusRail: createElement('aside', null, '状态'),
      },
      children: createElement('main', null, '正文'),
    });

    expect(rightRailMarkup).toContain('data-app-shell-workspace-right-rail="present"');
    expect(rightRailMarkup).toContain('xl:grid-cols-[minmax(0,1fr)_320px]');
    expect(rightRailMarkup).toContain('data-app-shell-zone="status-rail"');
  });

  it('keeps migrated learner, knowledge, and adaptive surfaces on the unified shell contract', () => {
    const dashboardSource = readSource('src/app/(main)/dashboard/page.tsx');
    const profileSource = readSource('src/app/(main)/profile/page.tsx');
    const growthSource = readSource('src/app/(main)/profile/growth/page.tsx');
    const evidenceSource = readSource('src/app/(main)/profile/evidence/page.tsx');
    const knowledgeSource = readSource('src/app/knowledge/page.tsx');
    const knowledgeSystemSource = readSource('src/features/knowledge/knowledge-graph-system.tsx');
    const knowledgeSidebarSource = readSource('src/features/knowledge/sidebar/knowledge-sidebar.tsx');
    const knowledgeResourcePanelSource = readSource('src/features/knowledge/resource-panel/resource-panel.tsx');
    const adaptivePracticeSource = readSource('src/app/assessment/adaptive-practice/page.tsx');
    const evidenceBrowserSource = readSource('src/features/data-governance/evidence-timeline-browser.tsx');

    expect(dashboardSource).toContain("redirect('/profile')");
    expect(dashboardSource).toContain('getPlatformCockpitHref');
    expect(dashboardSource).not.toContain('<AppShell');

    for (const source of [profileSource, growthSource, evidenceSource, adaptivePracticeSource]) {
      expect(source).toContain('<AppShell');
      expect(source).toContain('viewerRole="student"');
      expect(source).not.toMatch(/role=\"(?:student|teacher)\"/);
      expect(source).not.toContain('UnifiedTopBar');
      expect(source).not.toContain('商业入口');
    }
    expect(knowledgeSource).toContain('<AppShell');
    expect(knowledgeSource).toContain('getServerAuthSession');
    expect(knowledgeSource).toContain('viewerRole={shellRole}');
    expect(knowledgeSource).toContain('<KnowledgeGraphSystem viewerRole={viewerRole} />');
    expect(knowledgeSource).toContain('sidebarMode="collapsible"');
    expect(knowledgeSource).toContain("{ label: '首页', href: '/' }");
    expect(knowledgeSource).toContain("{ label: '知识资源' }");
    expect(knowledgeSource).toContain("?? 'student'");
    expect(knowledgeSource).not.toContain('if (!shellRole)');
    expect(knowledgeSource).not.toContain('<main');
    expect(knowledgeSource).not.toContain('UnifiedTopBar');
    expect(knowledgeSource).not.toContain('商业入口');

    expect(profileSource).toContain('data-learner-record');
    expect(profileSource).toContain('学习入口地图');
    expect(growthSource).toContain('data-learner-record-evidence-confidence');
    expect(evidenceSource).toContain('data-knowledge-data-map-surface="evidence-browser"');
    expect(evidenceSource).toContain('chrome="embedded"');
    expect(evidenceBrowserSource).toContain("chrome?: 'standalone' | 'embedded'");
    expect(evidenceBrowserSource).toContain("chrome === 'standalone' ? 'surface-page' : undefined");
    expect(evidenceBrowserSource).toContain("chrome === 'standalone' ? 'grid w-full");
    expect(knowledgeSource).toContain('data-knowledge-data-map-surface="knowledge-graph"');
    expect(knowledgeSource).toContain('data-commercial-student-entry-route="/knowledge"');
    expect(knowledgeSidebarSource).toContain('data-knowledge-local-panel="chapter-directory"');
    expect(knowledgeSidebarSource).not.toContain('w-[240px]');
    expect(knowledgeSidebarSource).not.toContain('bg-[#091540]');
    expect(knowledgeSystemSource).toContain('data-knowledge-local-panel="node-filters"');
    expect(knowledgeSystemSource).toContain('<RelationFamilyControl');
    expect(knowledgeSystemSource).toContain('data-knowledge-desktop-command-system="compact"');
    expect(knowledgeSystemSource).toContain('data-knowledge-local-panel="view-layout-controls"');
    expect(knowledgeSystemSource).toContain('data-knowledge-local-panel="node-hover-preview"');
    expect(knowledgeSystemSource).toContain('viewerRole={viewerRole}');
    expect(knowledgeSystemSource).not.toContain('bg-[#091540]');
    expect(knowledgeSystemSource).not.toContain('bg-[#0c1d4f]');
    expect(knowledgeResourcePanelSource).toContain('data-knowledge-local-panel="resource-panel"');
    expect(knowledgeResourcePanelSource).toContain("viewerRole === 'teacher' || viewerRole === 'admin'");
    expect(knowledgeResourcePanelSource).toContain('{canAddToCourseFlow ? (');
    expect(knowledgeResourcePanelSource).not.toContain('bg-[#091540]');
    expect(knowledgeResourcePanelSource).not.toContain('bg-[#0c1d4f]');
    expect(adaptivePracticeSource).toContain('data-commercial-entry-intent="practice"');
    expect(adaptivePracticeSource).toContain(
      "data-learning-path-options-slot={hasGeneratedPathOptions ? 'three-style' : 'starter-examples'}",
    );
    expect(adaptivePracticeSource).toContain('data-learning-path-history-slot="selection-history"');
    expect(adaptivePracticeSource).toContain('data-konling-citation-slot="cited-explanation"');
    expect(adaptivePracticeSource).toContain('data-adaptive-path-local-command="path-management"');
    expect(adaptivePracticeSource).toContain('data-primary-route-local-command-zone="adaptive-path-local-toolbar"');
    expect(adaptivePracticeSource).not.toContain("id: 'adaptive-path-management'");
  });

  it('keeps Interactive Learning first-hop surfaces on the unified learning-atlas shell', () => {
    const interactiveEntrySource = readSource('src/app/interactive-learning/page.tsx');
    const courseCatalogSource = readSource('src/app/interactive-learning/courses/page.tsx');
    const chapterComponentsSource = [
      readSource('src/app/interactive-learning/chapter-components/page.tsx'),
      readSource('src/app/interactive-learning/chapter-components/_components/chapter-components-client.tsx'),
    ].join('\n');
    const crossDomainSource = readSource('src/app/interactive-learning/cross-domain-exploration/page.tsx');
    const shellSource = readSource('src/features/interactive/interactive-learning-shell.tsx');
    const catalogSource = readSource('src/features/interactive/learning-catalog.ts');
    const globalAiButtonSource = readSource('src/components/ai/global-ai-button.tsx');

    for (const source of [interactiveEntrySource, courseCatalogSource, chapterComponentsSource, crossDomainSource]) {
      expect(source).toContain('<InteractiveLearningShell');
      expect(source).toContain('data-interactive-atlas-workspace');
      expect(source).not.toContain('UnifiedTopBar');
      expect(source).not.toContain('商业入口');
      expect(source).not.toContain('<main');
      expect(source).not.toMatch(/mx-auto\\s+max-w-/);
    }

    expect(shellSource).toContain('<AppShell');
    expect(shellSource).toContain('viewerRole="student"');
    expect(shellSource).toContain('sidebarMode="collapsible"');
    expect(shellSource).toContain('data-platform-learning-atlas-shell');
    expect(shellSource).toContain('INTERACTIVE_LEARNING_BREADCRUMBS');
    expect(shellSource).not.toContain('interactive-learning-konling');
    expect(shellSource).not.toContain("control: 'konling'");
    expect(globalAiButtonSource).toContain("id: 'konling-global-ai'");
    expect(globalAiButtonSource).toContain('<KonlingAvatar size="sm" />');
    expect(interactiveEntrySource).toContain('data-commercial-student-entry-route="/interactive-learning"');
    expect(courseCatalogSource).toContain('data-commercial-student-entry-route="/interactive-learning/courses"');
    expect(courseCatalogSource).toContain('courseKind');
    expect(courseCatalogSource).toContain('runtimeCardMetadata.durationLabel');
    expect(courseCatalogSource).toContain('data-course-runtime-status={lesson.runtimeCardMetadata.statusLabel}');
    expect(courseCatalogSource).not.toContain('lesson.duration');
    expect(catalogSource).toContain("export type InteractiveCourseKind = '理论课' | '实践课'");
    expect(catalogSource).toContain('runtimeCardMetadata');
    expect(catalogSource).toContain('durationLabel: lesson.duration');
    expect(catalogSource).toContain('statusLabel: lesson.badge');
    expect(catalogSource).toContain("'实践课'");
    expect(courseCatalogSource).not.toContain('精品先导');
    expect(courseCatalogSource).not.toContain('interactive-course-hub-');
    expect(chapterComponentsSource).toContain(
      'data-commercial-student-entry-route="/interactive-learning/chapter-components"',
    );
    expect(crossDomainSource).toContain(
      'data-commercial-student-entry-route="/interactive-learning/cross-domain-exploration"',
    );
  });

  it('keeps concrete interactive course entry pages on the unified course entry shell', () => {
    const courseEntryShellSource = readSource('src/features/interactive/shared/course-entry-shell.tsx');
    const teacherWaitingRouteSource = readSource('src/features/interactive/shared/teacher-classroom-waiting-route.tsx');
    const teacherWaitingSource = readSource('src/features/interactive/shared/teacher-classroom-waiting-page.tsx');
    const entryPages = listSourceFiles('src/features/interactive').filter((relativePath) =>
      relativePath.endsWith('/entry-page.tsx'),
    );
    const waitingPages = listSourceFiles('src/app/interactive-learning/courses').filter((relativePath) =>
      relativePath.endsWith('/teacher/[sessionId]/waiting/page.tsx'),
    );

    expect(courseEntryShellSource).toContain('<AppShell');
    expect(courseEntryShellSource).toContain('sidebarMode="collapsible"');
    expect(courseEntryShellSource).toContain(
      'router.push(`/interactive-learning/courses/${config.routeSegment}/teacher/${createData.id}/waiting`)',
    );
    expect(courseEntryShellSource).toContain('data-course-entry-shell="app-shell"');
    expect(courseEntryShellSource).toContain('data-commercial-workspace="interactive-learning"');
    expect(courseEntryShellSource).toContain(
      "data-course-entry-role-panel={isAdministrator ? 'admin-temporary' : 'teacher'}",
    );
    expect(courseEntryShellSource).toContain('data-course-entry-role-panel="teacher-sign-in"');
    expect(courseEntryShellSource).toContain('data-course-entry-role-panel="student"');
    expect(courseEntryShellSource).toContain('data-course-entry-role-panel="guest-demo"');
    expect(courseEntryShellSource).toContain('data-course-entry-action="teacher-launch"');
    expect(courseEntryShellSource).toContain('data-course-entry-action="teacher-sign-in"');
    expect(courseEntryShellSource).toContain('data-course-entry-action="join-launch"');
    expect(courseEntryShellSource).toContain('data-course-entry-action="demo-launch"');
    expect(courseEntryShellSource).toContain('const showTeacherSection = canCreateAsTeacher;');
    expect(courseEntryShellSource).toContain('const showTeacherSignInSection = !roleResolved;');
    expect(courseEntryShellSource).toContain('const showStudentSection = roleResolved ? canJoinAsStudent : true;');
    expect(courseEntryShellSource).not.toContain(
      'const showTeacherSection = roleResolved ? canCreateAsTeacher : true;',
    );
    expect(courseEntryShellSource).toContain('href={`/login?callbackUrl=${encodeURIComponent(activeHref)}`}');
    expect(courseEntryShellSource).toContain('data-course-entry-region="course-stats"');
    expect(courseEntryShellSource).toContain('data-course-entry-region="unit-route"');
    expect(courseEntryShellSource).toContain('data-course-entry-region="boppps-path"');
    expect(courseEntryShellSource).toContain('data-course-entry-region="self-study"');
    expect(courseEntryShellSource).toContain('data-course-entry-region="knowledge-path"');
    expect(courseEntryShellSource).toContain('buildBopppsRows');
    expect(courseEntryShellSource).toContain('manifestModuleCount');
    expect(courseEntryShellSource).toContain('LessonEntryMediaHub');
    expect(courseEntryShellSource).toContain('LessonEntryRuntimeSections');
    expect(courseEntryShellSource).not.toContain('routeMetadata=');
    expect(courseEntryShellSource).not.toContain('dockControls');
    expect(courseEntryShellSource).not.toContain('premium-lesson-');
    expect(courseEntryShellSource).not.toContain('max-w-[1180px]');
    expect(teacherWaitingRouteSource).toContain("import { getServerSession } from 'next-auth';");
    expect(teacherWaitingRouteSource).toContain("import { redirect } from 'next/navigation';");
    expect(teacherWaitingRouteSource).toContain('getServerSession(authOptions)');
    expect(teacherWaitingRouteSource).toContain("redirect('/login')");
    expect(teacherWaitingRouteSource).toContain(
      'redirect(`/interactive-learning/courses/${routeSegment}/student/${sessionId}`)',
    );
    expect(teacherWaitingRouteSource).toContain("['TEACHER', 'ADMIN', '教师', '管理员']");
    expect(teacherWaitingRouteSource).toContain('<TeacherClassroomWaitingPage');
    expect(teacherWaitingSource).toContain('<AppShell');
    expect(teacherWaitingSource).toContain('viewerRole="teacher"');
    expect(teacherWaitingSource).toContain('sidebarMode="collapsible"');
    expect(teacherWaitingSource).toContain('data-teacher-classroom-waiting="standard"');
    expect(teacherWaitingSource).toContain('data-classroom-join-qr');
    expect(teacherWaitingSource).toContain('data-classroom-code=');
    expect(teacherWaitingSource).toContain('data-joined-student-count=');
    expect(teacherWaitingSource).toContain('data-start-class-action="teacher-runtime"');
    expect(teacherWaitingSource).toContain('router.push(runtimeHref)');
    expect(teacherWaitingSource).not.toContain('routeMetadata=');
    expect(teacherWaitingSource).not.toContain('dockControls');
    expect(teacherWaitingSource).not.toContain('premium-lesson-');

    expect(entryPages.length).toBeGreaterThan(0);
    for (const relativePath of entryPages) {
      const source = readSource(relativePath);
      expect(source, relativePath).toContain('CourseEntryShell');
      expect(source, relativePath).not.toContain('PremiumLessonEntryPage');
    }

    expect(waitingPages.length).toBeGreaterThan(20);
    for (const relativePath of waitingPages) {
      const source = readSource(relativePath);
      expect(source, relativePath).toContain('TeacherClassroomWaitingRoute');
      expect(source, relativePath).not.toContain('TeacherClassroomWaitingPage');
      expect(source, relativePath).toContain('routeSegment=');
    }
  });

  it('keeps interactive lesson runtime pages on the unified runtime shell contract', () => {
    const runtimeShellSource = readSource('src/features/interactive/shared/lesson-runtime-shell.tsx');
    const unit11StudentSource = readSource('src/features/interactive/unit-1-1-see-the-full-picture/student-page.tsx');
    const unit11StepPanelsSource = readSource('src/features/interactive/unit-1-1-see-the-full-picture/step-panels.tsx');
    const unit11TeacherSource = readSource('src/features/interactive/unit-1-1-see-the-full-picture/teacher-page.tsx');
    const unit12StudentSource = readSource('src/features/interactive/unit-1-2-modeling-from-object-to-system/student-page.tsx');
    const unit12StepPanelsSource = readSource('src/features/interactive/unit-1-2-modeling-from-object-to-system/step-panels.tsx');
    const unit12TeacherSource = readSource('src/features/interactive/unit-1-2-modeling-from-object-to-system/teacher-page.tsx');
    const unit41StudentSource = readSource('src/features/interactive/unit-4-1-design-task-expression/student-page.tsx');
    const unit41StepPanelsSource = readSource(
      'src/features/interactive/unit-4-1-design-task-expression/step-panels.tsx',
    );
    const unit41TeacherSource = readSource('src/features/interactive/unit-4-1-design-task-expression/teacher-page.tsx');
    const manifestActivitySource = readSource(
      'src/features/interactive/shared/manifest-runtime/activity-renderers.tsx',
    );
    const stepKnowledgeDrawerSource = readSource('src/features/interactive/shared/step-knowledge-drawer.tsx');

    expect(runtimeShellSource).toContain('<AppShell');
    expect(runtimeShellSource).toContain('data-lesson-runtime-shell="unified"');
    expect(runtimeShellSource).toContain('data-lesson-runtime-mode={mode}');
    expect(runtimeShellSource).toContain('data-lesson-runtime-bottom-navigation');
    expect(runtimeShellSource).toContain('data-lesson-runtime-page-jump');
    expect(runtimeShellSource).toContain("toolsDefaultState = 'collapsed'");
    expect(runtimeShellSource).toContain('data-lesson-runtime-local-tools={toolsDefaultState}');
    expect(runtimeShellSource).toContain('data-lesson-runtime-invalid-session');
    expect(runtimeShellSource).toContain('const hasSteps = steps.length > 0');
    expect(runtimeShellSource).toContain('floatingDock');
    expect(runtimeShellSource).not.toContain('premium-lesson-topbar');
    expect(runtimeShellSource).not.toContain('max-w-[1180px]');

    for (const source of [unit11StudentSource, unit11TeacherSource, unit12StudentSource, unit12TeacherSource, unit41StudentSource, unit41TeacherSource]) {
      expect(source).toContain('LessonRuntimeShell');
      expect(source).not.toContain('CourseHeader');
      expect(source).not.toContain('premium-lesson-topbar');
      expect(source).not.toContain('premium-lesson-main mx-auto max-w-[1180px]');
    }

    for (const source of [unit11StudentSource, unit12StudentSource, unit41StudentSource]) {
      expect(source).toContain("mode={isDemo ? 'guest' : 'student'}");
      expect(source).toContain('readOnly={isDemo}');
      expect(source).toContain('inlineTool');
      expect(source).toContain('data-runtime-manifest-truth');
      expect(source).toContain('data-activity-submission-contract');
      expect(source).toContain('manifest-runtime');
      expect(source).not.toContain('TeacherActivitySummary');
      expect(source).not.toContain('submittedStudents=');
    }

    expect(stepKnowledgeDrawerSource).toContain('inlineTool = false');
    expect(stepKnowledgeDrawerSource).toContain('data-step-knowledge-inline-tool="trigger"');
    expect(stepKnowledgeDrawerSource).toContain('data-step-knowledge-inline-tool="empty"');

    expect(manifestActivitySource).toContain('readOnly?: boolean');
    expect(manifestActivitySource).toContain('演示模式会展示作答流程，但不会写入课堂汇总。');
    expect(unit11StepPanelsSource).toContain('演示模式仅本机预览，不会同步到教师端汇总。');
    expect(unit41StepPanelsSource).toContain('readOnly?: boolean');
    expect(unit12StepPanelsSource).toContain('readOnly?: boolean');

    for (const source of [unit11TeacherSource, unit12TeacherSource, unit41TeacherSource]) {
      expect(source).toContain('mode="teacher"');
      expect(source).toContain('data-teacher-projection-runtime');
      expect(source).toContain('toolsDefaultState="collapsed"');
      expect(source).not.toContain('StudentActivityForm');
      expect(source).not.toContain('下一页');
    }
  });

  it('derives concrete course entry route metadata from the canonical route inventory', () => {
    const courseEntryPageRoutes = listSourceFiles('src/app/interactive-learning/courses')
      .filter((relativePath) => relativePath.endsWith('/page.tsx'))
      .filter((relativePath) => relativePath.split(path.sep).length === 6)
      .map((relativePath) => `/${path.dirname(relativePath).replace(/^src\/app\//, '')}`)
      .sort();
    const teacherWaitingRoutes = listSourceFiles('src/app/interactive-learning/courses')
      .filter((relativePath) => relativePath.endsWith('/teacher/[sessionId]/waiting/page.tsx'))
      .map(
        (relativePath) =>
          `/${path
            .dirname(relativePath)
            .replace(/^src\/app\//, '')
            .replace('/teacher/[sessionId]/waiting', '/teacher/session-1/waiting')}`,
      )
      .sort();
    const courseHref = '/interactive-learning/courses/unit-1-1-see-the-full-picture';
    const waitingHref = '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/session-1/waiting';
    const inventoryEntry = resolvePlatformRouteInventory(courseHref);
    const waitingInventoryEntry = resolvePlatformRouteInventory(waitingHref);

    expect(courseEntryPageRoutes.length).toBeGreaterThan(20);
    for (const href of courseEntryPageRoutes) {
      const route = resolvePlatformRouteInventory(href);
      expect(route, href).toMatchObject({
        frame: 'learning-atlas',
        desktopNavigation: 'collapsible',
        floatingDock: 'collapsed',
      });
      expect(route?.navigationLayers, href).toEqual(['global-product', 'contextual-workspace', 'local-tool']);
    }
    expect(teacherWaitingRoutes.length).toBeGreaterThan(20);
    for (const href of teacherWaitingRoutes) {
      const route = resolvePlatformRouteInventory(href);
      expect(route, href).toMatchObject({
        frame: 'learning-atlas',
        desktopNavigation: 'collapsible',
        floatingDock: 'collapsed',
      });
      expect(route?.navigationLayers, href).toEqual(['global-product', 'contextual-workspace', 'local-tool']);
    }

    expect(inventoryEntry).toMatchObject({
      frame: 'learning-atlas',
      desktopNavigation: 'collapsible',
      floatingDock: 'collapsed',
    });
    expect(inventoryEntry?.navigationLayers).toEqual(['global-product', 'contextual-workspace', 'local-tool']);
    expect(waitingInventoryEntry).toMatchObject({
      frame: 'learning-atlas',
      desktopNavigation: 'collapsible',
      floatingDock: 'collapsed',
      mobileNavigation: 'workspace-command-surface',
    });
    expect(waitingInventoryEntry?.navigationLayers).toEqual(['global-product', 'contextual-workspace', 'local-tool']);

    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'student',
      title: '看见整门课：从反馈思想到控制全景',
      activeHref: courseHref,
      sidebarMode: 'collapsible',
      children: null,
    });

    expect(shellMarkup).toContain('data-platform-route-frame="learning-atlas"');
    expect(shellMarkup).toContain('data-platform-desktop-navigation="collapsible"');
    expect(shellMarkup).toContain('data-platform-floating-dock-behavior="collapsed"');
    expect(shellMarkup).toContain('data-app-shell-navigation-state="collapsed"');
    expect(shellMarkup).not.toContain('data-platform-route-frame="mission-workspace"');

    const waitingShellMarkup = renderAppShellMarkup({
      viewerRole: 'teacher',
      title: '课堂等待页',
      activeHref: waitingHref,
      sidebarMode: 'collapsible',
      children: null,
    });

    expect(waitingShellMarkup).toContain('data-platform-route-frame="learning-atlas"');
    expect(waitingShellMarkup).toContain('data-platform-desktop-navigation="collapsible"');
    expect(waitingShellMarkup).toContain('data-platform-floating-dock-behavior="collapsed"');
  });

  it('records migrated role workspace shell inventory as adapted instead of scheduled replacement', () => {
    const teacherRoute = resolvePlatformRouteInventory('/teacher');
    const adminRoute = resolvePlatformRouteInventory('/admin');
    const collapsibleRoleWorkspaceRoutes = [
      '/teacher',
      '/teacher/grading-workbench',
      '/admin',
      '/admin/users',
      '/admin/states',
      '/admin/config',
      '/admin/data-governance',
    ];

    expect(teacherRoute?.legacyShell).toMatchObject({
      component: 'TeacherLayout',
      disposition: 'adapted',
      owningChange: 'migrate-role-workspaces-to-appshell-navigation',
      sourceFile: 'src/app/teacher/layout.tsx',
    });
    expect(teacherRoute?.legacyShell?.removalCondition).toContain('RoleWorkspaceShell/AppShell');
    expect(adminRoute?.legacyShell).toMatchObject({
      component: 'AdminConsoleHeader',
      disposition: 'adapted',
      owningChange: 'migrate-role-workspaces-to-appshell-navigation',
      sourceFile: 'src/features/admin/admin-console-home.tsx',
    });
    expect(adminRoute?.legacyShell?.removalCondition).toContain('page-local operation headers');
    for (const href of collapsibleRoleWorkspaceRoutes) {
      expect(resolvePlatformRouteInventory(href)?.desktopNavigation, href).toBe('collapsible');
    }
    for (const route of PLATFORM_PRIMARY_ROUTE_INVENTORY) {
      if (route.href.startsWith('/teacher') || route.href.startsWith('/admin')) {
        expect(route.desktopNavigation, route.href).toBe('collapsible');
      }
    }
  });

  it('does not use student or teacher business identity as a JSX role prop', () => {
    const platformShellFiles = ['src/components/platform/app-shell.tsx'];
    const checkedFiles = [
      ...platformShellFiles,
      ...listSourceFiles('src/app'),
      ...listSourceFiles('src/features'),
      ...listSourceFiles('src/components/platform'),
    ];
    const invalidLiteralBusinessRole =
      /(?<![\w-])role\s*=\s*(?:"student"|"teacher"|'student'|'teacher'|\{\s*'student'\s*\}|\{\s*'teacher'\s*\}|\{\s*"student"\s*\}|\{\s*"teacher"\s*\})/;
    const businessRoleForwardedToDom =
      /<[a-z][A-Za-z0-9:-]*(?:\s+[^<>]*?)?\srole\s*=\s*\{\s*(?:role|viewerRole|surfaceRole|businessRole|audienceRole)\s*\}/;

    for (const relativePath of checkedFiles) {
      const source = readSource(relativePath);
      expect(source, relativePath).not.toMatch(invalidLiteralBusinessRole);
      expect(source, relativePath).not.toMatch(businessRoleForwardedToDom);
    }
  });

  it('keeps teacher operations navigation bound to the current class context', () => {
    const analyticsTemplate = '/teacher/classes/[classId]/analytics-v2';

    expect(resolveTeacherOperationsNavHref(analyticsTemplate, '/teacher/classes/class-1')).toBe(
      '/teacher/classes/class-1/analytics-v2',
    );
    expect(
      resolveTeacherOperationsNavHref(analyticsTemplate, '/teacher/classes/class-1/students/student-1/evidence'),
    ).toBe('/teacher/classes/class-1/analytics-v2');
    expect(resolveTeacherOperationsNavHref(analyticsTemplate, '/teacher/classes')).toBe('/teacher/classes');
    expect(resolveTeacherOperationsNavHref(analyticsTemplate, '/teacher/classes/new')).toBe('/teacher/classes');

    expect(isTeacherOperationsNavActive('/teacher/classes/class-1/analytics-v2', analyticsTemplate)).toBe(true);
    expect(isTeacherOperationsNavActive('/teacher/classes/class-1/analytics-v2', '/teacher/classes')).toBe(false);
    expect(isTeacherOperationsNavActive('/teacher/classes', analyticsTemplate)).toBe(false);
    expect(isTeacherOperationsNavActive('/teacher/classes/new', analyticsTemplate)).toBe(false);
    expect(
      isTeacherOperationsNavActive('/teacher/classes/class-1/students/student-1/evidence', analyticsTemplate),
    ).toBe(false);
  });

  it('prioritizes the active classroom class for teacher operations evidence and analytics entry', () => {
    expect(
      resolveTeacherOperationsClassHref(
        [
          {
            id: 'session-1',
            planTitle: '旧班课堂',
            joinCode: '123456',
            studentCount: 30,
            classId: 'older-active-class',
          },
        ],
        [
          {
            id: 'newest-created-class',
            name: '最新创建班级',
            code: 'NEW',
            studentCount: 12,
            createdAt: '2026-06-06T00:00:00.000Z',
          },
        ],
      ),
    ).toBe('/teacher/classes/older-active-class');
    expect(
      resolveTeacherOperationsClassHref(
        [
          {
            id: 'session-without-class',
            planTitle: '无班级课堂',
            joinCode: '111111',
            studentCount: 5,
          },
          {
            id: 'session-with-class',
            planTitle: '有班级课堂',
            joinCode: '222222',
            studentCount: 28,
            classId: 'bound-active-class',
          },
        ],
        [
          {
            id: 'newest-created-class',
            name: '最新创建班级',
            code: 'NEW',
            studentCount: 12,
            createdAt: '2026-06-06T00:00:00.000Z',
          },
        ],
      ),
    ).toBe('/teacher/classes/bound-active-class');
    expect(resolveTeacherOperationsClassHref([], [])).toBe('/teacher/classes');
  });

  it('forwards the active route from AppShell to AppSidebar', () => {
    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'teacher',
      title: '教师工作台',
      activeHref: '/teacher/classes',
      navigation: [
        {
          id: 'teacher-home',
          label: '教师首页',
          href: '/teacher',
          role: 'teacher',
          order: 10,
        },
        {
          id: 'teacher-classes',
          label: '班级',
          href: '/teacher/classes',
          role: 'teacher',
          order: 20,
        },
      ],
      children: null,
    });

    expect(shellMarkup).toContain('href="/teacher/classes"');
    expect(shellMarkup).toContain('aria-current="page"');
  });

  it('marks only the deepest matching sidebar route active', () => {
    const sidebar = asElement(
      AppSidebar({
        activeHref: '/teacher/classes',
        navigation: [
          {
            id: 'teacher-home',
            label: '教师首页',
            href: '/teacher',
            role: 'teacher',
            order: 10,
          },
          {
            id: 'teacher-classes',
            label: '班级',
            href: '/teacher/classes',
            role: 'teacher',
            order: 20,
          },
        ],
      }),
    );
    const nav = asElement(sidebar.props?.children);
    const links = childElements(nav.props?.children);

    expect(links).toHaveLength(2);
    expect(classNameOf(links[0])).not.toContain('bg-platform-action-subtle');
    expect(classNameOf(links[1])).toContain('bg-platform-action-subtle');
  });

  it('renders collapsed AppShell navigation as an accessible icon rail', () => {
    expect(
      getAppShellDesktopGridClassName({
        showSidebar: true,
        sidebarBreakpoint: 'xl',
        navigationCollapsed: false,
      }),
    ).toContain('xl:grid-cols-[248px_minmax(0,1fr)]');
    expect(
      getAppShellDesktopGridClassName({
        showSidebar: true,
        sidebarBreakpoint: 'xl',
        navigationCollapsed: true,
      }),
    ).toContain('xl:grid-cols-[72px_minmax(0,1fr)]');

    const collapsedSidebar = asElement(
      AppSidebar({
        activeHref: '/knowledge',
        collapsed: true,
        navigation: [
          {
            id: 'student-knowledge',
            label: '知识资源',
            href: '/knowledge',
            role: 'student',
            order: 10,
            iconKey: 'knowledge',
          },
        ],
      }),
    );
    const collapsedSidebarMarkup = renderToStaticMarkup(collapsedSidebar as never);

    expect(collapsedSidebar.props?.['data-shell-navigation-state']).toBe('collapsed');
    expect(collapsedSidebarMarkup).toContain('aria-label="知识资源"');
    expect(collapsedSidebarMarkup).toContain('title="知识资源"');
    expect(collapsedSidebarMarkup).toContain('data-platform-navigation-icon="knowledge"');
    expect(collapsedSidebarMarkup).not.toContain('知识资源知');
    expect(collapsedSidebarMarkup).not.toContain('>知</a>');
  });

  it('keeps student primary navigation in canonical order across AppShell states', () => {
    const expectedLabels = ['首页', '知识资源', '互动学习', '学习路径', '竞技场', '虚拟仿真', '控制工作台', '提示词复盘', '个人中心'];
    const representativeRoutes = [
      '/knowledge',
      '/interactive-learning',
      '/assessment/adaptive-practice',
      '/arena',
      '/simulations',
      '/interactive-learning/control-workbench',
      '/profile',
      '/profile/growth',
      '/profile/evidence',
      '/profile/portfolio',
    ];

    for (const route of representativeRoutes) {
      const navigation = getPlatformRouteNavigation(route, 'student');
      expect(navigation.map((entry) => entry.id)).toEqual([...STUDENT_PRIMARY_NAVIGATION_ENTRY_IDS]);
      expect(navigation.map((entry) => entry.label)).toEqual(expectedLabels);
    }
    const teacherProfileNavigationIds = getPlatformRouteNavigation('/profile/growth', 'teacher').map(
      (entry) => entry.id,
    );
    const adminProfileNavigationIds = getPlatformRouteNavigation('/profile/evidence', 'admin').map((entry) => entry.id);
    expect(teacherProfileNavigationIds[0]).toBe('teacher-cockpit');
    expect(adminProfileNavigationIds[0]).toBe('admin-cockpit');
    expect(teacherProfileNavigationIds).not.toEqual([...STUDENT_PRIMARY_NAVIGATION_ENTRY_IDS]);
    expect(adminProfileNavigationIds).not.toEqual([...STUDENT_PRIMARY_NAVIGATION_ENTRY_IDS]);
    expect(teacherProfileNavigationIds).not.toContain('student-profile');
    expect(adminProfileNavigationIds).not.toContain('student-profile');

    const navigation = getPlatformRouteNavigation('/assessment/adaptive-practice', 'student');
    const expandedSidebar = asElement(
      AppSidebar({
        activeHref: '/assessment/adaptive-practice',
        collapsed: false,
        navigation,
      }),
    );
    const collapsedSidebar = asElement(
      AppSidebar({
        activeHref: '/assessment/adaptive-practice',
        collapsed: true,
        navigation,
      }),
    );
    const expandedMarkup = renderToStaticMarkup(expandedSidebar as never);
    const collapsedMarkup = renderToStaticMarkup(collapsedSidebar as never);

    expect(expandedSidebar.props?.['data-shell-navigation-state']).toBe('expanded');
    expect(collapsedSidebar.props?.['data-shell-navigation-state']).toBe('collapsed');
    expectNeedlesInOrder(
      expandedMarkup,
      expectedLabels.map((label) => `>${label}</span>`),
    );
    expectNeedlesInOrder(
      collapsedMarkup,
      expectedLabels.map((label) => `aria-label="${label}"`),
    );
    expect(expandedMarkup).toMatch(/aria-current="page"[^>]+href="\/assessment\/adaptive-practice"/);
    expect(collapsedMarkup).toMatch(/aria-current="page"[^>]+href="\/assessment\/adaptive-practice"/);
    expect(collapsedMarkup).toContain('title="个人中心"');
  });

  it('keeps primary route local commands outside the shell account action pair', () => {
    const adaptivePracticeSource = readSource('src/app/assessment/adaptive-practice/page.tsx');
    const controlWorkbenchSource = readSource('src/features/control-workbench/shell/control-workbench-shell.tsx');
    const arenaShellSource = readSource('src/features/arena/arena-page-shell.tsx');
    const interactiveLearningShellSource = readSource('src/features/interactive/interactive-learning-shell.tsx');

    expect(adaptivePracticeSource).toContain('data-adaptive-path-local-command="path-management"');
    expect(adaptivePracticeSource).toContain('data-primary-route-local-command-zone="adaptive-path-local-toolbar"');
    expect(adaptivePracticeSource).not.toContain("id: 'adaptive-path-management'");
    expect(controlWorkbenchSource).toContain('data-control-workbench-local-command="contextual-return"');
    expect(controlWorkbenchSource).toContain('data-primary-route-local-command-zone="control-workbench-context-strip"');
    expect(controlWorkbenchSource).not.toContain('actions={(');
    expect(arenaShellSource).not.toContain('userMenu={');
    expect(arenaShellSource).not.toContain('href="/profile"');
    expect(interactiveLearningShellSource).toContain("{ label: '首页', href: '/' }");
    expect(interactiveLearningShellSource).not.toContain("{ label: '学习', href: '/dashboard' }");
  });

  it('persists AppShell desktop navigation preference with a collapsed fallback', () => {
    const storage = createPreferenceStorage();

    expect(resolveAppShellNavigationPreference(undefined)).toBe('collapsed');
    expect(resolveAppShellNavigationPreference('invalid')).toBe('collapsed');
    expect(resolveAppShellNavigationPreference('expanded')).toBe('expanded');
    expect(readAppShellNavigationPreference(storage)).toBe('collapsed');

    writeAppShellNavigationPreference('expanded', storage);
    expect(storage.values.get(APP_SHELL_NAVIGATION_PREFERENCE_STORAGE_KEY)).toBe('expanded');
    expect(readAppShellNavigationPreference(storage)).toBe('expanded');

    storage.values.set(APP_SHELL_NAVIGATION_PREFERENCE_STORAGE_KEY, 'wide');
    expect(readAppShellNavigationPreference(storage)).toBe('collapsed');
  });

  it('does not throw when AppShell browser navigation storage is blocked', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const throwingGetStorage = {
      getItem: () => {
        throw new Error('storage blocked');
      },
    };
    const throwingSetStorage = {
      setItem: () => {
        throw new Error('storage blocked');
      },
    };

    expect(readAppShellNavigationPreference(throwingGetStorage)).toBe('collapsed');
    expect(() => writeAppShellNavigationPreference('expanded', throwingSetStorage)).not.toThrow();

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        get localStorage() {
          throw new Error('storage blocked');
        },
      },
    });

    expect(getBrowserNavigationPreferenceStorage()).toBeUndefined();

    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      delete (globalThis as { window?: Window }).window;
    }
  });

  it('defaults collapsible AppShell desktop navigation to the collapsed rail', () => {
    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'student',
      title: '知识图谱',
      activeHref: '/knowledge',
      sidebarMode: 'collapsible',
      children: null,
    });

    expect(shellMarkup).toContain('data-app-shell-layout="collapsible"');
    expect(shellMarkup).toContain('data-app-shell-navigation-state="collapsed"');
    expect(shellMarkup).toContain('data-app-shell-navigation-preference="collapsed"');
    expect(shellMarkup).toContain('xl:grid-cols-[72px_minmax(0,1fr)]');
    expect(shellMarkup).toContain('aria-label="展开平台导航"');
    expect(shellMarkup).toContain('aria-label="知识资源"');
    expect(shellMarkup).toContain('title="知识资源"');
    expect(shellMarkup).toContain('aria-current="page"');
  });

  it('renders representative route frames with collapsed desktop navigation metadata', () => {
    const routeFrames: Array<{
      href: string;
      role: PlatformRole;
      title: string;
    }> = [
      { href: '/knowledge', role: 'student', title: '知识图谱' },
      { href: '/arena', role: 'student', title: '竞技场' },
      { href: '/simulations', role: 'student', title: '虚拟仿真' },
      { href: '/interactive-learning', role: 'student', title: '互动学习' },
      { href: '/data-center', role: 'teacher', title: '教师数据中心' },
      { href: '/data-center', role: 'admin', title: '管理员数据中心' },
    ];

    for (const route of routeFrames) {
      const shellMarkup = renderAppShellMarkup({
        viewerRole: route.role,
        title: route.title,
        activeHref: route.href,
        children: null,
      });

      expect(shellMarkup, route.href).toContain('data-platform-desktop-navigation="collapsible"');
      expect(shellMarkup, route.href).toContain('data-app-shell-navigation-state="collapsed"');
      expect(shellMarkup, route.href).toContain('data-shell-navigation-state="collapsed"');
      expect(shellMarkup, route.href).toContain('xl:grid-cols-[72px_minmax(0,1fr)]');
      expect(shellMarkup, route.href).toContain('aria-current="page"');
    }
  });

  it('keeps migrated role-cockpit operation shells aligned with collapsible AppShell metadata', () => {
    const teacherMarkup = renderAppShellMarkup({
      viewerRole: 'teacher',
      title: '班级管理',
      activeHref: '/teacher/classes',
      children: null,
    });
    const adminMarkup = renderAppShellMarkup({
      viewerRole: 'admin',
      title: '管理控制台',
      activeHref: '/admin',
      children: null,
    });

    expect(teacherMarkup).toContain('data-platform-desktop-navigation="collapsible"');
    expect(teacherMarkup).toContain('data-app-shell-layout="collapsible"');
    expect(teacherMarkup).toContain('xl:grid-cols-[72px_minmax(0,1fr)]');
    expect(adminMarkup).toContain('data-platform-desktop-navigation="collapsible"');
    expect(adminMarkup).toContain('data-app-shell-layout="collapsible"');
    expect(adminMarkup).toContain('xl:grid-cols-[72px_minmax(0,1fr)]');
  });

  it('uses standard AppShell navigation for migrated AI product routes', () => {
    const aiRoute = PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/ai');
    const copilotRoute = PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/ai/copilot');

    expect(aiRoute?.legacyShell).toBeUndefined();
    expect(aiRoute?.exception).toBeUndefined();
    expect(aiRoute?.desktopNavigation).toBe('collapsible');
    expect(aiRoute?.mobileNavigation).toBe('drawer');
    expect(copilotRoute?.legacyShell).toBeUndefined();
    expect(copilotRoute?.exception).toBeUndefined();
    expect(copilotRoute?.desktopNavigation).toBe('collapsible');
    expect(copilotRoute?.mobileNavigation).toBe('drawer');
  });

  it('keeps mobile drawer behavior independent from desktop rail preference', () => {
    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'student',
      title: '竞技场',
      activeHref: '/arena',
      children: null,
    });

    expect(shellMarkup).toContain('data-platform-desktop-navigation="collapsible"');
    expect(shellMarkup).toContain('data-app-shell-navigation-state="collapsed"');
    expect(shellMarkup).toContain('data-platform-mobile-navigation="drawer"');
    expect(shellMarkup).toContain('aria-controls="app-shell-mobile-navigation"');
    expect(shellMarkup).toContain('xl:hidden');
    expect(shellMarkup).not.toContain('data-app-shell-mobile-drawer="open"');
  });

  it('allows deep product routes to keep route metadata while highlighting a canonical navigation parent', () => {
    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'student',
      title: 'AI工坊',
      activeHref: '/ai',
      activeNavigationHref: '/knowledge',
      children: null,
    });

    expect(shellMarkup).toContain('data-platform-route-frame="knowledge-data-map"');
    expect(shellMarkup).toContain('data-platform-mobile-navigation="drawer"');
    expect(shellMarkup).toContain('aria-label="知识资源" aria-current="page"');
    expect(shellMarkup).toContain('href="/knowledge"');
    expect(shellMarkup).not.toContain('href="/ai"');
  });

  it('keeps active route matching stable when the current route has query or hash', () => {
    const sidebar = asElement(
      AppSidebar({
        activeHref: '/teacher/classes?tab=all#roster',
        navigation: [
          {
            id: 'teacher-home',
            label: '教师首页',
            href: '/teacher',
            role: 'teacher',
            order: 10,
          },
          {
            id: 'teacher-classes',
            label: '班级',
            href: '/teacher/classes',
            role: 'teacher',
            order: 20,
          },
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
          {
            id: 'teacher-classes',
            label: '班级',
            href: '/teacher/classes',
            role: 'teacher',
            order: 20,
          },
        ],
      },
    ];
    const sidebar = asElement(AppSidebar({ activeHref: '/teacher/classes', navigation }));
    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'teacher',
      title: '教师工作台',
      activeHref: '/teacher/classes',
      navigation,
      children: null,
    });

    expect(collectLinks(sidebar).map((link) => link.props?.href)).toEqual(['/teacher', '/teacher/classes']);
    expect(shellMarkup).toContain('href="/teacher"');
    expect(shellMarkup).toContain('href="/teacher/classes"');
    expect(shellMarkup).toContain('aria-label="平台导航"');
    expect(classNameOf(collectLinks(sidebar)[1])).toContain('bg-platform-action-subtle');
  });

  it('keeps role navigation reachable in the mobile shell', () => {
    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'teacher',
      title: '教师工作台',
      activeHref: '/teacher/classes',
      navigation: [
        {
          id: 'teacher-home',
          label: '教师首页',
          href: '/teacher',
          role: 'teacher',
          order: 10,
        },
        {
          id: 'teacher-classes',
          label: '班级',
          href: '/teacher/classes',
          role: 'teacher',
          order: 20,
        },
      ],
      children: null,
    });

    expect(shellMarkup).toContain('aria-label="平台导航"');
    expect(shellMarkup).toContain('xl:hidden');
    expect(shellMarkup).not.toContain('overflow-x-auto');
    expect(shellMarkup).toContain('grid grid-cols-2');
    expect(shellMarkup).toContain('sm:flex-wrap');
    expect(shellMarkup).toContain('href="/teacher"');
    expect(shellMarkup).toContain('href="/teacher/classes"');
    expect(shellMarkup).toContain('aria-current="page"');
  });

  it('honors hidden-immersive mobile navigation routes without rendering mobile platform navigation', () => {
    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'student',
      title: 'AI 助手',
      activeHref: '/immersive-fixture',
      routeMetadata: {
        frame: 'knowledge-data-map',
        desktopNavigation: 'collapsible',
        mobileNavigation: 'hidden-immersive',
        navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
        floatingDock: 'hidden',
        themeSupport: ['light', 'dark'],
      },
      sidebarMode: 'collapsible',
      children: null,
    });

    expect(shellMarkup).toContain('data-platform-mobile-navigation="hidden-immersive"');
    expect(shellMarkup).toContain('hidden xl:block');
    expect(shellMarkup).not.toContain('aria-label="平台导航"');
    expect(shellMarkup).not.toContain('aria-controls="app-shell-mobile-navigation"');
    expect(shellMarkup).not.toContain('grid grid-cols-2');
  });

  it('derives shell navigation from route inventory when navigation is omitted', () => {
    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'student',
      title: '知识图谱',
      activeHref: '/knowledge',
      children: null,
    });

    expect(shellMarkup).toContain('href="/knowledge"');
    expect(shellMarkup).toContain('href="/interactive-learning"');
    expect(shellMarkup).not.toContain('href="/data-center"');
  });

  it('derives AppShell archetype, return target, and dock behavior from the route ledger', () => {
    const shellProps: Parameters<typeof AppShell>[0] = {
      viewerRole: 'student',
      title: 'Arena 任务',
      activeHref: '/arena/challenges/demo-task',
      children: null,
      dockControls: [
        { id: 'konling', label: '控灵', control: 'konling' },
        { id: 'management', label: '管理', control: 'management' },
      ],
    };
    const shell = asElement(AppShell(shellProps));
    const shellMarkup = renderAppShellMarkup(shellProps);

    expect(shell.props?.['data-platform-route-frame']).toBe('mission-workspace');
    expect(shell.props?.['data-platform-route-theme-support']).toBe('light dark');
    expect(shell.props?.['data-platform-desktop-navigation']).toBe('collapsible');
    expect(shell.props?.['data-platform-mobile-navigation']).toBe('drawer');
    expect(shellMarkup).toContain('data-app-shell-navigation-state="collapsed"');
    expect(shellMarkup).toContain('href="/arena"');
    expect(shellMarkup).toContain('竞技场');
    expect(shellMarkup).toContain('Arena 任务');
    expect(shellMarkup).not.toContain('Return to');
    expect(shellMarkup).toContain('href="/arena"');
    expect(shellMarkup).toContain('aria-controls="app-shell-mobile-navigation"');
    expect(shellMarkup).toContain('data-platform-floating-dock-registration="true"');
    expect(shellMarkup).toContain('data-platform-floating-dock-behavior="collapsed"');
    expect(shellMarkup).toContain('data-platform-floating-dock-controls="konling"');
    expect(shellMarkup).toContain('data-platform-shell-dock-action="management"');
  });

  it('renders AppShell workspace zones without forcing feature modules into the shared shell', () => {
    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'student',
      title: '控制工作台',
      activeHref: '/interactive-learning/control-workbench',
      children: 'stage',
      workspaceSlots: {
        contextHeader: '对象上下文',
        commandBar: '命令',
        instrumentArea: '仪表区',
        evidenceRail: '证据',
        supportDrawer: '支持',
        statusRail: '状态',
        localTools: '局部工具',
      },
    });

    expect(Array.from(shellMarkup.matchAll(/data-app-shell-zone="([^"]+)"/g), (match) => match[1])).toEqual([
      'context-header',
      'command-bar',
      'instrument-area',
      'evidence-rail',
      'support-drawer',
      'status-rail',
      'local-tools',
    ]);
    expect(shellMarkup).not.toContain('data-platform-floating-dock=');
  });

  it('hides shell-owned dock controls when the route ledger declares hidden dock behavior', () => {
    const shellProps: Parameters<typeof AppShell>[0] = {
      viewerRole: 'student',
      title: '登录',
      activeHref: '/login',
      sidebarMode: 'hidden',
      children: null,
      dockControls: [{ id: 'konling', label: '控灵', control: 'konling' }],
    };
    const shell = asElement(AppShell(shellProps));
    const shellMarkup = renderAppShellMarkup(shellProps);

    expect(shell.props?.['data-platform-route-frame']).toBe('public-entry');
    expect(shell.props?.['data-platform-floating-dock-behavior']).toBe('hidden');
    expect(shellMarkup).toContain('data-platform-floating-dock-registration="true"');
    expect(shellMarkup).toContain('data-platform-floating-dock-behavior="hidden"');
  });

  it('keeps global AI registration inside the shared dock instead of rendering a second fixed button', () => {
    const layoutSource = readSource('src/app/layout.tsx');
    const globalAiButtonSource = readSource('src/components/ai/global-ai-button.tsx');
    const pageFloatingControlsSource = readSource('src/components/shared/page-floating-controls.tsx');
    const appShellSource = readSource('src/components/platform/app-shell.tsx');

    expect(layoutSource).toContain('<PageFloatingControlsProvider>');
    expect(layoutSource).toContain('<GlobalAIFloatingButton />');
    expect(globalAiButtonSource).toContain('registerControl');
    expect(globalAiButtonSource).not.toContain('getFloatingButtonStyles');
    expect(globalAiButtonSource).not.toContain('fixed bottom-20 right-6');
    expect(appShellSource).toContain('setRouteDockBehavior(behavior)');
    expect(appShellSource).toContain('controlRegistrationSignature');
    expect(appShellSource).not.toContain('[behavior, controls, registerControl]');
    expect(appShellSource).not.toContain('fixed bottom-4 right-4');
    expect(pageFloatingControlsSource).toContain("behavior === 'hidden'");
    expect(pageFloatingControlsSource).toContain('data-platform-floating-dock=');
    expect(pageFloatingControlsSource).toContain('data-page-floating-controls="true"');
  });

  it('keeps account, overlay, dock, and Konling surfaces on one ordered platform layer contract', () => {
    const globalAiSidebarSource = readSource('src/components/ai/global-ai-sidebar.tsx');
    const pageFloatingControlsSource = readSource('src/components/shared/page-floating-controls.tsx');
    const userMenuSource = readSource('src/components/shared/user-menu.tsx');

    expect(PLATFORM_LAYERS.account).toBeLessThan(PLATFORM_LAYERS.overlay);
    expect(PLATFORM_LAYERS.overlay).toBeLessThan(PLATFORM_LAYERS.floatingDock);
    expect(PLATFORM_LAYERS.floatingDock).toBeLessThan(PLATFORM_LAYERS.konlingSide);
    expect(PLATFORM_LAYERS.konlingSide).toBeLessThan(PLATFORM_LAYERS.konlingWorkspace);
    expect(platformLayerStyle('konlingWorkspace')).toEqual({
      zIndex: PLATFORM_LAYERS.konlingWorkspace,
    });
    expect(globalAiSidebarSource).toContain("platformLayerStyle(isMaximized ? 'konlingWorkspace' : 'konlingSide')");
    expect(pageFloatingControlsSource).toContain("platformLayerStyle('floatingDock')");
    expect(pageFloatingControlsSource).toContain("workspaceDockSuppressed ? 'hidden' : routeDockBehavior");
    expect(userMenuSource).toContain("platformLayerStyle('account')");
    expect(userMenuSource).toContain("platformLayerStyle('overlay')");
  });

  it('registers simulation Konling through the shared dock without covering local controls', () => {
    const simulationShellSource = readSource('src/app/simulations/_components/simulation-shell.tsx');
    const simulationLocalToolsSource = readSource('src/app/simulations/_components/simulation-local-tools.tsx');
    const pageFloatingControlsSource = readSource('src/components/shared/page-floating-controls.tsx');
    const appShellSource = readSource('src/components/platform/app-shell.tsx');
    const globalsSource = readSource('src/app/globals.css');

    expect(simulationShellSource).toContain('data-simulation-konling-context-source="server-owned"');
    expect(simulationShellSource).toContain('data-simulation-konling-context-status="degraded-without-run"');
    expect(simulationShellSource).toContain('data-simulation-dock-collision-policy="avoid-local-tools"');
    expect(simulationShellSource).not.toContain('KonlingEntryPointButton');
    expect(simulationShellSource).not.toContain('fixed bottom-');
    expect(simulationLocalToolsSource).toContain('data-simulation-dock-offset-anchor="hint-strip"');
    expect(pageFloatingControlsSource).toContain('data-platform-floating-dock-safe-area="bottom-right"');
    expect(pageFloatingControlsSource).toContain('data-platform-floating-dock-expanded-panel');
    expect(pageFloatingControlsSource).toContain('max-h-[min(70vh,28rem)]');
    expect(appShellSource).toContain('data-platform-floating-dock-collision-policy');
    expect(appShellSource).toContain('data-platform-floating-dock-mobile-behavior');
    expect(globalsSource).toContain(
      'body:has([data-simulation-dock-collision-policy="avoid-local-tools"]) [data-page-floating-controls]',
    );
    expect(globalsSource).toContain('right: auto !important');
    expect(globalsSource).toContain('width: max-content');
    expect(globalsSource).toContain('top: 7rem');
    expect(globalsSource).toContain('bottom: auto !important');
  });

  it('lets dense commercial workspaces defer fixed sidebar space until xl', () => {
    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'admin',
      title: '数据中心',
      activeHref: '/data-center',
      sidebarMode: 'collapsible',
      navigation: [
        {
          id: 'platform-home',
          label: '首页',
          href: '/',
          role: 'admin',
          order: 10,
        },
        {
          id: 'platform-data-center',
          label: '数据中心',
          href: '/data-center',
          role: 'admin',
          order: 20,
        },
      ],
      children: null,
    });

    expect(
      getAppShellDesktopGridClassName({
        showSidebar: true,
        sidebarBreakpoint: 'xl',
        navigationCollapsed: false,
      }),
    ).toContain('xl:grid-cols-[248px_minmax(0,1fr)]');
    expect(shellMarkup).toContain('xl:grid-cols-[72px_minmax(0,1fr)]');
    expect(shellMarkup).toContain('data-app-shell-navigation-state="collapsed"');
    expect(shellMarkup).not.toContain('lg:grid-cols-[248px_1fr]');
    expect(shellMarkup).toContain('hidden xl:block');
    expect(shellMarkup).toContain('xl:hidden');
  });

  it('does not reserve sidebar layout space when shell navigation is empty', () => {
    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'teacher',
      title: '教师工作台',
      activeHref: '/teacher/classes',
      navigation: [],
      children: null,
    });

    expect(shellMarkup).not.toContain('lg:grid-cols-[248px_1fr]');
    expect(shellMarkup).not.toContain('xl:grid-cols-[248px_minmax(0,1fr)]');
    expect(shellMarkup).not.toContain('aria-label="平台导航"');
  });

  it('uses compact fixed page edges instead of centered AppShell and course runtime caps', () => {
    const appShellSource = readSource('src/components/platform/app-shell.tsx');
    const globalsSource = readSource('src/app/globals.css');
    const runtimeShellSource = readSource('src/features/interactive/shared/lesson-runtime-shell.tsx');

    expect(appShellSource).toContain('APP_SHELL_COMPACT_PAGE_EDGE_CLASS');
    expect(appShellSource).toContain('data-platform-compact-page-edge');
    expect(appShellSource).not.toMatch(/contentFrameClassNames[\s\S]*mx-auto[\s\S]*max-w-/);
    expect(globalsSource).toContain('--platform-page-edge-x');
    expect(globalsSource).toContain('--platform-page-edge-x-mobile');
    expect(globalsSource).toContain('--platform-page-edge-x-desktop');
    expect(globalsSource).not.toMatch(/\.premium-lesson-main\s*\{[\s\S]*@apply\s+mx-auto\s+max-w-/);
    expect(runtimeShellSource).not.toContain('max-w-4xl');
  });
});
