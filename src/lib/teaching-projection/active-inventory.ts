/**
 * Active published/used course resource inventory (#1268).
 *
 * Denominator is the interactive lesson identity registry + reachable runtime
 * lesson / handout / interactive-manifest / graph-overlay surfaces.
 * Historical or unreachable lessons stay out of the projection gate.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  INTERACTIVE_LESSON_IDENTITY_REGISTRY,
  type InteractiveLessonIdentityRecord,
} from '@/lib/interactive-lesson-identity';

import { deriveResourceId } from './identity';
import { projectionDigest } from './hash';
import type { TeachingProjectionMode, TeachingResourceType } from './contracts';
import {
  ACTIVE_COURSE_INVENTORY_CONTRACT,
  type ActiveCourseInventory,
  type ActiveCourseInventoryResource,
  type ActiveCoursePackageInventory,
  type ManifestKnowledgeField,
  type TeachingKnowledgeRefAuthoring,
} from './migration-contracts';

export interface InventoryBuildOptions {
  repoRoot: string;
  authoringRevision: string;
  capturedAt?: string | null;
  /** Override packages (tests). Defaults to interactive lesson identity registry. */
  packages?: readonly InventoryPackageSpec[];
  /** When true, skip packages whose runtime lesson dir is missing. Default true. */
  skipMissingRuntime?: boolean;
}

export interface InventoryPackageSpec {
  packageId: string;
  scopeId?: string;
  routeSegment?: string | null;
  runtimeLessonDir: string;
  lessonKey: string;
  title?: string | null;
  /** Default projection modes. */
  defaultLessonMode?: TeachingProjectionMode;
  defaultHandoutMode?: TeachingProjectionMode;
  defaultStepMode?: TeachingProjectionMode;
}

