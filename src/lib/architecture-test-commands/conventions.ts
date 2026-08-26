import { assignOwner } from '@/lib/architecture-charter/assign';

import type { CommandContract, ExclusionRule, GovernedCommandId, TestLayer, TestRoot } from './types';

export const NAMING_RULES = [
  '**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}',
  '**/test_*.py',
  '**/tests/*.rs',
  '**/*_test.rs',
  'scripts/tests/**/*.{ts,tsx,js,mjs,mts,cts,py}',
] as const;

const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts)$/u;
const PYTHON_TEST = /(?:^|\/)test_[^/]+\.py$/u;
const RUST_TEST = /(?:^|\/)(?:tests\/[^/]+\.rs|.+_test\.rs)$/u;
const SCRIPT_TEST = /^scripts\/tests\/.+\.(?:ts|tsx|js|mjs|mts|cts|py)$/u;

export function matchesTestNamingConvention(path: string): boolean {
  return TEST_FILE.test(path) || PYTHON_TEST.test(path) || RUST_TEST.test(path) || SCRIPT_TEST.test(path);
}

export const DECLARED_ROOTS: readonly TestRoot[] = [
  { id: 'src', prefix: 'src/', owner: 'platform' },
  { id: 'tests', prefix: 'tests/', owner: 'platform' },
  { id: 'scripts-tests', prefix: 'scripts/tests/', owner: 'platform' },
  { id: 'scripts-knowledge-inventory', prefix: 'scripts/knowledge-governance/input-inventory/__tests__/', owner: 'knowledge' },
  { id: 'course-content', prefix: 'course-content/', owner: 'course' },
  { id: 'rust-control-engine', prefix: 'rust/control-engine/tests/', owner: 'practice-lab' },
];

export const EXCLUSION_RULES: readonly ExclusionRule[] = [
  {
    id: 'fixtures',
    owner: 'platform',
    reason: 'non-executable-fixture',
    removalCondition: 'rename-to-supported-test-naming-if-it-becomes-a-test',
    match: (path) => /(^|\/)fixtures\//u.test(path) || /\.fixture\.(?:ts|tsx|js)$/u.test(path),
  },
  {
    id: 'artifacts-evidence',
    owner: 'platform',
    reason: 'run-specific-evidence-not-a-test',
    removalCondition: 'consume-through-test-release-manifest',
    match: (path) => path.startsWith('artifacts/'),
  },
  {
    id: 'agent-skill-tests',
    owner: 'platform',
    reason: 'skill-self-test-outside-product-command-matrix',
    removalCondition: 'join-nightly-when-skill-tests-are-governed',
    match: (path) => path.startsWith('.agents/'),
  },
];

const CRITICAL_E2E = new Set([
  'tests/platform-entrypoints.spec.ts',
  'tests/primary-appshell-chrome.spec.ts',
  'tests/interactive-learning-entry-routes.spec.ts',
  'tests/role-workspace-appshell-navigation-801.spec.ts',
  'tests/appshell-governance-representative-matrix.spec.ts',
  'tests/theme-init-script.spec.ts',
  'tests/mobile-a11y-shell.spec.ts',
]);

const RELEASE_IDENTITIES = new Set([
  'scripts/tests/test-commercial-ui-governance.ts',
  'scripts/tests/teacher-diagnosis-report-history-evidence.ts',
  'scripts/tests/test-platform-brand-kit-evidence.ts',
]);

export const PR_EXTRA_IDENTITIES = [
  'src/lib/__tests__/test-command-contracts.test.ts',
  'scripts/tests/smoke-test.mjs',
  'scripts/tests/test-arena-home-entry.mjs',
  'scripts/tests/test-arena-routes.mjs',
] as const;

export const UNIT_GLOBS = ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'] as const;
export const UNIT_EXCLUDE_GLOBS = [
  'src/app/api/**',
  '**/*.integration.test.*',
  '**/*.real-db.*',
  '**/*.real-smoke.test.*',
] as const;
export const CONTRACT_GLOBS = [
  'src/app/api/**/__tests__/**/*.{test,spec}.{ts,tsx}',
  'scripts/knowledge-governance/input-inventory/__tests__/**/*.test.ts',
] as const;
export const INTEGRATION_GLOBS = [
  'src/**/__tests__/**/*.integration.test.{ts,tsx}',
  'src/**/__tests__/**/*.real-db*.{ts,tsx}',
] as const;

