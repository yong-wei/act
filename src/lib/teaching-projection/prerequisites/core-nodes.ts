/**
 * Core teaching-node denominator selection (#1270).
 *
 * Only formal objectives, primary COVERS, prerequisite endpoints, and
 * explicit teacher curation enter the core set. Upstream-only ActKG /
 * textbook mentions stay outside.
 */

import type { AuthorityNodeIndexEntry } from '../contracts';
import { projectionDigest } from '../hash';
import {
  ACT_TEACHING_CORE_NODES_CONTRACT,
  type CoreNodeAuthoringRow,
  type CoreNodeDenominatorInput,
  type CoreNodePublished,
  type CoreNodesAuthoringDocument,
  type CoreNodeSourceKind,
} from './contracts';

export class CoreNodeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CoreNodeError';
    this.code = code;
  }
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareCodePoint(keyFn(a), keyFn(b)));
}

function isUsableAuthority(
  node: AuthorityNodeIndexEntry | undefined,
): boolean {
  if (!node) return false;
  const lifecycle = String(node.lifecycleStatus ?? '').toLowerCase();
  return lifecycle === 'active' || lifecycle === '';
}

function authorityIndex(
  nodes: readonly AuthorityNodeIndexEntry[],
): Map<string, AuthorityNodeIndexEntry> {
  const map = new Map<string, AuthorityNodeIndexEntry>();
  for (const node of nodes) {
    map.set(node.canonicalId, node);
  }
  return map;
}

function assertNonEmpty(value: string | null | undefined, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CoreNodeError('schema-invalid', `${label} must be a non-empty string`);
  }
  return value;
}

/**
 * Normalize and validate one authoring core-node row.
 */
export function normalizeCoreNodeAuthoringRow(
  raw: CoreNodeAuthoringRow,
): CoreNodeAuthoringRow {
  const canonicalId = assertNonEmpty(raw.canonicalId, 'canonicalId');
  const scopeId = assertNonEmpty(raw.scopeId, 'scopeId');
  const rationale = assertNonEmpty(raw.rationale, 'rationale');
  if (raw.cardPolicy !== 'REQUIRED' && raw.cardPolicy !== 'OPTIONAL') {
    throw new CoreNodeError(
      'schema-invalid',
      `invalid cardPolicy for ${canonicalId}: ${String(raw.cardPolicy)}`,
    );
  }
  const sourceKinds: readonly string[] = [
    'OBJECTIVE',
    'PRIMARY_COVERS',
    'PREREQUISITE_ENDPOINT',
    'TEACHER_CURATION',
  ];
  if (!sourceKinds.includes(raw.sourceKind)) {
    throw new CoreNodeError(
      'schema-invalid',
      `invalid sourceKind for ${canonicalId}: ${String(raw.sourceKind)}`,
    );
  }
  if (!Array.isArray(raw.sourceEvidence) || raw.sourceEvidence.length === 0) {
    throw new CoreNodeError(
      'schema-invalid',
      `core-node ${canonicalId} requires at least one sourceEvidence entry`,
    );
  }
  return {
    canonicalId,
    scopeId,
    pathEligible: raw.pathEligible === true,
    cardPolicy: raw.cardPolicy,
    moduleId: raw.moduleId ?? null,
    rationale,
    sourceKind: raw.sourceKind as CoreNodeSourceKind,
    sourceEvidence: [...raw.sourceEvidence].map(String).sort(compareCodePoint),
  };
}

/**
 * Deterministically select the core-node denominator.
 *
 * Priority when the same Canonical ID is proposed from multiple sources
 * (highest wins): TEACHER_CURATION > OBJECTIVE > PRIMARY_COVERS > PREREQUISITE_ENDPOINT.
 * Full inventory rows (when provided) override generated skeleton fields for
 * the same ID while preserving the selected sourceKind priority.
 */