function sha256Buffer(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

function readJsonIfExists(path: string): unknown | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function packageScopeId(packageId: string): string {
  return `course-package:${packageId}`;
}

function relPath(repoRoot: string, absPath: string): string {
  return relative(repoRoot, absPath).split('\\').join('/');
}

function fileDigest(absPath: string): string {
  if (!existsSync(absPath)) return sha256Buffer('');
  return sha256Buffer(readFileSync(absPath));
}

function buildResourceId(input: {
  resourceType: TeachingResourceType;
  lessonKey: string;
  stepId?: string;
}): string {
  return deriveResourceId({
    resourceType: input.resourceType,
    lessonKey: input.lessonKey,
    stepId: input.stepId,
    projectionMode: 'OPTIONAL',
    scopeId: 'inventory',
  });
}

function packagesFromRegistry(): InventoryPackageSpec[] {
  return INTERACTIVE_LESSON_IDENTITY_REGISTRY.map((record: InteractiveLessonIdentityRecord) => ({
    packageId: record.canonicalId,
    scopeId: packageScopeId(record.canonicalId),
    routeSegment: record.routeSegments[0] ?? null,
    runtimeLessonDir: record.runtimeLessonDir,
    lessonKey: record.runtimeLessonDir,
    title: record.planTitleAliases[0] ?? record.canonicalId,
  }));
}

function extractStepIds(manifest: unknown): Array<{ stepId: string; title: string | null }> {
  const root = asRecord(manifest);
  const steps = root.steps;
  if (!steps) return [];

  if (Array.isArray(steps)) {
    return steps
      .map((step, index) => {
        const rec = asRecord(step);
        const stepId = typeof rec.id === 'string'
          ? rec.id
          : typeof rec.step_id === 'string'
            ? rec.step_id
            : typeof rec.stepId === 'string'
              ? rec.stepId
              : `step-${String(index + 1).padStart(2, '0')}`;
        const title = typeof rec.title === 'string' ? rec.title : null;
        return { stepId, title };
      })
      .filter((s) => s.stepId.length > 0);
  }

  if (typeof steps === 'object') {
    return Object.entries(steps as Record<string, unknown>).map(([stepId, step]) => {
      const rec = asRecord(step);
      const title = typeof rec.title === 'string' ? rec.title : null;
      return { stepId, title };
    });
  }

  return [];
}

function extractLegacyAndLabels(lessonJson: unknown, overlay: unknown): {
  focusNodeIds: string[];
  labelsById: Map<string, string>;
  cardIds: string[];
  stepNodeMap: Map<string, string[]>;
} {
  const lesson = asRecord(lessonJson);
  const graph = asRecord(overlay);
  const focusNodeIds = [
    ...asStringArray(lesson.focus_node_ids),
    ...asStringArray(graph.focus_node_ids),
    ...asStringArray(lesson.entry_nodes),
    ...asStringArray(lesson.summary_nodes),
    ...asStringArray(graph.entry_nodes),
    ...asStringArray(graph.summary_nodes),
  ];

  const labelsById = new Map<string, string>();
  const cardIds: string[] = [];
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  for (const node of nodes) {
    const rec = asRecord(node);
    const id = typeof rec.id === 'string' ? rec.id : null;
    const name = typeof rec.name === 'string' ? rec.name : null;
    if (id && name) labelsById.set(id, name);
    if (id) cardIds.push(id);
  }

  // sequence groups: step_ids ↔ node_ids
  const stepNodeMap = new Map<string, string[]>();
  const sequence = asRecord(lesson.sequence);
  const groups = Array.isArray(sequence.groups) ? sequence.groups : [];
  for (const group of groups) {
    const g = asRecord(group);
    const stepIds = asStringArray(g.step_ids);
    const nodeIds = asStringArray(g.node_ids);
    for (const stepId of stepIds) {
      const existing = stepNodeMap.get(stepId) ?? [];
      stepNodeMap.set(stepId, [...new Set([...existing, ...nodeIds])]);
    }
    for (const nodeId of nodeIds) {
      if (!focusNodeIds.includes(nodeId)) focusNodeIds.push(nodeId);
    }
  }

  // card_order
  for (const id of asStringArray(lesson.card_order)) {
    if (!focusNodeIds.includes(id)) focusNodeIds.push(id);
    cardIds.push(id);
  }
  for (const id of asStringArray(graph.card_order)) {
    cardIds.push(id);
  }

  return {
    focusNodeIds: [...new Set(focusNodeIds)],
    labelsById,
    cardIds: [...new Set(cardIds)],
    stepNodeMap,
  };
}

function buildManifestKnowledge(input: {
  legacyIds: string[];
  labels: string[];
  knowledgeRefs: TeachingKnowledgeRefAuthoring[];
  sourcePath: string;
}): ManifestKnowledgeField | null {
  if (
    input.legacyIds.length === 0
    && input.labels.length === 0
    && input.knowledgeRefs.length === 0
  ) {
    return null;
  }
  return {
    legacyIds: input.legacyIds,
    labels: input.labels,
    canonicalIds: input.knowledgeRefs.map((r) => r.canonicalId),
    roles: input.knowledgeRefs.map((r) => r.role),
    sourcePath: input.sourcePath,
  };
}

function inventoryResource(input: {
  resourceType: TeachingResourceType;
  lessonKey: string;
  stepId?: string;
  scopeId: string;
  packageId: string;
  projectionMode: TeachingProjectionMode;
  title: string | null;
  sourcePath: string;
  sourceDigest: string;
  legacyIds: string[];
  labels: string[];
  cardIds: string[];
  knowledgeRefs?: TeachingKnowledgeRefAuthoring[];
}): ActiveCourseInventoryResource {
  const resourceId = buildResourceId({
    resourceType: input.resourceType,
    lessonKey: input.lessonKey,
    stepId: input.stepId,
  });
  const knowledgeRefs = input.knowledgeRefs ?? [];
  return {
    resourceId,
    resourceType: input.resourceType,
    lessonKey: input.lessonKey,
    stepId: input.stepId,
    scopeId: input.scopeId,
    packageId: input.packageId,
    projectionMode: input.projectionMode,
    title: input.title,
    sourcePath: input.sourcePath,
    sourceDigest: input.sourceDigest,
    legacyIds: [...new Set(input.legacyIds)].sort(),
    labels: [...new Set(input.labels)].sort(),
    cardIds: [...new Set(input.cardIds)].sort(),
    knowledgeRefs,
    manifestKnowledge: buildManifestKnowledge({
      legacyIds: input.legacyIds,
      labels: input.labels,
      knowledgeRefs,
      sourcePath: input.sourcePath,
    }),
  };
}

function inventPackage(
  repoRoot: string,
  spec: InventoryPackageSpec,
): ActiveCoursePackageInventory | null {
  const runtimeDir = join(repoRoot, 'course-content/runtime/lessons', spec.runtimeLessonDir);
  if (!existsSync(runtimeDir) || !statSync(runtimeDir).isDirectory()) {
    return null;
  }

  const scopeId = spec.scopeId ?? packageScopeId(spec.packageId);
  const lessonKey = spec.lessonKey || spec.runtimeLessonDir;
  const lessonPath = join(runtimeDir, 'lesson.json');
  const manifestPath = join(runtimeDir, 'interactive-manifest.json');
  const overlayPath = join(runtimeDir, 'graph-overlay.json');

  const lessonJson = readJsonIfExists(lessonPath);
  const manifestJson = readJsonIfExists(manifestPath);
  const overlayJson = readJsonIfExists(overlayPath);

  const lessonRec = asRecord(lessonJson);
  const title =
    spec.title
    ?? (typeof lessonRec.title === 'string' ? lessonRec.title : null);

  const extracted = extractLegacyAndLabels(lessonJson, overlayJson);
  const sourcePaths: string[] = [];
  const resources: ActiveCourseInventoryResource[] = [];

  // Lesson resource
  if (existsSync(lessonPath)) {
    const sourcePath = relPath(repoRoot, lessonPath);
    sourcePaths.push(sourcePath);
    resources.push(
      inventoryResource({
        resourceType: 'lesson',
        lessonKey,
        scopeId,
        packageId: spec.packageId,
        projectionMode: spec.defaultLessonMode ?? 'OPTIONAL',
        title,
        sourcePath,
        sourceDigest: fileDigest(lessonPath),
        legacyIds: extracted.focusNodeIds,
        labels: extracted.focusNodeIds
          .map((id) => extracted.labelsById.get(id))
          .filter((v): v is string => typeof v === 'string'),
        cardIds: extracted.cardIds,
      }),
    );
  }

  // Handout — non-semantic by default unless author opts in later.
  const handoutCandidates = readdirSync(runtimeDir).filter(
    (name) => name.endsWith('-handout.md') || name === 'handout.md',
  );
  for (const name of handoutCandidates.sort()) {
    const abs = join(runtimeDir, name);
    const sourcePath = relPath(repoRoot, abs);
    sourcePaths.push(sourcePath);
    resources.push(
      inventoryResource({
        resourceType: 'handout',
        lessonKey,
        scopeId,
        packageId: spec.packageId,
        projectionMode: spec.defaultHandoutMode ?? 'NONE',
        title: name,
        sourcePath,
        sourceDigest: fileDigest(abs),
        legacyIds: [],
        labels: [],
        cardIds: [],
      }),
    );
  }

  // Interactive steps
  if (existsSync(manifestPath)) {
    const sourcePath = relPath(repoRoot, manifestPath);
    sourcePaths.push(sourcePath);
    const digest = fileDigest(manifestPath);
    const steps = extractStepIds(manifestJson);
    const stepMode = spec.defaultStepMode ?? 'REQUIRED';

    for (const step of steps) {
      const legacyIds = extracted.stepNodeMap.get(step.stepId) ?? [];
      // Steps without sequence mapping still inherit empty legacy set; author may bind later.
      const labels = legacyIds
        .map((id) => extracted.labelsById.get(id))
        .filter((v): v is string => typeof v === 'string');
      resources.push(
        inventoryResource({
          resourceType: 'step',
          lessonKey,
          stepId: step.stepId,
          scopeId,
          packageId: spec.packageId,
          projectionMode: stepMode,
          title: step.title,
          sourcePath: `${sourcePath}#${step.stepId}`,
          sourceDigest: sha256Buffer(`${digest}:${step.stepId}`),
          legacyIds,
          labels,
          cardIds: legacyIds,
        }),
      );
    }
  }

  // Graph overlay as classroom resource evidence on the lesson already covered.
  if (existsSync(overlayPath)) {
    sourcePaths.push(relPath(repoRoot, overlayPath));
  }

  resources.sort((a, b) => (a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0));

  return {
    packageId: spec.packageId,
    scopeId,
    routeSegment: spec.routeSegment ?? null,
    runtimeLessonDir: spec.runtimeLessonDir,
    lessonKey,
    title,
    sourcePaths: [...new Set(sourcePaths)].sort(),
    resources,
  };
}

/**
 * Enumerate currently published/used interactive course packages and their
 * reachable runtime resources with source digests.
 */
export function buildActiveCourseInventory(
  options: InventoryBuildOptions,
): ActiveCourseInventory {
  const skipMissing = options.skipMissingRuntime !== false;
  const specs = options.packages ?? packagesFromRegistry();
  const packages: ActiveCoursePackageInventory[] = [];

  for (const spec of specs) {
    const pkg = inventPackage(options.repoRoot, spec);
    if (!pkg) {
      if (skipMissing) continue;
      throw new Error(
        `active course package runtime missing: ${spec.runtimeLessonDir}`,
      );
    }
    packages.push(pkg);
  }

  packages.sort((a, b) =>
    a.packageId < b.packageId ? -1 : a.packageId > b.packageId ? 1 : 0,
  );

  const resourceCount = packages.reduce((n, p) => n + p.resources.length, 0);
  const inventoryDigest = projectionDigest({
    contract: ACTIVE_COURSE_INVENTORY_CONTRACT,
    authoringRevision: options.authoringRevision,
    packages: packages.map((p) => ({
      packageId: p.packageId,
      scopeId: p.scopeId,
      resources: p.resources.map((r) => ({
        resourceId: r.resourceId,
        sourceDigest: r.sourceDigest,
        projectionMode: r.projectionMode,
        legacyIds: r.legacyIds,
      })),
    })),
  });

  return {
    contract: ACTIVE_COURSE_INVENTORY_CONTRACT,
    authoringRevision: options.authoringRevision,
    capturedAt: options.capturedAt ?? null,
    packageCount: packages.length,
    resourceCount,
    packages,
    inventoryDigest,
  };
}

/** Historical / unreachable package stays out of active inventory. */
export function isPackageInActiveInventory(
  inventory: ActiveCourseInventory,
  packageId: string,
): boolean {
  return inventory.packages.some((p) => p.packageId === packageId);
}
