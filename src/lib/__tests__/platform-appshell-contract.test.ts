import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { AppHeader } from '@/components/platform/app-shell';
import {
  APP_SHELL_GOVERNANCE_CHANGE_ID,
  APP_SHELL_GOVERNANCE_REPRESENTATIVE_ROUTE_MATRIX,
  APP_SHELL_COMPATIBLE_WRAPPERS,
  DEEP_PRODUCT_APP_SHELL_CHANGE_ID,
  DEEP_PRODUCT_APP_SHELL_ROUTE_MATRIX,
  LEGACY_LESSON_RUNTIME_ROUTE_SLUGS,
  UNIVERSAL_APP_SHELL_CANONICAL_NAVIGATION_HREFS,
  UNIVERSAL_APP_SHELL_CANONICAL_NAVIGATION_ORDER,
  UNIVERSAL_APP_SHELL_HEADER_ACTION_ORDER,
  UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_MATRIX,
  UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
  UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS,
} from '@/lib/platform-appshell-contract';
import { getPlatformRouteNavigation, resolvePlatformRouteInventory } from '@/lib/platform-role-navigation';

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
      return (
        matchFrom(patternIndex + 1, routeIndex) ||
        (routeIndex < routeSegments.length && matchFrom(patternIndex, routeIndex + 1))
      );
    }

    if (routeIndex >= routeSegments.length) return false;
    const routeSegment = routeSegments[routeIndex];
    if (
      patternSegment === '*' ||
      patternSegment.startsWith(':') ||
      (patternSegment.startsWith('[') && patternSegment.endsWith(']'))
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

function createTsxSourceFile(fileName: string, source: string) {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function getImportedComponentSources(sourceFile: ts.SourceFile) {
  const importedSources = new Map<string, string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const importClause = statement.importClause;
    if (!importClause || importClause.isTypeOnly) continue;
    const importSource = statement.moduleSpecifier.text;

    if (importClause.name && /^[A-Z]/.test(importClause.name.text)) {
      importedSources.set(importClause.name.text, importSource);
    }

    const namedBindings = importClause.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;
    for (const specifier of namedBindings.elements) {
      if (specifier.isTypeOnly) continue;
      const localName = specifier.name.text;
      if (/^[A-Z]/.test(localName)) {
        importedSources.set(localName, importSource);
      }
    }
  }

  return importedSources;
}

function resolveImportSource(fromFile: string, importSource: string) {
  const base = importSource.startsWith('@/')
    ? join(process.cwd(), 'src', importSource.slice(2))
    : join(dirname(fromFile), importSource);
  const candidates = [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function isDefaultExport(node: ts.Node) {
  return Boolean(ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Default);
}

function getFunctionBodyForComponent(sourceFile: ts.SourceFile, componentName?: string): ts.ConciseBody | undefined {
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      if (!componentName && isDefaultExport(statement)) return statement.body;
      if (componentName && statement.name?.text === componentName) return statement.body;
    }

    if (
      componentName &&
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === componentName,
      )
    ) {
      const declaration = statement.declarationList.declarations.find(
        (item) => ts.isIdentifier(item.name) && item.name.text === componentName,
      );
      const initializer = declaration?.initializer;
      if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
        return initializer.body;
      }
    }

    if (!componentName && ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression)) {
      return getFunctionBodyForComponent(sourceFile, statement.expression.text);
    }
  }

  return undefined;
}

function collectJsxComponentNames(node: ts.Node, renderedComponents = new Set<string>()) {
  const tagName = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node.tagName : undefined;
  if (tagName) {
    const tagText = 'text' in tagName && typeof tagName.text === 'string' ? tagName.text : tagName.getText();
    if (/^[A-Z][A-Za-z0-9_]*$/.test(tagText)) {
      renderedComponents.add(tagText);
    }
  }
  ts.forEachChild(node, (child) => {
    collectJsxComponentNames(child, renderedComponents);
  });
  return renderedComponents;
}

