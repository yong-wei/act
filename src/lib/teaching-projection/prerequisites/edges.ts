/**
 * ACT_TEACHING prerequisite edge validation, closure, and topology (#1270).
 */

import type { AuthorityNodeIndexEntry, PrerequisiteStrength } from '../contracts';
import { derivePrerequisiteId } from '../identity';
import { projectionDigest } from '../hash';
import {
  ACT_TEACHING_PREREQUISITE_EDGES_CONTRACT,
  PREREQUISITE_PUBLICATION_LAYER,
  PREREQUISITE_RELATION_TYPE,
  type CoreNodePublished,
  type PrerequisiteAuthorDecision,
  type PrerequisiteCandidateOrigin,
  type PrerequisiteEdgeAuthoring,
  type PrerequisiteEdgePublished,
  type PrerequisiteEdgeStatus,
  type PrerequisiteEdgesAuthoringDocument,
  type PrerequisiteGateFinding,
} from './contracts';
import { computeDecisionInputDigest } from './publication';

export class PrerequisiteEdgeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PrerequisiteEdgeError';
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

function assertNonEmpty(value: string | null | undefined, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PrerequisiteEdgeError(
      'schema-invalid',
      `${label} must be a non-empty string`,
    );
  }
  return value;
}

export function edgeIdentityKey(input: {
  sourceNodeId: string;
  targetNodeId: string;
  strength: PrerequisiteStrength;
  scopeId: string;
}): string {
  return [
    input.sourceNodeId,
    input.targetNodeId,
    input.strength,
    input.scopeId,
  ].join('\u001f');
}

export function deriveEdgeId(input: {
  sourceNodeId: string;
  targetNodeId: string;
  strength: PrerequisiteStrength;
  scopeId: string;
}): string {
  // Reuse projection prerequisite identity for compatibility.
  return derivePrerequisiteId({
    sourceCanonicalId: input.sourceNodeId,
    targetCanonicalId: input.targetNodeId,
    strength: input.strength,
    scopeId: input.scopeId,
  });
}

export function computeEdgeDigest(input: {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  strength: PrerequisiteStrength;
  scopeId: string;
  evidenceRefs: readonly string[];
  curatorId: string | null;
  curatorRationale: string | null;
  status: PrerequisiteEdgeStatus;
  authorDecisionId: string | null;
  authorityReleaseId: string;
  projectionCaptureId: string | null;
  authoringRevision: string;
}): string {
  return projectionDigest({
    edgeId: input.edgeId,
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    layer: PREREQUISITE_PUBLICATION_LAYER,
    relationType: PREREQUISITE_RELATION_TYPE,
    strength: input.strength,
    scopeId: input.scopeId,
    evidenceRefs: [...input.evidenceRefs].sort(compareCodePoint),
    curatorId: input.curatorId,
    curatorRationale: input.curatorRationale,
    status: input.status,
    authorDecisionId: input.authorDecisionId,
    authorityReleaseId: input.authorityReleaseId,
    projectionCaptureId: input.projectionCaptureId,
    authoringRevision: input.authoringRevision,
  });
}

function isUsableAuthority(
  node: AuthorityNodeIndexEntry | undefined,
): boolean {
  if (!node) return false;
  const lifecycle = String(node.lifecycleStatus ?? '').toLowerCase();
  return lifecycle === 'active' || lifecycle === '';
}

/**
 * Detect directed cycles among REQUIRED edges. Returns one cycle path each.
 */
export function detectRequiredCycles(
  edges: readonly { sourceNodeId: string; targetNodeId: string; strength: string }[],
): string[][] {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.strength !== 'REQUIRED') continue;
    const list = adj.get(edge.sourceNodeId) ?? [];
    list.push(edge.targetNodeId);
    adj.set(edge.sourceNodeId, list);
  }

  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): void {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      if (idx >= 0) cycles.push([...stack.slice(idx), node]);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const next of adj.get(node) ?? []) dfs(next);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of adj.keys()) dfs(node);
  return cycles;
}

/**
 * Kahn topological order; nodes sorted lexicographically for determinism
 * when multiple roots are available.
 */
