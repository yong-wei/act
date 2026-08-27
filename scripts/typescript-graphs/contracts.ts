import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { serializeDeterministic, sha256Text } from '../../src/lib/architecture-census/serialize.ts';

export const GRAPH_MANIFEST_SCHEMA_VERSION = 'act-typescript-graph-manifest/v1' as const;
export const GRAPH_MEASUREMENT_RECEIPT_SCHEMA_VERSION = 'act-typescript-graph-measurement-receipt/v1' as const;
export const GRAPH_CONTRACT_SCHEMA_VERSION = 'act-typescript-graph-contract/v1' as const;

export const GRAPH_IDS = ['web', 'worker', 'tools', 'test'] as const;
export type GraphId = (typeof GRAPH_IDS)[number];
export type GraphKind = 'production' | 'tooling' | 'test';
export type GraphResultStatus = 'passed' | 'failed' | 'blocked';

export interface GraphDefinition {
  readonly id: GraphId;
  readonly kind: GraphKind;
  readonly configPath: string;
  readonly command: `typecheck:${GraphId}`;
  readonly scope: string;
  readonly fixturePath: string;
  readonly entrypointRoots: readonly string[];
  readonly requiredExcludeRoots: readonly string[];
  readonly mandatoryBeforeRelease: boolean;
}

export const GRAPH_DEFINITIONS: readonly GraphDefinition[] = [
  {
    id: 'web',
    kind: 'production',
    configPath: 'tsconfig.web.json',
    command: 'typecheck:web',
    scope: 'production-web-app-router',
    fixturePath: 'typescript-graph-fixtures/web.ts',
    entrypointRoots: ['src/app', 'src/components', 'src/features', 'src/hooks', 'src/lib', 'src/resources', 'src/types'],
    requiredExcludeRoots: [
      'scripts', 'tests', 'openspec', 'docs', 'artifacts', '.logs', 'evaluate', 'data', 'deploy',
      'course-content', 'generated-images', '.next', 'dist', 'build', 'out',
    ],
    mandatoryBeforeRelease: false,
  },
  {
    id: 'worker',
    kind: 'production',
    configPath: 'tsconfig.worker.json',
    command: 'typecheck:worker',
    scope: 'production-worker-scheduler',
    fixturePath: 'typescript-graph-fixtures/worker.ts',
    entrypointRoots: ['scripts/workers', 'scripts/assignments'],
    requiredExcludeRoots: [
      'scripts/tests', 'scripts/db', 'scripts/knowledge', 'scripts/knowledge-cutover', 'scripts/knowledge-extraction',
      'scripts/knowledge-governance', 'scripts/actkg-release', 'scripts/course-coverage', 'scripts/data-governance',
      'scripts/migrations', 'scripts/release', 'scripts/runtime-release', 'scripts/source-pack', 'tests', 'openspec',
      'docs', 'artifacts', '.logs', 'evaluate', 'data', 'deploy', 'course-content', '.next',
    ],
    mandatoryBeforeRelease: false,
  },
  {
    id: 'tools',
    kind: 'tooling',
    configPath: 'tsconfig.tools.json',
    command: 'typecheck:tools',
    scope: 'tooling-content-knowledge-runtime-evidence',
    fixturePath: 'typescript-graph-fixtures/tools.ts',
    entrypointRoots: ['scripts', 'tools/boundary'],
    requiredExcludeRoots: [
      'scripts/tests', 'tests', 'openspec', 'docs', 'artifacts', '.logs', 'evaluate', 'data', 'deploy', 'course-content',
      '.next',
    ],
    mandatoryBeforeRelease: true,
  },
  {
    id: 'test',
    kind: 'test',
    configPath: 'tsconfig.test.json',
    command: 'typecheck:test',
    scope: 'vitest-playwright-script-tests',
    fixturePath: 'typescript-graph-fixtures/test.ts',
    entrypointRoots: ['src', 'scripts/tests', 'tests'],
    requiredExcludeRoots: [
      'node_modules', '.next', 'dist', 'build', 'out', 'openspec', 'docs', 'artifacts', '.logs', 'evaluate', 'data',
      'deploy', 'course-content', 'generated-images',
    ],
    mandatoryBeforeRelease: true,
  },
] as const;

