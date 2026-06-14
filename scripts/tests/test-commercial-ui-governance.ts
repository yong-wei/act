import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX,
  DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES,
  PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX,
  SIMULATION_VISUAL_QA_ROUTE_MATRIX,
  evaluateCommercialUiGovernance,
  type CommercialAccessibilityTextFitEvidence,
  type CommercialVisualAcceptanceRoute,
  type CommercialModuleChromeInventoryEntry,
  type CommercialNavigationCoverageInput,
  type CommercialShellInventoryEntry,
  type CommercialStatusVocabularyInventoryEntry,
  type CommercialUiGovernanceViolation,
  type CommercialVisualAcceptanceEvidence,
  type CommercialSecondaryRouteGovernanceEntry,
} from '../../src/lib/commercial-ui-governance';
import {
  COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS,
  PLATFORM_PROFILE_AND_COCKPIT_ACTIONS,
  PLATFORM_PRIMARY_ROUTE_INVENTORY,
  PLATFORM_REPORT_SURFACE_INVENTORY,
  PLATFORM_ROUTE_COMPATIBILITY_REDIRECTS,
  resolvePlatformRouteInventory,
  STUDENT_CORE_ENTRY_IDS,
  STUDENT_LEARNING_INTENT_GROUPS,
} from '../../src/lib/platform-role-navigation';
import {
  assertRuntimeRelationStyleCoverage,
  getRelationLegendItems,
  getRelationSemantic,
  KNOWLEDGE_NODE_SCALE_CONTRACT,
} from '../../src/features/knowledge/graph/visual-config';
import { relationPassesActiveFilters } from '../../src/features/knowledge/graph/filter-utils';

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

