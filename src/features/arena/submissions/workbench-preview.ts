import { evaluateWhiteBoxSubmission } from '../evaluation/whitebox-evaluator';
import type { ArenaEvaluationResult } from '../evaluation/types';
import type { ChallengeTask, ControllerArtifact } from '../types';
import type { ArenaSubmissionRecord } from './submission-service';
import {
  buildControllerArtifactFromParams,
  type EvaluableControllerMethod,
} from './controller-artifact-builder';

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
}: {
  task: ChallengeTask;
  method: EvaluableControllerMethod;
  values: Record<string, string>;
  previousSubmission?: ArenaSubmissionRecord;
  now?: string;
}): Promise<ArenaWorkbenchPreview> {
  const artifact = buildControllerArtifactFromParams({ task, method, values, now });
  const evaluation = await evaluateWhiteBoxSubmission({
    taskId: task.id,
    artifact,
    metricProviderMode: 'template-preview',
  });

  return {
    artifact,
    evaluation,
    comparison: buildComparison(task, evaluation, previousSubmission),
  };
}
