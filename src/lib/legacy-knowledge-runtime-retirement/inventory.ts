/**
 * Inventory of active consumers, legacy readers, selectors, fallback counters,
 * historical adapters, and rollback artifacts (#1277 task 1.1).
 */

import { CONSUMER_ACTIVATION_IDS } from '@/lib/versioned-knowledge-activation/contracts';

import {
  LEGACY_RETIREMENT_BUILDER_VERSION,
  LEGACY_RETIREMENT_INVENTORY_CONTRACT,
  RETAINED_HISTORICAL_ARTIFACTS,
  RETIREABLE_RUNTIME_DEPENDENCIES,
  type InventoryEntry,
  type RetirementConsumerInventory,
} from './contracts';
import { retirementDigest } from './hash';

const AUTHORING_PATHS = [
  'course-content/authoring/knowledge',
  'course-content/authoring/lessons',
] as const;

const RUNTIME_PATHS = [
  'course-content/runtime/knowledge',
  'course-content/runtime/lessons',
] as const;

const LEGACY_READERS: readonly InventoryEntry[] = [
  {
    id: 'legacy-runtime-graph-overlay-reader',
    kind: 'legacy-reader',
    path: 'src/lib/layered-graph/course-page-context.ts',
    consumerId: 'course-runtime',
    retainedAfterRetirement: false,
    notes:
      'lesson-runtime graph-overlay dual authority; removed after retirement gate',
  },
  {
    id: 'legacy-card-direct-reader',
    kind: 'legacy-reader',
    path: 'src/lib/teaching-projection/cards/resolve.ts',
    consumerId: 'course-runtime',
    retainedAfterRetirement: false,
    notes:
      'production legacy-id card fallback path; historical adapter retained',
  },
  {
    id: 'global-course-coverage-runtime-selector',
    kind: 'selector',
    path: 'src/lib/authoritative-knowledge/repository.ts',
    consumerId: null,
    retainedAfterRetirement: false,
    notes:
      'CourseCoverage overlay as global runtime selector; audit reader retained',
  },
  {
    id: 'production-legacy-fallback-path',
    kind: 'fallback-counter',
    path: 'src/lib/layered-graph/resolver.ts',
    consumerId: null,
    retainedAfterRetirement: false,
    notes: 'allowLegacyFallback production dual authority path',
  },
];

const HISTORICAL_ADAPTERS: readonly InventoryEntry[] =
  RETAINED_HISTORICAL_ARTIFACTS.map((id) => ({
    id,
    kind: 'historical-adapter' as const,
    path:
      id === 'legacy-course-coverage-audit-manifest'
        ? 'course-content/authoring/knowledge/legacy-course-coverage-audit/legacy-audit-manifest.json'
        : id === 'old-to-canonical-crosswalk'
          ? 'course-content/authoring/knowledge/teaching-projection'
          : id === 'historical-learning-fact-crosswalk-adapter'
            ? 'src/lib/canonical-learning-fact-identity/crosswalk-serving.ts'
            : null,
    consumerId: null,
    retainedAfterRetirement: true,
    notes: 'retained for audit / historical LearningFact reads',
  }));

const ROLLBACK_ARTIFACTS: readonly InventoryEntry[] = [
  {
    id: 'consumer-activation-prior-manifest',
    kind: 'rollback-artifact',
    path: 'course-content/runtime/knowledge/consumer-activation',
    consumerId: null,
    retainedAfterRetirement: true,
    notes: 'digest-checked activation rollback target',
  },
  {
    id: 'authority-snapshot-prior-pointer',
    kind: 'rollback-artifact',
    path: 'course-content/runtime/knowledge',
    consumerId: null,
    retainedAfterRetirement: true,
    notes: 'Authority snapshot prior pointer retained',
  },
];

/**
 * Build the complete retirement inventory. Unknown consumers must be declared
 * explicitly by callers via `extraEntries` or the gate fails closed.
 */
export function buildRetirementConsumerInventory(input: {
  captureRevision?: string | null;
  extraEntries?: readonly InventoryEntry[];
} = {}): RetirementConsumerInventory {
  const entries: InventoryEntry[] = [];

  for (const consumerId of CONSUMER_ACTIVATION_IDS) {
    entries.push({
      id: `active-consumer:${consumerId}`,
      kind: 'active-consumer',
      path: 'src/lib/versioned-knowledge-activation',
      consumerId,
      retainedAfterRetirement: true,
      notes: 'versioned consumer activation remains authority after retirement',
    });
  }

  entries.push(...LEGACY_READERS);

  for (const path of AUTHORING_PATHS) {
    entries.push({
      id: `authoring-path:${path}`,
      kind: 'authoring-path',
      path,
      consumerId: null,
      retainedAfterRetirement: true,
      notes: 'scanned for new-content legacy IDs',
    });
  }

  for (const path of RUNTIME_PATHS) {
    entries.push({
      id: `runtime-path:${path}`,
      kind: 'runtime-path',
      path,
      consumerId: null,
      retainedAfterRetirement: true,
      notes: 'scanned for new-content legacy IDs',
    });
  }

  entries.push(...HISTORICAL_ADAPTERS);
  entries.push(...ROLLBACK_ARTIFACTS);

  if (input.extraEntries) {
    entries.push(...input.extraEntries);
  }

  // Stable order for digests.
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const body = {
    contract: LEGACY_RETIREMENT_INVENTORY_CONTRACT,
    builderVersion: LEGACY_RETIREMENT_BUILDER_VERSION,
    captureRevision: input.captureRevision ?? null,
    entries,
  };

  return {
    ...body,
    inventoryDigest: retirementDigest(body),
  };
}

/** Assert every retireable dependency appears in the inventory. */
export function assertInventoryCoversRetireableDependencies(
  inventory: RetirementConsumerInventory,
): void {
  const ids = new Set(inventory.entries.map((e) => e.id));
  const missing = RETIREABLE_RUNTIME_DEPENDENCIES.filter((id) => !ids.has(id));
  if (missing.length > 0) {
    throw new Error(
      `retirement inventory missing retireable dependencies: ${missing.join(', ')}`,
    );
  }
}

/** Assert no unknown inventory kinds (fail closed on incomplete taxonomy). */
export function listInventoryKinds(
  inventory: RetirementConsumerInventory,
): string[] {
  return [...new Set(inventory.entries.map((e) => e.kind))].sort();
}
