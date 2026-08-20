import type { KonlingCitation, KonlingRuntimeContext } from '@/lib/konling-agent-runtime';
import type { KonlingTeachingAssistantServerModeContext } from '@/lib/konling-agent-runtime';

import { hydrateTextbookCoachCitation } from './citations';
import type { TextbookCoachUnavailableReason } from './identity';
import { boundTextbookCoachPrompt } from './prompt';
import type { TextbookCoachContext } from './types';

interface TextbookCoachServerBag {
  structuredTextbook?: TextbookCoachContext;
  textbookCoachFailure?: TextbookCoachUnavailableReason;
}

export function readTextbookCoachServerBag(
  context: KonlingTeachingAssistantServerModeContext | null | undefined,
): TextbookCoachServerBag {
  return (context ?? {}) as TextbookCoachServerBag;
}

export function applyTextbookCoachRuntimeContext(
  runtimeContext: KonlingRuntimeContext,
  serverModeContext: KonlingTeachingAssistantServerModeContext | null | undefined,
): KonlingRuntimeContext {
  const bag = readTextbookCoachServerBag(serverModeContext);
  if (!bag.structuredTextbook || !runtimeContext.citationContext) return runtimeContext;
  const hydrated = hydrateTextbookCoachCitation(bag.structuredTextbook);
  const citation: KonlingCitation = {
    id: hydrated.citationId,
    sourceType: 'content',
    displayTitle: hydrated.title,
    href: hydrated.href,
    displayHref: hydrated.href,
    canonicalHref: hydrated.href,
    confidence: hydrated.verified ? 'high' : 'none',
    evidenceBasis: 'structured-textbook-unit',
    owner: 'answer',
    verified: hydrated.verified,
    resolver: 'server-owned-runtime',
    citationTargetId: hydrated.citationId,
  };
  const boundedBody = boundTextbookCoachPrompt(
    bag.structuredTextbook.fragmentMarkdown ?? bag.structuredTextbook.unitMarkdown,
    bag.structuredTextbook.selectionHint,
  );
  return {
    ...runtimeContext,
    pageContext: {
      ...runtimeContext.pageContext,
      topic: bag.structuredTextbook.title,
      learningObjectives: boundedBody
        ? [boundedBody]
        : runtimeContext.pageContext.learningObjectives,
    },
    citationContext: {
      ...runtimeContext.citationContext,
      contentCitations: [
        citation,
        ...runtimeContext.citationContext.contentCitations,
      ],
    },
  };
}