function collectReturnedJsxComponentBranches(
  body: ts.ConciseBody | undefined,
  sourceFile?: ts.SourceFile,
  visitedLocalCalls = new Set<string>(),
): Set<string>[] {
  if (!body) return [];
  if (!ts.isBlock(body)) {
    return collectReturnedExpressionComponentBranches(body, sourceFile, new Set(visitedLocalCalls));
  }

  const branches: Set<string>[] = [];
  function visit(node: ts.Node) {
    if (ts.isFunctionLike(node) && node !== body) return;
    if (ts.isIfStatement(node) && node.expression.kind === ts.SyntaxKind.FalseKeyword) {
      node.elseStatement?.forEachChild(visit);
      return;
    }
    if (ts.isReturnStatement(node) && node.expression) {
      branches.push(
        ...collectReturnedExpressionComponentBranches(node.expression, sourceFile, new Set(visitedLocalCalls)),
      );
      return;
    }
    ts.forEachChild(node, visit);
  }

  body.forEachChild(visit);
  return branches;
}

function collectReturnedExpressionComponentBranches(
  expression: ts.Expression,
  sourceFile: ts.SourceFile | undefined,
  visitedLocalCalls: Set<string>,
): Set<string>[] {
  const renderedComponents = collectJsxComponentNames(expression);
  if (!sourceFile) return [renderedComponents];
  const unwrapped = ts.isParenthesizedExpression(expression) ? expression.expression : expression;
  if (ts.isCallExpression(unwrapped) && ts.isIdentifier(unwrapped.expression)) {
    const helperName = unwrapped.expression.text;
    if (visitedLocalCalls.has(helperName)) return [renderedComponents];
    visitedLocalCalls.add(helperName);
    const helperBranches = collectReturnedJsxComponentBranches(
      getFunctionBodyForComponent(sourceFile, helperName),
      sourceFile,
      visitedLocalCalls,
    );
    if (helperBranches.length > 0) return helperBranches;
  }

  return [renderedComponents];
}

function collectReturnedJsxComponentNames(body: ts.ConciseBody | undefined, sourceFile?: ts.SourceFile) {
  const renderedComponents = new Set<string>();
  for (const branch of collectReturnedJsxComponentBranches(body, sourceFile)) {
    for (const componentName of branch) {
      renderedComponents.add(componentName);
    }
  }
  return renderedComponents;
}

function findRegisteredWrapperEvidence(file: string, depth = 0, seen = new Set<string>()): string | undefined {
  if (seen.has(file) || depth > 4) return undefined;
  seen.add(file);

  const source = readFileSync(file, 'utf8');
  const sourceFile = createTsxSourceFile(file, source);
  const branches = collectReturnedJsxComponentBranches(getFunctionBodyForComponent(sourceFile), sourceFile);
  if (branches.length === 0) return undefined;

  const importedComponentSources = getImportedComponentSources(sourceFile);
  const branchEvidence = branches.map((branch) =>
    findBranchWrapperEvidence(branch, file, sourceFile, importedComponentSources, depth, new Set(seen)),
  );

  if (branchEvidence.every(Boolean)) return branchEvidence[0];

  return undefined;
}

function findBranchWrapperEvidence(
  renderedComponents: Set<string>,
  file: string,
  sourceFile: ts.SourceFile,
  importedComponentSources: Map<string, string>,
  depth: number,
  seen: Set<string>,
) {
  const wrapper = appShellWrapperNames.find((wrapperName) => renderedComponents.has(wrapperName));
  if (wrapper) return `${relative(process.cwd(), file)}:${wrapper}`;

  for (const componentName of renderedComponents) {
    const importSource = importedComponentSources.get(componentName);
    if (!importSource) {
      const localEvidence = findRegisteredWrapperEvidenceForComponent(file, componentName, depth + 1, seen);
      if (localEvidence) return localEvidence;
      continue;
    }
    if (!importSource.startsWith('@/') && !importSource.startsWith('.')) continue;
    const importedFile = resolveImportSource(file, importSource);
    if (!importedFile) continue;
    const importedEvidence = findRegisteredWrapperEvidenceForComponent(importedFile, componentName, depth + 1, seen);
    if (importedEvidence) return importedEvidence;
  }

  return undefined;
}

