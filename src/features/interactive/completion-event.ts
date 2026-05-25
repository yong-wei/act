import type { WidgetResult } from '@/resources/widgets/widget-props';
import { getEventMetadata } from '@/lib/data-governance/event-types';

interface ResolveInteractiveCompletionEventTypeInput {
  resultData: Record<string, unknown>;
  isStandaloneResource: boolean;
  standaloneCompletionEventType: string;
}

interface BuildInteractiveCompletionPayloadInput extends ResolveInteractiveCompletionEventTypeInput {
  result?: WidgetResult;
  basePayload: Record<string, unknown>;
}

export function readWidgetResultData(result?: WidgetResult): Record<string, unknown> {
  return result?.data && typeof result.data === 'object' && !Array.isArray(result.data)
    ? result.data
    : {};
}

export function resolveInteractiveCompletionEventType({
  resultData,
  isStandaloneResource,
  standaloneCompletionEventType,
}: ResolveInteractiveCompletionEventTypeInput): string {
  const requestedEventType = typeof resultData.eventType === 'string'
    ? resultData.eventType
    : null;

  if (requestedEventType && getEventMetadata(requestedEventType)) {
    return requestedEventType;
  }

  return isStandaloneResource ? standaloneCompletionEventType : 'assessment_complete';
}

export function buildInteractiveCompletionPayload({
  result,
  resultData,
  isStandaloneResource,
  standaloneCompletionEventType,
  basePayload,
}: BuildInteractiveCompletionPayloadInput): Record<string, unknown> {
  return {
    ...resultData,
    result,
    ...basePayload,
    eventType: resolveInteractiveCompletionEventType({
      resultData,
      isStandaloneResource,
      standaloneCompletionEventType,
    }),
  };
}
