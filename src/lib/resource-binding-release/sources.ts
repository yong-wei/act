/**
 * Input loading for the anchored resource binding release builder.
 *
 * Authoring truth: `course-content/authoring/knowledge/resource-bindings/` (anchors,
 * unit scopes, course-node crosswalk, review ledger, active runtime media index),
 * `teaching-projection/course-order/units.jsonl`, runtime lesson manifests, plus the
 * live course projection whose exact channels are carried forward.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadCardReplacements, type CardReplacements } from './card-replacements';

import { projectionSha256 } from '@/lib/teaching-projection/hash';
import type {
  TeachingBindingRuntime,
  TeachingProjectionManifest,
  TeachingResourceRuntime,
} from '@/lib/teaching-projection/contracts';

import {
  DEFAULT_RESOURCE_BINDING_AUTHORING_RELATIVE,
  ResourceBindingReleaseError,
} from './contracts';

export interface AnchorCandidate {
  canonicalId: string;
  provenance: string;
  matchedLabel?: string;
  labelKind?: string;
  inScope?: boolean;
  score?: number;
  courseNodeId?: string;
}

export interface AnchorStep {
  stepId: string;
  index: number;
  title: string | null;
  groupName: string | null;
  textChars: number;
  canonical: AnchorCandidate[];
}

export interface AnchorSection {
  headingId: string;
  order: number;
  level: number;
  title: string;
  startLine: number;
  endLine: number;
  bodyChars: number;
  canonical: AnchorCandidate[];
}

export interface AnchorMediaSegment {
  index: number;
  startSeconds: number;
  endSeconds: number;
  textPreview: string;
  canonical: AnchorCandidate[];
}

export interface AnchorMedia {
  mediaId: string;
  kind: 'audio' | 'video';
  runtimePath: string;
  sha256: string;
  activeReleaseSha256: string | null;
  durationSeconds: number | null;
  transcriptSource: string | null;
  offsetSeconds?: number;
  offsetVerified?: boolean;
  status: string;
  segments: AnchorMediaSegment[];
}

export interface UnitAnchors {
  contract: string;
  unit: string;
  unitIndex: number | null;
  activeRuntimeReleaseId: string | null;
  handout: { runtimePath: string; sha256: string } | null;
  steps: AnchorStep[];
  handoutSections: AnchorSection[];
  media: AnchorMedia[];
}

export interface UnitScope {
  unit: string;
  canonicalIds: string[];
  sources: Record<string, string[]>;
}

export interface CrosswalkRow {
  courseNodeId: string;
  courseName: string;
  ownerLesson: string | null;
  canonicalIds: string[];
  method: string | null;
  status: 'mapped' | 'unmapped';
}

export interface ReviewRow {
  /** Which anchor the row addresses. */
  unit: string;
  target: { kind: 'step' | 'heading' | 'time'; id: string };
  canonicalId: string;
  decision: 'accept' | 'reject' | 'add';
  note?: string;
}

export interface ActiveRuntimeMediaIndex {
  runtimeReleaseId: string | null;
  files: Array<{ path: string; sha256: string; sizeBytes: number | null }>;
}

export interface CourseProjectionCarryForward {
  projectionId: string;
  manifest: TeachingProjectionManifest;
  resources: TeachingResourceRuntime[];
  bindings: TeachingBindingRuntime[];
  resourcesRaw: string;
  bindingsRaw: string;
}

export interface LessonMeta {
  unitId: string;
  title: string | null;
  focusNodeIds: string[];
  reuseNodeIds: string[];
}

