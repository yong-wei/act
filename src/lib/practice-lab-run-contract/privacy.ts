import { HIDDEN_PUBLIC_KEYS } from './types';

export function hiddenPublicField(value: unknown, path = ''): string | null {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const nested = hiddenPublicField(item, `${path}[${index}]`);
      if (nested) return nested;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, nested] of Object.entries(value)) {
    const current = path ? `${path}.${key}` : key;
    if ((HIDDEN_PUBLIC_KEYS as readonly string[]).includes(key)) {
      return current;
    }
    const child = hiddenPublicField(nested, current);
    if (child) return child;
  }
  return null;
}

export function rejectHiddenPublicPayload(value: unknown): void {
  const path = hiddenPublicField(value);
  if (path) {
    throw new Error(`Public artifact/run contract excludes hidden field ${path}.`);
  }
}
