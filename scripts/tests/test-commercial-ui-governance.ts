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
  type CommercialAdaptivePathProductQaEvidence,
  type CommercialInteractiveVisualAcceptanceArtifact,
  type CommercialVisualAcceptanceRoute,
  type CommercialInteractiveLearningProductQaEvidence,
  type CommercialCompactSpacingInventoryEntry,
  type CommercialCompactSpacingViewportEvidence,
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
  getKnowledgeGraphEffectiveEdgeOpacity,
  getKnowledgeGraphEffectiveEdgeWidth,
  getKnowledgeSemanticRegionStyle,
  getRelationStyle,
  getRelationLegendItems,
  getRelationSemantic,
  getRelationThreeDimensionalEncoding,
  KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT,
  KNOWLEDGE_NODE_SCALE_CONTRACT,
} from '../../src/features/knowledge/graph/visual-config';
import { relationPassesActiveFilters } from '../../src/features/knowledge/graph/filter-utils';

const repoRoot = path.resolve(__dirname, '../..');
const today = new Date().toISOString().slice(0, 10);
const allowedModuleNamespaces = new Set(['activity', 'analytics', 'compute', 'content', 'layout', 'visual']);
const COMPACT_SPACING_INVENTORY_PATH = 'artifacts/commercial-ui/compact-spacing-685/inventory.json';
const COMPACT_SPACING_EVIDENCE_PATH = 'artifacts/commercial-ui/compact-spacing-685/evidence.json';
const COMPACT_SPACING_SOURCE_PATHS = [
  'src/components/platform/app-shell.tsx',
  'src/app/globals.css',
  'src/features/interactive/shared/lesson-runtime-shell.tsx',
  'src/features/interactive/shared/course-entry-shell.tsx',
  'src/features/interactive/shared/premium-lesson-entry-page.tsx',
  'src/lib/commercial-ui-governance.ts',
  'scripts/tests/test-commercial-ui-governance.ts',
];

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

function isAncestorCommit(ancestor: string, descendant: string) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function isAncestorCommitAtRepository(repositoryRoot: string, ancestor: string, descendant: string) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: repositoryRoot,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function gitBlobSha256AtRevision(repositoryRoot: string, revision: string, file: string) {
  try {
    const entry = execFileSync('git', ['ls-tree', '-z', revision, '--', file], {
      cwd: repositoryRoot,
      encoding: null,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const nulIndex = entry.indexOf(0);
    const tabIndex = entry.indexOf(9);
    if (nulIndex !== entry.length - 1 || tabIndex < 0) return undefined;
    const metadata = entry.subarray(0, tabIndex).toString('ascii').split(' ');
    const entryPath = entry.subarray(tabIndex + 1, nulIndex).toString('utf8');
    const [, objectType, objectSha] = metadata;
    if (objectType !== 'blob' || !/^[0-9a-f]{40}$/.test(objectSha ?? '') || entryPath !== file) {
      return undefined;
    }
    const blob = execFileSync('git', ['cat-file', 'blob', objectSha], {
      cwd: repositoryRoot,
      encoding: null,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return createHash('sha256').update(blob).digest('hex');
  } catch {
    return undefined;
  }
}

export function knowledgeWorkspaceProductQaCaptureRevisionProblems({
  repositoryRoot,
  captureCommitSha,
  captureTreeSha,
  currentSourceSha256,
  productQaSourcePaths,
}: {
  repositoryRoot: string;
  captureCommitSha: string;
  captureTreeSha: string;
  currentSourceSha256: Record<string, string>;
  productQaSourcePaths: readonly string[];
}) {
  const gitAtRepository = (args: string[]) => {
    try {
      return {
        ok: true as const,
        output: execFileSync('git', args, {
          cwd: repositoryRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      };
    } catch {
      return { ok: false as const, output: '' };
    }
  };
  const fullGitShaPattern = /^[0-9a-f]{40}$/;
  const captureCommitResult = fullGitShaPattern.test(captureCommitSha)
    ? gitAtRepository(['rev-parse', '--verify', `${captureCommitSha}^{commit}`])
    : { ok: false as const, output: '' };
  const captureTreeResult = fullGitShaPattern.test(captureTreeSha)
    ? gitAtRepository(['rev-parse', '--verify', `${captureTreeSha}^{tree}`])
    : { ok: false as const, output: '' };
  const captureCommitTreeResult = captureCommitResult.ok
    ? gitAtRepository(['rev-parse', '--verify', `${captureCommitSha}^{tree}`])
    : { ok: false as const, output: '' };
  const currentHeadResult = gitAtRepository(['rev-parse', '--verify', 'HEAD^{commit}']);
  const captureCommitValid = captureCommitResult.ok
    && captureCommitResult.output.trim() === captureCommitSha;
  const captureTreeValid = captureTreeResult.ok
    && captureTreeResult.output.trim() === captureTreeSha;
  const captureTreeMatchesCommit = captureCommitTreeResult.ok
    && captureCommitTreeResult.output.trim() === captureTreeSha;
  const currentHeadSha = currentHeadResult.output.trim();
  const captureIsCurrentHeadAncestor = captureCommitValid
    && currentHeadResult.ok
    && isAncestorCommitAtRepository(repositoryRoot, captureCommitSha, currentHeadSha);
  const productQaSourceHistoryResult = captureIsCurrentHeadAncestor
    ? gitAtRepository([
      'log',
      '--format=',
      '--name-only',
      '--full-history',
      `${captureCommitSha}..${currentHeadSha}`,
      '--',
      ...productQaSourcePaths,
    ])
    : { ok: false as const, output: '' };
  const productQaSourceChanges = productQaSourceHistoryResult.ok
    ? lines(productQaSourceHistoryResult.output)
    : [];
  const syntheticSourceProblems = captureCommitValid
    && captureTreeValid
    && captureTreeMatchesCommit
    && currentHeadResult.ok
    && !captureIsCurrentHeadAncestor
    ? productQaSourcePaths.flatMap((sourcePath) => {
      const captureBlobSha256 = gitBlobSha256AtRevision(repositoryRoot, captureTreeSha, sourcePath);
      const headBlobSha256 = gitBlobSha256AtRevision(repositoryRoot, currentHeadSha, sourcePath);
      const evidenceSha256 = currentSourceSha256[sourcePath];
      const workingTreePath = path.join(repositoryRoot, sourcePath);
      const workingTreeSha256 = existsSync(workingTreePath)
        ? createHash('sha256').update(readFileSync(workingTreePath)).digest('hex')
        : undefined;
      return [
        captureBlobSha256 ? null : `capture-revision:synthetic-capture-blob-missing:${sourcePath}`,
        headBlobSha256 ? null : `capture-revision:synthetic-head-blob-missing:${sourcePath}`,
        evidenceSha256 ? null : `capture-revision:synthetic-evidence-sha-missing:${sourcePath}`,
        workingTreeSha256 ? null : `capture-revision:synthetic-working-tree-source-missing:${sourcePath}`,
        captureBlobSha256 && evidenceSha256 && captureBlobSha256 !== evidenceSha256
          ? `capture-revision:synthetic-capture-evidence-mismatch:${sourcePath}`
          : null,
        evidenceSha256 && headBlobSha256 && evidenceSha256 !== headBlobSha256
          ? `capture-revision:synthetic-evidence-head-mismatch:${sourcePath}`
          : null,
        headBlobSha256 && workingTreeSha256 && headBlobSha256 !== workingTreeSha256
          ? `capture-revision:synthetic-head-working-tree-mismatch:${sourcePath}`
          : null,
      ].filter((entry): entry is string => Boolean(entry));
    })
    : [];

  return [
    captureCommitSha ? null : 'capture-revision:commit-missing',
    captureCommitSha && !fullGitShaPattern.test(captureCommitSha)
      ? 'capture-revision:commit-not-full-sha'
      : null,
    captureCommitSha && fullGitShaPattern.test(captureCommitSha) && !captureCommitValid
      ? 'capture-revision:commit-invalid'
      : null,
    captureTreeSha ? null : 'capture-revision:tree-missing',
    captureTreeSha && !fullGitShaPattern.test(captureTreeSha)
      ? 'capture-revision:tree-not-full-sha'
      : null,
    captureTreeSha && fullGitShaPattern.test(captureTreeSha) && !captureTreeValid
      ? 'capture-revision:tree-invalid'
      : null,
    captureCommitValid && captureTreeValid && !captureTreeMatchesCommit
      ? 'capture-revision:tree-mismatch'
      : null,
    captureCommitValid && !currentHeadResult.ok
      ? 'capture-revision:current-head-invalid'
      : null,
    captureIsCurrentHeadAncestor && !productQaSourceHistoryResult.ok
      ? 'capture-revision:source-history-failed'
      : null,
    ...productQaSourceChanges.map((sourcePath) => `capture-revision:source-changed:${sourcePath}`),
    ...syntheticSourceProblems,
  ].filter((entry): entry is string => Boolean(entry));
}

function latestCommitForPath(file: string) {
  return git(['log', '-1', '--format=%H', '--', file]).trim();
}

function hasUncommittedPathChange(file: string) {
  return diffNameStatus(['--', file]).includes(file)
    || diffNameStatus(['--cached', '--', file]).includes(file)
    || lines(git(['ls-files', '--others', '--exclude-standard', '--', file])).includes(file);
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
    for (const file of lines(git(['show', '--format=', '--name-only', 'HEAD']))) candidates.add(file);
  }
  if (candidates.size === 0 && hasGitRef('HEAD^')) {
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
    && file !== 'src/app/textbook-citations/[...targetPath]/page.tsx'
    && file !== 'src/components/shared/runtime-markdown.tsx'
  ));
}

function simulationResourceFilesForTokenGate(files: string[]) {
  const simulationFiles = files.filter((file) => (
    /^src\/resources\/simulations\//.test(file)
    && /\.(css|tsx?)$/.test(file)
    && file !== 'src/resources/simulations/components/simulation-theme.ts'
    && existsSync(path.join(repoRoot, file))
    && !/(__tests__|\.test\.|\.spec\.)/.test(file)
  ));
  if (files.some((file) => /^src\/resources\/simulations\/simulations\/[^/]+-simulation\.tsx$/.test(file))) {
    simulationFiles.push(
      'src/resources/simulations/components/camera-view-switcher.tsx',
      'src/resources/simulations/components/model-loading-placeholder.tsx',
    );
  }
  return [...new Set(simulationFiles)];
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

function usesReusableAccessibilityIdScope(file: string) {
  return file.startsWith('src/components/classroom/');
}

function normalizeAccessibilityOnlyLine(line: string, file: string, side: 'added' | 'deleted') {
  const allowStringControlAttributes = side === 'deleted' || !usesReusableAccessibilityIdScope(file);
  let normalized = line
    .trim()
    .replace(/^<p\b/, '<label')
    .replace(/<\/p>$/, '</label>')
    .replace(/\s+type="[^"]*"/g, '')
    .replace(/\s+(?:htmlFor|id|aria-label|aria-labelledby|title)=\{[^>]*?\}(?=\s|>)/g, '');

  if (allowStringControlAttributes) {
    normalized = normalized.replace(/\s+(?:htmlFor|id|aria-label|aria-labelledby|title)="[^"]*"/g, '');
  }

  return normalized
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*>$/, '>')
}

function accessibilityOnlyDeletedLineSet(file: string) {
  return new Set(diffDeletedLines(file).map((line) => normalizeAccessibilityOnlyLine(line, file, 'deleted')));
}

function isAccessibilityOnlyAddedLine(file: string, line: string) {
  const trimmed = line.trim();
  const stringControlAttributePattern = usesReusableAccessibilityIdScope(file)
    ? /$^/
    : /\b(?:htmlFor|id|aria-label|aria-labelledby|title)="[^"]*"/;
  if (!/(?:\btype="(?:button|submit)"|\b(?:htmlFor|id|aria-label|aria-labelledby|title)=\{|^<p\b)/.test(trimmed)
    && !stringControlAttributePattern.test(trimmed)) {
    return false;
  }
  return accessibilityOnlyDeletedLineSet(file).has(normalizeAccessibilityOnlyLine(line, file, 'added'));
}

function meaningfulAddedLines(file: string) {
  const deletedTrimmedLines = new Set(diffDeletedLines(file).map((line) => line.trim()));
  return diffAddedLines(file).filter((line) => (
    !deletedTrimmedLines.has(line.trim())
    && !isAccessibilityOnlyAddedLine(file, line)
  ));
}

function hasNonAccessibilityOnlyDiff(file: string) {
  if (meaningfulAddedLines(file).length > 0) return true;
  const normalizedAddedLines = new Set(
    diffAddedLines(file).map((line) => normalizeAccessibilityOnlyLine(line, file, 'added')),
  );
  return diffDeletedLines(file).some((line) => !normalizedAddedLines.has(
    normalizeAccessibilityOnlyLine(line, file, 'deleted'),
  ));
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
    meaningfulAddedLines(file),
    /<AppShell\b|data-commercial-(operations-)?workspace=|<main\b|<section\b|<div\b|className=/,
  ) || someLineMatches(
    diffDeletedLines(file),
    /<AppShell\b|data-commercial-(operations-)?workspace=/,
  );
}

function lineEvidence(source: string, pattern: RegExp, label: string, file?: string) {
  const addedLineSet = file ? new Set(meaningfulAddedLines(file).map((line) => line.trim())) : null;
  const evidence = new Set<string>();
  source.split('\n').forEach((line, index) => {
    if (addedLineSet && !addedLineSet.has(line.trim())) return;
    if (pattern.test(line)) evidence.add(`${label}:L${index + 1}:${line.trim().slice(0, 140)}`);
    pattern.lastIndex = 0;
  });
  return [...evidence];
}

function fullSourceLineEvidence(source: string, pattern: RegExp, label: string) {
  const evidence = new Set<string>();
  source.split('\n').forEach((line, index) => {
    if (pattern.test(line)) evidence.add(`${label}:L${index + 1}:${line.trim().slice(0, 140)}`);
    pattern.lastIndex = 0;
  });
  return [...evidence];
}

function compactSpacingInventoryEntries() {
  return readCompactSpacingInventory() ?? [];
}

function compactSpacingPathPatternMatches(pattern: string, file: string) {
  const escaped = pattern
    .split('**').map((part) => part
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*'))
    .join('.*');
  return new RegExp(`^${escaped}$`).test(file);
}

function isCompactSpacingExceptionPath(file: string) {
  return compactSpacingInventoryEntries().some((entry) => (
    (entry.classification === 'component-intrinsic-exception' || entry.classification === 'temporary-exception')
    && entry.path.split(',').map((item) => item.trim()).some((pattern) => (
      pattern.length > 0 && compactSpacingPathPatternMatches(pattern, file)
    ))
  ));
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
    const compactSpacingEvidence = fullSourceLineEvidence(
      source,
      /\b(?:mx-auto\s+(?:\S+\s+){0,6}?max-w-(?:\[[^\]]+\]|\w+)|max-w-(?:\[[^\]]+\]|\w+)(?:\s+\S+){0,6}?\s+mx-auto|container\s+mx-auto|premium-lesson-main\s+mx-auto\s+max-w-\[[^\]]+\])/g,
      'centered-page-wrapper',
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
    if (compactSpacingEvidence.length > 0 && !isCompactSpacingExceptionPath(file)) {
      violations.push({
        path: file,
        rule: 'compact-spacing.unregistered-page-wrapper',
        message: 'Page-level centered maximum-width wrapper is not registered in the compact spacing inventory.',
        evidence: compactSpacingEvidence,
      });
    }
    return violations;
  });
}

