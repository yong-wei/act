import { evaluateWhiteBoxSubmission } from '../evaluation/whitebox-evaluator';
import type { ControlAnalysisService } from '../evaluation/control-analysis-service';
import type { ArenaEvaluationResult } from '../evaluation/types';
import type { ChallengeTask, ControllerArtifact } from '../types';
import type { ArenaSubmissionRecord } from './submission-service';
import {
  buildControllerArtifactFromParams,
  type EvaluableControllerMethod,
} from './controller-artifact-builder';
import { assertSupportedArenaPreviewMethod } from '@/lib/control-engine';
import { computeAnalysisBrowser } from '@/lib/control-engine/client';
import { PREVIEW_DISPLAY_BOUNDARY } from '@/lib/practice-lab-run-contract/types';

export interface ArenaWorkbenchMetricDelta {
  metricId: string;
  currentValue: number | null;
  previousValue: number | null;
  delta: number | null;
}

export interface ArenaWorkbenchPreviewComparison {
  scoreDelta: number;
  metricDeltas: ArenaWorkbenchMetricDelta[];
}

export interface ArenaWorkbenchPreview {
  artifact: ControllerArtifact;
  evaluation: ArenaEvaluationResult;
  comparison?: ArenaWorkbenchPreviewComparison;
  persisted: typeof PREVIEW_DISPLAY_BOUNDARY.persisted;
  evaluationVisibility: typeof PREVIEW_DISPLAY_BOUNDARY.evaluationVisibility;
  officialEligible: typeof PREVIEW_DISPLAY_BOUNDARY.officialEligible;
}

function createBrowserPreviewAnalysisService(): ControlAnalysisService {
  return {
    async compute(request) {
      const envelope = await computeAnalysisBrowser(request);
      return {
        ...envelope.result,
        runtimeIdentity: envelope.runtimeIdentity,
      };
    },
  };
}

function finiteMetric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function buildComparison(
  task: ChallengeTask,
  evaluation: ArenaEvaluationResult,
  previousSubmission?: ArenaSubmissionRecord,
): ArenaWorkbenchPreviewComparison | undefined {
  if (!previousSubmission) return undefined;

  return {
    scoreDelta: evaluation.score - previousSubmission.evaluation.score,
    metricDeltas: task.primaryMetrics.map((metricId) => {
      const currentValue = finiteMetric(evaluation.metrics[metricId]);
      const previousValue = finiteMetric(previousSubmission.evaluation.metrics[metricId]);
      return {
        metricId,
        currentValue,
        previousValue,
        delta: currentValue !== null && previousValue !== null ? currentValue - previousValue : null,
      };
    }),
  };
}

export async function buildArenaWorkbenchPreview({
  task,
  method,
  values,
  previousSubmission,
  now,
  analysisService,
}: {
  task: ChallengeTask;
  method: EvaluableControllerMethod;
  values: Record<string, string>;
  previousSubmission?: ArenaSubmissionRecord;
  now?: string;
  analysisService?: ControlAnalysisService;
}): Promise<ArenaWorkbenchPreview> {
  assertSupportedArenaPreviewMethod(method);
  const artifact = buildControllerArtifactFromParams({ task, method, values, now });
  const evaluation = await evaluateWhiteBoxSubmission({
    taskId: task.id,
    artifact,
    metricProviderMode: 'control-engine-preview',
    controlAnalysisService: analysisService ?? createBrowserPreviewAnalysisService(),
  });

  return {
    artifact,
    evaluation: {
      ...evaluation,
      explanation: [
        ...evaluation.explanation,
        '工作台预览不是官方评测，不写入提交、榜单或正式能力达成。',
      ],
      metadata: {
        ...evaluation.metadata,
        evaluationVisibility: PREVIEW_DISPLAY_BOUNDARY.evaluationVisibility,
        officialEligible: PREVIEW_DISPLAY_BOUNDARY.officialEligible,
        persisted: PREVIEW_DISPLAY_BOUNDARY.persisted,
        authoritySource: analysisService ? 'control-engine-server-facade' : 'control-engine-browser-facade',
      },
    },
    comparison: buildComparison(task, evaluation, previousSubmission),
    persisted: PREVIEW_DISPLAY_BOUNDARY.persisted,
    evaluationVisibility: PREVIEW_DISPLAY_BOUNDARY.evaluationVisibility,
    officialEligible: PREVIEW_DISPLAY_BOUNDARY.officialEligible,
  };
}
