/**
 * Legacy local graph ID policy (#1268).
 *
 * New authoring must not write old lesson-scoped graph node IDs as Canonical
 * endpoints. The legacy crosswalk remains readable for history and rollback.
 */

import type {
  TeachingBindingAuthoring,
  TeachingProjectionAuthoringInput,
  TeachingResourceAuthoring,
} from './contracts';
import type {
  LegacyIdCrosswalkEntry,
  TeachingKnowledgeRefAuthoring,
} from './migration-contracts';

/**
 * Local lesson graph ids look like `反馈_1_1`, `Bode图_1_1`, `比较元件_1_ec1f7070`.
 * They never contain a URI scheme separator.
 */
export function isLegacyLocalGraphNodeId(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.includes(':') || /\s/u.test(value)) return false;
  // Trailing lesson/chapter suffix: _<digits> or _<digits>_<hex>
  return /^.+_\d+(?:_[0-9a-fA-F]+)?$/u.test(value);
}

export class LegacyGraphIdAuthoringError extends Error {
  readonly code = 'legacy-graph-id-rejected' as const;
  readonly legacyIds: string[];

  constructor(legacyIds: string[]) {
    super(
      `new authoring rejects legacy local graph node IDs: ${legacyIds.join(', ')}`,
    );
    this.name = 'LegacyGraphIdAuthoringError';
    this.legacyIds = legacyIds;
  }
}

function collectLegacyIdsFromRefs(
  refs: readonly TeachingKnowledgeRefAuthoring[] | undefined,
  into: Set<string>,
): void {
  for (const ref of refs ?? []) {
    if (isLegacyLocalGraphNodeId(ref.canonicalId)) {
      into.add(ref.canonicalId);
    }
  }
}

function collectLegacyIdsFromBindings(
  bindings: readonly TeachingBindingAuthoring[] | undefined,
  into: Set<string>,
): void {
  for (const binding of bindings ?? []) {
    if (isLegacyLocalGraphNodeId(binding.canonicalId)) {
      into.add(binding.canonicalId);
    }
  }
}

/**
 * Reject authoring that places legacy graph node IDs into Canonical fields.
 * Crosswalk `legacyId` columns are intentionally not checked here.
 */
export function assertNoLegacyGraphIdsInAuthoring(
  input: Pick<TeachingProjectionAuthoringInput, 'bindings' | 'resources' | 'cards'> & {
    knowledgeRefsByResource?: ReadonlyMap<string, readonly TeachingKnowledgeRefAuthoring[]>;
  },
): void {
  const found = new Set<string>();
  collectLegacyIdsFromBindings(input.bindings, found);

  for (const resource of input.resources ?? []) {
    const extended = resource as TeachingResourceAuthoring & {
      knowledgeRefs?: TeachingKnowledgeRefAuthoring[];
    };
    collectLegacyIdsFromRefs(extended.knowledgeRefs, found);
  }

  if (input.knowledgeRefsByResource) {
    for (const refs of input.knowledgeRefsByResource.values()) {
      collectLegacyIdsFromRefs(refs, found);
    }
  }

  // Card authoring Canonical field must not receive legacy graph IDs (#1271).
  for (const card of input.cards ?? []) {
    if (isLegacyLocalGraphNodeId(card.canonicalId)) {
      found.add(card.canonicalId);
    }
  }

  if (found.size > 0) {
    throw new LegacyGraphIdAuthoringError([...found].sort());
  }
}

/** Crosswalk remains readable even when it lists legacy IDs. */
export function readLegacyCrosswalkIds(
  entries: readonly LegacyIdCrosswalkEntry[],
): string[] {
  return [...new Set(entries.map((e) => e.legacyId))].sort();
}

/**
 * Normalize a human label for exact alias matching.
 * Lowercases ASCII, collapses whitespace/punctuation, preserves CJK.
 */
export function normalizeExactLabel(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/gu, '')
    .replace(/[·•.,，。:：;；!！?？"'“”‘’()（）[\]【】{}<>《》/\\|_+-]+/gu, '');
}