function diffForFileWithContext(file: string, context: number) {
  return [
    git(['diff', `--unified=${context}`, '--', file]),
    git(['diff', '--cached', `--unified=${context}`, '--', file]),
    hasGitRef('origin/integration') ? git(['diff', `--unified=${context}`, 'origin/integration...HEAD', '--', file]) : '',
    !hasGitRef('origin/integration') && hasGitRef('HEAD^')
      ? git(['diff', `--unified=${context}`, 'HEAD^', 'HEAD', '--', file])
      : '',
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
        usesRegisteredShell: /<AppShell\b|<SimulationShell\b|data-commercial-(operations-)?workspace=|data-route-family=\{?learnerDataShell\.routeFamily\}?|data-route-family="learner-data-pathway"/.test(source),
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
  const matchesRouteFile = (file: string, routeFile: string) => file === routeFile || file.startsWith(`${path.dirname(routeFile)}/`);
  const matchesCoveredGlob = (file: string, coveredRouteGlob?: string) => {
    if (!coveredRouteGlob) return false;
    const pattern = new RegExp(`^${coveredRouteGlob
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]+')}$`);
    return pattern.test(file);
  };
  for (const file of files) {
    if (
      file === 'src/app/globals.css'
      || file === 'src/components/platform/app-shell.tsx'
      || file === 'src/lib/commercial-ui-governance.ts'
      || file === 'artifacts/commercial-ui/evidence.json'
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
    for (const route of PLATFORM_PRIMARY_ROUTE_INVENTORY) {
      if (matchesRouteFile(file, route.routeFile) || matchesCoveredGlob(file, route.coveredRouteGlob)) add(route.href);
    }
    for (const surface of PLATFORM_REPORT_SURFACE_INVENTORY) {
      if (file === surface.sourceFile) add(surface.ownerRoute);
    }
  }
  return [...routes.values()];
}

function appPageRouteHref(file: string) {
  if (!/^src\/app\/(?:.*\/)?page\.tsx$/.test(file)) return undefined;
  const route = file
    .replace(/^src\/app\/?/, '')
    .replace(/\/page\.tsx$/, '')
    .split('/')
    .filter((segment) => segment && !/^\(.+\)$/.test(segment))
    .join('/');
  const href = route ? `/${route}` : '/';
  if (isRegisteredRedirectOnlyCompatibilityPage(file, href)) return undefined;
  if (NON_PRIMARY_APP_PAGE_LEDGER_EXEMPTIONS.has(file)) return undefined;
  return href;
}

function isRegisteredRedirectOnlyCompatibilityPage(file: string, href: string) {
  const redirect = PLATFORM_ROUTE_COMPATIBILITY_REDIRECTS.find((entry) => entry.from === href);
  if (!redirect) return false;
  const source = readFileSync(path.join(repoRoot, file), 'utf8');
  return source.includes(`redirect('${redirect.to}')`) && !source.includes('return (');
}

function fileSha256(relativePath: string) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

function simulationViewportArtifact(pathname: string | undefined) {
  if (!pathname || !existsSync(path.join(repoRoot, pathname))) return undefined;
  const buffer = readFileSync(path.join(repoRoot, pathname));
  const isPng = buffer.length > 24
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47;
  return {
    pathname,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    width: isPng ? buffer.readUInt32BE(16) : undefined,
    height: isPng ? buffer.readUInt32BE(20) : undefined,
  };
}

function readVisualEvidenceManifest(): CommercialVisualAcceptanceEvidence[] {
  const manifestPath = path.join(repoRoot, 'artifacts/commercial-ui/evidence.json');
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { routes?: CommercialVisualAcceptanceEvidence[] };
  return (manifest.routes ?? []).map((route) => ({
    ...route,
    simulationVisualQa: route.simulationVisualQa
      ? {
          ...route.simulationVisualQa,
          viewports: route.simulationVisualQa.viewports.map((viewport) => {
            const artifact = simulationViewportArtifact(viewport.artifact);
            const screenshot = simulationViewportArtifact(viewport.screenshot);
            return {
              ...viewport,
              artifact: viewport.artifact,
              artifactSha256: artifact?.sha256,
              screenshot: viewport.screenshot,
              screenshotSha256: screenshot?.sha256,
              screenshotWidth: screenshot?.width,
              screenshotHeight: screenshot?.height,
            };
          }),
        }
      : undefined,
    viewports: route.viewports.map((viewport) => ({
      ...viewport,
      artifact: viewport.artifact && existsSync(path.join(repoRoot, viewport.artifact)) ? viewport.artifact : undefined,
      screenshot: viewport.screenshot && existsSync(path.join(repoRoot, viewport.screenshot)) ? viewport.screenshot : undefined,
    })),
  }));
}

function simulationSharedDetailRouteAffected(routeHref: string, files: readonly string[]) {
  if (!routeHref.startsWith('/simulations/')) return false;
  return files.some((file) => (
    file.startsWith('src/app/simulations/_components/')
    || file.startsWith('src/resources/simulations/')
    || file.startsWith('src/resources/control-system/')
    || file.startsWith('rust/control-engine/')
  ));
}

function simulationVisualQaEvidenceArtifactPaths(
  visualEvidence: readonly CommercialVisualAcceptanceEvidence[],
) {
  const paths = new Set<string>();
  for (const route of visualEvidence) {
    const simulationVisualQa = route.simulationVisualQa;
    if (!simulationVisualQa) continue;
    if (simulationVisualQa.reactDoctorErrorCheck?.report) {
      paths.add(simulationVisualQa.reactDoctorErrorCheck.report);
    }
    if (simulationVisualQa.handoffBaseline) {
      paths.add(simulationVisualQa.handoffBaseline.conceptImage);
      paths.add(simulationVisualQa.handoffBaseline.implementationScreenshot);
    }
    for (const viewport of simulationVisualQa.viewports) {
      if (viewport.screenshot) paths.add(viewport.screenshot);
      if (viewport.artifact) paths.add(viewport.artifact);
    }
  }
  return paths;
}

function requiresFullSimulationVisualQaMatrix(
  routes: readonly CommercialVisualAcceptanceRoute[],
  files: readonly string[],
  visualEvidence: readonly CommercialVisualAcceptanceEvidence[],
) {
  const referencedSimulationArtifacts = simulationVisualQaEvidenceArtifactPaths(visualEvidence);
  return routes.some((route) => route.href === '/simulations')
    || routes.some((route) => route.href.startsWith('/simulations/'))
    || files.some((file) => (
      file === 'src/app/simulations/page.tsx'
      || file === 'src/app/virtual-lab/page.tsx'
      || file === 'src/lib/platform-role-navigation.ts'
      || file === 'artifacts/commercial-ui/evidence.json'
      || file === 'artifacts/commercial-ui/simulation-experience-visual-qa/manifest.json'
      || file.startsWith('artifacts/commercial-ui/simulation-experience-visual-qa/')
      || /^src\/app\/simulations\/[^/]+\/page\.tsx$/.test(file)
      || file.startsWith('src/app/simulations/_components/')
      || file.startsWith('src/resources/simulations/')
      || file.startsWith('src/resources/control-system/')
      || file.startsWith('rust/control-engine/')
      || referencedSimulationArtifacts.has(file)
    ));
}

type JsonRecord = Record<string, unknown>;

const KNOWLEDGE_GRAPH_GOVERNANCE_EVIDENCE_PATH =
  'artifacts/commercial-ui/knowledge-graph-governance-462/evidence.json';

function readJsonFile<T>(relativePath: string): T | undefined {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return undefined;
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

function objectRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function readRuntimeKnowledgeRelationCounts() {
  const relationPath = path.join(repoRoot, 'course-content/runtime/knowledge/graph/relations.jsonl');
  const counts = new Map<string, number>();
  for (const line of readFileSync(relationPath, 'utf8').trim().split('\n').filter(Boolean)) {
    const row = JSON.parse(line) as { relation_type?: string; relationType?: string; relation?: string };
    const relationType = row.relation_type ?? row.relationType ?? row.relation ?? 'related';
    counts.set(relationType, (counts.get(relationType) ?? 0) + 1);
  }
  return counts;
}

function knowledgeGraphGovernanceViolation(message: string, evidence: string[]): CommercialUiGovernanceViolation {
  return {
    path: '/knowledge',
    rule: 'visual-acceptance.incomplete-evidence',
    message,
    evidence,
  };
}

function validateKnowledgeGraphGovernanceEvidence(): CommercialUiGovernanceViolation[] {
  const violations: CommercialUiGovernanceViolation[] = [];
  const evidence = readJsonFile<JsonRecord>(KNOWLEDGE_GRAPH_GOVERNANCE_EVIDENCE_PATH);
  const shellManifest = readJsonFile<{ viewports?: CommercialVisualAcceptanceEvidence['viewports'] }>(
    'artifacts/commercial-ui/knowledge-map-unified-shell-415/manifest.json',
  );
  const visualLanguage = readJsonFile<JsonRecord>(
    'artifacts/commercial-ui/knowledge-graph-visual-language-460/evidence.json',
  );
  const layoutClarity = readJsonFile<JsonRecord>(
    'artifacts/commercial-ui/knowledge-graph-layout-clarity-461/evidence.json',
  );
  const graphSource = existsSync(path.join(repoRoot, 'src/features/knowledge/knowledge-graph-system.tsx'))
    ? readFileSync(path.join(repoRoot, 'src/features/knowledge/knowledge-graph-system.tsx'), 'utf8')
    : '';
  const resourcePanelSource = existsSync(path.join(repoRoot, 'src/features/knowledge/resource-panel/resource-panel.tsx'))
    ? readFileSync(path.join(repoRoot, 'src/features/knowledge/resource-panel/resource-panel.tsx'), 'utf8')
    : '';

  if (!evidence) {
    return [knowledgeGraphGovernanceViolation('Knowledge graph governance evidence file is missing.', [
      KNOWLEDGE_GRAPH_GOVERNANCE_EVIDENCE_PATH,
    ])];
  }

  const localToolEvidence = objectRecord(evidence.localToolEvidence);
  const desktopDefault = objectRecord(localToolEvidence.desktopDefault);
  const desktopOpenClose = objectRecord(localToolEvidence.desktopOpenClose);
  const tabletDefault = objectRecord(localToolEvidence.tabletDefault);
  const mobileDefault = objectRecord(localToolEvidence.mobileDefault);
  const shellViewports = shellManifest?.viewports ?? [];
  const shellDesktop = shellViewports.find((viewport) => viewport.width === 1440);
  const shellMobile = shellViewports.find((viewport) => viewport.width === 320);
  const shellDesktopPanels = objectRecord(shellDesktop?.localPanelEvidence);
  const shellMobilePanels = objectRecord(shellMobile?.localPanelEvidence);
  const requiredDesktopPanels = [
    'chapterDirectory',
    'relationFilters',
    'chapterDirectoryOpenClosed',
    'relationFiltersOpenClosed',
    'activeFilterSummaryWhenCollapsed',
    'legend',
    'viewModeSwitch',
  ];
  const missingDesktopPanels = requiredDesktopPanels.filter((key) => shellDesktopPanels[key] !== true);
  const defaultStateProblems = [
    graphSource.includes('const [desktopChapterDirectoryOpen, setDesktopChapterDirectoryOpen] = useState(false);')
      ? null
      : 'desktopChapterDirectoryOpen:default-not-closed',
    graphSource.includes('const [desktopRelationFiltersOpen, setDesktopRelationFiltersOpen] = useState(false);')
      ? null
      : 'desktopRelationFiltersOpen:default-not-closed',
    graphSource.includes('const [isPanelOpen, setIsPanelOpen] = useState(Boolean(initialSelectedNode));')
      ? null
      : 'resourcePanel:not-closed-until-node-selection',
    graphSource.includes("data-state={desktopChapterDirectoryOpen ? 'open' : 'closed'}")
      ? null
      : 'chapterDirectory:data-state-missing',
    graphSource.includes("data-state={desktopRelationFiltersOpen ? 'open' : 'closed'}")
      ? null
      : 'relationFilters:data-state-missing',
  ].filter((entry): entry is string => Boolean(entry));
  const missingOpenCloseEvidence = [
    'chapterDirectoryOpenClosed',
    'relationFiltersOpenClosed',
    'legendOpenClosed',
    'viewModeSwitchOpenClosed',
    'resourcePanelOpenClosed',
    'selectedNodePreserved',
    'activeFiltersPreserved',
    'densityModePreserved',
    'legendStatePreserved',
    'visibleSummariesPreserved',
  ].filter((key) => desktopOpenClose[key] !== true);

  if (
    desktopDefault.canvasPrimary !== true
    || desktopDefault.chapterDirectory !== 'compact'
    || desktopDefault.relationFilters !== 'compact'
    || desktopDefault.legend !== 'compact'
    || desktopDefault.viewModeSwitch !== 'compact'
    || desktopDefault.resourcePanel !== 'closed-until-node-selection'
    || desktopDefault.activeFilterSummaryWhenCollapsed !== true
    || missingDesktopPanels.length > 0
    || defaultStateProblems.length > 0
    || missingOpenCloseEvidence.length > 0
  ) {
    violations.push(knowledgeGraphGovernanceViolation('Knowledge graph compact desktop tool evidence is incomplete.', [
      `missingShellPanels=${missingDesktopPanels.join(',') || 'none'}`,
      `defaultStateProblems=${defaultStateProblems.join(',') || 'none'}`,
      `missingOpenClose=${missingOpenCloseEvidence.join(',') || 'none'}`,
    ]));
  }

  if (
    tabletDefault.width !== 768
    || tabletDefault.behavior !== 'compact-or-drawer'
    || tabletDefault.canvasPrimary !== true
    || tabletDefault.noCanvasSqueeze !== true
    || !stringArray(tabletDefault.permanentPanelsForbidden).includes('resource-panel')
    || !graphSource.includes('data-knowledge-squeeze-down-rejected="permanent-panels-hidden-at-320"')
    || !graphSource.includes('data-knowledge-workspace="canvas-first"')
  ) {
    violations.push(knowledgeGraphGovernanceViolation('Knowledge graph tablet canvas-first evidence is incomplete.', [
      'tabletDefault',
      'data-knowledge-squeeze-down-rejected',
      'data-knowledge-workspace',
    ]));
  }

  if (
    mobileDefault.width !== 320
    || mobileDefault.behavior !== 'single-tool-panel'
    || mobileDefault.canvasPrimary !== true
    || mobileDefault.noPersistentSidebar !== true
    || mobileDefault.noPersistentFilter !== true
    || mobileDefault.noPersistentKnowledgeDrawer !== true
    || shellMobilePanels.mobileSingleToolPanel !== true
    || shellMobilePanels.mobileCommandSurface !== true
    || shellMobile?.noPersistentKnowledgeGraphDrawer !== true
  ) {
    violations.push(knowledgeGraphGovernanceViolation('Knowledge graph mobile local-tool evidence is incomplete.', [
      'mobileDefault',
      'mobileSingleToolPanel',
      'noPersistentKnowledgeGraphDrawer',
    ]));
  }

  if (
    !graphSource.includes('data-knowledge-local-tool="legend"')
    || !graphSource.includes('data-knowledge-local-tool="view-mode-switch"')
    || !resourcePanelSource.includes('data-knowledge-local-panel="resource-panel"')
  ) {
    violations.push(knowledgeGraphGovernanceViolation('Knowledge graph local tool DOM contracts are incomplete.', [
      'legend',
      'view-mode-switch',
      'resource-panel',
    ]));
  }

  const runtimeRelationCounts = readRuntimeKnowledgeRelationCounts();
  const relationEvidence = objectRecord(evidence.runtimeRelationEvidence);
  const evidenceTypes = new Set(
    (Array.isArray(relationEvidence.types) ? relationEvidence.types : [])
      .map((entry) => objectRecord(entry))
      .map((entry) => (typeof entry.type === 'string' ? entry.type : undefined))
      .filter((type): type is string => Boolean(type)),
  );
  const visualLegend = (Array.isArray(visualLanguage?.relationLegend) ? visualLanguage?.relationLegend : [])
    .map((entry) => objectRecord(entry));
  const legendByType = new Map(
    visualLegend
      .filter((entry): entry is {
        type: string;
        label: string;
        visualFamily: string;
        direction: string;
        density: string;
        legendExplanation: string;
        hasNonColorEncoding: boolean;
      } => (
        typeof entry.type === 'string'
        && typeof entry.label === 'string'
        && typeof entry.visualFamily === 'string'
        && typeof entry.direction === 'string'
        && typeof entry.density === 'string'
        && typeof entry.legendExplanation === 'string'
        && typeof entry.hasNonColorEncoding === 'boolean'
      ))
      .map((entry) => [entry.type, entry] as const),
  );
  const runtimeRelationTypes = [...runtimeRelationCounts.keys()].sort();
  const currentCoverageGaps = assertRuntimeRelationStyleCoverage(runtimeRelationTypes);
  const currentLegendByType = new Map(getRelationLegendItems().map((item) => [item.type, item]));
  const missingRelationEvidence: string[] = [];
  for (const type of runtimeRelationTypes) {
    if (!evidenceTypes.has(type)) missingRelationEvidence.push(`${type}:evidence-sample`);
    const currentLegend = currentLegendByType.get(type);
    if (!currentLegend) missingRelationEvidence.push(`${type}:current-legend`);
    const evidenceLegend = legendByType.get(type);
    if (!evidenceLegend) missingRelationEvidence.push(`${type}:screenshot-legend`);
    try {
      const semantic = getRelationSemantic(type);
      if (!/[\u4e00-\u9fff]/.test(semantic.label)) missingRelationEvidence.push(`${type}:localized-label`);
      if (!semantic.visualFamily) missingRelationEvidence.push(`${type}:visual-family`);
      if (!/^(directed|undirected|bidirectional)$/.test(semantic.direction)) missingRelationEvidence.push(`${type}:direction`);
      if (!/^(structure|context|optional|weak)$/.test(semantic.density)) missingRelationEvidence.push(`${type}:density`);
      if (!/[\u4e00-\u9fff]/.test(semantic.legendExplanation)) missingRelationEvidence.push(`${type}:legend-explanation`);
    } catch {
      missingRelationEvidence.push(`${type}:current-semantic`);
    }
    if (currentLegend?.sampleStyle.dash.length === 0 && currentLegend.sampleStyle.hasArrow === false && currentLegend.sampleStyle.endpoint === 'none') {
      missingRelationEvidence.push(`${type}:text-or-color-only-encoding`);
    }
    if (evidenceLegend?.hasNonColorEncoding !== true) missingRelationEvidence.push(`${type}:non-color-encoding`);
  }
  const requiredRelationSamples = [
    'cross_domain',
    'generalizes',
    'instance_of',
    'supports',
    'enables',
    'complements',
    'contrasts_with',
    'derives',
    'determines',
    'quantified_by',
    'uses',
    'visualized_by',
    'opposite',
    'related',
  ];
  const missingSamples = requiredRelationSamples.filter((type) => (
    runtimeRelationCounts.has(type)
    && !stringArray(relationEvidence.commonSamples).includes(type)
    && !stringArray(relationEvidence.lowFrequencySamples).includes(type)
  ));
  if (currentCoverageGaps.length > 0 || missingRelationEvidence.length > 0 || missingSamples.length > 0) {
    violations.push(knowledgeGraphGovernanceViolation('Knowledge graph runtime relation coverage evidence is incomplete.', [
      `currentCoverageGaps=${currentCoverageGaps.join(',') || 'none'}`,
      `missingRelationEvidence=${missingRelationEvidence.join(',') || 'none'}`,
      `missingSamples=${missingSamples.join(',') || 'none'}`,
    ]));
  }

  const visualAssertions = objectRecord(visualLanguage?.assertions);
  const missingVisualAssertions = [
    'allScreenshotsHaveCanvas',
    'allScreenshotsHaveGraphicalLegend',
    'labelsAreLocalized',
    'rawSchemaLabelsHidden',
    'specializedRelationsVisibleInLegend',
    'threeDimensionalSpecialRelationsEncoded',
  ].filter((key) => visualAssertions[key] !== true);
  const clarityAssertions = objectRecord(layoutClarity?.assertions);
  const graphClarityEvidence = objectRecord(evidence.graphClarityEvidence);
  const missingClarityAssertions = [
    'defaultHasClaritySummary',
    'focusedHasNeighborhoodMetric',
    'selectedNodeContextPreserved',
    'allRelationsIsExplicit',
    'allRelationsIncludesWeakEdges',
    'canvasRendered',
  ].filter((key) => clarityAssertions[key] !== true);
  const missingClarityEvidence = [
    'defaultHighSignal',
    'selectedNodeFocused',
    'allRelationsDenseExplicit',
    'allRelationsIncludesWeakEdges',
    'selectedNodeContextPreserved',
    'canvasRendered',
  ].filter((key) => graphClarityEvidence[key] !== true);
  const currentClarityProblems = [
    KNOWLEDGE_NODE_SCALE_CONTRACT.minRadius >= 4 ? null : 'node-scale:min-radius',
    KNOWLEDGE_NODE_SCALE_CONTRACT.maxRadius <= 12 ? null : 'node-scale:max-radius',
    relationPassesActiveFilters({
      sourceId: 'a',
      targetId: 'b',
      relation: 'related',
      relationType: 'related',
      strength: 0.2,
    }, {
      densityMode: 'all',
      selectedRelationTypes: [],
      minRelationStrength: 0.8,
    })
      ? null
      : 'all-relations:does-not-bypass-type-strength-filters',
  ].filter((entry): entry is string => Boolean(entry));
  if (
    missingVisualAssertions.length > 0
    || missingClarityAssertions.length > 0
    || missingClarityEvidence.length > 0
    || currentClarityProblems.length > 0
  ) {
    violations.push(knowledgeGraphGovernanceViolation('Knowledge graph visual grammar or clarity evidence is incomplete.', [
      `visual=${missingVisualAssertions.join(',') || 'none'}`,
      `clarity=${missingClarityAssertions.join(',') || 'none'}`,
      `governance=${missingClarityEvidence.join(',') || 'none'}`,
      `currentImplementation=${currentClarityProblems.join(',') || 'none'}`,
    ]));
  }

  const scopeProtection = objectRecord(evidence.scopeProtection);
  const coveredRoutes = stringArray(scopeProtection.coveredRoutes);
  const excludedRouteFamilies = stringArray(scopeProtection.excludedRouteFamilies);
  if (
    coveredRoutes.length !== 1
    || coveredRoutes[0] !== '/knowledge'
    || !excludedRouteFamilies.includes('simulation')
    || !excludedRouteFamilies.includes('interactive-learning-descendant')
    || !excludedRouteFamilies.includes('teacher')
    || !excludedRouteFamilies.includes('admin')
    || scopeProtection.doesNotRequireSimulationRouteMigration !== true
    || scopeProtection.doesNotRequireInteractiveDescendantMigration !== true
    || scopeProtection.doesNotRequireTeacherAdminMigration !== true
  ) {
    violations.push(knowledgeGraphGovernanceViolation('Knowledge graph governance scope protection is incomplete.', [
      `coveredRoutes=${coveredRoutes.join(',') || 'none'}`,
      `excludedRouteFamilies=${excludedRouteFamilies.join(',') || 'none'}`,
    ]));
  }

  return violations;
}

export function buildSecondaryRouteGovernanceMatrixFromEvidence(
  visualEvidence: readonly CommercialVisualAcceptanceEvidence[],
): CommercialSecondaryRouteGovernanceEntry[] {
  return DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.flatMap((expected) => {
    const routeEvidence = visualEvidence.find((entry) => entry.href === expected.href);
    const manifestEntries = routeEvidence?.secondaryRouteGovernance?.filter((entry) => entry.role === expected.role) ?? [];
    return manifestEntries;
  });
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
const visualEvidence = readVisualEvidenceManifest();
function changedPrimaryRouteInventoryHrefs() {
  const hrefs = new Set<string>();
  let blockChanged = false;
  let blockHref: string | undefined;
  let inPrimaryRouteBlock = false;

  const finishBlock = () => {
    if (blockChanged && blockHref) hrefs.add(blockHref);
    blockChanged = false;
    blockHref = undefined;
    inPrimaryRouteBlock = false;
  };

  for (const line of diffForFileWithContext('src/lib/platform-role-navigation.ts', 100000).split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (!/^[ +-]/.test(line)) {
      if (inPrimaryRouteBlock) finishBlock();
      continue;
    }

    const marker = line[0];
    const content = line.slice(1);
    if (content.includes('primaryRoute({')) {
      if (inPrimaryRouteBlock) finishBlock();
      inPrimaryRouteBlock = true;
      blockChanged = marker !== ' ';
      continue;
    }
    if (!inPrimaryRouteBlock) continue;
    if (marker !== ' ') blockChanged = true;
    const href = /href:\s*'([^']+)'/.exec(content)?.[1];
    if (href && marker !== '-') blockHref = href;
    if (href && !blockHref) blockHref = href;
    if (/^\s*}\),/.test(content)) finishBlock();
  }
  if (inPrimaryRouteBlock) finishBlock();
  return hrefs;
}
const changedPrimaryRouteHrefs = changedPrimaryRouteInventoryHrefs();
const currentPrimaryRouteHrefs = new Set(PLATFORM_PRIMARY_ROUTE_INVENTORY.map((route) => route.href));
const NON_PRIMARY_APP_PAGE_LEDGER_EXEMPTIONS = new Map<string, string>([
  [
    'src/app/(main)/teacher/students/[studentId]/diagnosis/page.tsx',
    'redirect-only compatibility route; teacher diagnosis is covered by registered teacher student surfaces',
  ],
  [
    'src/app/(main)/teacher/students/[studentId]/evidence/page.tsx',
    'redirect-only compatibility route; teacher evidence is covered by registered teacher student surfaces',
  ],
  [
    'src/app/interactive-learning/lessons/[lessonId]/handout-print/page.tsx',
    'lesson handout print is an export view launched from registered interactive learning routes',
  ],
  [
    'src/app/review/adaptive-assessment-figures/page.tsx',
    'adaptive assessment figures is an internal review preview launched from the review hub',
  ],
]);
const missingChangedPrimaryRouteLedgerViolations: CommercialUiGovernanceViolation[] = [...changedPrimaryRouteHrefs]
  .filter((href) => !currentPrimaryRouteHrefs.has(href))
  .map((href) => ({
    path: href,
    rule: 'route-ledger.incomplete-primary-route',
    message: 'Changed primary route inventory href no longer resolves to a current route ledger entry.',
    evidence: ['missing-current-inventory-entry'],
  }));
