import type { TeacherAiGradingLabDatasetStore } from './teacher-ai-grading-lab-dataset-store';
import { isVisualEvidenceBlock, visualEvidenceContentHash } from './teacher-ai-grading-lab-evaluation-records';

type OverviewDb = Record<string, any>;

export interface TeacherAiGradingLabOverview {
  datasets: Array<{ datasetId: string; datasetVersion: string; datasetKind: 'synthetic' | 'pilot' | 'preflight' | 'first-round'; sampleCount: number; questionCount: number }>;
  configurations: Array<{ configurationVersion: string; datasetId: string; datasetVersion: string; splitId: string; createdAt: string }>;
  batches: Array<{ evaluationRunId: string; configurationVersion: string; state: string; totalExecutions: number; completedCount: number; failedCount: number; retryableCount: number; hiddenAcceptanceState: string | null; updatedAt: string }>;
  executions: Array<{ evaluationRunId: string; sampleId: string; questionId: string; repetitionOrdinal: number; state: string; aiScore: number | null; teacherScore: number | null; failureStage: string | null; errorCode: string | null }>;
  pdfVerifications: Array<{ acceptanceId: string; sampleId: string; derivativeId: string; expectedRevision: number; status: string; blockingDefect: boolean | null }>;
  annotationJudgments: Array<{ sampleId: string; questionId: string; judgmentVersion: string }>;
  pendingBlindAnnotations: Array<{ executionId: string; gradingAnnotationId: string; sampleId: string; questionId: string }>;
  pendingBlindVisualEvidence: Array<{ executionId: string; visualEvidenceId: string; evidenceContentHash: string; sampleId: string; questionId: string; description: string; pageNumber: number | null; bbox: unknown; confidence: number | null }>;
}

