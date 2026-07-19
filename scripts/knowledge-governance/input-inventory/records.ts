import { canonicalJson, compareCodePoints, taggedDigest } from './normalize';
import type { Drift, Json } from './types';

export interface TypedRecord {
  item_kind: string;
  identity_namespace: string;
  source_id: string;
  source_locator: string;
  [key: string]: Json;
}

export function typedDedupe(records: TypedRecord[]): { records: TypedRecord[]; drift: Drift[] } {
  const seen = new Map<string, TypedRecord>();
  const drift: Drift[] = [];
  for (const record of records) {
    const key = canonicalJson([record.item_kind, record.identity_namespace, record.source_id] as Json);
    const existing = seen.get(key);
    if (existing && canonicalJson(existing as unknown as Json) !== canonicalJson(record as unknown as Json)) drift.push({ code: 'TYPED_RECORD_COLLISION', scope: `${record.item_kind}/${record.identity_namespace}/${record.source_id}` });
    else seen.set(key, record);
  }
  return {
    records: [...seen.values()].sort((a, b) => compareCodePoints([a.item_kind, a.identity_namespace, a.source_id, a.source_locator].join('\0'), [b.item_kind, b.identity_namespace, b.source_id, b.source_locator].join('\0'))),
    drift,
  };
}

export interface AnchorRecord {
  anchor_id: string;
  anchor_scope: 'course' | 'module' | 'lesson';
  anchor_type: 'formal_objective' | 'necessary_prerequisite' | 'explicit_extension';
  course_id: string;
  module_id: string | null;
  lesson_id: string | null;
  source_locator: string;
  text_digest: string;
}

export function makeAnchor(input: Omit<AnchorRecord, 'anchor_id'>): AnchorRecord {
  const valid = input.course_id !== '' && input.source_locator !== '' && input.text_digest.startsWith('sha256:');
  const matrix = input.anchor_scope === 'course'
    ? input.module_id === null && input.lesson_id === null
    : input.anchor_scope === 'module'
      ? Boolean(input.module_id) && input.lesson_id === null
      : Boolean(input.module_id) && Boolean(input.lesson_id);
  if (!valid || !matrix || input.module_id === '' || input.lesson_id === '') throw new Error('invalid nullable anchor scope');
  return { anchor_id: taggedDigest('course-scope-anchor/v1', canonicalJson(input as unknown as Json)), ...input };
}
