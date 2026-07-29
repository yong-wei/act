/**
 * ActKG authoritative canonical digests for public Bundle validation.
 *
 * Contract sources (upstream ActKG repository):
 * - `src/ctkg_schema/validation.py` → `projection_version_digest`
 * - `src/ctkg_schema/public_bundle.py` → `canonical_json` / Release self-hash
 * - `src/ctkg_schema/section_kg/m1e_release.py` → public projection profile shape
 *   used when packaging GraphProjection `version_digest` with a full profile record
 *
 * Serialization matches ActKG:
 *   json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
 * then SHA-256 hex of the UTF-8 bytes.
 *
 * Release self-hash: SHA-256 of canonical JSON of the Release object with the
 * `release_hash` field removed (circular self-reference).
 *
 * Projection version digest: SHA-256 of canonical JSON over
 *   projection_profile (full profile record when available),
 *   source_release, source_release_hash, source_dataset_hash,
 *   nodes, links, hidden_entities.
 *
 * Public packages often only carry `projection_profile` as an id string. In that
 * case the profile record is reconstructed from the CTKG public packaging
 * template (m1e_release) so standalone Bundle validation matches the digest
 * that was produced with the full profile at package time.
 */
import { createHash } from 'node:crypto';

export type JsonObject = Record<string, unknown>;

function failCanonical(message: string): never {
  throw new Error(message);
}

/**
 * ActKG `canonical_json` / validation `_sha256_value` serialization.
 * Equivalent to public_bundle.canonical_json and validation.py json.dumps subset.
 */
export function actkgCanonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      failCanonical('ActKG canonical JSON cannot contain a non-finite number');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => actkgCanonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as JsonObject)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${actkgCanonicalJson(item)}`)
      .join(',')}}`;
  }
  failCanonical('ActKG canonical JSON contains an unsupported value');
}

export function actkgSha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

/** ActKG Release self-hash: canonical JSON without the circular release_hash field. */
export function computeCanonicalReleaseHash(release: JsonObject): string {
  const normalized = structuredClone(release);
  delete normalized.release_hash;
  return actkgSha256(actkgCanonicalJson(normalized));
}

/**
 * Map Manifest / adapter profile labels and profile-id suffixes to the ActKG
 * packaging `projection_kind` used inside the full profile record.
 */
export function resolveProjectionKind(
  projectionProfileId: string,
  manifestProfile?: string,
): string {
  const id = projectionProfileId.toLowerCase();
  if (id.includes(':act-') || id.endsWith(':act-v2') || id.includes('act_runtime')) {
    return 'act_runtime_graph';
  }
  if (id.includes(':domain-') || id.endsWith(':domain-v2') || id.includes('domain_graph')) {
    return 'domain_graph';
  }
  if (id.includes(':review-') || id.endsWith(':review-v2') || id.includes('review_graph')) {
    return 'review_graph';
  }
  const normalized = (manifestProfile ?? '').toLowerCase();
  if (normalized === 'runtime' || normalized === 'act') return 'act_runtime_graph';
  if (normalized === 'domain') return 'domain_graph';
  if (normalized === 'review') return 'review_graph';
  // Fail closed: unknown kinds would produce non-authoritative digests.
  failCanonical(
    `cannot resolve ActKG projection_kind for profile ${projectionProfileId}`,
  );
}

/**
 * Reconstruct the CTKG public projection profile record used at package time
 * when only the profile id is present on the GraphProjection payload.
 *
 * Shape source: ActKG `m1e_release._build_projection` profile template.
 */
export function reconstructPublicProjectionProfile(
  projectionProfileId: string,
  manifestProfile?: string,
): JsonObject {
  return {
    aggregation_policy: 'm1e-v1b-release-tier-preserving',
    id: projectionProfileId,
    included_lifecycle_statuses: ['accepted'],
    lifecycle_status: 'accepted',
    mapping_contract_version: 'ctkg-graph-projection-v2',
    profile_version: '2.0.0',
    projection_kind: resolveProjectionKind(projectionProfileId, manifestProfile),
    relation_families: ['domain_semantic'],
    schema_version: '0.2.0',
  };
}

/**
 * ActKG `projection_version_digest`.
 *
 * @param projection GraphProjection payload
 * @param profile Optional full profile record. When omitted, a public packaging
 *   profile is reconstructed from the projection's profile id.
 * @param manifestProfile Optional Manifest profile label (runtime/domain/review)
 *   used only to disambiguate kind when reconstructing the profile.
 */
export function computeProjectionVersionDigest(
  projection: JsonObject,
  profile?: JsonObject | null,
  manifestProfile?: string,
): string {
  const projectionProfileId = typeof projection.projection_profile === 'string'
    ? projection.projection_profile
    : '';
  const profileRecord = profile
    ?? (
      projectionProfileId
        ? reconstructPublicProjectionProfile(projectionProfileId, manifestProfile)
        : { id: projection.projection_profile }
    );

  return actkgSha256(actkgCanonicalJson({
    projection_profile: profileRecord,
    source_release: projection.source_release,
    source_release_hash: projection.source_release_hash,
    source_dataset_hash: projection.source_dataset_hash,
    nodes: projection.nodes ?? [],
    links: projection.links ?? [],
    hidden_entities: projection.hidden_entities ?? [],
  }));
}
