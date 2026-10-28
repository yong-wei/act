import { join } from 'node:path';

import { loadDomainSearchIndexShard, loadRootShard } from '@/lib/authority-domain-shards';
import { buildLearningFactCrosswalkIndex } from '@/lib/canonical-learning-fact-identity/crosswalk-serving';
import { resolveConfiguredTeachingProjectionRoot } from '@/lib/layered-graph/course-page-context';
import { prisma } from '@/lib/prisma';
import { loadLegacyCrosswalk } from '@/lib/teaching-projection/crosswalk';

import {
  buildActiveAuthorityMasteryOverlay,
  emptyMasteryOverlay,
  type ActiveAuthorityMasteryOverlay,
  type MasteryDomainMembership,
  type MasteryEvidenceFact,
} from '.';

/** Bounded per-namespace read; the overlay keeps only the latest 20 per object. */
const MASTERY_FACT_READ_LIMIT = 5000;

const SCORABLE_FACT_FILTER = {
  OR: [
    { score: { not: null } },
    { outcome: { in: ['success', 'partial', 'failure'] } },
  ],
};

const FACT_SELECT = {
  id: true,
  outcome: true,
  score: true,
  startedAt: true,
  knowledgeIdentityNamespace: true,
  canonicalObjectId: true,
  aggregateReleaseSetId: true,
  aggregateReleaseId: true,
  knowledgeProjectionId: true,
  knowledgeRevisionRef: true,
} as const;

function legacyNamespaceFilter() {
  return { OR: [{ knowledgeIdentityNamespace: 'LEGACY' }, { knowledgeIdentityNamespace: null }] };
}

export function activeLegacyCrosswalkPath(): string {
  return join(resolveConfiguredTeachingProjectionRoot(), 'legacy-crosswalk.jsonl');
}

function activeDomainMemberships(): MasteryDomainMembership[] {
  return loadRootShard().root.domains.map((domain) => ({
    visualRole: domain.visualRole,
    memberIds: loadDomainSearchIndexShard(domain.visualRole).entries.map((entry) => entry.id),
  }));
}

/** Reads only the signed-in learner's own facts; never writes or backfills. */
export async function loadActiveAuthorityMasteryOverlay(userId: string): Promise<ActiveAuthorityMasteryOverlay> {
  const crosswalk = buildLearningFactCrosswalkIndex(loadLegacyCrosswalk(activeLegacyCrosswalkPath()).entries);
  const canonicalFacts = await prisma.learningFact.findMany({
    where: {
      userId,
      knowledgeIdentityNamespace: 'CANONICAL',
      canonicalObjectId: { not: null },
      ...SCORABLE_FACT_FILTER,
    },
    orderBy: { startedAt: 'desc' },
    take: MASTERY_FACT_READ_LIMIT,
    select: FACT_SELECT,
  });

  const legacyWhere = { userId, AND: [legacyNamespaceFilter(), SCORABLE_FACT_FILTER] };
  let legacyFacts: MasteryEvidenceFact[] = [];
  let unmappableLegacyCount = 0;
  if (crosswalk.byLegacyId.size > 0) {
    legacyFacts = await prisma.learningFact.findMany({
      where: legacyWhere,
      orderBy: { startedAt: 'desc' },
      take: MASTERY_FACT_READ_LIMIT,
      select: { ...FACT_SELECT, contextJson: true },
    });
  } else {
    unmappableLegacyCount = await prisma.learningFact.count({ where: legacyWhere });
  }

  const facts: MasteryEvidenceFact[] = [...canonicalFacts, ...legacyFacts];
  if (facts.length === 0) {
    return emptyMasteryOverlay({ unresolvedFactCount: unmappableLegacyCount });
  }
  const overlay = buildActiveAuthorityMasteryOverlay({
    facts,
    crosswalk,
    domains: activeDomainMemberships(),
  });
  if (overlay.status === 'not-applicable' || unmappableLegacyCount === 0) return overlay;
  return {
    ...overlay,
    coverage: {
      ...overlay.coverage,
      unresolvedFactCount: overlay.coverage.unresolvedFactCount + unmappableLegacyCount,
    },
  };
}
