/**
 * Prerequisite candidate origins that never auto-publish (#1270).
 *
 * Engineering relations, textbook order, lesson order, legacy graph edges,
 * handout language, interactive metadata, model similarity, and teacher
 * proposals may create candidates only. Publication still requires one ACT
 * evidence reference or teacher-curation rationale plus one author decision.
 */

import { getKnowledgeGraphRelationContract } from '@/features/knowledge/graph/relation-contract';

import { projectionDigest } from '../hash';
import {
  type PrerequisiteCandidateOrigin,
  type PrerequisiteCandidateRecord,
  type PrerequisiteStrength,
} from './contracts';

export class PrerequisiteCandidateError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PrerequisiteCandidateError';
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

export function deriveCandidateId(input: {
  sourceNodeId: string;
  targetNodeId: string;
  origin: PrerequisiteCandidateOrigin;
  scopeId: string;
}): string {
  return `cand-${projectionDigest({
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    origin: input.origin,
    scopeId: input.scopeId,
  }).slice(0, 24)}`;
}

export function createPrerequisiteCandidate(input: {
  sourceNodeId: string;
  targetNodeId: string;
  origin: PrerequisiteCandidateOrigin;
  scopeId: string;
  strengthHint?: PrerequisiteStrength | null;
  note?: string | null;
  candidateId?: string;
}): PrerequisiteCandidateRecord {
  if (!input.sourceNodeId || !input.targetNodeId || !input.scopeId) {
    throw new PrerequisiteCandidateError(
      'schema-invalid',
      'sourceNodeId, targetNodeId, and scopeId are required',
    );
  }
  const origins: readonly string[] = [
    'ENGINEERING_RELATION',
    'TEXTBOOK_ORDER',
    'LESSON_ORDER',
    'LEGACY_GRAPH',
    'HANDOUT_LANGUAGE',
    'INTERACTIVE_METADATA',
    'TEACHER_PROPOSAL',
    'MODEL_SIMILARITY',
  ];
  if (!origins.includes(input.origin)) {
    throw new PrerequisiteCandidateError(
      'schema-invalid',
      `invalid candidate origin: ${String(input.origin)}`,
    );
  }

  return {
    candidateId:
      input.candidateId
      ?? deriveCandidateId({
        sourceNodeId: input.sourceNodeId,
        targetNodeId: input.targetNodeId,
        origin: input.origin,
        scopeId: input.scopeId,
      }),
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    origin: input.origin,
    scopeId: input.scopeId,
    strengthHint: input.strengthHint ?? null,
    note: input.note ?? null,
    publishable: false,
  };
}

/** Post-requisite presentation family, including minted `prerequisite`. */
export function isEngineeringLearningOrderPredicate(predicate: string): boolean {
  return getKnowledgeGraphRelationContract(predicate)?.family === 'post-requisite';
}

/**
 * Engineering ActKG relations produce candidates only.
 * Learning-order predicates are eligible for a separate adoption pass;
 * association / derived_from / has_component never auto-publish.
 */
export function candidatesFromEngineeringRelations(
  relations: readonly {
    sourceId: string;
    targetId: string;
    predicate: string;
    scopeId: string;
    id?: string;
    note?: string | null;
  }[],
): PrerequisiteCandidateRecord[] {
  return sortBy(
    relations.map((rel) =>
      createPrerequisiteCandidate({
        sourceNodeId: rel.sourceId,
        targetNodeId: rel.targetId,
        origin: 'ENGINEERING_RELATION',
        scopeId: rel.scopeId,
        note: rel.note
          ?? (isEngineeringLearningOrderPredicate(rel.predicate)
            ? `engineering learning-order ${rel.predicate}${rel.id ? ` ${rel.id}` : ''} is eligible for ACT teaching adoption`
            : `engineering predicate ${rel.predicate} is not an ACT teaching prerequisite`),
      }),
    ),
    (c) => c.candidateId,
  );
}

/** Textbook chapter/section order is advisory only. */
export function candidatesFromTextbookOrder(
  pairs: readonly {
    earlierId: string;
    laterId: string;
    scopeId: string;
    locator?: string | null;
  }[],
): PrerequisiteCandidateRecord[] {
  return sortBy(
    pairs.map((pair) =>
      createPrerequisiteCandidate({
        sourceNodeId: pair.earlierId,
        targetNodeId: pair.laterId,
        origin: 'TEXTBOOK_ORDER',
        scopeId: pair.scopeId,
        strengthHint: 'RECOMMENDED',
        note: pair.locator
          ? `textbook order candidate from ${pair.locator}`
          : 'textbook order is not an ACT teaching prerequisite',
      }),
    ),
    (c) => c.candidateId,
  );
}

/** Lesson / course sequence order is advisory only. */
export function candidatesFromLessonOrder(
  pairs: readonly {
    earlierId: string;
    laterId: string;
    scopeId: string;
    lessonKey?: string | null;
  }[],
): PrerequisiteCandidateRecord[] {
  return sortBy(
    pairs.map((pair) =>
      createPrerequisiteCandidate({
        sourceNodeId: pair.earlierId,
        targetNodeId: pair.laterId,
        origin: 'LESSON_ORDER',
        scopeId: pair.scopeId,
        strengthHint: 'RECOMMENDED',
        note: pair.lessonKey
          ? `lesson order candidate from ${pair.lessonKey}`
          : 'lesson order is not an ACT teaching prerequisite',
      }),
    ),
    (c) => c.candidateId,
  );
}

/**
 * True only when a candidate has been elevated by an explicit author decision
 * path (never automatically). This helper is the explicit refuse gate used by
 * fixtures and publication tests.
 */
export function canAutoPublishFromCandidate(
  _candidate: PrerequisiteCandidateRecord,
): false {
  return false;
}

export function normalizeCandidates(
  candidates: readonly PrerequisiteCandidateRecord[],
): PrerequisiteCandidateRecord[] {
  const seen = new Set<string>();
  const rows: PrerequisiteCandidateRecord[] = [];
  for (const raw of candidates) {
    const row = createPrerequisiteCandidate(raw);
    if (seen.has(row.candidateId)) {
      throw new PrerequisiteCandidateError(
        'duplicate-candidate',
        `duplicate candidate ${row.candidateId}`,
      );
    }
    seen.add(row.candidateId);
    rows.push({ ...row, publishable: false });
  }
  return sortBy(rows, (c) => c.candidateId);
}
