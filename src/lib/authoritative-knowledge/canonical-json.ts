import { createHash } from 'node:crypto';

export type CanonicalJsonObject = Record<string, unknown>;

function failCanonical(message: string): never {
  throw new Error(message);
}

/** Sorted-key JSON used by active knowledge reads and ActKG release self-hashes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) failCanonical('canonical JSON cannot contain a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as CanonicalJsonObject)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  failCanonical('canonical JSON contains an unsupported value');
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

/** ActKG Release self-hash: canonical JSON without the circular `release_hash` field. */
export function computeCanonicalReleaseHash(release: CanonicalJsonObject): string {
  const normalized = structuredClone(release);
  delete normalized.release_hash;
  return sha256(canonicalJson(normalized));
}