export const SHARED_CONTRACT_OWNERS: readonly SharedContractOwner[] = [
  {
    contractId: 'typescript-graph-fixtures/shared-contract',
    version: 'v1',
    sourcePath: 'typescript-graph-fixtures/shared-contract.ts',
    declarationPath: 'typescript-graph-fixtures/shared-contract.declaration.d.ts',
    ownerGraph: 'web',
    consumerGraphs: ['worker', 'tools', 'test'],
  },
];

export interface SharedContractOwner {
  readonly contractId: string;
  readonly version: string;
  readonly sourcePath: string;
  readonly declarationPath: string;
  readonly ownerGraph: GraphId | null;
  readonly consumerGraphs: readonly GraphId[];
}

export interface GraphConfig {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly compilerOptions: Readonly<Record<string, unknown>>;
  readonly references: readonly Readonly<Record<string, unknown>>[];
}

export interface GraphFile {
  readonly path: string;
  readonly sha256: string;
  readonly byteLength: number;
}

export interface GraphEntrypoint {
  readonly identity: string;
  readonly sourcePath: string;
  readonly graph: GraphId | null;
  readonly evidence: readonly string[];
}

export interface GraphManifest {
  readonly schemaVersion: typeof GRAPH_MANIFEST_SCHEMA_VERSION;
  readonly contractVersion: typeof GRAPH_CONTRACT_SCHEMA_VERSION;
  readonly graph: GraphId;
  readonly kind: GraphKind;
  readonly scope: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly configPath: string;
  readonly includeRoots: readonly string[];
  readonly excludeRoots: readonly string[];
  readonly compilerOptions: Readonly<Record<string, unknown>>;
  readonly projectReferences: readonly Readonly<Record<string, unknown>>[];
  readonly entrypoints: readonly GraphEntrypoint[];
  readonly unclassifiedEntrypoints: readonly GraphEntrypoint[];
  readonly files: readonly GraphFile[];
  readonly sharedContractOwners: readonly SharedContractOwner[];
}

export interface GraphMeasurementReceipt {
  readonly schemaVersion: typeof GRAPH_MEASUREMENT_RECEIPT_SCHEMA_VERSION;
  readonly receiptId: string;
  readonly graph: GraphId;
  readonly command: `typecheck:${GraphId}`;
  readonly scope: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dirty: boolean;
  readonly manifestHash: string;
  readonly fixturePath: string;
  readonly fixtureProbe: boolean;
  readonly toolchain: Readonly<Record<string, string>>;
  readonly platform: string;
  readonly cacheMode: 'cold' | 'warm';
  readonly capturedAt: string;
  readonly durationMs: number;
  readonly peakRssBytes: number | null;
  readonly fileCount: number;
  readonly exitStatus: number;
  readonly status: GraphResultStatus;
  readonly tscErrorCount: number;
  readonly boundaryFailureCount: number;
  readonly failureCodes: readonly string[];
}

export interface GraphFailure {
  readonly code: string;
  readonly identity: string;
  readonly graph?: GraphId;
  readonly source?: string;
  readonly target?: string;
  readonly detail?: string;
  readonly replacementBoundary?: string;
}

export interface GraphSourceFile {
  readonly path: string;
  readonly content: string;
}

export interface GraphImportEdge {
  readonly source: string;
  readonly target: string;
  readonly edgeClass: 'static-import' | 'dynamic-import' | 're-export';
}

export function graphDefinition(graph: GraphId): GraphDefinition {
  const definition = GRAPH_DEFINITIONS.find((item) => item.id === graph);
  if (!definition) throw new Error(`unknown-typescript-graph:${graph}`);
  return definition;
}

export function graphConfig(repoRoot: string, graph: GraphId): GraphConfig {
  const definition = graphDefinition(graph);
  const path = join(repoRoot, definition.configPath);
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
    extends?: string;
    include?: string[];
    exclude?: string[];
    compilerOptions?: Record<string, unknown>;
    references?: Readonly<Record<string, unknown>>[];
  };
  const inherited = parsed.extends
    ? graphConfigFromPath(dirname(path), parsed.extends)
    : { include: [], exclude: [], compilerOptions: {}, references: [] };
  return {
    include: parsed.include ?? inherited.include,
    exclude: parsed.exclude ?? inherited.exclude,
    compilerOptions: { ...inherited.compilerOptions, ...(parsed.compilerOptions ?? {}) },
    references: parsed.references ?? inherited.references,
  };
}