export function topologicalOrder(
  edges: readonly { sourceNodeId: string; targetNodeId: string }[],
  nodeFilter?: ReadonlySet<string>,
): string[] {
  const nodes = new Set<string>();
  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const edge of edges) {
    if (nodeFilter && (!nodeFilter.has(edge.sourceNodeId) || !nodeFilter.has(edge.targetNodeId))) {
      continue;
    }
    nodes.add(edge.sourceNodeId);
    nodes.add(edge.targetNodeId);
    if (!indegree.has(edge.sourceNodeId)) indegree.set(edge.sourceNodeId, 0);
    if (!indegree.has(edge.targetNodeId)) indegree.set(edge.targetNodeId, 0);
    indegree.set(edge.targetNodeId, (indegree.get(edge.targetNodeId) ?? 0) + 1);
    const list = adj.get(edge.sourceNodeId) ?? [];
    list.push(edge.targetNodeId);
    adj.set(edge.sourceNodeId, list);
  }

  for (const [from, targets] of adj) {
    adj.set(from, [...targets].sort(compareCodePoint));
  }

  const ready = [...nodes]
    .filter((n) => (indegree.get(n) ?? 0) === 0)
    .sort(compareCodePoint);
  const order: string[] = [];

  while (ready.length > 0) {
    const node = ready.shift()!;
    order.push(node);
    for (const next of adj.get(node) ?? []) {
      const nextDeg = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDeg);
      if (nextDeg === 0) {
        ready.push(next);
        ready.sort(compareCodePoint);
      }
    }
  }

  if (order.length !== nodes.size) {
    throw new PrerequisiteEdgeError(
      'required-cycle',
      'cannot compute topological order: REQUIRED graph has a cycle',
    );
  }
  return order;
}

/**
 * Transitive closure for REQUIRED edges: source -> sorted reachable targets
 * (excluding self).
 */
export function requiredClosure(
  edges: readonly { sourceNodeId: string; targetNodeId: string; strength: string }[],
): Record<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.strength !== 'REQUIRED') continue;
    const list = adj.get(edge.sourceNodeId) ?? [];
    list.push(edge.targetNodeId);
    adj.set(edge.sourceNodeId, list);
  }

  const result: Record<string, string[]> = {};
  const nodes = new Set<string>();
  for (const [from, targets] of adj) {
    nodes.add(from);
    for (const t of targets) nodes.add(t);
  }

  for (const start of [...nodes].sort(compareCodePoint)) {
    const reached = new Set<string>();
    const stack = [...(adj.get(start) ?? [])];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (reached.has(cur) || cur === start) continue;
      reached.add(cur);
      for (const next of adj.get(cur) ?? []) {
        if (!reached.has(next)) stack.push(next);
      }
    }
    result[start] = [...reached].sort(compareCodePoint);
  }
  return result;
}

export interface EdgeValidationContext {
  scopeId: string;
  coreNodes: readonly CoreNodePublished[];
  authorityNodes: readonly AuthorityNodeIndexEntry[];
  decisions: readonly PrerequisiteAuthorDecision[];
  authorityReleaseId: string;
  projectionCaptureId: string | null;
  authoringRevision: string;
}

/**
 * Validate authoring edges and materialize published / review rows.
 * Does not throw on gate-level issues — returns findings for fail-closed gate.
 */
