import { isCoreEvent } from '@/lib/data-governance/event-types';
import { listRegistryEntries } from './registry';

export interface EventDictionaryProjectionRow {
  eventType: string;
  category: string;
  priority: string;
  description: string | null;
  schema: Record<string, unknown> | null;
}

export function projectEventDictionaryFromRegistry(): EventDictionaryProjectionRow[] {
  return listRegistryEntries().map((entry) => ({
    eventType: entry.action,
    category: entry.owner,
    priority: isCoreEvent(entry.action) ? 'core' : 'secondary',
    description: `${entry.discriminator}@${entry.schemaVersion}`,
    schema: entry.payloadSchema ?? null,
  }));
}

export function assertEventDictionaryIsRegistryProjection(
  rows: Array<{ eventType: string }>,
): { ok: true } | { ok: false; missing: string[]; extra: string[] } {
  const projected = new Set(projectEventDictionaryFromRegistry().map((row) => row.eventType));
  const observed = new Set(rows.map((row) => row.eventType));
  const missing = [...projected].filter((eventType) => !observed.has(eventType));
  const extra = [...observed].filter((eventType) => !projected.has(eventType));
  if (missing.length === 0 && extra.length === 0) return { ok: true };
  return { ok: false, missing, extra };
}