function graphConfigFromPath(parentDir: string, extendsPath: string): GraphConfig {
  const configPath = resolve(parentDir, extendsPath.endsWith('.json') ? extendsPath : `${extendsPath}.json`);
  const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as {
    extends?: string;
    include?: string[];
    exclude?: string[];
    compilerOptions?: Record<string, unknown>;
    references?: Readonly<Record<string, unknown>>[];
  };
  const inherited = parsed.extends
    ? graphConfigFromPath(dirname(configPath), parsed.extends)
    : { include: [], exclude: [], compilerOptions: {}, references: [] };
  return {
    include: parsed.include ?? inherited.include,
    exclude: parsed.exclude ?? inherited.exclude,
    compilerOptions: { ...inherited.compilerOptions, ...(parsed.compilerOptions ?? {}) },
    references: parsed.references ?? inherited.references,
  };
}

export function readGitIdentity(repoRoot: string): { sourceCommit: string; sourceTree: string; dirty: boolean } {
  const git = (args: string[]) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
  return {
    sourceCommit: git(['rev-parse', 'HEAD']),
    sourceTree: git(['rev-parse', 'HEAD^{tree}']),
    dirty: git(['status', '--porcelain']).length > 0,
  };
}

export function graphFileRecords(repoRoot: string, paths: readonly string[]): GraphFile[] {
  const unique = [...new Set(paths.map((path) => normalizeRepoPath(repoRoot, path)).filter(isRepoRelativePath))].sort();
  return unique.flatMap((path) => {
    const fullPath = join(repoRoot, path);
    if (!existsSync(fullPath)) return [];
    const content = readFileSync(fullPath);
    return [{ path, sha256: createHash('sha256').update(content).digest('hex'), byteLength: content.byteLength }];
  });
}

export function createGraphManifest(input: {
  readonly repoRoot: string;
  readonly graph: GraphId;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly programFiles: readonly string[];
  readonly entrypoints?: readonly GraphEntrypoint[];
}): GraphManifest {
  const definition = graphDefinition(input.graph);
  const config = graphConfig(input.repoRoot, input.graph);
  const entrypoints = input.entrypoints ?? discoverEntrypoints(input.repoRoot, input.programFiles);
  return {
    schemaVersion: GRAPH_MANIFEST_SCHEMA_VERSION,
    contractVersion: GRAPH_CONTRACT_SCHEMA_VERSION,
    graph: definition.id,
    kind: definition.kind,
    scope: definition.scope,
    sourceCommit: input.sourceCommit,
    sourceTree: input.sourceTree,
    configPath: definition.configPath,
    includeRoots: [...config.include].sort(),
    excludeRoots: [...config.exclude].sort(),
    compilerOptions: config.compilerOptions,
    projectReferences: config.references,
    entrypoints: entrypoints.filter((item) => item.graph === input.graph).sort(compareEntrypoints),
    unclassifiedEntrypoints: entrypoints.filter((item) => item.graph === null).sort(compareEntrypoints),
    files: graphFileRecords(input.repoRoot, input.programFiles),
    sharedContractOwners: SHARED_CONTRACT_OWNERS,
  };
}

export function graphManifestHash(manifest: GraphManifest): string {
  return sha256Text(serializeDeterministic(manifest));
}

export function createGraphMeasurementReceipt(input: Omit<GraphMeasurementReceipt, 'schemaVersion' | 'receiptId'>): GraphMeasurementReceipt {
  const draft = { schemaVersion: GRAPH_MEASUREMENT_RECEIPT_SCHEMA_VERSION, ...input };
  return { ...draft, receiptId: sha256Text(serializeDeterministic(draft)) };
}

