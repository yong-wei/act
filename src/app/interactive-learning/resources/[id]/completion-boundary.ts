import type { WidgetResult } from '@/resources/widgets/widget-props';

type PathResourceCompletionHandler = (result?: WidgetResult) => Promise<void>;

/**
 * Path-launched resources share the #1694 continue contract: write completion,
 * propagate failures, and navigate from the server journey. Registry allowlists
 * are not a completion policy. Widgets that complete by browsing must not call
 * this handler until a visible next action exists.
 */
export function selectResourceCompletionHandler(
  _registryId: string | null | undefined,
  continuePathAfterResourceComplete: PathResourceCompletionHandler,
): PathResourceCompletionHandler {
  return continuePathAfterResourceComplete;
}
