import { sha256Text } from '@/lib/source-pack/sha256';

export function localeCanonicalJson(value: unknown): string {
  return serialize(value);
}

export function localeDigest(value: unknown): string {
  return sha256Text(localeCanonicalJson(value));
}

function serialize(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('locale canonical JSON cannot contain a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => serialize(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`).join(',')}}`;
  }
  throw new Error('locale canonical JSON cannot serialize this value');
}