const missingChangedAppPageLedgerViolations: CommercialUiGovernanceViolation[] = files
  .map(appPageRouteHref)
  .filter((href): href is string => Boolean(href))
  .filter((href) => !currentPrimaryRouteHrefs.has(href))
  .map((href) => ({
    path: href,
    rule: 'route-ledger.incomplete-primary-route',
    message: 'Changed app page route is missing a primary route ledger entry.',
    evidence: ['missing-primary-route-inventory-entry'],
  }));
const routeLedgerHelperChanged = files.includes('src/lib/platform-role-navigation.ts');
const routeInventoryForGate = routeLedgerHelperChanged
  ? PLATFORM_PRIMARY_ROUTE_INVENTORY
  : PLATFORM_PRIMARY_ROUTE_INVENTORY.filter((route) => (
    requiredVisualRoutes.some((visualRoute) => visualRoute.href === route.href)
    || changedPrimaryRouteHrefs.has(route.href)
  ));
const visualRouteInventoryForGate = PLATFORM_PRIMARY_ROUTE_INVENTORY.filter((route) => (
  requiredVisualRoutes.some((visualRoute) => resolvePlatformRouteInventory(visualRoute.href)?.href === route.href)
));
const simulationVisualQaMatrix = requiresFullSimulationVisualQaMatrix(requiredVisualRoutes, files, visualEvidence)
  ? SIMULATION_VISUAL_QA_ROUTE_MATRIX
  : SIMULATION_VISUAL_QA_ROUTE_MATRIX.filter((route) => (
    requiredVisualRoutes.some((visualRoute) => visualRoute.href === route.href)
    || files.some((file) => file === route.routeFile || file.startsWith(`${path.dirname(route.routeFile)}/`))
    || simulationSharedDetailRouteAffected(route.href, files)
  ));
