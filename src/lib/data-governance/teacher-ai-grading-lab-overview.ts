import type { TeacherAiGradingLabDatasetStore } from './teacher-ai-grading-lab-dataset-store';
import { isVisualEvidenceBlock, visualEvidenceContentHash } from './teacher-ai-grading-lab-evaluation-records';

type OverviewDb = Record<string, any>;

export interface TeacherAiGradingLabOverview {
  datasets: Array<{ datasetId: string; datasetVersion: string; datasetKind: 'synthetic' | 'pilot' | 'preflight' | 'first-round'; sampleCount: number; questionCount: number }>;
  incompatibleDatasets: Array<{ datasetId: string; datasetVersion: string; reason: string }>;
  configurations: Array<{ configurationVersion: string; datasetId: string; datasetVersion: string; splitId: string; createdAt: string }>;
  batches: Array<{ evaluationRunId: string; configurationVersion: string; state: string; totalExecutions: number; completedCount: number; failedCount: number; retryableCount: number; hiddenAcceptanceState: string | null; updatedAt: string }>;
  metrics: { completedRate: number | null; meanAbsoluteScoreDifference: number | null; exactScoreRate: number | null; threeRunExactStabilityRate: number | null };
  metricsByRun: Array<{ evaluationRunId: string; configurationVersion: string; splitId: string; partition: 'tuning' | 'hidden'; visibility: 'revealed' | 'sealed'; configurationContentHash: string | null; completedRate: number | null; meanAbsoluteScoreDifference: number | null; exactScoreRate: number | null; threeRunExactStabilityRate: number | null }>;
  executions: Array<{ evaluationRunId: string; sampleId: string; questionId: string; repetitionOrdinal: number; state: string; aiScore: number | null; draftScore: number | null; teacherScore: number | null; scoreDifference: number | null; failureStage: string | null; errorCode: string | null }>;
  pdfVerifications: Array<{ acceptanceId: string; sampleId: string; derivativeId: string; previewHref: string; expectedRevision: number; status: string; blockingDefect: boolean | null }>;
  annotationJudgments: Array<{ sampleId: string; questionId: string; judgmentVersion: string }>;
  pendingBlindAnnotations: Array<{ executionId: string; gradingAnnotationId: string; sampleId: string; questionId: string; excerpt: string; reason: string | null; comment: string; pageNumber: number | null; precision: string }>;
  pendingBlindVisualEvidence: Array<{ executionId: string; visualEvidenceId: string; evidenceContentHash: string; sampleId: string; questionId: string; description: string; pageNumber: number | null; bbox: unknown; confidence: number | null }>;
}

