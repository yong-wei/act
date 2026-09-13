import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveConfiguredTeachingProjectionRoot } from '@/lib/teaching-projection/live-course-pointer';

const INTERNAL_TITLE = /^(ctc|ctkg|ctk)[:\s]/u;
const DUPLICATE_LESSON_SIM = /^(lesson\d+-[a-z0-9-]+)-\1(?:\s+仿真)?$/iu;
const HASH_SLUG = /[a-f0-9]{16,}/u;
const ASSERTION_LABEL = /^(属性断言|知识命题)\s*[：:]/u;
const LONG_ENGLISH_STATEMENT = /^[A-Za-z][\s\S]{79,}$/u;

export function isAssertionLikeKnowledgeLabel(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;
  if (ASSERTION_LABEL.test(trimmed)) return true;
  return LONG_ENGLISH_STATEMENT.test(trimmed)
    && /[.!?]/.test(trimmed)
    && !/[\u4e00-\u9fff]/.test(trimmed);
}

export function isInternalPlanningTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;
  if (INTERNAL_TITLE.test(trimmed)) return true;
  if (DUPLICATE_LESSON_SIM.test(trimmed)) return true;
  if (HASH_SLUG.test(trimmed) && !/[\u4e00-\u9fff]/.test(trimmed)) return true;
  return false;
}

export function entityIdFromInternalTitle(title: string): string | null {
  const trimmed = title.trim();
  const spaced = /^(ctc|ctkg|ctk)\s+(.+)$/u.exec(trimmed);
  if (spaced) return `${spaced[1]}:${spaced[2]}`;
  if (/^(ctc|ctkg|ctk):/u.test(trimmed)) return trimmed;
  return null;
}

export function humanizeLessonSimulationTitle(title: string): string | null {
  const match = DUPLICATE_LESSON_SIM.exec(title.trim());
  if (!match) return null;
  const slug = match[1].replace(/^lesson\d+-/u, '').replace(/-/g, ' ').trim();
  return slug ? `${slug}仿真` : null;
}

export function resolvePlanningResourceTitle(
  title: string,
  options: {
    labels?: ReadonlyMap<string, string>;
    canonicalIds?: readonly string[];
    resourceId?: string;
  } = {},
): string {
  const labels = options.labels ?? loadPlanningKnowledgeLabels();
  if (!isInternalPlanningTitle(title)) return title;
  const fromTitle = labels.get(entityIdFromInternalTitle(title) ?? '');
  if (fromTitle) return fromTitle;
  for (const id of options.canonicalIds ?? []) {
    const label = labels.get(id);
    if (label) return label;
  }
  const fromResource = entityIdFromResourceId(options.resourceId);
  if (fromResource && labels.get(fromResource)) return labels.get(fromResource)!;
  return humanizeLessonSimulationTitle(title) ?? title;
}

const AUTHORING_RELEASE_NAME = /control-theory-engineering-v\d+(?:\.\d+)*-r\d+/u;
const EMPTY_CACHE_KEY = 'none';

type PlanningKnowledgeCache = {
  labels: Map<string, string>;
  assertionIds: Set<string>;
};

const caches = new Map<string, PlanningKnowledgeCache>();

export function resolvePlanningAuthoringReleaseDir(
  repoRoot = process.cwd(),
  options: { authorityReleaseSetId?: string | null } = {},
): string | null {
  const setId = options.authorityReleaseSetId === undefined
    ? readLiveAuthorityReleaseSetId(repoRoot)
    : options.authorityReleaseSetId;
  const match = AUTHORING_RELEASE_NAME.exec(setId ?? '');
  if (!match) return null;
  const dir = join(repoRoot, 'course-content/authoring/knowledge/releases', match[0]);
  return existsSync(dir) ? dir : null;
}

function ensurePlanningKnowledgeCaches(
  repoRoot = process.cwd(),
  options: { authorityReleaseSetId?: string | null } = {},
): PlanningKnowledgeCache {
  const release = resolvePlanningAuthoringReleaseDir(repoRoot, options);
  const cacheKey = release ?? EMPTY_CACHE_KEY;
  const hit = caches.get(cacheKey);
  if (hit) return hit;
  const labels = new Map<string, string>();
  const assertionIds = new Set<string>();
  if (!release) {
    const empty = { labels, assertionIds };
    caches.set(cacheKey, empty);
    return empty;
  }
  const remember = (id: string, label: string, overwrite: boolean) => {
    if (isAssertionLikeKnowledgeLabel(label) || id.toLowerCase().includes('knowledgestatement')) {
      assertionIds.add(id);
    }
    if (overwrite || !labels.has(id)) labels.set(id, label);
  };
  readJsonl(join(release, 'multilingual-label-index.jsonl'), (row) => {
    if (row.language !== 'zh-CN' || row.label_type !== 'canonical_preferred') return;
    const id = stringField(row.entity_id);
    const label = stringField(row.label);
    if (id && label) remember(id, label, true);
  });
  readJsonl(join(release, 'localized-content-index.jsonl'), (row) => {
    if (row.locale !== 'zh-CN' || row.field_path !== 'name') return;
    const id = stringField(row.target_id);
    const label = stringField(row.value);
    if (id && label) remember(id, label, false);
  });
  const loaded = { labels, assertionIds };
  caches.set(cacheKey, loaded);
  return loaded;
}

export function loadPlanningKnowledgeLabels(
  repoRoot = process.cwd(),
  options: { authorityReleaseSetId?: string | null } = {},
): Map<string, string> {
  return ensurePlanningKnowledgeCaches(repoRoot, options).labels;
}

export function loadPlanningAssertionKnowledgeIds(
  repoRoot = process.cwd(),
  options: { authorityReleaseSetId?: string | null } = {},
): Set<string> {
  return ensurePlanningKnowledgeCaches(repoRoot, options).assertionIds;
}

function readJsonl(filePath: string, visit: (row: Record<string, unknown>) => void): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as unknown;
      if (row && typeof row === 'object' && !Array.isArray(row)) visit(row as Record<string, unknown>);
    } catch {
      // skip malformed label rows
    }
  }
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readLiveAuthorityReleaseSetId(repoRoot: string): string | null {
  try {
    const root = resolveConfiguredTeachingProjectionRoot(repoRoot);
    const current = JSON.parse(readFileSync(join(root, 'current.json'), 'utf8')) as {
      projectionId?: string;
    };
    const projectionId = current.projectionId?.trim();
    if (!projectionId || projectionId.includes('..') || projectionId.includes('/') || projectionId.includes('\\')) {
      return null;
    }
    const manifest = JSON.parse(
      readFileSync(join(root, 'releases', projectionId, 'projection-manifest.json'), 'utf8'),
    ) as { authorityReleaseSetId?: string };
    return typeof manifest.authorityReleaseSetId === 'string' && manifest.authorityReleaseSetId.trim()
      ? manifest.authorityReleaseSetId
      : null;
  } catch {
    return null;
  }
}

export function resetPlanningKnowledgeLabelsForTest(): void {
  caches.clear();
}

function entityIdFromResourceId(resourceId: string | undefined): string | null {
  if (!resourceId) return null;
  const card = /^act:card:(.+)$/u.exec(resourceId);
  if (!card) return null;
  return entityIdFromInternalTitle(card[1].replace(/_/g, ' '));
}
