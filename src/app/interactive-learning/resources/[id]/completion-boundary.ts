import type { WidgetResult } from '@/resources/widgets/widget-props';

export function selectResourceCompletionHandler(
  registryId: string | null | undefined,
  completePathResource: (result?: WidgetResult) => Promise<void>,
  handlePathResourceComplete: (result?: WidgetResult) => Promise<void>,
) {
  return registryId === 'lesson15-series-precheck'
    ? completePathResource
    : handlePathResourceComplete;
}
