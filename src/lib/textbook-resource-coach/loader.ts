import {
  loadStructuredTextbookBook,
  type StructuredTextbookBook,
  type StructuredTextbookFragment,
  type StructuredTextbookUnit,
} from '@/lib/structured-textbook-runtime';
import {
  authorizeTextbookAccess,
  TEXTBOOK_COURSE_ID,
  TextbookReaderError,
} from '@/lib/textbook-reader';

import {
  boundSelectionHint,
  canonicalizeTextbookCoachIdentity,
  declaredTextbookCoachKind,
  hasUntrustedIdentityPayload,
  hashTextbookMarkdown,
  identitiesEqual,
  isUnsupportedTextbookCoachKind,
  STRUCTURED_TEXTBOOK_UNIT_KIND,
  type StructuredTextbookUnitIdentity,
  type TextbookCoachUnavailableReason,
} from './identity';
import type { TextbookCoachContext } from './types';

export type { TextbookCoachContext } from './types';

export interface TextbookCoachFailure {
  status: 'unavailable';
  reason: TextbookCoachUnavailableReason;
}

export type TextbookCoachLoadResult = TextbookCoachContext | TextbookCoachFailure;

export interface LoadTextbookCoachContextInput {
  actorUserId: string | null | undefined;
  declared?: unknown;
  pinned?: StructuredTextbookUnitIdentity | null;
  selectionHint?: unknown;
  runtimeRoot?: string;
  loadBook?: (bookId: string, runtimeRoot?: string) => Promise<StructuredTextbookBook>;
}

export async function loadTextbookCoachContext(
  input: LoadTextbookCoachContextInput,
): Promise<TextbookCoachLoadResult> {
  const declaredKind = declaredTextbookCoachKind(input.declared);
  if (!input.pinned && isUnsupportedTextbookCoachKind(declaredKind)) {
    return fail('unsupported-resource-type');
  }
  const declaredIdentity = canonicalizeTextbookCoachIdentity(input.declared);
  if (input.pinned && declaredIdentity && !identitiesEqual(input.pinned, declaredIdentity)) {
    // Client replay cannot replace the pinned identity.
  }
  if (hasUntrustedIdentityPayload(input.declared) && !input.pinned && !declaredIdentity) {
    return fail('identity-tampered');
  }
  const identity = input.pinned ?? declaredIdentity;
  if (!identity) {
    if (declaredKind === STRUCTURED_TEXTBOOK_UNIT_KIND) return fail('identity-invalid');
    return fail('unsupported-resource-type');
  }

  try {
    authorizeTextbookAccess({ userId: input.actorUserId, courseId: TEXTBOOK_COURSE_ID });
  } catch (error) {
    if (error instanceof TextbookReaderError && error.code === 'unauthorized') {
      return fail('unauthorized');
    }
    throw error;
  }

  let book: StructuredTextbookBook;
  try {
    book = input.loadBook
      ? await input.loadBook(identity.bookId, input.runtimeRoot)
      : await loadStructuredTextbookBook(identity.bookId, input.runtimeRoot);
  } catch {
    return fail('revision-unavailable');
  }

  if (book.manifest.bookId !== identity.bookId || book.manifest.edition !== identity.edition) {
    return fail('identity-tampered');
  }
  if (book.manifest.sourceRevision !== identity.sourceRevision) {
    return fail('revision-unavailable');
  }

  const unit = book.units.find((entry) => entry.id === identity.unitId);
  if (!unit) return fail('revision-unavailable');
  if (identity.resourceId !== unit.id) return fail('identity-tampered');

  const contentHash = hashTextbookMarkdown(unit.markdown);
  if (contentHash !== identity.contentHash) {
    return fail(input.pinned ? 'hash-drift' : 'identity-tampered');
  }

  const fragments = book.fragments.filter((fragment) => fragment.owningUnitId === unit.id);
  let fragment: StructuredTextbookFragment | null = null;
  if (identity.anchorId) {
    fragment = fragments.find((entry) => fragmentAnchorId(entry) === identity.anchorId) ?? null;
    if (!fragment) return fail('anchor-unavailable');
  }

  const verifiedIdentity: StructuredTextbookUnitIdentity = {
    ...identity,
    contentHash,
    anchorId: identity.anchorId ?? null,
  };
  const citationId = verifiedIdentity.anchorId
    ? `textbook-fragment:${verifiedIdentity.unitId}#${verifiedIdentity.anchorId}`
    : `textbook-unit:${verifiedIdentity.unitId}`;

  return {
    status: 'ready',
    identity: verifiedIdentity,
    title: unit.title,
    unitMarkdown: unit.markdown,
    fragmentMarkdown: fragment ? excerptFragment(unit, fragment) : null,
    selectionHint: boundSelectionHint(input.selectionHint, unit.markdown),
    citation: {
      citationId,
      title: fragment ? `${unit.title} · ${verifiedIdentity.anchorId}` : unit.title,
      identity: verifiedIdentity,
    },
    structuralPath: [...unit.structuralPath],
  };
}

function fail(reason: TextbookCoachUnavailableReason): TextbookCoachFailure {
  return { status: 'unavailable', reason };
}

function fragmentAnchorId(fragment: StructuredTextbookFragment): string {
  return fragment.id.slice(fragment.id.lastIndexOf('#') + 1);
}

function excerptFragment(unit: StructuredTextbookUnit, fragment: StructuredTextbookFragment): string {
  const start = Math.max(0, fragment.sourceSpan.startLine - unit.sourceSpan.startLine);
  const lines = unit.markdown.split(/\r?\n/);
  return lines.slice(start, start + 8).join('\n') || unit.markdown;
}