function buildSimulationResourcePaletteViolations(files: string[]): CommercialUiGovernanceViolation[] {
  return simulationResourceFilesForTokenGate(files).flatMap((file) => {
    const source = readFileSync(path.join(repoRoot, file), 'utf8');
    const rawPaletteEvidence = lineEvidence(source, /#[0-9a-fA-F]{3,8}\b/g, 'raw-color');
    const rawRgbaEvidence = lineEvidence(source, /\brgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,/g, 'raw-rgba');
    const tailwindColorEvidence = lineEvidence(
      source,
      /\b(?:bg|text|border|shadow|ring|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?(?:\/\d{1,3})?\b/g,
      'tailwind-color-family',
    );
    if (rawPaletteEvidence.length === 0 && rawRgbaEvidence.length === 0 && tailwindColorEvidence.length === 0) {
      return [];
    }
    return [{
      path: file,
      rule: 'token.page-local-palette',
      message: 'Changed simulation resource source contains raw palette literals outside the shared simulation theme contract.',
      evidence: [...rawPaletteEvidence, ...rawRgbaEvidence, ...tailwindColorEvidence],
    }];
  });
}

function buildShellInventory(files: string[]): CommercialShellInventoryEntry[] {
  return files
    .filter((file) => /^src\/app\/(?:.*\/)?(page|layout)\.tsx$/.test(file))
    .filter((file) => existsSync(path.join(repoRoot, file)))
    .filter((file) => !/(loading|handout-print|review|api)\.tsx$/.test(file))
    .filter((file) => !NON_PRIMARY_APP_PAGE_LEDGER_EXEMPTIONS.has(file))
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
    'src/app/textbook-citations/[...targetPath]/page.tsx',
    'textbook citation reader is a source-inspection view launched from registered runtime citations',
  ],
  [
    'src/app/textbooks/[bookId]/[edition]/[...unitPath]/page.tsx',
    'standalone textbook reader uses the registered /textbooks/** embed-surface exception with dedicated hierarchy, breadcrumb, and reading workspace instead of an AppShell primary route',
  ],
  [
    'src/app/@textbookModal/(.)textbooks/[bookId]/[edition]/[...unitPath]/page.tsx',
    'intercepted textbook reader is a parallel-slot overlay covered by the registered /@textbookModal/** embed-surface exception above the originating shell-covered page',
  ],
  [
    'src/app/@textbookModal/[...catchAll]/page.tsx',
    'textbook parallel-slot fallback belongs to the registered /@textbookModal/** embed-surface exception and does not define an AppShell primary route',
  ],
  [
    'src/app/review/unified-textbook-reader/page.tsx',
    'unified textbook reader review is an isolated internal visual QA surface covered by the registered /review/** visual-review-only exception',
  ],
  [
    'src/app/review/adaptive-assessment-figures/page.tsx',
    'adaptive assessment figures is an internal review preview launched from the review hub',
  ],
  [
    'src/app/review/control-workbench-reuse-560/page.tsx',
    'issue 560 control workbench reuse is an internal visual acceptance surface launched from the review hub',
  ],
  [
    'src/app/review/visual-stage-runtime-561/page.tsx',
    'issue 561 visual stage runtime is an internal visual acceptance surface launched from the review hub',
  ],
  [
    'src/app/review/derivation-stage-runtime-562/page.tsx',
    'issue 562 derivation stage runtime is an internal visual acceptance surface launched from the review hub',
  ],
  [
    'src/app/review/structure-diagram-runtime-563/page.tsx',
    'issue 563 structure diagram runtime is an internal visual acceptance surface launched from the review hub',
  ],
  [
    'src/app/review/annotated-media-activity-564/page.tsx',
    'issue 564 annotated media activity is an internal visual acceptance surface launched from the review hub',
  ],
  [
    'src/app/review/generated-slide-runtime-938/[projection]/page.tsx',
    'issue 938 generated slide runtime is an authenticated internal validation surface, not a primary product route',
  ],
  [
    'src/app/review/pid-turn-calibration-1039/page.tsx',
    'issue 1039 PID turn calibration is an environment-gated internal evidence surface, not a primary product route',
  ],
]);

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
  if (
    isDynamicAppRouteFile(file)
    && PLATFORM_PRIMARY_ROUTE_INVENTORY.some((entry) => matchesCoveredRouteFile(file, entry.coveredRouteGlob))
  ) {
    return undefined;
  }
  return href;
}

function isDynamicAppRouteFile(file: string) {
  return file.split('/').some((segment) => /^\[\[?\.{0,3}[^/\\\]]+\]\]?$/.test(segment));
}

function matchesCoveredRouteFile(file: string, coveredRouteGlob?: string) {
  if (!coveredRouteGlob) return false;
  const pattern = new RegExp(`^${coveredRouteGlob
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]+')}$`);
  return pattern.test(file);
}

function assertCoveredRouteGlobDoesNotHideStaticPages() {
  const staticSiblingHref = appPageRouteHref('src/app/interactive-learning/chapter-components/new/page.tsx');
  if (staticSiblingHref !== '/interactive-learning/chapter-components/new') {
    throw new Error('coveredRouteGlob must not exempt newly added static App Router pages from route ledger registration');
  }
  if (!matchesCoveredRouteFile(
    'src/app/interactive-learning/courses/unit-2-1-modeling-language/student/[sessionId]/page.tsx',
    'src/app/interactive-learning/courses/*/student/[sessionId]/page.tsx',
  )) {
    throw new Error('coveredRouteGlob must treat [sessionId] as a literal route segment');
  }
  if (matchesCoveredRouteFile(
    'src/app/interactive-learning/courses/unit-2-1-modeling-language/teacher/[sessionId]/waiting/page.tsx',
    'src/app/interactive-learning/courses/*/teacher/[sessionId]/page.tsx',
  )) {
    throw new Error('coveredRouteGlob * must match exactly one route segment');
  }
  const issue560ReviewHref = appPageRouteHref('src/app/review/control-workbench-reuse-560/page.tsx');
  if (issue560ReviewHref !== undefined) {
    throw new Error('issue 560 review page must remain a non-primary route-ledger exception');
  }
  const issue561ReviewHref = appPageRouteHref('src/app/review/visual-stage-runtime-561/page.tsx');
  if (issue561ReviewHref !== undefined) {
    throw new Error('issue 561 review page must remain a non-primary route-ledger exception');
  }
  const issue562ReviewHref = appPageRouteHref('src/app/review/derivation-stage-runtime-562/page.tsx');
  if (issue562ReviewHref !== undefined) {
    throw new Error('issue 562 review page must remain a non-primary route-ledger exception');
  }
  const issue938ReviewHref = appPageRouteHref('src/app/review/generated-slide-runtime-938/[projection]/page.tsx');
  if (issue938ReviewHref !== undefined) {
    throw new Error('issue 938 review page must remain a non-primary route-ledger exception');
  }
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

function jpegDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return undefined;
    if (
      marker === 0xc0
      || marker === 0xc1
      || marker === 0xc2
      || marker === 0xc3
      || marker === 0xc5
      || marker === 0xc6
      || marker === 0xc7
      || marker === 0xc9
      || marker === 0xca
      || marker === 0xcb
      || marker === 0xcd
      || marker === 0xce
      || marker === 0xcf
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return undefined;
}

function simulationViewportArtifact(pathname: string | undefined) {
  if (!pathname || !existsSync(path.join(repoRoot, pathname))) return undefined;
  const buffer = readFileSync(path.join(repoRoot, pathname));
  const isPng = buffer.length > 24
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47;
  const jpegSize = jpegDimensions(buffer);
  return {
    pathname,
    imageFormat: isPng ? 'png' : jpegSize ? 'jpeg' : 'unknown',
    sha256: createHash('sha256').update(buffer).digest('hex'),
    width: isPng ? buffer.readUInt32BE(16) : jpegSize?.width,
    height: isPng ? buffer.readUInt32BE(20) : jpegSize?.height,
  };
}

function simulationReactDoctorReport(pathname: string | undefined) {
  const artifact = simulationViewportArtifact(pathname);
  if (!artifact) return undefined;
  const content = JSON.parse(readFileSync(path.join(repoRoot, artifact.pathname), 'utf8')) as {
    totals?: {
      ownedDiagnostics?: number;
      selectedDiagnostics?: number;
    };
  };
  return {
    ...artifact,
    ownedDiagnostics: content.totals?.ownedDiagnostics,
    selectedDiagnostics: content.totals?.selectedDiagnostics,
  };
}

function runtimeNoiseMessages(entries: unknown, fallbackKey: 'message' | 'text') {
  if (!Array.isArray(entries)) return undefined;
  return entries.map((entry) => {
    if (typeof entry === 'string') return entry;
    if (!entry || typeof entry !== 'object') return JSON.stringify(entry);
    const record = entry as Record<string, unknown>;
    const detail = typeof record[fallbackKey] === 'string'
      ? record[fallbackKey]
      : JSON.stringify(record);
    return typeof record.route === 'string' ? `${record.route}: ${detail}` : String(detail);
  });
}

function simulationRuntimeNoiseReport(pathname: string | undefined) {
  const artifact = simulationViewportArtifact(pathname);
  if (!artifact) return undefined;
  const content = JSON.parse(readFileSync(path.join(repoRoot, artifact.pathname), 'utf8')) as {
    summary?: {
      routesChecked?: number;
      pageErrors?: unknown[];
      trackedConsoleWarnings?: unknown[];
    };
  };
  return {
    ...artifact,
    routesChecked: content.summary?.routesChecked,
    pageErrors: runtimeNoiseMessages(content.summary?.pageErrors, 'message'),
    trackedConsoleWarnings: runtimeNoiseMessages(content.summary?.trackedConsoleWarnings, 'text'),
  };
}

function simulationFullMatrixReviewReport(pathname: string | undefined) {
  const artifact = simulationViewportArtifact(pathname);
  if (!artifact) return undefined;
  const content = readFileSync(path.join(repoRoot, artifact.pathname), 'utf8');
  const blockersMatch = content.match(/Unresolved blockers:\s*(\d+)/i);
  return {
    ...artifact,
    status: /Final result:\s*PASS/i.test(content) ? 'passed' as const : 'failed' as const,
    unresolvedBlockers: blockersMatch ? Number(blockersMatch[1]) : 1,
  };
}

function readVisualEvidenceManifest(): CommercialVisualAcceptanceEvidence[] {
  const manifestPath = path.join(repoRoot, 'artifacts/commercial-ui/evidence.json');
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { routes?: CommercialVisualAcceptanceEvidence[] };
  return (manifest.routes ?? []).map((route) => ({
	    ...route,
	    simulationFullMatrixVisualQa: route.simulationFullMatrixVisualQa
	      ? {
	          ...route.simulationFullMatrixVisualQa,
	          independentReview: (() => {
	            const reviewReport = simulationFullMatrixReviewReport(
	              route.simulationFullMatrixVisualQa.independentReview.report,
	            );
	            return {
	              ...route.simulationFullMatrixVisualQa.independentReview,
	              currentReportSha256: reviewReport?.sha256,
	              currentStatus: reviewReport?.status ?? 'failed',
	              currentUnresolvedBlockers: reviewReport?.unresolvedBlockers ?? 1,
	            };
	          })(),
	          entries: route.simulationFullMatrixVisualQa.entries.map((entry) => {
	            const screenshot = simulationViewportArtifact(entry.screenshot);
	            return {
	              ...entry,
	              screenshot: entry.screenshot,
	              screenshotSha256: screenshot?.sha256,
	              screenshotWidth: screenshot?.width,
	              screenshotHeight: screenshot?.height,
	            };
	          }),
	        }
	      : undefined,
	    simulationVisualQa: route.simulationVisualQa
      ? (() => {
          const reactDoctorReport = simulationReactDoctorReport(route.simulationVisualQa.reactDoctorErrorCheck?.report);
          const runtimeNoiseReport = simulationRuntimeNoiseReport(route.simulationVisualQa.runtimeNoise?.report);
          const simulationRoute = SIMULATION_VISUAL_QA_ROUTE_MATRIX.find((entry) => entry.href === route.href);
          return {
            ...route.simulationVisualQa,
            reactDoctorErrorCheck: route.simulationVisualQa.reactDoctorErrorCheck
              ? {
                  ...route.simulationVisualQa.reactDoctorErrorCheck,
                  reportSha256: reactDoctorReport?.sha256,
                  ownedDiagnostics: reactDoctorReport?.ownedDiagnostics,
                  selectedDiagnostics: reactDoctorReport?.selectedDiagnostics,
                }
              : undefined,
            runtimeNoise: route.simulationVisualQa.runtimeNoise
              ? {
                  ...route.simulationVisualQa.runtimeNoise,
                  reportSha256: runtimeNoiseReport?.sha256,
                  routesChecked: runtimeNoiseReport?.routesChecked ?? route.simulationVisualQa.runtimeNoise.routesChecked,
                  pageErrors: runtimeNoiseReport
                    ? runtimeNoiseReport.pageErrors
                    : route.simulationVisualQa.runtimeNoise.pageErrors,
                  trackedConsoleWarnings:
                    runtimeNoiseReport
                      ? runtimeNoiseReport.trackedConsoleWarnings
                      : route.simulationVisualQa.runtimeNoise.trackedConsoleWarnings,
                }
              : undefined,
            handoffBaseline: route.simulationVisualQa.handoffBaseline
              ? {
                  ...route.simulationVisualQa.handoffBaseline,
                  designHandoffSha256:
                    simulationViewportArtifact(route.simulationVisualQa.handoffBaseline.designHandoff)?.sha256,
                  implementationMatrixSha256:
                    simulationViewportArtifact(route.simulationVisualQa.handoffBaseline.implementationMatrix)?.sha256,
                  conceptImageSha256:
                    simulationViewportArtifact(route.simulationVisualQa.handoffBaseline.conceptImage)?.sha256,
                  implementationScreenshotSha256:
                    simulationViewportArtifact(route.simulationVisualQa.handoffBaseline.implementationScreenshot)?.sha256,
                }
              : undefined,
	            commandDeckGeometry: route.simulationVisualQa.commandDeckGeometry
	              ? {
	                  ...route.simulationVisualQa.commandDeckGeometry,
	                  currentSourceSha256: commandDeckGeometryCurrentSourceSha256(simulationRoute?.routeFile ?? ''),
                  viewports: route.simulationVisualQa.commandDeckGeometry.viewports.map((viewport) => {
                    const screenshot = simulationViewportArtifact(viewport.screenshot);
                    return {
                      ...viewport,
                      screenshot: viewport.screenshot,
                      screenshotSha256: screenshot?.sha256,
                      screenshotWidth: screenshot?.width,
                      screenshotHeight: screenshot?.height,
                    };
                  }),
                }
              : undefined,
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
          };
        })()
      : undefined,
    viewports: route.viewports.map((viewport) => ({
      ...viewport,
      artifact: viewport.artifact && existsSync(path.join(repoRoot, viewport.artifact)) ? viewport.artifact : undefined,
      screenshot: viewport.screenshot && existsSync(path.join(repoRoot, viewport.screenshot)) ? viewport.screenshot : undefined,
    })),
  }));
}

function commandDeckGeometrySourcePaths(routeFile: string) {
  return [
    routeFile,
    'src/app/simulations/_components/simulation-shell.tsx',
    'src/resources/simulations/components/simulation-ui.tsx',
    'src/resources/simulations/components/camera-view-switcher.tsx',
    'scripts/tests/capture-simulation-command-deck-qa.ts',
  ] as const;
}

function commandDeckGeometryCurrentSourceSha256(routeFile: string) {
  return Object.fromEntries(
    commandDeckGeometrySourcePaths(routeFile)
      .filter((sourcePath) => sourcePath.length > 0 && existsSync(path.join(repoRoot, sourcePath)))
      .map((sourcePath) => [sourcePath, fileSha256(sourcePath)]),
  );
}

const INTERACTIVE_LEARNING_PRODUCT_QA_EVIDENCE_PATH =
  'artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/govern-interactive-learning-product-qa/final-product-qa.json';
const INTERACTIVE_LEARNING_PRODUCT_QA_SOURCE_PREFIXES = [
  'src/app/interactive-learning/',
  'src/features/interactive/',
  'src/features/lesson-engine/',
] as const;

function readInteractiveLearningProductQaEvidence(): CommercialInteractiveLearningProductQaEvidence | undefined {
  const evidencePath = path.join(repoRoot, INTERACTIVE_LEARNING_PRODUCT_QA_EVIDENCE_PATH);
  if (!existsSync(evidencePath)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(evidencePath, 'utf8'));
  } catch (error) {
    return {
      change: 'govern-interactive-learning-product-qa',
      parseError: error instanceof Error ? error.message : 'invalid JSON',
      designHandoff: '',
      handoffMatrix: '',
      conceptImages: [],
      childDesignQaReports: [],
      routeMatrix: [],
      independentVisualReview: {
        status: 'not-run',
        reviewer: '',
        report: '',
      },
      regressionChecks: {},
      temporaryExceptions: [],
    };
  }
  return hydrateInteractiveLearningProductQaEvidence(parsed);
}

export function hydrateInteractiveLearningProductQaEvidence(
  parsed: unknown,
): CommercialInteractiveLearningProductQaEvidence {
  const evidence = typeof parsed === 'object' && parsed !== null
    ? parsed as Partial<CommercialInteractiveLearningProductQaEvidence>
    : {};
  const conceptImages = Array.isArray(evidence.conceptImages) ? evidence.conceptImages : [];
  const childDesignQaReports = Array.isArray(evidence.childDesignQaReports) ? evidence.childDesignQaReports : [];
  const routeMatrix = Array.isArray(evidence.routeMatrix) ? evidence.routeMatrix : [];
  const temporaryExceptions = Array.isArray(evidence.temporaryExceptions) ? evidence.temporaryExceptions : [];
  const independentVisualReview = isPlainObject(evidence.independentVisualReview)
    ? evidence.independentVisualReview
    : undefined;
  const conceptImageSha256 = Object.fromEntries(
    conceptImages.filter((conceptImage): conceptImage is string => typeof conceptImage === 'string').map((conceptImage) => [
      conceptImage,
      simulationViewportArtifact(conceptImage)?.sha256 ?? '',
    ]),
  );
  const independentReviewPath = typeof independentVisualReview?.report === 'string'
    && independentVisualReview.report.trim()
    ? independentVisualReview.report
    : undefined;
  const independentReviewReport = independentReviewPath
    ? readOptionalText(independentReviewPath)
    : '';
  return {
    ...evidence,
    change: evidence.change ?? 'govern-interactive-learning-product-qa',
    designHandoff: evidence.designHandoff ?? '',
    currentDesignHandoffSha256: evidence.designHandoff
      ? simulationViewportArtifact(evidence.designHandoff)?.sha256
      : undefined,
    handoffMatrix: evidence.handoffMatrix ?? '',
    currentHandoffMatrixSha256: evidence.handoffMatrix
      ? simulationViewportArtifact(evidence.handoffMatrix)?.sha256
      : undefined,
    conceptImages,
    currentConceptImageSha256: conceptImageSha256,
    routeMatrix,
    temporaryExceptions,
    childDesignQaReports: childDesignQaReports.map((report) => {
      if (!isPlainObject(report)) return report;
      return {
        ...report,
        currentReportSha256: typeof report.report === 'string'
          ? simulationViewportArtifact(report.report)?.sha256
          : undefined,
        reportFinalResult: typeof report.report === 'string'
          ? parseInteractiveLearningDesignQaResult(report.report)
          : 'missing',
      };
    }),
    independentVisualReview: independentVisualReview
      ? {
          ...independentVisualReview,
          currentReportSha256: independentReviewPath
            ? simulationViewportArtifact(independentReviewPath)?.sha256
            : undefined,
          reportHasPassVerdict: /final verdict:\s*pass/i.test(independentReviewReport),
          reportHasNoUnresolvedBlocks: interactiveLearningReviewHasNoUnresolvedBlocks(independentReviewReport),
        }
      : Object.hasOwn(evidence, 'independentVisualReview')
        ? evidence.independentVisualReview
        : {
            status: 'not-run',
            reviewer: '',
            report: '',
          },
    regressionChecks: evidence.regressionChecks ?? {},
  } as CommercialInteractiveLearningProductQaEvidence;
}

