/**
 * ActKG Engineering Authority / ACT Teaching Projection / consumer boundary
 * states for #1265 (revise-actkg-authority-boundary).
 *
 * Stable string identities. Unknown values fail closed.
 */

export const ENGINEERING_AUTHORITY_STATES = [
  'VALIDATED',
  'ACTIVE',
  'REJECTED_INTEGRITY',
] as const;

export type EngineeringAuthorityState = (typeof ENGINEERING_AUTHORITY_STATES)[number];

export const TEACHING_PROJECTION_STATES = [
  'PUBLISHED',
  'REVIEW_REQUIRED',
  'NOT_PROJECTED',
] as const;

export type TeachingProjectionState = (typeof TEACHING_PROJECTION_STATES)[number];

export const CONSUMER_READINESS_STATES = [
  'READY',
  'PINNED_PREVIOUS',
  'BLOCKED_LOCAL_DEPENDENCY',
] as const;

export type ConsumerReadinessState = (typeof CONSUMER_READINESS_STATES)[number];

/** Legacy audit is always read-only; tamper is represented as a typed failure. */
export const LEGACY_AUDIT_STATES = [
  'IMMUTABLE_VALID',
  'TAMPER_FAIL_CLOSED',
] as const;

export type LegacyAuditState = (typeof LEGACY_AUDIT_STATES)[number];

export class UnknownAuthorityBoundaryStateError extends Error {
  readonly code = 'unknown-authority-boundary-state' as const;
  readonly domain: string;
  readonly value: string;

  constructor(domain: string, value: string) {
    super(`Authority boundary rejected: unknown ${domain} state (${value})`);
    this.name = 'UnknownAuthorityBoundaryStateError';
    this.domain = domain;
    this.value = value;
  }
}

function parseState<T extends string>(
  domain: string,
  value: unknown,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new UnknownAuthorityBoundaryStateError(domain, String(value));
  }
  return value as T;
}

export function parseEngineeringAuthorityState(value: unknown): EngineeringAuthorityState {
  return parseState('engineering-authority', value, ENGINEERING_AUTHORITY_STATES);
}

export function parseTeachingProjectionState(value: unknown): TeachingProjectionState {
  return parseState('teaching-projection', value, TEACHING_PROJECTION_STATES);
}

export function parseConsumerReadinessState(value: unknown): ConsumerReadinessState {
  return parseState('consumer-readiness', value, CONSUMER_READINESS_STATES);
}

export function parseLegacyAuditState(value: unknown): LegacyAuditState {
  return parseState('legacy-audit', value, LEGACY_AUDIT_STATES);
}

export function isEngineeringAuthorityState(value: unknown): value is EngineeringAuthorityState {
  return typeof value === 'string'
    && (ENGINEERING_AUTHORITY_STATES as readonly string[]).includes(value);
}

export function isTeachingProjectionState(value: unknown): value is TeachingProjectionState {
  return typeof value === 'string'
    && (TEACHING_PROJECTION_STATES as readonly string[]).includes(value);
}

export function isConsumerReadinessState(value: unknown): value is ConsumerReadinessState {
  return typeof value === 'string'
    && (CONSUMER_READINESS_STATES as readonly string[]).includes(value);
}
