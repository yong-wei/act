import { createPrismaClient } from '../../src/lib/prisma-client';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getAllRegisteredResourceMetadata } from '../../src/lib/resource-registry-metadata';
import {
  buildResourceNodeRegistryFromTeachingResources,
  loadRuntimeResourceProjectionInputs,
} from '../../src/lib/teacher-resource-node-data';
import {
  buildDataCompletenessAuditReport,
  renderDataCompletenessAuditMarkdown,
  type DataCompletenessLearnerCandidateInput,
  type DataCompletenessReviewedGraphResourceCoverageInput,
  type DataCompletenessRuntimeArtifactErrorInput,
} from '../../src/lib/data-governance/data-completeness-audit';
import {
  loadAllTextbookStructureRuntimeCatalogEntries,
  loadAllTextbookStructureUnitProjections,
} from '../../src/lib/structured-textbook-runtime';
import { textbookStructureUnitsToLearningEvidenceCorpus } from '../../src/lib/data-governance/graph-center-evidence';
import { loadAllLessonRuntimeResourceCatalogEntriesForAudit } from './runtime-lesson-catalog';

const prisma = createPrismaClient();
const GRAPH_RESOURCE_COVERAGE_REVIEWED_ITEMS_PATH = path.join(
  process.cwd(),
  'course-content/runtime/resource-governance/graph-resource-coverage-reviewed-items.jsonl',
);

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
  const runtimeArtifactErrors: DataCompletenessRuntimeArtifactErrorInput[] = [];

  const [
    knowledgeNodes,
    teachingResources,
    runtimeLessons,
    runtimeTextbooks,
    runtimeResourceProjections,
    textbookUnits,
    interactionLogs,
    eventDictionary,
    learningEventBatches,
    learningFacts,
    documentGradingRuns,
    documentRubricDrafts,
    historicalSimulationLogs,
    historicalUserAnswers,
    historicalAiInterventions,
    historicalPromptAssessments,
    studentCompetencySnapshots,
    studentProfileSummaries,
    studentEvidenceFeatureCaches,
    reviewedGraphResourceCoverage,
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
    loadRuntimeLessonsWithArtifactAudit(runtimeArtifactErrors),
    loadAllTextbookStructureRuntimeCatalogEntries(),
    loadRuntimeResourceProjectionInputs(),
    loadAllTextbookStructureUnitProjections(),
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
    prisma.gradingRun.findMany({
      where: { state: 'APPROVED' },
      select: { id: true, state: true, rubricVersion: true, assessments: { select: { criterionId: true } }, answerAttempt: { select: { answer: { select: { submission: { select: { frozenStudentId: true } } } } } } },
    }),
    prisma.learningEvidenceDraft.findMany({
      where: { sourceType: 'document_rubric_grading' },
      select: { id: true, ownerUserId: true, reviewerState: true, summary: true },
    }),
    prisma.simulationLog.findMany({ select: { id: true, userId: true } }),
    prisma.userAnswer.findMany({ select: { id: true, userId: true } }),
    prisma.aIIntervention.findMany({ select: { id: true, userId: true } }),
    prisma.promptAssessment.findMany({ select: { id: true, userId: true } }),
    prisma.studentCompetencySnapshot.findMany({ select: { userId: true } }),
    prisma.studentProfileSummary.findMany({ select: { userId: true } }),
    prisma.studentEvidenceFeatureCache.findMany({
      select: {
        userId: true,
        sourceFactCount: true,
        sourceCoverage: true,
        refreshedAt: true,
        statusMarkers: true,
      },
    }),
    readJsonlIfExists<DataCompletenessReviewedGraphResourceCoverageInput>(GRAPH_RESOURCE_COVERAGE_REVIEWED_ITEMS_PATH),
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
    reviewedGraphResourceCoverage,
    teachingResources: teachingResources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      registryId: resource.registryId,
      knowledgeNodeIds: resource.knowledgeNodes.map((node) => node.id),
    })),
    resourceRegistry: registry,
    runtimeArtifactErrors,
    evidenceCorpus: textbookStructureUnitsToLearningEvidenceCorpus(textbookUnits),
    interactionLogs,
    eventDictionaryTypes: eventDictionary.map((event) => event.eventType),
    learningEventBatches,
    learningFacts,
    documentGradingRuns: documentGradingRuns.map((run) => ({ id: run.id, state: run.state, rubricVersion: run.rubricVersion, studentId: run.answerAttempt.answer.submission.frozenStudentId, assessments: run.assessments })),
    documentRubricDrafts: documentRubricDrafts
      .map(toDocumentRubricDraftAuditInput)
      .filter((draft): draft is NonNullable<ReturnType<typeof toDocumentRubricDraftAuditInput>> => Boolean(draft)),
    historicalSourceLogIds: [
      ...historicalSimulationLogs,
      ...historicalUserAnswers,
      ...historicalAiInterventions,
      ...historicalPromptAssessments,
    ],
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

async function readJsonlIfExists<T>(filePath: string): Promise<T[]> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function loadRuntimeLessonsWithArtifactAudit(
  runtimeArtifactErrors: DataCompletenessRuntimeArtifactErrorInput[],
) {
  try {
    return await loadAllLessonRuntimeResourceCatalogEntriesForAudit();
  } catch (error) {
    runtimeArtifactErrors.push({
      id: 'runtime-lessons',
      message: normalizeErrorMessage(error),
    });
    return [];
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
        statusMarkers: true,
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
            statusMarkers: featureCache.statusMarkers,
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

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toDocumentRubricDraftAuditInput(draft: { id: string; ownerUserId: string; reviewerState: string; summary: unknown }) {
  const summary = asRecord(draft.summary);
  const run = asRecord(summary?.run);
  const rubric = asRecord(summary?.rubric);
  const runId = asString(run?.id);
  const rubricId = asString(rubric?.id);
  const rubricVersion = asString(run?.rubricVersion) ?? asString(rubric?.version);
  const approvedGrades = Array.isArray(run?.approvedGrades) ? run.approvedGrades : [];
  const approvedCriterionIds = approvedGrades
    .map((grade) => asString(asRecord(grade)?.criterionId))
    .filter((criterionId): criterionId is string => Boolean(criterionId));
  if (!runId || !rubricId || !rubricVersion) return null;
  return {
    id: draft.id,
    ownerUserId: draft.ownerUserId,
    reviewerState: draft.reviewerState,
    runId,
    rubricId,
    rubricVersion,
    approvedCriterionIds,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

main()
  .catch((error) => {
    console.error('[DataCompletenessAudit] Report failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