export function validateGraphDefinitions(repoRoot: string): GraphFailure[] {
  const failures: GraphFailure[] = [];
  const rootConfig = JSON.parse(readFileSync(join(repoRoot, 'tsconfig.json'), 'utf8')) as { include?: string[] };
  for (const pattern of rootConfig.include ?? []) {
    if (/^(?:\.\/)?\*\*\/\*\.(?:ts|tsx|mts|cts)$/u.test(pattern)) {
      failures.push({ code: 'root-production-glob', identity: pattern });
    }
  }
  for (const definition of GRAPH_DEFINITIONS) {
    const configPath = join(repoRoot, definition.configPath);
    if (!existsSync(configPath)) {
      failures.push({ code: 'graph-config-missing', identity: definition.configPath, graph: definition.id });
      continue;
    }
    const config = graphConfig(repoRoot, definition.id);
    failures.push(...validateGraphConfig(definition, config));
  }
  failures.push(...validateSharedContractOwners(SHARED_CONTRACT_OWNERS));
  for (const owner of SHARED_CONTRACT_OWNERS) {
    if (!existsSync(join(repoRoot, owner.sourcePath))) {
      failures.push({ code: 'shared-contract-source-missing', identity: owner.sourcePath, graph: owner.ownerGraph ?? undefined });
    }
    if (!existsSync(join(repoRoot, owner.declarationPath))) {
      failures.push({ code: 'shared-contract-declaration-missing', identity: owner.declarationPath, graph: owner.ownerGraph ?? undefined });
    }
  }
  return uniqueFailures(failures);
}

export function validateGraphConfig(definition: GraphDefinition, config: GraphConfig): GraphFailure[] {
  const failures: GraphFailure[] = [];
  for (const root of definition.entrypointRoots) {
    if (!config.include.some((pattern) => pattern === root || pattern.startsWith(`${root}/`))) {
      failures.push({ code: 'entrypoint-root-missing', identity: root, graph: definition.id });
    }
  }
  for (const required of definition.requiredExcludeRoots) {
    if (!hasExcludeRoot(config.exclude, required)) {
      failures.push({ code: 'required-exclude-missing', identity: required, graph: definition.id });
    }
  }
  for (const policy of [
    ['strict', true],
    ['noEmit', true],
    ['skipLibCheck', true],
    ['moduleResolution', 'bundler'],
    ['module', 'esnext'],
  ] as const) {
    if (config.compilerOptions[policy[0]] !== policy[1]) {
      failures.push({ code: 'compiler-policy-downgrade', identity: `${policy[0]}=${String(config.compilerOptions[policy[0]])}`, graph: definition.id });
    }
  }
  if (config.include.some((pattern) => /^(?:\.\/)?\*\*\/\*\.(?:ts|tsx|mts|cts)$/u.test(pattern))) {
    failures.push({ code: 'graph-broad-glob', identity: definition.configPath, graph: definition.id });
  }
  if (!config.include.includes(definition.fixturePath)) {
    failures.push({ code: 'fixture-not-in-graph', identity: definition.fixturePath, graph: definition.id });
  }
  for (const other of GRAPH_DEFINITIONS) {
    if (other.id !== definition.id && config.include.includes(other.fixturePath)) {
      failures.push({ code: 'fixture-duplicate-owner', identity: other.fixturePath, graph: definition.id });
    }
  }
  return uniqueFailures(failures);
}

export function hasExcludeRoot(excludes: readonly string[], required: string): boolean {
  return excludes.some((entry) => entry === required || entry === `${required}/**` || entry.startsWith(`${required}/`));
}

export function validateSharedContractOwners(owners: readonly SharedContractOwner[]): GraphFailure[] {
  const failures: GraphFailure[] = [];
  const bySource = new Map<string, SharedContractOwner[]>();
  const byContract = new Map<string, SharedContractOwner[]>();
  for (const owner of owners) {
    const rows = bySource.get(owner.sourcePath) ?? [];
    rows.push(owner);
    bySource.set(owner.sourcePath, rows);
    const contractRows = byContract.get(owner.contractId) ?? [];
    contractRows.push(owner);
    byContract.set(owner.contractId, contractRows);
    if (!owner.ownerGraph) failures.push({ code: 'shared-contract-owner-missing', identity: owner.contractId });
    if (!owner.declarationPath) failures.push({ code: 'shared-contract-declaration-missing', identity: owner.contractId });
    if (owner.consumerGraphs.includes(owner.ownerGraph as GraphId)) {
      failures.push({ code: 'shared-contract-owner-is-consumer', identity: owner.contractId });
    }
  }
  for (const [contractId, rows] of byContract) {
    const ownersForContract = rows.filter((row) => row.ownerGraph !== null);
    if (ownersForContract.length !== 1) {
      failures.push({
        code: ownersForContract.length === 0 ? 'shared-contract-unowned' : 'shared-contract-multiple-owners',
        identity: contractId,
      });
    }
  }
  for (const [sourcePath, rows] of bySource) {
    const ownersForSource = rows.filter((row) => row.ownerGraph !== null);
    if (ownersForSource.length !== 1) {
      failures.push({ code: ownersForSource.length === 0 ? 'shared-contract-unowned' : 'shared-contract-multiple-owners', identity: sourcePath });
    }
  }
  return uniqueFailures(failures);
}

