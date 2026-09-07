import type { ActiveResourceViewerContent } from '@/features/knowledge/active-authority-graph-contracts';
import type { TeachingResourceRuntime, TeachingResourceType } from '@/lib/teaching-projection/contracts';

import {
  publishedInfographSafeIdForToken,
  readPublishedLearnerCardByToken,
} from './learning-content';

function tokenAfterPrefix(resourceId: string, prefix: string): string | null {
  if (!resourceId.startsWith(prefix)) return null;
  const token = resourceId.slice(prefix.length);
  return token.length > 0 ? token : null;
}

export function resolveBindingViewerContent(
  resource: Pick<TeachingResourceRuntime, 'resourceId' | 'resourceType' | 'sourcePath'>,
): ActiveResourceViewerContent | null {
  return resolveBindingViewerContentForType(
    resource.resourceId,
    resource.resourceType,
    resource.sourcePath,
  );
}

export function resolveBindingViewerContentForType(
  resourceId: string,
  resourceType: TeachingResourceType | null,
  sourcePath?: string | null,
): ActiveResourceViewerContent | null {
  if (resourceType === 'card') {
    const token = tokenAfterPrefix(resourceId, 'act:card:');
    if (!token) return null;
    const card = readPublishedLearnerCardByToken(token, sourcePath);
    if (!card) return null;
    return {
      summary: card.summary,
      insight: card.insight,
      explanation: card.explanation,
    };
  }
  if (resourceType === 'infographic') {
    const token = tokenAfterPrefix(resourceId, 'act:infographic:');
    if (!token) return null;
    const safeId = publishedInfographSafeIdForToken(token);
    if (!safeId) return null;
    return {
      imageSrc: `/api/knowledge/published-infograph/${encodeURIComponent(safeId)}`,
    };
  }
  return null;
}
