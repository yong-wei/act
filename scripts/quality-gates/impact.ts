import {
  DEFAULT_QUALITY_GATE_REGISTRY,
  type QualityGateRegistry,
} from './registry';

export const IMPACT_DENOMINATOR_KEYS = [
  'dependency-graph',
  'typescript-graph',
  'test-discovery',
  'owner-map',
  'migration-scope',
  'package-scope',
  'workflow-scope',
  'release-scope',
] as const;

export type ImpactDenominatorKey = (typeof IMPACT_DENOMINATOR_KEYS)[number];
export type ImpactDomain = 'web' | 'worker' | 'tools' | 'test' | 'database' | 'release' | 'shared' | 'unknown';
export type ImpactScope = 'affected' | 'full-related' | 'blocked';

export interface ImpactDenominator {
  readonly [key: string]: boolean | undefined;
}

export interface ImpactSelectionInput {
  readonly changedPaths: readonly string[];
  readonly denominator?: ImpactDenominator;
  readonly canExpandToFullScope?: boolean;
  readonly registry?: QualityGateRegistry;
}

export interface ImpactSelection {
  readonly scope: ImpactScope;
  readonly denominatorClosed: boolean;
  readonly affectedDomains: readonly ImpactDomain[];
  readonly requiredCheckIds: readonly string[];
  readonly fallbackReason: string | null;
  readonly unresolvedInputs: readonly ImpactDenominatorKey[];
}

function normalize(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//u, '');
}

export function classifyImpactPath(path: string): readonly ImpactDomain[] {
  const normalized = normalize(path);
  if (!normalized) return ['unknown'];
  if (
    normalized === 'package.json'
    || normalized === 'package-lock.json'
    || /^tsconfig(?:\.|$)/u.test(normalized)
    || /^vitest(?:\.|$)/u.test(normalized)
    || /^playwright(?:\.|$)/u.test(normalized)
    || normalized.startsWith('.github/workflows/')
    || normalized.startsWith('scripts/quality-gates/')
    || normalized.startsWith('scripts/typescript-graphs/')
    || normalized.startsWith('src/lib/architecture-census/')
    || normalized.startsWith('src/lib/architecture-charter/')
    || normalized.startsWith('src/lib/architecture-fitness/')
    || normalized.startsWith('src/lib/architecture-test-commands/')
  ) return ['shared'];
  if (normalized.startsWith('prisma/')) return ['database'];
  if (normalized.startsWith('docs/architecture/') || normalized.startsWith('openspec/')) return ['release', 'shared'];
  if (normalized.startsWith('scripts/workers/') || normalized.startsWith('scripts/assignments/')) return ['worker'];
  if (normalized.startsWith('scripts/tests/') || normalized.startsWith('tests/') || /\/__(?:tests?|fixtures?)\//u.test(normalized) || /\.(?:test|spec)\./u.test(normalized)) return ['test'];
  if (normalized.startsWith('scripts/')) return ['tools'];
  if (normalized.startsWith('src/')) return ['web'];
  if (normalized.startsWith('course-content/') || normalized.startsWith('deploy/')) return ['release'];
  return ['unknown'];
}

function allPrChecks(registry: QualityGateRegistry): string[] {
  return registry.checks
    .filter((item) => item.layer === 'pr' && item.required)
    .map((item) => item.checkId)
    .sort();
}

function selectedPrChecks(domains: readonly ImpactDomain[], registry: QualityGateRegistry): string[] {
  const checks = new Set<string>();
  const has = (id: string) => registry.checks.some((item) => item.layer === 'pr' && item.checkId === id);
  for (const checkId of [
    'pr/architecture-fitness',
    'pr/affected-lint',
    'pr/typecheck-web',
    'pr/typecheck-worker',
    'pr/typecheck-tools',
    'pr/typecheck-test',
    'pr/contract',
  ]) if (has(checkId)) checks.add(checkId);
  if (domains.length > 0 && has('pr/affected-unit')) checks.add('pr/affected-unit');
  if (domains.some((domain) => ['database', 'shared', 'release'].includes(domain)) && has('pr/prisma-migration')) checks.add('pr/prisma-migration');
  if (domains.some((domain) => ['web', 'worker', 'test', 'shared'].includes(domain)) && has('pr/critical-e2e')) checks.add('pr/critical-e2e');
  return [...checks].sort();
}

export function observeImpactDenominators(_repoRoot: string): Record<ImpactDenominatorKey, boolean> {
  return {
    'dependency-graph': false,
    'typescript-graph': false,
    'test-discovery': false,
    'owner-map': false,
    'migration-scope': false,
    'package-scope': false,
    'workflow-scope': false,
    'release-scope': false,
  };
}

function unresolvedDenominators(input: ImpactSelectionInput): ImpactDenominatorKey[] {
  return IMPACT_DENOMINATOR_KEYS.filter((key) => input.denominator?.[key] !== true);
}

export function selectPrImpact(input: ImpactSelectionInput): ImpactSelection {
  const registry = input.registry ?? DEFAULT_QUALITY_GATE_REGISTRY;
  const changedPaths = [...new Set(input.changedPaths.map(normalize).filter(Boolean))].sort();
  const unresolvedInputs = unresolvedDenominators(input);
  const denominatorClosed = unresolvedInputs.length === 0 && changedPaths.length > 0;
  const expand = input.canExpandToFullScope !== false;
  if (changedPaths.length === 0) {
    return {
      scope: 'blocked',
      denominatorClosed: false,
      affectedDomains: ['unknown'],
      requiredCheckIds: allPrChecks(registry),
      fallbackReason: 'empty-change-denominator',
      unresolvedInputs: [],
    };
  }
  if (unresolvedInputs.length > 0) {
    const domains: ImpactDomain[] = ['web', 'worker', 'tools', 'test', 'database', 'release', 'shared'];
    return {
      scope: expand ? 'full-related' : 'blocked',
      denominatorClosed: false,
      affectedDomains: domains,
      requiredCheckIds: allPrChecks(registry),
      fallbackReason: expand ? `impact-denominator-incomplete:${unresolvedInputs.join(',')}` : `impact-denominator-unresolved:${unresolvedInputs.join(',')}`,
      unresolvedInputs,
    };
  }
  const domains = [...new Set(changedPaths.flatMap(classifyImpactPath))].sort() as ImpactDomain[];
  if (domains.includes('unknown') || domains.includes('shared')) {
    return {
      scope: 'full-related',
      denominatorClosed: true,
      affectedDomains: domains.includes('shared') ? ['web', 'worker', 'tools', 'test', 'database', 'release', 'shared'] : domains,
      requiredCheckIds: allPrChecks(registry),
      fallbackReason: domains.includes('unknown') ? 'unclassified-change-path' : 'shared-boundary-change',
      unresolvedInputs: [],
    };
  }
  return {
    scope: 'affected',
    denominatorClosed: true,
    affectedDomains: domains,
    requiredCheckIds: selectedPrChecks(domains, registry),
    fallbackReason: null,
    unresolvedInputs: [],
  };
}