export function validateEntrypointClassification(entries: readonly GraphEntrypoint[]): GraphFailure[] {
  return entries
    .filter((entry) => entry.graph === null)
    .map((entry) => ({ code: 'unclassified-entrypoint', identity: entry.identity, detail: entry.sourcePath }));
}

export function classifyEntrypoint(sourcePath: string): GraphId | null {
  const path = sourcePath.replaceAll('\\', '/').replace(/^\.\//u, '');
  if (/^(?:tests\/|scripts\/tests\/|(?:src|scripts)\/.*(?:__tests__|\.(?:test|spec))\.(?:ts|tsx|mts|cts))/.test(path)) return 'test';
  if (/(?:^|\/)(?:playwright|vitest)(?:\.[^/]+)?\.(?:ts|tsx|mts|cts)$/.test(path) || /(?:^|\/)prisma\.config\.(?:ts|tsx|mts|cts)$/.test(path)) return 'test';
  if (/^src\/app\/(?:.+\/)?(?:page|layout|template|default|loading|error|global-error|not-found|route|opengraph-image|twitter-image|sitemap|robots)\.(?:ts|tsx|mts|cts)$/.test(path)) return 'web';
  if (/^src\/(?:middleware|instrumentation|proxy)\.(?:ts|tsx|mts|cts)$/.test(path)) return 'web';
  if (/^scripts\/workers\/.+\.(?:ts|tsx|mts|cts)$/.test(path)) return 'worker';
  if (/^scripts\/assignments\/(?:scan-submission-objects|gc-submission-objects)\.(?:ts|tsx|mts|cts)$/.test(path)) return 'worker';
  if (/^scripts\/.+\.(?:ts|tsx|mts|cts)$/.test(path)) return 'tools';
  if (/^(?:playwright(?:\.[^/]+)?|vitest(?:\.[^/]+)?|prisma\.config)\.(?:ts|tsx|mts|cts)$/.test(path)) return 'test';
  return null;
}

export function discoverEntrypoints(repoRoot: string, paths: readonly string[]): GraphEntrypoint[] {
  const normalized = [...new Set(paths.map((path) => normalizeRepoPath(repoRoot, path)))].filter(Boolean);
  const entries: GraphEntrypoint[] = [];
  for (const path of normalized) {
    if (classifyEntrypoint(path) === 'web' || classifyEntrypoint(path) === 'worker' || classifyEntrypoint(path) === 'test') {
      if (isFrameworkEntrypoint(path) || path.startsWith('scripts/workers/') || path.startsWith('scripts/assignments/') || isTestPath(path)) {
        entries.push({ identity: `file:${path}`, sourcePath: path, graph: classifyEntrypoint(path), evidence: [`path:${path}`] });
      }
    }
  }
  const packagePath = join(repoRoot, 'package.json');
  if (existsSync(packagePath)) {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, string> };
    for (const [scriptName, command] of Object.entries(pkg.scripts ?? {})) {
      for (const sourcePath of extractTypeScriptPaths(command)) {
        const graph = classifyEntrypoint(sourcePath);
        entries.push({
          identity: `package.json:scripts.${scriptName}:${sourcePath}`,
          sourcePath,
          graph,
          evidence: [`package-script:${scriptName}`],
        });
      }
    }
  }
  return dedupeEntrypoints(entries);
}

function isFrameworkEntrypoint(path: string): boolean {
  return /^src\/app\//.test(path) || /^src\/(?:middleware|instrumentation|proxy)\./.test(path) || /^(?:playwright|vitest|prisma\.config)/.test(path);
}

function isTestPath(path: string): boolean {
  return /^(?:tests\/|scripts\/tests\/|src\/.*(?:__tests__|\.(?:test|spec))\.)/.test(path);
}

