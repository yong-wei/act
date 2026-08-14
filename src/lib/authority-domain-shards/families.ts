/**
 * Published engineering predicate → relation-family mapping (#1375).
 *
 * Families are presentation controls only. Predicates, endpoints and
 * direction stay exactly as published.
 */

import {
  ENGINEERING_RELATION_FAMILIES,
  type EngineeringRelationFamily,
} from './contracts';

export const STRUCTURE_PREDICATES = ['has_component', 'part_of'] as const;
export const DERIVATION_PREDICATES = [
  'derived_from',
  'has_formula',
  'has_representation',
] as const;
export const APPLICATION_PREDICATES = ['applies_to', 'used_to_analyze'] as const;
export const ASSOCIATION_PREDICATES = ['association'] as const;

const FAMILY_BY_PREDICATE: Readonly<Record<string, EngineeringRelationFamily>> = {
  has_component: 'structure',
  part_of: 'structure',
  derived_from: 'derivation-and-representation',
  has_formula: 'derivation-and-representation',
  has_representation: 'derivation-and-representation',
  applies_to: 'application-and-analysis',
  used_to_analyze: 'application-and-analysis',
  association: 'association',
};

export function engineeringFamilyForPredicate(
  predicate: string,
): EngineeringRelationFamily | null {
  return FAMILY_BY_PREDICATE[predicate] ?? null;
}

export function predicatesForEngineeringFamily(
  family: EngineeringRelationFamily,
): readonly string[] {
  switch (family) {
    case 'structure':
      return STRUCTURE_PREDICATES;
    case 'derivation-and-representation':
      return DERIVATION_PREDICATES;
    case 'application-and-analysis':
      return APPLICATION_PREDICATES;
    case 'association':
      return ASSOCIATION_PREDICATES;
    default: {
      const _never: never = family;
      return _never;
    }
  }
}

export function allEngineeringFamilies(): readonly EngineeringRelationFamily[] {
  return ENGINEERING_RELATION_FAMILIES;
}