export interface ResourceBindingSources {
  /** Current Authority endpoints; absent only in isolated legacy fixtures. */
  authorityCanonicalIds?: ReadonlySet<string>;
  repoRoot: string;
  scopeId: string;
  authority: {
    releaseId: string;
    releaseSetId: string | null;
    snapshotId: string | null;
    snapshotHash: string | null;
  };
  prerequisitePublicationId: string | null;
  unitOrder: string[];
  lessons: Map<string, LessonMeta>;
  anchors: Map<string, UnitAnchors>;
  unitScopes: Map<string, UnitScope>;
  crosswalk: CrosswalkRow[];
  review: ReviewRow[];
  ambiguousLabels: string[];
  activeMedia: ActiveRuntimeMediaIndex;
  carryForward: CourseProjectionCarryForward;
  cardReplacements?: CardReplacements;
  raw: {
    anchors: string;
    unitScopes: string;
    crosswalk: string;
    review: string;
    courseOrder: string;
    activeRuntimeMediaIndex: string;
  };
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => JSON.parse(line) as T);
}

function readTextOrEmpty(file: string): string {
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

function concatDirectoryText(dir: string, suffix: string): string {
  if (!existsSync(dir)) return '';
  return readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .sort()
    .map((name) => `${name}\n${readFileSync(path.join(dir, name), 'utf8')}`)
    .join('\n');
}

export function loadResourceBindingSources(repoRoot: string): ResourceBindingSources {
  const authoringDir = path.join(repoRoot, DEFAULT_RESOURCE_BINDING_AUTHORING_RELATIVE);
  const anchorsDir = path.join(authoringDir, 'anchors');
  const scopesDir = path.join(authoringDir, 'unit-scope');
  const reviewDir = path.join(authoringDir, 'review');
  if (!existsSync(anchorsDir)) {
    throw new ResourceBindingReleaseError(
      'anchors-missing',
      `resource anchors directory is missing: ${anchorsDir}`,
    );
  }

  const authorityCurrent = readJson<{
    releaseId: string;
    releaseSetId?: string | null;
    snapshotId?: string | null;
    snapshotHash?: string | null;
  }>(path.join(repoRoot, 'course-content/authoring/knowledge/authority/current.json'));

  const projectionCurrent = readJson<{ projectionId: string; projectionHash: string }>(
    path.join(repoRoot, 'course-content/runtime/knowledge/projection/current.json'),
  );
  const projectionDir = path.join(
    repoRoot,
    'course-content/runtime/knowledge/projection/releases',
    projectionCurrent.projectionId,
  );
  const manifest = readJson<TeachingProjectionManifest>(path.join(projectionDir, 'projection-manifest.json'));
  if (manifest.authoritySnapshotId !== authorityCurrent.snapshotId) {
    throw new ResourceBindingReleaseError(
      'authority-mismatch',
      `course projection ${projectionCurrent.projectionId} is built on ${manifest.authoritySnapshotId}, authority current is ${authorityCurrent.snapshotId}`,
    );
  }
  const resourcesRaw = readFileSync(path.join(projectionDir, 'resources.jsonl'), 'utf8');
  const bindingsRaw = readFileSync(path.join(projectionDir, 'bindings.jsonl'), 'utf8');
  const carryForward: CourseProjectionCarryForward = {
    projectionId: projectionCurrent.projectionId,
    manifest,
    resources: readJsonl<TeachingResourceRuntime>(path.join(projectionDir, 'resources.jsonl')),
    bindings: readJsonl<TeachingBindingRuntime>(path.join(projectionDir, 'bindings.jsonl')),
    resourcesRaw,
    bindingsRaw,
  };

  const prereqCurrentPath = path.join(repoRoot, 'course-content/runtime/knowledge/prerequisites/current.json');
  const prerequisitePublicationId = existsSync(prereqCurrentPath)
    ? readJson<{ publicationId?: string }>(prereqCurrentPath).publicationId ?? null
    : null;

  const courseOrderPath = path.join(
    repoRoot,
    'course-content/authoring/knowledge/teaching-projection/course-order/units.jsonl',
  );
  const unitOrder = readJsonl<{ unitId: string }>(courseOrderPath).map((row) => row.unitId);
  if (unitOrder.length === 0) {
    throw new ResourceBindingReleaseError('course-order-missing', `course order units are missing: ${courseOrderPath}`);
  }

  const anchors = new Map<string, UnitAnchors>();
  for (const name of readdirSync(anchorsDir).filter((n) => n.endsWith('.json')).sort()) {
    const doc = readJson<UnitAnchors>(path.join(anchorsDir, name));
    anchors.set(doc.unit, doc);
  }
  const unitScopes = new Map<string, UnitScope>();
  if (existsSync(scopesDir)) {
    for (const name of readdirSync(scopesDir).filter((n) => n.endsWith('.json')).sort()) {
      const doc = readJson<UnitScope>(path.join(scopesDir, name));
      unitScopes.set(doc.unit, doc);
    }
  }
  const crosswalk = readJsonl<CrosswalkRow>(path.join(authoringDir, 'course-node-crosswalk.jsonl'));
  if (crosswalk.length === 0) {
    throw new ResourceBindingReleaseError('crosswalk-missing', 'course-node-crosswalk.jsonl is missing or empty');
  }
  const review: ReviewRow[] = [];
  if (existsSync(reviewDir)) {
    for (const name of readdirSync(reviewDir).filter((n) => n.endsWith('.jsonl')).sort()) {
      review.push(...readJsonl<ReviewRow>(path.join(reviewDir, name)));
    }
  }
  const summaryPath = path.join(authoringDir, 'anchors-summary.json');
  const ambiguousLabels = existsSync(summaryPath)
    ? Object.keys(readJson<{ ambiguousLabels?: Record<string, string[]> }>(summaryPath).ambiguousLabels ?? {})
    : [];
  const activeIndexPath = path.join(authoringDir, 'active-runtime-media-index.json');
  const activeMedia: ActiveRuntimeMediaIndex = existsSync(activeIndexPath)
    ? readJson<ActiveRuntimeMediaIndex>(activeIndexPath)
    : { runtimeReleaseId: null, files: [] };

  const lessons = new Map<string, LessonMeta>();
  for (const unitId of unitOrder) {
    const lessonPath = path.join(repoRoot, 'course-content/runtime/lessons', unitId, 'lesson.json');
    if (!existsSync(lessonPath)) continue;
    const lesson = readJson<{
      title?: string;
      focus_node_ids?: string[];
      reuse_node_ids?: string[];
    }>(lessonPath);
    lessons.set(unitId, {
      unitId,
      title: lesson.title ?? null,
      focusNodeIds: lesson.focus_node_ids ?? [],
      reuseNodeIds: lesson.reuse_node_ids ?? [],
    });
  }

  return {
    repoRoot,
    scopeId: manifest.scopeId,
    authority: {
      releaseId: authorityCurrent.releaseId,
      releaseSetId: authorityCurrent.releaseSetId ?? manifest.authorityReleaseSetId ?? null,
      snapshotId: authorityCurrent.snapshotId ?? null,
      snapshotHash: authorityCurrent.snapshotHash ?? null,
    },
    prerequisitePublicationId,
    unitOrder,
    lessons,
    anchors,
    unitScopes,
    crosswalk,
    review,
    ambiguousLabels,
    activeMedia,
    carryForward,
    authorityCanonicalIds: new Set(readJson<{ objects: Array<{ canonicalId: string }> }>(path.join(
      repoRoot, 'course-content/authoring/knowledge/authority/releases', authorityCurrent.snapshotId!, 'engineering.json',
    )).objects.map((row) => row.canonicalId)),
    cardReplacements: loadCardReplacements(repoRoot, authorityCurrent, carryForward.bindings),
    raw: {
      anchors: projectionSha256(concatDirectoryText(anchorsDir, '.json')),
      unitScopes: projectionSha256(concatDirectoryText(scopesDir, '.json')),
      crosswalk: projectionSha256(readTextOrEmpty(path.join(authoringDir, 'course-node-crosswalk.jsonl'))),
      review: projectionSha256(concatDirectoryText(reviewDir, '.jsonl')),
      courseOrder: projectionSha256(readTextOrEmpty(courseOrderPath)),
      activeRuntimeMediaIndex: projectionSha256(readTextOrEmpty(activeIndexPath)),
    },
  };
}
