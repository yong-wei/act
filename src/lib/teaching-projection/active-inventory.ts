/**
 * Active published/used course resource inventory (#1268).
 *
 * Denominator is the interactive lesson identity registry + reachable runtime
 * lesson / handout / interactive-manifest / graph-overlay surfaces.
 * Historical or unreachable lessons stay out of the projection gate.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  INTERACTIVE_LESSON_IDENTITY_REGISTRY,
  type InteractiveLessonIdentityRecord,
} from '@/lib/interactive-lesson-identity';

import {
  TEACHING_PROJECTION_MODES,
  TEACHING_PROJECTION_ROLES,
  type TeachingProjectionMode,
  type TeachingProjectionRole,
  type TeachingResourceType,
} from './contracts';
import { deriveResourceId } from './identity';
import { projectionDigest } from './hash';
import {
  ACTIVE_COURSE_INVENTORY_CONTRACT,
  type ActiveCourseInventory,
  type ActiveCourseInventoryResource,
  type ActiveCoursePackageInventory,
  type ManifestKnowledgeField,
  type TeachingKnowledgeRefAuthoring,
} from './migration-contracts';

const GIT_COMMIT = /^[a-f0-9]{40}$/u;

export class ActiveCourseInventoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ActiveCourseInventoryError';
    this.code = code;
  }
}

/** Registry module that determines the active-course inventory denominator. */
export const ACTIVE_INVENTORY_IDENTITY_REGISTRY_PATH =
  'src/lib/interactive-lesson-identity.ts';