function interactiveLearningProductQaEvidenceArtifactPaths() {
  const paths = new Set<string>([INTERACTIVE_LEARNING_PRODUCT_QA_EVIDENCE_PATH]);
  const evidencePath = path.join(repoRoot, INTERACTIVE_LEARNING_PRODUCT_QA_EVIDENCE_PATH);
  if (!existsSync(evidencePath)) return paths;

  let evidence: unknown;
  try {
    evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  } catch {
    return paths;
  }
  if (!isPlainObject(evidence)) return paths;

  const addPath = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) paths.add(value);
  };
  addPath(evidence.designHandoff);
  addPath(evidence.handoffMatrix);
  if (Array.isArray(evidence.conceptImages)) {
    for (const conceptImage of evidence.conceptImages) addPath(conceptImage);
  }
  if (Array.isArray(evidence.routeMatrix)) {
    for (const route of evidence.routeMatrix) {
      if (isPlainObject(route)) addPath(route.sourceConcept);
    }
  }
  if (Array.isArray(evidence.childDesignQaReports)) {
    for (const report of evidence.childDesignQaReports) {
      if (isPlainObject(report)) addPath(report.report);
    }
  }
  if (isPlainObject(evidence.independentVisualReview)) {
    addPath(evidence.independentVisualReview.report);
  }
  return paths;
}

export function interactiveLearningReviewHasNoUnresolvedBlocks(report: string) {
  const reportWithoutCleanPhrase = report.replace(/no unresolved block findings remain/ig, '');
  return /no unresolved block findings remain/i.test(report)
    && !/unresolved\s+block/i.test(reportWithoutCleanPhrase);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalText(relativePath: string) {
  if (!relativePath.trim()) return '';
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
  } catch {
    return '';
  }
}

function parseInteractiveLearningDesignQaResult(relativePath?: string) {
  if (!relativePath) return 'missing';
  const content = readOptionalText(relativePath);
  if (/final result:?\s*(?:\n\s*)?passed/i.test(content)) return 'passed';
  if (/final result:?\s*(?:\n\s*)?blocked/i.test(content)) return 'blocked';
  return 'missing';
}

function shouldRequireInteractiveLearningProductQa(files: readonly string[]) {
  const referencedProductQaArtifacts = interactiveLearningProductQaEvidenceArtifactPaths();
  return files.some((file) => (
    file.startsWith('openspec/changes/govern-interactive-learning-product-qa/')
    || (file.startsWith('openspec/changes/archive/')
      && file.includes('/govern-interactive-learning-product-qa/'))
    || file.startsWith('artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/govern-interactive-learning-product-qa/')
    || referencedProductQaArtifacts.has(file)
    || INTERACTIVE_LEARNING_PRODUCT_QA_SOURCE_PREFIXES.some((prefix) => file.startsWith(prefix))
    || file === 'src/lib/commercial-ui-governance.ts'
    || file === 'scripts/tests/test-commercial-ui-governance.ts'
  ));
}

function latestInteractiveLearningProductQaSourceCommits(files: readonly string[]) {
  return Array.from(new Set(files
    .filter((file) => INTERACTIVE_LEARNING_PRODUCT_QA_SOURCE_PREFIXES.some((prefix) => file.startsWith(prefix)))
    .map(latestCommitForPath)
    .filter(Boolean)));
}

function interactiveLearningProductQaEvidenceCoversLatestSource(files: readonly string[]) {
  const sourceFiles = files.filter((file) => (
    INTERACTIVE_LEARNING_PRODUCT_QA_SOURCE_PREFIXES.some((prefix) => file.startsWith(prefix))
  ));
  const hasUncommittedSourceChange = sourceFiles.some(hasUncommittedPathChange);
  if (hasUncommittedSourceChange) return hasUncommittedPathChange(INTERACTIVE_LEARNING_PRODUCT_QA_EVIDENCE_PATH);
  const latestSourceCommits = latestInteractiveLearningProductQaSourceCommits(files);
  if (latestSourceCommits.length === 0) return true;
  const evidenceCommit = latestCommitForPath(INTERACTIVE_LEARNING_PRODUCT_QA_EVIDENCE_PATH);
  return Boolean(evidenceCommit) && latestSourceCommits.every((sourceCommit) => (
    isAncestorCommit(sourceCommit, evidenceCommit)
  ));
}

const ADAPTIVE_PATH_PRODUCT_QA_EVIDENCE_PATH =
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/evidence/govern-adaptive-path-product-qa/final-product-qa.json';
const ADAPTIVE_PATH_PRODUCT_QA_CAPTURE_MANIFEST =
  'artifacts/commercial-ui/adaptive-path-product-qa-516/capture-manifest.json';
const ADAPTIVE_PATH_PRODUCT_QA_VISUAL_SIGNALS =
  'artifacts/commercial-ui/adaptive-path-product-qa-516/visual-signals.json';
const ADAPTIVE_PATH_PRODUCT_QA_SOURCE_PREFIXES = [
  'src/app/assessment/adaptive-practice/',
  'src/app/api/learning-paths/',
  'src/features/adaptive/',
  'src/lib/adaptive-learning-path-planner.ts',
  'src/lib/adaptive-path-option-display.ts',
  'src/lib/control-correction-path-rounds.ts',
  'src/lib/konling-agent-runtime.ts',
] as const;

function adaptivePathSourceFileChanged(file: string) {
  return ADAPTIVE_PATH_PRODUCT_QA_SOURCE_PREFIXES.some((prefix) => (
    prefix.endsWith('.ts') || prefix.endsWith('.tsx')
      ? file === prefix
      : file.startsWith(prefix)
  ));
}

function readAdaptivePathProductQaEvidence(): CommercialAdaptivePathProductQaEvidence | undefined {
  const evidencePath = path.join(repoRoot, ADAPTIVE_PATH_PRODUCT_QA_EVIDENCE_PATH);
  if (!existsSync(evidencePath)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(evidencePath, 'utf8'));
  } catch (error) {
    return {
      change: 'govern-adaptive-path-product-qa',
      parseError: error instanceof Error ? error.message : 'invalid JSON',
      designHandoff: '',
      handoffMatrix: '',
      captureManifest: '',
      visualSignals: '',
      conceptImages: [],
      childChangeValidations: [],
      routeMatrix: [],
      captureStates: [],
      independentVisualReview: {
        status: 'not-run',
        reviewer: '',
        report: '',
      },
      functionalGates: {},
      temporaryExceptions: [],
    };
  }
  return hydrateAdaptivePathProductQaEvidence(parsed);
}

export function hydrateAdaptivePathProductQaEvidence(
  parsed: unknown,
): CommercialAdaptivePathProductQaEvidence {
  const evidence = typeof parsed === 'object' && parsed !== null
    ? parsed as Partial<CommercialAdaptivePathProductQaEvidence>
    : {};
  const conceptImages = Array.isArray(evidence.conceptImages) ? evidence.conceptImages : [];
  const childChangeValidations = Array.isArray(evidence.childChangeValidations) ? evidence.childChangeValidations : [];
  const routeMatrix = Array.isArray(evidence.routeMatrix) ? evidence.routeMatrix : [];
  const temporaryExceptions = Array.isArray(evidence.temporaryExceptions) ? evidence.temporaryExceptions : [];
  const independentVisualReview = isPlainObject(evidence.independentVisualReview)
    ? evidence.independentVisualReview
    : undefined;
  const conceptImageSha256 = Object.fromEntries(
    conceptImages.filter((conceptImage): conceptImage is string => typeof conceptImage === 'string').map((conceptImage) => [
      conceptImage,
      simulationViewportArtifact(conceptImage)?.sha256 ?? '',
    ]),
  );
  const independentReviewPath = typeof independentVisualReview?.report === 'string'
    && independentVisualReview.report.trim()
    ? independentVisualReview.report
    : undefined;
  const independentReviewReport = independentReviewPath
    ? readOptionalText(independentReviewPath)
    : '';
  return {
    ...evidence,
    change: evidence.change ?? 'govern-adaptive-path-product-qa',
    designHandoff: evidence.designHandoff ?? '',
    currentDesignHandoffSha256: evidence.designHandoff
      ? simulationViewportArtifact(evidence.designHandoff)?.sha256
      : undefined,
    handoffMatrix: evidence.handoffMatrix ?? '',
    currentHandoffMatrixSha256: evidence.handoffMatrix
      ? simulationViewportArtifact(evidence.handoffMatrix)?.sha256
      : undefined,
    captureManifest: evidence.captureManifest ?? ADAPTIVE_PATH_PRODUCT_QA_CAPTURE_MANIFEST,
    currentCaptureManifestSha256: simulationViewportArtifact(
      evidence.captureManifest ?? ADAPTIVE_PATH_PRODUCT_QA_CAPTURE_MANIFEST,
    )?.sha256,
    visualSignals: evidence.visualSignals ?? ADAPTIVE_PATH_PRODUCT_QA_VISUAL_SIGNALS,
    currentVisualSignalsSha256: simulationViewportArtifact(
      evidence.visualSignals ?? ADAPTIVE_PATH_PRODUCT_QA_VISUAL_SIGNALS,
    )?.sha256,
    conceptImages,
    currentConceptImageSha256: conceptImageSha256,
    childChangeValidations,
    routeMatrix: routeMatrix.map((entry) => {
      if (!isPlainObject(entry)) return entry;
      return {
        ...entry,
        screenshotSha256: typeof entry.screenshot === 'string'
          ? simulationViewportArtifact(entry.screenshot)?.sha256
          : entry.screenshotSha256,
      };
    }),
    captureStates: Array.isArray(evidence.captureStates) ? evidence.captureStates : [],
    independentVisualReview: independentVisualReview
      ? {
          ...independentVisualReview,
          currentReportSha256: independentReviewPath
            ? simulationViewportArtifact(independentReviewPath)?.sha256
            : undefined,
          reportHasPassVerdict: /final verdict:\s*pass/i.test(independentReviewReport),
          reportHasNoUnresolvedBlocks: interactiveLearningReviewHasNoUnresolvedBlocks(independentReviewReport),
        }
      : Object.hasOwn(evidence, 'independentVisualReview')
        ? evidence.independentVisualReview
        : {
            status: 'not-run',
            reviewer: '',
            report: '',
          },
    functionalGates: evidence.functionalGates ?? {},
    temporaryExceptions,
  } as CommercialAdaptivePathProductQaEvidence;
}

function adaptivePathProductQaEvidenceArtifactPaths() {
  const paths = new Set<string>([ADAPTIVE_PATH_PRODUCT_QA_EVIDENCE_PATH]);
  const evidencePath = path.join(repoRoot, ADAPTIVE_PATH_PRODUCT_QA_EVIDENCE_PATH);
  if (!existsSync(evidencePath)) return paths;

  let evidence: unknown;
  try {
    evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  } catch {
    return paths;
  }
  if (!isPlainObject(evidence)) return paths;

  const addPath = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) paths.add(value);
  };
  addPath(evidence.designHandoff);
  addPath(evidence.handoffMatrix);
  addPath(evidence.captureManifest);
  addPath(evidence.visualSignals);
  if (Array.isArray(evidence.conceptImages)) {
    for (const conceptImage of evidence.conceptImages) addPath(conceptImage);
  }
  if (Array.isArray(evidence.routeMatrix)) {
    for (const route of evidence.routeMatrix) {
      if (!isPlainObject(route)) continue;
      addPath(route.sourceConcept);
      addPath(route.screenshot);
    }
  }
  if (Array.isArray(evidence.captureStates)) {
    for (const state of evidence.captureStates) {
      if (!isPlainObject(state)) continue;
      addPath(state.screenshot);
    }
  }
  if (isPlainObject(evidence.independentVisualReview)) {
    addPath(evidence.independentVisualReview.report);
  }
  return paths;
}

function shouldRequireAdaptivePathProductQa(files: readonly string[]) {
  const referencedProductQaArtifacts = adaptivePathProductQaEvidenceArtifactPaths();
  return files.some((file) => (
    file.startsWith('openspec/changes/govern-adaptive-path-product-qa/')
    || (file.startsWith('openspec/changes/archive/')
      && file.includes('/govern-adaptive-path-product-qa/'))
    || file.startsWith('artifacts/product-design-audits/adaptive-learning-path-2026-06-14/evidence/govern-adaptive-path-product-qa/')
    || referencedProductQaArtifacts.has(file)
    || adaptivePathSourceFileChanged(file)
    || file === 'src/lib/commercial-ui-governance.ts'
    || file === 'scripts/tests/test-commercial-ui-governance.ts'
  ));
}

function latestAdaptivePathProductQaSourceCommits(files: readonly string[]) {
  return Array.from(new Set(files
    .filter(adaptivePathSourceFileChanged)
    .map(latestCommitForPath)
    .filter(Boolean)));
}

