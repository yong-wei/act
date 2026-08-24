import { hydrateCitationFromAddress } from '@/lib/source-pack/citation-hydrator';
import type { SourcePackCitation } from '@/lib/source-pack/types';

import { identitiesEqual, type StructuredTextbookUnitIdentity } from './identity';
import type { TextbookCoachContext } from './types';
import { extractVersionBoundHandle } from './href';
import {
  issueTextbookVersionBoundHref,
  verifyTextbookVersionBoundHandle,
} from './navigation-handle';

export type TextbookCitationLimitation =
  | 'unverified-citation'
  | 'version-changed'
  | 'location-unavailable'
  | 'unauthorized';

export interface HydratedTextbookCoachCitation {
  citationId: string;
  title: string;
  href: string | null;
  verified: boolean;
  limitation: TextbookCitationLimitation | null;
  identity: StructuredTextbookUnitIdentity;
}

export function hydrateTextbookCoachCitation(
  context: TextbookCoachContext,
  proposed?: {
    citationId?: string | null;
    href?: string | null;
    identity?: StructuredTextbookUnitIdentity | null;
  },
): HydratedTextbookCoachCitation {
  const identity = context.identity;
  if (proposed?.identity && !identitiesEqual(proposed.identity, identity)) {
    return limited(identity, context.citation.citationId, context.citation.title, 'unverified-citation');
  }
  if (proposed?.href && !extractVersionBoundHandle(proposed.href)) {
    return limited(identity, context.citation.citationId, context.citation.title, 'unverified-citation');
  }
  if (proposed?.citationId && proposed.citationId !== context.citation.citationId) {
    return limited(identity, context.citation.citationId, context.citation.title, 'unverified-citation');
  }

  const href = issueTextbookVersionBoundHref(identity, context.structuralPath);
  if (!href) {
    return limited(identity, context.citation.citationId, context.citation.title, 'location-unavailable');
  }

  const address = {
    kind: 'text' as const,
    sourceRefId: identity.unitId,
    href,
    locator: identity.anchorId ?? identity.unitId,
    contentHash: identity.contentHash,
  };
  const hydrated = hydrateCitationFromAddress(
    context.citation.citationId,
    identity.unitId,
    address,
    context.citation.title,
  );
  if (!hydrated.citation.verified || !hydrated.citation.href) {
    return limited(identity, context.citation.citationId, context.citation.title, 'unverified-citation');
  }
  return {
    citationId: context.citation.citationId,
    title: context.citation.title,
    href: hydrated.citation.href,
    verified: true,
    limitation: null,
    identity,
  };
}

export function resolveTextbookCitationClick(input: {
  href: string | null | undefined;
  pinned: StructuredTextbookUnitIdentity;
}): { ok: true; identity: StructuredTextbookUnitIdentity } | { ok: false; limitation: TextbookCitationLimitation } {
  const handle = extractVersionBoundHandle(input.href);
  if (!handle) return { ok: false, limitation: 'unverified-citation' };
  const identity = verifyTextbookVersionBoundHandle(handle);
  if (!identity) return { ok: false, limitation: 'unverified-citation' };
  if (!identitiesEqual(identity, input.pinned)) {
    return { ok: false, limitation: identity.sourceRevision === input.pinned.sourceRevision
      ? 'unverified-citation'
      : 'version-changed' };
  }
  return { ok: true, identity };
}

export function sourcePackCitationFromTextbook(
  citation: HydratedTextbookCoachCitation,
): SourcePackCitation {
  return {
    citationTargetId: citation.citationId,
    sourceId: citation.identity.unitId,
    displayTitle: citation.title,
    canonicalHref: citation.href ?? undefined,
    displayHref: citation.href ?? undefined,
    href: citation.href ?? undefined,
    resolver: 'server-owned-runtime',
    verified: citation.verified,
  };
}

function limited(
  identity: StructuredTextbookUnitIdentity,
  citationId: string,
  title: string,
  limitation: TextbookCitationLimitation,
): HydratedTextbookCoachCitation {
  return {
    citationId,
    title,
    href: null,
    verified: false,
    limitation,
    identity,
  };
}