export interface InventoryBuildOptions {
  repoRoot: string;
  authoringRevision: string;
  capturedAt?: string | null;
  /** Override packages (tests). Defaults to interactive lesson identity registry. */
  packages?: readonly InventoryPackageSpec[];
  /**
   * When true, skip packages whose runtime lesson dir is missing.
   * Only honored when `allowWorkingTreeBytes` is true (synthetic fixture builds).
   * Revision-bound builds always fail closed on missing declared runtime paths so
   * incomplete inventory cannot bind `authoringRevision` (e.g. deleted lesson dir
   * still listed by the identity registry). Default: true only for fixture builds.
   */
  skipMissingRuntime?: boolean;
  /**
   * When true, skip git revision ↔ inventory-byte binding.
   * Only for synthetic fixture / temp-dir unit tests. Production callers must leave this false.
   */
  allowWorkingTreeBytes?: boolean;
  /**
   * When true, include the interactive-lesson-identity registry and its
   * identity-determining deps in clean-tree + git-show digest checks.
   * Defaults to true when `packages` is omitted (registry-driven denominator),
   * so a dirty registry cannot silently drop courses while remaining package
   * content still matches authoringRevision. Explicit package lists (tests)
   * default to false unless this is set.
   */
  includeIdentityDenominator?: boolean;
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

interface ExtractedStep {
  stepId: string;
  title: string | null;
  projectionMode: TeachingProjectionMode | null;
  knowledgeRefs: TeachingKnowledgeRefAuthoring[];
}

function sha256Buffer(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Read JSON when the file is optional. Missing → null.
 * Existing but unreadable / invalid JSON → fail closed (never silent null).
 */
function readOptionalJson(path: string, label: string): unknown | null {
  if (!existsSync(path)) return null;
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    throw new ActiveCourseInventoryError(
      'json-read-failed',
      `active course inventory rejected: cannot read ${label} at ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new ActiveCourseInventoryError(
      'json-parse-failed',
      `active course inventory rejected: invalid JSON for ${label} at ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
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

function sourcePathWithoutFragment(sourcePath: string): string {
  const hash = sourcePath.indexOf('#');
  return hash >= 0 ? sourcePath.slice(0, hash) : sourcePath;
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

/**
 * Paths that determine which packages enter the inventory denominator when
 * reading from INTERACTIVE_LESSON_IDENTITY_REGISTRY.
 *
 * Includes the registry itself plus its direct `@/lib/*` imports (unit/cruise
 * course modules). Dirty or revision-mismatched identity sources fail closed
 * so a worktree edit cannot drop courses while still binding authoringRevision.
 */
export function resolveIdentityDenominatorPaths(repoRoot: string): string[] {
  const paths = new Set<string>([ACTIVE_INVENTORY_IDENTITY_REGISTRY_PATH]);
  const registryAbs = join(repoRoot, ACTIVE_INVENTORY_IDENTITY_REGISTRY_PATH);
  if (!existsSync(registryAbs)) {
    return [...paths].sort();
  }

  const source = readFileSync(registryAbs, 'utf8');
  const importRe = /from\s+['"]@\/lib\/([^'"]+)['"]/g;
  for (const match of source.matchAll(importRe)) {
    const mod = match[1];
    if (!mod || mod.includes('..') || mod.startsWith('/')) continue;
    const tsRel = `src/lib/${mod}.ts`;
    const tsxRel = `src/lib/${mod}.tsx`;
    if (existsSync(join(repoRoot, tsRel))) {
      paths.add(tsRel);
    } else if (existsSync(join(repoRoot, tsxRel))) {
      paths.add(tsxRel);
    } else {
      // Still bind the conventional .ts path so missing/dirty identity deps fail closed.
      paths.add(tsRel);
    }
  }

  return [...paths].sort();
}

function parseProjectionMode(
  value: unknown,
  label: string,
): TeachingProjectionMode | null {
  if (value == null) return null;
  if (
    typeof value === 'string'
    && (TEACHING_PROJECTION_MODES as readonly string[]).includes(value)
  ) {
    return value as TeachingProjectionMode;
  }
  throw new ActiveCourseInventoryError(
    'invalid-projection-mode',
    `active course inventory rejected: invalid projectionMode ${String(value)} on ${label}`,
  );
}

function parseKnowledgeRefs(
  value: unknown,
  label: string,
): TeachingKnowledgeRefAuthoring[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new ActiveCourseInventoryError(
      'invalid-knowledge-refs',
      `active course inventory rejected: knowledgeRefs must be an array on ${label}`,
    );
  }
  const refs: TeachingKnowledgeRefAuthoring[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const rec = asRecord(value[i]);
    const canonicalId =
      typeof rec.canonicalId === 'string' && rec.canonicalId.length > 0
        ? rec.canonicalId
        : null;
    const roleRaw = typeof rec.role === 'string' ? rec.role : null;
    if (!canonicalId || !roleRaw) {
      throw new ActiveCourseInventoryError(
        'invalid-knowledge-refs',
        `active course inventory rejected: knowledgeRefs[${i}] on ${label} requires canonicalId and role`,
      );
    }
    if (!(TEACHING_PROJECTION_ROLES as readonly string[]).includes(roleRaw)) {
      throw new ActiveCourseInventoryError(
        'invalid-knowledge-refs',
        `active course inventory rejected: invalid role ${roleRaw} on ${label} knowledgeRefs[${i}]`,
      );
    }
    const ref: TeachingKnowledgeRefAuthoring = {
      canonicalId,
      role: roleRaw as TeachingProjectionRole,
    };
    if (rec.primary === true) ref.primary = true;
    if (typeof rec.rationale === 'string') ref.rationale = rec.rationale;
    if (typeof rec.sourcePath === 'string') ref.sourcePath = rec.sourcePath;
    refs.push(ref);
  }
  return refs;
}

function extractSteps(manifest: unknown): ExtractedStep[] {
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
        const label = `step ${stepId}`;
        return {
          stepId,
          title,
          projectionMode: parseProjectionMode(rec.projectionMode, label),
          knowledgeRefs: parseKnowledgeRefs(rec.knowledgeRefs, label),
        };
      })
      .filter((s) => s.stepId.length > 0);
  }

  if (typeof steps === 'object') {
    return Object.entries(steps as Record<string, unknown>).map(([stepId, step]) => {
      const rec = asRecord(step);
      const title = typeof rec.title === 'string' ? rec.title : null;
      const label = `step ${stepId}`;
      return {
        stepId,
        title,
        projectionMode: parseProjectionMode(rec.projectionMode, label),
        knowledgeRefs: parseKnowledgeRefs(rec.knowledgeRefs, label),
      };
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

  // Fail closed on corrupt JSON for any present inventory input file.
  const lessonJson = readOptionalJson(lessonPath, `lesson.json (${spec.packageId})`);
  const manifestJson = readOptionalJson(
    manifestPath,
    `interactive-manifest.json (${spec.packageId})`,
  );
  const overlayJson = readOptionalJson(
    overlayPath,
    `graph-overlay.json (${spec.packageId})`,
  );

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

  // Interactive steps — per-step projectionMode / knowledgeRefs from records.
  if (existsSync(manifestPath)) {
    const sourcePath = relPath(repoRoot, manifestPath);
    sourcePaths.push(sourcePath);
    const digest = fileDigest(manifestPath);
    const steps = extractSteps(manifestJson);
    const defaultStepMode = spec.defaultStepMode ?? 'REQUIRED';

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
          projectionMode: step.projectionMode ?? defaultStepMode,
          title: step.title,
          sourcePath: `${sourcePath}#${step.stepId}`,
          sourceDigest: sha256Buffer(`${digest}:${step.stepId}`),
          legacyIds,
          labels,
          cardIds: legacyIds,
          knowledgeRefs: step.knowledgeRefs,
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

function gitSync(repoRoot: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const err = error as { stderr?: string | Buffer; message?: string };
    const stderr =
      typeof err.stderr === 'string'
        ? err.stderr
        : Buffer.isBuffer(err.stderr)
          ? err.stderr.toString('utf8')
          : '';
    throw new ActiveCourseInventoryError(
      'git-failed',
      `active course inventory rejected: git ${args.join(' ')} failed: ${
        stderr.trim() || err.message || String(error)
      }`,
    );
  }
}

function gitShowBytes(repoRoot: string, revision: string, rel: string): Buffer {
  try {
    return execFileSync('git', ['show', `${revision}:${rel}`], {
      cwd: repoRoot,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }) as Buffer;
  } catch (error) {
    const err = error as { stderr?: string | Buffer; message?: string };
    const stderr =
      typeof err.stderr === 'string'
        ? err.stderr
        : Buffer.isBuffer(err.stderr)
          ? err.stderr.toString('utf8')
          : '';
    throw new ActiveCourseInventoryError(
      'revision-path-missing',
      `active course inventory rejected: path ${rel} is not present at authoringRevision ${revision}: ${
        stderr.trim() || err.message || String(error)
      }`,
    );
  }
}

/**
 * Fail closed when inventory bytes do not match the declared authoringRevision.
 *
 * Practical binding:
 * 1. authoringRevision must be a resolvable 40-char git commit
 * 2. inventoried paths (including identity denominator when enabled) must be
 *    clean in the working tree (no mixed capture)
 * 3. working-tree bytes for each path must equal `git show <rev>:<path>`
 */
export function assertInventoryBytesMatchAuthoringRevision(input: {
  repoRoot: string;
  authoringRevision: string;
  sourcePaths: readonly string[];
}): void {
  const revision = input.authoringRevision.trim();
  if (!GIT_COMMIT.test(revision)) {
    throw new ActiveCourseInventoryError(
      'invalid-authoring-revision',
      `active course inventory rejected: authoringRevision must be a 40-char lowercase git commit, got ${input.authoringRevision}`,
    );
  }

  // Ensure the commit object exists.
  try {
    gitSync(input.repoRoot, ['cat-file', '-e', `${revision}^{commit}`]);
  } catch (error) {
    if (error instanceof ActiveCourseInventoryError) {
      throw new ActiveCourseInventoryError(
        'unresolvable-authoring-revision',
        `active course inventory rejected: authoringRevision ${revision} is not a resolvable git commit`,
      );
    }
    throw error;
  }

  const uniquePaths = [...new Set(
    input.sourcePaths
      .map(sourcePathWithoutFragment)
      .filter((p) => p.length > 0),
  )].sort();

  if (uniquePaths.length === 0) return;

  // Dirty / untracked inventoried paths → mixed capture, fail closed.
  const dirty = gitSync(input.repoRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
    ...uniquePaths,
  ]);
  if (dirty.length > 0) {
    throw new ActiveCourseInventoryError(
      'dirty-inventory-paths',
      `active course inventory rejected: inventoried paths are dirty relative to the working tree (cannot bind authoringRevision ${revision}):\n${dirty}`,
    );
  }

  // Byte-level match against the declared revision (not just cleanliness at HEAD).
  for (const rel of uniquePaths) {
    const abs = join(input.repoRoot, rel);
    if (!existsSync(abs)) {
      throw new ActiveCourseInventoryError(
        'missing-inventory-path',
        `active course inventory rejected: inventoried path missing on disk: ${rel}`,
      );
    }
    const worktreeDigest = sha256Buffer(readFileSync(abs));
    const revisionDigest = sha256Buffer(gitShowBytes(input.repoRoot, revision, rel));
    if (worktreeDigest !== revisionDigest) {
      throw new ActiveCourseInventoryError(
        'revision-byte-mismatch',
        `active course inventory rejected: path ${rel} bytes differ from authoringRevision ${revision} (mixed capture)`,
      );
    }
  }
}

/**
 * Collect revision-bound paths for an inventory build: package content sources
 * plus optional identity-denominator sources (registry + deps).
 */
export function collectInventoryBindingPaths(input: {
  repoRoot: string;
  packageSourcePaths: readonly string[];
  includeIdentityDenominator: boolean;
}): string[] {
  const paths = [...input.packageSourcePaths];
  if (input.includeIdentityDenominator) {
    paths.push(...resolveIdentityDenominatorPaths(input.repoRoot));
  }
  return [...new Set(paths.map(sourcePathWithoutFragment).filter((p) => p.length > 0))].sort();
}

/**
 * Enumerate currently published/used interactive course packages and their
 * reachable runtime resources with source digests.
 */
export function buildActiveCourseInventory(
  options: InventoryBuildOptions,
): ActiveCourseInventory {
  const revisionBound = options.allowWorkingTreeBytes !== true;
  // Revision-bound builds must never silently drop declared packages when their
  // runtime lesson dir is missing: skipped packages leave no sourcePaths, so git
  // cleanliness/byte checks cannot detect the hole and inventory still binds
  // authoringRevision. skipMissingRuntime is fixture-only (allowWorkingTreeBytes).
  const skipMissing =
    !revisionBound && options.skipMissingRuntime !== false;
  const usingRegistry = options.packages == null;
  const includeIdentityDenominator =
    options.includeIdentityDenominator ?? usingRegistry;
  const specs = options.packages ?? packagesFromRegistry();
  const packages: ActiveCoursePackageInventory[] = [];

  for (const spec of specs) {
    const pkg = inventPackage(options.repoRoot, spec);
    if (!pkg) {
      if (skipMissing) continue;
      throw new ActiveCourseInventoryError(
        'runtime-missing',
        `active course package runtime missing: ${spec.runtimeLessonDir}`,
      );
    }
    packages.push(pkg);
  }

  packages.sort((a, b) =>
    a.packageId < b.packageId ? -1 : a.packageId > b.packageId ? 1 : 0,
  );

  if (options.allowWorkingTreeBytes !== true) {
    const sourcePaths = collectInventoryBindingPaths({
      repoRoot: options.repoRoot,
      packageSourcePaths: packages.flatMap((p) => p.sourcePaths),
      includeIdentityDenominator,
    });
    assertInventoryBytesMatchAuthoringRevision({
      repoRoot: options.repoRoot,
      authoringRevision: options.authoringRevision,
      sourcePaths,
    });
  }

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
