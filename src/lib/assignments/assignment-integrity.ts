import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import {
  draftQuestionPersistenceSchema,
  questionSnapshotSchema,
  type AssignmentQuestionSnapshot,
  type CatalogSelectionIdentity,
} from './assignment-domain';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  }
  return value;
}

export function stableHash(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

export function signCatalogSelectionIdentity(
  identity: CatalogSelectionIdentity,
  secret: string,
): string {
  return `hmac-sha256:${createHmac('sha256', secret).update(stableStringify(identity)).digest('hex')}`;
}

export function verifyCatalogSelectionIdentity(
  identity: CatalogSelectionIdentity,
  proof: string,
  secret: string,
): boolean {
  const expected = signCatalogSelectionIdentity(identity, secret);
  const left = Buffer.from(expected);
  const right = Buffer.from(proof);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createQuestionSnapshot(
  input: z.input<typeof questionSnapshotSchema>,
): AssignmentQuestionSnapshot {
  const parsed = questionSnapshotSchema.parse(input);
  return deepFreeze({ ...structuredClone(parsed), contentHash: stableHash(parsed) });
}

export function createDraftQuestionSnapshot(
  input: z.input<typeof draftQuestionPersistenceSchema>,
): AssignmentQuestionSnapshot {
  const parsed = draftQuestionPersistenceSchema.parse(input);
  return deepFreeze({ ...structuredClone(parsed), contentHash: stableHash(parsed) });
}