function findRegisteredWrapperEvidenceForComponent(
  file: string,
  componentName: string,
  depth = 0,
  seen = new Set<string>(),
): string | undefined {
  const seenKey = `${file}:${componentName}`;
  if (seen.has(seenKey) || depth > 4) return undefined;
  seen.add(seenKey);

  const source = readFileSync(file, 'utf8');
  const sourceFile = createTsxSourceFile(file, source);
  const branches = collectReturnedJsxComponentBranches(
    getFunctionBodyForComponent(sourceFile, componentName),
    sourceFile,
  );
  if (branches.length === 0) return undefined;

  const importedComponentSources = getImportedComponentSources(sourceFile);
  const branchEvidence = branches.map((branch) =>
    findBranchWrapperEvidence(branch, file, sourceFile, importedComponentSources, depth, new Set(seen)),
  );
  if (branchEvidence.every(Boolean)) return branchEvidence[0];

  return undefined;
}

function patternSpecificity(pattern: string) {
  return pattern
    .split('/')
    .filter((segment) => segment && segment !== '*' && segment !== '**')
    .join('/').length;
}

function findRouteCoverage(file: string): RouteCoverage | undefined {
  const routePath = routePathFromPageFile(file);
  if (routePath === '/') return { kind: 'home-route', evidence: 'homepage exception' };

  const directWrapper = findRegisteredWrapperEvidence(file);
  if (directWrapper) {
    return {
      kind: directWrapper.endsWith(':AppShell') ? 'direct-appshell' : 'compatible-wrapper',
      evidence: directWrapper,
    };
  }

  const ancestorWrapper = ancestorLayoutFiles(file)
    .map((layout) => {
      return findRegisteredWrapperEvidence(layout);
    })
    .find(Boolean);
  if (ancestorWrapper) {
    return {
      kind: ancestorWrapper.endsWith(':AppShell') ? 'direct-appshell' : 'compatible-wrapper',
      evidence: ancestorWrapper,
    };
  }

  const routeException = UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS.filter((exception) =>
    matchRoutePattern(exception.routePattern, routePath),
  ).sort((left, right) => patternSpecificity(right.routePattern) - patternSpecificity(left.routePattern))[0];
  if (routeException)
    return {
      kind: 'governed-exception',
      evidence: routeException.routePattern,
    };

  return undefined;
}