export async function getTeacherAiGradingLabOverview(input: {
  db: OverviewDb;
  datasetStore: TeacherAiGradingLabDatasetStore;
}): Promise<TeacherAiGradingLabOverview> {
  const [datasets, configurations, batches, executions, pdfVerifications, annotationJudgments, visualEvidenceJudgments] = await Promise.all([
    input.datasetStore.list(),
    input.db.teacherAiGradingExperimentConfig.findMany({
      select: { id: true, datasetId: true, datasetVersion: true, splitId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    input.db.teacherAiGradingExperimentBatch.findMany({
      select: {
        id: true, configId: true, state: true, totalExecutions: true, completedCount: true,
        failedCount: true, retryableCount: true, updatedAt: true,
        hiddenAcceptance: { select: { state: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    input.db.teacherAiGradingExperimentExecution.findMany({
      select: {
        id: true, batchId: true, configId: true, sampleId: true, questionId: true,
        repetitionOrdinal: true, state: true, failureStage: true, errorCode: true,
        gradingRun: {
          select: {
            draftTotalScore: true,
            annotations: { select: { id: true } },
            answerEvidence: {
              select: {
                blocks: {
                  select: { id: true, text: true, markdown: true, pageNumber: true, bbox: true, confidence: true, sourceHash: true },
                },
              },
            },
          },
        },
        annotationJudgments: { select: { gradingAnnotationId: true } },
        batch: { select: { hiddenAcceptance: { select: { state: true } } } },
      },
      orderBy: { updatedAt: 'desc' }, take: 500,
    }),
    input.db.teacherAiGradingPdfVerification.findMany({
      select: { acceptanceId: true, sampleId: true, derivativeId: true, revision: true, blockingDefect: true, acceptance: { select: { state: true } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    }),
    input.db.teacherAiGradingAnnotationJudgment.findMany({
      select: { id: true, execution: { select: { sampleId: true, questionId: true, batch: { select: { hiddenAcceptance: { select: { state: true } } } } } } },
      orderBy: { createdAt: 'desc' }, take: 500,
    }),
    input.db.teacherAiGradingVisualEvidenceBlindJudgment.findMany({
      select: { configId: true, visualEvidenceId: true, execution: { select: { batch: { select: { hiddenAcceptance: { select: { state: true } } } } } } },
      orderBy: { createdAt: 'desc' }, take: 500,
    }),
  ]);
  const terminalBatchIds = new Set(batches.filter((row: any) => ['SUCCEEDED', 'PARTIAL', 'FAILED'].includes(row.state)).map((row: any) => row.id));
  const configurationIdsWithTerminalRuns = new Set(batches
    .filter((row: any) => terminalBatchIds.has(row.id))
    .map((row: any) => row.configId));
  const baselineEntries = await Promise.all(configurations.filter((row: any) => configurationIdsWithTerminalRuns.has(row.id)).map(async (row: any) => {
    const dataset = await input.datasetStore.load({ datasetId: row.datasetId, datasetVersion: row.datasetVersion });
    return [row.id, new Map(dataset.baseline.samples.flatMap((sample) => sample.questions.map((question) => [`${sample.sampleId}:${question.questionId}`, question.teacherScore] as const)))] as const;
  }));
  const baselineByConfig = new Map<string, Map<string, number>>(baselineEntries);
  const visibleExecutionRows = executions.filter((row: any) => row.batch.hiddenAcceptance?.state === undefined || row.batch.hiddenAcceptance.state === 'CONSUMED');
  const judgedVisualEvidence = new Set(visualEvidenceJudgments
    .filter((row: any) => row.execution.batch.hiddenAcceptance?.state === undefined || row.execution.batch.hiddenAcceptance.state === 'CONSUMED')
    .map((row: any) => `${row.configId}:${row.visualEvidenceId}`));
  const pendingVisualEvidence = new Map<string, TeacherAiGradingLabOverview['pendingBlindVisualEvidence'][number]>();
  for (const row of visibleExecutionRows) {
    for (const block of row.gradingRun?.answerEvidence?.blocks ?? []) {
      if (!isVisualEvidenceBlock(block)) continue;
      const key = `${row.configId}:${block.id}`;
      if (judgedVisualEvidence.has(key) || pendingVisualEvidence.has(key)) continue;
      pendingVisualEvidence.set(key, {
        executionId: row.id,
        visualEvidenceId: block.id,
        evidenceContentHash: visualEvidenceContentHash(block),
        sampleId: row.sampleId,
        questionId: row.questionId,
        description: block.text,
        pageNumber: block.pageNumber ?? null,
        bbox: block.bbox ?? null,
        confidence: block.confidence ?? null,
      });
    }
  }
  return {
    datasets,
    configurations: configurations.map((row: any) => ({
      configurationVersion: row.id, datasetId: row.datasetId, datasetVersion: row.datasetVersion,
      splitId: row.splitId, createdAt: row.createdAt.toISOString(),
    })),
    batches: batches.map((row: any) => ({
      evaluationRunId: row.id, configurationVersion: row.configId, state: row.state,
      totalExecutions: row.totalExecutions, completedCount: row.completedCount,
      failedCount: row.failedCount, retryableCount: row.retryableCount,
      hiddenAcceptanceState: row.hiddenAcceptance?.state ?? null, updatedAt: row.updatedAt.toISOString(),
    })),
    executions: visibleExecutionRows.map((row: any) => ({
      evaluationRunId: row.batchId, sampleId: row.sampleId, questionId: row.questionId, repetitionOrdinal: row.repetitionOrdinal,
      state: row.state, aiScore: row.gradingRun?.draftTotalScore ?? null,
      teacherScore: terminalBatchIds.has(row.batchId) ? baselineByConfig.get(row.configId)?.get(`${row.sampleId}:${row.questionId}`) ?? null : null,
      failureStage: row.failureStage, errorCode: row.errorCode,
    })),
    pdfVerifications: pdfVerifications.filter((row: any) => row.acceptance.state === 'CONSUMED').map((row: any) => ({
      acceptanceId: row.acceptanceId, sampleId: row.sampleId, derivativeId: row.derivativeId, expectedRevision: row.revision,
      status: row.blockingDefect === null ? 'pending' : row.blockingDefect ? 'blocked' : 'passed',
      blockingDefect: row.blockingDefect,
    })),
    annotationJudgments: annotationJudgments.filter((row: any) => row.execution.batch.hiddenAcceptance?.state === undefined || row.execution.batch.hiddenAcceptance.state === 'CONSUMED').map((row: any) => ({
      sampleId: row.execution.sampleId, questionId: row.execution.questionId, judgmentVersion: row.id,
    })),
    pendingBlindAnnotations: visibleExecutionRows.flatMap((row: any) => {
      const judged = new Set(row.annotationJudgments.map((item: any) => item.gradingAnnotationId));
      return row.gradingRun.annotations.filter((item: any) => !judged.has(item.id)).map((item: any) => ({ executionId: row.id, gradingAnnotationId: item.id, sampleId: row.sampleId, questionId: row.questionId }));
    }),
    pendingBlindVisualEvidence: [...pendingVisualEvidence.values()],
  };
}