export function selectCoreNodeDenominator(
  input: CoreNodeDenominatorInput,
): CoreNodeAuthoringRow[] {
  const scopeId = assertNonEmpty(input.scopeId, 'scopeId');
  const index = authorityIndex(input.authorityNodes);
  const byId = new Map<string, CoreNodeAuthoringRow>();

  const sourceRank: Record<CoreNodeSourceKind, number> = {
    TEACHER_CURATION: 4,
    OBJECTIVE: 3,
    PRIMARY_COVERS: 2,
    PREREQUISITE_ENDPOINT: 1,
  };

  const put = (row: CoreNodeAuthoringRow): void => {
    const normalized = normalizeCoreNodeAuthoringRow({
      ...row,
      scopeId: row.scopeId || scopeId,
    });
    if (normalized.scopeId !== scopeId) {
      throw new CoreNodeError(
        'scope-mismatch',
        `core-node ${normalized.canonicalId} scope ${normalized.scopeId} != ${scopeId}`,
      );
    }
    if (!isUsableAuthority(index.get(normalized.canonicalId))) {
      throw new CoreNodeError(
        'invalid-endpoint',
        `core-node ${normalized.canonicalId} is not a usable Authority endpoint`,
      );
    }
    const existing = byId.get(normalized.canonicalId);
    if (!existing) {
      byId.set(normalized.canonicalId, normalized);
      return;
    }
    if (sourceRank[normalized.sourceKind] > sourceRank[existing.sourceKind]) {
      byId.set(normalized.canonicalId, {
        ...normalized,
        // Merge evidence from both proposals.
        sourceEvidence: [...new Set([
          ...existing.sourceEvidence,
          ...normalized.sourceEvidence,
        ])].sort(compareCodePoint),
      });
    } else {
      byId.set(normalized.canonicalId, {
        ...existing,
        sourceEvidence: [...new Set([
          ...existing.sourceEvidence,
          ...normalized.sourceEvidence,
        ])].sort(compareCodePoint),
      });
    }
  };

  for (const row of input.inventoryRows ?? []) {
    put(row);
  }

  for (const objective of input.objectives ?? []) {
    if (objective.scopeId && objective.scopeId !== scopeId) continue;
    put({
      canonicalId: objective.canonicalId,
      scopeId,
      pathEligible: true,
      cardPolicy: 'REQUIRED',
      moduleId: objective.moduleId ?? null,
      rationale: objective.rationale
        ?? `Formal course objective: ${objective.sourcePath}`,
      sourceKind: 'OBJECTIVE',
      sourceEvidence: [objective.sourcePath],
    });
  }

  for (const binding of input.bindings ?? []) {
    if (binding.scopeId !== scopeId) continue;
    if (binding.role !== 'COVERS' || binding.primary !== true) continue;
    put({
      canonicalId: binding.canonicalId,
      scopeId,
      pathEligible: true,
      cardPolicy: 'REQUIRED',
      moduleId: null,
      rationale: binding.rationale
        ?? `Primary COVERS binding on ${binding.resourceId}`,
      sourceKind: 'PRIMARY_COVERS',
      sourceEvidence: [
        binding.sourcePath
          ?? `binding:${binding.resourceId}:${binding.canonicalId}:COVERS`,
      ],
    });
  }

  for (const endpoint of input.prerequisiteEndpoints ?? []) {
    if (!endpoint || !isUsableAuthority(index.get(endpoint))) continue;
    // Endpoints alone do not invent path/card policy; skeleton only if new.
    if (byId.has(endpoint)) continue;
    put({
      canonicalId: endpoint,
      scopeId,
      pathEligible: true,
      cardPolicy: 'OPTIONAL',
      moduleId: null,
      rationale: 'Prerequisite edge endpoint included in core denominator',
      sourceKind: 'PREREQUISITE_ENDPOINT',
      sourceEvidence: [`prerequisite-endpoint:${endpoint}`],
    });
  }

  for (const curated of input.teacherCuration ?? []) {
    put({
      ...curated,
      scopeId: curated.scopeId || scopeId,
      sourceKind: 'TEACHER_CURATION',
    });
  }

  return sortBy([...byId.values()], (n) => n.canonicalId);
}

