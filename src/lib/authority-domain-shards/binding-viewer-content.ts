import type { ActiveResourceViewerContent } from '@/features/knowledge/active-authority-graph-contracts';
import {
  loadPlanningKnowledgeLabels,
  loadPlanningKnowledgeMeanings,
} from '@/features/personalization/path-planning/planning-resource-titles';
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
    const safeId = publishedInfographSafeIdForToken(token, sourcePath);
    if (!safeId) return null;
    return {
      imageSrc: `/api/knowledge/published-infograph/${encodeURIComponent(safeId)}`,
    };
  }
  return null;
}

export function presentPublishedKnowledgeCard(input: {
  resourceId: string;
  title: string;
  canonicalIds: readonly string[];
  card: { summary: string; insight: string | null; explanation: string };
}): { title: string; summary: string; explanation: string } {
  const labels = loadPlanningKnowledgeLabels();
  const meanings = loadPlanningKnowledgeMeanings();
  const zhTitle = input.canonicalIds
    .map((id) => labels.get(id))
    .find((label) => Boolean(label && /[\u4e00-\u9fff]/u.test(label)));
  const zhMeaning = input.canonicalIds.map((id) => meanings.get(id)).find((value) => Boolean(value?.trim()));
  const strippedTitle = input.title.replace(/\s*\|\s*[A-Za-z][A-Za-z0-9._-]*\s*$/u, '').trim();
  const title = zhTitle || strippedTitle || input.title;
  const summary = zhMeaning?.trim() || input.card.summary;
  const explanationLooksEnglish = /[A-Za-z]{8,}/u.test(input.card.explanation)
    && !/[\u4e00-\u9fff]/u.test(input.card.explanation);
  const explanation = zhMeaning && explanationLooksEnglish ? zhMeaning : input.card.explanation;
  return { title, summary, explanation };
}
