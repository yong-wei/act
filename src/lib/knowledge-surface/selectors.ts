export const KNOWLEDGE_SURFACE_SELECTOR_FIXED_CODE = 'KNOWLEDGE_SURFACE_SELECTOR_FIXED' as const;
export const KNOWLEDGE_SURFACE_SELECTOR_FIXED_MESSAGE =
  'Knowledge surface identity is resolved by the server.' as const;

/**
 * Client-supplied identity selectors. Navigation intents such as locale, mode,
 * domainId, family, node path, search, type, and bloom stay allowed.
 */
export const KNOWLEDGE_SURFACE_IDENTITY_SELECTOR_KEYS = [
  'authorityState',
  'releaseSetId',
  'releaseId',
  'releaseHash',
  'snapshotId',
  'snapshotHash',
  'projectionId',
  'projectionHash',
  'projectionDigest',
  'runtimeProjectionId',
  'runtimeProjectionProfile',
  'registryIndex',
  'registryIndexId',
  'registryIndexHash',
  'registryIndexIdentity',
  'manifest',
  'manifestId',
  'manifestHash',
  'teachingProjectionId',
  'teachingProjectionHash',
  'selector',
  'activationId',
  'activationHash',
  'sourceDatasetHash',
] as const;

export type KnowledgeSurfaceIdentitySelectorKey =
  (typeof KNOWLEDGE_SURFACE_IDENTITY_SELECTOR_KEYS)[number];

const FORBIDDEN = new Set<string>(KNOWLEDGE_SURFACE_IDENTITY_SELECTOR_KEYS);

export function asSearchParams(
  input: URLSearchParams | Record<string, string | undefined | null> | undefined,
): URLSearchParams {
  if (!input) return new URLSearchParams();
  if (input instanceof URLSearchParams) return input;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') params.set(key, value);
  }
  return params;
}

export function forbiddenIdentitySelectorKey(
  searchParams: URLSearchParams | Record<string, string | undefined | null> | undefined,
): KnowledgeSurfaceIdentitySelectorKey | null {
  const params = asSearchParams(searchParams);
  for (const key of params.keys()) {
    if (FORBIDDEN.has(key)) return key as KnowledgeSurfaceIdentitySelectorKey;
  }
  return null;
}

export function forbiddenIdentitySelectorFromRequest(request: Request): KnowledgeSurfaceIdentitySelectorKey | null {
  return forbiddenIdentitySelectorKey(new URL(request.url).searchParams);
}
