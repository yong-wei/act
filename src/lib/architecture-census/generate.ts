import { currentOwnerEvidence, featureName, isGeneratedPath, isPageEntrypoint, isRouteHandler, isServerAction, isSourcePath, isTestPath, isUiEntrypoint, surfaceClassFor } from './classify';
import { buildDeclaredEdges, reverseEdges, stronglyConnectedComponents, type GraphEdge } from './graph';
import { collectResolvedImports, importContext } from './imports';
import { privacyViolation } from './privacy';
import { serializeDeterministic, sha256Text, stableId } from './serialize';
import type {
  CensusCore,
  CensusObservation,
  CensusSourceSnapshot,
  CommandSummary,
  DenominatorTotals,
  InventoryKind,
  InventoryManifest,
  OwnershipRecord,
  QualificationFailure,
} from './types';
import { CENSUS_CORE_SCHEMA_VERSION, INVENTORY_KINDS } from './types';

function ownership(path: string, extra: string[] = []): OwnershipRecord {
  const evidence = [...currentOwnerEvidence(path), ...extra];
  const features = new Set(evidence.map((item) => item.startsWith('feature:') ? item.slice(8) : '').filter(Boolean));
  if (features.size > 1) {
    return {
      currentOwnerEvidence: evidence,
      candidateTargetOwner: null,
      state: 'ambiguous',
      conflictingEvidence: evidence,
    };
  }
  return {
    currentOwnerEvidence: evidence,
    candidateTargetOwner: features.size === 1 ? [...features][0] : null,
    state: features.size === 1 ? 'candidate-target' : 'resolved-current',
    conflictingEvidence: [],
  };
}

function observation(input: {
  kind: InventoryKind;
  identity: string;
  path?: string;
  surfaceClass?: CensusObservation['surfaceClass'];
  evidence?: readonly string[];
  attributes?: CensusObservation['attributes'];
  notes?: readonly string[];
  trustClass?: string | null;
  compatibility?: boolean;
  extraOwnership?: readonly string[];
}): CensusObservation {
  const path = input.path ?? input.identity;
  return {
    id: stableId(input.kind, input.identity),
    kind: input.kind,
    identity: input.identity,
    surfaceClass: input.surfaceClass ?? surfaceClassFor(path),
    ownership: ownership(path, [...(input.extraOwnership ?? [])]),
    evidence: input.evidence ?? [path],
    trustClass: input.trustClass ?? null,
    compatibility: input.compatibility ?? false,
    notes: input.notes ?? [],
    attributes: input.attributes ?? {},
  };
}