function ownerFor(path: string): string {
  return assignOwner({
    id: `test:${path}`,
    kind: 'test',
    identity: path,
    evidence: [path],
  });
}

export function classifyLayer(path: string): { layer: TestLayer; rule: string; owner: string } | null {
  const owner = ownerFor(path);
  if (RELEASE_IDENTITIES.has(path)) {
    return { layer: 'release', rule: 'release-evidence-consumer', owner };
  }
  if (/\.(?:integration|real-db)(?:\.|test)/u.test(path)) {
    return { layer: 'integration', rule: 'integration-vitest-name', owner };
  }
  if (/\.real-smoke\.test\./u.test(path) || /(?:real-e2e|real-provider|wolfram|visual-acceptance|performance\.spec)/iu.test(path)) {
    return { layer: 'nightly', rule: 'environment-sensitive-or-visual', owner };
  }
  if (
    (path.startsWith('src/app/api/') && TEST_FILE.test(path))
    || path.startsWith('scripts/knowledge-governance/input-inventory/__tests__/')
  ) {
    return { layer: 'contract', rule: 'api-or-inventory-contract', owner };
  }
  if (CRITICAL_E2E.has(path)) {
    return { layer: 'e2e-critical', rule: 'critical-user-journey-allowlist', owner };
  }
  if (path.startsWith('tests/') && path.endsWith('.spec.ts')) {
    return { layer: 'nightly', rule: 'playwright-non-critical', owner };
  }
  if (path.startsWith('src/') && TEST_FILE.test(path)) {
    return { layer: 'unit', rule: 'src-domain-unit', owner };
  }
  return { layer: 'nightly', rule: 'remainder-nightly', owner };
}

export function matchDeclaredRoot(path: string): TestRoot | null {
  const matches = DECLARED_ROOTS.filter((root) => path.startsWith(root.prefix));
  if (matches.length === 0) return null;
  return matches.sort((left, right) => right.prefix.length - left.prefix.length)[0] ?? null;
}

export function globToRegExp(glob: string): RegExp {
  let index = 0;
  let pattern = '^';
  const source = glob.replaceAll('\\', '/');
  while (index < source.length) {
    if (source.startsWith('**/', index) || (source.startsWith('**', index) && index + 2 === source.length)) {
      pattern += '.*';
      index += source[index + 2] === '/' ? 3 : 2;
      continue;
    }
    const current = source[index] ?? '';
    if (current === '*') {
      pattern += '[^/]*';
      index += 1;
      continue;
    }
    if (current === '?') {
      pattern += '[^/]';
      index += 1;
      continue;
    }
    if (current === '{') {
      const end = source.indexOf('}', index);
      const inner = source.slice(index + 1, end).split(',').map((part) => part.replace(/[.+^$()|[\]\\]/gu, '\\$&')).join('|');
      pattern += `(?:${inner})`;
      index = end + 1;
      continue;
    }
    pattern += current.replace(/[.+^${}()|[\]\\]/gu, '\\$&');
    index += 1;
  }
  pattern += '$';
  return new RegExp(pattern);
}

export function matchesGlob(path: string, glob: string): boolean {
  const normalized = path.replaceAll('\\', '/');
  if (glob.endsWith('/**') && normalized.startsWith(`${glob.slice(0, -3)}/`)) return true;
  return globToRegExp(glob).test(normalized);
}

export function matchesAnyGlob(path: string, globs: readonly string[]): boolean {
  return globs.some((glob) => matchesGlob(path, glob));
}

function contract(partial: CommandContract): CommandContract {
  return partial;
}

