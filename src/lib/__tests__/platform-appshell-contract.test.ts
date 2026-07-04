import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AppHeader } from '@/components/platform/app-shell';
import {
  APP_SHELL_COMPATIBLE_WRAPPERS,
  UNIVERSAL_APP_SHELL_CANONICAL_NAVIGATION_HREFS,
  UNIVERSAL_APP_SHELL_CANONICAL_NAVIGATION_ORDER,
  UNIVERSAL_APP_SHELL_HEADER_ACTION_ORDER,
  UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS,
} from '@/lib/platform-appshell-contract';
import { getPlatformRouteNavigation } from '@/lib/platform-role-navigation';

type RouteCoverage =
  | { kind: 'home-route'; evidence: string }
  | { kind: 'direct-appshell'; evidence: string }
  | { kind: 'compatible-wrapper'; evidence: string }
  | { kind: 'governed-exception'; evidence: string };

const appRoot = join(process.cwd(), 'src/app');
const appShellWrapperNames = APP_SHELL_COMPATIBLE_WRAPPERS.map((wrapper) => wrapper.name);

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

function collectPageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return collectPageFiles(absolute);
    if (entry.isFile() && entry.name === 'page.tsx') return [absolute];
    return [];
  });
}

function routePathFromPageFile(file: string) {
  const appRelative = relative(appRoot, file).split(posix.sep).join('/');
  const withoutPage = appRelative === 'page.tsx' ? '' : appRelative.replace(/\/page\.tsx$/, '');
  const withoutRouteGroups = withoutPage
    .split('/')
    .filter((segment) => !segment.startsWith('(') || !segment.endsWith(')'))
    .join('/');

  return withoutRouteGroups ? `/${withoutRouteGroups}` : '/';
}

function matchRoutePattern(pattern: string, routePath: string) {
  const patternSegments = pattern.split('/').filter(Boolean);
  const routeSegments = routePath.split('/').filter(Boolean);

  function matchFrom(patternIndex: number, routeIndex: number): boolean {
    if (patternIndex === patternSegments.length) return routeIndex === routeSegments.length;
    const patternSegment = patternSegments[patternIndex];

    if (patternSegment === '**') {
      return matchFrom(patternIndex + 1, routeIndex)
        || (routeIndex < routeSegments.length && matchFrom(patternIndex, routeIndex + 1));
    }

    if (routeIndex >= routeSegments.length) return false;
    const routeSegment = routeSegments[routeIndex];
    if (
      patternSegment === '*'
      || patternSegment.startsWith(':')
      || (patternSegment.startsWith('[') && patternSegment.endsWith(']'))
    ) {
      return matchFrom(patternIndex + 1, routeIndex + 1);
    }

    return patternSegment === routeSegment && matchFrom(patternIndex + 1, routeIndex + 1);
  }

  return matchFrom(0, 0);
}

function ancestorLayoutFiles(file: string) {
  const files: string[] = [];
  let directory = dirname(file);
  while (directory.startsWith(appRoot)) {
    const layout = join(directory, 'layout.tsx');
    if (existsSync(layout)) files.push(layout);
    if (directory === appRoot) break;
    directory = dirname(directory);
  }
  return files;
}

function sourceMentionsRegisteredWrapper(source: string) {
  return appShellWrapperNames.find((wrapperName) => (
    source.includes(`<${wrapperName}`)
    || source.includes(`import { ${wrapperName}`)
    || source.includes(`import ${wrapperName}`)
  ));
}

