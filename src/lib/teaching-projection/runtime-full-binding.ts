/**
 * Plan a runtime-denominator Teaching Projection restage.
 * Exact identity or one-to-one crosswalk only; leftovers go to the ledger.
 */

import { humanTitleFromResourceId } from '@/lib/authority-domain-shards/resource-bindings';
import {
  TEACHING_PROJECTION_AUTHORING_CONTRACT,
  type TeachingBindingAuthoring,
  type TeachingCardAuthoring,
  type TeachingCoreNodeAuthoring,
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

/** Unambiguous classroom lessonNN → current syllabus unit. lesson02 is retired and cleaned at the source (#2042). */
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

/** Card crosswalk row from teaching-projection/cards/card-crosswalk.jsonl (#2042). */
export interface CardCrosswalkInput {
  cardId: string;
  canonicalId: string;
  legacyNodeId?: string;
  sourceEvidence?: string;
}

/** Explicitly exempt card from teaching-projection/cards/card-exemptions.jsonl (#2042). */
export interface CardExemptionInput {
  cardId: string;
  name?: string;
  exemptionReason: string;
}

/** Classroom sim with an attributable canonical anchor (#2042 task 4.5). */
export interface SimCanonicalDeclarationInput {
  resourceKey: string;
  canonicalId: string;
  rationale?: string;
}

/** Classroom sim permanently exempt from knowledge binding (#2042 task 4.5). */
export interface ClassroomSimExemptionInput {
  resourceKey: string;
  exemptionReason: string;
}

/** Authority infograph enumerated from infographs/authority/nodes (#2042 task 2.2). */
export interface InfographAuthorityInput {
  resourceId: string;
  canonicalId: string;
  title?: string | null;
}

/** Legacy infograph enumerated from infographs/nodes (#2042 task 2.3); binds via the card crosswalk channel. */
export interface InfographLegacyInput {
  resourceId: string;
  cardId: string;
  title?: string | null;
}

/** Lesson/step inventory row merged back into the restage denominator (#2042 task 3.1). */
export interface LessonStepInventoryInput {
  resourceId: string;
  resourceType: 'lesson' | 'step';
  title?: string | null;
  sourcePath?: string | null;
}

export interface ExceptionLedgerRow {
  resourceId: string;
  reason:
    | 'no-exact-identity'
    | 'classroom-sim-without-unit'
    | 'classroom-sim-unit-unmapped'
    | 'out-of-round-textbook'
    | 'explicit-exemption';
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

/** Per-reason ledger quotas (#2042 task 6.2); a category breaches when its count exceeds the quota. */
export function evaluateLedgerQuotas(
  ledger: readonly ExceptionLedgerRow[],
  quotas: Readonly<Record<string, number>>,
): { passed: boolean; countsByReason: Record<string, number>; breaches: string[] } {
  const counts = new Map<string, number>();
  for (const row of ledger) {
    counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1);
  }
  const breaches: string[] = [];
  for (const [reason, count] of [...counts.entries()].sort()) {
    const quota = quotas[reason];
    if (quota !== undefined && count > quota) {
      breaches.push(`${reason}: ${count} > ${quota}`);
    }
  }
  return {
    passed: breaches.length === 0,
    countsByReason: Object.fromEntries([...counts.entries()].sort()),
    breaches,
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
  /** Every unit with binding evidence per canonical node (#2042); takes precedence over nodeUnits. */
  nodeUnitSets?: ReadonlyMap<string, readonly string[]>;
  nodeUnits: ReadonlyMap<string, string>;
  resources: readonly RuntimeResourceRow[];
  bindings: readonly RuntimeBindingRow[];
  prerequisites: TeachingProjectionAuthoringInput['prerequisites'];
  cards: readonly RuntimeCardRow[];
  authorityCardCanonicalIds: readonly string[];
  textbookLocators: readonly TextbookLocatorRow[];
  taskSims: readonly TaskSimInput[];
  cardCrosswalk?: readonly CardCrosswalkInput[];
  cardExemptions?: readonly CardExemptionInput[];
  simCanonicalDeclarations?: readonly SimCanonicalDeclarationInput[];
  classroomSimExemptions?: readonly ClassroomSimExemptionInput[];
  infographsAuthority?: readonly InfographAuthorityInput[];
  infographsLegacy?: readonly InfographLegacyInput[];
  lessonStepInventory?: readonly LessonStepInventoryInput[];
  /** Core nodes fed back from the prerequisite publication (#2042 task 3.2). */
  coreNodes?: readonly TeachingCoreNodeAuthoring[];
  /** Textbook section resourceIds explicitly exempt from binding (#2042 task 5.2). */
  exemptTextbookSections?: ReadonlySet<string>;
}): RuntimeFullBindingPlan {
  const overlay = new Set(input.overlayCores);
  const resources = new Map<string, TeachingResourceAuthoring>();
  const bindings: TeachingBindingAuthoring[] = [];
  const seenBinding = new Set<string>();
  const ledger: ExceptionLedgerRow[] = [];
  const boundCanonicalByCard = new Map<string, string[]>();
  const cardCrosswalk = new Map<string, string>(
    (input.cardCrosswalk ?? []).map((row) => [row.cardId, row.canonicalId]),
  );
  const cardExempt = new Set((input.cardExemptions ?? []).map((row) => row.cardId));
  const simExemptKeys = new Set((input.classroomSimExemptions ?? []).map((row) => row.resourceKey));
  const simDeclarationKeys = new Map<string, string>(
    (input.simCanonicalDeclarations ?? []).map((row) => [row.resourceKey, row.canonicalId]),
  );

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
  if (input.nodeUnitSets) {
    for (const [canonicalId, units] of input.nodeUnitSets) {
      if (!overlay.has(canonicalId)) continue;
      for (const unit of units) {
        const list = coresByUnit.get(unit) ?? [];
        list.push(canonicalId);
        coresByUnit.set(unit, list);
      }
    }
  } else {
    for (const [canonicalId, unit] of input.nodeUnits) {
      if (!overlay.has(canonicalId)) continue;
      const list = coresByUnit.get(unit) ?? [];
      list.push(canonicalId);
      coresByUnit.set(unit, list);
    }
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

  const isBound = (resourceId: string) => bindings.some((item) => item.resourceId === resourceId);

  // Task sims and declared sims bind before the resource fallback so their
  // ledger classification reflects binding, not absence (#2042).
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

  for (const [resourceKey, canonicalId] of simDeclarationKeys) {
    if (!overlay.has(canonicalId)) continue;
    for (const resourceId of resources.keys()) {
      if (resourceId !== `act:simulation:${resourceKey}` && !resourceId.startsWith(`act:simulation:${resourceKey}-`)) continue;
      addBinding({
        resourceId,
        canonicalId,
        role: 'PRACTICES',
        scopeId: input.scopeId,
      });
    }
  }

  // Infographs enter the projection as a first-class resource type (#2042 task 2).
  for (const entry of input.infographsAuthority ?? []) {
    addResource({
      resourceId: entry.resourceId,
      resourceType: 'infographic',
      projectionMode: 'OPTIONAL',
      scopeId: input.scopeId,
      title: entry.title ?? undefined,
    });
    if (overlay.has(entry.canonicalId)) {
      addBinding({
        resourceId: entry.resourceId,
        canonicalId: entry.canonicalId,
        role: 'EXPLAINS',
        scopeId: input.scopeId,
      });
    } else {
      ledger.push({ resourceId: entry.resourceId, reason: 'no-exact-identity', detail: 'authority-infograph-token-not-in-overlay' });
    }
  }
  for (const entry of input.infographsLegacy ?? []) {
    addResource({
      resourceId: entry.resourceId,
      resourceType: 'infographic',
      projectionMode: 'OPTIONAL',
      scopeId: input.scopeId,
      title: entry.title ?? undefined,
    });
    const canonicalId = cardCrosswalk.get(entry.cardId);
    if (canonicalId && overlay.has(canonicalId)) {
      addBinding({
        resourceId: entry.resourceId,
        canonicalId,
        role: 'EXPLAINS',
        scopeId: input.scopeId,
      });
    } else if (cardExempt.has(entry.cardId)) {
      ledger.push({ resourceId: entry.resourceId, reason: 'explicit-exemption', detail: 'legacy-infograph-card-exempt' });
    } else {
      ledger.push({ resourceId: entry.resourceId, reason: 'no-exact-identity', detail: 'legacy-infograph-without-crosswalk' });
    }
  }

  // Lesson/step inventory re-enters the projection denominator (#2042 task 3.1).
  for (const row of input.lessonStepInventory ?? []) {
    addResource({
      resourceId: row.resourceId,
      resourceType: row.resourceType,
      projectionMode: 'OPTIONAL',
      scopeId: input.scopeId,
      title: row.title ?? undefined,
      sourcePath: row.sourcePath ?? undefined,
    });
    if (!bindToUnit(row.resourceId, 'EXPLAINS', input.scopeId)) {
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

  // Card identity channel: frontmatter canonical via cards-index, then the
  // reviewed crosswalk, then explicit exemptions; only then the ledger (#2042 task 1.3).
  for (const row of input.resources) {
    if (isBound(row.resourceId)) continue;
    if (row.resourceType !== 'card') continue;
    const cardId = row.resourceId.slice('act:card:'.length);
    const crosswalkCanonical = cardCrosswalk.get(cardId);
    if (crosswalkCanonical && overlay.has(crosswalkCanonical)) {
      addBinding({
        resourceId: row.resourceId,
        canonicalId: crosswalkCanonical,
        role: 'EXPLAINS',
        scopeId: row.scopeId,
        rationale: 'card-crosswalk #2042',
      });
      if (!seenCard.has(cardId)) {
        seenCard.add(cardId);
        cards.push({
          cardId,
          canonicalId: crosswalkCanonical,
          active: true,
          required: false,
          title: titleFor(row.resourceId, row.title),
        });
      }
      continue;
    }
    if (cardExempt.has(cardId)) {
      ledger.push({ resourceId: row.resourceId, reason: 'explicit-exemption', detail: 'card-exemption-listed' });
      continue;
    }
    ledger.push({ resourceId: row.resourceId, reason: 'no-exact-identity' });
  }

  const exemptTextbookSections = input.exemptTextbookSections ?? new Set<string>();
  const admittedBooks = new Set<string>(EXTRACTION_SOURCE_BOOKS);
  for (const locator of input.textbookLocators) {
    if (!admittedBooks.has(locator.sourceDocumentId)) continue;
    const hitIds = locator.canonicalIds.filter((id) => overlay.has(id));
    const bookId = `act:textbook:${locator.sourceDocumentId}`;
    const chapterId = `act:textbook-chapter:${locator.sourceDocumentId}:${locator.chapterKey}`;
    const sectionToken = toResourceIdToken(locator.sourceAnchorId, 'sourceAnchorId');
    const sectionId = `act:textbook-section:${sectionToken}`;
    if (hitIds.length === 0) {
      const reason = exemptTextbookSections.has(sectionId) ? 'explicit-exemption' : 'no-exact-identity';
      ledger.push({ resourceId: sectionId, reason, detail: locator.sourceDocumentId });
      continue;
    }
    addResource({
      resourceId: bookId,
      resourceType: 'textbook',
      projectionMode: 'OPTIONAL',
      scopeId: input.scopeId,
      sourceDocumentId: locator.sourceDocumentId,
      title: BOOK_TITLES[locator.sourceDocumentId] ?? locator.sourceDocumentId,
    });
    addResource({
      resourceId: chapterId,
      resourceType: 'textbook-chapter',
      projectionMode: 'OPTIONAL',
      scopeId: input.scopeId,
      sourceDocumentId: locator.sourceDocumentId,
      chapterKey: locator.chapterKey,
      title: `${BOOK_TITLES[locator.sourceDocumentId] ?? locator.sourceDocumentId} ${locator.chapterKey}`,
    });
    addResource({
      resourceId: sectionId,
      resourceType: 'textbook-section',
      projectionMode: 'OPTIONAL',
      scopeId: input.scopeId,
      sectionId: sectionToken,
      title: locator.sourceAnchorId,
    });
    for (const canonicalId of hitIds) {
      addBinding({
        resourceId: sectionId,
        canonicalId,
        role: 'EXPLAINS',
        scopeId: input.scopeId,
      });
      addBinding({
        resourceId: chapterId,
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

  for (const row of input.resources) {
    if (isBound(row.resourceId)) continue;
    if (row.resourceType === 'card') continue;

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
      const exemptKey = [row.resourceId.slice('act:simulation:'.length)]
        .filter((key) => simExemptKeys.has(key));
      if (exemptKey.length > 0) {
        ledger.push({ resourceId: row.resourceId, reason: 'explicit-exemption', detail: 'classroom-sim-exemption-listed' });
        continue;
      }
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
  }

  const boundIds = new Set(bindings.map((row) => row.resourceId));
  for (const [resourceId, row] of resources) {
    if (boundIds.has(resourceId)) continue;
    if (!ledger.some((item) => item.resourceId === resourceId)) {
      ledger.push({ resourceId, reason: 'no-exact-identity' });
    }
    if (
      row.resourceType === 'textbook'
      || row.resourceType === 'textbook-chapter'
      || row.resourceType === 'textbook-section'
    ) {
      resources.delete(resourceId);
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
    coreNodes: input.coreNodes ?? [],
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
