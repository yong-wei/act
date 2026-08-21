import type { Message } from '@/types/ai-message';

import {
  canonicalizeTextbookCoachIdentity,
  identitiesEqual,
  type StructuredTextbookUnitIdentity,
} from './identity';

export const PINNED_TEXTBOOK_IDENTITY_METADATA_KEY = 'pinnedTextbookResourceIdentity';

export function findLatestPinnedTextbookIdentity(
  messages: readonly Message[],
): StructuredTextbookUnitIdentity | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const metadata = messages[index].metadata;
    if (!metadata || typeof metadata !== 'object') continue;
    const event = (metadata as Record<string, unknown>).konlingAssistantBindingEvent;
    if (!event || typeof event !== 'object' || Array.isArray(event)) continue;
    const identity = canonicalizeTextbookCoachIdentity(
      (event as Record<string, unknown>)[PINNED_TEXTBOOK_IDENTITY_METADATA_KEY],
    );
    if (identity) return identity;
  }
  return null;
}

export function pinTextbookCoachIdentity(input: {
  existingPin: StructuredTextbookUnitIdentity | null;
  verified: StructuredTextbookUnitIdentity;
}): { identity: StructuredTextbookUnitIdentity; replaced: boolean } {
  if (!input.existingPin) {
    return { identity: input.verified, replaced: false };
  }
  return {
    identity: input.existingPin,
    replaced: !identitiesEqual(input.existingPin, input.verified),
  };
}
