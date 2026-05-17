import { buildControllerArtifactFromParams, type EvaluableControllerMethod } from '@/features/arena/submissions/controller-artifact-builder';
import type { ChallengeTask, ControllerArtifact } from '@/features/arena/types';
import { PREDICTIVE_WORKBENCH_OFFICIAL_ONLY_METRIC_IDS } from '@/features/arena/workbench/official-only-metrics';

export type PredictiveControlMethod = Extract<EvaluableControllerMethod, 'mpc' | 'optimized-pid'>;

export interface PredictiveControlDraft {
  predictionHorizon: string;
  controlHorizon: string;
  outputWeight: string;
  controlWeight: string;
  terminalWeight: string;
  inputLimit: string;
  sampleTime: string;
  speedWeight: string;
  energyWeight: string;
  robustnessWeight: string;
  overshootWeight: string;
  searchBudget: string;
}

export interface OfficialOnlyMetricPreview {
  id: string;
  label: string;
  localValue: null;
  note: string;
}

export const DEFAULT_PREDICTIVE_CONTROL_DRAFT: PredictiveControlDraft = {
  predictionHorizon: '18',
  controlHorizon: '5',
  outputWeight: '1.40',
  controlWeight: '0.32',
  terminalWeight: '2.00',
  inputLimit: '4.50',
  sampleTime: '0.10',
  speedWeight: '1.20',
  energyWeight: '0.70',
  robustnessWeight: '1.40',
  overshootWeight: '0.90',
  searchBudget: '80',
};

export const PREDICTIVE_OFFICIAL_ONLY_METRICS: OfficialOnlyMetricPreview[] = [
  {
    id: PREDICTIVE_WORKBENCH_OFFICIAL_ONLY_METRIC_IDS[0],
    label: '隐藏场景最差表现：仅官方评测后显示',
    localValue: null,
    note: '本地模板预览不生成隐藏场景占位数值。',
  },
];

export function predictiveControlDraftToValues(
  method: PredictiveControlMethod,
  draft: PredictiveControlDraft,
): Record<string, string> {
  if (method === 'mpc') {
    return {
      predictionHorizon: draft.predictionHorizon,
      controlHorizon: draft.controlHorizon,
      outputWeight: draft.outputWeight,
      controlWeight: draft.controlWeight,
      terminalWeight: draft.terminalWeight,
      inputLimit: draft.inputLimit,
      sampleTime: draft.sampleTime,
    };
  }

  return {
    speedWeight: draft.speedWeight,
    energyWeight: draft.energyWeight,
    robustnessWeight: draft.robustnessWeight,
    overshootWeight: draft.overshootWeight,
    searchBudget: draft.searchBudget,
  };
}

export function buildPredictiveControlArtifactFromDraft({
  task,
  method,
  draft,
  now,
}: {
  task: ChallengeTask;
  method: PredictiveControlMethod;
  draft: PredictiveControlDraft;
  now?: string;
}): ControllerArtifact {
  return buildControllerArtifactFromParams({
    task,
    method,
    values: predictiveControlDraftToValues(method, draft),
    now,
  });
}
