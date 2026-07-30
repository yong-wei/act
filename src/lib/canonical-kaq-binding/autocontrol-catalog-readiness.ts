/**
 * #1113 migration-review helpers over the base autocontrol KAQ catalog.
 *
 * Kept out of `data-governance/autocontrol-kaq-graph-catalog.ts` so the
 * client-reachable base catalog / planner path does not import
 * canonical-kaq-binding (and thus authority-capability / Prisma).
 */

import {
  AUTOCONTROL_KAQ_GRAPH_CATALOG,
  AUTOCONTROL_KAQ_GRAPH_VERSION,
  validateAutocontrolKaqGraphCatalog,
  type AutocontrolKaqGraphCatalogValidationReport,
} from '@/lib/data-governance/autocontrol-kaq-graph-catalog';

import {
  evaluateKaqCatalogCanonicalReadiness,
  projectKaqCatalogCanonicalBindingStatus,
  type KaqCanonicalConsumerProjection,
} from './catalog-readiness';
import type {
  KaqCanonicalBinding,
  KaqCatalogBindingReadiness,
} from './contracts';
import type { VerifiedKaqPinnedContext } from './authority-capability';

/**
 * Knowledge roles intended for post-cutover formal consumption.
 * Formal consumers stay on Legacy until the multi-consumer cutover.
 */
export function listAutocontrolKaqKnowledgeRoleIds(): string[] {
  return AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes
    .filter((node) => node.domain === 'knowledge' && node.status === 'active')
    .map((node) => node.id)
    .sort();
}

/**
 * Catalog validation extended with optional Canonical binding readiness.
 * When bindings/pinned context are omitted, readiness is not evaluated and
 * formal authority remains LEGACY.
 */
export function validateAutocontrolKaqGraphCatalogWithCanonicalReadiness(
  input?: {
    bindings?: KaqCanonicalBinding[];
    pinned?: VerifiedKaqPinnedContext;
    intendedRoleIds?: readonly string[];
  },
): AutocontrolKaqGraphCatalogValidationReport & {
  formalConsumerAuthority: 'LEGACY';
  canonicalReadiness: KaqCatalogBindingReadiness | null;
  consumerProjection: KaqCanonicalConsumerProjection | null;
} {
  const base = validateAutocontrolKaqGraphCatalog();
  if (!input?.bindings || !input.pinned) {
    return {
      ...base,
      formalConsumerAuthority: 'LEGACY',
      canonicalReadiness: null,
      consumerProjection: null,
    };
  }
  const intendedRoleIds = input.intendedRoleIds ?? listAutocontrolKaqKnowledgeRoleIds();
  const readiness = evaluateKaqCatalogCanonicalReadiness({
    intendedRoleIds,
    bindings: input.bindings,
    pinned: input.pinned,
  });
  const consumerProjection = projectKaqCatalogCanonicalBindingStatus({
    catalogVersion: AUTOCONTROL_KAQ_GRAPH_VERSION,
    intendedRoleIds,
    bindings: input.bindings,
    pinned: input.pinned,
  });
  return {
    ...base,
    formalConsumerAuthority: 'LEGACY',
    canonicalReadiness: readiness,
    consumerProjection,
  };
}
