import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { PageFloatingControlsProvider } from '@/components/shared/page-floating-controls';
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
  getAppShellDesktopGridClassName,
} from '@/components/platform/app-shell';
import {
  isTeacherOperationsNavActive,
  resolveTeacherOperationsNavHref,
} from '@/features/teacher/teacher-operations-nav';
import { resolveTeacherOperationsClassHref } from '@/features/teacher/teacher-dashboard';

const rootDir = path.resolve(__dirname, '../../..');

interface ReactElementLike {
  type?: unknown;
  props?: Record<string, unknown>;
}

function readSource(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
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
  const currentMatch = typeof currentValue === 'string' && (value === undefined || currentValue === value) ? [current] : [];
  return [
    ...currentMatch,
    ...childElements(current.props?.children).flatMap((child) => collectElementsByDataAttribute(child, attribute, value)),
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
    expect(PLATFORM_FLOATING_ACTION_DOCK_CONTROL_CONTRACTS.find((contract) => contract.control === 'konling')?.payloadBoundary).toContain('private memory');
    expect(PLATFORM_FLOATING_ACTION_DOCK_CONTROL_CONTRACTS.find((contract) => contract.control === 'management')?.roleScope).toEqual([
      'teacher',
      'admin',
    ]);
    expect(PLATFORM_FLOATING_ACTION_DOCK_CONTROL_CONTRACTS.flatMap((contract) => contract.roleScope)).not.toContain('audit');
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

    expect(PLATFORM_COMMERCIAL_WORKSPACE_SHELLS.find((shell) => shell.workspace === 'control-workbench')?.contextualNavigation).toContain('return target');
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
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/simulations/[id]')?.workspace).toBe('simulation');
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/data-center')?.expectedZones).toEqual([
      'context-strip',
      'instrument-area',
      'command-bar',
    ]);
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/teacher/classes/[classId]/analytics-v2')?.expectedZones).toEqual([
      'instrument-area',
    ]);
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/teacher')?.density).toBe('analytics');
    expect(PLATFORM_COMMERCIAL_WORKSPACE_ROUTE_MATRIX.find((route) => route.href === '/admin')?.density).toBe('governance');
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
    const teacherLayoutSource = readSource('src/app/teacher/layout.tsx');
    const teacherOperationsNavSource = readSource('src/features/teacher/teacher-operations-nav.tsx');
    const teacherDashboardSource = readSource('src/features/teacher/teacher-dashboard.tsx');
    const teacherGradingSource = readSource('src/features/assessment/document-rubric-grading-ui.tsx');
    const teacherReportLedgerLayoutSource = readSource('src/app/(teacher-report-ledger)/teacher/layout.tsx');
    const teacherGradingPageSource = readSource('src/app/(teacher-report-ledger)/teacher/grading-workbench/page.tsx');
    const teacherClassesSource = readSource('src/app/teacher/classes/page.tsx');
    const teacherLessonPlansSource = readSource('src/app/teacher/lesson-plans/page.tsx');
    const teacherResourcesSource = readSource('src/app/teacher/resources/page.tsx');
    const teacherHistorySource = readSource('src/app/teacher/history/page.tsx');
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
    expect(cruiseSimulationSource).toContain('data-commercial-workspace="simulation-scene"');
    expect(cruiseSimulationSource).toContain('data-task-workspace-archetype="immersive-scene"');
    expect(manifestRuntimeSource).toContain('data-commercial-module-chrome');
    expect(manifestRuntimeSource).not.toContain("'data-task-workspace-archetype': 'lesson-runtime'");
    expect(unit41StudentRuntimeSource).toContain('data-task-workspace-archetype="lesson-runtime"');
    expect(manifestRuntimeSource).toContain('data-commercial-module-state');
    expect(teacherAnalyticsSource).toContain('data-commercial-operations-workspace="teacher-operations"');
    expect(teacherAnalyticsSource).toContain('data-report-ledger-surface="teacher-class-analytics-report"');
    expect(teacherLayoutSource).toContain('TeacherOperationsNav');
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
    expect(teacherDashboardSource).toContain('data-operations-fabricates-metrics={String(unavailableSlot.fabricatesMetrics)}');
    expect(teacherDashboardSource).toContain('data-report-ledger-surface="teacher-prep-pack-review-slot"');
    expect(teacherDashboardSource).toContain('data-operations-overlay-lifecycle="preview review activate archive rollback"');
    expect(teacherDashboardSource).toContain('data-operations-mutates-base-manifest="false"');
    expect(teacherDashboardSource).toContain('不修改基础 manifest');
    expect(teacherDashboardSource).toContain('data-report-ledger-surface="assistant-effect-report-export"');
    expect(teacherGradingSource).toContain('data-report-ledger-surface="document-grading-workbench-ledger"');
    expect(teacherGradingSource).toContain('data-report-ledger-privacy-scope="teacher-review"');
    expect(teacherGradingSource).toContain('状态图例：草稿需人工审批');
    expect(teacherGradingPageSource).toContain('session.user.role !== UserRole.TEACHER && session.user.role !== UserRole.ADMIN');
    expect(teacherLayoutSource).toContain("session.user.role !== 'TEACHER'");
    expect(teacherLayoutSource).not.toContain('adminGradingWorkbenchAccess');
    expect(teacherReportLedgerLayoutSource).toContain("session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN'");
    expect(teacherReportLedgerLayoutSource).toContain("session.user.role === 'TEACHER' ? <TeacherOperationsNav /> : null");
    expect(teacherReportLedgerLayoutSource).toContain('data-commercial-operations-workspace="teacher-report-ledger"');
    expect(teacherClassesSource).toContain('data-commercial-operations-workspace="teacher-operations"');
    expect(teacherLessonPlansSource).toContain('data-commercial-operations-workspace="teacher-operations"');
    expect(teacherResourcesSource).toContain('data-commercial-operations-workspace="teacher-operations"');
    expect(teacherHistorySource).toContain('data-commercial-operations-workspace="teacher-operations"');
    expect(dataCenterSource).toContain('data-commercial-operations-workspace="data-center"');
    expect(dataCenterSource).toContain('repeat(auto-fit,minmax(min(100%,420px),1fr))');
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

  it('keeps migrated learner, knowledge, and adaptive surfaces on the unified shell contract', () => {
    const dashboardSource = readSource('src/app/(main)/dashboard/page.tsx');
    const profileSource = readSource('src/app/(main)/profile/page.tsx');
    const growthSource = readSource('src/app/(main)/profile/growth/page.tsx');
    const evidenceSource = readSource('src/app/(main)/profile/evidence/page.tsx');
    const knowledgeSource = readSource('src/app/knowledge/page.tsx');
    const adaptivePracticeSource = readSource('src/app/assessment/adaptive-practice/page.tsx');
    const evidenceBrowserSource = readSource('src/features/data-governance/evidence-timeline-browser.tsx');

    for (const source of [
      dashboardSource,
      profileSource,
      growthSource,
      evidenceSource,
      adaptivePracticeSource,
    ]) {
      expect(source).toContain('<AppShell');
      expect(source).toContain('viewerRole="student"');
      expect(source).not.toMatch(/role=\"(?:student|teacher)\"/);
      expect(source).not.toContain('UnifiedTopBar');
      expect(source).not.toContain('商业入口');
    }
    expect(knowledgeSource).toContain('<AppShell');
    expect(knowledgeSource).toContain('getServerAuthSession');
    expect(knowledgeSource).toContain("return 'guest'");
    expect(knowledgeSource).toContain('viewerRole={shellRole}');
    expect(knowledgeSource).not.toContain('if (!shellRole)');
    expect(knowledgeSource).not.toContain('<main className="surface-page">');
    expect(knowledgeSource).not.toContain('UnifiedTopBar');
    expect(knowledgeSource).not.toContain('商业入口');

    expect(dashboardSource).toContain('data-learner-record');
    expect(profileSource).toContain('data-learner-record');
    expect(growthSource).toContain('data-learner-record-evidence-confidence');
    expect(evidenceSource).toContain('data-knowledge-data-map-surface="evidence-browser"');
    expect(evidenceSource).toContain('chrome="embedded"');
    expect(evidenceBrowserSource).toContain("chrome?: 'standalone' | 'embedded'");
    expect(evidenceBrowserSource).toContain("chrome === 'standalone' ? 'surface-page' : undefined");
    expect(evidenceBrowserSource).toContain("chrome === 'standalone' ? 'mx-auto grid");
    expect(knowledgeSource).toContain('data-knowledge-data-map-surface="knowledge-graph"');
    expect(adaptivePracticeSource).toContain('data-commercial-entry-intent="practice"');
    expect(adaptivePracticeSource).toContain('data-learning-path-options-slot="three-style"');
    expect(adaptivePracticeSource).toContain('data-learning-path-history-slot="selection-history"');
    expect(adaptivePracticeSource).toContain('data-konling-citation-slot="cited-explanation"');
  });

  it('keeps Interactive Learning first-hop surfaces on the unified learning-atlas shell', () => {
    const interactiveEntrySource = readSource('src/app/interactive-learning/page.tsx');
    const courseCatalogSource = readSource('src/app/interactive-learning/courses/page.tsx');
    const chapterComponentsSource = readSource('src/app/interactive-learning/chapter-components/page.tsx');
    const crossDomainSource = readSource('src/app/interactive-learning/cross-domain-exploration/page.tsx');
    const shellSource = readSource('src/features/interactive/interactive-learning-shell.tsx');

    for (const source of [
      interactiveEntrySource,
      courseCatalogSource,
      chapterComponentsSource,
      crossDomainSource,
    ]) {
      expect(source).toContain('<InteractiveLearningShell');
      expect(source).not.toContain('UnifiedTopBar');
      expect(source).not.toContain('商业入口');
      expect(source).not.toContain('<main');
    }

    expect(shellSource).toContain('<AppShell');
    expect(shellSource).toContain('viewerRole="student"');
    expect(shellSource).toContain('sidebarMode="collapsible"');
    expect(shellSource).toContain('data-platform-learning-atlas-shell');
    expect(interactiveEntrySource).toContain('data-commercial-student-entry-route="/interactive-learning"');
    expect(courseCatalogSource).toContain('data-commercial-student-entry-route="/interactive-learning/courses"');
    expect(courseCatalogSource).not.toContain('interactive-course-hub-');
    expect(chapterComponentsSource).toContain('data-commercial-student-entry-route="/interactive-learning/chapter-components"');
    expect(crossDomainSource).toContain('data-commercial-student-entry-route="/interactive-learning/cross-domain-exploration"');
  });

  it('does not use student or teacher business identity as a JSX role prop', () => {
    const platformShellFiles = [
      'src/components/platform/app-shell.tsx',
    ];
    const checkedFiles = [
      ...platformShellFiles,
      ...listSourceFiles('src/app'),
      ...listSourceFiles('src/features'),
      ...listSourceFiles('src/components/platform'),
    ];
    const invalidLiteralBusinessRole = /\brole\s*=\s*(?:"student"|"teacher"|'student'|'teacher'|\{\s*'student'\s*\}|\{\s*'teacher'\s*\}|\{\s*"student"\s*\}|\{\s*"teacher"\s*\})/;
    const businessRoleForwardedToDom = /<[a-z][A-Za-z0-9:-]*(?:\s+[^<>]*?)?\srole\s*=\s*\{\s*(?:role|viewerRole|surfaceRole|businessRole|audienceRole)\s*\}/;

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
    expect(resolveTeacherOperationsNavHref(analyticsTemplate, '/teacher/classes/class-1/students/student-1/evidence')).toBe(
      '/teacher/classes/class-1/analytics-v2',
    );
    expect(resolveTeacherOperationsNavHref(analyticsTemplate, '/teacher/classes')).toBe('/teacher/classes');
    expect(resolveTeacherOperationsNavHref(analyticsTemplate, '/teacher/classes/new')).toBe('/teacher/classes');

    expect(isTeacherOperationsNavActive('/teacher/classes/class-1/analytics-v2', analyticsTemplate)).toBe(true);
    expect(isTeacherOperationsNavActive('/teacher/classes/class-1/analytics-v2', '/teacher/classes')).toBe(false);
    expect(isTeacherOperationsNavActive('/teacher/classes', analyticsTemplate)).toBe(false);
    expect(isTeacherOperationsNavActive('/teacher/classes/new', analyticsTemplate)).toBe(false);
    expect(isTeacherOperationsNavActive('/teacher/classes/class-1/students/student-1/evidence', analyticsTemplate)).toBe(
      false,
    );
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
        { id: 'teacher-home', label: '教师首页', href: '/teacher', role: 'teacher', order: 10 },
        { id: 'teacher-classes', label: '班级', href: '/teacher/classes', role: 'teacher', order: 20 },
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
    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'teacher',
      title: '教师工作台',
      activeHref: '/teacher/classes',
      navigation,
      children: null,
    });

    expect(collectLinks(sidebar).map((link) => link.props?.href)).toEqual([
      '/teacher',
      '/teacher/classes',
    ]);
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
        { id: 'teacher-home', label: '教师首页', href: '/teacher', role: 'teacher', order: 10 },
        { id: 'teacher-classes', label: '班级', href: '/teacher/classes', role: 'teacher', order: 20 },
      ],
      children: null,
    });

    expect(shellMarkup).toContain('aria-label="平台导航"');
    expect(shellMarkup).toContain('lg:hidden');
    expect(shellMarkup).not.toContain('overflow-x-auto');
    expect(shellMarkup).toContain('grid grid-cols-2');
    expect(shellMarkup).toContain('sm:flex-wrap');
    expect(shellMarkup).toContain('href="/teacher"');
    expect(shellMarkup).toContain('href="/teacher/classes"');
    expect(shellMarkup).toContain('aria-current="page"');
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
    expect(shellMarkup).toContain('href="/data-center"');
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
    expect(shell.props?.['data-platform-mobile-navigation']).toBe('drawer');
    expect(shellMarkup).toContain('href="/arena"');
    expect(shellMarkup).toContain('竞技场');
    expect(shellMarkup).toContain('Arena 任务');
    expect(shellMarkup).not.toContain('Return to');
    expect(shellMarkup).toContain('href="/arena"');
    expect(shellMarkup).toContain('aria-controls="app-shell-mobile-navigation"');
    expect(shellMarkup).toContain('data-platform-floating-dock-registration="true"');
    expect(shellMarkup).toContain('data-platform-floating-dock-behavior="collapsed"');
    expect(shellMarkup).toContain('data-platform-floating-dock-controls="konling management"');
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
      dockControls: [
        { id: 'konling', label: '控灵', control: 'konling' },
      ],
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

  it('lets dense commercial workspaces defer fixed sidebar space until xl', () => {
    const shellMarkup = renderAppShellMarkup({
      viewerRole: 'admin',
      title: '数据中心',
      activeHref: '/data-center',
      sidebarMode: 'collapsible',
      navigation: [
        { id: 'platform-home', label: '首页', href: '/', role: 'admin', order: 10 },
        { id: 'platform-data-center', label: '数据中心', href: '/data-center', role: 'admin', order: 20 },
      ],
      children: null,
    });

    expect(getAppShellDesktopGridClassName({
      showSidebar: true,
      sidebarBreakpoint: 'xl',
      navigationCollapsed: false,
    })).toContain('xl:grid-cols-[248px_minmax(0,1fr)]');
    expect(shellMarkup).toContain('xl:grid-cols-[248px_minmax(0,1fr)]');
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
});