function extractTypeScriptPaths(command: string): string[] {
  const paths: string[] = [];
  const expression = /(?:^|[\s"'`])((?:\.\/)?(?:src|scripts|tests|playwright|vitest|prisma)[A-Za-z0-9_./[\]@-]*\.(?:ts|tsx|mts|cts))(?:[\s"'`]|$)/g;
  for (const match of command.matchAll(expression)) paths.push(match[1].replace(/^\.\//u, ''));
  return paths;
}

function dedupeEntrypoints(entries: readonly GraphEntrypoint[]): GraphEntrypoint[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.identity}:${entry.sourcePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareEntrypoints(left: GraphEntrypoint, right: GraphEntrypoint): number {
  return left.identity.localeCompare(right.identity) || left.sourcePath.localeCompare(right.sourcePath);
}

export function parseImportSpecifiers(content: string): readonly { specifier: string; edgeClass: GraphImportEdge['edgeClass'] }[] {
  const imports: { specifier: string; edgeClass: GraphImportEdge['edgeClass'] }[] = [];
  const staticImport = /\bimport\s+(?:(?:type\s+)?[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const reExport = /\bexport\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
  const dynamicImport = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of content.matchAll(staticImport)) imports.push({ specifier: match[1], edgeClass: 'static-import' });
  for (const match of content.matchAll(reExport)) imports.push({ specifier: match[1], edgeClass: 're-export' });
  for (const match of content.matchAll(dynamicImport)) imports.push({ specifier: match[1], edgeClass: 'dynamic-import' });
  return [...new Map(imports.map((item) => [`${item.edgeClass}:${item.specifier}`, item])).values()];
}

export function resolveLocalImport(repoRoot: string, sourcePath: string, specifier: string, availablePaths?: ReadonlySet<string>): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const raw = specifier.startsWith('@/')
    ? join(repoRoot, 'src', specifier.slice(2))
    : resolve(repoRoot, dirname(sourcePath), specifier);
  const extensionless = raw.replace(/\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/u, '');
  const candidates = [
    raw,
    `${extensionless}.ts`, `${extensionless}.tsx`, `${extensionless}.mts`, `${extensionless}.cts`,
    `${extensionless}.d.ts`, join(extensionless, 'index.ts'), join(extensionless, 'index.tsx'),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeRepoPath(repoRoot, candidate);
    if (availablePaths && availablePaths.has(normalized)) return normalized;
    if (!availablePaths && existsSync(join(repoRoot, normalized))) return normalized;
  }
  return null;
}

export function dependencyEdges(repoRoot: string, sourceFiles: readonly GraphSourceFile[], availablePaths?: ReadonlySet<string>): GraphImportEdge[] {
  const edges: GraphImportEdge[] = [];
  for (const source of sourceFiles) {
    for (const imported of parseImportSpecifiers(source.content)) {
      const target = resolveLocalImport(repoRoot, source.path, imported.specifier, availablePaths);
      if (target) edges.push({ source: source.path, target, edgeClass: imported.edgeClass });
    }
  }
  return edges.sort((left, right) => `${left.source}:${left.target}:${left.edgeClass}`.localeCompare(`${right.source}:${right.target}:${right.edgeClass}`));
}

export function validateProductionBoundaries(graph: GraphId, sourceFiles: readonly GraphSourceFile[], edges = dependencyEdges('.', sourceFiles)): GraphFailure[] {
  if (!['web', 'worker'].includes(graph)) return [];
  const failures: GraphFailure[] = [];
  for (const source of sourceFiles) {
    const sourceClass = classifyNonProductionPath(source.path);
    if (sourceClass && !isAllowedProductionPath(graph, source.path)) {
      failures.push({ code: `${graph}-includes-${sourceClass}`, identity: source.path, graph });
    }
  }
  for (const edge of edges) {
    const targetClass = classifyNonProductionPath(edge.target);
    if (targetClass && !isAllowedProductionPath(graph, edge.target)) {
      failures.push({
        code: `production-to-${targetClass}`,
        identity: `${edge.source}->${edge.target}`,
        graph,
        source: edge.source,
        target: edge.target,
        detail: edge.edgeClass,
        replacementBoundary: `${targetClass}-graph-or-declaration-boundary`,
      });
    }
  }
  return uniqueFailures(failures);
}

export function validateDependencyCycles(edges: readonly Pick<GraphImportEdge, 'source' | 'target'>[]): GraphFailure[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.source) ?? [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
  }
  const active = new Set<string>();
  const completed = new Set<string>();
  const failures: GraphFailure[] = [];
  const visit = (node: string, trail: readonly string[]) => {
    if (active.has(node)) {
      const cycleStart = trail.indexOf(node);
      const cycle = [...trail.slice(cycleStart), node];
      failures.push({ code: 'dependency-cycle', identity: cycle.join('->') });
      return;
    }
    if (completed.has(node)) return;
    active.add(node);
    for (const target of adjacency.get(node) ?? []) visit(target, [...trail, node]);
    active.delete(node);
    completed.add(node);
  };
  for (const node of adjacency.keys()) visit(node, []);
  return uniqueFailures(failures);
}

function classifyNonProductionPath(path: string): 'test' | 'tooling' | 'generated' | 'documentation' | null {
  if (isTestPath(path) || /^(?:tests|scripts\/tests)\//.test(path)) return 'test';
  if (/^scripts\//.test(path) && !path.startsWith('scripts/workers/')) return 'tooling';
  if (/^(?:\.next|dist|build|out|generated-images|generated|src\/generated|public\/generated)\//.test(path)) return 'generated';
  if (/^(?:openspec|docs|artifacts|evaluate|data|course-content)\//.test(path)) return 'documentation';
  return null;
}

function isAllowedProductionPath(graph: GraphId, path: string): boolean {
  if (path === graphDefinition(graph).fixturePath) return true;
  if (graph === 'worker' && (path.startsWith('scripts/workers/') || /^scripts\/assignments\/(?:scan-submission-objects|gc-submission-objects)\.ts$/.test(path))) return true;
  return false;
}

export function validateMandatoryGraphReceipts(input: {
  readonly receipts: readonly GraphMeasurementReceipt[];
  readonly sourceCommit: string;
  readonly sourceTree: string;
}): GraphFailure[] {
  const failures: GraphFailure[] = [];
  for (const command of ['typecheck:tools', 'typecheck:test'] as const) {
    const receipt = input.receipts.find((item) => item.command === command);
    if (!receipt) {
      failures.push({ code: 'mandatory-graph-receipt-missing', identity: command });
      continue;
    }
    const expectedGraph = command.slice('typecheck:'.length) as GraphId;
    if (receipt.graph !== expectedGraph) failures.push({ code: 'mandatory-graph-receipt-graph-mismatch', identity: command });
    if (receipt.sourceCommit !== input.sourceCommit || receipt.sourceTree !== input.sourceTree) {
      failures.push({ code: 'mandatory-graph-receipt-stale', identity: command });
    }
    if (receipt.dirty) failures.push({ code: 'mandatory-graph-receipt-dirty', identity: command });
    if (receipt.status !== 'passed' || receipt.exitStatus !== 0) {
      failures.push({ code: 'mandatory-graph-receipt-failed', identity: command });
    }
  }
  return uniqueFailures(failures);
}

export function parseTscFilePaths(output: string, repoRoot: string): string[] {
  const paths: string[] = [];
  for (const line of output.split(/\r?\n/u)) {
    const trimmed = line.trim().replace(/^['"]|['"]$/gu, '');
    if (!/\.(?:d\.)?(?:ts|tsx|mts|cts|json)$/u.test(trimmed)) continue;
    const normalized = normalizeRepoPath(repoRoot, trimmed);
    if (isRepoRelativePath(normalized) && !normalized.startsWith('node_modules/')) paths.push(normalized);
  }
  return [...new Set(paths)].sort();
}

export function tscErrorCount(output: string): number {
  return [...output.matchAll(/(?:error\s+)?TS\d{4,5}\b/gu)].length;
}

export function parsePeakRssBytes(output: string): number | null {
  const darwin = output.match(/maximum resident set size:\s*(\d+)/iu);
  if (darwin) return Number(darwin[1]);
  const linux = output.match(/Maximum resident set size \(kbytes\):\s*(\d+)/iu);
  if (linux) return Number(linux[1]) * 1024;
  return null;
}

export function normalizeRepoPath(repoRoot: string, path: string): string {
  const normalized = path.replaceAll('\\', '/');
  const root = resolve(repoRoot).replaceAll('\\', '/').replace(/\/$/u, '');
  if (normalized.startsWith(`${root}/`)) return normalized.slice(root.length + 1);
  if (normalized.startsWith('/')) return relative(repoRoot, normalized).replaceAll('\\', '/');
  return normalized.replace(/^\.\//u, '');
}

function isRepoRelativePath(path: string): path is string {
  return Boolean(path) && path !== '..' && !path.startsWith('../') && !path.startsWith('/');
}

function uniqueFailures(failures: readonly GraphFailure[]): GraphFailure[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.code}:${failure.identity}:${failure.graph ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