function resolveImportSource(fromFile: string, importSource: string) {
  const base = importSource.startsWith('@/') ? join(process.cwd(), 'src', importSource.slice(2)) : join(dirname(fromFile), importSource);
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function findRegisteredWrapperEvidence(file: string, depth = 0, seen = new Set<string>()): string | undefined {
  if (seen.has(file) || depth > 4) return undefined;
  seen.add(file);

  const source = readFileSync(file, 'utf8');
  const wrapper = sourceMentionsRegisteredWrapper(source);
  if (wrapper) return `${relative(process.cwd(), file)}:${wrapper}`;

  const importSources = Array.from(source.matchAll(/from ['"]([^'"]+)['"]/g))
    .map((match) => match[1])
    .filter((importSource) => importSource.startsWith('@/') || importSource.startsWith('.'));

  for (const importSource of importSources) {
    const importedFile = resolveImportSource(file, importSource);
    if (!importedFile) continue;
    const importedEvidence = findRegisteredWrapperEvidence(importedFile, depth + 1, seen);
    if (importedEvidence) return importedEvidence;
  }

  return undefined;
}

function patternSpecificity(pattern: string) {
  return pattern.split('/').filter((segment) => segment && segment !== '*' && segment !== '**').join('/').length;
}

function findRouteCoverage(file: string): RouteCoverage | undefined {
  const routePath = routePathFromPageFile(file);
  if (routePath === '/') return { kind: 'home-route', evidence: 'homepage exception' };

  const directWrapper = findRegisteredWrapperEvidence(file);
  if (directWrapper) return { kind: 'compatible-wrapper', evidence: directWrapper };

  const ancestorWrapper = ancestorLayoutFiles(file).map((layout) => {
    return findRegisteredWrapperEvidence(layout);
  }).find(Boolean);
  if (ancestorWrapper) return { kind: 'compatible-wrapper', evidence: ancestorWrapper };

  const routeException = UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS
    .filter((exception) => matchRoutePattern(exception.routePattern, routePath))
    .sort((left, right) => patternSpecificity(right.routePattern) - patternSpecificity(left.routePattern))[0];
  if (routeException) return { kind: 'governed-exception', evidence: routeException.routePattern };

  return undefined;
}

describe('universal AppShell frame contract', () => {
  it('defines the canonical primary navigation sequence used by non-home AppShell routes', () => {
    const navigation = getPlatformRouteNavigation('/profile', 'student');

    expect(navigation.map((item) => item.label)).toEqual(UNIVERSAL_APP_SHELL_CANONICAL_NAVIGATION_ORDER);
    expect(navigation.map((item) => item.href)).toEqual(UNIVERSAL_APP_SHELL_CANONICAL_NAVIGATION_HREFS);
    expect(navigation.at(-1)).toMatchObject({ label: '个人中心', href: '/profile' });
  });

  it('keeps the shell-owned top-right pair after route-local actions', () => {
    const markup = renderToStaticMarkup(createElement(AppHeader, {
      viewerRole: 'student',
      title: '路径中心',
      breadcrumbs: [{ label: '首页', href: '/' }, { label: '路径中心' }],
      actions: createElement('button', { 'data-route-command': 'export' }, '导出'),
      userMenu: createElement('a', { href: '/profile' }, '个人中心'),
    }));

    expect(UNIVERSAL_APP_SHELL_HEADER_ACTION_ORDER.map((action) => action.id)).toEqual([
      'theme-switch',
      'personal-center',
    ]);
    expect(markup).toContain('data-app-shell-route-local-actions="true"');
    expect(markup).toContain('data-route-command="export"');
    expect(markup).toContain('data-app-shell-header-action-pair="theme-switch personal-center"');
    expect(markup.indexOf('data-route-command="export"')).toBeLessThan(
      markup.indexOf('data-app-shell-header-action-pair="theme-switch personal-center"'),
    );
    expect(markup.indexOf('data-app-shell-header-action="theme-switch"')).toBeLessThan(
      markup.indexOf('data-app-shell-header-action="personal-center"'),
    );
  });

  it('renders a shell-owned Personal Center action when userMenu is absent', () => {
    const markup = renderToStaticMarkup(createElement(AppHeader, {
      viewerRole: 'student',
      title: '知识资源',
      breadcrumbs: [{ label: '首页', href: '/' }, { label: '知识资源' }],
    }));

    expect(markup).toContain('data-app-shell-header-action-pair="theme-switch personal-center"');
    expect(markup).toContain('data-app-shell-header-action="personal-center"');
    expect(markup).toContain('href="/profile"');
    expect(markup.indexOf('data-app-shell-header-action="theme-switch"')).toBeLessThan(
      markup.indexOf('data-app-shell-header-action="personal-center"'),
    );
  });

  it('registers every AppShell-compatible wrapper with DOM contract evidence', () => {
    const wrapperNames = APP_SHELL_COMPATIBLE_WRAPPERS.map((wrapper) => wrapper.name);

    expect(wrapperNames).toEqual([
      'AppShell',
      'InteractiveLearningShell',
      'CourseEntryShell',
      'LessonRuntimeShell',
      'SimulationShell',
      'ArenaPageShell',
      'ControlWorkbenchShell',
      'RoleWorkspaceShell',
      'PresentationDataCenter',
      'TeacherClassroomWaitingPage',
    ]);

    for (const wrapper of APP_SHELL_COMPATIBLE_WRAPPERS) {
      expect(existsSync(join(process.cwd(), wrapper.sourceFile))).toBe(true);
      expect(readSource(wrapper.sourceFile)).toContain('AppShell');
      expect(wrapper.routeFamilies.length).toBeGreaterThan(0);
      expect(wrapper.requiredDomContracts).toEqual([
        'canonical-navigation',
        'breadcrumb',
        'theme-switch-then-personal-center',
      ]);
      expect(wrapper.contractTestFiles.every((testFile) => existsSync(join(process.cwd(), testFile)))).toBe(true);
    }
  });

  it('keeps governed shell-free route exceptions explicit and removal-bound', () => {
    const exceptionKeys = UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS.map((exception) => exception.routePattern);
    const duplicateExceptions = exceptionKeys.filter((routePattern, index) => exceptionKeys.indexOf(routePattern) !== index);

    expect(duplicateExceptions).toEqual([]);
    expect(exceptionKeys).toEqual(expect.arrayContaining([
      '/',
      '/login',
      '/register',
      '/review/**',
      '/interactive-learning/lessons/*/handout-print',
      '/interactive-learning/resources/control-odyssey-v1/ship',
      '/virtual-lab',
    ]));

    for (const exception of UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS) {
      expect(exception.owner).toBeTruthy();
      expect(exception.reason).toBeTruthy();
      expect(exception.violatedShellRules.length).toBeGreaterThan(0);
      expect(exception.removalCondition).toBeTruthy();
      expect(exception.removalCondition).not.toBe(exception.reason);
    }
  });

  it('classifies every app page as home, shell-covered, wrapper-covered, or governed exception', () => {
    const pages = collectPageFiles(appRoot).sort();
    const missingCoverage = pages.flatMap((page) => {
      const coverage = findRouteCoverage(page);
      return coverage ? [] : [`${routePathFromPageFile(page)} (${relative(process.cwd(), page)})`];
    });

    expect(pages.length).toBeGreaterThan(0);
    expect(missingCoverage).toEqual([]);
  });

  it('does not treat route ledger metadata as AppShell render evidence', () => {
    const loginCoverage = findRouteCoverage(join(process.cwd(), 'src/app/(auth)/login/page.tsx'));
    const simulationsSource = readSource('src/app/simulations/page.tsx');
    const simulationShellSource = readSource('src/app/simulations/_components/simulation-shell.tsx');

    expect(loginCoverage).toEqual({ kind: 'governed-exception', evidence: '/login' });
    expect(simulationsSource).not.toContain('data-simulation-user-center-action');
    expect(simulationShellSource).not.toContain('data-simulation-shell-profile-action');
  });
});
