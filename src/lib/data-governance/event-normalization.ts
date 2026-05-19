import { getCompetencyMapping, getEventMetadata } from './event-types';

const LEGACY_EVENT_TYPE_ALIASES: Record<string, string> = {
  view: 'page_view',
  interact: 'knowledge_card_open',
  param_change: 'param_change',
  submit: 'answer_submit',
  ai_query: 'ai_query_submit',
  complete: 'assessment_complete',
  error: 'sync_error',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function resolveCanonicalEventType(
  actionType: string,
  payload: Record<string, unknown> = {},
): string {
  const payloadEventType =
    typeof payload.eventType === 'string' ? payload.eventType : null;

  if (payloadEventType && getEventMetadata(payloadEventType)) {
    return payloadEventType;
  }

  if (getEventMetadata(actionType)) {
    return actionType;
  }

  return LEGACY_EVENT_TYPE_ALIASES[actionType] ?? payloadEventType ?? actionType;
}

export function mapActionTypeToFactType(actionType: string): string {
  const mapping: Record<string, string> = {
    answer_submit: 'question',
    assessment_complete: 'question',
    lesson_submit: 'question',
    lesson_resubmit: 'question',
    workspace_param_change: 'simulation',
    resource_complete: 'resource',
    simulation_finish: 'simulation',
    ai_intervention_complete: 'ai_intervention',
    prompt_assessed: 'prompt_design',
    design_session_complete: 'design',
    arena_challenge_open: 'resource',
    arena_workspace_start: 'design',
    arena_simulation_run: 'simulation',
    arena_controller_save: 'design',
    arena_identification_model_save: 'design',
    arena_virtual_simulation_import: 'simulation',
    arena_submit: 'design',
    arena_evaluation_complete: 'design',
    arena_result_view: 'design',
    arena_leaderboard_view: 'resource',
    arena_feedback_view: 'design',
    ethical_violation: 'ethical',
    ethical_resolved: 'ethical',
    session_finalize: 'question',
  };

  return mapping[actionType] || 'unknown';
}

function getNumericPayloadValue(
  payload: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

export function deriveFactScore(
  payload: Record<string, unknown> = {},
): number | undefined {
  return getNumericPayloadValue(payload, [
    'score',
    'totalScore',
    'overallScore',
    'consistencyScore',
  ]);
}

export function deriveFactOutcome(
  actionType: string,
  payload: Record<string, unknown> = {},
): string {
  if (typeof payload.outcome === 'string' && payload.outcome.trim().length > 0) {
    return payload.outcome;
  }

  if (typeof payload.isCorrect === 'boolean') {
    return payload.isCorrect ? 'success' : 'failure';
  }

  if (typeof payload.wasHelpful === 'boolean') {
    return payload.wasHelpful ? 'success' : 'failure';
  }

  const score = deriveFactScore(payload);
  if (typeof score === 'number') {
    if (score >= 80) return 'success';
    if (score >= 50) return 'partial';
    return 'failure';
  }

  if (actionType === 'ethical_violation') {
    return 'failure';
  }

  if (actionType === 'session_finalize') {
    if (
      payload.endedBeforeAssessment === true ||
      payload.endedBeforeSummary === true ||
      (
        typeof payload.completionRatio === 'number' &&
        Number.isFinite(payload.completionRatio) &&
        payload.completionRatio < 1
      )
    ) {
      return 'partial';
    }

    return 'success';
  }

  if (actionType === 'workspace_param_change' && payload.sampled === true) {
    return 'success';
  }

  if (
    actionType === 'ethical_resolved' ||
    actionType === 'lesson_submit' ||
    actionType === 'lesson_resubmit' ||
    actionType === 'resource_complete'
  ) {
    return 'success';
  }

  return 'unknown';
}

export function deriveFactTimeSpent(
  payload: Record<string, unknown> = {},
): number | undefined {
  const durationSeconds = getNumericPayloadValue(payload, ['durationSeconds']);
  if (typeof durationSeconds === 'number') {
    return Math.round(durationSeconds);
  }

  const value = getNumericPayloadValue(payload, [
    'timeSpent',
    'duration',
    'elapsedMs',
  ]);

  if (typeof value !== 'number') {
    return undefined;
  }

  if (value > 1000) {
    return Math.round(value / 1000);
  }

  return Math.round(value);
}

export function resolveCompetencyContribution(
  actionType: string,
  payload: Record<string, unknown> = {},
  derivedMetrics?: Record<string, number | string | boolean>,
): Record<string, number> {
  const payloadContribution = asRecord(payload.competencyContribution);
  if (payloadContribution) {
    const numericEntries = Object.entries(payloadContribution).filter(
      ([, value]) => typeof value === 'number' && Number.isFinite(value),
    );
    if (numericEntries.length > 0) {
      return Object.fromEntries(numericEntries) as Record<string, number>;
    }
  }

  if (derivedMetrics) {
    const numericEntries = Object.entries(derivedMetrics).filter(
      ([, value]) => typeof value === 'number' && Number.isFinite(value),
    ) as Array<[string, number]>;
    if (numericEntries.length > 0) {
      return Object.fromEntries(numericEntries) as Record<string, number>;
    }
  }

  return getCompetencyMapping(actionType) || {};
}
