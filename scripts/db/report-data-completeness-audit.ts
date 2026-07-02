import { createPrismaClient } from '../../src/lib/prisma-client';
import { getAllRegisteredResourceMetadata } from '../../src/lib/resource-registry-metadata';
import {
  buildResourceNodeRegistryFromTeachingResources,
  loadRuntimeResourceProjectionInputs,
} from '../../src/lib/teacher-resource-node-data';
import {
  buildDataCompletenessAuditReport,
  renderDataCompletenessAuditMarkdown,
  type DataCompletenessLearnerCandidateInput,
} from '../../src/lib/data-governance/data-completeness-audit';
import { loadAllLessonRuntimeResourceCatalogEntries } from '../../src/lib/course-runtime';
import {
  loadAllTextbookRuntimeResourceCatalogEntries,
  loadAllTextbookRuntimeSearchDocuments,
} from '../../src/lib/textbook-runtime-resources';
import { textbookSearchDocumentsToLearningEvidenceCorpus } from '../../src/lib/data-governance/graph-center-evidence';

const prisma = createPrismaClient();

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function readOption(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  const format = readOption('--format') ?? (hasFlag('--markdown') ? 'markdown' : 'json');
  const canonicalEmail = readOption('--canonical-email');
  const canonicalStudentNumber = readOption('--canonical-student-number') ?? '20230010102605';

  const [
    knowledgeNodes,
    teachingResources,
    runtimeLessons,
    runtimeTextbooks,
    runtimeResourceProjections,
    textbookDocuments,
    interactionLogs,
    eventDictionary,
    learningEventBatches,
    learningFacts,
    studentCompetencySnapshots,
    studentProfileSummaries,
    studentEvidenceFeatureCaches,
  ] = await Promise.all([
    prisma.knowledgeNode.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        resources: true,
        isActive: true,
        sourceLinks: { select: { id: true } },
        targetLinks: { select: { id: true } },
      },
    }),
    prisma.teachingResource.findMany({
      select: {
        id: true,
        title: true,
        displayName: true,
        description: true,
        type: true,
        registryId: true,
        content: true,
        category: true,
        teacherOnly: true,
        config: true,
        knowledgeNodes: {
          select: {
            id: true,
            name: true,
            resources: true,
            tags: true,
          },
        },
      },
    }),
    loadAllLessonRuntimeResourceCatalogEntries(),
    loadAllTextbookRuntimeResourceCatalogEntries(),
    loadRuntimeResourceProjectionInputs(),
    loadAllTextbookRuntimeSearchDocuments(),
    prisma.interactionLog.findMany({
      select: {
        id: true,
        userId: true,
        eventType: true,
        clientEventId: true,
        attemptKey: true,
        resourceKey: true,
        clientEventAt: true,
        createdAt: true,
      },
    }),
    prisma.eventDictionary.findMany({ select: { eventType: true } }),
    prisma.learningEventBatch.findMany({
      select: {
        id: true,
        eventCount: true,
        processedAt: true,
      },
    }),
    prisma.learningFact.findMany({
      select: {
        id: true,
        userId: true,
        factType: true,
        sourceEventId: true,
        sourceLogId: true,
        sessionId: true,
        startedAt: true,
        contextJson: true,
      },
    }),
    prisma.studentCompetencySnapshot.findMany({ select: { userId: true } }),
    prisma.studentProfileSummary.findMany({ select: { userId: true } }),
    prisma.studentEvidenceFeatureCache.findMany({
      select: {
        userId: true,
        sourceFactCount: true,
        sourceCoverage: true,
        refreshedAt: true,
      },
    }),
  ]);

  const registry = buildResourceNodeRegistryFromTeachingResources(
    teachingResources,
    getAllRegisteredResourceMetadata(),
    runtimeLessons,
    runtimeTextbooks,
    runtimeResourceProjections,
  );
  const learnerCandidates = await collectLearnerCandidates(canonicalStudentNumber, canonicalEmail);

  const report = buildDataCompletenessAuditReport({
    knowledgeNodes: knowledgeNodes.map((node) => ({
      id: node.id,
      name: node.name,
      description: node.description,
      tags: node.tags,
      resources: node.resources,
      isActive: node.isActive,
      sourceLinkCount: node.sourceLinks.length,
      targetLinkCount: node.targetLinks.length,
    })),
    teachingResources: teachingResources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      registryId: resource.registryId,
      knowledgeNodeIds: resource.knowledgeNodes.map((node) => node.id),
    })),
    resourceRegistry: registry,
    evidenceCorpus: textbookSearchDocumentsToLearningEvidenceCorpus(textbookDocuments),
    interactionLogs,
    eventDictionaryTypes: eventDictionary.map((event) => event.eventType),
    learningEventBatches,
    learningFacts,
    studentCompetencySnapshots,
    studentProfileSummaries,
    studentEvidenceFeatureCaches,
    learnerCandidates,
    canonicalLearner: {
      displayName: 'Yang Fan',
      email: canonicalEmail,
      studentNumber: canonicalStudentNumber,
    },
  });

  if (format === 'markdown') {
    console.log(renderDataCompletenessAuditMarkdown(report));
  } else {
    console.log(JSON.stringify(report, null, hasFlag('--compact') ? 0 : 2));
  }
}

