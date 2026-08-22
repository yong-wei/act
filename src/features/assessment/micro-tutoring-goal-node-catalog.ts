import { createHash } from 'node:crypto';

import {
  AUTOCONTROL_KAQ_GRAPH_CATALOG,
  AUTOCONTROL_KAQ_GRAPH_VERSION,
} from '@/lib/data-governance/autocontrol-kaq-graph-catalog';
import { microTutoringOptionAttributionReviewSourceHash } from './micro-tutoring-option-attribution-evidence';
import { loadMicroTutoringRuntimeSource } from './micro-tutoring-runtime-source';

export const MICRO_TUTORING_GOAL_NODE_CATALOG_VERSION = 'micro-tutoring-goal-node-catalog.v1';
export const MICRO_TUTORING_GOAL_NODE_BASELINE_VERSION = 'micro-tutoring-practice-baseline.v1';

export type MicroTutoringGoalNodeCatalogIssueCode =
  | 'CATALOG_MALFORMED'
  | 'VERSION_DRIFT'
  | 'SOURCE_DRIFT'
  | 'DUPLICATE_GOAL'
  | 'ALIAS_CONFLICT'
  | 'NODE_DOMAIN_INVALID'
  | 'NODE_UNAVAILABLE';

export interface MicroTutoringGoalNodeCatalogEntry {
  learningGoalId: string;
  aliases: string[];
  knowledgeNodeId: string;
  catalogVersion: string;
  graphVersion: string;
  sourceRefs: string[];
  enabled: boolean;
}

export interface MicroTutoringGoalNodeCatalog {
  version: string;
  baselineVersion: string;
  graphVersion: string;
  source: string;
  entries: MicroTutoringGoalNodeCatalogEntry[];
}

export interface MicroTutoringGoalNodeCatalogIssue {
  code: MicroTutoringGoalNodeCatalogIssueCode;
  ref: string;
}

export interface LoadedMicroTutoringGoalNodeCatalog {
  catalog: MicroTutoringGoalNodeCatalog | null;
  issues: MicroTutoringGoalNodeCatalogIssue[];
}

export interface MicroTutoringGoalNodeSourceContext {
  practiceBaseline: unknown;
  optionAttributions: unknown;
}