export async function getTeacherAiGradingLabOverview(input: {
  db: OverviewDb;
  datasetStore: TeacherAiGradingLabDatasetStore;
}): Promise<TeacherAiGradingLabOverview> {
  const [datasetListing, configurations, batches, executions, pdfVerifications, annotationJudgments, visualEvidenceJudgments] = await Promise.all([
    input.datasetStore.list(),
    input.db.teacherAiGradingExperimentConfig.findMany({
      select: { id: true, datasetId: true, datasetVersion: true, splitId: true, contentHash: true, metricVersion: true, splitContentHash: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    input.db.teacherAiGradingExperimentBatch.findMany({
      select: {
        id: true, configId: true, state: true, totalExecutions: true, completedCount: true,
        splitId: true,
        failedCount: true, retryableCount: true, updatedAt: true,
        hiddenAcceptance: { select: { state: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    input.db.teacherAiGradingExperimentExecution.findMany({
      select: {
        id: true, batchId: true, configId: true, sampleId: true, questionId: true,
        splitId: true,
        repetitionOrdinal: true, state: true, failureStage: true, errorCode: true, rawOutputObjectKey: true,
        gradingRun: {
          select: {
            aiTotalScore: true,
            draftTotalScore: true,
            annotations: { select: { id: true, excerpt: true, reason: true, comment: true, pageNumber: true, precision: true } },
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
      orderBy: { updatedAt: 'desc' },
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
  const terminalBatchIds = new Set<string>();
  for (const batch of batches.filter((row: any) => row.state === 'SUCCEEDED')) {
    const rows = executions.filter((row: any) => belongsToBatch(row, batch));
    if (rows.length === 0) continue;
    const complete = rows.length === Number(batch.totalExecutions)
      && rows.every((row: any) => row.state === 'SUCCEEDED'
      && typeof row.rawOutputObjectKey === 'string'
      && (row.gradingRun?.aiTotalScore ?? row.gradingRun?.draftTotalScore) !== null
      && (row.gradingRun?.aiTotalScore ?? row.gradingRun?.draftTotalScore) !== undefined);
    if (complete) terminalBatchIds.add(batch.id);
  }
  const configurationIdsWithTerminalRuns = new Set(batches
    .filter((row: any) => terminalBatchIds.has(row.id))
    .map((row: any) => row.configId));
  const baselineEntries = await Promise.all(configurations.filter((row: any) => configurationIdsWithTerminalRuns.has(row.id)).map(async (row: any) => {
    const dataset = await input.datasetStore.load({ datasetId: row.datasetId, datasetVersion: row.datasetVersion });
    return [row.id, new Map(dataset.baseline.samples.flatMap((sample) => sample.questions.map((question) => [`${sample.sampleId}:${question.questionId}`, question.teacherScore] as const)))] as const;
  }));
  const baselineByConfig = new Map<string, Map<string, number>>(baselineEntries);
  const visibleExecutionRows = executions.filter((row: any) => {
    const batch = batches.find((candidate: any) => candidate.id === row.batchId);
    return (!batch || belongsToBatch(row, batch))
      && (row.batch.hiddenAcceptance?.state === undefined || row.batch.hiddenAcceptance.state === 'CONSUMED');
  });
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
  const metricsByRun = batches.map((batch: any) => {
    const hidden = Boolean(batch.hiddenAcceptance);
    const visibility = hidden && batch.hiddenAcceptance?.state !== 'CONSUMED' ? 'sealed' as const : 'revealed' as const;
    const rows = visibleExecutionRows.filter((row: any) => row.batchId === batch.id);
    const config = configurations.find((candidate: any) => candidate.id === batch.configId) ?? null;
    if (visibility === 'sealed') return runMetrics(batch, config, visibility, null, null, null, null);
    const pairs = rows.flatMap((row: any) => {
      const aiScore = row.gradingRun?.aiTotalScore ?? null;
      const teacherScore = terminalBatchIds.has(batch.id) ? baselineByConfig.get(batch.configId)?.get(`${row.sampleId}:${row.questionId}`) ?? null : null;
      return aiScore === null || teacherScore === null ? [] : [{ aiScore, teacherScore }];
    });
    const groups = new Map<string, number[]>();
    for (const row of rows) {
      const score = row.gradingRun?.aiTotalScore ?? null;
      if (score === null) continue;
      const key = `${row.sampleId}:${row.questionId}`;
      groups.set(key, [...(groups.get(key) ?? []), Number(score)]);
    }
    const completedGroups = [...groups.values()].filter((scores) => scores.length === 3);
    return runMetrics(batch, config, visibility, pairs, completedGroups, Number(batch.completedCount), Number(batch.totalExecutions));
  });
  const metrics = metricsByRun.length === 1 ? metricsByRun[0] : null;
  return {
    datasets: datasetListing.datasets,
    incompatibleDatasets: datasetListing.incompatible,
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
    metrics: metrics ? { completedRate: metrics.completedRate, meanAbsoluteScoreDifference: metrics.meanAbsoluteScoreDifference, exactScoreRate: metrics.exactScoreRate, threeRunExactStabilityRate: metrics.threeRunExactStabilityRate } : { completedRate: null, meanAbsoluteScoreDifference: null, exactScoreRate: null, threeRunExactStabilityRate: null },
    metricsByRun,
    executions: visibleExecutionRows.map((row: any) => {
      const aiScore = row.gradingRun?.aiTotalScore ?? null;
      const draftScore = row.gradingRun?.draftTotalScore ?? null;
      const teacherScore = terminalBatchIds.has(row.batchId)
        ? baselineByConfig.get(row.configId)?.get(`${row.sampleId}:${row.questionId}`) ?? null
        : null;
      return {
      evaluationRunId: row.batchId, sampleId: row.sampleId, questionId: row.questionId, repetitionOrdinal: row.repetitionOrdinal,
      state: row.state, aiScore, draftScore, teacherScore,
      scoreDifference: aiScore === null || teacherScore === null ? null : aiScore - teacherScore,
      failureStage: row.failureStage, errorCode: row.errorCode,
      };
    }),
    pdfVerifications: pdfVerifications.filter((row: any) => row.acceptance.state === 'CONSUMED').map((row: any) => ({
      acceptanceId: row.acceptanceId, sampleId: row.sampleId, derivativeId: row.derivativeId,
      previewHref: `/api/teacher/ai-grading-lab/pdf/${encodeURIComponent(row.derivativeId)}`,
      expectedRevision: row.revision,
      status: row.blockingDefect === null ? 'pending' : row.blockingDefect ? 'blocked' : 'passed',
      blockingDefect: row.blockingDefect,
    })),
    annotationJudgments: annotationJudgments.filter((row: any) => row.execution.batch.hiddenAcceptance?.state === undefined || row.execution.batch.hiddenAcceptance.state === 'CONSUMED').map((row: any) => ({
      sampleId: row.execution.sampleId, questionId: row.execution.questionId, judgmentVersion: row.id,
    })),
    pendingBlindAnnotations: visibleExecutionRows.flatMap((row: any) => {
      const judged = new Set(row.annotationJudgments.map((item: any) => item.gradingAnnotationId));
      return row.gradingRun.annotations.filter((item: any) => !judged.has(item.id)).map((item: any) => ({
        executionId: row.id, gradingAnnotationId: item.id, sampleId: row.sampleId, questionId: row.questionId,
        excerpt: item.excerpt, reason: item.reason, comment: item.comment, pageNumber: item.pageNumber, precision: item.precision,
      }));
    }),
    pendingBlindVisualEvidence: [...pendingVisualEvidence.values()],
  };
}

function belongsToBatch(row: any, batch: any): boolean {
  return row.batchId === batch.id && row.configId === batch.configId && (row.splitId === undefined || row.splitId === batch.splitId);
}

function runMetrics(batch: any, config: any, visibility: 'revealed' | 'sealed', pairs: Array<{ aiScore: number; teacherScore: number }> | null, completedGroups: number[][] | null, completedCount: number | null, totalCount: number | null) {
  return {
    evaluationRunId: batch.id,
    configurationVersion: batch.configId,
    splitId: batch.splitId ?? config?.splitId ?? '',
    partition: batch.hiddenAcceptance ? 'hidden' as const : 'tuning' as const,
    visibility,
    configurationContentHash: config?.contentHash ?? null,
    completedRate: completedCount === null || totalCount === null || totalCount === 0 ? null : completedCount / totalCount,
    meanAbsoluteScoreDifference: pairs && pairs.length ? pairs.reduce((sum, pair) => sum + Math.abs(pair.aiScore - pair.teacherScore), 0) / pairs.length : null,
    exactScoreRate: pairs && pairs.length ? pairs.filter((pair) => pair.aiScore === pair.teacherScore).length / pairs.length : null,
    threeRunExactStabilityRate: completedGroups && completedGroups.length ? completedGroups.filter((scores) => scores.every((score) => score === scores[0])).length / completedGroups.length : null,
  };
}
