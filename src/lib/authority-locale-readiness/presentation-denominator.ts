/**
 * Independently computed complete-locale presentation denominators.
 *
 * This module is client-safe. Loading the active shard inventory stays in
 * `active-presentation-inventory.ts`.
 */

import {
  MANDATORY_LOCALE_CATEGORIES,
  type LocaleCategoryDenominator,
  type MandatoryLocaleCategory,
} from './contracts';
import { localeDigest } from './digest';

export interface LocalePresentationInventory {
  readonly domains: readonly string[];
  readonly objectNames: readonly string[];
  readonly objectExplanations: readonly string[];
  readonly types: readonly string[];
  readonly relations: readonly string[];
  readonly directions: readonly string[];
  readonly aliasIds: readonly string[];
  readonly sourceIds: readonly string[];
}

function uniqueSorted(ids: Iterable<string>): string[] {
  return [...new Set([...ids].filter((id) => id.length > 0))].sort();
}

export function sourcePresentationRecordId(source: {
  sourceEditionId: string;
  sectionId: string;
}): string {
  return source.sectionId
    ? `${source.sourceEditionId}::${source.sectionId}`
    : source.sourceEditionId;
}

export function expectedDenominatorsFromInventory(
  inventory: LocalePresentationInventory,
): LocaleCategoryDenominator[] {
  const byCategory: Record<MandatoryLocaleCategory, readonly string[]> = {
    domains: inventory.domains,
    'object-names': inventory.objectNames,
    'object-explanations': inventory.objectExplanations,
    types: inventory.types,
    relations: inventory.relations,
    directions: inventory.directions,
    'approved-aliases': inventory.aliasIds,
    'readable-sources': inventory.sourceIds,
  };
  return MANDATORY_LOCALE_CATEGORIES.map((category) => {
    const recordIds = uniqueSorted(byCategory[category]);
    return { category, recordIds, digest: localeDigest(recordIds) };
  });
}
