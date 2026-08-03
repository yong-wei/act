/**
 * Active knowledge truth revision resolver for LearningFact producers.
 *
 * Pre-cutover (#1116): production facts remain on the Legacy identity
 * namespace. This resolver returns the active Legacy knowledge revision used
 * by the Legacy fixed-identity adapter. Canonical authority activation is
 * reserved for #1117 and is not performed here.
 *
 * Writer-discovery static gates expect producers to call
 * `resolveActiveKnowledgeRevision` from this module atomically with fact
 * creation when stamping knowledgeRevisionRef.
 */

export const KNOWLEDGE_TRUTH_REVISION_SCHEMA_VERSION =
  'knowledge-truth-revision/v1' as const;

export type KnowledgeTruthAuthority = 'LEGACY' | 'CANONICAL';

export interface ActiveKnowledgeRevision {
  id: string;
  schemaVersion: typeof KNOWLEDGE_TRUTH_REVISION_SCHEMA_VERSION;
  authority: KnowledgeTruthAuthority;
  effectiveAt: string;
  /**
   * Digest fields reserved for post-cutover Canonical truth closure.
   * Pre-cutover Legacy revisions may leave digests null.
   */
  canonicalIdentityManifestDigest: string | null;
  definitionDigest: string | null;
  relationManifestDigest: string | null;
  resourceBindingManifestDigest: string | null;
}

export type KnowledgeTruthRevisionClient = {
  // Reserved for future DB-backed active pointer. Pre-cutover uses a stable
  // process-local Legacy revision so producers can fail closed if missing.
  $queryRaw?: unknown;
};

/** Stable pre-cutover Legacy active revision identity. */
export const PRE_CUTOVER_LEGACY_ACTIVE_REVISION_ID =
  'legacy-active:pre-cutover-v1' as const;

/**
 * Resolve the single active knowledge revision for new LearningFact writes.
 *
 * Pre-cutover always returns the Legacy active revision. Missing/unknown
 * revision resolution fails closed for post-cutover producers; before cutover
 * the stable Legacy id is always available.
 */
export async function resolveActiveKnowledgeRevision(
  _tx?: KnowledgeTruthRevisionClient | null,
): Promise<ActiveKnowledgeRevision> {
  return {
    id: PRE_CUTOVER_LEGACY_ACTIVE_REVISION_ID,
    schemaVersion: KNOWLEDGE_TRUTH_REVISION_SCHEMA_VERSION,
    authority: 'LEGACY',
    effectiveAt: new Date(0).toISOString(),
    canonicalIdentityManifestDigest: null,
    definitionDigest: null,
    relationManifestDigest: null,
    resourceBindingManifestDigest: null,
  };
}

/**
 * Classify a LearningFact source id into a governed producer namespace prefix.
 * Returns null when the source is unnamespaced or unknown.
 */
export function classifyLearningFactSource(
  sourceId: string | null | undefined,
  allowedPrefixes: readonly string[],
): string | null {
  if (typeof sourceId !== 'string' || sourceId.trim().length === 0) return null;
  const value = sourceId.trim();
  for (const prefix of allowedPrefixes) {
    if (value === prefix || value.startsWith(`${prefix}:`)) {
      return prefix;
    }
  }
  return null;
}