function openspecCapabilityId(path: string): string | null {
  const spec = path.match(/^openspec\/specs\/([^/]+)\//u);
  if (spec?.[1]) return `openspec/specs/${spec[1]}`;
  if (path.startsWith('openspec/changes/archive/')) return null;
  const change = path.match(/^openspec\/changes\/([^/]+)\//u);
  if (change?.[1]) return `openspec/changes/${change[1]}`;
  return null;
}

function reexportFeatures(content: string): string[] {
  const names = new Set<string>();
  for (const match of content.matchAll(/export\s+\*\s+from\s+['"]@\/features\/([^/'"]+)/gu)) {
    if (match[1]) names.add(match[1]);
  }
  return [...names].sort();
}

function totals(discovered: readonly string[], represented: readonly string[], excluded: readonly string[] = []): DenominatorTotals {
  const representedSet = new Set(represented);
  const excludedSet = new Set(excluded);
  const duplicate = represented.length - representedSet.size;
  const unresolved = discovered.filter((id) => !representedSet.has(id) && !excludedSet.has(id)).length;
  return {
    discovered: discovered.length,
    represented: representedSet.size,
    excluded: excludedSet.size,
    duplicate,
    unresolved,
  };
}

function prismaModels(content: string): string[] {
  return [...content.matchAll(/^model\s+([A-Za-z][A-Za-z0-9_]*)/gmu)].map((match) => match[1]).sort();
}

function parsePackageScripts(content: string): Record<string, string> {
  try {
    const parsed = JSON.parse(content) as { scripts?: Record<string, string> };
    return parsed.scripts ?? {};
  } catch {
    return {};
  }
}

export function generateCensusCore(snapshot: CensusSourceSnapshot): {
  core: CensusCore;
  failures: QualificationFailure[];
} {
  const failures: QualificationFailure[] = [];
  if (snapshot.dirty) failures.push({ code: 'dirty-worktree', identity: snapshot.identity.sourceCommit });
  if (snapshot.mixedWorktree) failures.push({ code: 'mixed-worktree', identity: snapshot.identity.sourceCommit });
  if (snapshot.detachedUnresolved) failures.push({ code: 'unresolved-identity', identity: snapshot.identity.sourceCommit });

  for (const file of snapshot.files) {
    const pathViolation = privacyViolation(file.path);
    if (pathViolation) failures.push({ code: pathViolation, identity: file.path });
  }
  const fileMap = new Map(snapshot.files.map((file) => [file.path, file.content]));
  const paths = snapshot.files.map((file) => file.path).filter((path) => !isGeneratedPath(path)).sort();
  const imports = collectResolvedImports(fileMap);
  const edges = buildDeclaredEdges(imports, importContext);
  const reverses = reverseEdges(edges);
  const sccs = stronglyConnectedComponents(edges.filter((edge) => edge.context === 'production'));

  const observations: CensusObservation[] = [];

  const entrypoints = paths.filter((path) => isPageEntrypoint(path) || isUiEntrypoint(path) || isServerAction(path));
  for (const path of entrypoints) {
    observations.push(observation({ kind: 'entrypoint', identity: path, path, attributes: { convention: isPageEntrypoint(path) ? 'page' : isServerAction(path) ? 'server-action' : 'ui' } }));
  }

  const routes = paths.filter((path) => isRouteHandler(path) || isPageEntrypoint(path));
  for (const path of routes) {
    observations.push(observation({ kind: 'route', identity: path, path, attributes: { handler: isRouteHandler(path) } }));
  }

  const apis = paths.filter((path) => path.startsWith('src/app/api/') && isRouteHandler(path));
  for (const path of apis) {
    observations.push(observation({ kind: 'api', identity: path, path }));
  }

  const schema = fileMap.get('prisma/schema.prisma') ?? '';
  const models = prismaModels(schema);
  for (const model of models) {
    observations.push(observation({
      kind: 'prisma-model',
      identity: model,
      path: 'prisma/schema.prisma',
      evidence: ['prisma/schema.prisma'],
      attributes: { model },
    }));
  }

  const prismaAccess = paths.filter((path) => {
    const content = fileMap.get(path) ?? '';
    return isSourcePath(path) && /@prisma\/client|from ['"]@\/lib\/prisma['"]|createPrismaClient/u.test(content);
  });
  for (const path of prismaAccess) {
    observations.push(observation({
      kind: 'prisma-access',
      identity: path,
      path,
      attributes: { context: importContext(path) },
    }));
  }

  const eventContracts = [...new Set(paths.filter((path) => (
    /event-dictionary|eventType|classroom-analytics\/events|MicroInterventionEvent/u.test(path)
    || /event-dictionary|eventType/.test(fileMap.get(path) ?? '')
  ) && isSourcePath(path) && !isTestPath(path)))].sort();
  for (const path of eventContracts) {
    observations.push(observation({ kind: 'event-contract', identity: path, path }));
  }

  const workers = [...new Set(paths.filter((path) => (
    path.startsWith('scripts/workers/')
    || /(?:^|\/)(?:workers?|scheduler)/u.test(path)
  ) && isSourcePath(path) && !isTestPath(path)))].sort();
  for (const path of workers) {
    observations.push(observation({ kind: 'worker', identity: path, path }));
  }

  const scripts = paths.filter((path) => path.startsWith('scripts/') || path === 'package.json');
  const packageScripts = parsePackageScripts(fileMap.get('package.json') ?? '{}');
  for (const path of scripts.filter((item) => item !== 'package.json')) {
    observations.push(observation({ kind: 'script', identity: path, path, surfaceClass: 'production' }));
  }
  for (const name of Object.keys(packageScripts).sort()) {
    observations.push(observation({
      kind: 'script',
      identity: `package.json:scripts.${name}`,
      path: 'package.json',
      attributes: { script: name },
    }));
  }

  const tests = paths.filter((path) => isTestPath(path));
  for (const path of tests) {
    observations.push(observation({ kind: 'test', identity: path, path, surfaceClass: 'test' }));
  }

  const registries = paths.filter((path) => /registry/iu.test(path) && isSourcePath(path));
  for (const path of registries) {
    observations.push(observation({ kind: 'registry', identity: path, path }));
  }

  const openspec = paths.filter((path) => (
    /^openspec\/(?:specs|changes)\//u.test(path)
    && (path.endsWith('spec.md') || path.endsWith('proposal.md'))
  ));
  const capabilityIds = [...new Set(openspec.map(openspecCapabilityId).filter((id): id is string => Boolean(id)))].sort();
  for (const identity of capabilityIds) {
    observations.push(observation({ kind: 'openspec-capability', identity, path: identity, evidence: [identity] }));
  }

  for (const edge of edges) {
    observations.push(observation({
      kind: 'dependency-edge',
      identity: edge.id,
      path: edge.from,
      surfaceClass: edge.context === 'test' ? 'test' : 'production',
      evidence: [edge.from, edge.to],
      attributes: {
        from: edge.from,
        to: edge.to,
        context: edge.context,
        crossDomain: edge.crossDomain,
        deepImport: edge.deepImport,
        featureToApp: edge.featureToApp,
      },
    }));
  }
  for (const edge of reverses) {
    observations.push(observation({
      kind: 'reverse-edge',
      identity: edge.id,
      path: edge.from,
      evidence: [edge.from, edge.to],
      attributes: { from: edge.from, to: edge.to, context: edge.context },
    }));
  }
  for (const scc of sccs) {
    observations.push(observation({
      kind: 'scc',
      identity: scc.id,
      path: scc.members[0] ?? scc.id,
      evidence: scc.members,
      attributes: { memberCount: scc.members.length, edgeCount: scc.edgeIds.length },
      notes: scc.edgeIds,
    }));
  }
  for (const edge of edges.filter((item) => item.deepImport)) {
    observations.push(observation({
      kind: 'deep-import',
      identity: edge.id,
      path: edge.from,
      evidence: [edge.from, edge.to],
      attributes: { from: edge.from, to: edge.to, fromFeature: featureName(edge.from), toFeature: featureName(edge.to) },
    }));
  }

  const compat = paths.filter((path) => (
    /export \* from /u.test(fileMap.get(path) ?? '')
    || /legacy|compat|alias|deprecated/iu.test(path)
  ) && isSourcePath(path));
  for (const path of compat) {
    const exported = reexportFeatures(fileMap.get(path) ?? '');
    observations.push(observation({
      kind: 'compatibility-surface',
      identity: path,
      path,
      compatibility: true,
      notes: ['deletion-eligibility-unknown'],
      extraOwnership: exported.map((name) => `feature:${name}`),
    }));
  }

  const gateFiles = paths.filter((path) => (
    /(?:gate|verify:|qualify:|pre-commit|pre-push)/iu.test(path)
    || path.startsWith('.github/workflows/')
    || path.startsWith('.husky/')
  ));
  for (const path of gateFiles) {
    observations.push(observation({
      kind: 'gate',
      identity: path,
      path,
      trustClass: path.startsWith('.github/workflows/') ? 'ci' : 'local-validator',
      attributes: {
        validator: path,
        protectedBoundary: path.startsWith('.github/workflows/') ? 'github-workflow' : 'repository-script',
        protectedFact: 'unclassified',
        threat: 'unresolved',
        failureConsequence: 'unresolved',
      },
      notes: ['classification-unresolved'],
    }));
  }
  for (const name of Object.keys(packageScripts).sort()) {
    if (!/^(?:verify|qualify|test|lint|typecheck|audit):?/u.test(name) && !['lint', 'typecheck', 'test'].includes(name)) continue;
    observations.push(observation({
      kind: 'gate',
      identity: `package.json:scripts.${name}`,
      path: 'package.json',
      trustClass: 'package-script',
      attributes: {
        validator: `package.json:scripts.${name}`,
        protectedBoundary: 'local-quality',
        protectedFact: 'unclassified',
        threat: 'unresolved',
        failureConsequence: 'unresolved',
      },
      notes: ['classification-unresolved'],
    }));
  }

  const oversized = snapshot.files.filter((file) => (
    file.byteLength > 100 * 1024 && /\.(?:ts|tsx|rs)$/u.test(file.path)
  ));
  for (const file of oversized) {
    observations.push(observation({
      kind: 'change-center',
      identity: file.path,
      path: file.path,
      attributes: { byteLength: file.byteLength, reason: 'oversized-source' },
      notes: ['size-is-not-a-finding'],
    }));
  }

  const sorted = [...observations].sort((left, right) => left.id.localeCompare(right.id));
  const seen = new Set<string>();
  for (const item of sorted) {
    if (seen.has(item.id)) failures.push({ code: 'duplicate-id', identity: item.id });
    seen.add(item.id);
    const serialized = serializeDeterministic(item);
    const violation = privacyViolation(serialized);
    if (violation) failures.push({ code: violation, identity: item.id });
  }

  const byKind = (kind: InventoryKind) => sorted.filter((item) => item.kind === kind);
  const discoveredFor = (kind: InventoryKind): string[] => {
    switch (kind) {
      case 'entrypoint': return entrypoints;
      case 'route': return routes;
      case 'api': return apis;
      case 'prisma-model': return models;
      case 'prisma-access': return prismaAccess;
      case 'event-contract': return eventContracts;
      case 'worker': return workers;
      case 'script': return [
        ...scripts.filter((path) => path !== 'package.json'),
        ...Object.keys(packageScripts).map((name) => `package.json:scripts.${name}`),
      ].sort();
      case 'test': return tests;
      case 'registry': return registries;
      case 'openspec-capability': return capabilityIds;
      case 'dependency-edge': return edges.map((edge) => edge.id);
      case 'reverse-edge': return reverses.map((edge) => edge.id);
      case 'deep-import': return edges.filter((edge) => edge.deepImport).map((edge) => edge.id);
      case 'scc': return sccs.map((item) => item.id);
      case 'compatibility-surface': return compat;
      case 'gate': return [
        ...gateFiles,
        ...Object.keys(packageScripts)
          .filter((name) => /^(?:verify|qualify|test|lint|typecheck|audit):?/u.test(name) || ['lint', 'typecheck', 'test'].includes(name))
          .map((name) => `package.json:scripts.${name}`),
      ].sort();
      case 'change-center': return oversized.map((file) => file.path);
      default: return [];
    }
  };

  const manifests: InventoryManifest[] = INVENTORY_KINDS.map((kind) => {
    const discovered = [...new Set(discoveredFor(kind))].sort();
    const represented = byKind(kind).map((item) => item.identity);
    const kindTotals = totals(discovered, represented);
    if (kindTotals.unresolved > 0 || kindTotals.duplicate > 0) {
      failures.push({ code: 'denominator-mismatch', identity: kind });
    }
    return {
      kind,
      includeRules: [`kind:${kind}`],
      excludeRules: ['generated:.next', 'generated:node_modules', 'openspec:changes/archive'],
      totals: kindTotals,
    };
  });

  const commandSummaries: CommandSummary[] = [{
    commandId: 'census.generate',
    scope: 'source-derived-core',
    exitStatus: failures.length > 0 ? 1 : 0,
    aggregate: {
      fileCount: paths.length,
      observationCount: sorted.length,
      edgeCount: edges.length,
      sccCount: sccs.length,
    },
    fingerprint: sha256Text(serializeDeterministic(sorted.map((item) => item.id))),
  }];

  const core: CensusCore = {
    schemaVersion: CENSUS_CORE_SCHEMA_VERSION,
    captureIdentity: snapshot.identity,
    manifests,
    observations: sorted,
    commandSummaries,
  };
  const coreText = serializeDeterministic(core);
  const coreViolation = privacyViolation(coreText);
  if (coreViolation) failures.push({ code: coreViolation, identity: 'census-core' });
  return { core, failures };
}

export function qualifyCensusCore(core: CensusCore, failures: QualificationFailure[]): void {
  if (core.schemaVersion !== CENSUS_CORE_SCHEMA_VERSION) {
    throw new Error('unsupported-schema-version');
  }
  if (failures.length > 0) {
    const extra = failures.length > 1 ? ` (+${failures.length - 1} more)` : '';
    throw new Error(`${failures[0].code}:${failures[0].identity}${extra}`);
  }
}

export type { GraphEdge };
