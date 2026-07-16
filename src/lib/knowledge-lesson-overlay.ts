import { createHash } from 'node:crypto';

import { getKnowledgeGraphRelationContract } from '@/features/knowledge/graph/relation-contract';

export interface NormalizedKnowledgeLessonLink {
  normalizedType: string;
  relationId: string;
  sourceId: string;
  strength: number | null;
  targetId: string;
}

export type KnowledgeLessonCardOrderGapReason = 'duplicate' | 'missing';
export type KnowledgeLessonLinkGapReason =
  | 'ambiguous'
  | 'duplicate'
  | 'missing'
  | 'reverse'
  | 'stale'
  | 'synthetic';

export interface KnowledgeLessonMappingGaps {
  cardOrder: Array<{ nodeId: string; reason: KnowledgeLessonCardOrderGapReason }>;
  links: Array<NormalizedKnowledgeLessonLink & { reason: KnowledgeLessonLinkGapReason }>;
}

export interface SanitizedKnowledgeLessonContext {
  lessonId: string;
  overlayRevision: string;
  cardOrderNodeIds: string[];
  mappingGaps: KnowledgeLessonMappingGaps;
}

export class KnowledgeLessonOverlayValidationError extends Error {}

function exactString(value: unknown, field: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value) || value.trim() !== value) {
    throw new KnowledgeLessonOverlayValidationError(`${field} must be an exact string.`);
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      throw new KnowledgeLessonOverlayValidationError(`${field} contains an invalid Unicode surrogate.`);
    }
  }
  return value;
}

function readFirst(record: Record<string, unknown>, fields: readonly string[]): unknown {
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(record, field)) return record[field];
  }
  return undefined;
}

function readOptionalRelationId(record: Record<string, unknown>): unknown {
  for (const field of ['relationId', 'relation_id', 'id']) {
    if (Object.prototype.hasOwnProperty.call(record, field)) return record[field];
  }
  return '';
}

function compareStrings(left: string, right: string): number {
  const leftScalars = Array.from(left, (character) => character.codePointAt(0)!);
  const rightScalars = Array.from(right, (character) => character.codePointAt(0)!);
  const sharedLength = Math.min(leftScalars.length, rightScalars.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (leftScalars[index] !== rightScalars[index]) return leftScalars[index] - rightScalars[index];
  }
  return leftScalars.length - rightScalars.length;
}

export function compareNormalizedKnowledgeLessonLinks(
  left: NormalizedKnowledgeLessonLink,
  right: NormalizedKnowledgeLessonLink
): number {
  for (const field of ['sourceId', 'targetId', 'normalizedType', 'relationId'] as const) {
    const comparison = compareStrings(left[field], right[field]);
    if (comparison !== 0) return comparison;
  }
  const leftKind = left.strength === null ? 0 : 1;
  const rightKind = right.strength === null ? 0 : 1;
  if (leftKind !== rightKind) return leftKind - rightKind;
  return (left.strength ?? 0) - (right.strength ?? 0);
}

export function normalizeKnowledgeLessonOverlayLinks(
  links: readonly unknown[]
): NormalizedKnowledgeLessonLink[] {
  if (!Array.isArray(links)) {
    throw new KnowledgeLessonOverlayValidationError('links must be an array.');
  }
  return links.map((rawLink, index) => {
    const link = rawLink as Record<string, unknown>;
    if (!rawLink || typeof rawLink !== 'object' || Array.isArray(rawLink)) {
      throw new KnowledgeLessonOverlayValidationError(`links[${index}] must be an object.`);
    }
    const rawType = exactString(
      readFirst(link, ['normalizedType', 'relationType', 'relation_type', 'relation', 'type']),
      `links[${index}].relationType`
    );
    const contract = getKnowledgeGraphRelationContract(rawType);
    if (!contract) {
      throw new KnowledgeLessonOverlayValidationError(`links[${index}] has an unknown relation type.`);
    }
    const rawStrength = link.strength;
    return {
      normalizedType: contract.canonicalType,
      relationId: exactString(
        readOptionalRelationId(link),
        `links[${index}].relationId`,
        true
      ),
      sourceId: exactString(
        readFirst(link, ['sourceId', 'source_id']),
        `links[${index}].sourceId`
      ),
      strength: typeof rawStrength === 'number' && Number.isFinite(rawStrength)
        ? Object.is(rawStrength, -0) ? 0 : rawStrength
        : null,
      targetId: exactString(
        readFirst(link, ['targetId', 'target_id']),
        `links[${index}].targetId`
      ),
    };
  }).sort(compareNormalizedKnowledgeLessonLinks);
}

export function buildKnowledgeLessonOverlayRevision(input: {
  cardOrder: readonly string[];
  lessonId: string;
  links: readonly NormalizedKnowledgeLessonLink[];
}): { canonicalUtf8: string; sha256: string } {
  const lessonId = exactString(input.lessonId, 'lessonId');
  const cardOrder = input.cardOrder.map((nodeId, index) => exactString(nodeId, `cardOrder[${index}]`));
  const links = [...input.links].sort(compareNormalizedKnowledgeLessonLinks).map((link) => ({
    normalizedType: exactString(link.normalizedType, 'normalizedType'),
    relationId: exactString(link.relationId, 'relationId', true),
    sourceId: exactString(link.sourceId, 'sourceId'),
    strength: typeof link.strength === 'number' && Number.isFinite(link.strength)
      ? Object.is(link.strength, -0) ? 0 : link.strength
      : null,
    targetId: exactString(link.targetId, 'targetId'),
  }));
  const canonicalUtf8 = JSON.stringify({ cardOrder, lessonId, links });
  return {
    canonicalUtf8,
    sha256: createHash('sha256').update(canonicalUtf8, 'utf8').digest('hex'),
  };
}
