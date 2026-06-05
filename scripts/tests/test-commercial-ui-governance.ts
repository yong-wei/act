import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES,
  evaluateCommercialUiGovernance,
  type CommercialAccessibilityTextFitEvidence,
  type CommercialVisualAcceptanceRoute,
  type CommercialModuleChromeInventoryEntry,
  type CommercialNavigationCoverageInput,
  type CommercialShellInventoryEntry,
  type CommercialStatusVocabularyInventoryEntry,
  type CommercialUiGovernanceViolation,
  type CommercialVisualAcceptanceEvidence,
} from '../../src/lib/commercial-ui-governance';
import {
  COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS,
  PLATFORM_PROFILE_AND_COCKPIT_ACTIONS,
  STUDENT_CORE_ENTRY_IDS,
  STUDENT_LEARNING_INTENT_GROUPS,
} from '../../src/lib/platform-role-navigation';

const repoRoot = path.resolve(__dirname, '../..');
const today = new Date().toISOString().slice(0, 10);
const allowedModuleNamespaces = new Set(['activity', 'analytics', 'compute', 'content', 'layout']);

function git(args: string[]) {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function gitRequired(args: string[], message: string) {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}: ${detail}`);
  }
}

function hasGitRef(ref: string) {
  return git(['rev-parse', '--verify', ref]).trim().length > 0;
}

function lines(output: string) {
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function diffNameStatus(args: string[]) {
  return lines(git(['diff', '--name-status', ...args])).flatMap((line) => {
    const parts = line.split('\t').filter(Boolean);
    const status = parts[0] ?? '';
    if (/^[RC]\d+/.test(status)) return parts.slice(1, 3);
    return parts[1] ? [parts[1]] : [];
  });
}

function diffNameStatusRequired(args: string[], message: string) {
  return lines(gitRequired(['diff', '--name-status', ...args], message)).flatMap((line) => {
    const parts = line.split('\t').filter(Boolean);
    const status = parts[0] ?? '';
    if (/^[RC]\d+/.test(status)) return parts.slice(1, 3);
    return parts[1] ? [parts[1]] : [];
  });
}

function changedFiles() {
  const candidates = new Set<string>();
  for (const file of diffNameStatus([])) candidates.add(file);
  for (const file of diffNameStatus(['--cached'])) candidates.add(file);
  for (const file of lines(git(['ls-files', '--others', '--exclude-standard']))) candidates.add(file);
  if (hasGitRef('origin/integration')) {
    for (const file of diffNameStatusRequired(
      ['origin/integration...HEAD'],
      'commercial UI governance failed to diff origin/integration...HEAD',
    )) candidates.add(file);
  }
  if (candidates.size === 0) {
    if (!hasGitRef('HEAD^')) {
      throw new Error(
        'commercial UI governance requires changed files, origin/integration, or enough git history for HEAD^ fallback.',
      );
    }
    for (const file of diffNameStatusRequired(
      ['HEAD^', 'HEAD'],
      'commercial UI governance failed to diff HEAD^ HEAD fallback',
    )) candidates.add(file);
  }
  if (candidates.size === 0) {
    candidates.add('src/components/platform/app-shell.tsx');
    candidates.add('src/features/data-center/presentation-data-center.tsx');
    candidates.add('src/lib/platform-role-navigation.ts');
  }
  return [...candidates];
}

function sourceFilesForTokenGate(files: string[]) {
  return files.filter((file) => (
    /^(src\/app|src\/components|src\/features)\//.test(file)
    && /\.(css|tsx?)$/.test(file)
    && existsSync(path.join(repoRoot, file))
    && !/(__tests__|\.test\.|\.spec\.|src\/app\/globals\.css)/.test(file)
  ));
}

function diffForFile(file: string) {
  return [
    git(['diff', '--unified=0', '--', file]),
    git(['diff', '--cached', '--unified=0', '--', file]),
    hasGitRef('origin/integration') ? git(['diff', '--unified=0', 'origin/integration...HEAD', '--', file]) : '',
    !hasGitRef('origin/integration') && hasGitRef('HEAD^') ? git(['diff', '--unified=0', 'HEAD^', 'HEAD', '--', file]) : '',
  ].join('\n');
}

function diffAddedLines(file: string) {
  if (git(['ls-files', '--others', '--exclude-standard', '--', file]).trim() === file) {
    return readFileSync(path.join(repoRoot, file), 'utf8').split('\n');
  }
  return diffForFile(file)
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
}

function diffChangedLines(file: string) {
  if (git(['ls-files', '--others', '--exclude-standard', '--', file]).trim() === file) {
    return readFileSync(path.join(repoRoot, file), 'utf8').split('\n');
  }
  return diffForFile(file)
    .split('\n')
    .filter((line) => /^[+-]/.test(line) && !line.startsWith('+++') && !line.startsWith('---'))
    .map((line) => line.slice(1));
}

function diffDeletedLines(file: string) {
  return diffForFile(file)
    .split('\n')
    .filter((line) => line.startsWith('-') && !line.startsWith('---'))
    .map((line) => line.slice(1));
}

function someLineMatches(lines: string[], pattern: RegExp) {
  return lines.some((line) => {
    const matched = pattern.test(line);
    pattern.lastIndex = 0;
    return matched;
  });
}

function hasShellRelevantDiff(file: string) {
  return someLineMatches(
    diffAddedLines(file),
    /<AppShell\b|data-commercial-(operations-)?workspace=|<main\b|<section\b|<div\b|className=/,
  ) || someLineMatches(
    diffDeletedLines(file),
    /<AppShell\b|data-commercial-(operations-)?workspace=/,
  );
}

function lineEvidence(source: string, pattern: RegExp, label: string, file?: string) {
  const addedLineSet = file ? new Set(diffAddedLines(file).map((line) => line.trim())) : null;
  const evidence = new Set<string>();
  source.split('\n').forEach((line, index) => {
    if (addedLineSet && !addedLineSet.has(line.trim())) return;
    if (pattern.test(line)) evidence.add(`${label}:L${index + 1}:${line.trim().slice(0, 140)}`);
    pattern.lastIndex = 0;
  });
  return [...evidence];
}

function buildSourceViolations(files: string[]): CommercialUiGovernanceViolation[] {
  return sourceFilesForTokenGate(files).flatMap((file) => {
    const source = readFileSync(path.join(repoRoot, file), 'utf8');
    const rawPaletteEvidence = lineEvidence(source, /#[0-9a-fA-F]{3,8}\b/g, 'raw-color', file);
    const rawRgbaEvidence = lineEvidence(source, /\brgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,/g, 'raw-rgba', file);
    const tailwindColorEvidence = lineEvidence(
      source,
      /\b(?:bg|text|border|shadow|ring|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?(?:\/\d{1,3})?\b/g,
      'tailwind-color-family',
      file,
    );
    const gradientEvidence = lineEvidence(
      source,
      /\b(bg-gradient|from-\[[^\]]*#|via-\[[^\]]*#|to-\[[^\]]*#|linear-gradient|radial-gradient)\b/g,
      'decorative-gradient',
      file,
    );
    const violations: CommercialUiGovernanceViolation[] = [];
    if (rawPaletteEvidence.length > 0 || rawRgbaEvidence.length > 0 || tailwindColorEvidence.length > 0) {
      violations.push({
        path: file,
        rule: 'token.page-local-palette',
        message: 'Changed commercial UI source contains raw color literals instead of platform tokens.',
        evidence: [...rawPaletteEvidence, ...rawRgbaEvidence, ...tailwindColorEvidence],
      });
    }
    if (gradientEvidence.length > 0) {
      violations.push({
        path: file,
        rule: 'token.raw-decorative-gradient',
        message: 'Changed commercial UI source contains decorative gradients outside approved primitives.',
        evidence: gradientEvidence,
      });
    }
    return violations;
  });
}

function buildShellInventory(files: string[]): CommercialShellInventoryEntry[] {
  return files
    .filter((file) => /^src\/app\/(?:.*\/)?(page|layout)\.tsx$/.test(file))
    .filter((file) => existsSync(path.join(repoRoot, file)))
    .filter((file) => !/(loading|handout-print|review|api)\.tsx$/.test(file))
    .filter((file) => hasShellRelevantDiff(file))
    .map((file) => {
      const source = readFileSync(path.join(repoRoot, file), 'utf8');
      const route = file
        .replace(/^src\/app/, '')
        .replace(/\/page\.tsx$/, '')
        .replace(/\/layout\.tsx$/, '') || '/';
      return {
        path: file,
        route,
        usesRegisteredShell: /<AppShell\b|data-commercial-(operations-)?workspace=|data-route-family=\{?learnerDataShell\.routeFamily\}?|data-route-family="learner-data-pathway"/.test(source),
        shellName: /<([A-Z][A-Za-z0-9]*Shell)\b/.exec(source)?.[1],
      };
    });
}

function traverseModules(value: unknown, visit: (module: Record<string, unknown>) => void) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => traverseModules(item, visit));
    return;
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.modules)) {
    record.modules.forEach((module) => {
      if (module && typeof module === 'object' && !Array.isArray(module)) visit(module as Record<string, unknown>);
    });
  }
  Object.values(record).forEach((child) => traverseModules(child, visit));
}

function buildModuleChromeInventory(files: string[]): CommercialModuleChromeInventoryEntry[] {
  return files
    .filter((file) => /^course-content\/runtime\/lessons\/[^/]+\/interactive-manifest\.json$/.test(file))
    .filter((file) => existsSync(path.join(repoRoot, file)))
    .flatMap((file) => {
      const manifest = JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8')) as Record<string, unknown>;
      const lessonId = String(manifest.lesson_id ?? path.basename(path.dirname(file)));
      const entries: CommercialModuleChromeInventoryEntry[] = [];
      traverseModules(manifest, (module) => {
        const kind = String(module.kind ?? '');
        const namespace = kind.split('.')[0];
        const payload = module.payload && typeof module.payload === 'object' ? module.payload as Record<string, unknown> : {};
        entries.push({
          path: file,
          lessonId,
          stepId: String(module.step_id ?? 'manifest'),
          moduleId: String(module.id ?? 'unknown-module'),
          moduleKind: kind,
          registeredKind: allowedModuleNamespaces.has(namespace) && kind.includes('.'),
          usesCommercialChrome: !module.chrome && !payload.visualSkin && !payload.privateChromeComponent && !payload.customChrome,
          privateChromeComponent: String(payload.privateChromeComponent ?? payload.visualSkin ?? payload.customChrome ?? ''),
        });
      });
      return entries;
    });
}

function buildStatusInventory(files: string[]): CommercialStatusVocabularyInventoryEntry[] {
  return sourceFilesForTokenGate(files).flatMap((file) => {
    const source = readFileSync(path.join(repoRoot, file), 'utf8');
    return lineEvidence(source, /\b(status|badge|state).*(#[0-9a-fA-F]{3,8}|bg-(red|green|yellow|orange|purple|blue)-\d{2,3})/gi, 'status-color', file)
      .map((evidence) => ({
        path: file,
        statusTerm: evidence,
        registeredStatusColor: false,
      }));
  });
}

function buildNavigationCoverage(): CommercialNavigationCoverageInput {
  const studentActions = PLATFORM_PROFILE_AND_COCKPIT_ACTIONS.find((action) => action.audience === 'student');
  return {
    intents: COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.map((group) => group.intent),
    coreEntryIds: STUDENT_CORE_ENTRY_IDS,
    hrefs: COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.flatMap((group) => group.hrefs),
    aliases: STUDENT_LEARNING_INTENT_GROUPS.flatMap((group) => group.compatibilityAliases),
    profileHref: studentActions?.profileHref,
    cockpitHref: studentActions?.cockpitHref,
  };
}

function affectedVisualRoutes(files: string[]): CommercialVisualAcceptanceRoute[] {
  const routes = new Map<string, CommercialVisualAcceptanceRoute>();
  const add = (href: string) => routes.set(href, { href, requiredWidths: [1440, 320] });
  const addDefaultMatrix = () => {
    for (const route of DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES) routes.set(route.href, route);
  };
  for (const file of files) {
    if (
      file === 'src/app/globals.css'
      || file === 'src/components/platform/app-shell.tsx'
      || file === 'src/lib/platform-role-navigation.ts'
    ) {
      addDefaultMatrix();
    }
    if (file === 'src/app/page.tsx') add('/');
    if (file.includes('src/app/(main)/dashboard/')) add('/dashboard');
    if (file.includes('src/features/data-center/') || file.includes('src/app/data-center/')) add('/data-center');
    if (file.includes('src/app/(auth)/login/')) add('/login?callbackUrl=%2Fprofile');
    if (file.includes('src/app/interactive-learning/page.tsx')) add('/interactive-learning');
    if (file.includes('src/features/control-workbench/') || file.includes('src/app/interactive-learning/control-workbench/')) {
      add('/interactive-learning/control-workbench');
    }
    if (
      file.includes('src/app/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/')
      || file.includes('src/features/interactive/shared/manifest-runtime/')
      || /^src\/features\/interactive\/unit-[^/]+\//.test(file)
      || file.includes('course-content/runtime/lessons/')
    ) {
      add('/interactive-learning/courses/unit-5-4-data-driven-mpc-transition');
    }
    if (file.includes('src/app/arena/')) add('/arena');
    if (file.includes('src/app/assessment/adaptive-practice/')) add('/assessment/adaptive-practice');
    if (file.includes('src/app/(main)/profile/')) add('/profile');
    if (file.includes('src/app/teacher/classes/[classId]/analytics-v2/')) add('/teacher/classes/[classId]/analytics-v2');
    if (file.includes('src/features/admin/data-governance') || file.includes('src/app/admin/data-governance/')) {
      add('/admin/data-governance');
    }
  }
  return [...routes.values()];
}

function readVisualEvidenceManifest(): CommercialVisualAcceptanceEvidence[] {
  const manifestPath = path.join(repoRoot, 'artifacts/commercial-ui/evidence.json');
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { routes?: CommercialVisualAcceptanceEvidence[] };
  return (manifest.routes ?? []).map((route) => ({
    ...route,
    viewports: route.viewports.map((viewport) => ({
      ...viewport,
      artifact: viewport.artifact && existsSync(path.join(repoRoot, viewport.artifact)) ? viewport.artifact : undefined,
      screenshot: viewport.screenshot && existsSync(path.join(repoRoot, viewport.screenshot)) ? viewport.screenshot : undefined,
    })),
  }));
}

function readAccessibilityEvidenceManifest(routes: readonly CommercialVisualAcceptanceRoute[]): CommercialAccessibilityTextFitEvidence[] {
  const visualEvidence = readVisualEvidenceManifest();
  return routes.map((route) => {
    const routeEvidence = visualEvidence.find((entry) => entry.href === route.href);
    return {
      href: route.href,
      viewports: route.requiredWidths.map((width) => {
        const viewport = routeEvidence?.viewports.find((entry) => entry.width === width) as (
          | CommercialAccessibilityTextFitEvidence['viewports'][number]
          | undefined
        );
        return {
          width,
          contrastChecked: viewport?.contrastChecked,
          visibleFocus: viewport?.visibleFocus,
          keyboardReachable: viewport?.keyboardReachable,
          reducedMotionChecked: viewport?.reducedMotionChecked,
          buttonTextFits: viewport?.buttonTextFits,
          noMobileTextOverlap: viewport?.noMobileTextOverlap,
        };
      }),
    };
  });
}

const files = changedFiles();
const requiredVisualRoutes = affectedVisualRoutes(files);
const result = evaluateCommercialUiGovernance({
  mode: 'blocking',
  today,
  sourceViolations: buildSourceViolations(files),
  shellInventory: buildShellInventory(files),
  moduleChromeInventory: buildModuleChromeInventory(files),
  statusInventory: buildStatusInventory(files),
  navigationCoverage: buildNavigationCoverage(),
  visualEvidence: readVisualEvidenceManifest(),
  accessibilityEvidence: readAccessibilityEvidenceManifest(requiredVisualRoutes),
  requiredVisualRoutes,
});

assert.equal(
  result.passed,
  true,
  `commercial UI governance gate failed:\n${JSON.stringify(result.blockingViolations, null, 2)}`,
);

console.log(`test-commercial-ui-governance passed (${files.length} changed files scanned, ${today})`);