export const COMMAND_CONTRACTS: readonly CommandContract[] = [
  contract({
    id: 'test',
    npmScript: 'test',
    scope: 'pr-default-deterministic-fast-mandatory',
    layers: [],
    extraIdentities: [...PR_EXTRA_IDENTITIES],
    excludedScopes: ['release-evidence', 'nightly-visual', 'postgres', 'playwright-full'],
    requiredInputs: [],
    executionGlobs: [],
    executionIdentities: [...PR_EXTRA_IDENTITIES],
    remainderExecution: false,
    ciWorkflow: '.github/workflows/ci.yml',
    ciJob: 'quality',
    historicalComponents: [
      { npmScript: 'test:smart-courseware', owner: 'course', role: 'pr-fast-component' },
      { npmScript: 'test:commercial-ui-governance', owner: 'platform', role: 'moved-to-test-release' },
    ],
  }),
  contract({
    id: 'test:unit',
    npmScript: 'test:unit',
    scope: 'all-domain-pure-unit-tests',
    layers: ['unit'],
    extraIdentities: [],
    excludedScopes: ['contract-api', 'integration-datastore', 'e2e', 'release-evidence'],
    requiredInputs: [],
    executionGlobs: [...UNIT_GLOBS],
    executionIdentities: [],
    remainderExecution: false,
    ciWorkflow: null,
    ciJob: null,
    historicalComponents: [],
  }),
  contract({
    id: 'test:contract',
    npmScript: 'test:contract',
    scope: 'api-event-manifest-bundle-wasm-facade-boundaries',
    layers: ['contract'],
    extraIdentities: [],
    excludedScopes: ['unit', 'release-evidence'],
    requiredInputs: [],
    executionGlobs: [...CONTRACT_GLOBS],
    executionIdentities: [],
    remainderExecution: false,
    ciWorkflow: null,
    ciJob: null,
    historicalComponents: [{ npmScript: 'test:course-knowledge-input-inventory', owner: 'knowledge', role: 'inventory-contract-runner' }],
  }),
  contract({
    id: 'test:integration',
    npmScript: 'test:integration',
    scope: 'postgres-redis-worker-repository-filesystem-adapters',
    layers: ['integration'],
    extraIdentities: [],
    excludedScopes: ['playwright-e2e', 'release-evidence'],
    requiredInputs: [],
    executionGlobs: [...INTEGRATION_GLOBS],
    executionIdentities: [],
    remainderExecution: false,
    ciWorkflow: null,
    ciJob: null,
    historicalComponents: [
      { npmScript: 'test:e2e:playwright', owner: 'platform', role: 'former-test-integration-playwright-bundle' },
      { npmScript: 'test:data-governance', owner: 'learning-record', role: 'postgres-scripts-remain-nightly-until-executed' },
    ],
  }),
  contract({
    id: 'test:e2e:critical',
    npmScript: 'test:e2e:critical',
    scope: 'critical-user-journeys-only',
    layers: ['e2e-critical'],
    extraIdentities: [],
    excludedScopes: ['visual-acceptance', 'performance', 'real-provider'],
    requiredInputs: [],
    executionGlobs: [],
    executionIdentities: [...CRITICAL_E2E],
    remainderExecution: false,
    ciWorkflow: null,
    ciJob: null,
    historicalComponents: [{ npmScript: 'test:e2e:playwright', owner: 'platform', role: 'full-playwright-bundle' }],
  }),
  contract({
    id: 'test:release',
    npmScript: 'test:release',
    scope: 'explicit-release-qualification-evidence',
    layers: ['release'],
    extraIdentities: [],
    excludedScopes: ['product-behavior-tests'],
    requiredInputs: ['qualification-manifest'],
    executionGlobs: [],
    executionIdentities: [...RELEASE_IDENTITIES],
    remainderExecution: false,
    ciWorkflow: null,
    ciJob: null,
    historicalComponents: [{ npmScript: 'test:commercial-ui-governance', owner: 'platform', role: 'release-evidence-validator' }],
  }),
  contract({
    id: 'test:nightly',
    npmScript: 'test:nightly',
    scope: 'full-visual-performance-real-provider-smoke',
    layers: ['nightly'],
    extraIdentities: [],
    excludedScopes: ['pr-default'],
    requiredInputs: [],
    executionGlobs: [],
    executionIdentities: [],
    remainderExecution: true,
    ciWorkflow: null,
    ciJob: null,
    historicalComponents: [],
  }),
];

export function commandContract(id: GovernedCommandId): CommandContract {
  const found = COMMAND_CONTRACTS.find((item) => item.id === id);
  if (!found) throw new Error(`unknown-command:${id}`);
  return found;
}

export function isUnitExcluded(path: string): boolean {
  return matchesAnyGlob(path, UNIT_EXCLUDE_GLOBS);
}
