#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const REACT_DOCTOR_VERSION = '0.5.1';
const INCLUDED_ROOTS = [
  'src/',
  'scripts/',
  'docs/',
  'openspec/',
  'package.json',
  'doctor.config',
  'eslint.config',
  'next.config',
  'playwright.config',
  'postcss.config',
  'prisma.config',
  'tailwind.config',
  'tsconfig',
  'vitest.config',
];
const EXCLUDED_ROOTS = [
  'evaluate/',
  'node_modules/',
  '.next/',
  '.turbo/',
  'artifacts/',
  'coverage/',
  'dist/',
  'build/',
  'out/',
  'public/vendor/',
];
const VALID_MODES = new Set(['errors', 'security', 'warnings']);
const PRODUCT_RISK_WARNING_RULES = new Set([
  'button-has-type',
  'control-has-associated-label',
  'click-events-have-key-events',
  'label-has-associated-control',
  'media-has-caption',
  'nextjs-no-use-search-params-without-suspense',
  'no-pass-data-to-parent',
]);
const MECHANICAL_CLEANUP_WARNING_RULES = new Set([
  'nextjs-missing-metadata',
  'only-export-components',
  'unused-export',
  'unused-file',
]);

function argValue(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

const mode = argValue('--mode') || 'errors';
const outputPath = argValue('--output');
if (!VALID_MODES.has(mode)) {
  console.error(`Unknown React Doctor owned-surface mode: ${mode}`);
  process.exit(2);
}

function parseReactDoctorJson(stdout) {
  const start = stdout.indexOf('{');
  if (start < 0) throw new Error('React Doctor did not emit JSON output.');
  return JSON.parse(stdout.slice(start));
}

function normalizePath(filePath) {
  const value = String(filePath || '');
  const repoRelative = isAbsolute(value) ? relative(process.cwd(), value) : value;
  return repoRelative.replaceAll('\\', '/').replace(/^\.\//, '');
}

function isExcluded(filePath) {
  const normalized = normalizePath(filePath);
  return EXCLUDED_ROOTS.some((root) => normalized === root.slice(0, -1) || normalized.startsWith(root));
}

function isIncluded(filePath) {
  const normalized = normalizePath(filePath);
  return INCLUDED_ROOTS.some((root) => normalized === root || normalized.startsWith(root));
}

function isOwnedDiagnostic(diagnostic) {
  const filePath = normalizePath(diagnostic.filePath);
  return filePath.length > 0 && isIncluded(filePath) && !isExcluded(filePath);
}

function modeKeepsDiagnostic(diagnostic) {
  if (mode === 'errors') return diagnostic.severity === 'error';
  if (mode === 'security') return diagnostic.category === 'Security';
  return diagnostic.severity === 'warning';
}

function surfaceFor(filePath) {
  const normalized = normalizePath(filePath);
  if (normalized.startsWith('src/app/')) return 'app';
  if (normalized.startsWith('src/features/')) return 'features';
  if (normalized.startsWith('src/components/')) return 'components';
  if (normalized.startsWith('src/resources/')) return 'resources';
  if (normalized.startsWith('src/hooks/')) return 'hooks';
  if (normalized.startsWith('src/types/')) return 'types';
  if (normalized.startsWith('src/lib/')) return 'lib';
  if (normalized.startsWith('scripts/')) return 'scripts';
  if (normalized.startsWith('docs/')) return 'docs';
  if (normalized.startsWith('openspec/')) return 'openspec';
  return normalized.split('/')[0] || 'root';
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function groupedSummary(diagnostics) {
  const severity = new Map();
  const category = new Map();
  const rule = new Map();
  const surface = new Map();
  const file = new Map();
  for (const diagnostic of diagnostics) {
    increment(severity, diagnostic.severity || 'unknown');
    increment(category, diagnostic.category || 'unknown');
    increment(rule, diagnostic.rule || 'unknown');
    increment(surface, surfaceFor(diagnostic.filePath));
    increment(file, normalizePath(diagnostic.filePath) || 'unknown');
  }
  const toObject = (map) => Object.fromEntries([...map.entries()].sort((left, right) => left[0].localeCompare(right[0])));
  return {
    bySeverity: toObject(severity),
    byCategory: toObject(category),
    byRule: toObject(rule),
    byOwnedSurface: toObject(surface),
    byFile: toObject(file),
  };
}

function isR3FOrThreeFile(filePath) {
  const normalized = normalizePath(filePath);
  return normalized.startsWith('src/resources/simulations/');
}

function warningBucketFor(diagnostic) {
  const rule = diagnostic.rule || 'unknown';
  if (rule === 'no-unknown-property' && isR3FOrThreeFile(diagnostic.filePath)) return 'tool-noise';
  if (PRODUCT_RISK_WARNING_RULES.has(rule)) return 'product-risk';
  if (MECHANICAL_CLEANUP_WARNING_RULES.has(rule)) return 'mechanical-cleanup';
  return 'deferred';
}

function buildAdvisoryBaseline(diagnostics) {
  const buckets = {
    'product-risk': { total: 0, rules: {} },
    'mechanical-cleanup': { total: 0, rules: {} },
    'tool-noise': { total: 0, rules: {} },
    deferred: { total: 0, rules: {} },
  };
  const ruleClassifications = {};
  const toolNoiseCandidateFiles = new Set();
  const domRiskFiles = new Set();

  for (const diagnostic of diagnostics) {
    const rule = diagnostic.rule || 'unknown';
    const bucket = warningBucketFor(diagnostic);
    buckets[bucket].total += 1;
    buckets[bucket].rules[rule] = (buckets[bucket].rules[rule] || 0) + 1;
    ruleClassifications[rule] ??= bucket;

    if (rule === 'no-unknown-property') {
      if (bucket === 'tool-noise') {
        toolNoiseCandidateFiles.add(normalizePath(diagnostic.filePath));
        ruleClassifications[rule] = 'tool-noise';
      } else {
        domRiskFiles.add(normalizePath(diagnostic.filePath));
      }
    }
  }

  return {
    buckets,
    ruleClassifications: Object.fromEntries(
      Object.entries(ruleClassifications).sort((left, right) => left[0].localeCompare(right[0]))
    ),
    r3fThreeNoUnknownProperty: {
      toolNoiseCandidateFiles: [...toolNoiseCandidateFiles].sort(),
      domRiskFiles: [...domRiskFiles].sort(),
    },
  };
}

function buildCommand() {
  const args = ['--yes', `react-doctor@${REACT_DOCTOR_VERSION}`, '--no-score', '--no-telemetry', '--json', '.'];
  if (mode === 'errors') args.splice(args.length - 2, 0, '--no-warnings');
  const override = process.env.REACT_DOCTOR_NPX_COMMAND;
  if (override) return { command: process.execPath, args: [override, ...args] };
  return { command: process.platform === 'win32' ? 'npx.cmd' : 'npx', args };
}

const { command, args } = buildCommand();
const result = spawnSync(command, args, {
  cwd: process.cwd(),
  encoding: 'utf8',
  maxBuffer: 128 * 1024 * 1024,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

let parsed;
try {
  parsed = parseReactDoctorJson(result.stdout || '');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (result.stderr) console.error(result.stderr);
  process.exit(1);
}

if (parsed.ok === false) {
  console.error(parsed.error || `React Doctor scan failed with status ${result.status ?? 'unknown'}.`);
  if (result.stderr) console.error(result.stderr);
  process.exit(1);
}

const rawDiagnostics = Array.isArray(parsed.diagnostics)
  ? parsed.diagnostics
  : (parsed.projects || []).flatMap((project) => project.diagnostics || []);
const ownedDiagnostics = rawDiagnostics.filter(isOwnedDiagnostic);
const diagnostics = ownedDiagnostics.filter(modeKeepsDiagnostic).map((diagnostic) => ({
  filePath: normalizePath(diagnostic.filePath),
  severity: diagnostic.severity,
  category: diagnostic.category,
  rule: diagnostic.rule,
  title: diagnostic.title,
  line: diagnostic.line,
  column: diagnostic.column,
}));
const report = {
  schemaVersion: 1,
  tool: 'react-doctor',
  reactDoctorVersion: REACT_DOCTOR_VERSION,
  mode,
  localOnly: true,
  ciRequired: false,
  command: `${command} ${args.join(' ')}`,
  includedRoots: INCLUDED_ROOTS,
  excludedRoots: EXCLUDED_ROOTS,
  totals: {
    rawDiagnostics: rawDiagnostics.length,
    ownedDiagnostics: ownedDiagnostics.length,
    selectedDiagnostics: diagnostics.length,
    fixtureNoiseDiagnostics: rawDiagnostics.length - ownedDiagnostics.length,
  },
  summary: groupedSummary(diagnostics),
  diagnostics,
};
if (mode === 'warnings') {
  report.advisoryBaseline = buildAdvisoryBaseline(diagnostics);
}

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serialized);
}
process.stdout.write(serialized);

process.exitCode = mode === 'warnings' || diagnostics.length === 0 ? 0 : 1;
