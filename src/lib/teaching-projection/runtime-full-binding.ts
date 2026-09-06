/**
 * Plan a runtime-denominator Teaching Projection restage.
 * Exact identity or one-to-one crosswalk only; leftovers go to the ledger.
 */

import { humanTitleFromResourceId } from '@/lib/authority-domain-shards/resource-bindings';
import {
  TEACHING_PROJECTION_AUTHORING_CONTRACT,
  type TeachingBindingAuthoring,
  type TeachingCardAuthoring,
  type TeachingProjectionAuthoringInput,
  type TeachingProjectionRole,
  type TeachingResourceAuthoring,
  type TeachingResourceType,
} from './contracts';
import { toResourceIdToken } from './textbook-locators/identity';

export const EXTRACTION_SOURCE_BOOKS = [
  'dorf-modern-control-systems-14th',
  'franklin-feedback-control-7th',
  'hu-shousong-auto-control-8th',
] as const;

export const BOOK_TITLES: Readonly<Record<string, string>> = {
  'dorf-modern-control-systems-14th': 'Modern Control Systems (Dorf/Bishop, 14th)',
  'franklin-feedback-control-7th': 'Feedback Control of Dynamic Systems (Franklin, 7th)',
  'hu-shousong-auto-control-8th': '自动控制原理（胡寿松，第8版）',
};

const UNIT_RE = /(\d+-\d+)/;
const LESSON_PREFIX_RE = /(?:^|:)lesson(\d+)/i;
const COLON_FREE = /^[^:\s]+$/u;

/** Unambiguous classroom lessonNN → current syllabus unit. lesson02 is aliased, not mapped. */
const CLASSROOM_LESSON_UNIT: Readonly<Record<string, string>> = {
  '06': '2-2',
  '07': '2-2',
  '08': '3-1',
  '09': '3-7',
  '10': '3-3',
  '11': '3-4',
  '12': '2-3',
  '13': '2-4',
  '14': '2-4',
};

export interface RuntimeResourceRow {
  resourceId: string;
  resourceType: TeachingResourceType;
  projectionMode: 'REQUIRED' | 'OPTIONAL' | 'NONE';
  scopeId: string;
  title?: string | null;
  sourcePath?: string | null;
  legacyCrosswalkRef?: string | null;
}

export interface RuntimeBindingRow {
  resourceId: string;
  canonicalId: string;
  role: TeachingProjectionRole;
  scopeId: string;
  sourcePath?: string | null;
  primary?: boolean;
  rationale?: string | null;
}

export interface RuntimeCardRow {
  cardId: string;
  canonicalId: string;
  active: boolean;
  required: boolean;
  sourcePath?: string | null;
  title?: string | null;
}

export interface TextbookLocatorRow {
  sourceDocumentId: string;
  sourceAnchorId: string;
  chapterKey: string;
  canonicalIds: string[];
}

export interface TaskSimInput {
  taskKey: string;
  displayName: string;
  source: 'arena' | 'odyssey' | 'control-workbench';
  relatedNodeIds: string[];
}

export interface ExceptionLedgerRow {
  resourceId: string;
  reason:
    | 'no-exact-identity'
    | 'classroom-sim-without-unit'
    | 'classroom-sim-unit-unmapped'
    | 'out-of-round-textbook';
  detail?: string;
}

export interface RuntimeFullBindingPlan {
  authoring: TeachingProjectionAuthoringInput;
  ledger: ExceptionLedgerRow[];
  stats: {
    keptBindings: number;
    addedBindings: number;
    addedResources: number;
    ledgerCount: number;
  };
}

export function unitTokenFromResourceId(resourceId: string): string | null {
  const direct = resourceId.match(UNIT_RE)?.[1];
  if (direct) return direct;
  const lesson = resourceId.match(LESSON_PREFIX_RE)?.[1];
  if (!lesson) return null;
  return CLASSROOM_LESSON_UNIT[lesson.padStart(2, '0')] ?? null;
}

export function encodeCardToken(canonicalId: string): string {
  return canonicalId.replace(/:/g, '_');
}

export function classroomSimHasLessonUnit(resourceId: string): boolean {
  if (unitTokenFromResourceId(resourceId)) return true;
  return LESSON_PREFIX_RE.test(resourceId);
}

function bindingKey(row: {
  resourceId: string;
  canonicalId: string;
  role: string;
  scopeId: string;
}): string {
  return `${row.resourceId}\u001f${row.canonicalId}\u001f${row.role}\u001f${row.scopeId}`;
}

function titleFor(resourceId: string, fallback?: string | null): string {
  return fallback?.trim()
    || humanTitleFromResourceId(resourceId)
    || resourceId.slice(resourceId.lastIndexOf(':') + 1);
}