/**
 * Normalize and publish core nodes. Every row must belong to the build scope
 * and resolve to a usable Authority endpoint — unreferenced invalid cores fail
 * closed rather than relying on later edge endpoint checks.
 */
export function publishCoreNodes(
  rows: readonly CoreNodeAuthoringRow[],
  options: {
    scopeId: string;
    authorityNodes: readonly AuthorityNodeIndexEntry[];
  },
): CoreNodePublished[] {
  const scopeId = assertNonEmpty(options.scopeId, 'scopeId');
  const index = authorityIndex(options.authorityNodes);
  const seen = new Set<string>();
  const published: CoreNodePublished[] = [];
  for (const raw of rows) {
    const row = normalizeCoreNodeAuthoringRow(raw);
    if (seen.has(row.canonicalId)) {
      throw new CoreNodeError(
        'duplicate-core-node',
        `duplicate core-node ${row.canonicalId}`,
      );
    }
    if (row.scopeId !== scopeId) {
      throw new CoreNodeError(
        'scope-mismatch',
        `core-node ${row.canonicalId} scope ${row.scopeId} != ${scopeId}`,
      );
    }
    if (!isUsableAuthority(index.get(row.canonicalId))) {
      throw new CoreNodeError(
        'invalid-endpoint',
        `core-node ${row.canonicalId} is not a usable Authority endpoint`,
      );
    }
    seen.add(row.canonicalId);
    const body = {
      canonicalId: row.canonicalId,
      scopeId: row.scopeId,
      pathEligible: row.pathEligible,
      cardPolicy: row.cardPolicy,
      moduleId: row.moduleId ?? null,
      rationale: row.rationale,
      sourceKind: row.sourceKind,
      sourceEvidence: row.sourceEvidence,
    };
    published.push({
      ...body,
      nodeDigest: projectionDigest(body),
    });
  }
  return sortBy(published, (n) => n.canonicalId);
}

export function parseCoreNodesDocument(
  value: unknown,
): CoreNodesAuthoringDocument {
  if (!value || typeof value !== 'object') {
    throw new CoreNodeError('schema-invalid', 'core-nodes document must be an object');
  }
  const doc = value as Record<string, unknown>;
  if (doc.contract !== ACT_TEACHING_CORE_NODES_CONTRACT) {
    throw new CoreNodeError(
      'schema-invalid',
      `expected contract ${ACT_TEACHING_CORE_NODES_CONTRACT}`,
    );
  }
  const scopeId = assertNonEmpty(String(doc.scopeId ?? ''), 'scopeId');
  if (!Array.isArray(doc.nodes)) {
    throw new CoreNodeError('schema-invalid', 'nodes must be an array');
  }
  const nodes = (doc.nodes as CoreNodeAuthoringRow[]).map((row) =>
    normalizeCoreNodeAuthoringRow({ ...row, scopeId: row.scopeId || scopeId }),
  );
  return {
    contract: ACT_TEACHING_CORE_NODES_CONTRACT,
    scopeId,
    nodes: sortBy(nodes, (n) => n.canonicalId),
  };
}

/** Map published core nodes into projection authoring rows (lowercase cardPolicy). */
export function toProjectionCoreNodeAuthoring(
  nodes: readonly CoreNodePublished[],
): import('../contracts').TeachingCoreNodeAuthoring[] {
  return nodes.map((n) => ({
    canonicalId: n.canonicalId,
    pathEligible: n.pathEligible,
    cardPolicy:
      n.cardPolicy === 'REQUIRED'
        ? 'required'
        : n.cardPolicy === 'OPTIONAL'
          ? 'optional'
          : 'none',
    moduleId: n.moduleId,
    scopeId: n.scopeId,
    rationale: n.rationale,
  }));
}