async function collectLearnerCandidates(
  canonicalStudentNumber: string | null,
  canonicalEmail: string | null,
): Promise<DataCompletenessLearnerCandidateInput[]> {
  const users = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      OR: [
        { name: { contains: '杨帆' } },
        { name: { contains: 'Yang Fan', mode: 'insensitive' } },
        ...(canonicalEmail ? [{ email: canonicalEmail }] : []),
        ...(canonicalStudentNumber ? [{ profile: { studentNumber: canonicalStudentNumber } }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      profile: { select: { studentNumber: true } },
    },
  });
  if (users.length === 0) return [];

  const userIds = users.map((user) => user.id);
  const [
    learningFacts,
    knowledgeProgress,
    pathExecutions,
    snapshots,
    profileSummaries,
    featureCaches,
    adaptiveSessions,
    adaptiveAnswers,
    adaptiveAbilityEstimates,
  ] = await Promise.all([
    prisma.learningFact.groupBy({ by: ['userId'], where: { userId: { in: userIds } }, _count: { _all: true } }),
    prisma.knowledgeProgress.groupBy({ by: ['userId'], where: { userId: { in: userIds } }, _count: { _all: true } }),
    prisma.learningPathExecution.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, evidenceRefs: true },
    }),
    prisma.studentCompetencySnapshot.groupBy({ by: ['userId'], where: { userId: { in: userIds } }, _count: { _all: true } }),
    prisma.studentProfileSummary.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true },
    }),
    prisma.studentEvidenceFeatureCache.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        sourceFactCount: true,
        sourceCoverage: true,
        refreshedAt: true,
      },
    }),
    prisma.adaptiveAssessmentSession.groupBy({ by: ['userId'], where: { userId: { in: userIds } }, _count: { _all: true } }),
    prisma.adaptiveAssessmentAnswer.groupBy({ by: ['userId'], where: { userId: { in: userIds } }, _count: { _all: true } }),
    prisma.adaptiveAssessmentAbilityEstimate.groupBy({ by: ['userId'], where: { userId: { in: userIds } }, _count: { _all: true } }),
  ]);

  const factCount = countByUser(learningFacts);
  const progressCount = countByUser(knowledgeProgress);
  const snapshotCount = countByUser(snapshots);
  const profileSummaryUserIds = new Set(profileSummaries.map((summary) => summary.userId));
  const cacheByUser = new Map(featureCaches.map((cache) => [cache.userId, cache]));
  const adaptiveSessionCount = countByUser(adaptiveSessions);
  const adaptiveAnswerCount = countByUser(adaptiveAnswers);
  const adaptiveAbilityEstimateCount = countByUser(adaptiveAbilityEstimates);
  const pathExecutionStats = new Map<string, { count: number; evidenceRefCount: number }>();
  for (const execution of pathExecutions) {
    const current = pathExecutionStats.get(execution.userId) ?? { count: 0, evidenceRefCount: 0 };
    current.count += 1;
    current.evidenceRefCount += Array.isArray(execution.evidenceRefs) ? execution.evidenceRefs.length : 0;
    pathExecutionStats.set(execution.userId, current);
  }

  return users.map((user) => {
    const pathStats = pathExecutionStats.get(user.id) ?? { count: 0, evidenceRefCount: 0 };
    const featureCache = cacheByUser.get(user.id);
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      studentNumber: user.profile?.studentNumber ?? null,
      learningFactCount: factCount.get(user.id) ?? 0,
      knowledgeProgressCount: progressCount.get(user.id) ?? 0,
      pathExecutionCount: pathStats.count,
      pathExecutionEvidenceRefCount: pathStats.evidenceRefCount,
      competencySnapshotCount: snapshotCount.get(user.id) ?? 0,
      profileSummaryCount: profileSummaryUserIds.has(user.id) ? 1 : 0,
      featureCache: featureCache
        ? {
            sourceFactCount: featureCache.sourceFactCount,
            sourceCoverage: featureCache.sourceCoverage,
            refreshedAt: featureCache.refreshedAt,
          }
        : null,
      adaptiveAssessmentStateCount: (
        (adaptiveSessionCount.get(user.id) ?? 0) +
        (adaptiveAnswerCount.get(user.id) ?? 0) +
        (adaptiveAbilityEstimateCount.get(user.id) ?? 0)
      ),
    };
  });
}

function countByUser(rows: Array<{ userId: string; _count: { _all: number } }>) {
  return new Map(rows.map((row) => [row.userId, row._count._all]));
}

main()
  .catch((error) => {
    console.error('[DataCompletenessAudit] Report failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