export function planRuntimeFullBinding(input: {
  scopeId: string;
  authoringRevision: string;
  authorityReleaseId: string;
  authorityReleaseSetId?: string | null;
  authoritySnapshotId?: string | null;
  authoritySnapshotHash?: string | null;
  overlayCores: readonly string[];
  nodeUnits: ReadonlyMap<string, string>;
  resources: readonly RuntimeResourceRow[];
  bindings: readonly RuntimeBindingRow[];
  prerequisites: TeachingProjectionAuthoringInput['prerequisites'];
  cards: readonly RuntimeCardRow[];
  authorityCardCanonicalIds: readonly string[];
  textbookLocators: readonly TextbookLocatorRow[];
  taskSims: readonly TaskSimInput[];
}): RuntimeFullBindingPlan {
  const overlay = new Set(input.overlayCores);
  const resources = new Map<string, TeachingResourceAuthoring>();
  const bindings: TeachingBindingAuthoring[] = [];
  const seenBinding = new Set<string>();
  const ledger: ExceptionLedgerRow[] = [];
  const boundCanonicalByCard = new Map<string, string[]>();

  const addResource = (row: TeachingResourceAuthoring) => {
    const id = row.resourceId;
    if (!id || resources.has(id)) return;
    resources.set(id, { ...row, title: titleFor(id, row.title) });
  };

  const addBinding = (row: TeachingBindingAuthoring) => {
    if (!overlay.has(row.canonicalId) && !input.bindings.some((b) => b.canonicalId === row.canonicalId)) {
      return false;
    }
    const key = bindingKey(row);
    if (seenBinding.has(key)) return false;
    seenBinding.add(key);
    bindings.push(row);
    return true;
  };

  for (const row of input.resources) {
    addResource({
      resourceId: row.resourceId,
      resourceType: row.resourceType,
      projectionMode: row.projectionMode,
      scopeId: row.scopeId,
      title: row.title ?? undefined,
      sourcePath: row.sourcePath ?? undefined,
      legacyCrosswalkRef: row.legacyCrosswalkRef ?? null,
    });
  }

  for (const row of input.bindings) {
    addBinding({
      resourceId: row.resourceId,
      canonicalId: row.canonicalId,
      role: row.role,
      scopeId: row.scopeId,
      sourcePath: row.sourcePath ?? undefined,
      primary: row.primary,
      rationale: row.rationale ?? undefined,
    });
    if (row.resourceId.startsWith('act:card:')) {
      const list = boundCanonicalByCard.get(row.resourceId) ?? [];
      list.push(row.canonicalId);
      boundCanonicalByCard.set(row.resourceId, list);
    }
  }
  const keptBindings = bindings.length;

  const coresByUnit = new Map<string, string[]>();
  for (const [canonicalId, unit] of input.nodeUnits) {
    if (!overlay.has(canonicalId)) continue;
    const list = coresByUnit.get(unit) ?? [];
    list.push(canonicalId);
    coresByUnit.set(unit, list);
  }

  const bindToUnit = (resourceId: string, role: TeachingProjectionRole, scopeId: string) => {
    const unit = unitTokenFromResourceId(resourceId);
    if (!unit) return false;
    const cores = coresByUnit.get(unit) ?? [];
    let added = false;
    for (const canonicalId of cores) {
      if (addBinding({ resourceId, canonicalId, role, scopeId })) added = true;
    }
    return added;
  };

  for (const row of input.resources) {
    if (bindings.some((item) => item.resourceId === row.resourceId)) continue;

    if (row.resourceType === 'handout' || row.resourceType === 'video' || row.resourceType === 'audio') {
      if (!bindToUnit(row.resourceId, 'EXPLAINS', row.scopeId)) {
        ledger.push({ resourceId: row.resourceId, reason: 'no-exact-identity' });
      }
      continue;
    }
    if (row.resourceType === 'exercise') {
      if (!bindToUnit(row.resourceId, 'PRACTICES', row.scopeId)) {
        ledger.push({ resourceId: row.resourceId, reason: 'no-exact-identity' });
      }
      continue;
    }
    if (row.resourceType === 'simulation') {
      if (unitTokenFromResourceId(row.resourceId)) {
        if (!bindToUnit(row.resourceId, 'PRACTICES', row.scopeId)) {
          ledger.push({ resourceId: row.resourceId, reason: 'no-exact-identity' });
        }
      } else if (classroomSimHasLessonUnit(row.resourceId)) {
        ledger.push({ resourceId: row.resourceId, reason: 'classroom-sim-unit-unmapped' });
      } else {
        ledger.push({ resourceId: row.resourceId, reason: 'classroom-sim-without-unit' });
      }
      continue;
    }
    if (row.resourceType === 'card') {
      ledger.push({ resourceId: row.resourceId, reason: 'no-exact-identity' });
    }
  }

  const cards: TeachingCardAuthoring[] = input.cards.map((card) => ({
    cardId: card.cardId,
    canonicalId: card.canonicalId,
    active: card.active,
    required: card.required,
    sourcePath: card.sourcePath ?? undefined,
    title: card.title ?? undefined,
  }));
  const seenCard = new Set(cards.map((card) => card.cardId));
  const activeCanonicalCards = new Set(
    cards.filter((card) => card.active !== false).map((card) => card.canonicalId),
  );

  for (const canonicalId of input.authorityCardCanonicalIds) {
    if (!overlay.has(canonicalId) || activeCanonicalCards.has(canonicalId)) continue;
    const cardId = encodeCardToken(canonicalId);
    if (!COLON_FREE.test(cardId) || seenCard.has(cardId)) continue;
    seenCard.add(cardId);
    activeCanonicalCards.add(canonicalId);
    const resourceId = `act:card:${cardId}`;
    cards.push({
      cardId,
      canonicalId,
      active: true,
      required: false,
      title: titleFor(resourceId),
    });
    addResource({
      resourceId,
      resourceType: 'card',
      projectionMode: 'OPTIONAL',
      scopeId: input.scopeId,
      title: titleFor(resourceId),
    });
    addBinding({
      resourceId,
      canonicalId,
      role: 'EXPLAINS',
      scopeId: input.scopeId,
      primary: true,
    });
  }

  const admittedBooks = new Set<string>(EXTRACTION_SOURCE_BOOKS);
  for (const locator of input.textbookLocators) {
    if (!admittedBooks.has(locator.sourceDocumentId)) continue;
    const bookId = `act:textbook:${locator.sourceDocumentId}`;
    addResource({
      resourceId: bookId,
      resourceType: 'textbook',
      projectionMode: 'OPTIONAL',
      scopeId: input.scopeId,
      sourceDocumentId: locator.sourceDocumentId,
      title: BOOK_TITLES[locator.sourceDocumentId] ?? locator.sourceDocumentId,
    });
    const chapterId = `act:textbook-chapter:${locator.sourceDocumentId}:${locator.chapterKey}`;
    addResource({
      resourceId: chapterId,
      resourceType: 'textbook-chapter',
      projectionMode: 'OPTIONAL',
      scopeId: input.scopeId,
      sourceDocumentId: locator.sourceDocumentId,
      chapterKey: locator.chapterKey,
      title: `${BOOK_TITLES[locator.sourceDocumentId] ?? locator.sourceDocumentId} ${locator.chapterKey}`,
    });
    const sectionToken = toResourceIdToken(locator.sourceAnchorId, 'sourceAnchorId');
    const sectionId = `act:textbook-section:${sectionToken}`;
    addResource({
      resourceId: sectionId,
      resourceType: 'textbook-section',
      projectionMode: 'OPTIONAL',
      scopeId: input.scopeId,
      sectionId: sectionToken,
      title: locator.sourceAnchorId,
    });
    for (const canonicalId of locator.canonicalIds) {
      if (!overlay.has(canonicalId)) continue;
      addBinding({
        resourceId: sectionId,
        canonicalId,
        role: 'EXPLAINS',
        scopeId: input.scopeId,
      });
      addBinding({
        resourceId: bookId,
        canonicalId,
        role: 'EXPLAINS',
        scopeId: input.scopeId,
      });
    }
  }

  for (const task of input.taskSims) {
    const token = task.taskKey.replace(/:/g, '-');
    if (!COLON_FREE.test(token)) {
      ledger.push({ resourceId: `act:simulation:${token}`, reason: 'no-exact-identity', detail: task.taskKey });
      continue;
    }
    const resourceId = `act:simulation:${token}`;
    addResource({
      resourceId,
      resourceType: 'simulation',
      projectionMode: 'OPTIONAL',
      scopeId: input.scopeId,
      title: task.displayName,
    });
    let bound = false;
    for (const nodeId of task.relatedNodeIds) {
      if (overlay.has(nodeId)) {
        if (addBinding({
          resourceId,
          canonicalId: nodeId,
          role: 'PRACTICES',
          scopeId: input.scopeId,
        })) bound = true;
        continue;
      }
      const cardResourceId = `act:card:${nodeId}`;
      for (const canonicalId of boundCanonicalByCard.get(cardResourceId) ?? []) {
        if (overlay.has(canonicalId)
          && addBinding({
            resourceId,
            canonicalId,
            role: 'PRACTICES',
            scopeId: input.scopeId,
          })) {
          bound = true;
        }
      }
    }
    if (!bound) {
      ledger.push({ resourceId, reason: 'no-exact-identity', detail: task.taskKey });
    }
  }

  const authorityNodeIds = new Set<string>([...overlay, ...bindings.map((row) => row.canonicalId)]);

  const authoring = JSON.parse(JSON.stringify({
    contract: TEACHING_PROJECTION_AUTHORING_CONTRACT,
    scopeId: input.scopeId,
    authoringRevision: input.authoringRevision,
    authorityReleaseId: input.authorityReleaseId,
    authorityReleaseSetId: input.authorityReleaseSetId ?? null,
    authoritySnapshotId: input.authoritySnapshotId ?? null,
    authoritySnapshotHash: input.authoritySnapshotHash ?? null,
    resources: [...resources.values()],
    bindings,
    prerequisites: input.prerequisites ?? [],
    coreNodes: [],
    cards,
    authorityNodes: [...authorityNodeIds].sort().map((canonicalId) => ({
      canonicalId,
      lifecycleStatus: 'active',
    })),
  })) as TeachingProjectionAuthoringInput;

  return {
    authoring,
    ledger,
    stats: {
      keptBindings,
      addedBindings: bindings.length - keptBindings,
      addedResources: resources.size - input.resources.length,
      ledgerCount: ledger.length,
    },
  };
}