describe('universal AppShell frame contract', () => {
  const executedDomContractProofIds = new Set([
    'app-shell-header-action-order',
    'route-coverage-scanner',
    'interactive-learning-shell-contract',
    'course-entry-shell-route-coverage',
    'lesson-runtime-shell-route-coverage',
    'classroom-join-appshell-route-coverage',
    'simulation-shell-wrapper-contract',
    'arena-shell-wrapper-contract',
    'control-workbench-shell-contract',
    'role-workspace-account-targets',
    'presentation-data-center-route-coverage',
    'teacher-classroom-waiting-route-coverage',
  ]);

  it('defines the canonical primary navigation sequence used by non-home AppShell routes', () => {
    const navigation = getPlatformRouteNavigation('/profile', 'student');

    expect(navigation.map((item) => item.label)).toEqual(UNIVERSAL_APP_SHELL_CANONICAL_NAVIGATION_ORDER);
    expect(navigation.map((item) => item.href)).toEqual(UNIVERSAL_APP_SHELL_CANONICAL_NAVIGATION_HREFS);
    expect(navigation.at(-1)).toMatchObject({
      label: '个人中心',
      href: '/profile',
    });
  });

  it('defines the primary route AppShell matrix and responsive evidence widths', () => {
    expect(UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS).toEqual([1440, 1280, 1024, 768, 390, 320]);
    expect(UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_MATRIX.map((route) => route.href)).toEqual([
      '/knowledge',
      '/interactive-learning',
      '/assessment/adaptive-practice',
      '/arena',
      '/simulations',
      '/interactive-learning/control-workbench',
      '/evaluation/prompt-assessment',
      '/profile',
    ]);

    for (const route of UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_MATRIX) {
      const inventory = resolvePlatformRouteInventory(route.href);
      expect(inventory?.desktopNavigation, route.href).toBe('collapsible');
      expect(inventory?.mobileNavigation, route.href).toBe('drawer');
      expect(route.requiredWidths, route.href).toEqual(UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS);
      expect(route.localCommandZone, route.href).toBeTruthy();
    }
  });

  it('defines deep product route shell ownership for ordinary pages and governed runtime exceptions', () => {
    const routePatterns = DEEP_PRODUCT_APP_SHELL_ROUTE_MATRIX.map((route) => route.routePattern);

    expect(routePatterns).toEqual(
      expect.arrayContaining([
        '/interactive-learning/courses/unit-4-1-design-task-expression/student/*',
        '/interactive-learning/courses/unit-4-1-design-task-expression/teacher/*',
        '/interactive-learning/courses/{legacy-runtime-slug}/{student|teacher}/*',
        '/ai',
        '/ai/copilot',
        '/playlists',
        '/playlists/new',
        '/playlists/*/play',
        '/missions',
        '/profile/portfolio',
        '/classroom/join',
        '/classroom/student/*',
        '/classroom/teacher/*',
        '/classroom/teacher/*/review',
      ]),
    );
    expect(routePatterns).not.toContain('/interactive-learning/courses/*/student/*');
    expect(routePatterns).not.toContain('/interactive-learning/courses/*/teacher/*');

    const migratedRoutes = DEEP_PRODUCT_APP_SHELL_ROUTE_MATRIX.filter(
      (route) => route.shellEvidence !== 'governed-exception',
    );
    const governedRuntimeRoutes = DEEP_PRODUCT_APP_SHELL_ROUTE_MATRIX.filter(
      (route) => route.shellEvidence === 'governed-exception',
    ).filter(
      (route) => route.routePattern !== '/interactive-learning/courses/{legacy-runtime-slug}/{student|teacher}/*',
    );

    for (const route of migratedRoutes) {
      expect(existsSync(join(process.cwd(), route.sourceFile)), route.routePattern).toBe(true);
      const absoluteSource = join(process.cwd(), route.sourceFile);
      const directCoverage = absoluteSource.endsWith('/page.tsx') ? findRouteCoverage(absoluteSource) : undefined;
      const wrapperCoverage = findRegisteredWrapperEvidence(absoluteSource);

      expect(route.acceptanceIds, route.routePattern).toEqual(expect.arrayContaining(['AC1', 'AC5']));
      expect(directCoverage?.kind === 'compatible-wrapper' || Boolean(wrapperCoverage), route.routePattern).toBe(true);
    }

    for (const route of governedRuntimeRoutes) {
      expect(route.acceptanceIds, route.routePattern).toEqual(expect.arrayContaining(['AC1', 'AC5']));
      expect(
        UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS.some(
          (exception) =>
            exception.owner === DEEP_PRODUCT_APP_SHELL_CHANGE_ID &&
            matchRoutePattern(route.routePattern, exception.routePattern),
        ),
        route.routePattern,
      ).toBe(true);
    }

    const migratedRouteExceptions = migratedRoutes.flatMap((route) =>
      UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS.filter((exception) =>
        matchRoutePattern(exception.routePattern, route.routePattern),
      ).map((exception) => `${route.routePattern} -> ${exception.routePattern}`),
    );
    expect(migratedRouteExceptions).toEqual([]);

    expect(LEGACY_LESSON_RUNTIME_ROUTE_SLUGS).not.toContain('unit-1-1-see-the-full-picture');
    expect(LEGACY_LESSON_RUNTIME_ROUTE_SLUGS).not.toContain('unit-4-1-design-task-expression');
    expect(UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS.map((exception) => exception.routePattern)).not.toEqual(
      expect.arrayContaining([
        '/interactive-learning/courses/*/student/*',
        '/interactive-learning/courses/*/teacher/*',
      ]),
    );
    expect(
      UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS.some((exception) =>
        matchRoutePattern(
          exception.routePattern,
          '/interactive-learning/courses/unit-4-1-design-task-expression/student/demo-session',
        ),
      ),
    ).toBe(false);
    expect(
      UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS.some((exception) =>
        matchRoutePattern(
          exception.routePattern,
          '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/demo-session',
        ),
      ),
    ).toBe(false);
  });

  it('keeps non-student profile navigation role-scoped while the profile entry uses primary drawer chrome', () => {
    const profileInventory = resolvePlatformRouteInventory('/profile');
    const teacherNavigation = getPlatformRouteNavigation('/profile', 'teacher');
    const adminNavigation = getPlatformRouteNavigation('/profile', 'admin');

    expect(profileInventory?.desktopNavigation).toBe('collapsible');
    expect(profileInventory?.mobileNavigation).toBe('drawer');
    expect(teacherNavigation[0]).toMatchObject({
      id: 'teacher-cockpit',
      href: '/teacher',
    });
    expect(adminNavigation[0]).toMatchObject({
      id: 'admin-cockpit',
      href: '/admin',
    });
    expect(teacherNavigation.map((entry) => entry.id)).not.toContain('student-profile');
    expect(adminNavigation.map((entry) => entry.id)).not.toContain('student-profile');
  });

  it('keeps the shell-owned top-right pair after route-local actions', () => {
    const markup = renderToStaticMarkup(
      createElement(AppHeader, {
        viewerRole: 'student',
        title: '路径中心',
        breadcrumbs: [{ label: '首页', href: '/' }, { label: '路径中心' }],
        actions: createElement('button', { 'data-route-command': 'export' }, '导出'),
        userMenu: createElement('a', { href: '/profile' }, '个人中心'),
      }),
    );

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
    const markup = renderToStaticMarkup(
      createElement(AppHeader, {
        viewerRole: 'student',
        title: '知识资源',
        breadcrumbs: [{ label: '首页', href: '/' }, { label: '知识资源' }],
      }),
    );

    expect(markup).toContain('data-app-shell-header-action-pair="theme-switch personal-center"');
    expect(markup).toContain('data-app-shell-header-action="personal-center"');
    expect(markup).toContain('href="/profile"');
    expect(markup.indexOf('data-app-shell-header-action="theme-switch"')).toBeLessThan(
      markup.indexOf('data-app-shell-header-action="personal-center"'),
    );
  });

  it('allows shell callers to override the Personal Center target independently of visual role', () => {
    const markup = renderToStaticMarkup(
      createElement(AppHeader, {
        viewerRole: 'student',
        title: '控制工作台',
        breadcrumbs: [{ label: '首页', href: '/' }, { label: '控制工作台' }],
        accountHref: '/teacher',
      }),
    );

    expect(markup).toContain('data-app-shell-header-action="personal-center"');
    expect(markup).toContain('href="/teacher"');
    expect(markup).not.toContain('href="/profile"');
  });

  it('registers every AppShell-compatible wrapper with DOM contract evidence', () => {
    const wrapperNames = APP_SHELL_COMPATIBLE_WRAPPERS.map((wrapper) => wrapper.name);

    expect(wrapperNames).toEqual([
      'AppShell',
      'InteractiveLearningShell',
      'CourseEntryShell',
      'LessonRuntimeShell',
      'ClassroomJoinAppShell',
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
      expect(wrapper.domContractProofIds.length, wrapper.name).toBeGreaterThan(0);
      expect(
        wrapper.domContractProofIds.every((proofId) => executedDomContractProofIds.has(proofId)),
        wrapper.name,
      ).toBe(true);
      expect(wrapper.contractTestFiles.every((testFile) => existsSync(join(process.cwd(), testFile)))).toBe(true);
    }
  });

  it('keeps governed shell-free route exceptions explicit and removal-bound', () => {
    const exceptionKeys = UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS.map((exception) => exception.routePattern);
    const duplicateExceptions = exceptionKeys.filter(
      (routePattern, index) => exceptionKeys.indexOf(routePattern) !== index,
    );

    expect(duplicateExceptions).toEqual([]);
    expect(exceptionKeys).toEqual(
      expect.arrayContaining([
        '/',
        '/login',
        '/register',
        '/review/**',
        '/interactive-learning/lessons/*/handout-print',
        '/interactive-learning/resources/control-odyssey-v1/ship',
        '/virtual-lab',
      ]),
    );

    for (const exception of UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS) {
      expect(exception.category, exception.routePattern).toBeTruthy();
      expect(exception.owner).toBeTruthy();
      expect(exception.reason).toBeTruthy();
      expect(exception.violatedShellRules.length).toBeGreaterThan(0);
      expect(exception.removalCondition).toBeTruthy();
      expect(exception.removalCondition).not.toBe(exception.reason);
    }
  });

  it('keeps ordinary product route exceptions limited to temporary blockers', () => {
    const ordinaryProductFamilies = [
      '/classroom',
      '/interactive-learning/courses',
      '/ai',
      '/graph-center',
      '/knowledge',
      '/assessment',
      '/playlists',
      '/profile',
      '/teacher',
      '/admin',
      '/simulations',
    ];

    for (const exception of UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS) {
      const isOrdinaryProductException = ordinaryProductFamilies.some(
        (prefix) => exception.routePattern === prefix || exception.routePattern.startsWith(`${prefix}/`),
      );
      if (!isOrdinaryProductException) continue;

      expect(
        ['legacy-lesson-runtime', 'classroom-runtime', 'redirect-shim', 'print-surface', 'embed-surface'].includes(
          exception.category,
        ),
        exception.routePattern,
      ).toBe(true);
      expect(exception.removalCondition, exception.routePattern).toMatch(
        /adopts|removed|shell-covered|registered|retired|canonical/i,
      );
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

  it('keeps representative visual audit coverage complete for AppShell governance', () => {
    const categories = new Set(APP_SHELL_GOVERNANCE_REPRESENTATIVE_ROUTE_MATRIX.map((route) => route.category));
    const routeKeys = APP_SHELL_GOVERNANCE_REPRESENTATIVE_ROUTE_MATRIX.map((route) => `${route.category}:${route.href}`);
    const duplicateRouteKeys = routeKeys.filter((routeKey, index) => routeKeys.indexOf(routeKey) !== index);

    expect(APP_SHELL_GOVERNANCE_CHANGE_ID).toBe('enforce-appshell-route-coverage-governance');
    expect(duplicateRouteKeys).toEqual([]);
    expect(categories).toEqual(
      new Set([
        'primary',
        'teacher',
        'teacher-classes',
        'admin',
        'graph',
        'data-center',
        'course',
        'course-student-session',
        'course-teacher-session',
        'classroom',
        'ai',
        'playlist',
        'arena-child',
        'simulation-child',
        'assessment-child',
        'virtual-lab',
      ]),
    );

    for (const route of APP_SHELL_GOVERNANCE_REPRESENTATIVE_ROUTE_MATRIX) {
      expect(existsSync(join(process.cwd(), route.sourceFile)), route.href).toBe(true);
      expect(route.requiredWidths, route.href).toEqual(UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS);
      expect(route.visualAuditStatus, route.href).toBe('required');
      expect(route.acceptanceIds, route.href).toEqual(expect.arrayContaining(['AC-4', 'AC-6']));
    }

    const roleSafeRoutes = APP_SHELL_GOVERNANCE_REPRESENTATIVE_ROUTE_MATRIX.filter((route) =>
      route.viewerRole === 'teacher' || route.viewerRole === 'admin',
    );
    expect(roleSafeRoutes.map((route) => route.href)).toEqual(expect.arrayContaining([
      '/teacher',
      '/teacher/classes',
      '/admin/users',
      '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/demo',
    ]));
    for (const route of roleSafeRoutes) {
      expect(route.acceptanceIds, route.href).toContain('AC-7');
      expect(route.href, route.category).not.toBe('/profile');
    }
  });

  it('does not treat route ledger metadata as AppShell render evidence', () => {
    const loginCoverage = findRouteCoverage(join(process.cwd(), 'src/app/(auth)/login/page.tsx'));
    const simulationsSource = readSource('src/app/simulations/page.tsx');
    const simulationShellSource = readSource('src/app/simulations/_components/simulation-shell.tsx');

    expect(loginCoverage).toEqual({
      kind: 'governed-exception',
      evidence: '/login',
    });
    expect(simulationsSource).not.toContain('data-simulation-user-center-action');
    expect(simulationShellSource).not.toContain('data-simulation-shell-profile-action');
  });

  it('keeps profile fallback shells on the shared breadcrumb contract', () => {
    const profileSource = readSource('src/app/(main)/profile/page.tsx');
    const growthSource = readSource('src/app/(main)/profile/growth/page.tsx');

    expect(profileSource).toContain("breadcrumbs={[{ label: '首页', href: '/' }, { label: '个人中心' }]}");
    expect(growthSource).toContain("{ label: '首页', href: '/' }");
    expect(growthSource).toContain("{ label: '个人中心', href: '/profile' }");
    expect(growthSource).toContain("{ label: '成长中枢' }");
  });

  it('does not treat unused wrapper imports as AppShell render evidence', () => {
    const source = [
      "import { AppShell } from '@/components/platform/app-shell';",
      "import { SomethingElse } from '@/features/example/something-else';",
      '',
      'export default function DemoPage() {',
      '  return <SomethingElse />;',
      '}',
    ].join('\n');
    const sourceFile = createTsxSourceFile('fixture.tsx', source);

    expect(collectReturnedJsxComponentNames(getFunctionBodyForComponent(sourceFile))).toEqual(
      new Set(['SomethingElse']),
    );
    expect(getImportedComponentSources(sourceFile).get('AppShell')).toBe('@/components/platform/app-shell');
    expect(
      appShellWrapperNames.some((wrapperName) =>
        collectReturnedJsxComponentNames(getFunctionBodyForComponent(sourceFile)).has(wrapperName),
      ),
    ).toBe(false);
  });

  it('does not treat unused helpers, false branches, or tag-prefix matches as shell coverage', () => {
    const source = [
      "import { AppShell } from '@/components/platform/app-shell';",
      "import { AppShellCompat } from '@/features/example/app-shell-compat';",
      '',
      'function UnusedShellHelper() {',
      '  return <AppShell viewerRole="student">unused</AppShell>;',
      '}',
      '',
      'export default function DemoPage() {',
      '  if (false) return <AppShell viewerRole="student">dead</AppShell>;',
      '  return <AppShellCompat />;',
      '}',
    ].join('\n');
    const sourceFile = createTsxSourceFile('fixture.tsx', source);
    const renderedComponents = collectReturnedJsxComponentNames(getFunctionBodyForComponent(sourceFile));

    expect(renderedComponents).toEqual(new Set(['AppShellCompat']));
    expect(renderedComponents.has('AppShell')).toBe(false);
    expect(appShellWrapperNames.some((wrapperName) => renderedComponents.has(wrapperName))).toBe(false);
  });

  it('requires every reachable return branch to render AppShell coverage', () => {
    const source = [
      "import { RoleWorkspaceShell } from '@/components/platform/role-workspace-shell';",
      '',
      'export default function ConditionalLayout({ children }: { children: React.ReactNode }) {',
      '  if (!children) return children;',
      '  return <RoleWorkspaceShell workspaceRole="admin" title="Admin">{children}</RoleWorkspaceShell>;',
      '}',
    ].join('\n');
    const sourceFile = createTsxSourceFile('fixture.tsx', source);
    const branches = collectReturnedJsxComponentBranches(getFunctionBodyForComponent(sourceFile), sourceFile);

    expect(branches).toEqual([new Set<string>(), new Set(['RoleWorkspaceShell'])]);
    expect(
      findBranchWrapperEvidence(
        branches[0],
        'fixture.tsx',
        sourceFile,
        getImportedComponentSources(sourceFile),
        0,
        new Set(),
      ),
    ).toBeUndefined();
    expect(
      findBranchWrapperEvidence(
        branches[1],
        'fixture.tsx',
        sourceFile,
        getImportedComponentSources(sourceFile),
        0,
        new Set(),
      ),
    ).toBe('fixture.tsx:RoleWorkspaceShell');
  });
});