export function materializePrerequisiteEdges(
  edges: readonly PrerequisiteEdgeAuthoring[],
  ctx: EdgeValidationContext,
): {
  edges: PrerequisiteEdgePublished[];
  findings: PrerequisiteGateFinding[];
} {
  const findings: PrerequisiteGateFinding[] = [];
  const coreById = new Map(ctx.coreNodes.map((n) => [n.canonicalId, n]));
  const authorityById = new Map(
    ctx.authorityNodes.map((n) => [n.canonicalId, n]),
  );
  const decisionsById = new Map(ctx.decisions.map((d) => [d.decisionId, d]));
  const seenIds = new Set<string>();
  const seenIdentity = new Set<string>();
  const published: PrerequisiteEdgePublished[] = [];

  for (const raw of edges) {
    if (raw.strength !== 'REQUIRED' && raw.strength !== 'RECOMMENDED') {
      findings.push({
        code: 'schema-invalid',
        severity: 'error',
        message: `invalid strength: ${String(raw.strength)}`,
      });
      continue;
    }

    if (
      typeof raw.sourceNodeId !== 'string'
      || raw.sourceNodeId.trim().length === 0
      || typeof raw.targetNodeId !== 'string'
      || raw.targetNodeId.trim().length === 0
    ) {
      findings.push({
        code: 'schema-invalid',
        severity: 'error',
        message: 'sourceNodeId and targetNodeId must be non-empty',
      });
      continue;
    }

    const sourceNodeId = raw.sourceNodeId.trim();
    const targetNodeId = raw.targetNodeId.trim();
    const scopeId = (raw.scopeId || ctx.scopeId).trim();
    if (!scopeId) {
      findings.push({
        code: 'schema-invalid',
        severity: 'error',
        message: 'scopeId must be non-empty',
      });
      continue;
    }
    const edgeId =
      raw.edgeId
      ?? deriveEdgeId({
        sourceNodeId,
        targetNodeId,
        strength: raw.strength,
        scopeId,
      });

    if (seenIds.has(edgeId)) {
      findings.push({
        code: 'duplicate-edge',
        severity: 'error',
        message: `duplicate edge id ${edgeId}`,
        edgeId,
      });
      continue;
    }
    seenIds.add(edgeId);

    const identity = edgeIdentityKey({
      sourceNodeId,
      targetNodeId,
      strength: raw.strength,
      scopeId,
    });
    if (seenIdentity.has(identity)) {
      findings.push({
        code: 'duplicate-edge-identity',
        severity: 'error',
        message: `duplicate edge identity ${sourceNodeId} -> ${targetNodeId} (${raw.strength})`,
        edgeId,
      });
      continue;
    }
    seenIdentity.add(identity);

    if (scopeId !== ctx.scopeId) {
      findings.push({
        code: 'scope-mismatch',
        severity: 'error',
        message: `edge ${edgeId} scope ${scopeId} != build scope ${ctx.scopeId}`,
        edgeId,
      });
    }

    if (sourceNodeId === targetNodeId) {
      findings.push({
        code: 'self-loop',
        severity: 'error',
        message: `edge ${edgeId} is a self-loop on ${sourceNodeId}`,
        edgeId,
        canonicalId: sourceNodeId,
      });
    }

    for (const endpointId of [sourceNodeId, targetNodeId]) {
      if (!isUsableAuthority(authorityById.get(endpointId))) {
        findings.push({
          code: 'dangling-endpoint',
          severity: 'error',
          message: `edge ${edgeId} has invalid Authority endpoint ${endpointId}`,
          edgeId,
          canonicalId: endpointId,
        });
      }
      const core = coreById.get(endpointId);
      if (!core) {
        findings.push({
          code: 'endpoint-not-core',
          severity: 'error',
          message: `edge ${edgeId} endpoint ${endpointId} is outside the core-node denominator`,
          edgeId,
          canonicalId: endpointId,
        });
      } else if (core.scopeId !== scopeId) {
        findings.push({
          code: 'scope-mismatch',
          severity: 'error',
          message: `edge ${edgeId} endpoint ${endpointId} core scope mismatch`,
          edgeId,
          canonicalId: endpointId,
        });
      }
    }

    const evidenceRefs = [...(raw.evidenceRefs ?? [])]
      .map(String)
      .filter((s) => s.trim().length > 0)
      .sort(compareCodePoint);
    const curatorRationale =
      typeof raw.curatorRationale === 'string' && raw.curatorRationale.trim().length > 0
        ? raw.curatorRationale.trim()
        : null;
    const curatorId =
      typeof raw.curatorId === 'string' && raw.curatorId.trim().length > 0
        ? raw.curatorId.trim()
        : null;
    const authorDecisionId =
      typeof raw.authorDecisionId === 'string' && raw.authorDecisionId.trim().length > 0
        ? raw.authorDecisionId.trim()
        : null;

    let status: PrerequisiteEdgeStatus = raw.status ?? 'CANDIDATE';
    if (status === 'PUBLISHED') {
      if (evidenceRefs.length === 0 && !curatorRationale) {
        findings.push({
          code: 'missing-evidence',
          severity: 'error',
          message: `published edge ${edgeId} requires evidenceRefs or curatorRationale`,
          edgeId,
        });
        status = 'REVIEW_REQUIRED';
      }
      if (!authorDecisionId) {
        findings.push({
          code: 'missing-author-decision',
          severity: 'error',
          message: `published edge ${edgeId} requires authorDecisionId`,
          edgeId,
        });
        status = 'REVIEW_REQUIRED';
      } else {
        const decision = decisionsById.get(authorDecisionId);
        if (!decision) {
          findings.push({
            code: 'missing-author-decision',
            severity: 'error',
            message: `published edge ${edgeId} references unknown decision ${authorDecisionId}`,
            edgeId,
          });
          status = 'REVIEW_REQUIRED';
        } else {
          const expectedEdgeKey = edgeIdentityKey({
            sourceNodeId,
            targetNodeId,
            strength: raw.strength,
            scopeId,
          });
          const expectedInputDigest = computeDecisionInputDigest({
            sourceNodeId,
            targetNodeId,
            strength: raw.strength,
            scopeId,
            evidenceRefs,
            curatorRationale,
          });
          if (
            decision.edgeKey !== expectedEdgeKey
            || decision.scopeId !== scopeId
            || decision.inputDigest !== expectedInputDigest
          ) {
            findings.push({
              code: 'decision-binding-mismatch',
              severity: 'error',
              message:
                `edge ${edgeId} authorDecision ${authorDecisionId} is not bound to this edge `
                + `(edgeKey/scopeId/inputDigest must match recomputed edge evidence)`,
              edgeId,
            });
            status = 'REVIEW_REQUIRED';
          }
          if (decision.authorityReleaseId !== ctx.authorityReleaseId) {
            findings.push({
              code: 'capture-drift',
              severity: 'error',
              message: `edge ${edgeId} decision Authority ${decision.authorityReleaseId} != ${ctx.authorityReleaseId}`,
              edgeId,
            });
            status = 'STALE';
          }
          if (
            (decision.projectionCaptureId ?? null)
            !== (ctx.projectionCaptureId ?? null)
          ) {
            findings.push({
              code: 'capture-drift',
              severity: 'error',
              message: `edge ${edgeId} decision projection capture drifted`,
              edgeId,
            });
            status = 'STALE';
          }
          if (decision.authoringRevision !== ctx.authoringRevision) {
            // Authoring revision drift marks STALE for re-review; not a hard
            // identity failure of the decision id itself.
            findings.push({
              code: 'authoring-revision-drift',
              severity: 'warning',
              message: `edge ${edgeId} decision authoring revision differs from build`,
              edgeId,
            });
          }
        }
      }
    }

    const edgeDigest = computeEdgeDigest({
      edgeId,
      sourceNodeId,
      targetNodeId,
      strength: raw.strength,
      scopeId,
      evidenceRefs,
      curatorId,
      curatorRationale,
      status,
      authorDecisionId,
      authorityReleaseId: ctx.authorityReleaseId,
      projectionCaptureId: ctx.projectionCaptureId,
      authoringRevision: ctx.authoringRevision,
    });

    published.push({
      edgeId,
      sourceNodeId,
      targetNodeId,
      layer: PREREQUISITE_PUBLICATION_LAYER,
      relationType: PREREQUISITE_RELATION_TYPE,
      strength: raw.strength,
      scopeId,
      evidenceRefs,
      curatorId,
      curatorRationale,
      status,
      authorDecisionId,
      candidateOrigin: (raw.candidateOrigin ?? null) as PrerequisiteCandidateOrigin | null,
      edgeDigest,
      authorityReleaseId: ctx.authorityReleaseId,
      projectionCaptureId: ctx.projectionCaptureId,
      authoringRevision: ctx.authoringRevision,
    });
  }

  // REQUIRED cycle detection only over PUBLISHED edges (candidates must not
  // block publication or enter the hard-dependency graph).
  const cycleSources = published.filter(
    (e) =>
      e.sourceNodeId !== e.targetNodeId
      && e.status === 'PUBLISHED',
  );
  for (const cycle of detectRequiredCycles(cycleSources)) {
    findings.push({
      code: 'required-cycle',
      severity: 'error',
      message: `REQUIRED prerequisite cycle: ${cycle.join(' -> ')}`,
    });
  }

  return {
    edges: sortBy(published, (e) => e.edgeId),
    findings,
  };
}

