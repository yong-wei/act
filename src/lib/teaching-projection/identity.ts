/**
 * Stable Teaching Projection resource and binding identities (#1267).
 */

import {
  TEACHING_PROJECTION_ROLES,
  TEACHING_RESOURCE_TYPES,
  type TeachingBindingAuthoring,
  type TeachingProjectionRole,
  type TeachingResourceAuthoring,
  type TeachingResourceType,
} from './contracts';
import { projectionDigest } from './hash';

export class TeachingProjectionIdentityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TeachingProjectionIdentityError';
    this.code = code;
  }
}

const RESOURCE_ID_PATTERNS: Record<TeachingResourceType, RegExp> = {
  lesson: /^act:lesson:[^:\s]+$/u,
  handout: /^act:handout:[^:\s]+$/u,
  step: /^act:step:[^:\s]+:[^:\s]+$/u,
  textbook: /^act:textbook:[^:\s]+$/u,
  'textbook-chapter': /^act:textbook-chapter:[^:\s]+:[^:\s]+$/u,
  'textbook-section': /^act:textbook-section:[^:\s]+$/u,
  card: /^act:card:[^:\s]+$/u,
  video: /^act:video:[^:\s]+$/u,
  audio: /^act:audio:[^:\s]+$/u,
  podcast: /^act:podcast:[^:\s]+$/u,
  slides: /^act:slides:[^:\s]+$/u,
  exercise: /^act:exercise:[^:\s]+$/u,
  simulation: /^act:simulation:[^:\s]+$/u,
  project: /^act:project:[^:\s]+$/u,
};

export function isTeachingProjectionRole(value: unknown): value is TeachingProjectionRole {
  return typeof value === 'string'
    && (TEACHING_PROJECTION_ROLES as readonly string[]).includes(value);
}

export function isTeachingResourceType(value: unknown): value is TeachingResourceType {
  return typeof value === 'string'
    && (TEACHING_RESOURCE_TYPES as readonly string[]).includes(value);
}

export function assertNonEmptyToken(value: string | undefined, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TeachingProjectionIdentityError(
      'schema-invalid',
      `${label} must be a non-empty string`,
    );
  }
  if (value.includes(':') || /\s/u.test(value)) {
    throw new TeachingProjectionIdentityError(
      'schema-invalid',
      `${label} must not contain ':' or whitespace`,
    );
  }
  return value;
}

/**
 * Deterministic resource IDs:
 * - act:lesson:<lesson-key>
 * - act:handout:<lesson-key>
 * - act:step:<lesson-key>:<step-id>
 * - act:textbook:<source-document-id>
 * - act:textbook-chapter:<document-id>:<chapter-key>
 * - act:textbook-section:<section-id>
 * - act:card:<stable-card-id>
 */
export function deriveResourceId(input: TeachingResourceAuthoring): string {
  if (input.resourceId) {
    assertValidResourceId(input.resourceId, input.resourceType);
    return input.resourceId;
  }

  switch (input.resourceType) {
    case 'lesson':
      return `act:lesson:${assertNonEmptyToken(input.lessonKey, 'lessonKey')}`;
    case 'handout':
      return `act:handout:${assertNonEmptyToken(input.lessonKey, 'lessonKey')}`;
    case 'step':
      return `act:step:${assertNonEmptyToken(input.lessonKey, 'lessonKey')}:${assertNonEmptyToken(input.stepId, 'stepId')}`;
    case 'textbook':
      return `act:textbook:${assertNonEmptyToken(input.sourceDocumentId, 'sourceDocumentId')}`;
    case 'textbook-chapter':
      return `act:textbook-chapter:${assertNonEmptyToken(input.sourceDocumentId, 'sourceDocumentId')}:${assertNonEmptyToken(input.chapterKey, 'chapterKey')}`;
    case 'textbook-section':
      return `act:textbook-section:${assertNonEmptyToken(input.sectionId, 'sectionId')}`;
    case 'card':
      return `act:card:${assertNonEmptyToken(input.cardId, 'cardId')}`;
    default:
      throw new TeachingProjectionIdentityError(
        'schema-invalid',
        `unsupported resource type: ${String((input as TeachingResourceAuthoring).resourceType)}`,
      );
  }
}

