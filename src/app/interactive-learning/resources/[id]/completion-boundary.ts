import type { WidgetResult } from '@/resources/widgets/widget-props';

const STRICT_PATH_COMPLETION_IDS = new Set(['lesson15-series-precheck']);
const STRICT_PATH_CONTINUE_IDS = new Set(['lesson13-cruise-bridge']);

export function selectResourceCompletionHandler(
  registryId: string | null | undefined,
  completePathResource: (result?: WidgetResult) => Promise<void>,
  handlePathResourceComplete: (result?: WidgetResult) => Promise<void>,
  continuePathAfterResourceComplete: (result?: WidgetResult) => Promise<void> = completePathResource,
) {
  if (STRICT_PATH_CONTINUE_IDS.has(registryId ?? '')) {
    return continuePathAfterResourceComplete;
  }
  return STRICT_PATH_COMPLETION_IDS.has(registryId ?? '')
    ? completePathResource
    : handlePathResourceComplete;
}