const result = evaluateCommercialUiGovernance({
  mode: 'blocking',
  today,
  sourceViolations: [
    ...buildSourceViolations(files),
    ...missingChangedPrimaryRouteLedgerViolations,
    ...missingChangedAppPageLedgerViolations,
    ...validateKnowledgeGraphGovernanceEvidence(),
  ],
  shellInventory: buildShellInventory(files),
  moduleChromeInventory: buildModuleChromeInventory(files),
  statusInventory: buildStatusInventory(files),
  navigationCoverage: buildNavigationCoverage(),
  visualEvidence,
  accessibilityEvidence: readAccessibilityEvidenceManifest(requiredVisualRoutes),
  requiredVisualRoutes,
  routeInventory: routeInventoryForGate,
  visualRouteInventory: visualRouteInventoryForGate,
  secondaryRouteGovernanceMatrix: buildSecondaryRouteGovernanceMatrixFromEvidence(visualEvidence),
  premiumVisualQaMatrix: PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX.filter((route) => (
    requiredVisualRoutes.some((visualRoute) => visualRoute.href === route.href)
  )),
  simulationVisualQaMatrix,
  reportSurfaceInventory: PLATFORM_REPORT_SURFACE_INVENTORY.filter((surface) => (
    requiredVisualRoutes.some((visualRoute) => visualRoute.href === surface.ownerRoute)
  )),
});

assert.equal(
  result.passed,
  true,
  `commercial UI governance gate failed:\n${JSON.stringify(result.blockingViolations, null, 2)}`,
);

console.log(`test-commercial-ui-governance passed (${files.length} changed files scanned, ${today})`);
