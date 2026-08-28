import { ALL_EVENTS } from '@/lib/data-governance/event-types';
import type { PrivacyClassification, RegistryEntry } from './types';
import { LEARNING_RECORD_SCHEMA_VERSION } from './types';

export const MIGRATED_INTERACTIVE_PRODUCER_ACTION = 'lesson_submit';

function privacyFor(category: string, eventType: string): PrivacyClassification {
  if (category === 'assessment' || eventType.includes('submit') || eventType.includes('answer')) {
    return 'restricted';
  }
  if (category === 'ai' || eventType.startsWith('arena_')) {
    return 'teacher-scoped';
  }
  if (category === 'navigation') {
    return 'public';
  }
  return 'student-private';
}

function authorityFor(category: string, eventType: string): string {
  if (eventType.startsWith('arena_')) return 'arena-producer';
  if (category === 'assessment') return 'assessment-producer';
  if (category === 'ai') return 'personalization-producer';
  return 'interactive-producer';
}

export function registryKey(discriminator: string, schemaVersion: string): string {
  return `${discriminator}@${schemaVersion}`;
}

export function buildLearningRecordRegistry(): Map<string, RegistryEntry> {
  const entries = ALL_EVENTS.map((event) => {
    const discriminator = `learning-record.${event.eventType}`;
    const entry: RegistryEntry = {
      discriminator,
      schemaVersion: LEARNING_RECORD_SCHEMA_VERSION,
      sourceVersion: 'event-types-v1',
      action: event.eventType,
      owner: 'data-governance',
      authority: authorityFor(event.category, event.eventType),
      privacyClassification: privacyFor(event.category, event.eventType),
      payloadSchema: event.schema,
      trustClass: event.eventType === MIGRATED_INTERACTIVE_PRODUCER_ACTION
        ? 'web-untrusted-client-time'
        : 'legacy-compat',
      clockSkewMs: 24 * 60 * 60 * 1000,
      migrated: event.eventType === MIGRATED_INTERACTIVE_PRODUCER_ACTION,
    };
    return [registryKey(discriminator, entry.schemaVersion), entry] as const;
  });
  return new Map(entries);
}

const REGISTRY = buildLearningRecordRegistry();

export function resolveRegistryEntry(discriminator: string, schemaVersion: string): RegistryEntry | undefined {
  return REGISTRY.get(registryKey(discriminator, schemaVersion));
}

export function resolveRegistryEntryByAction(action: string, schemaVersion = LEARNING_RECORD_SCHEMA_VERSION): RegistryEntry | undefined {
  return resolveRegistryEntry(`learning-record.${action}`, schemaVersion);
}

export function listRegistryEntries(): RegistryEntry[] {
  return [...REGISTRY.values()];
}
