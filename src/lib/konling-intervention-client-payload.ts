import type { InterventionPayload, InterventionType } from '@/features/personalization/interventions/policy';
import type { KonlingInterventionRecord } from '@/lib/konling-agent-runtime';

export interface KonlingInterventionClientFields {
  intervention: InterventionPayload;
  interventionId: string;
  canSubmitFeedback: boolean;
}

export function buildKonlingInterventionClientFields(
  intervention: KonlingInterventionRecord,
): KonlingInterventionClientFields {
  return {
    intervention: {
      feedbackType: toClientFeedbackType(intervention.interventionType),
      content: intervention.content || intervention.whyNow,
      suggestedNextSteps: intervention.alternatives,
      relatedConcepts: intervention.relatedConcepts,
      highlightParams: intervention.highlightParams.length > 0 ? intervention.highlightParams : ['kp'],
      showTrendPrediction: intervention.showTrendPrediction,
    },
    interventionId: intervention.id,
    canSubmitFeedback: Boolean(intervention.id && intervention.shouldIntervene),
  };
}

function toClientFeedbackType(value: string): InterventionType {
  if (value === 'failure-analysis' || value === 'constraint-hint' || value === 'guidance') return value;
  return 'encouragement';
}