function adaptivePathProductQaEvidenceCoversLatestSource(files: readonly string[]) {
  const sourceFiles = files.filter(adaptivePathSourceFileChanged);
  const hasUncommittedSourceChange = sourceFiles.some(hasUncommittedPathChange);
  if (hasUncommittedSourceChange) return hasUncommittedPathChange(ADAPTIVE_PATH_PRODUCT_QA_EVIDENCE_PATH);
  const latestSourceCommits = latestAdaptivePathProductQaSourceCommits(files);
  if (latestSourceCommits.length === 0) return true;
  const evidenceCommit = latestCommitForPath(ADAPTIVE_PATH_PRODUCT_QA_EVIDENCE_PATH);
  return Boolean(evidenceCommit) && latestSourceCommits.every((sourceCommit) => (
    isAncestorCommit(sourceCommit, evidenceCommit)
  ));
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
    const fullMatrixVisualQa = route.simulationFullMatrixVisualQa;
    if (fullMatrixVisualQa) {
      paths.add(fullMatrixVisualQa.independentReview.report);
      paths.add(fullMatrixVisualQa.independentReview.inputs.designHandoff);
      paths.add(fullMatrixVisualQa.independentReview.inputs.audit);
      for (const conceptImage of fullMatrixVisualQa.independentReview.inputs.conceptImages) paths.add(conceptImage);
      for (const contactSheet of fullMatrixVisualQa.independentReview.inputs.contactSheets) paths.add(contactSheet);
      for (const screenshot of fullMatrixVisualQa.independentReview.inputs.implementationScreenshots) {
        paths.add(screenshot);
      }
      for (const entry of fullMatrixVisualQa.entries) paths.add(entry.screenshot);
    }
    const simulationVisualQa = route.simulationVisualQa;
    if (!simulationVisualQa) continue;
    if (simulationVisualQa.reactDoctorErrorCheck?.report) {
      paths.add(simulationVisualQa.reactDoctorErrorCheck.report);
    }
    if (simulationVisualQa.handoffBaseline) {
      paths.add(simulationVisualQa.handoffBaseline.designHandoff);
      paths.add(simulationVisualQa.handoffBaseline.implementationMatrix);
      paths.add(simulationVisualQa.handoffBaseline.conceptImage);
      paths.add(simulationVisualQa.handoffBaseline.implementationScreenshot);
    }
    for (const viewport of simulationVisualQa.viewports) {
      if (viewport.screenshot) paths.add(viewport.screenshot);
      if (viewport.artifact) paths.add(viewport.artifact);
    }
    for (const viewport of simulationVisualQa.commandDeckGeometry?.viewports ?? []) {
      if (viewport.screenshot) paths.add(viewport.screenshot);
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
    || routes.some((route) => route.href === '/interactive-learning/control-workbench')
    || files.some((file) => (
      file === 'src/app/simulations/page.tsx'
      || file === 'src/app/virtual-lab/page.tsx'
      || file === 'src/lib/platform-role-navigation.ts'
      || file === 'artifacts/commercial-ui/evidence.json'
      || file === 'artifacts/commercial-ui/simulation-experience-visual-qa/manifest.json'
      || file.startsWith('artifacts/commercial-ui/simulation-experience-visual-qa/')
      || file.startsWith('artifacts/commercial-ui/simulation-command-deck-535/')
      || file.startsWith('artifacts/commercial-ui/simulation-full-matrix-qa-537/')
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
const KNOWLEDGE_GRAPH_INTERACTION_STATE_EVIDENCE_PATH =
  'artifacts/knowledge-graph-interaction-state-485/browser-evidence.json';
const KNOWLEDGE_GRAPH_SEMANTIC_MAP_EVIDENCE_PATH =
  'artifacts/knowledge-graph-semantic-map-486/browser-evidence.json';
const KNOWLEDGE_WORKSPACE_TOOLS_INSPECTOR_EVIDENCE_PATH =
  'artifacts/knowledge-workspace-tools-inspector-487/browser-evidence.json';
const KNOWLEDGE_WORKSPACE_PRODUCT_QA_EVIDENCE_PATH =
  'artifacts/knowledge-workspace-product-qa-489/browser-evidence.json';

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

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as JsonRecord)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length === Object.keys(value).length ? Object.fromEntries(entries) : {};
}

function stringRecordsEqual(left: Record<string, string>, right: Record<string, string>) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

function stringRecordsEqualForPaths(
  left: Record<string, string>,
  right: Record<string, string>,
  paths: readonly string[],
) {
  return paths.every((sourcePath) => (
    typeof left[sourcePath] === 'string'
    && typeof right[sourcePath] === 'string'
    && left[sourcePath] === right[sourcePath]
  ));
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

function artifactPathFromEvidence(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return path.isAbsolute(value) ? path.relative(repoRoot, value) : value;
}

function numberFromEvidence(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function booleanFromEvidence(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function evidenceRect(value: unknown): { left: number; top: number; right: number; bottom: number } | undefined {
  const record = objectRecord(value);
  const left = numberFromEvidence(record.left);
  const top = numberFromEvidence(record.top);
  const right = numberFromEvidence(record.right);
  const bottom = numberFromEvidence(record.bottom);
  if (
    typeof left !== 'number'
    || typeof top !== 'number'
    || typeof right !== 'number'
    || typeof bottom !== 'number'
  ) {
    return undefined;
  }
  return { left, top, right, bottom };
}

function evidenceRectsOverlap(a: unknown, b: unknown) {
  const rectA = evidenceRect(a);
  const rectB = evidenceRect(b);
  if (!rectA || !rectB) return false;
  return rectA.left < rectB.right
    && rectA.right > rectB.left
    && rectA.top < rectB.bottom
    && rectA.bottom > rectB.top;
}

function validateKnowledgeGraphInteractionStateEvidence(): CommercialUiGovernanceViolation[] {
  const evidence = readJsonFile<JsonRecord>(KNOWLEDGE_GRAPH_INTERACTION_STATE_EVIDENCE_PATH);
  if (!evidence) {
    return [knowledgeGraphGovernanceViolation('Knowledge graph interaction-state evidence file is missing.', [
      KNOWLEDGE_GRAPH_INTERACTION_STATE_EVIDENCE_PATH,
    ])];
  }

  const screenshots = objectRecord(evidence.screenshots);
  const screenshotProblems = [
    'initial',
    'hover',
    'selected',
    'dragged',
    'inspectorClosed',
    'relayout',
  ].flatMap((key) => {
    const pathname = artifactPathFromEvidence(screenshots[key]);
    const artifact = simulationViewportArtifact(pathname);
    if (!pathname || !artifact) return [`${key}:missing-screenshot`];
    return artifact.width === 1425 && artifact.height === 900 ? [] : [`${key}:invalid-png-dimensions`];
  });

  const states = objectRecord(evidence.states);
  const initial = objectRecord(states.initial);
  const hover = objectRecord(states.hover);
  const rapidHover = objectRecord(states.rapidHover);
  const selected = objectRecord(states.selected);
  const dragged = objectRecord(states.dragged);
  const hoverAfterDrag = objectRecord(states.hoverAfterDrag);
  const inspectorClosed = objectRecord(states.inspectorClosed);
  const relayout = objectRecord(states.relayout);
  const currentRun = objectRecord(evidence.currentRun);
  const currentRunBaseline = objectRecord(currentRun.baseline);
  const currentRunRelayout = objectRecord(currentRun.explicitRelayout);
  const currentRunRelayoutBefore = objectRecord(currentRunRelayout.before);
  const currentRunRelayoutAfter = objectRecord(currentRunRelayout.after);
  const currentRunInteractionHarness = objectRecord(currentRun.interactionHarness);
  const currentRunHarnessSelected = objectRecord(currentRunInteractionHarness.selected);
  const currentRunHarnessDragged = objectRecord(currentRunInteractionHarness.dragged);
  const currentRunHarnessHoverAfterDrag = objectRecord(currentRunInteractionHarness.hoverAfterDrag);
  const currentRunHarnessRendererSync = objectRecord(currentRunInteractionHarness.rendererSync);

  const initialNodeCount = numberFromEvidence(initial.visibleNodeCount);
  const initialLinkCount = numberFromEvidence(initial.visibleLinkCount);
  const currentRunNodeCount = numberFromEvidence(currentRunBaseline.visibleNodeCount);
  const currentRunLinkCount = numberFromEvidence(currentRunBaseline.visibleLinkCount);
  const draggedSignature = typeof dragged.pinnedLayoutSignature === 'string'
    ? dragged.pinnedLayoutSignature
    : '';
  const selectedNodeId = typeof selected.selectedNodeId === 'string' ? selected.selectedNodeId : '';
  const stateProblems = [
    initial.layoutVersion === '0' ? null : 'initial:layout-version',
    initial.pinnedNodeCount === '0' ? null : 'initial:pinned-count',
    hover.layoutVersion === '0' ? null : 'hover:layout-version-changed',
    rapidHover.layoutVersion === '0' ? null : 'rapid-hover:layout-version-changed',
    numberFromEvidence(hover.visibleNodeCount) === initialNodeCount ? null : 'hover:visible-node-count-changed',
    numberFromEvidence(hover.visibleLinkCount) === initialLinkCount ? null : 'hover:visible-link-count-changed',
    numberFromEvidence(rapidHover.visibleNodeCount) === initialNodeCount ? null : 'rapid-hover:visible-node-count-changed',
    numberFromEvidence(rapidHover.visibleLinkCount) === initialLinkCount ? null : 'rapid-hover:visible-link-count-changed',
    hover.hoverPreviewVisible === true ? null : 'hover:preview-not-visible',
    selected.inspectorOpen === true ? null : 'selected:inspector-not-open',
    selected.layoutVersion === '0' ? null : 'selected:layout-version-changed',
    selectedNodeId.length > 0 ? null : 'selected:selected-node-missing',
    numberFromEvidence(selected.visibleNodeCount) === initialNodeCount ? null : 'selected:visible-node-count-changed',
    numberFromEvidence(selected.visibleLinkCount) === initialLinkCount ? null : 'selected:visible-link-count-changed',
    dragged.pinnedNodeCount === '1' ? null : 'dragged:pinned-count',
    draggedSignature.includes(selectedNodeId) ? null : 'dragged:pinned-signature-missing-selected-node',
    hoverAfterDrag.pinnedLayoutSignature === draggedSignature ? null : 'hover-after-drag:pinned-signature-changed',
    hoverAfterDrag.pinnedNodeCount === '1' ? null : 'hover-after-drag:pinned-count',
    inspectorClosed.inspectorOpen === false ? null : 'inspector-closed:inspector-still-open',
    inspectorClosed.pinnedLayoutSignature === draggedSignature ? null : 'inspector-closed:pinned-signature-changed',
    relayout.pinnedNodeCount === '0' ? null : 'relayout:pinned-count-not-cleared',
    numberFromEvidence(relayout.layoutVersion)! > numberFromEvidence(dragged.layoutVersion)! ? null : 'relayout:layout-version-not-incremented',
    currentRunNodeCount === initialNodeCount ? null : 'current-run:visible-node-count-changed',
    currentRunLinkCount === initialLinkCount ? null : 'current-run:visible-link-count-changed',
    currentRunBaseline.pinnedNodeCount === 0 ? null : 'current-run:pinned-count',
    numberFromEvidence(currentRunRelayoutAfter.layoutVersion)! > numberFromEvidence(currentRunRelayoutBefore.layoutVersion)! ? null : 'current-run:relayout-version-not-incremented',
    numberFromEvidence(currentRunRelayoutAfter.visibleNodeCount) === currentRunNodeCount ? null : 'current-run:relayout-node-count-changed',
    numberFromEvidence(currentRunRelayoutAfter.visibleLinkCount) === currentRunLinkCount ? null : 'current-run:relayout-link-count-changed',
    currentRunInteractionHarness.kind === 'deterministic-layout-state-harness' ? null : 'current-run:harness-missing',
    typeof currentRunHarnessSelected.selectedNodeId === 'string' && currentRunHarnessSelected.selectedNodeId.length > 0 ? null : 'current-run:harness-selected-node-missing',
    currentRunHarnessDragged.pinnedNodeCount === 1 ? null : 'current-run:harness-dragged-pinned-count',
    typeof currentRunHarnessDragged.pinnedLayoutSignature === 'string'
      && currentRunHarnessDragged.pinnedLayoutSignature.includes(String(currentRunHarnessSelected.selectedNodeId ?? ''))
      ? null
      : 'current-run:harness-dragged-signature-missing-selected-node',
    currentRunHarnessHoverAfterDrag.pinnedLayoutSignature === currentRunHarnessDragged.pinnedLayoutSignature
      ? null
      : 'current-run:harness-hover-pinned-signature-changed',
    currentRunHarnessRendererSync.preservedAutomaticAnchors === true ? null : 'current-run:harness-automatic-anchors-not-preserved',
    currentRunHarnessRendererSync.preservedZAxisAnchorFor2DPin === true ? null : 'current-run:harness-z-axis-anchor-not-preserved',
  ].filter((entry): entry is string => Boolean(entry));

  const layoutControls = [
    ...new Set([
      ...stringArray(initial.layoutControls),
      ...stringArray(currentRunBaseline.layoutControls),
    ]),
  ];
  const missingControls = ['fit-view', 'relayout', 'pin-selected', 'set-focus-node', 'clear-pins'].filter(
    (control) => !layoutControls.includes(control),
  );

  if (screenshotProblems.length > 0 || stateProblems.length > 0 || missingControls.length > 0) {
    return [knowledgeGraphGovernanceViolation('Knowledge graph interaction-state evidence is incomplete.', [
      `screenshots=${screenshotProblems.join(',') || 'none'}`,
      `states=${stateProblems.join(',') || 'none'}`,
      `controls=${missingControls.join(',') || 'none'}`,
      KNOWLEDGE_GRAPH_INTERACTION_STATE_EVIDENCE_PATH,
    ])];
  }

  return [];
}

function validateKnowledgeGraphSemanticMapEvidence(): CommercialUiGovernanceViolation[] {
  const evidence = readJsonFile<JsonRecord>(KNOWLEDGE_GRAPH_SEMANTIC_MAP_EVIDENCE_PATH);
  const visualConfigSource = existsSync(path.join(repoRoot, 'src/features/knowledge/graph/visual-config.ts'))
    ? readFileSync(path.join(repoRoot, 'src/features/knowledge/graph/visual-config.ts'), 'utf8')
    : '';
  const twoDimensionalRendererSource = existsSync(path.join(repoRoot, 'src/features/knowledge/graph/knowledge-graph-2d.tsx'))
    ? readFileSync(path.join(repoRoot, 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8')
    : '';
  const threeDimensionalRendererSource = existsSync(path.join(repoRoot, 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'))
    ? readFileSync(path.join(repoRoot, 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8')
    : '';

  if (!evidence) {
    return [knowledgeGraphGovernanceViolation('Knowledge graph semantic-map evidence file is missing.', [
      KNOWLEDGE_GRAPH_SEMANTIC_MAP_EVIDENCE_PATH,
    ])];
  }

  const runtimeRelationTypes = [...readRuntimeKnowledgeRelationCounts().keys()].sort();
  const edgeProblems = runtimeRelationTypes.flatMap((relationType) => {
    const style = getRelationStyle(relationType);
    return [
      style.width <= KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.maxDefaultEdgeWidth
        ? null
        : `${relationType}:edge-width-too-large`,
      style.opacity <= KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.maxDefaultEdgeOpacity
        ? null
        : `${relationType}:edge-opacity-too-large`,
      getKnowledgeGraphEffectiveEdgeWidth(style, 1, 'neutral', '2d') <= KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.maxDefaultEdgeWidth
        ? null
        : `${relationType}:2d-effective-edge-width-too-large`,
      getKnowledgeGraphEffectiveEdgeWidth(style, 1, 'neutral', '3d') <= KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.maxDefaultEdgeWidth
        ? null
        : `${relationType}:3d-effective-edge-width-too-large`,
      getKnowledgeGraphEffectiveEdgeWidth(style, 1, 'active', '2d') <= KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.maxDefaultEdgeWidth * KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.activeNeighborhoodWidthGain
        ? null
        : `${relationType}:2d-active-effective-edge-width-too-large`,
      getKnowledgeGraphEffectiveEdgeWidth(style, 1, 'active', '3d') <= KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.maxDefaultEdgeWidth * KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.activeNeighborhoodWidthGain
        ? null
        : `${relationType}:3d-active-effective-edge-width-too-large`,
      getRelationThreeDimensionalEncoding(relationType).particleWidth <= KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.maxDefaultEdgeWidth
        ? null
        : `${relationType}:3d-particle-width-too-large`,
      (
        style.dash.length > 0
        || style.endpoint !== 'none'
        || style.curvature !== 0
        || style.hasArrow
      )
        ? null
        : `${relationType}:color-only-encoding`,
    ].filter((entry): entry is string => Boolean(entry));
  });
  const chapterRegion = getKnowledgeSemanticRegionStyle({
    id: 'chapter-node:governance',
    metadata: { isVirtualChapter: true, nodeCount: 48 },
    graphDegree: 24,
  });
  const normalRegion = getKnowledgeSemanticRegionStyle({
    id: 'concept:governance',
    metadata: { importance: 'core' },
    graphDegree: 24,
  });
  const sourceProblems = [
    getRelationLegendItems().every((item) => item.sampleStyle === getRelationStyle(item.type))
      ? null
      : 'legend:not-shared-contract',
    visualConfigSource.includes('KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT')
      ? null
      : 'visual-config:missing-semantic-map-contract',
    twoDimensionalRendererSource.includes('getKnowledgeSemanticRegionStyle')
      ? null
      : '2d-renderer:missing-semantic-region-style',
    threeDimensionalRendererSource.includes('getKnowledgeSemanticRegionStyle')
      ? null
      : '3d-renderer:missing-semantic-region-style',
    twoDimensionalRendererSource.includes('getKnowledgeGraphEffectiveEdgeWidth')
      ? null
      : '2d-renderer:missing-effective-edge-width-contract',
    threeDimensionalRendererSource.includes('getKnowledgeGraphEffectiveEdgeWidth')
      ? null
      : '3d-renderer:missing-effective-edge-width-contract',
    twoDimensionalRendererSource.includes('getKnowledgeGraphEffectiveEdgeOpacity')
      ? null
      : '2d-renderer:missing-centralized-edge-opacity',
    threeDimensionalRendererSource.includes('getKnowledgeGraphEffectiveEdgeOpacity')
      ? null
      : '3d-renderer:missing-centralized-edge-opacity',
    getKnowledgeGraphEffectiveEdgeOpacity(
      getRelationStyle('prerequisite'),
      1,
      'dimmed',
    ) === KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.dimmedNeighborhoodOpacity
      ? null
      : 'visual-config:dimmed-opacity-not-centralized',
    chapterRegion.enabled && !normalRegion.enabled
      ? null
      : 'semantic-region:not-derived-from-chapter-semantics',
    chapterRegion.fillColor.startsWith('hsl(var(--platform-')
      && chapterRegion.strokeColor.startsWith('hsl(var(--platform-')
      ? null
      : 'semantic-region:not-platform-tokenized',
    chapterRegion.fillOpacity <= 0.2 && chapterRegion.strokeOpacity <= 0.32
      ? null
      : 'semantic-region:not-subordinate',
  ].filter((entry): entry is string => Boolean(entry));

  const states = objectRecord(evidence.browserStates);
  const requiredStates = [
    'defaultSemanticMap',
    'selectedNeighborhood',
    'allRelationFamilies',
    'lightTheme',
    'darkTheme',
  ];
  const stateProblems = requiredStates.flatMap((key) => {
    const state = objectRecord(states[key]);
    const artifact = simulationViewportArtifact(artifactPathFromEvidence(state.screenshot));
    return [
      artifact ? null : `${key}:missing-screenshot`,
      artifact?.imageFormat === 'png' || artifact?.imageFormat === 'jpeg' ? null : `${key}:invalid-image-format`,
      artifact?.imageFormat === 'jpeg' && !artifact.pathname.endsWith('.jpg') ? `${key}:jpeg-extension-mismatch` : null,
      artifact?.imageFormat === 'png' && !artifact.pathname.endsWith('.png') ? `${key}:png-extension-mismatch` : null,
      typeof artifact?.width === 'number' && artifact.width >= 1200 ? null : `${key}:image-width-too-small`,
      typeof artifact?.height === 'number' && artifact.height >= 800 ? null : `${key}:image-height-too-small`,
      state.canvasRendered === true ? null : `${key}:canvas-not-rendered`,
      state.relationFamilyControlVisible === true ? null : `${key}:relation-family-control-not-visible`,
      numberFromEvidence(state.relationFamilySamples)! >= 3 ? null : `${key}:relation-family-samples-missing`,
      state.noGlobalEdgeSaturation === true ? null : `${key}:global-edge-saturation`,
      state.nonColorRelationGrammar === true ? null : `${key}:color-only-relations`,
    ].filter((entry): entry is string => Boolean(entry));
  });
  const sourceEvidence = objectRecord(evidence.sourceEvidence);
  const sourceEvidenceProblems = [
    sourceEvidence.legendSharedContract === true ? null : 'evidence:legendSharedContract',
    sourceEvidence.rendererUsesSemanticMapContract === true ? null : 'evidence:rendererUsesSemanticMapContract',
    sourceEvidence.semanticRegionEvidence === true ? null : 'evidence:semanticRegionEvidence',
    sourceEvidence.defaultEdgeBounds === true ? null : 'evidence:defaultEdgeBounds',
    sourceEvidence.nonColorDifferentiation === true ? null : 'evidence:nonColorDifferentiation',
  ].filter((entry): entry is string => Boolean(entry));

  if (edgeProblems.length > 0 || sourceProblems.length > 0 || stateProblems.length > 0 || sourceEvidenceProblems.length > 0) {
    return [knowledgeGraphGovernanceViolation('Knowledge graph semantic-map presentation evidence is incomplete.', [
      `edges=${edgeProblems.join(',') || 'none'}`,
      `source=${sourceProblems.join(',') || 'none'}`,
      `states=${stateProblems.join(',') || 'none'}`,
      `sourceEvidence=${sourceEvidenceProblems.join(',') || 'none'}`,
      KNOWLEDGE_GRAPH_SEMANTIC_MAP_EVIDENCE_PATH,
    ])];
  }

  return [];
}

function validateKnowledgeWorkspaceToolsInspectorEvidence(): CommercialUiGovernanceViolation[] {
  const evidence = readJsonFile<JsonRecord>(KNOWLEDGE_WORKSPACE_TOOLS_INSPECTOR_EVIDENCE_PATH);
  const graphSource = existsSync(path.join(repoRoot, 'src/features/knowledge/knowledge-graph-system.tsx'))
    ? readFileSync(path.join(repoRoot, 'src/features/knowledge/knowledge-graph-system.tsx'), 'utf8')
    : '';
  const resourcePanelSource = existsSync(path.join(repoRoot, 'src/features/knowledge/resource-panel/resource-panel.tsx'))
    ? readFileSync(path.join(repoRoot, 'src/features/knowledge/resource-panel/resource-panel.tsx'), 'utf8')
    : '';
  if (!evidence) {
    return [knowledgeGraphGovernanceViolation('Knowledge workspace tools inspector evidence file is missing.', [
      KNOWLEDGE_WORKSPACE_TOOLS_INSPECTOR_EVIDENCE_PATH,
    ])];
  }

  const results = Array.isArray(evidence.results)
    ? evidence.results.map((entry) => objectRecord(entry))
    : [];
  const resultByName = new Map(
    results
      .map((entry) => [typeof entry.name === 'string' ? entry.name : '', entry] as const)
      .filter(([name]) => name.length > 0)
  );
  const requiredScreenshots = [
    ['desktop-default-compact-dark', 1440],
    ['desktop-open-filters-dark', 1440],
    ['desktop-selected-inspector-light', 1440],
    ['mobile-320-selected-sheet-dark', 320],
    ['mobile-320-view-layout-dark', 320],
  ] as const;
  const screenshotProblems = requiredScreenshots.flatMap(([name, width]) => {
    const result = resultByName.get(name);
    const pathname = artifactPathFromEvidence(result?.screenshotPath);
    const artifact = simulationViewportArtifact(pathname);
    if (!pathname || !artifact) return [`${name}:missing-screenshot`];
    return artifact.width === width ? [] : [`${name}:invalid-width-${artifact.width ?? 'unknown'}`];
  });

  const defaultMarkers = objectRecord(resultByName.get('desktop-default-compact-dark')?.markers);
  const openFilterMarkers = objectRecord(resultByName.get('desktop-open-filters-dark')?.markers);
  const desktopInspectorMarkers = objectRecord(resultByName.get('desktop-selected-inspector-light')?.markers);
  const mobileInspectorMarkers = objectRecord(resultByName.get('mobile-320-selected-sheet-dark')?.markers);
  const mobileViewLayoutMarkers = objectRecord(resultByName.get('mobile-320-view-layout-dark')?.markers);
  const mobileViewLayoutControls = stringArray(mobileViewLayoutMarkers.mobileLayoutControls);
  const requiredInspectorSections = [
    'header',
    'semantic-metadata',
    'summary',
    'infograph-preview',
    'relation-overview',
    'evidence-sources',
    'learning-actions',
  ];
  const directLeafInspectorSections = [
    'header',
    'semantic-metadata',
    'summary',
    'evidence-sources',
    'learning-actions',
  ];
  const desktopSections = stringArray(desktopInspectorMarkers.inspectorSections);
  const mobileSections = stringArray(mobileInspectorMarkers.inspectorSections);
  const desktopAccordion = Array.isArray(desktopInspectorMarkers.inspectorAccordion)
    ? desktopInspectorMarkers.inspectorAccordion.map((entry) => objectRecord(entry))
    : [];
  const mobileAccordion = Array.isArray(mobileInspectorMarkers.inspectorAccordion)
    ? mobileInspectorMarkers.inspectorAccordion.map((entry) => objectRecord(entry))
    : [];
  const hasInspectorSections = (sections: string[]) => (
    requiredInspectorSections.every((section) => sections.includes(section))
    || directLeafInspectorSections.every((section) => sections.includes(section))
  );
  const markerProblems = [
    defaultMarkers.commandSystemState === 'closed' ? null : 'default:command-system-not-closed',
    defaultMarkers.activeDesktopTool === 'closed' ? null : 'default:active-tool-not-closed',
    openFilterMarkers.commandSystemState === 'open' ? null : 'filters:command-system-not-open',
    openFilterMarkers.activeDesktopTool === 'node-filters' ? null : 'filters:active-tool-not-node-filters',
    desktopInspectorMarkers.inspectorMode === 'floating-right-edge' ? null : 'desktop-inspector:not-floating-right-edge',
    desktopInspectorMarkers.inspectorResponsive === 'desktop-floating-mobile-sheet' ? null : 'desktop-inspector:responsive-contract-missing',
    mobileInspectorMarkers.inspectorMode === 'floating-right-edge' ? null : 'mobile-inspector:not-floating-right-edge',
    mobileInspectorMarkers.inspectorResponsive === 'desktop-floating-mobile-sheet' ? null : 'mobile-inspector:responsive-contract-missing',
    mobileInspectorMarkers.inspectorFocusContract === 'mobile-initial-focus-escape-return' ? null : 'mobile-inspector:focus-contract-missing',
    mobileInspectorMarkers.inspectorDockSafeArea === 'bottom-padding' ? null : 'mobile-inspector:dock-safe-area-missing',
    mobileViewLayoutMarkers.activeMobileTool === 'view-layout' ? null : 'mobile-view-layout:not-active',
    mobileViewLayoutMarkers.mobileToolState === 'open' ? null : 'mobile-view-layout:not-open',
    ...['fit-view', 'relayout', 'pin-selected', 'set-focus-node', 'clear-pins']
      .filter((control) => !mobileViewLayoutControls.includes(control))
      .map((control) => `mobile-view-layout:missing-${control}`),
    hasInspectorSections(desktopSections) ? null : 'desktop-inspector:missing-direct-leaf-section-contract',
    hasInspectorSections(mobileSections) ? null : 'mobile-inspector:missing-direct-leaf-section-contract',
    desktopAccordion.every((entry) => entry.expanded === 'false')
      ? null
      : 'desktop-inspector:accordion-not-initially-collapsed',
    mobileAccordion.every((entry) => entry.expanded === 'false')
      ? null
      : 'mobile-inspector:accordion-not-initially-collapsed',
  ].filter((entry): entry is string => Boolean(entry));

  const keyboardVerification = objectRecord(evidence.keyboardVerification);
  const desktopKeyboardPaths = Array.isArray(keyboardVerification.desktopToolPaths)
    ? keyboardVerification.desktopToolPaths.map((entry) => objectRecord(entry))
    : [];
  const desktopKeyboardByTool = new Map(
    desktopKeyboardPaths
      .map((entry) => [typeof entry.tool === 'string' ? entry.tool : '', entry] as const)
      .filter(([tool]) => tool.length > 0)
  );
  const requiredDesktopTools = ['chapter-directory', 'node-filters', 'view-layout'];
  const keyboardProblems = requiredDesktopTools.flatMap((tool) => {
    const entry = desktopKeyboardByTool.get(tool);
    if (!entry) return [`${tool}:keyboard-path-missing`];
    return [
      entry.openedFocusWithinPanel === true ? null : `${tool}:focus-not-in-panel`,
      entry.escapeClosed === true ? null : `${tool}:escape-did-not-close`,
      entry.focusReturnedToTrigger === true ? null : `${tool}:focus-not-returned`,
    ].filter((item): item is string => Boolean(item));
  });
  const mobileKeyboard = objectRecord(keyboardVerification.mobileInspector);
  keyboardProblems.push(...[
    mobileKeyboard.focusTrapped === true ? null : 'mobile-inspector:focus-not-trapped',
    mobileKeyboard.escapeClosed === true ? null : 'mobile-inspector:escape-did-not-close',
    mobileKeyboard.focusReturnedToCanvas === true ? null : 'mobile-inspector:focus-not-returned-to-canvas',
    mobileKeyboard.dockSafeArea === 'bottom-padding' ? null : 'mobile-inspector:dock-safe-area-not-verified',
  ].filter((entry): entry is string => Boolean(entry)));

  const sourceProblems = [
    existsSync(path.join(repoRoot, 'artifacts/knowledge-workspace-tools-inspector-487/implementation-matrix.md'))
      ? null
      : 'implementation-matrix:missing',
    Array.isArray(objectRecord(evidence.designSourceOfTruth).concepts)
      && stringArray(objectRecord(evidence.designSourceOfTruth).concepts).length === 3
      ? null
      : 'design-source:concepts-missing',
    graphSource.includes("type KnowledgeMobileTool = 'chapter-directory' | 'node-filters' | 'view-layout';")
      ? null
      : 'mobile-tools:view-layout-not-in-tool-type',
    graphSource.includes("['view-layout', '视图']")
      ? null
      : 'mobile-tools:view-layout-trigger-missing',
    graphSource.includes('data-knowledge-mobile-drawer="view-layout"')
      ? null
      : 'mobile-tools:view-layout-drawer-missing',
    graphSource.includes('data-knowledge-local-panel="view-layout-controls"')
      ? null
      : 'mobile-tools:view-layout-controls-missing',
    resourcePanelSource.includes('closeButtonRef.current?.focus();')
      && resourcePanelSource.includes('}, [selectedNode.id]);')
      ? null
      : 'mobile-inspector:selection-change-refocus-missing',
    resourcePanelSource.includes('function InspectorAccordionSection(')
      && resourcePanelSource.includes('const [activeRelationPathSection, setActiveRelationPathSection]')
      && resourcePanelSource.includes('setActiveRelationPathSection(null);')
      && resourcePanelSource.includes('inspectorSection="relation-overview"')
      && resourcePanelSource.includes('inspectorSection="canonical-corridor"')
      && resourcePanelSource.includes('inspectorSection="corridor-adjacent-domains"')
      && resourcePanelSource.includes('inspectorSection="learning-actions"')
      ? null
      : 'inspector:single-open-accordion-source-contract-missing',
  ].filter((entry): entry is string => Boolean(entry));

  if (screenshotProblems.length > 0 || markerProblems.length > 0 || keyboardProblems.length > 0 || sourceProblems.length > 0) {
    return [knowledgeGraphGovernanceViolation('Knowledge workspace tools inspector evidence is incomplete.', [
      `screenshots=${screenshotProblems.join(',') || 'none'}`,
      `markers=${markerProblems.join(',') || 'none'}`,
      `keyboard=${keyboardProblems.join(',') || 'none'}`,
      `source=${sourceProblems.join(',') || 'none'}`,
      KNOWLEDGE_WORKSPACE_TOOLS_INSPECTOR_EVIDENCE_PATH,
    ])];
  }

  return [];
}

function validateKnowledgeWorkspaceProductQaEvidence(): CommercialUiGovernanceViolation[] {
  const evidence = readJsonFile<JsonRecord>(KNOWLEDGE_WORKSPACE_PRODUCT_QA_EVIDENCE_PATH);
  const graphSourcePath = 'src/features/knowledge/knowledge-graph-system.tsx';
  const knowledgePageSourcePath = 'src/app/knowledge/page.tsx';
  const adaptivePracticePageSourcePath = 'src/app/assessment/adaptive-practice/page.tsx';
  const graph2dSourcePath = 'src/features/knowledge/graph/knowledge-graph-2d.tsx';
  const graph3dSourcePath = 'src/features/knowledge/graph/knowledge-graph-canvas.tsx';
  const graphVisualConfigSourcePath = 'src/features/knowledge/graph/visual-config.ts';
  const resourcePanelSourcePath = 'src/features/knowledge/resource-panel/resource-panel.tsx';
  const globalAiButtonSourcePath = 'src/components/ai/global-ai-button.tsx';
  const globalAiSidebarSourcePath = 'src/components/ai/global-ai-sidebar.tsx';
  const globalAiProviderSourcePath = 'src/components/providers/global-ai-provider.tsx';
  const appShellSourcePath = 'src/components/platform/app-shell.tsx';
  const floatingControlsSourcePath = 'src/components/shared/page-floating-controls.tsx';
  const globalsSourcePath = 'src/app/globals.css';
  const konlingRuntimeSourcePath = 'src/lib/konling-agent-runtime.ts';
  const captureScriptSourcePath = 'scripts/tests/capture-knowledge-workspace-product-qa.ts';
  const governanceScriptSourcePath = 'scripts/tests/test-commercial-ui-governance.ts';
  const productQaSourcePaths = [
    graphSourcePath,
    knowledgePageSourcePath,
    adaptivePracticePageSourcePath,
    graph2dSourcePath,
    graph3dSourcePath,
    graphVisualConfigSourcePath,
    resourcePanelSourcePath,
    globalAiButtonSourcePath,
    globalAiSidebarSourcePath,
    globalAiProviderSourcePath,
    appShellSourcePath,
    floatingControlsSourcePath,
    globalsSourcePath,
    konlingRuntimeSourcePath,
    captureScriptSourcePath,
    governanceScriptSourcePath,
  ];
  const graphSource = existsSync(path.join(repoRoot, graphSourcePath))
    ? readFileSync(path.join(repoRoot, graphSourcePath), 'utf8')
    : '';
  const resourcePanelSource = existsSync(path.join(repoRoot, resourcePanelSourcePath))
    ? readFileSync(path.join(repoRoot, resourcePanelSourcePath), 'utf8')
    : '';
  const appShellSource = existsSync(path.join(repoRoot, appShellSourcePath))
    ? readFileSync(path.join(repoRoot, appShellSourcePath), 'utf8')
    : '';
  const konlingRuntimeSource = existsSync(path.join(repoRoot, konlingRuntimeSourcePath))
    ? readFileSync(path.join(repoRoot, konlingRuntimeSourcePath), 'utf8')
    : '';
  if (!evidence) {
    return [knowledgeGraphGovernanceViolation('Knowledge workspace product QA evidence file is missing.', [
      KNOWLEDGE_WORKSPACE_PRODUCT_QA_EVIDENCE_PATH,
    ])];
  }

  const designSource = objectRecord(evidence.designSourceOfTruth);
  const conceptImages = stringArray(designSource.conceptImages);
  const requiredConceptImages = [
    'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/layered-research-atlas.png',
    'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/night-bridge-semantic-map.png',
    'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/daylight-engineering-atlas.png',
  ];
  const designProblems = [
    designSource.handoff === 'artifacts/product-design-audits/knowledge-graph-2026-06-14/design-handoff.md'
      ? null
      : 'design-source:handoff',
    designSource.conceptsReadme === 'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/README.md'
      ? null
      : 'design-source:concepts-readme',
    ...requiredConceptImages
      .filter((conceptPath) => !conceptImages.includes(conceptPath))
      .map((conceptPath) => `design-source:missing-${path.basename(conceptPath)}`),
  ].filter((entry): entry is string => Boolean(entry));

  const states = Array.isArray(evidence.stateMatrix)
    ? evidence.stateMatrix.map((entry) => objectRecord(entry))
    : [];
  const stateByName = new Map(
    states
      .map((entry) => [typeof entry.name === 'string' ? entry.name : '', entry] as const)
      .filter(([name]) => name.length > 0),
  );
  const stateScreenshotSha256 = Object.fromEntries(states.flatMap((state) => (
    typeof state.name === 'string' && typeof state.screenshotSha256 === 'string'
      ? [[state.name, state.screenshotSha256]]
      : []
  )));
  const requiredStates = [
    ['desktop-default-collapsed-dark', 'dark', 1440, 'collapsed', 'collapsed'],
    ['desktop-expanded-persisted-dark', 'dark', 1440, 'expanded', 'collapsed'],
    ['desktop-local-tools-directory-dark', 'dark', 1440, 'collapsed', 'collapsed'],
    ['desktop-local-tools-filter-dark', 'dark', 1440, 'collapsed', 'collapsed'],
    ['desktop-local-tools-view-dark', 'dark', 1440, 'collapsed', 'collapsed'],
    ['desktop-selected-inspector-light', 'light', 1440, 'collapsed', 'collapsed'],
    ['desktop-hover-click-drag-dark', 'dark', 1440, 'collapsed', 'collapsed'],
    ['desktop-selected-page-tools-menu-dark', 'dark', 1440, 'collapsed', 'expanded'],
    ['desktop-explicit-relayout-dark', 'dark', 1440, 'collapsed', 'collapsed'],
    ['desktop-3d-fit-relayout-dark', 'dark', 1440, 'collapsed', 'collapsed'],
    ['desktop-konling-selected-expanded-dark', 'dark', 1440, 'collapsed', 'expanded'],
    ['desktop-konling-no-selection-dark', 'dark', 1440, 'collapsed', 'expanded'],
    ['desktop-konling-degraded-dark', 'dark', 1440, 'collapsed', 'expanded'],
    ['desktop-stress-expanded-tool-inspector-konling-dark', 'dark', 1440, 'expanded', 'expanded'],
    ['desktop-wide-default-dark', 'dark', 1920, 'collapsed', 'collapsed'],
    ['desktop-wide-inspector-tools-dark', 'dark', 1920, 'collapsed', 'collapsed'],
    ['tablet-1100-default-dark', 'dark', 1100, 'collapsed', 'collapsed'],
    ['tablet-1100-local-tools-filter-dark', 'dark', 1100, 'collapsed', 'collapsed'],
    ['tablet-1100-selected-inspector-dark', 'dark', 1100, 'collapsed', 'collapsed'],
    ['tablet-1024-inspector-tools-konling-dark', 'dark', 1024, 'collapsed', 'expanded'],
    ['tablet-1100-inspector-tools-konling-dark', 'dark', 1100, 'collapsed', 'expanded'],
    ['tablet-1279-inspector-tools-konling-dark', 'dark', 1279, 'collapsed', 'expanded'],
    ['mobile-320-local-tools-dark', 'dark', 320, 'mobile-drawer', 'collapsed'],
    ['mobile-320-selected-inspector-dark', 'dark', 320, 'mobile-drawer', 'collapsed'],
    ['mobile-320-konling-expanded-dark', 'dark', 320, 'mobile-drawer', 'expanded'],
    ['mobile-320-inspector-konling-stress-dark', 'dark', 320, 'mobile-drawer', 'expanded'],
    ['light-theme-default', 'light', 1440, 'collapsed', 'collapsed'],
  ] as const;
  const desktopGeometryBaselineName = (name: string, navigationState: string) => {
    if (name.startsWith('tablet-')) return 'tablet-1100-default-dark';
    if (name.startsWith('desktop-wide')) return 'desktop-wide-default-dark';
    if (navigationState === 'expanded') return 'desktop-expanded-persisted-dark';
    return 'desktop-default-collapsed-dark';
  };
  const stateProblems = requiredStates.flatMap(([name, theme, width, navigationState, dockState]) => {
    const state = stateByName.get(name);
    const viewport = objectRecord(state?.viewport);
    const markers = objectRecord(state?.markers);
    const canvas = objectRecord(markers.canvas);
    const overlaps = objectRecord(markers.overlaps);
    const markerRects = objectRecord(markers.rects);
    const documentScroll = objectRecord(markers.documentScroll);
    const dockRect = objectRecord(markerRects.dock);
    const canvasRect = objectRecord(markerRects.canvas);
    const inspectorRect = objectRecord(markerRects.inspector);
    const inspectorTop = numberFromEvidence(inspectorRect.top);
    const baselineState = stateByName.get(desktopGeometryBaselineName(name, navigationState));
    const baselineRects = objectRecord(objectRecord(baselineState?.markers).rects);
    const baselineDockRect = objectRecord(baselineRects.dock);
    const baselineCanvasRect = objectRecord(baselineRects.canvas);
    const artifact = simulationViewportArtifact(artifactPathFromEvidence(state?.screenshotPath));
    const viewportWidth = numberFromEvidence(viewport.width);
    const isMobileViewport = viewportWidth === 320;
    const isTabletBreakpointViewport = [1024, 1100, 1279].includes(viewportWidth ?? 0);
    const isAdaptivePracticeDockState = name === 'desktop-selected-page-tools-menu-dark';
    const expectedRoute = isAdaptivePracticeDockState ? '/assessment/adaptive-practice' : '/knowledge';
    const activeLocalToolMarker = isMobileViewport ? markers.mobileActiveTool : markers.desktopActiveTool;
    const visibleLocalToolPanelState = isMobileViewport ? markers.mobileToolState : markers.desktopToolState;
    const scrollWidth = numberFromEvidence(documentScroll.scrollWidth);
    const scrollHeight = numberFromEvidence(documentScroll.scrollHeight);
    const viewportScrollWidth = numberFromEvidence(documentScroll.viewportWidth);
    const viewportScrollHeight = numberFromEvidence(documentScroll.viewportHeight);
    if (!state) return [`${name}:missing-state`];
    const expectedKonlingContext = name.includes('konling')
      ? (name.includes('degraded') ? 'degraded' : (state.selectedNode ? 'selected-node' : 'no-selection'))
      : null;
    return [
      state.route === expectedRoute ? null : `${name}:route`,
      state.theme === theme ? null : `${name}:theme`,
      numberFromEvidence(viewport.width) === width ? null : `${name}:viewport-width`,
      typeof numberFromEvidence(viewport.height) === 'number' ? null : `${name}:viewport-height`,
      state.navigationState === navigationState ? null : `${name}:navigation-state`,
      state.dockState === dockState ? null : `${name}:dock-state`,
      typeof state.localToolState === 'string' ? null : `${name}:local-tool-state`,
      typeof state.interactionState === 'string' ? null : `${name}:interaction-state`,
      state.result === 'passed' ? null : `${name}:result`,
      artifact ? null : `${name}:missing-screenshot`,
      artifact?.sha256 === state.screenshotSha256 ? null : `${name}:screenshot-sha-mismatch`,
      artifact?.imageFormat === 'png' || artifact?.imageFormat === 'jpeg' ? null : `${name}:invalid-image-format`,
      isMobileViewport
        ? (artifact?.width === 320 ? null : `${name}:invalid-mobile-screenshot-width`)
        : (
            isTabletBreakpointViewport
              ? (artifact?.width === viewportWidth ? null : `${name}:invalid-tablet-screenshot-width`)
              : (typeof artifact?.width === 'number' && artifact.width >= 1200 ? null : `${name}:desktop-screenshot-too-narrow`)
          ),
      isMobileViewport
        ? (typeof artifact?.height === 'number' && artifact.height >= 700 ? null : `${name}:mobile-screenshot-too-short`)
        : (typeof artifact?.height === 'number' && artifact.height >= 800 ? null : `${name}:desktop-screenshot-too-short`),
      markers.effectiveDockState === dockState ? null : `${name}:dock-marker-state`,
      isAdaptivePracticeDockState || (typeof numberFromEvidence(canvasRect.width) === 'number' && typeof numberFromEvidence(canvasRect.height) === 'number')
        ? null
        : `${name}:canvas-rect-missing`,
      typeof scrollWidth === 'number'
        && typeof viewportScrollWidth === 'number'
        && scrollWidth <= viewportScrollWidth
        ? null
        : `${name}:page-horizontal-scroll`,
      typeof scrollHeight === 'number'
        && typeof viewportScrollHeight === 'number'
        && scrollHeight <= viewportScrollHeight
        ? null
        : `${name}:page-vertical-scroll`,
      name.startsWith('desktop') && dockState === 'collapsed' && markers.dockInspectorAvoidance !== 'active'
        ? (
            numberFromEvidence(dockRect.left) === numberFromEvidence(baselineDockRect.left)
            && numberFromEvidence(dockRect.top) === numberFromEvidence(baselineDockRect.top)
              ? null
              : `${name}:collapsed-dock-moved`
          )
        : null,
      !isAdaptivePracticeDockState && [
        'desktop-local-tools-directory-dark',
        'desktop-local-tools-filter-dark',
        'desktop-local-tools-view-dark',
        'desktop-selected-inspector-light',
        'desktop-hover-click-drag-dark',
        'desktop-selected-page-tools-menu-dark',
        'desktop-explicit-relayout-dark',
        'desktop-stress-expanded-tool-inspector-konling-dark',
        'desktop-wide-inspector-tools-dark',
        'tablet-1100-local-tools-filter-dark',
        'tablet-1100-selected-inspector-dark',
        'tablet-1100-inspector-tools-konling-dark',
      ].includes(name)
        ? (
            numberFromEvidence(canvasRect.left) === numberFromEvidence(baselineCanvasRect.left)
            && numberFromEvidence(canvasRect.top) === numberFromEvidence(baselineCanvasRect.top)
            && numberFromEvidence(canvasRect.width) === numberFromEvidence(baselineCanvasRect.width)
            && numberFromEvidence(canvasRect.height) === numberFromEvidence(baselineCanvasRect.height)
              ? null
              : `${name}:canvas-rect-changed`
          )
        : null,
      name.includes('konling')
        ? (markers.konlingAssistantSurface === 'global-sidebar' ? null : `${name}:konling-surface-missing`)
        : null,
      expectedKonlingContext
        ? (markers.konlingKnowledgeContext === expectedKonlingContext ? null : `${name}:konling-visible-context`)
        : null,
      markers.appShellNavigationState === (navigationState === 'mobile-drawer' ? 'collapsed' : navigationState)
        ? null
        : `${name}:navigation-marker-state`,
      isAdaptivePracticeDockState
        ? null
        : state.localToolState === 'closed'
        ? (
            visibleLocalToolPanelState === 'closed' || (name.includes('konling') && visibleLocalToolPanelState === null)
              ? null
              : `${name}:local-tool-marker-state`
          )
        : (
            activeLocalToolMarker === state.localToolState && visibleLocalToolPanelState === 'open'
              ? null
              : `${name}:local-tool-marker-state`
          ),
      isAdaptivePracticeDockState
        ? null
        : state.selectedNode
        ? (
            name.includes('degraded')
              ? (canvas.selectedNodeId === '' ? null : `${name}:unexpected-degraded-selected-node`)
              : (canvas.selectedNodeId === state.selectedNode ? null : `${name}:selected-node-marker`)
          )
        : (canvas.selectedNodeId === '' ? null : `${name}:unexpected-selected-node`),
      name === 'desktop-hover-click-drag-dark'
        ? (numberFromEvidence(canvas.pinnedNodeCount) === 1 ? null : `${name}:pinned-marker-missing`)
        : null,
      name === 'desktop-3d-fit-relayout-dark'
        ? (
            objectRecord(state.interactionEvidence).initialFitCompleted === true
            && objectRecord(state.interactionEvidence).firstFitExactlyOnce === true
            && objectRecord(state.interactionEvidence).repeatedRelayoutExactlyOnce === true
            && objectRecord(state.interactionEvidence).repeatedRelayoutIdempotent === true
            && objectRecord(state.interactionEvidence).canvasStable === true
            && objectRecord(state.interactionEvidence).noLoadingBlockers === true
            && objectRecord(state.interactionEvidence).noRendererOcclusion === true
            && objectRecord(state.interactionEvidence).completeProjectedBoundsInsideCanvas === true
            && objectRecord(markers.threeDimensionalRenderer).renderer === '3D'
            && numberFromEvidence(objectRecord(markers.threeDimensionalRenderer).canvasCount) === 1
              ? null
              : `${name}:3d-fit-relayout-browser-proof-missing`
          )
        : null,
      name === 'desktop-hover-click-drag-dark'
        ? (
            objectRecord(objectRecord(state.interactionEvidence).drag).pinned === true
            && String(objectRecord(objectRecord(state.interactionEvidence).drag).method ?? '') === 'pointer-drag'
            && objectRecord(objectRecord(state.interactionEvidence).drag).selectedNodeId === state.selectedNode
            && typeof objectRecord(objectRecord(state.interactionEvidence).afterDrag).pinnedLayoutSignature === 'string'
            && String(objectRecord(objectRecord(state.interactionEvidence).afterDrag).pinnedLayoutSignature).includes(String(state.selectedNode ?? ''))
              ? null
              : `${name}:layout-persistence-interaction-proof-missing`
          )
        : null,
      name === 'desktop-stress-expanded-tool-inspector-konling-dark'
        ? (typeof inspectorTop === 'number' ? null : `${name}:inspector-rect-missing`)
        : null,
      name.startsWith('desktop') && typeof inspectorTop === 'number'
        ? (
            inspectorTop >= 88
              ? null
              : `${name}:inspector-overlaps-app-shell-header`
          )
        : null,
      name.startsWith('tablet-') && typeof inspectorTop === 'number'
        ? (
            inspectorTop >= 314
              ? null
              : `${name}:inspector-overlaps-tablet-mobile-navigation`
          )
        : null,
      name === 'desktop-stress-expanded-tool-inspector-konling-dark'
        ? (markers.konlingInspectorAvoidance === 'active' ? null : `${name}:konling-inspector-avoidance-missing`)
        : null,
      name === 'tablet-1100-inspector-tools-konling-dark'
        ? (markers.konlingInspectorAvoidance === 'active' ? null : `${name}:konling-inspector-avoidance-missing`)
        : null,
      name === 'tablet-1024-inspector-tools-konling-dark'
        ? (markers.konlingInspectorAvoidance === 'active' ? null : `${name}:konling-inspector-avoidance-missing`)
        : null,
      name === 'tablet-1279-inspector-tools-konling-dark'
        ? (markers.konlingInspectorAvoidance === 'active' ? null : `${name}:konling-inspector-avoidance-missing`)
        : null,
      name === 'tablet-1100-inspector-tools-konling-dark'
        ? (!markerRects.activeLocalPanel ? null : `${name}:tablet-local-tool-panel-not-suspended-while-konling-open`)
        : null,
      name === 'tablet-1024-inspector-tools-konling-dark'
        ? (!markerRects.activeLocalPanel ? null : `${name}:tablet-local-tool-panel-not-suspended-while-konling-open`)
        : null,
      name === 'tablet-1279-inspector-tools-konling-dark'
        ? (!markerRects.activeLocalPanel ? null : `${name}:tablet-local-tool-panel-not-suspended-while-konling-open`)
        : null,
      name === 'tablet-1100-inspector-tools-konling-dark'
        ? (booleanFromEvidence(overlaps.inspectorOverlapsActiveLocalPanel) === false ? null : `${name}:inspector-overlaps-local-tool-panel`)
        : null,
      name === 'tablet-1024-inspector-tools-konling-dark'
        ? (booleanFromEvidence(overlaps.expandedDockOverlapsDesktopTools) === false ? null : `${name}:expanded-dock-overlaps-tools`)
        : null,
      name === 'tablet-1100-inspector-tools-konling-dark'
        ? (booleanFromEvidence(overlaps.expandedDockOverlapsDesktopTools) === false ? null : `${name}:expanded-dock-overlaps-tools`)
        : null,
      name === 'tablet-1279-inspector-tools-konling-dark'
        ? (booleanFromEvidence(overlaps.expandedDockOverlapsDesktopTools) === false ? null : `${name}:expanded-dock-overlaps-tools`)
        : null,
      name === 'desktop-stress-expanded-tool-inspector-konling-dark'
        ? (booleanFromEvidence(overlaps.expandedDockOverlapsInspector) === false ? null : `${name}:expanded-dock-overlaps-inspector`)
        : null,
      name === 'desktop-stress-expanded-tool-inspector-konling-dark'
        ? (booleanFromEvidence(overlaps.expandedDockOverlapsDesktopTools) === false ? null : `${name}:expanded-dock-overlaps-tools`)
        : null,
      isAdaptivePracticeDockState
        ? (markers.expandedDockVisible === true ? null : `${name}:expanded-dock-missing`)
        : null,
      name === 'mobile-320-inspector-konling-stress-dark'
        ? (!markerRects.inspector ? null : `${name}:mobile-inspector-not-suspended`)
        : null,
      name === 'mobile-320-inspector-konling-stress-dark'
        ? (markers.konlingMobileInspectorPolicy === 'suspend' ? null : `${name}:mobile-inspector-policy-missing`)
        : null,
      name === 'mobile-320-inspector-konling-stress-dark'
        ? (booleanFromEvidence(overlaps.expandedDockOverlapsInspector) === false ? null : `${name}:expanded-dock-overlaps-inspector`)
        : null,
      name === 'mobile-320-inspector-konling-stress-dark'
        ? (booleanFromEvidence(overlaps.dockOverlapsInspector) === false ? null : `${name}:dock-overlaps-inspector`)
        : null,
      name === 'mobile-320-inspector-konling-stress-dark'
        ? (booleanFromEvidence(overlaps.expandedDockOverlapsMobileTools) === false ? null : `${name}:expanded-dock-overlaps-mobile-tools`)
        : null,
      name.startsWith('mobile-320-konling')
        ? (booleanFromEvidence(overlaps.expandedDockOverlapsInspector) === false ? null : `${name}:expanded-dock-overlaps-inspector`)
        : null,
      name.startsWith('mobile-320-konling')
        ? (booleanFromEvidence(overlaps.dockOverlapsInspector) === false ? null : `${name}:dock-overlaps-inspector`)
        : null,
      name.startsWith('mobile-320-konling')
        ? (booleanFromEvidence(overlaps.expandedDockOverlapsMobileTools) === false ? null : `${name}:expanded-dock-overlaps-mobile-tools`)
        : null,
      name.startsWith('mobile-320-local-tools')
        ? (evidenceRectsOverlap(markerRects.dock, markerRects.mobileTools) ? `${name}:dock-overlaps-mobile-tools` : null)
        : null,
    ].filter((entry): entry is string => Boolean(entry));
  });

  const sourceEvidence = objectRecord(evidence.sourceEvidence);
  const sourceHashes = objectRecord(evidence.currentSourceSha256);
  const currentSourceSha256 = stringRecord(evidence.currentSourceSha256);
  const captureRevision = objectRecord(evidence.captureRevision);
  const captureCommitSha = typeof captureRevision.commitSha === 'string' ? captureRevision.commitSha : '';
  const captureTreeSha = typeof captureRevision.treeSha === 'string' ? captureRevision.treeSha : '';
  const captureRevisionProblems = knowledgeWorkspaceProductQaCaptureRevisionProblems({
    repositoryRoot: repoRoot,
    captureCommitSha,
    captureTreeSha,
    currentSourceSha256,
    productQaSourcePaths,
  });
  const sourceProblems = [
    ...productQaSourcePaths.map((sourcePath) => (
      typeof sourceHashes[sourcePath] === 'string' ? null : `${sourcePath}:sha-missing`
    )),
    ...Object.entries(sourceHashes).map(([sourcePath, recordedSha256]) => (
      existsSync(path.join(repoRoot, sourcePath)) && recordedSha256 === fileSha256(sourcePath)
        ? null
        : `${sourcePath}:sha-mismatch`
    )),
    sourceEvidence.sharedAppShell === true ? null : 'source-evidence:shared-app-shell',
    sourceEvidence.noCompetingGlobalNavigation === true ? null : 'source-evidence:no-competing-global-navigation',
    sourceEvidence.compactLocalTools === true ? null : 'source-evidence:compact-local-tools',
    sourceEvidence.relationFamilyControl === true ? null : 'source-evidence:relation-family-control',
    sourceEvidence.localizedLabels === true ? null : 'source-evidence:localized-labels',
    sourceEvidence.activeSummaries === true ? null : 'source-evidence:active-summaries',
    sourceEvidence.hoverDoesNotRelayout === true ? null : 'source-evidence:hover-does-not-relayout',
    sourceEvidence.selectionDoesNotRelayout === true ? null : 'source-evidence:selection-does-not-relayout',
    sourceEvidence.draggedPositionPersists === true ? null : 'source-evidence:dragged-position-persists',
    sourceEvidence.konlingSharedDock === true ? null : 'source-evidence:konling-shared-dock',
    sourceEvidence.konlingSelectedContext === true ? null : 'source-evidence:konling-selected-context',
    sourceEvidence.konlingNoSelection === true ? null : 'source-evidence:konling-no-selection',
    sourceEvidence.konlingDegradedContext === true ? null : 'source-evidence:konling-degraded-context',
    sourceEvidence.focusManagement === true ? null : 'source-evidence:focus-management',
    sourceEvidence.stressStateNonOverlap === true ? null : 'source-evidence:stress-state-non-overlap',
    sourceEvidence.rawSearchExcludedFromAssistantContext === true ? null : 'source-evidence:raw-search-excluded',
    appShellSource.includes("useState<AppShellNavigationPreference>('collapsed')")
      ? null
      : 'app-shell:collapsed-default-missing',
    appShellSource.includes('APP_SHELL_NAVIGATION_PREFERENCE_STORAGE_KEY')
      ? null
      : 'app-shell:persistence-key-missing',
    graphSource.includes('data-knowledge-workspace="canvas-first"')
      ? null
      : 'graph-source:canvas-first-missing',
    graphSource.includes('data-knowledge-desktop-command-system="compact"')
      ? null
      : 'graph-source:compact-command-system-missing',
    existsSync(path.join(repoRoot, 'src/features/knowledge/graph/relation-family-control.tsx'))
      && readFileSync(path.join(repoRoot, 'src/features/knowledge/graph/relation-family-control.tsx'), 'utf8')
        .includes('data-knowledge-relation-family-control=')
      ? null
      : 'graph-source:relation-family-control-missing',
    graphSource.includes('data-knowledge-hover-context-policy="preview-only-not-durable-context"')
      ? null
      : 'graph-source:hover-context-policy-missing',
    graphSource.includes('activeFilters: [knowledgeWorkspaceFilterSummary]')
      ? null
      : 'graph-source:assistant-filter-summary-not-sanitized',
    graphSource.includes('activeFilters: [activeFilterSummary]')
      ? 'graph-source:raw-filter-summary-leaks-to-assistant'
      : null,
    resourcePanelSource.includes('data-knowledge-inspector="floating-right-edge"')
      ? null
      : 'resource-panel:floating-right-edge-missing',
    resourcePanelSource.includes('lg:fixed')
      ? null
      : 'resource-panel:floating-fixed-position-missing',
    resourcePanelSource.includes('lg:relative')
      ? 'resource-panel:desktop-rail-layout-still-present'
      : null,
    graphSource.includes('data-knowledge-local-tool-shell="desktop"')
      ? null
      : 'graph-source:shared-local-tool-shell-missing',
    graphSource.includes('data-knowledge-local-tool-panel={desktopActiveTool}')
      ? null
      : 'graph-source:shared-local-tool-panel-marker-missing',
    graphSource.includes('data-knowledge-desktop-panel="relation-filters"')
      ? 'graph-source:relation-filter-separate-panel-still-present'
      : null,
    resourcePanelSource.includes('data-knowledge-inspector-section="infograph-preview"')
      ? null
      : 'resource-panel:infograph-preview-missing',
    konlingRuntimeSource.includes("status: 'degraded'")
      && konlingRuntimeSource.includes("knowledge-workspace-selected-node-unresolved")
      && konlingRuntimeSource.includes("const contextNodeId = hint?.status === 'degraded'")
      ? null
      : 'konling-runtime:degraded-context-missing',
  ].filter((entry): entry is string => Boolean(entry));

  const focusEvidence = Array.isArray(evidence.focusEvidence)
    ? evidence.focusEvidence.map((entry) => objectRecord(entry))
    : [];
  const focusByTarget = new Map(
    focusEvidence
      .map((entry) => [typeof entry.target === 'string' ? entry.target : '', entry] as const)
      .filter(([target]) => target.length > 0),
  );
  const focusProblems = ['desktop-local-tools', 'mobile-local-sheet', 'mobile-inspector', 'konling-expanded'].flatMap((target) => {
    const entry = focusByTarget.get(target);
    if (!entry) return [`${target}:focus-evidence-missing`];
    return [
      entry.openedFocusManaged === true ? null : `${target}:opened-focus`,
      entry.escapeOrCloseReturnsFocus === true ? null : `${target}:focus-return`,
      entry.keyboardReachable === true ? null : `${target}:keyboard-reachable`,
    ].filter((item): item is string => Boolean(item));
  });

  const handoffMatrix = objectRecord(evidence.handoffMatrix);
  const handoffMatrixPath = artifactPathFromEvidence(handoffMatrix.path);
  const adopted = stringArray(handoffMatrix.adopted);
  const rejected = stringArray(handoffMatrix.rejected);
  const merged = stringArray(handoffMatrix.merged);
  const handoffProblems = [
    handoffMatrixPath && existsSync(path.join(repoRoot, handoffMatrixPath))
      ? null
      : 'handoff-matrix:path-missing',
    adopted.includes('layered graph organization') ? null : 'handoff-matrix:layered-graph-not-adopted',
    adopted.includes('premium dark visual tone') ? null : 'handoff-matrix:dark-tone-not-adopted',
    adopted.includes('light-mode clarity') ? null : 'handoff-matrix:light-mode-not-adopted',
    rejected.includes('standalone shell duplication') ? null : 'handoff-matrix:shell-duplication-not-rejected',
    rejected.includes('generated role switchers') ? null : 'handoff-matrix:role-switcher-not-rejected',
    rejected.includes('exact mock labels') ? null : 'handoff-matrix:mock-labels-not-rejected',
    rejected.includes('exact node positions') ? null : 'handoff-matrix:node-positions-not-rejected',
    rejected.includes('duplicate assistant regions') ? null : 'handoff-matrix:duplicate-assistant-not-rejected',
    merged.includes('shared AppShell + local graph tools + right-bottom Konling dock')
      ? null
      : 'handoff-matrix:merged-shell-tool-dock-guidance-missing',
  ].filter((entry): entry is string => Boolean(entry));

  const visualReview = objectRecord(evidence.independentVisualReview);
  const visualReviewDimensions = objectRecord(visualReview.dimensions);
  const visualReviewStateSha256 = stringRecord(visualReview.reviewedStateSha256);
  const visualReviewSourceSha256 = stringRecord(visualReview.reviewedSourceSha256);
  const visualReviewPath = artifactPathFromEvidence(visualReview.path);
  const visualReviewProblems = [
    visualReviewPath && existsSync(path.join(repoRoot, visualReviewPath))
      ? null
      : 'visual-review:path-missing',
    visualReview.finalResult === 'passed' ? null : 'visual-review:not-passed',
    Array.isArray(visualReview.blockingFindings) && visualReview.blockingFindings.length === 0
      ? null
      : 'visual-review:blocking-findings',
    stringRecordsEqual(visualReviewStateSha256, stateScreenshotSha256)
      ? null
      : 'visual-review:stale-screenshot-review',
    stringRecordsEqual(visualReviewSourceSha256, currentSourceSha256)
      ? null
      : 'visual-review:stale-source-review',
    ...[
      'handoffAlignment',
      'conceptAdoptionRejection',
      'appShellContinuity',
      'localTools',
      'semanticMap',
      'inspectorHierarchy',
      'konlingDock',
      'interactionStability',
      'keyboardFocus',
      'themeParity',
      'mobileBehavior',
      'tabletBreakpoint',
      'stressNonOverlap',
      'canvasGeometry',
    ].filter((key) => visualReviewDimensions[key] !== 'PASS').map((key) => `visual-review:${key}`),
  ].filter((entry): entry is string => Boolean(entry));

  const exceptionProblems = Array.isArray(evidence.temporaryExceptions) && evidence.temporaryExceptions.length === 0
    ? []
    : ['temporary-exceptions:not-empty'];

  if (
    designProblems.length > 0
    || stateProblems.length > 0
    || captureRevisionProblems.length > 0
    || sourceProblems.length > 0
    || focusProblems.length > 0
    || handoffProblems.length > 0
    || visualReviewProblems.length > 0
    || exceptionProblems.length > 0
  ) {
    return [knowledgeGraphGovernanceViolation('Knowledge workspace product QA evidence is incomplete.', [
      `design=${designProblems.join(',') || 'none'}`,
      `states=${stateProblems.join(',') || 'none'}`,
      `captureRevision=${captureRevisionProblems.join(',') || 'none'}`,
      `source=${sourceProblems.join(',') || 'none'}`,
      `focus=${focusProblems.join(',') || 'none'}`,
      `handoff=${handoffProblems.join(',') || 'none'}`,
      `visualReview=${visualReviewProblems.join(',') || 'none'}`,
      `exceptions=${exceptionProblems.join(',') || 'none'}`,
      KNOWLEDGE_WORKSPACE_PRODUCT_QA_EVIDENCE_PATH,
    ])];
  }

  return [];
}

function validateKnowledgeGraphGovernanceEvidence(): CommercialUiGovernanceViolation[] {
  const violations: CommercialUiGovernanceViolation[] = [];
  const evidence = readJsonFile<JsonRecord>(KNOWLEDGE_GRAPH_GOVERNANCE_EVIDENCE_PATH);
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
  const floatingControlsSource = existsSync(path.join(repoRoot, 'src/components/shared/page-floating-controls.tsx'))
    ? readFileSync(path.join(repoRoot, 'src/components/shared/page-floating-controls.tsx'), 'utf8')
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
  const defaultStateProblems = [
    graphSource.includes('const [desktopActiveTool, setDesktopActiveTool] = useState<KnowledgeDesktopTool | null>(null);')
      ? null
      : 'desktopActiveTool:default-not-closed',
    graphSource.includes('data-knowledge-desktop-command-system="compact"')
      ? null
      : 'desktopCommandSystem:missing',
    graphSource.includes('const [inspection, dispatchInspection] = useReducer(')
      && graphSource.includes('const isPanelOpen = inspection.isPanelOpen;')
      ? null
      : 'resourcePanel:inspection-reducer-contract-missing',
    graphSource.includes("data-state={desktopActiveTool ? 'open' : 'closed'}")
      ? null
      : 'desktopCommandSystem:data-state-missing',
    graphSource.includes("desktopActiveTool === 'node-filters'")
      ? null
      : 'nodeFilters:command-panel-missing',
    graphSource.includes('data-knowledge-node-control={node.id}')
      && graphSource.includes('const activateNodeById = useCallback((nodeId: string) =>')
      && graphSource.includes("dispatchInspection({ type: 'inspect-node', node })")
      && !graphSource.includes('data-knowledge-node-expansion-control')
      ? null
      : 'direct-node-activation:source-contract-missing',
    graphSource.includes("aria-busy={isCollapsedRootNode(node) && navigation.view.kind === 'domain'")
      && graphSource.includes("data-error={isCollapsedRootNode(node) && navigation.view.kind === 'domain'")
      && graphSource.includes("data-filtered-empty={isCollapsedRootNode(node) && navigation.view.kind === 'domain'")
      ? null
      : 'direct-node-activation:node-state-contract-missing',
    resourcePanelSource.includes('const [activeRelationPathSection, setActiveRelationPathSection]')
      && resourcePanelSource.includes('setActiveRelationPathSection(null);')
      && resourcePanelSource.indexOf('data-knowledge-inspector-section="evidence-sources"')
        < resourcePanelSource.indexOf('inspectorSection="relation-overview"')
      ? null
      : 'inspector:single-open-accordion-contract-missing',
  ].filter((entry): entry is string => Boolean(entry));
  const missingOpenCloseEvidence = [
    'chapterDirectoryOpenClosed',
    'nodeFiltersOpenClosed',
    'viewLayoutOpenClosed',
    'resourcePanelOpenClosed',
    'selectedNodePreserved',
    'activeFiltersPreserved',
    'relationFamilyStatePreserved',
    'visibleSummariesPreserved',
  ].filter((key) => desktopOpenClose[key] !== true);

  if (
    desktopDefault.canvasPrimary !== true
    || desktopDefault.chapterDirectory !== 'compact'
    || desktopDefault.nodeFilters !== 'compact'
    || desktopDefault.relationFamilyControl !== 'compact-bottom-left'
    || desktopDefault.viewLayout !== 'compact'
    || desktopDefault.resourcePanel !== 'closed-until-node-selection'
    || desktopDefault.activeFilterSummaryWhenCollapsed !== true
    || defaultStateProblems.length > 0
    || missingOpenCloseEvidence.length > 0
  ) {
    violations.push(knowledgeGraphGovernanceViolation('Knowledge graph compact desktop tool evidence is incomplete.', [
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
  ) {
    violations.push(knowledgeGraphGovernanceViolation('Knowledge graph mobile local-tool evidence is incomplete.', [
      'mobileDefault',
      'single-tool-panel',
      'no-persistent-knowledge-drawer',
    ]));
  }

  if (
    !graphSource.includes('data-knowledge-local-panel="node-filters"')
    || !graphSource.includes('data-knowledge-mobile-drawer="view-layout"')
    || !graphSource.includes('data-knowledge-local-panel="view-layout-controls"')
    || !resourcePanelSource.includes('data-knowledge-local-panel="resource-panel"')
    || !resourcePanelSource.includes('data-knowledge-inspector="floating-right-edge"')
    || !floatingControlsSource.includes('knowledgeInspectorAvoidanceActive')
    || !floatingControlsSource.includes('data-platform-floating-dock-inspector-avoidance')
  ) {
    violations.push(knowledgeGraphGovernanceViolation('Knowledge graph local tool DOM contracts are incomplete.', [
      'node-filters',
      'mobile-view-layout',
      'view-layout-controls',
      'resource-panel',
      'floating-right-edge-inspector',
      'floating-dock-inspector-avoidance',
    ]));
  }

  violations.push(...validateKnowledgeGraphInteractionStateEvidence());
  violations.push(...validateKnowledgeGraphSemanticMapEvidence());
  violations.push(...validateKnowledgeWorkspaceToolsInspectorEvidence());
  violations.push(...validateKnowledgeWorkspaceProductQaEvidence());

  const runtimeRelationCounts = readRuntimeKnowledgeRelationCounts();
  const relationEvidence = objectRecord(evidence.runtimeRelationEvidence);
  const evidenceTypes = new Set(
    (Array.isArray(relationEvidence.types) ? relationEvidence.types : [])
      .map((entry) => objectRecord(entry))
      .map((entry) => (typeof entry.type === 'string' ? entry.type : undefined))
      .filter((type): type is string => Boolean(type)),
  );
  const runtimeRelationTypes = [...runtimeRelationCounts.keys()].sort();
  const currentCoverageGaps = assertRuntimeRelationStyleCoverage(runtimeRelationTypes);
  const currentLegendByType = new Map(getRelationLegendItems().map((item) => [item.type, item]));
  const missingRelationEvidence: string[] = [];
  for (const type of runtimeRelationTypes) {
    if (!evidenceTypes.has(type)) missingRelationEvidence.push(`${type}:evidence-sample`);
    const currentLegend = currentLegendByType.get(type);
    if (!currentLegend) missingRelationEvidence.push(`${type}:current-legend`);
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

const INTERACTIVE_VISUAL_ACCEPTANCE_ARTIFACT_PATTERN =
  /^artifacts\/interactive-learning\/.+\/implementation-acceptance\.json$/;
const INTERACTIVE_VISUAL_COMPONENT_SOURCE_PATTERNS = [
  /^src\/features\/interactive\/shared\/manifest-runtime\/(?:.*visual.*|static-surface-3d.*|activity-renderers|content-renderers|layout-renderer|module-registry-gate|module-taxonomy|.*evidence.*)\.tsx?$/,
  /^src\/features\/interactive\/unit-/,
  /^src\/app\/interactive-learning\/courses\//,
  /^src\/resources\/control-system\/charts\//,
  /^src\/resources\/control-system\/analysis\//,
] as const;

const PURE_CLIENT_BOUNDARY_REFACTOR_DIFFS: Readonly<Record<string, readonly string[]>> = {
  'src/features/interactive/unit-1-1-see-the-full-picture/student-page.tsx': [
    '-layeredGraphPayload?: LayeredGraphPayload | null;',
    '+layeredGraphPayload: LayeredGraphPayload;',
  ],
  'src/features/interactive/unit-1-1-see-the-full-picture/teacher-page.tsx': [
    '-layeredGraphPayload?: LayeredGraphPayload | null;',
    '+layeredGraphPayload: LayeredGraphPayload;',
  ],
};

function normalizeBoundaryDiffLine(line: string) {
  return `${line[0] ?? ''}${line.slice(1).trim()}`;
}

function matchesPureClientBoundaryRefactorDiff(file: string, changedLines: readonly string[]) {
  const expected = PURE_CLIENT_BOUNDARY_REFACTOR_DIFFS[file];
  if (!expected) return false;
  const actual = changedLines
    .filter((line) => /^[+-]/.test(line) && !line.startsWith('+++') && !line.startsWith('---'))
    .map(normalizeBoundaryDiffLine)
    .sort();
  return actual.length === expected.length
    && actual.every((line, index) => line === [...expected].sort()[index]);
}

function isPureClientBoundaryRefactorFile(file: string, files: readonly string[]) {
  if (!Object.hasOwn(PURE_CLIENT_BOUNDARY_REFACTOR_DIFFS, file) || !files.includes(file)) return false;
  return matchesPureClientBoundaryRefactorDiff(file, diffForFile(file).split('\n'));
}

function shouldRefreshInteractiveLearningProductQaSource(files: readonly string[]) {
  return files.some((file) => (
    INTERACTIVE_LEARNING_PRODUCT_QA_SOURCE_PREFIXES.some((prefix) => file.startsWith(prefix))
    && !isPureClientBoundaryRefactorFile(file, files)
  ));
}

function assertPureClientBoundaryRefactorGuard(files?: readonly string[]) {
  const studentFile = 'src/features/interactive/unit-1-1-see-the-full-picture/student-page.tsx';
  const teacherFile = 'src/features/interactive/unit-1-1-see-the-full-picture/teacher-page.tsx';
  const allowedStudentDiff = PURE_CLIENT_BOUNDARY_REFACTOR_DIFFS[studentFile];
  const allowedTeacherDiff = PURE_CLIENT_BOUNDARY_REFACTOR_DIFFS[teacherFile];
  for (const [file, allowedDiff] of [
    [studentFile, allowedStudentDiff],
    [teacherFile, allowedTeacherDiff],
  ] as const) {
    assert.equal(
      matchesPureClientBoundaryRefactorDiff(file, allowedDiff ?? []),
      true,
      `${file} pure client-boundary regression fixture must remain recognized`,
    );
  }
  assert.equal(
    matchesPureClientBoundaryRefactorDiff(studentFile, [...(allowedStudentDiff ?? []), '+return <div />;']),
    false,
    'client-boundary exemption must reject JSX/rendering changes',
  );
  assert.equal(
    matchesPureClientBoundaryRefactorDiff(studentFile, [
      ...(allowedStudentDiff ?? []),
      '+const changed = resolveCoursePageLayeredDrawerEntries();',
    ]),
    false,
    'client-boundary exemption must reject logic changes',
  );
  assert.equal(
    matchesPureClientBoundaryRefactorDiff('src/features/interactive/shared/step-knowledge-drawer.tsx', allowedStudentDiff ?? []),
    false,
    'deleted client boundary module must not remain an exemption fixture',
  );
  assert.equal(
    matchesPureClientBoundaryRefactorDiff('src/features/interactive/unit-1-1-see-the-full-picture/step-panels.tsx', allowedStudentDiff ?? []),
    false,
    'payload-shape exemption must remain scoped to the student and teacher entry pages',
  );
  assert.equal(
    shouldRefreshInteractiveLearningProductQaSource(['src/features/interactive/shared/step-knowledge-drawer.tsx']),
    true,
    'other interactive files must continue to refresh Product QA source evidence',
  );
  assert.equal(
    shouldRequireInteractiveLearningProductQa(['scripts/tests/test-commercial-ui-governance.ts']),
    true,
    'changing the governance script must continue to require existing Product QA evidence',
  );
  if (files) {
    const currentBoundaryFiles = Object.keys(PURE_CLIENT_BOUNDARY_REFACTOR_DIFFS)
      .filter((file) => files.includes(file));
    if (currentBoundaryFiles.length > 0) {
      assert.equal(
        currentBoundaryFiles.every((file) => isPureClientBoundaryRefactorFile(file, files)),
        true,
        'current client-boundary files must match the exact exemption diff',
      );
      assert.equal(
        shouldRequireInteractiveVisualComponentArtifacts(currentBoundaryFiles),
        false,
        'pure client-boundary files must not require visual component artifacts',
      );
      assert.equal(
        shouldRefreshInteractiveLearningProductQaSource(currentBoundaryFiles),
        false,
        'pure client-boundary files must not refresh Product QA source evidence',
      );
      const mixedFiles = [
        ...currentBoundaryFiles,
        'src/features/interactive/unit-1-1-see-the-full-picture/step-panels.tsx',
      ];
      assert.equal(
        shouldRefreshInteractiveLearningProductQaSource(mixedFiles),
        true,
        'adding another interactive source file must restore Product QA source refresh',
      );
      assert.equal(
        shouldRequireInteractiveVisualComponentArtifacts(mixedFiles),
        true,
        'adding another interactive source file must restore visual artifact requirements',
      );
    }
  }
}

const CLASSROOM_LIFECYCLE_ONLY_TEACHER_PAGE_PATTERN =
  /^src\/features\/interactive\/unit-[^/]+\/teacher-page\.tsx$/;

function isClassroomLifecycleOnlyTeacherPageDiff(file: string) {
  if (!CLASSROOM_LIFECYCLE_ONLY_TEACHER_PAGE_PATTERN.test(file)) return false;
  const meaningfulAdditions = meaningfulAddedLines(file).map((line) => line.trim()).filter(Boolean);
  const deletions = diffDeletedLines(file).map((line) => line.trim()).filter(Boolean);
  if (meaningfulAdditions.length === 0 || deletions.length === 0) return false;

  const additionsOnlyUseLifecycleDialog = meaningfulAdditions.every((line) => (
    line.includes('requestClassroomEndConfirmation')
    || line.includes('classroom-lifecycle-dialog')
  ));
  const deletionsOnlyRemoveNativeDialog = deletions.every((line) => (
    line.includes('window.confirm')
    || line.includes('confirm(')
    || line.includes('window.alert')
    || line.includes('alert(')
  ));
  return additionsOnlyUseLifecycleDialog && deletionsOnlyRemoveNativeDialog;
}

function shouldRequireInteractiveVisualComponentArtifacts(files: readonly string[]) {
  return files.some((file) => (
    INTERACTIVE_VISUAL_COMPONENT_SOURCE_PATTERNS.some((pattern) => pattern.test(file))
    && !isClassroomLifecycleOnlyTeacherPageDiff(file)
    && !isPureClientBoundaryRefactorFile(file, files)
  ));
}

function shouldRequireCompactSpacingEvidence(files: readonly string[]) {
  return files.some((file) => (
    COMPACT_SPACING_SOURCE_PATHS.includes(file)
    || file.startsWith('src/features/interactive/unit-')
    || file.startsWith('src/app/teacher/')
    || file.startsWith('src/app/(main)/')
    || file.startsWith('src/features/control-workbench/')
    || file === COMPACT_SPACING_INVENTORY_PATH
    || file === COMPACT_SPACING_EVIDENCE_PATH
    || file.startsWith('artifacts/commercial-ui/compact-spacing-685/')
    || file.startsWith('openspec/changes/standardize-sitewide-compact-spacing/')
    || (file.startsWith('openspec/changes/archive/') && file.includes('/standardize-sitewide-compact-spacing/'))
  ));
}

function readCompactSpacingInventory(): CommercialCompactSpacingInventoryEntry[] | undefined {
  const raw = readJsonFile<{ inventory?: CommercialCompactSpacingInventoryEntry[] }>(COMPACT_SPACING_INVENTORY_PATH);
  return Array.isArray(raw?.inventory) ? raw.inventory : undefined;
}

function readCompactSpacingVisualEvidence(): CommercialCompactSpacingViewportEvidence[] | undefined {
  const raw = readJsonFile<{ visualEvidence?: CommercialCompactSpacingViewportEvidence[] }>(COMPACT_SPACING_EVIDENCE_PATH);
  return Array.isArray(raw?.visualEvidence)
    ? raw.visualEvidence.map((entry) => {
      const artifact = simulationViewportArtifact(entry.screenshot);
      return {
        ...entry,
        screenshotExists: Boolean(artifact),
        screenshotSha256Matches: Boolean(artifact && entry.screenshotSha256 === artifact.sha256),
      };
    })
    : undefined;
}

function normalizeInteractiveVisualComponentArtifacts(
  raw: unknown,
): CommercialInteractiveVisualAcceptanceArtifact[] {
  const record = objectRecord(raw);
  const directArtifacts = Array.isArray(record.interactiveVisualComponentArtifacts)
    ? record.interactiveVisualComponentArtifacts
    : Array.isArray(record.components)
      ? record.components
      : [];
  const nested = objectRecord(record.interactiveVisualComponentArtifact);
  const candidates = [
    ...(directArtifacts as unknown[]),
    ...(Object.keys(nested).length > 0 ? [nested] : []),
    ...(typeof record.componentId === 'string' && typeof record.componentKind === 'string' ? [record] : []),
  ];
  return candidates
    .map((candidate) => objectRecord(candidate))
    .filter((candidate) => typeof candidate.componentId === 'string' && typeof candidate.componentKind === 'string')
    .map((candidate) => candidate as unknown as CommercialInteractiveVisualAcceptanceArtifact);
}

function interactiveVisualArtifactPathChecks(
  artifact: CommercialInteractiveVisualAcceptanceArtifact,
): NonNullable<CommercialInteractiveVisualAcceptanceArtifact['artifactPaths']> {
  const paths = [
    artifact.designContractPath,
    artifact.visualSourcePath,
    artifact.manifestAuditPath,
    artifact.testResultPath,
    artifact.browserAuditPath,
    artifact.evidenceSamplePath,
    artifact.reviewerEvidencePath,
    artifact.browserAudit?.path,
    artifact.evidenceSample?.path,
    ...(artifact.screenshots ?? []).flatMap((screenshot) => [screenshot.path, screenshot.artifact]),
  ].filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  const existing = artifact.artifactPaths ?? [];
  return [
    ...existing,
    ...paths.map((artifactPath) => ({
      path: artifactPath,
      exists: existsSync(path.join(repoRoot, artifactPath)),
      current: true,
      componentId: artifact.componentId,
    })),
  ];
}

function readInteractiveVisualComponentAcceptanceArtifacts(
  files: readonly string[],
): CommercialInteractiveVisualAcceptanceArtifact[] {
  return files
    .filter((file) => INTERACTIVE_VISUAL_ACCEPTANCE_ARTIFACT_PATTERN.test(file))
    .filter((file) => existsSync(path.join(repoRoot, file)))
    .flatMap((file) => {
      try {
        return normalizeInteractiveVisualComponentArtifacts(
          JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8')),
        ).map((artifact) => ({
          ...artifact,
          artifactPaths: interactiveVisualArtifactPathChecks(artifact),
        }));
      } catch {
        return [{
          componentId: file,
          componentKind: 'visual.stage',
          route: file,
          artifactPaths: [{ path: file, exists: true, current: false, componentId: file }],
          blockingFindings: [`${file}:parse-error`],
        } satisfies CommercialInteractiveVisualAcceptanceArtifact];
      }
    });
}

function runCommercialUiGovernanceScript() {
  const files = changedFiles();
  assertPureClientBoundaryRefactorGuard(files);
  const commercialUiBehaviorFiles = files.filter(hasNonAccessibilityOnlyDiff);
  const requiredVisualRoutes = affectedVisualRoutes(commercialUiBehaviorFiles);
  const visualEvidence = readVisualEvidenceManifest();
  const interactiveVisualComponentArtifacts = readInteractiveVisualComponentAcceptanceArtifacts(files);
  const interactiveVisualComponentArtifactsRequired = shouldRequireInteractiveVisualComponentArtifacts(files);
  const trackedFiles = git(['ls-files']).split('\n').filter(Boolean);
  interface ChangedPrimaryRouteInventoryBlock {
    href: string;
    routeFile?: string;
    coveredRouteGlob?: string;
    deleted: boolean;
  }

function primaryRouteBlockStillCoversFiles(block: ChangedPrimaryRouteInventoryBlock) {
  if (block.routeFile && existsSync(path.join(repoRoot, block.routeFile))) return true;
  if (!block.coveredRouteGlob) return false;
  return trackedFiles.some((file) => (
    matchesCoveredRouteFile(file, block.coveredRouteGlob)
    && existsSync(path.join(repoRoot, file))
  ));
}

function changedPrimaryRouteInventoryBlocks() {
  const blocks = new Map<string, ChangedPrimaryRouteInventoryBlock>();
  let blockChanged = false;
  let blockHref: string | undefined;
  let blockRouteFile: string | undefined;
  let blockCoveredRouteGlob: string | undefined;
  let blockHasCurrentHrefLine = false;
  let inPrimaryRouteBlock = false;

  const finishBlock = () => {
    if (blockChanged && blockHref) {
      blocks.set(blockHref, {
        href: blockHref,
        routeFile: blockRouteFile,
        coveredRouteGlob: blockCoveredRouteGlob,
        deleted: !blockHasCurrentHrefLine,
      });
    }
    blockChanged = false;
    blockHref = undefined;
    blockRouteFile = undefined;
    blockCoveredRouteGlob = undefined;
    blockHasCurrentHrefLine = false;
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
    if (href && marker !== '-') {
      blockHref = href;
      blockHasCurrentHrefLine = true;
    }
    if (href && !blockHref) blockHref = href;
    const routeFile = /routeFile:\s*'([^']+)'/.exec(content)?.[1];
    if (routeFile && !blockRouteFile) blockRouteFile = routeFile;
    if (routeFile && marker !== '-') blockRouteFile = routeFile;
    const coveredRouteGlob = /coveredRouteGlob:\s*'([^']+)'/.exec(content)?.[1];
    if (coveredRouteGlob && !blockCoveredRouteGlob) blockCoveredRouteGlob = coveredRouteGlob;
    if (coveredRouteGlob && marker !== '-') blockCoveredRouteGlob = coveredRouteGlob;
    if (/^\s*}\),/.test(content)) finishBlock();
  }
  if (inPrimaryRouteBlock) finishBlock();
  return [...blocks.values()];
}
const changedPrimaryRouteBlocks = changedPrimaryRouteInventoryBlocks();
const changedPrimaryRouteHrefs = new Set(changedPrimaryRouteBlocks.map((block) => block.href));
const currentPrimaryRouteHrefs = new Set(PLATFORM_PRIMARY_ROUTE_INVENTORY.map((route) => route.href));
assertCoveredRouteGlobDoesNotHideStaticPages();
const missingChangedPrimaryRouteLedgerViolations: CommercialUiGovernanceViolation[] = changedPrimaryRouteBlocks
  .filter((block) => !currentPrimaryRouteHrefs.has(block.href))
  .filter((block) => !block.deleted || primaryRouteBlockStillCoversFiles(block))
  .map((block) => ({
    path: block.href,
    rule: 'route-ledger.incomplete-primary-route',
    message: 'Changed primary route inventory href no longer resolves to a current route ledger entry.',
    evidence: ['missing-current-inventory-entry'],
  }));
const missingChangedAppPageLedgerViolations: CommercialUiGovernanceViolation[] = files
  .filter(hasNonAccessibilityOnlyDiff)
  .map(appPageRouteHref)
  .filter((href): href is string => Boolean(href))
  .filter((href) => !currentPrimaryRouteHrefs.has(href) && !resolvePlatformRouteInventory(href))
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
const interactiveLearningProductQaRequired = shouldRequireInteractiveLearningProductQa(files);
const interactiveLearningProductQaSourceRefreshRequired = shouldRefreshInteractiveLearningProductQaSource(files);
const interactiveLearningProductQaEvidenceRefreshed = interactiveLearningProductQaEvidenceCoversLatestSource(files);
const adaptivePathProductQaRequired = shouldRequireAdaptivePathProductQa(files);
const adaptivePathProductQaSourceRefreshRequired = files.some(adaptivePathSourceFileChanged);
const adaptivePathProductQaEvidenceRefreshed = adaptivePathProductQaEvidenceCoversLatestSource(files);
const compactSpacingRequired = shouldRequireCompactSpacingEvidence(files);
const result = evaluateCommercialUiGovernance({
  mode: 'blocking',
  today,
  sourceViolations: [
    ...buildSourceViolations(files),
    ...buildSimulationResourcePaletteViolations(files),
    ...missingChangedPrimaryRouteLedgerViolations,
    ...missingChangedAppPageLedgerViolations,
    ...validateKnowledgeGraphGovernanceEvidence(),
  ],
  shellInventory: buildShellInventory(commercialUiBehaviorFiles),
  moduleChromeInventory: buildModuleChromeInventory(commercialUiBehaviorFiles),
  statusInventory: buildStatusInventory(commercialUiBehaviorFiles),
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
  interactiveLearningProductQaRequired,
  interactiveLearningProductQaSourceRefreshRequired,
  interactiveLearningProductQaEvidenceRefreshed,
  interactiveLearningProductQa: interactiveLearningProductQaRequired
    ? readInteractiveLearningProductQaEvidence()
    : undefined,
  interactiveVisualComponentArtifactsRequired,
  interactiveVisualComponentArtifacts,
  adaptivePathProductQaRequired,
  adaptivePathProductQaSourceRefreshRequired,
  adaptivePathProductQaEvidenceRefreshed,
  adaptivePathProductQa: adaptivePathProductQaRequired
    ? readAdaptivePathProductQaEvidence()
    : undefined,
  compactSpacingRequired,
  compactSpacingInventory: compactSpacingRequired ? readCompactSpacingInventory() : undefined,
  compactSpacingVisualEvidence: compactSpacingRequired ? readCompactSpacingVisualEvidence() : undefined,
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
}

if (require.main === module) {
  runCommercialUiGovernanceScript();
}
