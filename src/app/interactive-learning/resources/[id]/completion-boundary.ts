import type { WidgetResult } from '@/resources/widgets/widget-props';

export function selectResourceCompletionHandler(
  resourceId: string | undefined,
  completePathResource: (result?: WidgetResult) => Promise<void>,
  handlePathResourceComplete: (result?: WidgetResult) => Promise<void>,
) {
  return resourceId === 'lesson15-series-precheck'
    ? completePathResource
    : handlePathResourceComplete;
}