export function assertValidResourceId(
  resourceId: string,
  resourceType?: TeachingResourceType,
): void {
  if (typeof resourceId !== 'string' || !resourceId.startsWith('act:')) {
    throw new TeachingProjectionIdentityError(
      'malformed-resource-id',
      `malformed resource ID: ${resourceId}`,
    );
  }

  if (resourceType) {
    if (!RESOURCE_ID_PATTERNS[resourceType].test(resourceId)) {
      throw new TeachingProjectionIdentityError(
        'malformed-resource-id',
        `resource ID ${resourceId} does not match type ${resourceType}`,
      );
    }
    return;
  }

  const matched = TEACHING_RESOURCE_TYPES.some((type) =>
    RESOURCE_ID_PATTERNS[type].test(resourceId),
  );
  if (!matched) {
    throw new TeachingProjectionIdentityError(
      'malformed-resource-id',
      `malformed resource ID: ${resourceId}`,
    );
  }
}

/**
 * Binding identity = resourceId + canonicalId + role + scopeId
 * Materialized as a stable, readable digest-backed ID.
 */
export function deriveBindingId(input: {
  resourceId: string;
  canonicalId: string;
  role: TeachingProjectionRole;
  scopeId: string;
}): string {
  assertValidResourceId(input.resourceId);
  if (!isTeachingProjectionRole(input.role)) {
    throw new TeachingProjectionIdentityError(
      'unsupported-role',
      `unsupported binding role: ${String(input.role)}`,
    );
  }
  if (!input.canonicalId || input.canonicalId.trim().length === 0) {
    throw new TeachingProjectionIdentityError(
      'schema-invalid',
      'binding canonicalId must be non-empty',
    );
  }
  if (!input.scopeId || input.scopeId.trim().length === 0) {
    throw new TeachingProjectionIdentityError(
      'schema-invalid',
      'binding scopeId must be non-empty',
    );
  }

  const digest = projectionDigest({
    resourceId: input.resourceId,
    canonicalId: input.canonicalId,
    role: input.role,
    scopeId: input.scopeId,
  });
  return `bind-${digest.slice(0, 32)}`;
}

export function bindingIdentityKey(input: {
  resourceId: string;
  canonicalId: string;
  role: TeachingProjectionRole;
  scopeId: string;
}): string {
  return [input.resourceId, input.canonicalId, input.role, input.scopeId].join('\u001f');
}

export function derivePrerequisiteId(input: {
  sourceCanonicalId: string;
  targetCanonicalId: string;
  strength: string;
  scopeId?: string | null;
}): string {
  const digest = projectionDigest({
    sourceCanonicalId: input.sourceCanonicalId,
    targetCanonicalId: input.targetCanonicalId,
    strength: input.strength,
    scopeId: input.scopeId ?? null,
  });
  return `prereq-${digest.slice(0, 32)}`;
}

export function projectionIdFromHash(projectionHash: string): string {
  if (!/^[a-f0-9]{64}$/u.test(projectionHash)) {
    throw new TeachingProjectionIdentityError(
      'hash-invalid',
      'projectionHash must be 64 lowercase hexadecimal characters',
    );
  }
  return `proj-${projectionHash}`;
}

export function normalizeBindingAuthoring(
  binding: TeachingBindingAuthoring,
): TeachingBindingAuthoring {
  if (!isTeachingProjectionRole(binding.role)) {
    throw new TeachingProjectionIdentityError(
      'unsupported-role',
      `unsupported binding role: ${String(binding.role)}`,
    );
  }
  assertValidResourceId(binding.resourceId);
  return binding;
}
