/**
 * Author semantic decisions for ambiguous/split/merge mappings (#1268).
 *
 * One decision per resource+scope+inputDigest; repeated builds reuse it
 * deterministically when the input digest matches.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { projectionDigest } from './hash';
import {
  AUTHOR_SEMANTIC_DECISION_CONTRACT,
  type AuthorDecisionKind,
  type AuthorSemanticDecision,
  type TeachingKnowledgeRefAuthoring,
} from './migration-contracts';
import { isTeachingProjectionRole } from './identity';

export class AuthorDecisionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthorDecisionError';
    this.code = code;
  }
}

export function createAuthorSemanticDecision(input: {
  resourceId: string;
  scopeId: string;
  inputDigest: string;
  kind: AuthorDecisionKind;
  rationale: string;
  bindings?: TeachingKnowledgeRefAuthoring[];
  decisionId?: string;
  decidedAt?: string | null;
}): AuthorSemanticDecision {
  if (!input.resourceId || !input.scopeId || !input.inputDigest) {
    throw new AuthorDecisionError(
      'schema-invalid',
      'resourceId, scopeId, and inputDigest are required',
    );
  }
  if (!input.rationale || input.rationale.trim().length === 0) {
    throw new AuthorDecisionError('schema-invalid', 'rationale is required');
  }

  if (input.kind === 'BIND' || input.kind === 'SPLIT' || input.kind === 'MERGE') {
    const bindings = input.bindings ?? [];
    if (bindings.length === 0) {
      throw new AuthorDecisionError(
        'schema-invalid',
        `${input.kind} decision requires at least one binding`,
      );
    }
    for (const b of bindings) {
      if (!b.canonicalId || !isTeachingProjectionRole(b.role)) {
        throw new AuthorDecisionError(
          'schema-invalid',
          `invalid binding in decision: ${JSON.stringify(b)}`,
        );
      }
    }
  }

  if (input.kind === 'EXPLICIT_NONE' && (input.bindings?.length ?? 0) > 0) {
    throw new AuthorDecisionError(
      'schema-invalid',
      'EXPLICIT_NONE decision must not carry bindings',
    );
  }

  const decisionId =
    input.decisionId
    ?? `decision:${projectionDigest({
      resourceId: input.resourceId,
      scopeId: input.scopeId,
      inputDigest: input.inputDigest,
      kind: input.kind,
    }).slice(0, 16)}`;

  return {
    contract: AUTHOR_SEMANTIC_DECISION_CONTRACT,
    decisionId,
    resourceId: input.resourceId,
    scopeId: input.scopeId,
    kind: input.kind,
    inputDigest: input.inputDigest,
    bindings: input.kind === 'EXPLICIT_NONE' ? [] : (input.bindings ?? []),
    rationale: input.rationale,
    decidedAt: input.decidedAt ?? null,
  };
}

/** Index decisions for O(1) lookup by resource+scope+inputDigest. */
export function indexAuthorDecisions(
  decisions: readonly AuthorSemanticDecision[],
): Map<string, AuthorSemanticDecision> {
  const map = new Map<string, AuthorSemanticDecision>();
  for (const d of decisions) {
    const key = decisionLookupKey(d.resourceId, d.scopeId, d.inputDigest);
    if (map.has(key)) {
      throw new AuthorDecisionError(
        'duplicate-decision',
        `duplicate author decision for ${key}`,
      );
    }
    map.set(key, d);
  }
  return map;
}

export function decisionLookupKey(
  resourceId: string,
  scopeId: string,
  inputDigest: string,
): string {
  return `${resourceId}\u001f${scopeId}\u001f${inputDigest}`;
}

export function selectAuthorDecision(
  decisions: readonly AuthorSemanticDecision[],
  resourceId: string,
  scopeId: string,
  inputDigest: string,
): AuthorSemanticDecision | null {
  const matches = decisions.filter(
    (d) =>
      d.resourceId === resourceId
      && d.scopeId === scopeId
      && d.inputDigest === inputDigest,
  );
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new AuthorDecisionError(
      'duplicate-decision',
      `multiple author decisions for ${resourceId} @ ${scopeId}`,
    );
  }
  return matches[0]!;
}

/** Parse JSON array or JSONL decision files. */
export function parseAuthorDecisionDocument(raw: string): AuthorSemanticDecision[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      throw new AuthorDecisionError('schema-invalid', 'decision document must be an array');
    }
    return parsed.map(normalizeDecision);
  }

  const rows: AuthorSemanticDecision[] = [];
  for (const line of trimmed.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    rows.push(normalizeDecision(JSON.parse(t)));
  }
  return rows;
}

function normalizeDecision(value: unknown): AuthorSemanticDecision {
  if (!value || typeof value !== 'object') {
    throw new AuthorDecisionError('schema-invalid', 'decision row must be an object');
  }
  const row = value as Record<string, unknown>;
  return createAuthorSemanticDecision({
    decisionId: typeof row.decisionId === 'string' ? row.decisionId : undefined,
    resourceId: String(row.resourceId ?? ''),
    scopeId: String(row.scopeId ?? ''),
    inputDigest: String(row.inputDigest ?? ''),
    kind: row.kind as AuthorDecisionKind,
    rationale: String(row.rationale ?? ''),
    bindings: Array.isArray(row.bindings)
      ? (row.bindings as TeachingKnowledgeRefAuthoring[])
      : undefined,
    decidedAt: typeof row.decidedAt === 'string' ? row.decidedAt : null,
  });
}

export function loadAuthorDecisionsFromFile(filePath: string): AuthorSemanticDecision[] {
  if (!existsSync(filePath)) return [];
  return parseAuthorDecisionDocument(readFileSync(filePath, 'utf8'));
}

export function writeAuthorDecisionsJsonl(
  filePath: string,
  decisions: readonly AuthorSemanticDecision[],
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const sorted = [...decisions].sort((a, b) =>
    a.decisionId < b.decisionId ? -1 : a.decisionId > b.decisionId ? 1 : 0,
  );
  const body = `${sorted.map((d) => JSON.stringify(d)).join('\n')}${sorted.length ? '\n' : ''}`;
  writeFileSync(filePath, body, 'utf8');
}

export function defaultAuthorDecisionsPath(authoringRoot: string): string {
  return join(authoringRoot, 'decisions', 'author-semantic-decisions.jsonl');
}

/**
 * Merge a new decision, replacing any prior decision for the same
 * resource+scope+inputDigest. Returns the full set for persistence.
 */
export function upsertAuthorDecision(
  existing: readonly AuthorSemanticDecision[],
  next: AuthorSemanticDecision,
): AuthorSemanticDecision[] {
  const key = decisionLookupKey(next.resourceId, next.scopeId, next.inputDigest);
  const kept = existing.filter(
    (d) => decisionLookupKey(d.resourceId, d.scopeId, d.inputDigest) !== key,
  );
  return [...kept, next].sort((a, b) =>
    a.decisionId < b.decisionId ? -1 : a.decisionId > b.decisionId ? 1 : 0,
  );
}
