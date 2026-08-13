/**
 * Data-driven teaching relation presentation (#1370).
 *
 * Consumers resolve presentation from the registered runtime contract by the
 * published relationType. No per-release frontend allowlist of edge IDs.
 */

import {
  DOMAIN_TEACHING_RELATION_PRESENTATION_CONTRACT,
  isRegisteredTeachingRelationType,
  TEACHING_RELATION_PRESENTATION_REGISTRY,
  type DomainFragmentRelationPublished,
  type RegisteredTeachingRelationType,
  type TeachingRelationPresentationContract,
  type TeachingRelationPresentationFamily,
} from './contracts';

export interface TeachingRelationPresentationResolution {
  relationType: string;
  supported: boolean;
  presentation: TeachingRelationPresentationContract | null;
  /** Product notice when the relation type lacks a presentation registration. */
  notice: string | null;
}

/**
 * Resolve presentation for a published teaching relation type.
 * Unregistered types are omitted from product rendering with a bounded notice.
 */
export function resolveTeachingRelationPresentation(
  relationType: string,
): TeachingRelationPresentationResolution {
  if (!isRegisteredTeachingRelationType(relationType)) {
    return {
      relationType,
      supported: false,
      presentation: null,
      notice: '关系暂不可解释',
    };
  }
  const presentation = TEACHING_RELATION_PRESENTATION_REGISTRY[relationType];
  if (!presentation.supported) {
    return {
      relationType,
      supported: false,
      presentation,
      notice: '关系暂不可解释',
    };
  }
  return {
    relationType,
    supported: true,
    presentation,
    notice: null,
  };
}

/**
 * Filter published relations to those with a supported presentation family.
 * Future registered types appear automatically after projection activation.
 */
export function selectPresentableTeachingRelations(
  relations: readonly DomainFragmentRelationPublished[],
): {
  presentable: DomainFragmentRelationPublished[];
  omitted: Array<{ edgeId: string; relationType: string; notice: string }>;
} {
  const presentable: DomainFragmentRelationPublished[] = [];
  const omitted: Array<{ edgeId: string; relationType: string; notice: string }> = [];

  for (const relation of relations) {
    const resolved = resolveTeachingRelationPresentation(relation.relationType);
    if (resolved.supported) {
      presentable.push(relation);
    } else {
      omitted.push({
        edgeId: relation.edgeId,
        relationType: relation.relationType,
        notice: resolved.notice ?? '关系暂不可解释',
      });
    }
  }

  return { presentable, omitted };
}

/**
 * Domain-matched view: a relation enters every domain shard listed in domainKeys.
 * No frontend release allowlist is consulted.
 */
export function relationsForDomain(
  relations: readonly DomainFragmentRelationPublished[],
  domainId: string,
): DomainFragmentRelationPublished[] {
  return relations
    .filter((relation) => relation.domainKeys.includes(domainId as never))
    .filter((relation) => resolveTeachingRelationPresentation(relation.relationType).supported)
    .slice()
    .sort((a, b) => {
      if (a.edgeId < b.edgeId) return -1;
      if (a.edgeId > b.edgeId) return 1;
      return 0;
    });
}

export function listRegisteredTeachingPresentationFamilies(): TeachingRelationPresentationFamily[] {
  return Object.values(TEACHING_RELATION_PRESENTATION_REGISTRY)
    .filter((entry) => entry.supported)
    .map((entry) => entry.presentationFamily);
}

export function listRegisteredTeachingRelationTypes(): RegisteredTeachingRelationType[] {
  return Object.keys(
    TEACHING_RELATION_PRESENTATION_REGISTRY,
  ) as RegisteredTeachingRelationType[];
}

export function teachingRelationPresentationContractId(): typeof DOMAIN_TEACHING_RELATION_PRESENTATION_CONTRACT {
  return DOMAIN_TEACHING_RELATION_PRESENTATION_CONTRACT;
}
