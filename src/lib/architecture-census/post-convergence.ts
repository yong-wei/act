import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REQUIRED_BASELINE } from '@/lib/architecture-charter/types';

import { currentOwnerEvidence as ownerEvidenceFromPath, featureName, isGeneratedPath, isSourcePath, isTestPath } from './classify';
import { CURRENT_HEAD_DELTA_SCHEMA_VERSION, type CurrentHeadPackage } from './current-head-delta';
import { generateCensusCore } from './generate';
import { privacyViolation } from './privacy';
import { serializeDeterministic, sha256Text } from './serialize';
import {
  BINARY_MEDIA_MODEL_EXTENSIONS,
  CHANGE_FREQUENCY_COMMIT_LIMIT,
  DERIVED_SLICES,
  HOTSPOT_LIMIT,
  INVENTORY_KINDS,
  MATERIAL_LAYERS,
  POST_CONVERGENCE_COMMAND_SCOPE,
  POST_CONVERGENCE_DETAIL_DIR,
  POST_CONVERGENCE_OUTPUT_DIR,
  POST_CONVERGENCE_SCHEMA_VERSION,
  POST_CONVERGENCE_STATUSES,
} from './types';
import type {
  CensusCore,
  CensusObservation,
  CensusSourceSnapshot,
  CaptureIdentity,
  DerivedSlice,
  DerivedSliceManifest,
  DenominatorTotals,
  HotspotEntry,
  HotspotMetricVector,
  MaterialLayer,
  MaterialLayerManifest,
  MeasurementReceipt,
  OwnerResidueRecord,
  PayloadClassAggregate,
  PostConvergenceEnvelope,
  QualificationFailure,
  SuccessorPredecessorBaseline,
  SuccessorPredecessorCurrentHead,
} from './types';

const BINARY_EXTENSIONS = new Set<string>(BINARY_MEDIA_MODEL_EXTENSIONS);

const DELETION_CONDITION_UNRESOLVED = 'zero-production-consumers-and-canonical-owner-replacement-proven';

export interface SuccessorPredecessors {
  readonly baseline: SuccessorPredecessorBaseline;
  readonly currentHead: SuccessorPredecessorCurrentHead;
  readonly currentHeadPackage: CurrentHeadPackage;
  readonly predecessorKindSet: readonly string[];
}

export interface FullInventoryRecord {
  readonly path: string;
  readonly layer: MaterialLayer;
  readonly byteCount: number;
  readonly blobSha: string;
  readonly inDegree: number;
  readonly outDegree: number;
}

export interface DerivedSliceRecord {
  readonly id: string;
  readonly slice: DerivedSlice;
  readonly identity: string;
  readonly evidence: readonly string[];
  readonly attributes: Readonly<Record<string, string | number | boolean | null>>;
  readonly notes: readonly string[];
}

export interface DerivedSliceResult {
  readonly manifests: readonly DerivedSliceManifest[];
  readonly records: readonly DerivedSliceRecord[];
  readonly failures: readonly QualificationFailure[];
}

export interface MaterialLayerResult {
  readonly manifests: readonly MaterialLayerManifest[];
  readonly inventory: readonly FullInventoryRecord[];
  readonly reconciliation: PostConvergenceEnvelope['layerReconciliation'];
}

export interface HotspotResult {
  readonly entries: readonly HotspotEntry[];
  readonly unresolvedMetrics: readonly string[];
}

export interface PayloadClassResult {
  readonly duplicateBlobCount: number;
  readonly classes: readonly PayloadClassAggregate[];
  readonly unresolvedCount: number;
}

export interface PostConvergenceDetailArtifact {
  readonly name: string;
  readonly logicalLocator: string;
  readonly mediaType: string;
  readonly content: string;
}

export interface PostConvergenceFiles {
  readonly 'summary.md': string;
  readonly 'baseline.json': string;
  readonly 'owner-residue.md': string;
  readonly 'hotspots.md': string;
  readonly 'payload-classes.md': string;
  readonly 'test-baseline.md': string;
}