export function parseEdgesDocument(
  value: unknown,
): PrerequisiteEdgesAuthoringDocument {
  if (!value || typeof value !== 'object') {
    throw new PrerequisiteEdgeError(
      'schema-invalid',
      'edges document must be an object',
    );
  }
  const doc = value as Record<string, unknown>;
  if (doc.contract !== ACT_TEACHING_PREREQUISITE_EDGES_CONTRACT) {
    throw new PrerequisiteEdgeError(
      'schema-invalid',
      `expected contract ${ACT_TEACHING_PREREQUISITE_EDGES_CONTRACT}`,
    );
  }
  const scopeId = assertNonEmpty(String(doc.scopeId ?? ''), 'scopeId');
  if (!Array.isArray(doc.edges)) {
    throw new PrerequisiteEdgeError('schema-invalid', 'edges must be an array');
  }
  return {
    contract: ACT_TEACHING_PREREQUISITE_EDGES_CONTRACT,
    scopeId,
    edges: doc.edges as PrerequisiteEdgeAuthoring[],
  };
}

/** Export only PUBLISHED edges into projection prerequisite authoring. */
export function toProjectionPrerequisiteAuthoring(
  edges: readonly PrerequisiteEdgePublished[],
): import('../contracts').TeachingPrerequisiteAuthoring[] {
  return edges
    .filter((e) => e.status === 'PUBLISHED')
    .map((e) => ({
      prerequisiteId: e.edgeId,
      sourceCanonicalId: e.sourceNodeId,
      targetCanonicalId: e.targetNodeId,
      strength: e.strength,
      evidenceRef: e.evidenceRefs[0] ?? null,
      rationale: e.curatorRationale,
      scopeId: e.scopeId,
    }));
}
