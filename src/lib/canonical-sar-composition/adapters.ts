/**
 * Five explicit SAR source adapter contracts (#1114).
 *
 * Each adapter is a pure query boundary over one authority domain.
 * No adapter exposes write / mutation APIs.
 *
 * Adapter versionIdentity and hit versionRef MUST follow
 * `expectedSourceVersionClosure` in version-identity.ts.
 */

import {
  SAR_AUTHORITY_OWNERS,
  type SarCompositionScope,
  type SarCompositionVersionContext,
  type SarSourceAdapter,
  type SarSourceHit,
  type SarSourceNamespace,
  type SarSourceNeighborEdge,
  type SarSourceQueryResult,
} from './contracts';
import { isSarSupportedObjectType } from './semantics';
import { expectedSourceVersionClosure } from './version-identity';

export interface StaticSourceRecord {
  id: string;
  objectType: string;
  label: string;
  sourceIdentity: string;
  /** Optional in-source edges (Repository only). */
  neighborEdges?: readonly SarSourceNeighborEdge[];
  /**
   * Seed aliases that map to this record (e.g. canonicalId aliases).
   * Never used for same-name cross-namespace auto-binding.
   */
  seedAliases?: readonly string[];
}

function partitionHits(
  records: readonly StaticSourceRecord[],
  seedIds: readonly string[],
  budget: number,
  namespace: SarSourceNamespace,
  version: SarCompositionVersionContext,
): { hits: SarSourceHit[]; readOnlyContext: SarSourceHit[] } {
  const closed = expectedSourceVersionClosure(namespace, version);
  const seedSet = new Set(seedIds);
  const matched = records.filter((record) => {
    if (seedSet.has(record.id)) return true;
    return (record.seedAliases ?? []).some((alias) => seedSet.has(alias));
  });

  const hits: SarSourceHit[] = [];
  const readOnlyContext: SarSourceHit[] = [];

  for (const record of matched.slice(0, Math.max(budget, 0))) {
    const hit: SarSourceHit = {
      id: record.id,
      objectType: record.objectType,
      label: record.label,
      namespace,
      sourceIdentity: record.sourceIdentity,
      versionRef: closed.versionRef,
      releaseSetId: closed.releaseSetId,
      releaseId: closed.releaseId,
      overlayVersion: closed.overlayVersion,
      neighborEdges: record.neighborEdges,
    };
    if (isSarSupportedObjectType(record.objectType)) {
      hits.push(hit);
    } else {
      readOnlyContext.push(hit);
    }
  }
  return { hits, readOnlyContext };
}

/**
 * Create a pure static adapter for one namespace. Implementations never mutate
 * the underlying records array. versionIdentity is derived from the closed
 * mapping at construction time and must match every query's version context.
 */
export function createStaticSarSourceAdapter(input: {
  namespace: SarSourceNamespace;
  /** Closed composition version used to derive versionIdentity. */
  version: SarCompositionVersionContext;
  records: readonly StaticSourceRecord[];
}): SarSourceAdapter {
  const { namespace, version, records } = input;
  const closed = expectedSourceVersionClosure(namespace, version);
  const frozenRecords = records.map((record) => Object.freeze({ ...record }));

  return {
    namespace,
    authorityOwner: SAR_AUTHORITY_OWNERS[namespace],
    versionIdentity: closed.versionIdentity,
    query({ seedIds, budget, version: queryVersion }) {
      // Re-derive closed mapping from the query version; fail if adapter was
      // built against a different identity (composition validates equality).
      const queryClosed = expectedSourceVersionClosure(namespace, queryVersion);
      const { hits, readOnlyContext } = partitionHits(
        frozenRecords,
        seedIds,
        budget,
        namespace,
        queryVersion,
      );
      const result: SarSourceQueryResult = {
        namespace,
        authorityOwner: SAR_AUTHORITY_OWNERS[namespace],
        // Always report the query-time closed identity so validation binds to
        // the requested composition version, not a stale construction snapshot.
        versionIdentity: queryClosed.versionIdentity,
        hits,
        readOnlyContext,
        limitations: [],
      };
      return result;
    },
  };
}

/**
 * Build the five-source adapter set from independent record lists.
 * Each source versionIdentity is closed against the provided version context.
 */
export function createFiveSourceAdapterSet(input: {
  version: SarCompositionVersionContext;
  repository: { records: readonly StaticSourceRecord[] };
  kaq: { records: readonly StaticSourceRecord[] };
  resource: { records: readonly StaticSourceRecord[] };
  path: { records: readonly StaticSourceRecord[] };
  learnerState: { records: readonly StaticSourceRecord[] };
}): Readonly<Record<SarSourceNamespace, SarSourceAdapter>> {
  const { version } = input;
  return Object.freeze({
    repository: createStaticSarSourceAdapter({
      namespace: 'repository',
      version,
      records: input.repository.records,
    }),
    kaq: createStaticSarSourceAdapter({
      namespace: 'kaq',
      version,
      records: input.kaq.records,
    }),
    resource: createStaticSarSourceAdapter({
      namespace: 'resource',
      version,
      records: input.resource.records,
    }),
    path: createStaticSarSourceAdapter({
      namespace: 'path',
      version,
      records: input.path.records,
    }),
    'learner-state': createStaticSarSourceAdapter({
      namespace: 'learner-state',
      version,
      records: input.learnerState.records,
    }),
  });
}

/**
 * Assert adapter set covers all five namespaces exactly once.
 */
export function assertCompleteAdapterSet(
  adapters: Readonly<Record<SarSourceNamespace, SarSourceAdapter>>,
): void {
  const required: SarSourceNamespace[] = [
    'repository',
    'kaq',
    'resource',
    'path',
    'learner-state',
  ];
  for (const ns of required) {
    const adapter = adapters[ns];
    if (!adapter) {
      throw new Error(`SAR adapter set missing namespace ${ns}`);
    }
    if (adapter.namespace !== ns) {
      throw new Error(
        `SAR adapter namespace mismatch: expected ${ns}, got ${adapter.namespace}`,
      );
    }
    if (adapter.authorityOwner !== SAR_AUTHORITY_OWNERS[ns]) {
      throw new Error(
        `SAR adapter authorityOwner mismatch for ${ns}`,
      );
    }
    const anyAdapter = adapter as SarSourceAdapter & Record<string, unknown>;
    for (const forbidden of [
      'write',
      'mutate',
      'persist',
      'upsert',
      'delete',
      'save',
    ]) {
      if (typeof anyAdapter[forbidden] === 'function') {
        throw new Error(
          `SAR adapter ${ns} exposes forbidden mutation surface "${forbidden}"`,
        );
      }
    }
  }
}

/** Re-export helper types for fixture builders. */
export type { SarCompositionScope, SarCompositionVersionContext };