export type MicroTutoringGoalNodeResolution =
  | {
    ok: true;
    learningGoalId: string;
    knowledgeNodeId: string;
    catalogVersion: string;
    source: string;
    sourceRefs: string[];
    resolvedBy: 'canonical' | 'alias';
  }
  | {
    ok: false;
    reason: 'CATALOG_INVALID' | 'GOAL_UNKNOWN' | 'GOAL_DISABLED';
  };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sameStrings(left: string[], right: string[]): boolean {
  const normalizedLeft = [...new Set(left)].sort();
  const normalizedRight = [...new Set(right)].sort();
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function governedSourceRefs(
  learningGoalId: string,
  baselineVersion: string,
  attributionVersion: string,
  bindings: string[],
): string[] {
  const digest = createHash('sha256').update([...bindings].sort().join('\n')).digest('hex');
  return [
    `${baselineVersion}+${attributionVersion}#goal:${learningGoalId}#sha256:${digest}`,
  ];
}

export function loadMicroTutoringGoalNodeCatalog(
  source: unknown = loadMicroTutoringRuntimeSource('micro-tutoring-goal-node-catalog.json'),
  sourceContext: MicroTutoringGoalNodeSourceContext = {
    practiceBaseline: loadMicroTutoringRuntimeSource('micro-tutoring-practice-baseline.json'),
    optionAttributions: loadMicroTutoringRuntimeSource('micro-tutoring-option-attributions.json'),
  },
): LoadedMicroTutoringGoalNodeCatalog {
  const value = record(source);
  const issues: MicroTutoringGoalNodeCatalogIssue[] = [];
  if (
    !value ||
    !nonEmptyString(value.version) ||
    !nonEmptyString(value.baselineVersion) ||
    !nonEmptyString(value.graphVersion) ||
    !nonEmptyString(value.source) ||
    !Array.isArray(value.entries)
  ) {
    return { catalog: null, issues: [{ code: 'CATALOG_MALFORMED', ref: 'catalog' }] };
  }
  if (value.version !== MICRO_TUTORING_GOAL_NODE_CATALOG_VERSION) {
    issues.push({ code: 'VERSION_DRIFT', ref: String(value.version) });
  }
  if (value.baselineVersion !== MICRO_TUTORING_GOAL_NODE_BASELINE_VERSION) {
    issues.push({ code: 'SOURCE_DRIFT', ref: String(value.baselineVersion) });
  }
  if (value.graphVersion !== AUTOCONTROL_KAQ_GRAPH_VERSION) {
    issues.push({ code: 'VERSION_DRIFT', ref: String(value.graphVersion) });
  }
  const baseline = record(sourceContext.practiceBaseline);
  const attributionSource = record(sourceContext.optionAttributions);
  const baselineEntries = Array.isArray(baseline?.entries) ? baseline.entries.map(record) : [];
  const attributionEntries = Array.isArray(attributionSource?.entries)
    ? attributionSource.entries.map(record)
    : [];
  const baselineByCatalogItemId = new Map(baselineEntries.flatMap((entry) =>
    nonEmptyString(entry?.catalogItemId) && /^[a-f0-9]{64}$/.test(String(entry.contentHash ?? ''))
      ? [[entry.catalogItemId, String(entry.contentHash)]] as const
      : []));
  const attributionsByCatalogItemId = new Map<string, Record<string, unknown>[]>();
  for (const entry of attributionEntries) {
    if (!entry || !nonEmptyString(entry.catalogItemId)) continue;
    const records = attributionsByCatalogItemId.get(entry.catalogItemId) ?? [];
    records.push(entry);
    attributionsByCatalogItemId.set(entry.catalogItemId, records);
  }
  const bindingsByGoalId = new Map<string, string[]>();
  const knowledgeNodesByGoalId = new Map<string, Set<string>>();
  for (const [catalogItemId, contentHash] of baselineByCatalogItemId) {
    const records = attributionsByCatalogItemId.get(catalogItemId) ?? [];
    const validRecords = records.filter((entry) =>
      entry.contentHash === contentHash &&
      nonEmptyString(entry.optionKey) &&
      nonEmptyString(entry.learningGoalId) &&
      nonEmptyString(entry.knowledgeNodeId) &&
      /^sha256:[a-f0-9]{64}$/.test(String(entry.itemReviewSourceHash ?? '')) &&
      entry.reviewSourceHash === microTutoringOptionAttributionReviewSourceHash(entry));
    const learningGoalIds = new Set(validRecords.map((entry) => String(entry.learningGoalId)));
    const knowledgeNodeIds = new Set(validRecords.map((entry) => String(entry.knowledgeNodeId)));
    const itemReviewSourceHashes = new Set(validRecords.map((entry) => String(entry.itemReviewSourceHash)));
    const optionKeys = new Set(validRecords.map((entry) => String(entry.optionKey)));
    if (
      records.length !== 2 ||
      validRecords.length !== 2 ||
      learningGoalIds.size !== 1 ||
      knowledgeNodeIds.size !== 1 ||
      itemReviewSourceHashes.size !== 1 ||
      optionKeys.size !== 2
    ) continue;
    const [learningGoalId] = learningGoalIds;
    const [itemReviewSourceHash] = itemReviewSourceHashes;
    const bindings = bindingsByGoalId.get(learningGoalId) ?? [];
    const [knowledgeNodeId] = knowledgeNodeIds;
    bindings.push(`${catalogItemId}\0${contentHash}\0${itemReviewSourceHash}\0${knowledgeNodeId}`);
    bindingsByGoalId.set(learningGoalId, bindings);
    const governedNodes = knowledgeNodesByGoalId.get(learningGoalId) ?? new Set<string>();
    governedNodes.add(knowledgeNodeId);
    knowledgeNodesByGoalId.set(learningGoalId, governedNodes);
  }
  const attributionVersion = nonEmptyString(attributionSource?.version)
    ? attributionSource.version
    : '';
  if (
    baseline?.version !== value.baselineVersion ||
    attributionVersion !== value.source ||
    baselineEntries.length === 0 ||
    attributionEntries.length === 0
  ) {
    issues.push({ code: 'SOURCE_DRIFT', ref: 'catalog-source' });
  }

  const entries: MicroTutoringGoalNodeCatalogEntry[] = [];
  const identities = new Map<string, string>();
  for (const rawEntry of value.entries) {
    const entry = record(rawEntry);
    if (
      !entry ||
      !nonEmptyString(entry.learningGoalId) ||
      !nonEmptyString(entry.knowledgeNodeId) ||
      !nonEmptyString(entry.catalogVersion) ||
      !nonEmptyString(entry.graphVersion) ||
      typeof entry.enabled !== 'boolean' ||
      !Array.isArray(entry.aliases) ||
      !entry.aliases.every(nonEmptyString) ||
      !Array.isArray(entry.sourceRefs) ||
      entry.sourceRefs.length === 0 ||
      !entry.sourceRefs.every(nonEmptyString)
    ) {
      issues.push({ code: 'CATALOG_MALFORMED', ref: `entry:${entries.length}` });
      continue;
    }
    const normalized: MicroTutoringGoalNodeCatalogEntry = {
      learningGoalId: entry.learningGoalId,
      aliases: [...entry.aliases],
      knowledgeNodeId: entry.knowledgeNodeId,
      catalogVersion: entry.catalogVersion,
      graphVersion: entry.graphVersion,
      sourceRefs: [...entry.sourceRefs],
      enabled: entry.enabled,
    };
    if (normalized.catalogVersion !== value.version || normalized.graphVersion !== value.graphVersion) {
      issues.push({ code: 'VERSION_DRIFT', ref: normalized.learningGoalId });
    }
    if (
      !bindingsByGoalId.has(normalized.learningGoalId) ||
      knowledgeNodesByGoalId.get(normalized.learningGoalId)?.size !== 1 ||
      !knowledgeNodesByGoalId.get(normalized.learningGoalId)?.has(normalized.knowledgeNodeId) ||
      !sameStrings(normalized.sourceRefs, governedSourceRefs(
        normalized.learningGoalId,
        String(value.baselineVersion),
        attributionVersion,
        bindingsByGoalId.get(normalized.learningGoalId) ?? [],
      ))
    ) {
      issues.push({ code: 'SOURCE_DRIFT', ref: normalized.learningGoalId });
    }
    const node = AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.find((candidate) =>
      candidate.id === normalized.knowledgeNodeId);
    if (!normalized.knowledgeNodeId.startsWith('kn:') || node?.domain !== 'knowledge') {
      issues.push({ code: 'NODE_DOMAIN_INVALID', ref: normalized.knowledgeNodeId });
    } else if (node.status !== 'active') {
      issues.push({ code: 'NODE_UNAVAILABLE', ref: normalized.knowledgeNodeId });
    }
    for (const identity of [normalized.learningGoalId, ...normalized.aliases]) {
      const owner = identities.get(identity);
      if (owner) {
        issues.push({
          code: identity === normalized.learningGoalId && owner === identity
            ? 'DUPLICATE_GOAL'
            : 'ALIAS_CONFLICT',
          ref: identity,
        });
      } else {
        identities.set(identity, normalized.learningGoalId);
      }
    }
    entries.push(normalized);
  }
  return {
    catalog: {
      version: value.version,
      baselineVersion: value.baselineVersion,
      graphVersion: value.graphVersion,
      source: value.source,
      entries,
    },
    issues,
  };
}

export function resolveMicroTutoringGoalNode(
  learningGoalIdOrAlias: string,
  loaded: LoadedMicroTutoringGoalNodeCatalog = loadMicroTutoringGoalNodeCatalog(),
): MicroTutoringGoalNodeResolution {
  if (!loaded.catalog || loaded.issues.length > 0) return { ok: false, reason: 'CATALOG_INVALID' };
  const canonical = loaded.catalog.entries.find((entry) => entry.learningGoalId === learningGoalIdOrAlias);
  const entry = canonical ?? loaded.catalog.entries.find((candidate) =>
    candidate.aliases.includes(learningGoalIdOrAlias));
  if (!entry) return { ok: false, reason: 'GOAL_UNKNOWN' };
  if (!entry.enabled) return { ok: false, reason: 'GOAL_DISABLED' };
  return {
    ok: true,
    learningGoalId: entry.learningGoalId,
    knowledgeNodeId: entry.knowledgeNodeId,
    catalogVersion: loaded.catalog.version,
    source: loaded.catalog.source,
    sourceRefs: [...entry.sourceRefs],
    resolvedBy: canonical ? 'canonical' : 'alias',
  };
}