export interface PostConvergenceInput {
  readonly snapshot: CensusSourceSnapshot;
  readonly originIntegrationCommit: string;
  readonly predecessors: SuccessorPredecessors;
  readonly receipts: readonly MeasurementReceipt[];
  readonly blobIndex: ReadonlyMap<string, string>;
  readonly changeCounts: ReadonlyMap<string, number>;
  readonly census?: { core: CensusCore; failures: QualificationFailure[] };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function cell(value: string): string {
  return value.replaceAll('|', '/').replaceAll('\n', ' ');
}

function table(headers: readonly string[], body: readonly (readonly string[])[]): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

const LAYER_INCLUDE_RULES: Readonly<Record<MaterialLayer, readonly string[]>> = {
  'binary-media-model': [`extension in BINARY_MEDIA_MODEL_EXTENSIONS (${BINARY_MEDIA_MODEL_EXTENSIONS.length} declared)`],
  'archived-openspec': ['prefix:openspec/changes/archive/'],
  'active-openspec': ['prefix:openspec/ (non-archive)'],
  'generated-runtime-release': ['prefix:course-content/runtime/'],
  'authored-course-content': ['prefix:course-content/ (non-runtime)'],
  'qa-browser-evidence': ['prefix:artifacts/'],
  tests: ['isTestPath(path)'],
  'tools-scripts': ['prefix:scripts/', 'prefix:.husky/'],
  'build-assets': ['prefix:.github/', 'prefix:public/', 'file:Dockerfile*', 'file:docker-compose*'],
  'hand-authored-production': ['default: any tracked path not claimed by a higher-precedence layer'],
};

const LAYER_EXCLUDE_RULES: readonly string[] = [
  'generated:.next',
  'generated:node_modules',
  'precedence: a path matching several layers is assigned once to the first matching layer',
];

function binaryExtension(path: string): boolean {
  const dot = path.lastIndexOf('.');
  return dot >= 0 && BINARY_EXTENSIONS.has(path.slice(dot));
}

export function classifyMaterialLayer(path: string): MaterialLayer {
  if (binaryExtension(path)) return 'binary-media-model';
  if (path.startsWith('openspec/changes/archive/')) return 'archived-openspec';
  if (path.startsWith('openspec/')) return 'active-openspec';
  if (path.startsWith('course-content/runtime/')) return 'generated-runtime-release';
  if (path.startsWith('course-content/')) return 'authored-course-content';
  if (path.startsWith('artifacts/')) return 'qa-browser-evidence';
  if (isTestPath(path)) return 'tests';
  if (path.startsWith('scripts/') || path.startsWith('.husky/')) return 'tools-scripts';
  if (path.startsWith('.github/') || path.startsWith('public/') || /^Dockerfile/.test(path) || path.startsWith('docker-compose')) {
    return 'build-assets';
  }
  return 'hand-authored-production';
}

function layerDiscoveryMatches(path: string, layer: MaterialLayer): boolean {
  return classifyMaterialLayer(path) === layer;
}

export function buildMaterialLayers(
  snapshot: CensusSourceSnapshot,
  blobIndex: ReadonlyMap<string, string>,
  core: CensusCore,
): MaterialLayerResult {
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  for (const row of core.observations) {
    if (row.kind !== 'dependency-edge') continue;
    const from = String(row.attributes.from ?? '');
    const to = String(row.attributes.to ?? '');
    if (from) outDegree.set(from, (outDegree.get(from) ?? 0) + 1);
    if (to) inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
  }

  const assignments = new Map<string, MaterialLayer>();
  for (const file of snapshot.files) {
    assignments.set(file.path, classifyMaterialLayer(file.path));
  }
  const manifests: MaterialLayerManifest[] = MATERIAL_LAYERS.map((layer) => {
    const discoveredPaths = snapshot.files
      .map((file) => file.path)
      .filter((path) => layerDiscoveryMatches(path, layer));
    const representedPaths = discoveredPaths.filter((path) => assignments.get(path) === layer);
    return {
      layer,
      includeRules: LAYER_INCLUDE_RULES[layer],
      excludeRules: LAYER_EXCLUDE_RULES,
      totals: {
        discovered: discoveredPaths.length,
        represented: representedPaths.length,
        excluded: discoveredPaths.length - representedPaths.length,
        duplicate: 0,
        unresolved: 0,
      },
      byteTotal: representedPaths.reduce(
        (sum, path) => sum + (snapshot.files.find((file) => file.path === path)?.byteLength ?? 0),
        0,
      ),
    };
  });
  const inventory: FullInventoryRecord[] = snapshot.files
    .map((file) => ({
      path: file.path,
      layer: assignments.get(file.path) ?? 'hand-authored-production',
      byteCount: file.byteLength,
      blobSha: blobIndex.get(file.path) ?? '',
      inDegree: inDegree.get(file.path) ?? 0,
      outDegree: outDegree.get(file.path) ?? 0,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const layerAssignedCount = inventory.filter((row) => assignments.has(row.path)).length;
  return {
    manifests,
    inventory,
    reconciliation: {
      trackedFileCount: snapshot.files.length,
      layerAssignedCount,
      unassignedCount: snapshot.files.length - layerAssignedCount,
    },
  };
}

function productionSrcLibFiles(snapshot: CensusSourceSnapshot): string[] {
  return snapshot.files
    .map((file) => file.path)
    .filter((path) => (
      path.startsWith('src/lib/')
      && isSourcePath(path)
      && !isTestPath(path)
      && !isGeneratedPath(path)
    ))
    .sort();
}

function consumerDomainsFor(core: CensusCore, path: string): string[] {
  const domains = new Set<string>();
  for (const row of core.observations) {
    if (row.kind !== 'dependency-edge' || row.attributes.context !== 'production') continue;
    if (String(row.attributes.to ?? '') !== path) continue;
    const domain = featureName(String(row.attributes.from ?? ''));
    if (domain) domains.add(domain);
  }
  return [...domains].sort();
}

const PUBLIC_ENTRYPOINT_PATTERN = /^src\/(?:features|lib)\/[^/]+\/(?:index|public-api|ports|public)\.(?:ts|tsx)$/u;
const INTERFACE_NAME_PATTERN = /(?:^|\/)(?:types|(?:[a-z0-9]+-)?contracts?)\.(?:ts|tsx)$/u;
const COMMENT_LINE = /^\s*(?:\/\/.*|\/\*.*?\*\/\s*)$/u;
const REEXPORT_STATEMENT = /^export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"][^'"]+['"];?\s*$/u;

function productionImporterCount(core: CensusCore, path: string): number {
  const importers = new Set<string>();
  for (const row of core.observations) {
    if (row.kind !== 'dependency-edge' || row.attributes.context !== 'production') continue;
    if (String(row.attributes.to ?? '') === path) importers.add(String(row.attributes.from ?? ''));
  }
  return importers.size;
}

function isDelegateOnlyWrapper(content: string): boolean {
  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) return false;
  return lines.every((line) => REEXPORT_STATEMENT.test(line) || COMMENT_LINE.test(line));
}

function sliceRecord(
  slice: DerivedSlice,
  identity: string,
  attributes: Record<string, string | number | boolean | null>,
  evidence: readonly string[],
  notes: readonly string[] = [],
): DerivedSliceRecord {
  return {
    id: `slice:${slice}:${identity}`,
    slice,
    identity,
    evidence: uniqueSorted(evidence),
    attributes: Object.fromEntries(Object.entries(attributes).sort(([left], [right]) => left.localeCompare(right))),
    notes: uniqueSorted(notes),
  };
}

const SLICE_INCLUDE_RULES: Readonly<Record<DerivedSlice, readonly string[]>> = {
  'feature-to-app-router': ['census:dependency-edge where attributes.featureToApp = true'],
  'deep-import': ['census:kind deep-import'],
  'core-infrastructure': ['path:src/lib/** production source with >= 2 distinct src/features/* production importer domains'],
  scc: ['census:kind scc'],
  'src-lib-business': ['path:src/lib/** production source not classified core-infrastructure'],
  compatibility: ['census:kind compatibility-surface'],
  'duplicate-owner': ['census:ownership.state = ambiguous'],
  'public-entrypoint': ['path:src/{features,lib}/<domain>/{index,public-api,ports,public}.ts(x)'],
  'single-implementation-interface': [
    'path:src/** named types|contract(s).ts(x) exporting interface/type with exactly 1 production importer',
  ],
  'delegate-only-wrapper': ['census:kind compatibility-surface whose file content is exclusively re-export statements'],
  'zero-caller': [
    'path:src/** production source with no census entrypoint/route/api/worker/script kind and no production dependency-edge inbound',
  ],
};

export function buildDerivedSlices(
  snapshot: CensusSourceSnapshot,
  core: CensusCore,
): DerivedSliceResult {
  const failures: QualificationFailure[] = [];
  const records: DerivedSliceRecord[] = [];
  const manifests: DerivedSliceManifest[] = DERIVED_SLICES.map((slice) => {
    const sliceRecords: DerivedSliceRecord[] = [];
    let discovered: string[] = [];

    const contentOf = (path: string): string => snapshot.files.find((file) => file.path === path)?.content ?? '';

    if (slice === 'feature-to-app-router') {
      const rows = core.observations.filter((row) => row.kind === 'dependency-edge' && row.attributes.featureToApp === true);
      discovered = rows.map((row) => row.identity);
      for (const row of rows) {
        sliceRecords.push(sliceRecord(slice, row.identity, {
          from: String(row.attributes.from ?? ''),
          to: String(row.attributes.to ?? ''),
        }, [row.attributes.from, row.attributes.to].map(String)));
      }
    } else if (slice === 'deep-import') {
      const rows = core.observations.filter((row) => row.kind === 'deep-import');
      discovered = rows.map((row) => row.identity);
      for (const row of rows) {
        sliceRecords.push(sliceRecord(slice, row.identity, {
          from: String(row.attributes.from ?? ''),
          to: String(row.attributes.to ?? ''),
        }, [row.attributes.from, row.attributes.to].map(String)));
      }
    } else if (slice === 'core-infrastructure' || slice === 'src-lib-business') {
      const base = productionSrcLibFiles(snapshot);
      discovered = base;
      for (const path of base) {
        const domains = consumerDomainsFor(core, path);
        const shared = domains.length >= 2;
        if (slice === 'core-infrastructure' && shared) {
          sliceRecords.push(sliceRecord(slice, path, {
            consumerDomains: domains.join(','),
            consumerDomainCount: domains.length,
          }, domains.map((domain) => `src/features/${domain}/`), ['cross-domain-shared-infrastructure']));
        }
        if (slice === 'src-lib-business' && !shared) {
          sliceRecords.push(sliceRecord(slice, path, {
            consumerDomains: domains.join(','),
            consumerDomainCount: domains.length,
          }, domains.map((domain) => `src/features/${domain}/`), ['domain-coupled-or-unconsumed']));
        }
      }
    } else if (slice === 'scc') {
      const rows = core.observations.filter((row) => row.kind === 'scc');
      discovered = rows.map((row) => row.identity);
      for (const row of rows) {
        sliceRecords.push(sliceRecord(slice, row.identity, {
          memberCount: Number(row.attributes.memberCount ?? 0),
          edgeCount: Number(row.attributes.edgeCount ?? 0),
        }, row.evidence));
      }
    } else if (slice === 'compatibility') {
      const rows = core.observations.filter((row) => row.kind === 'compatibility-surface');
      discovered = rows.map((row) => row.identity);
      for (const row of rows) {
        sliceRecords.push(sliceRecord(slice, row.identity, { compatibility: true }, row.evidence, row.notes));
      }
    } else if (slice === 'duplicate-owner') {
      const ambiguous = new Map<string, CensusObservation>();
      for (const row of core.observations) {
        if (row.ownership.state !== 'ambiguous') continue;
        const existing = ambiguous.get(row.identity);
        if (existing && existing.id >= row.id) continue;
        ambiguous.set(row.identity, row);
      }
      discovered = [...ambiguous.keys()].sort();
      for (const identity of discovered) {
        const row = ambiguous.get(identity)!;
        sliceRecords.push(sliceRecord(slice, identity, {
          conflictingEvidence: row.ownership.conflictingEvidence.join(','),
        }, row.ownership.conflictingEvidence, ['owner-adjudication-belongs-to-B']));
      }
    } else if (slice === 'public-entrypoint') {
      discovered = snapshot.files
        .map((file) => file.path)
        .filter((path) => PUBLIC_ENTRYPOINT_PATTERN.test(path) && !isTestPath(path) && !isGeneratedPath(path))
        .sort();
      for (const path of discovered) {
        const domains = consumerDomainsFor(core, path);
        sliceRecords.push(sliceRecord(slice, path, {
          consumerDomains: domains.join(','),
          consumerDomainCount: domains.length,
          fanIn: productionImporterCount(core, path),
        }, domains.map((domain) => `src/features/${domain}/`)));
      }
    } else if (slice === 'single-implementation-interface') {
      discovered = snapshot.files
        .map((file) => file.path)
        .filter((path) => (
          path.startsWith('src/')
          && INTERFACE_NAME_PATTERN.test(path)
          && !isTestPath(path)
          && !isGeneratedPath(path)
          && /export\s+(?:interface|type)\s/u.test(contentOf(path))
        ))
        .sort();
      for (const path of discovered) {
        const importers = productionImporterCount(core, path);
        if (importers === 1) {
          const importer = core.observations.find((row) => (
            row.kind === 'dependency-edge'
            && row.attributes.context === 'production'
            && String(row.attributes.to ?? '') === path
          ));
          sliceRecords.push(sliceRecord(slice, path, {
            productionImporterCount: importers,
            importer: String(importer?.attributes.from ?? ''),
          }, [path, String(importer?.attributes.from ?? '')]));
        }
      }
    } else if (slice === 'delegate-only-wrapper') {
      const rows = core.observations.filter((row) => row.kind === 'compatibility-surface');
      discovered = rows.map((row) => row.identity);
      for (const row of rows) {
        if (isDelegateOnlyWrapper(contentOf(row.identity))) {
          sliceRecords.push(sliceRecord(slice, row.identity, {
            reExportOnly: true,
          }, row.evidence, ['deletion-eligibility-unknown']));
        }
      }
    } else if (slice === 'zero-caller') {
      const frameworkCalled = new Set<string>();
      for (const row of core.observations) {
        if (['entrypoint', 'route', 'api', 'worker', 'script', 'test'].includes(row.kind)) {
          frameworkCalled.add(row.identity);
        }
      }
      const inbound = new Set<string>();
      for (const row of core.observations) {
        if (row.kind !== 'dependency-edge' || row.attributes.context !== 'production') continue;
        inbound.add(String(row.attributes.to ?? ''));
      }
      const testInbound = new Set<string>();
      for (const row of core.observations) {
        if (row.kind !== 'dependency-edge' || row.attributes.context !== 'test') continue;
        testInbound.add(String(row.attributes.to ?? ''));
      }
      discovered = snapshot.files
        .map((file) => file.path)
        .filter((path) => (
          path.startsWith('src/')
          && isSourcePath(path)
          && !isTestPath(path)
          && !isGeneratedPath(path)
        ))
        .sort();
      for (const path of discovered) {
        if (frameworkCalled.has(path) || inbound.has(path)) continue;
        sliceRecords.push(sliceRecord(slice, path, {
          hasTestConsumers: testInbound.has(path),
        }, [path], ['dynamic-load-and-reflection-not-disproven']));
      }
    }

    const represented = sliceRecords.map((row) => row.identity);
    const representedSet = new Set(represented);
    const totals: DenominatorTotals = {
      discovered: discovered.length,
      represented: representedSet.size,
      excluded: discovered.filter((identity) => !representedSet.has(identity)).length,
      duplicate: represented.length - representedSet.size,
      unresolved: 0,
    };
    if (totals.duplicate > 0) failures.push({ code: 'slice-duplicate-identity', identity: slice });
    records.push(...sliceRecords);
    return { slice, includeRules: SLICE_INCLUDE_RULES[slice], totals };
  });
  return {
    manifests: manifests.sort((left, right) => left.slice.localeCompare(right.slice)),
    records: records.sort((left, right) => left.id.localeCompare(right.id)),
    failures,
  };
}

function archiveScopePath(path: string): boolean {
  return path.startsWith('openspec/changes/archive/') || path.startsWith('artifacts/');
}

export function classifyBlobPayloadClass(paths: readonly string[]): PayloadClassAggregate['className'] {
  const runtime = paths.filter((path) => path.startsWith('course-content/runtime/'));
  const archive = paths.filter(archiveScopePath);
  const authoring = paths.filter((path) => path.startsWith('course-content/authoring/'));
  const other = paths.filter((path) => (
    !path.startsWith('course-content/runtime/')
    && !archiveScopePath(path)
    && !path.startsWith('course-content/authoring/')
  ));
  // authoring+runtime is the normal pipeline state (source + materialized view): runtime wins.
  // runtime+archive, or archive mixed with live material, is a genuine authority conflict for C.
  if (runtime.length > 0 && archive.length > 0) return 'mixed-unresolved';
  if (runtime.length > 0) return 'current-runtime-referenced';
  if (archive.length === paths.length) return 'archive-only';
  if (archive.length > 0) return 'mixed-unresolved';
  if (authoring.length > 0 && other.length === 0) return 'authoring-only';
  if (authoring.length > 0) return 'mixed-unresolved';
  return 'other-tracked';
}

export function buildPayloadClasses(
  snapshot: CensusSourceSnapshot,
  blobIndex: ReadonlyMap<string, string>,
): PayloadClassResult {
  const byBlob = new Map<string, { paths: string[]; bytes: number }>();
  for (const file of snapshot.files) {
    const blobSha = blobIndex.get(file.path) ?? '';
    if (!blobSha) continue;
    const entry = byBlob.get(blobSha) ?? { paths: [], bytes: 0 };
    entry.paths.push(file.path);
    entry.bytes += file.byteLength;
    byBlob.set(blobSha, entry);
  }
  const classCounts = new Map<string, { blobCount: number; duplicateBlobCount: number; pathCount: number; byteTotal: number }>();
  let duplicateBlobCount = 0;
  let unresolvedCount = 0;
  for (const [, entry] of [...byBlob.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const duplicate = entry.paths.length > 1;
    if (duplicate) duplicateBlobCount += 1;
    const className = classifyBlobPayloadClass(entry.paths);
    if (className === 'mixed-unresolved') unresolvedCount += 1;
    const aggregate = classCounts.get(className) ?? { blobCount: 0, duplicateBlobCount: 0, pathCount: 0, byteTotal: 0 };
    aggregate.blobCount += 1;
    aggregate.duplicateBlobCount += duplicate ? 1 : 0;
    aggregate.pathCount += entry.paths.length;
    aggregate.byteTotal += entry.bytes;
    classCounts.set(className, aggregate);
  }
  const classes: PayloadClassAggregate[] = [...classCounts.entries()]
    .map(([className, aggregate]) => ({
      className: className as PayloadClassAggregate['className'],
      blobCount: aggregate.blobCount,
      duplicateBlobCount: aggregate.duplicateBlobCount,
      pathCount: aggregate.pathCount,
      byteTotal: aggregate.byteTotal,
    }))
    .sort((left, right) => left.className.localeCompare(right.className));
  return {
    duplicateBlobCount,
    classes,
    unresolvedCount,
  };
}

export const HOTSPOT_METRIC_SCOPE = [
  'sourceBytes: file.byteLength',
  'functionCount: count of /\\bfunction\\b/ in source content',
  'branchCount: count of /\\b(?:if|for|while|switch|case|catch)\\b/ in source content',
  'importBreadth: distinct src/<top-dir> prefixes of census dependency-edge targets',
  'fanIn: census dependency-edge inbound count (production context)',
  'fanOut: census dependency-edge outbound count (production context)',
  `changeFrequency: commits touching the path within the last ${CHANGE_FREQUENCY_COMMIT_LIMIT} commits of HEAD`,
  'testDensity: count of census test observations whose basename-without-extension equals the file basename-without-extension',
  'trustDensity: count of census observations with trustClass != null whose evidence contains the path',
] as const;

export const HOTSPOT_RANK_TUPLE = [
  'sourceBytes desc',
  'fanIn desc',
  'changeFrequency desc',
  'functionCount desc',
  'branchCount desc',
  'importBreadth desc',
  'testDensity desc',
  'trustDensity desc',
  'fanOut desc',
  'identity asc (stable tie-break)',
] as const;

function basenameWithoutExtension(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

function hotspotMetrics(
  path: string,
  content: string,
  byteLength: number,
  core: CensusCore,
  changeCounts: ReadonlyMap<string, number>,
): HotspotMetricVector {
  const fanIn: string[] = [];
  const fanOut: string[] = [];
  const trustEvidence = new Set<string>();
  const testBasenames = new Set<string>();
  for (const row of core.observations) {
    if (row.kind === 'dependency-edge' && row.attributes.context === 'production') {
      if (String(row.attributes.to ?? '') === path) fanIn.push(String(row.attributes.from ?? ''));
      if (String(row.attributes.from ?? '') === path) fanOut.push(String(row.attributes.to ?? ''));
    }
    if (row.trustClass && row.evidence.includes(path)) trustEvidence.add(row.id);
    if (row.kind === 'test') testBasenames.add(basenameWithoutExtension(row.identity));
  }
  return {
    sourceBytes: byteLength,
    functionCount: (content.match(/\bfunction\b/gu) ?? []).length,
    branchCount: (content.match(/\b(?:if|for|while|switch|case|catch)\b/gu) ?? []).length,
    importBreadth: new Set(fanOut.map((target) => target.split('/').slice(0, 2).join('/'))).size,
    fanIn: fanIn.length,
    fanOut: fanOut.length,
    changeFrequency: changeCounts.get(path) ?? 0,
    testDensity: testBasenames.has(basenameWithoutExtension(path)) ? 1 : 0,
    trustDensity: trustEvidence.size,
  };
}

function hotspotComparator(left: { identity: string; metrics: HotspotMetricVector }, right: { identity: string; metrics: HotspotMetricVector }): number {
  const order: Array<(entry: { metrics: HotspotMetricVector }) => number> = [
    (entry) => entry.metrics.sourceBytes,
    (entry) => entry.metrics.fanIn,
    (entry) => entry.metrics.changeFrequency,
    (entry) => entry.metrics.functionCount,
    (entry) => entry.metrics.branchCount,
    (entry) => entry.metrics.importBreadth,
    (entry) => entry.metrics.testDensity,
    (entry) => entry.metrics.trustDensity,
    (entry) => entry.metrics.fanOut,
  ];
  for (const metric of order) {
    const delta = metric(right) - metric(left);
    if (delta !== 0) return delta;
  }
  return left.identity.localeCompare(right.identity);
}

export function buildHotspots(
  snapshot: CensusSourceSnapshot,
  core: CensusCore,
  changeCounts: ReadonlyMap<string, number>,
): HotspotResult {
  const changeCenters = new Set(
    core.observations.filter((row) => row.kind === 'change-center').map((row) => row.identity),
  );
  const candidates: { identity: string; metrics: HotspotMetricVector }[] = [];
  const unresolvedMetrics: string[] = [];
  for (const file of snapshot.files) {
    if (!file.path.startsWith('src/') || !isSourcePath(file.path) || isTestPath(file.path) || isGeneratedPath(file.path)) {
      continue;
    }
    if (file.content === '') {
      unresolvedMetrics.push(file.path);
      continue;
    }
    candidates.push({
      identity: file.path,
      metrics: hotspotMetrics(file.path, file.content, file.byteLength, core, changeCounts),
    });
  }
  const ranked = candidates
    .sort(hotspotComparator)
    .slice(0, HOTSPOT_LIMIT)
    .map((entry, index): HotspotEntry => ({
      rank: index + 1,
      identity: entry.identity,
      metrics: entry.metrics,
      changeCenter: changeCenters.has(entry.identity),
      evidence: [
        'census:dependency-edge',
        `git-log:n=${CHANGE_FREQUENCY_COMMIT_LIMIT}`,
        entry.identity,
      ],
    }));
  return {
    entries: ranked,
    unresolvedMetrics: unresolvedMetrics.sort((left, right) => left.localeCompare(right)),
  };
}

export function buildOwnerResidue(
  predecessors: SuccessorPredecessors,
  core: CensusCore,
  snapshot: CensusSourceSnapshot,
): readonly OwnerResidueRecord[] {
  const rollbackReference = `predecessor-baseline:${predecessors.baseline.sourceCommit}`;
  const records: OwnerResidueRecord[] = predecessors.currentHeadPackage.records.map((row) => ({
    id: `current-head-delta:${row.id}`,
    source: 'current-head-delta',
    identity: row.identity,
    currentOwnerEvidence: [...row.currentOwnerEvidence],
    candidateTargetOwners: [...row.candidateTargetOwners],
    consumers: row.consumers.map((consumer) => ({
      path: consumer.path,
      kind: consumer.kind,
      relationship: consumer.relationship,
    })),
    consumerClass: row.consumerClass,
    deletionCondition: row.deletionCondition,
    trustBoundary: row.trustBoundary,
    state: row.observationVsFinding === 'unresolved' ? 'unresolved' : 'observation',
    evidence: [...row.evidence],
    rollbackReference,
    notes: [...row.notes],
  }));
  for (const row of core.observations) {
    if (row.ownership.state !== 'ambiguous') continue;
    records.push({
      id: `census-duplicate-owner:${row.identity}`,
      source: 'census-duplicate-owner',
      identity: row.identity,
      currentOwnerEvidence: [...row.ownership.currentOwnerEvidence],
      candidateTargetOwners: [],
      consumers: [],
      consumerClass: 'unresolved',
      deletionCondition: DELETION_CONDITION_UNRESOLVED,
      trustBoundary: null,
      state: 'ambiguous',
      evidence: [...row.ownership.conflictingEvidence],
      rollbackReference,
      notes: ['owner-adjudication-belongs-to-B'],
    });
  }
  for (const file of snapshot.files) {
    if (!PUBLIC_ENTRYPOINT_PATTERN.test(file.path) || isTestPath(file.path)) continue;
    const domains = consumerDomainsFor(core, file.path);
    records.push({
      id: `census-public-entrypoint:${file.path}`,
      source: 'census-public-entrypoint',
      identity: file.path,
      currentOwnerEvidence: ownerEvidenceFromPath(file.path),
      candidateTargetOwners: domains,
      consumers: domains.map((domain) => ({
        path: `src/features/${domain}/`,
        kind: 'production',
        relationship: 'import',
      })),
      consumerClass: domains.length > 0 ? 'production' : 'none-discovered',
      deletionCondition: DELETION_CONDITION_UNRESOLVED,
      trustBoundary: 'domain-public-api',
      state: 'observation',
      evidence: domains.map((domain) => `src/features/${domain}/`),
      rollbackReference,
      notes: [],
    });
  }
  const seen = new Set<string>();
  return records
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function loadSuccessorPredecessors(repoRoot: string): SuccessorPredecessors {
  const baselineDir = join(repoRoot, 'docs/architecture/modular-monolith/baseline');
  const censusText = readFileSync(join(baselineDir, 'census-core.json'), 'utf8');
  const censusHash = sha256Text(censusText).trim();
  const hashFile = readFileSync(join(baselineDir, 'census-core.sha256'), 'utf8').trim();
  if (censusHash !== hashFile) {
    throw new Error(`predecessor-hash-file-mismatch:${hashFile}`);
  }
  if (censusHash !== REQUIRED_BASELINE.censusCoreSha256) {
    throw new Error(`predecessor-rewritten:${censusHash}`);
  }
  const parsed = JSON.parse(censusText) as {
    schemaVersion?: string;
    captureIdentity?: { sourceCommit?: string; sourceTree?: string };
    manifests?: Array<{ kind?: string }>;
  };
  if (parsed.captureIdentity?.sourceCommit !== REQUIRED_BASELINE.sourceCommit
    || parsed.captureIdentity?.sourceTree !== REQUIRED_BASELINE.sourceTree
    || parsed.schemaVersion !== REQUIRED_BASELINE.schemaVersion) {
    throw new Error(`predecessor-identity-mismatch:${parsed.captureIdentity?.sourceCommit ?? 'missing'}`);
  }
  const predecessorKindSet = (parsed.manifests ?? [])
    .map((manifest) => String(manifest.kind ?? ''))
    .filter(Boolean)
    .sort();
  if (predecessorKindSet.length === 0) {
    throw new Error('predecessor-kind-set-unreadable');
  }

  const deltaText = readFileSync(join(repoRoot, 'docs/architecture/modular-monolith/current-head/delta.json'), 'utf8');
  const deltaParsed = JSON.parse(deltaText) as CurrentHeadPackage;
  if (deltaParsed.schemaVersion !== CURRENT_HEAD_DELTA_SCHEMA_VERSION) {
    throw new Error(`predecessor-delta-schema-mismatch:${deltaParsed.schemaVersion ?? 'missing'}`);
  }
  if (deltaParsed.predecessor?.censusCoreSha256 !== REQUIRED_BASELINE.censusCoreSha256) {
    throw new Error('predecessor-delta-lineage-mismatch');
  }
  if (!/^[a-f0-9]{40}$/u.test(deltaParsed.captureIdentity?.sourceCommit ?? '')
    || !/^[a-f0-9]{40}$/u.test(deltaParsed.captureIdentity?.sourceTree ?? '')) {
    throw new Error('predecessor-delta-identity-unresolved');
  }
  return {
    baseline: {
      schemaVersion: REQUIRED_BASELINE.schemaVersion,
      sourceCommit: REQUIRED_BASELINE.sourceCommit,
      sourceTree: REQUIRED_BASELINE.sourceTree,
      censusCoreSha256: REQUIRED_BASELINE.censusCoreSha256,
      receiptSchemaVersion: REQUIRED_BASELINE.receiptSchemaVersion,
      receiptIds: [...REQUIRED_BASELINE.receiptIds],
    },
    currentHead: {
      schemaVersion: deltaParsed.schemaVersion,
      sourceCommit: deltaParsed.captureIdentity.sourceCommit,
      sourceTree: deltaParsed.captureIdentity.sourceTree,
      packageSha256: sha256Text(deltaText),
    },
    currentHeadPackage: deltaParsed,
    predecessorKindSet,
  };
}

export function successorPreconditionFailures(input: {
  readonly originIntegrationCommit: string;
  readonly headCommit: string;
  readonly snapshot: CensusSourceSnapshot;
}): QualificationFailure[] {
  const failures: QualificationFailure[] = [];
  const commit = input.snapshot.identity.sourceCommit;
  if (input.snapshot.dirty) failures.push({ code: 'dirty-worktree', identity: commit });
  if (input.snapshot.mixedWorktree) failures.push({ code: 'mixed-worktree', identity: commit });
  if (input.snapshot.detachedUnresolved) failures.push({ code: 'unresolved-identity', identity: commit });
  if (input.headCommit !== input.originIntegrationCommit) {
    failures.push({ code: 'origin-head-mismatch', identity: input.headCommit });
  }
  return failures;
}

export function successorWriteGate(
  expected: CaptureIdentity,
  originIntegrationCommit: string,
  porcelain: string,
  commit: string,
  tree: string,
): QualificationFailure[] {
  const failures: QualificationFailure[] = [];
  if (porcelain.trim().length > 0) failures.push({ code: 'dirty-worktree', identity: commit || expected.sourceCommit });
  if (commit !== expected.sourceCommit || tree !== expected.sourceTree) {
    failures.push({ code: 'mixed-identity', identity: commit || expected.sourceCommit });
  }
  if (commit !== originIntegrationCommit) {
    failures.push({ code: 'origin-head-mismatch', identity: commit || expected.sourceCommit });
  }
  return failures;
}

export function predecessorOverwriteFailures(
  before: { readonly baselineCensusSha256: string; readonly deltaSha256: string },
  after: { readonly baselineCensusSha256: string; readonly deltaSha256: string },
): QualificationFailure[] {
  const failures: QualificationFailure[] = [];
  if (before.baselineCensusSha256 !== after.baselineCensusSha256) {
    failures.push({ code: 'historical-overwrite', identity: 'baseline/census-core.json' });
  }
  if (before.deltaSha256 !== after.deltaSha256) {
    failures.push({ code: 'historical-overwrite', identity: 'current-head/delta.json' });
  }
  return failures;
}

export function successorOverwriteFailures(
  files: Readonly<Record<string, string>>,
  readExisting: (name: string) => string | null,
): QualificationFailure[] {
  const failures: QualificationFailure[] = [];
  for (const name of Object.keys(files).sort()) {
    let existing: string | null = null;
    try {
      existing = readExisting(name);
    } catch {
      existing = null;
    }
    if (existing !== null && existing !== files[name]) {
      failures.push({ code: 'successor-overwrite', identity: `${POST_CONVERGENCE_OUTPUT_DIR}/${name}` });
    }
  }
  return failures;
}

export function loadTrackedBlobIndex(repoRoot: string): Map<string, string> {
  // -z keeps non-ASCII paths unquoted; the default format octal-escapes them.
  const output = execFileSync('git', ['ls-files', '-s', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const index = new Map<string, string>();
  for (const record of output.split('\0')) {
    const match = record.match(/^[0-9]+ ([0-9a-f]{40}) \d+\t(.+)$/u);
    if (match?.[1] && match[2]) index.set(match[2], match[1]);
  }
  return index;
}

export function loadChangeFrequencyCounts(repoRoot: string): Map<string, number> {
  const output = execFileSync('git', ['log', `-n${CHANGE_FREQUENCY_COMMIT_LIMIT}`, '--format=%H', '--name-only'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const counts = new Map<string, number>();
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^[0-9a-f]{40}$/u.test(trimmed)) continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }
  return counts;
}

export const SUCCESSOR_DIGEST_SCOPE = 'sha256 over serializeDeterministic(envelope with packageDigest=""); covers the complete artifact index (including the summary.md row), the full handoff contract, and every envelope field. summary.md deliberately renders no packageDigest value so the digest has no self-reference';

export function successorPackageDigest(pack: PostConvergenceEnvelope): string {
  return sha256Text(serializeDeterministic({ ...pack, packageDigest: '' }));
}

function ndlines(records: readonly unknown[]): string {
  return `${records.map((record) => JSON.stringify(record).trim()).sort((left, right) => left.localeCompare(right)).join('\n')}\n`;
}

function artifactEntry(logicalLocator: string, mediaType: string, content: string): {
  readonly logicalLocator: string;
  readonly mediaType: string;
  readonly byteCount: number;
  readonly sha256: string;
} {
  return {
    logicalLocator,
    mediaType,
    byteCount: Buffer.byteLength(content, 'utf8'),
    sha256: sha256Text(content),
  };
}

function identityHeader(pack: PostConvergenceEnvelope): string[] {
  return [
    '## Capture identity',
    '',
    `- successorCaptureId: \`${pack.successorCaptureId}\``,
    `- sourceCommit: \`${pack.captureIdentity.sourceCommit}\``,
    `- sourceTree: \`${pack.captureIdentity.sourceTree}\``,
    `- commitTime: \`${pack.captureIdentity.commitTime}\``,
    `- schemaVersion: \`${pack.schemaVersion}\``,
    `- schemaVersions.censusCore: \`${pack.schemaVersions.censusCore ?? ''}\``,
    `- schemaVersions.measurementReceipt: \`${pack.schemaVersions.measurementReceipt ?? ''}\``,
    `- schemaVersions.currentHeadDelta: \`${pack.schemaVersions.currentHeadDelta ?? ''}\``,
    `- nodeVersion: \`${pack.toolVersions.nodeVersion ?? ''}\``,
    `- npmVersion: \`${pack.toolVersions.npmVersion ?? ''}\``,
    `- typescriptVersion: \`${pack.toolVersions.typescriptVersion ?? ''}\``,
    `- predecessorBaseline.sourceCommit: \`${pack.predecessorBaseline.sourceCommit}\``,
    `- predecessorBaseline.censusCoreSha256: \`${pack.predecessorBaseline.censusCoreSha256}\``,
    `- predecessorCurrentHead.sourceCommit: \`${pack.predecessorCurrentHead.sourceCommit}\``,
    `- predecessorCurrentHead.packageSha256: \`${pack.predecessorCurrentHead.packageSha256}\``,
    '',
  ];
}

function projectSummary(pack: PostConvergenceEnvelope): string {
  return [
    '# Post-convergence successor capture',
    '',
    `- schemaVersion: \`${pack.schemaVersion}\``,
    `- successorCaptureId: \`${pack.successorCaptureId}\``,
    `- status: \`${pack.status}\``,
    `- sourceCommit: \`${pack.captureIdentity.sourceCommit}\``,
    `- sourceTree: \`${pack.captureIdentity.sourceTree}\``,
    `- commitTime: \`${pack.captureIdentity.commitTime}\``,
    `- originIntegrationCommit: \`${pack.originIntegrationCommit}\``,
    `- predecessorBaseline.sourceCommit: \`${pack.predecessorBaseline.sourceCommit}\``,
    `- predecessorBaseline.censusCoreSha256: \`${pack.predecessorBaseline.censusCoreSha256}\``,
    `- predecessorCurrentHead.sourceCommit: \`${pack.predecessorCurrentHead.sourceCommit}\``,
    `- predecessorCurrentHead.packageSha256: \`${pack.predecessorCurrentHead.packageSha256}\``,
    `- successorCoreSha256: \`${pack.successorCoreSha256}\``,
    '- packageDigest: see `baseline.json` (the canonical envelope renders no digest value here, keeping the package digest free of self-reference)',
    `- commandScope: \`${pack.commandScope}\``,
    `- nodeVersion: \`${pack.toolVersions.nodeVersion ?? ''}\``,
    `- npmVersion: \`${pack.toolVersions.npmVersion ?? ''}\``,
    `- typescriptVersion: \`${pack.toolVersions.typescriptVersion ?? ''}\``,
    `- schemaVersions.censusCore: \`${pack.schemaVersions.censusCore ?? ''}\``,
    `- schemaVersions.measurementReceipt: \`${pack.schemaVersions.measurementReceipt ?? ''}\``,
    `- schemaVersions.currentHeadDelta: \`${pack.schemaVersions.currentHeadDelta ?? ''}\``,
    '',
    'This is an immutable A2 successor observation. It never becomes the active baseline:',
    '`captured`, `digest-verified`, and `qualified-for-investigation` are distinct from `active-baseline`,',
    'and only N5 may later atomically activate a baseline after its own recapture or equivalence proof.',
    '',
    '## Status evidence',
    '',
    table(
      ['stage', 'evidence'],
      pack.statusEvidence.map((stage) => [stage.stage, stage.evidence]),
    ),
    '',
    '## Material layers',
    '',
    table(
      ['layer', 'discovered', 'represented', 'excluded', 'duplicate', 'unresolved', 'bytes'],
      pack.materialLayers.map((layer) => [
        layer.layer,
        String(layer.totals.discovered),
        String(layer.totals.represented),
        String(layer.totals.excluded),
        String(layer.totals.duplicate),
        String(layer.totals.unresolved),
        String(layer.byteTotal),
      ]),
    ),
    `- layer reconciliation: tracked=${pack.layerReconciliation.trackedFileCount} assigned=${pack.layerReconciliation.layerAssignedCount} unassigned=${pack.layerReconciliation.unassignedCount}`,
    '',
    '## Derived denominator slices',
    '',
    table(
      ['slice', 'discovered', 'represented', 'excluded', 'duplicate', 'unresolved'],
      pack.denominatorSlices.map((slice) => [
        slice.slice,
        String(slice.totals.discovered),
        String(slice.totals.represented),
        String(slice.totals.excluded),
        String(slice.totals.duplicate),
        String(slice.totals.unresolved),
      ]),
    ),
    `- inventory kind set (${pack.inventoryKindSet.length} kinds) matches predecessor: ${pack.predecessorKindSet.join(',') === pack.inventoryKindSet.join(',') ? 'yes' : 'NO'}`,
    '',
    '## Aggregate observations',
    '',
    `- owner residue: total=${pack.ownerResidueTotals.total} observation=${pack.ownerResidueTotals.observation} ambiguous=${pack.ownerResidueTotals.ambiguous} unresolved=${pack.ownerResidueTotals.unresolved}`,
    `- hotspots: ranked=${pack.hotspotTotals.ranked}/${pack.hotspotTotals.limit} unresolvedMetrics=${pack.hotspotTotals.unresolvedMetrics}`,
    `- payload classes: duplicateBlobs=${pack.payloadClassTotals.duplicateBlobCount} unresolved=${pack.payloadClassTotals.unresolvedCount}`,
    `- frozen receipts: ${pack.frozenReceiptIds.length === 0 ? 'none' : pack.frozenReceiptIds.join(', ')}`,
    '',
    '## Artifact index',
    '',
    table(
      ['locator', 'media type', 'bytes', 'sha256'],
      pack.artifacts.map((artifact) => [
        artifact.logicalLocator,
        artifact.mediaType,
        String(artifact.byteCount),
        artifact.sha256,
      ]),
    ),
    '',
    '## Read-only handoff contract',
    '',
    table(
      ['consumer', 'required identity', 'required digest', 'locators', 'fail-closed rule'],
      pack.handoff.map((entry) => [
        entry.consumer,
        entry.requiredIdentity,
        'baseline.json:packageDigest',
        entry.locators.join('; '),
        entry.failClosedRule,
      ]),
    ),
    '',
    '## Non-adjudication',
    '',
    '- Owner residue, payload classes, and test redness are observations only.',
    '- This capture does not update `REQUIRED_BASELINE`, fitness budgets, test qualification, CI/runtime gates, or any active baseline pointer.',
    '- Detail artifacts are reproducible local/CI artifacts addressed by the locators above; a missing or digest-mismatched locator fails closed.',
    '',
  ].join('\n');
}

function projectOwnerResidue(pack: PostConvergenceEnvelope, records: readonly OwnerResidueRecord[]): string {
  return [
    '# Owner residue',
    '',
    'Ambiguity is retained. Owner adjudication belongs to B; this projection selects no owner and migrates no caller.',
    'Directory placement, file size, an archived proposal, or a closed Issue is never consumer or deletion proof.',
    'Per-consumer evidence, deletion conditions, and trust boundaries are preserved verbatim in the',
    '`owner-residue.ndjson` detail artifact indexed by `baseline.json`.',
    '',
    ...identityHeader(pack),
    table(
      ['id', 'source', 'identity', 'state', 'consumer class', 'consumers', 'deletion condition', 'candidate owners'],
      records.map((row) => [
        row.id,
        row.source,
        row.identity,
        row.state,
        row.consumerClass,
        row.consumers.map((consumer) => `${consumer.path}(${consumer.kind}/${consumer.relationship})`).slice(0, 5).join('; ')
          + (row.consumers.length > 5 ? ` (+${row.consumers.length - 5} more)` : '')
          || '_none_',
        row.deletionCondition,
        row.candidateTargetOwners.join('; ') || '_none_',
      ]),
    ),
    '',
  ].join('\n');
}

function projectHotspots(pack: PostConvergenceEnvelope, hotspots: HotspotResult): string {
  return [
    '# Top hotspot observation vector',
    '',
    'File size, centrality, change frequency, and trust density are prioritization evidence only.',
    'They are not defects and do not create or update a fitness budget.',
    '',
    ...identityHeader(pack),
    `- metric scope: ${HOTSPOT_METRIC_SCOPE.join(' | ')}`,
    `- rank tuple: ${HOTSPOT_RANK_TUPLE.join(' | ')}`,
    '',
    table(
      ['rank', 'identity', 'bytes', 'fanIn', 'fanOut', 'changeFreq', 'functions', 'branches', 'breadth', 'tests', 'trust', 'changeCenter'],
      hotspots.entries.map((entry) => [
        String(entry.rank),
        entry.identity,
        String(entry.metrics.sourceBytes),
        String(entry.metrics.fanIn),
        String(entry.metrics.fanOut),
        String(entry.metrics.changeFrequency),
        String(entry.metrics.functionCount),
        String(entry.metrics.branchCount),
        String(entry.metrics.importBreadth),
        String(entry.metrics.testDensity),
        String(entry.metrics.trustDensity),
        String(entry.changeCenter),
      ]),
    ),
    '',
    '## Unresolved metric inputs',
    '',
    hotspots.unresolvedMetrics.length === 0
      ? '_None._'
      : hotspots.unresolvedMetrics.map((path) => `- ${path} (content unavailable; metrics unresolved, not zero)`).join('\n'),
    '',
  ].join('\n');
}

function projectPayloadClasses(pack: PostConvergenceEnvelope, payload: PayloadClassResult): string {
  return [
    '# Payload class observations',
    '',
    'Payload classes observe tracked bytes and blob identities only — every tracked blob is classified exactly once',
    '(unique runtime/archive/authoring payloads included), with duplicate blobs counted per class. Authority,',
    'materialization, retention, and deletion decisions belong to C and the existing data-governance owners;',
    'nothing here authorizes deletion.',
    '',
    ...identityHeader(pack),
    `- duplicate blobs: ${payload.duplicateBlobCount}`,
    `- unresolved classes: ${payload.unresolvedCount}`,
    '',
    table(
      ['class', 'blobs', 'duplicates', 'paths', 'bytes'],
      payload.classes.map((entry) => [
        entry.className,
        String(entry.blobCount),
        String(entry.duplicateBlobCount),
        String(entry.pathCount),
        String(entry.byteTotal),
      ]),
    ),
    '',
  ].join('\n');
}

function projectTestBaseline(pack: PostConvergenceEnvelope, receipts: readonly MeasurementReceipt[]): string {
  return [
    '# Test baseline observations',
    '',
    'Each observation references an immutable measurement receipt. A red command remains an observation:',
    'A does not label it stale, accepted, quarantined, or implementation debt, and does not change test-command qualification.',
    '',
    ...identityHeader(pack),
    receipts.length === 0
      ? '_No receipts captured for this run._'
      : table(
        ['receiptId', 'command', 'scope', 'exit', 'aggregate'],
        receipts.map((receipt) => [
          receipt.receiptId,
          receipt.command,
          receipt.scope,
          String(receipt.exitStatus),
          Object.entries(receipt.aggregate).map(([key, value]) => `${key}=${value}`).join('; '),
        ]),
      ),
    '',
    '## Limitations',
    '',
    '- Receipts are environment-sensitive: platform, cache mode, and captured time are recorded per receipt.',
    '- Re-running a measurement creates a new receipt identity; re-projection from the same frozen receipt set is byte-identical.',
    '- Bounded fingerprints and aggregates are committed here; the full receipt JSON artifacts are local/CI-only per the design compact-package boundary and cannot be byte-regenerated from a different environment. A reader without the local detail directory fails closed by contract.',
    '- Source-derived detail artifacts (full-inventory, denominator-slices, owner-residue, census-core) are byte-reproducible from the recorded source commit with the committed generator; digest mismatch still fails closed.',
    '',
  ].join('\n');
}

export function generatePostConvergenceSuccessor(input: PostConvergenceInput): {
  pack: PostConvergenceEnvelope;
  files: PostConvergenceFiles;
  detail: readonly PostConvergenceDetailArtifact[];
  failures: QualificationFailure[];
} {
  const failures: QualificationFailure[] = [];
  const generated = input.census ?? generateCensusCore(input.snapshot);
  failures.push(...generated.failures);

  const kindSetJoined = [...INVENTORY_KINDS].sort().join(',');
  const predecessorKindsJoined = [...input.predecessors.predecessorKindSet].sort().join(',');
  if (kindSetJoined !== predecessorKindsJoined) {
    failures.push({ code: 'kind-set-mismatch', identity: predecessorKindsJoined });
  }
  if (generated.core.manifests.map((manifest) => manifest.kind).sort().join(',') !== kindSetJoined) {
    failures.push({ code: 'successor-kind-set-diverged', identity: POST_CONVERGENCE_SCHEMA_VERSION });
  }

  for (const receipt of input.receipts) {
    if (receipt.schemaVersion !== 'act-architecture-measurement-receipt/v1') {
      failures.push({ code: 'receipt-schema-mismatch', identity: receipt.receiptId });
    }
    if (receipt.sourceCommit !== input.snapshot.identity.sourceCommit) {
      failures.push({ code: 'receipt-identity-mismatch', identity: receipt.receiptId });
    }
  }
  for (const file of input.snapshot.files) {
    if (!input.blobIndex.has(file.path)) {
      failures.push({ code: 'missing-blob-identity', identity: file.path });
    }
  }

  const layers = buildMaterialLayers(input.snapshot, input.blobIndex, generated.core);
  if (layers.reconciliation.unassignedCount !== 0
    || layers.reconciliation.layerAssignedCount !== layers.reconciliation.trackedFileCount) {
    failures.push({ code: 'layer-reconciliation', identity: String(layers.reconciliation.unassignedCount) });
  }
  for (const manifest of layers.manifests) {
    if (manifest.totals.unresolved !== 0 || manifest.totals.duplicate !== 0) {
      failures.push({ code: 'layer-denominator-mismatch', identity: manifest.layer });
    }
  }

  const slices = buildDerivedSlices(input.snapshot, generated.core);
  failures.push(...slices.failures);
  for (const manifest of slices.manifests) {
    if (manifest.totals.unresolved !== 0) {
      failures.push({ code: 'slice-denominator-mismatch', identity: manifest.slice });
    }
  }

  const payload = buildPayloadClasses(input.snapshot, input.blobIndex);
  const hotspots = buildHotspots(input.snapshot, generated.core, input.changeCounts);
  const residue = buildOwnerResidue(input.predecessors, generated.core, input.snapshot);
  const residueTotals = {
    total: residue.length,
    observation: residue.filter((row) => row.state === 'observation').length,
    ambiguous: residue.filter((row) => row.state === 'ambiguous').length,
    unresolved: residue.filter((row) => row.state === 'unresolved').length,
  };

  const successorCoreSha256 = sha256Text(serializeDeterministic(generated.core));
  const successorCaptureId = sha256Text(serializeDeterministic({
    schemaVersion: POST_CONVERGENCE_SCHEMA_VERSION,
    sourceCommit: input.snapshot.identity.sourceCommit,
    sourceTree: input.snapshot.identity.sourceTree,
    originIntegrationCommit: input.originIntegrationCommit,
    predecessorBaselineSha256: input.predecessors.baseline.censusCoreSha256,
    predecessorDeltaSha256: input.predecessors.currentHead.packageSha256,
    successorCoreSha256,
    commandScope: POST_CONVERGENCE_COMMAND_SCOPE,
    inventoryKindSet: [...INVENTORY_KINDS].sort(),
  }));
  const detailBase = `${POST_CONVERGENCE_DETAIL_DIR}/${successorCaptureId}`;


  const detail: PostConvergenceDetailArtifact[] = [
    {
      name: 'full-inventory.ndjson',
      logicalLocator: `${detailBase}/full-inventory.ndjson`,
      mediaType: 'application/x-ndjson',
      content: ndlines(layers.inventory),
    },
    {
      name: 'denominator-slices.ndjson',
      logicalLocator: `${detailBase}/denominator-slices.ndjson`,
      mediaType: 'application/x-ndjson',
      content: ndlines(slices.records),
    },
    {
      name: 'owner-residue.ndjson',
      logicalLocator: `${detailBase}/owner-residue.ndjson`,
      mediaType: 'application/x-ndjson',
      content: ndlines(residue),
    },
    {
      name: 'census-core.json',
      logicalLocator: `${detailBase}/census-core.json`,
      mediaType: 'application/json',
      content: serializeDeterministic(generated.core),
    },
    ...input.receipts.map((receipt) => ({
      name: `receipts/${receipt.receiptId}.json`,
      logicalLocator: `${detailBase}/receipts/${receipt.receiptId}.json`,
      mediaType: 'application/json',
      content: `${JSON.stringify(receipt, null, 2)}\n`,
    })),
  ];

  const statusEvidence: PostConvergenceEnvelope['statusEvidence'] = [
    {
      stage: 'captured',
      evidence: `source:${input.snapshot.identity.sourceCommit};core:${successorCoreSha256.slice(0, 12)};receipts:${input.receipts.length}`,
    },
    {
      stage: 'digest-verified',
      evidence: `artifacts:${detail.length + 4};digest-scope:${SUCCESSOR_DIGEST_SCOPE}`,
    },
    {
      stage: 'qualified-for-investigation',
      evidence: 'identity+predecessor-continuity+kind-set+layer-and-slice-denominators+privacy+digest-scope:verified-pre-write',
    },
  ];

  const envelopeCore = {
    schemaVersion: POST_CONVERGENCE_SCHEMA_VERSION,
    successorCaptureId,
    status: 'qualified-for-investigation' as const,
    statusEvidence,
    captureIdentity: input.snapshot.identity,
    originIntegrationCommit: input.originIntegrationCommit,
    commandScope: POST_CONVERGENCE_COMMAND_SCOPE,
    toolVersions: {
      nodeVersion: input.snapshot.identity.nodeVersion,
      npmVersion: input.snapshot.identity.npmVersion,
      typescriptVersion: input.snapshot.identity.typescriptVersion,
    },
    schemaVersions: {
      censusCore: generated.core.schemaVersion,
      measurementReceipt: 'act-architecture-measurement-receipt/v1',
      currentHeadDelta: input.predecessors.currentHead.schemaVersion,
    },
    predecessorBaseline: input.predecessors.baseline,
    predecessorCurrentHead: input.predecessors.currentHead,
    successorCoreSha256,
    inventoryKindSet: [...INVENTORY_KINDS].sort(),
    predecessorKindSet: [...input.predecessors.predecessorKindSet].sort(),
    materialLayers: layers.manifests,
    layerReconciliation: layers.reconciliation,
    denominatorSlices: slices.manifests,
    ownerResidueTotals: residueTotals,
    hotspotTotals: {
      limit: HOTSPOT_LIMIT,
      ranked: hotspots.entries.length,
      unresolvedMetrics: hotspots.unresolvedMetrics.length,
    },
    payloadClassTotals: payload,
    frozenReceiptIds: input.receipts.map((receipt) => receipt.receiptId).sort(),
    digestScope: SUCCESSOR_DIGEST_SCOPE,
  };

  const projectionView = {
    ...envelopeCore,
    handoff: [],
    artifacts: [],
    packageDigest: '',
  } as PostConvergenceEnvelope;
  const ownerResidueMd = projectOwnerResidue(projectionView, residue);
  const hotspotsMd = projectHotspots(projectionView, hotspots);
  const payloadMd = projectPayloadClasses(projectionView, payload);
  const testBaselineMd = projectTestBaseline(projectionView, input.receipts);


  const handoff: PostConvergenceEnvelope['handoff'] = [
    {
      consumer: 'B-owner-residue',
      requiredIdentity: successorCaptureId,
      locators: ['owner-residue.md', `${detailBase}/owner-residue.ndjson`],
      failClosedRule: 'require exact successorCaptureId+packageDigest from this envelope; reject missing/stale/mixed/drifted inputs; A adjudicates nothing',
    },
    {
      consumer: 'C-payload-classes',
      requiredIdentity: successorCaptureId,
      locators: ['payload-classes.md', `${detailBase}/full-inventory.ndjson`],
      failClosedRule: 'require exact successorCaptureId+packageDigest from this envelope; authority/materialization/retention decisions stay with C',
    },
    {
      consumer: 'D-test-baseline',
      requiredIdentity: successorCaptureId,
      locators: ['test-baseline.md', ...input.receipts.map((receipt) => `${detailBase}/receipts/${receipt.receiptId}.json`)],
      failClosedRule: 'require exact successorCaptureId+packageDigest from this envelope; red commands stay observations; test qualification unchanged',
    },
    {
      consumer: 'N5-activation',
      requiredIdentity: successorCaptureId,
      locators: ['baseline.json'],
      failClosedRule: 'only N5 may recapture/prove equivalence and atomically activate baseline+charter+fitness+test qualification; HEAD drift requires N5 recapture',
    },
  ];

  const indexedArtifacts = [
    artifactEntry('owner-residue.md', 'text/markdown', ownerResidueMd),
    artifactEntry('hotspots.md', 'text/markdown', hotspotsMd),
    artifactEntry('payload-classes.md', 'text/markdown', payloadMd),
    artifactEntry('test-baseline.md', 'text/markdown', testBaselineMd),
    ...detail.map((artifact) => artifactEntry(artifact.logicalLocator, artifact.mediaType, artifact.content)),
  ];
  const summaryMd = projectSummary({
    ...envelopeCore,
    packageDigest: '',
    handoff,
    artifacts: indexedArtifacts,
  } as PostConvergenceEnvelope);
  const artifacts: PostConvergenceEnvelope['artifacts'] = [
    artifactEntry('summary.md', 'text/markdown', summaryMd),
    ...indexedArtifacts,
  ];
  const packageDigest = successorPackageDigest({
    ...envelopeCore,
    handoff,
    artifacts,
    packageDigest: '',
  } as PostConvergenceEnvelope);

  const pack: PostConvergenceEnvelope = {
    ...envelopeCore,
    handoff,
    artifacts,
    packageDigest,
  };
  const files: PostConvergenceFiles = {
    'summary.md': summaryMd,
    'baseline.json': serializeDeterministic(pack),
    'owner-residue.md': ownerResidueMd,
    'hotspots.md': hotspotsMd,
    'payload-classes.md': payloadMd,
    'test-baseline.md': testBaselineMd,
  };

  for (const [name, content] of Object.entries(files)) {
    const violation = privacyViolation(content);
    if (violation) failures.push({ code: violation, identity: `post-convergence/${name}` });
  }
  for (const artifact of detail) {
    const violation = privacyViolation(artifact.content);
    if (violation) failures.push({ code: violation, identity: artifact.logicalLocator });
  }
  if (successorPackageDigest(pack) !== pack.packageDigest) {
    failures.push({ code: 'package-digest-mismatch', identity: successorCaptureId });
  }
  const seenRecordIds = new Set<string>();
  for (const record of [...slices.records.map((row) => row.id), ...residue.map((row) => row.id)]) {
    if (seenRecordIds.has(record)) failures.push({ code: 'duplicate-id', identity: record });
    seenRecordIds.add(record);
  }

  return { pack, files, detail, failures };
}

export function qualifyPostConvergence(pack: PostConvergenceEnvelope, failures: readonly QualificationFailure[]): void {
  if (pack.schemaVersion !== POST_CONVERGENCE_SCHEMA_VERSION) {
    throw new Error('unsupported-schema-version');
  }
  if (!POST_CONVERGENCE_STATUSES.includes(pack.status)) {
    throw new Error(`unsupported-status:${pack.status}`);
  }
  if (successorPackageDigest(pack) !== pack.packageDigest) {
    throw new Error(`package-digest-mismatch:${pack.successorCaptureId}`);
  }
  if (failures.length > 0) {
    const extra = failures.length > 1 ? ` (+${failures.length - 1} more)` : '';
    throw new Error(`${failures[0]!.code}:${failures[0]!.identity}${extra}`);
  }
}

export function verifySuccessorArtifacts(
  pack: PostConvergenceEnvelope,
  readContent: (logicalLocator: string) => string,
): readonly QualificationFailure[] {
  const failures: QualificationFailure[] = [];
  for (const artifact of pack.artifacts) {
    let content: string;
    try {
      content = readContent(artifact.logicalLocator);
    } catch {
      failures.push({ code: 'artifact-locator-missing', identity: artifact.logicalLocator });
      continue;
    }
    if (sha256Text(content) !== artifact.sha256) {
      failures.push({ code: 'artifact-digest-mismatch', identity: artifact.logicalLocator });
    }
    if (Buffer.byteLength(content, 'utf8') !== artifact.byteCount) {
      failures.push({ code: 'artifact-byte-count-mismatch', identity: artifact.logicalLocator });
    }
  }
  return failures;
}

