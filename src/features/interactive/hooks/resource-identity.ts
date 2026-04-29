const CUID_PATTERN = /^c[\w]{24}$/;

export interface TrackingResourceIdentityInput {
  configuredResourceId?: string | null;
  configuredResourceKey?: string | null;
  eventResourceId?: unknown;
  eventResourceKey?: unknown;
}

export interface TrackingResourceIdentity {
  resourceId: string | null;
  resourceKey: string;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function isPersistedTeachingResourceId(value: unknown): value is string {
  return typeof value === 'string' && CUID_PATTERN.test(value);
}

export function resolveTrackingResourceIdentity({
  configuredResourceId,
  configuredResourceKey,
  eventResourceId,
  eventResourceKey,
}: TrackingResourceIdentityInput): TrackingResourceIdentity {
  const eventId = readNonEmptyString(eventResourceId);
  const configuredId = readNonEmptyString(configuredResourceId);
  const eventKey = readNonEmptyString(eventResourceKey);
  const configuredKey = readNonEmptyString(configuredResourceKey);

  const resourceId = isPersistedTeachingResourceId(eventId)
    ? eventId
    : isPersistedTeachingResourceId(configuredId)
      ? configuredId
      : null;

  const resourceKey = eventKey ?? configuredKey ?? configuredId ?? eventId ?? '';

  return { resourceId, resourceKey };
}
