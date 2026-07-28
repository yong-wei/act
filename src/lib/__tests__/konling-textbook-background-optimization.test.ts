import { describe, expect, it } from 'vitest';

import {
  assignKonlingCitationDisplayNumbers,
  type KonlingAssignedCitation,
} from '@/lib/konling-citation-protocol';
import {
  resolveKonlingTextbookOptimizations,
} from '@/lib/konling-textbook-background-optimization';
import type {
  TextbookV2ToolCandidate,
  TextbookV2ToolResult,
} from '@/lib/source-pack/textbook-v2-adapter';

function assigned(unitIds: string[]): KonlingAssignedCitation[] {
  return assignKonlingCitationDisplayNumbers(unitIds.map((unitId) => ({
    id: unitId,
    sourceType: 'textbook' as const,
    displayTitle: unitId,
    href: `/textbooks/book/edition/${unitId}`,
    identity: {
      kind: 'textbook' as const,
      bookId: 'book',
      edition: 'edition',
      sourceRevision: 'revision',
      unitId,
      fragmentId: null,
    },
  })));
}

function result(
  citations: readonly KonlingAssignedCitation[],
  unitIds: string[],
): TextbookV2ToolResult {
  const byId = new Map(citations.map((citation) => [
    citation.identity.kind === 'textbook' ? citation.identity.unitId : '',
    citation,
  ]));
  return {
    mode: 'lexical-vector',
    candidates: unitIds.map((unitId): TextbookV2ToolCandidate => ({
      displayNumber: byId.get(unitId)!.displayNumber,
      title: unitId,
      text: `正文 ${unitId}`,
      identity: {
        kind: 'unit',
        unitId,
        fragmentId: null,
        bookId: 'book',
        edition: 'edition',
        sourceRevision: 'revision',
        structuralPath: [unitId],
      },
      href: `/textbooks/book/edition/${unitId}`,
      priority: 0,
      limitation: null,
    })),
    limitations: [],
    diagnostics: [],
  };
}

describe('Konling textbook background optimization', () => {
  it('treats added unused candidates as equivalent and requests zero regeneration', async () => {
    const citations = assigned(['unit-a', 'unit-b']);
    const decision = await resolveKonlingTextbookOptimizations({
      optimizations: [{
        toolCallId: 'tool-1',
        foreground: result(citations, ['unit-a']),
        continuation: Promise.resolve({
          status: 'complete',
          result: result(citations, ['unit-a', 'unit-b']),
        }),
      }],
      assignedCitations: () => citations,
      usedTextbookCanonicalKeys: [citations[0].canonicalKey],
    });
    expect(decision.material).toBe(false);
    expect(decision.finalTextbookCitations.map((citation) => citation.canonicalKey))
      .toEqual(citations.map((citation) => citation.canonicalKey));
  });

  it('marks a preferred-key change as material while retaining one stable message plan', async () => {
    const citations = assigned(['unit-a', 'unit-b']);
    const decision = await resolveKonlingTextbookOptimizations({
      optimizations: [{
        toolCallId: 'tool-1',
        foreground: result(citations, ['unit-a', 'unit-b']),
        continuation: Promise.resolve({
          status: 'complete',
          result: result(citations, ['unit-b', 'unit-a']),
        }),
      }],
      assignedCitations: () => citations,
      usedTextbookCanonicalKeys: [citations[0].canonicalKey],
    });
    expect(decision.material).toBe(true);
    expect(decision.finalResults).toHaveLength(1);
  });

  it('marks disappearance of actually used evidence as material across stable tool-call ordering', async () => {
    const citations = assigned(['unit-a', 'unit-b', 'unit-c']);
    const decision = await resolveKonlingTextbookOptimizations({
      optimizations: [
        {
          toolCallId: 'tool-b',
          foreground: result(citations, ['unit-c']),
          continuation: Promise.resolve({ status: 'capped' }),
        },
        {
          toolCallId: 'tool-a',
          foreground: result(citations, ['unit-a', 'unit-b']),
          continuation: Promise.resolve({
            status: 'complete',
            result: result(citations, ['unit-a']),
          }),
        },
      ],
      assignedCitations: () => citations,
      usedTextbookCanonicalKeys: [
        citations[1].canonicalKey,
        citations[2].canonicalKey,
      ],
    });
    expect(decision.material).toBe(true);
    expect(decision.finalResults.map((entry) => entry.toolCallId))
      .toEqual(['tool-a', 'tool-b']);
    expect(decision.finalTextbookCitations.map((citation) => citation.canonicalKey))
      .toEqual([citations[0].canonicalKey, citations[2].canonicalKey]);
  });
});
