/**
 * Deterministic sources-input entries from the approved mapping ledger.
 *
 * Materialize must rebuild this set and compare — a matching coverageDigest
 * alone does not prove the citation entries still equal the governed ledger.
 */

import { TEXTBOOK_ID_ALIASES } from './aliases';
import {
  EngineeringTextbookMappingError,
  NODE_SOURCES_LIMIT,
  candidateKeyOf,
  type MappingCandidateRow,
  type MappingReviewRow,
  type MappingSourcesInputFile,
  type NodeSourceCitation,
} from './contracts';
import { effectiveVerdicts } from './ledger';

const READER_BOOK_LABEL: Readonly<Record<string, string>> = {
  'dorf-modern-control-systems': 'Modern Control Systems (Dorf/Bishop, 14th)',
  'feedback-control-of-dynamic-systems': 'Feedback Control of Dynamic Systems (Franklin, 7th)',
  'hu-shousong-auto-control-8th': '自动控制原理（胡寿松，第8版）',
};

export function sourceDocumentIdForReaderBook(readerBookId: string): string {
  const row = TEXTBOOK_ID_ALIASES.find((alias) => alias.readerBookId === readerBookId);
  if (!row) {
    throw new EngineeringTextbookMappingError(
      'alias-missing',
      `approved candidate references book outside the alias table: ${readerBookId}`,
    );
  }
  return row.sourceDocumentId;
}

export function citationLabelForCandidate(row: MappingCandidateRow): string {
  const book = READER_BOOK_LABEL[row.bookId] ?? row.bookId;
  return `${book} · ${row.unitTitle}`.slice(0, 140);
}

export function buildGovernedSourcesEntries(input: {
  candidateRows: readonly MappingCandidateRow[];
  reviews: readonly MappingReviewRow[];
  nodeLimit?: number;
}): MappingSourcesInputFile['entries'] {
  const nodeLimit = input.nodeLimit ?? NODE_SOURCES_LIMIT;
  const verdicts = effectiveVerdicts(input.reviews);
  const rowsByNode = new Map<string, MappingCandidateRow[]>();
  for (const row of input.candidateRows) {
    if (verdicts.get(candidateKeyOf(row))?.verdict !== 'approved') continue;
    const list = rowsByNode.get(row.canonicalId) ?? [];
    list.push(row);
    rowsByNode.set(row.canonicalId, list);
  }

  const entries: MappingSourcesInputFile['entries'] = [];
  for (const canonicalId of [...rowsByNode.keys()].sort()) {
    const rows = rowsByNode.get(canonicalId)!
      .slice()
      .sort((left, right) => left.rank - right.rank)
      .slice(0, nodeLimit);
    const sources: NodeSourceCitation[] = rows.map((row) => ({
      sourceEditionId: sourceDocumentIdForReaderBook(row.bookId),
      sectionId: row.structuralUnitId,
      label: citationLabelForCandidate(row),
    }));
    entries.push({ nodeId: canonicalId, sources });
  }
  return entries;
}

export function verifySourcesInputMatchesApprovedMappings(input: {
  sources: MappingSourcesInputFile;
  candidateRows: readonly MappingCandidateRow[];
  reviews: readonly MappingReviewRow[];
}): void {
  if (input.sources.nodeLimit !== NODE_SOURCES_LIMIT) {
    throw new EngineeringTextbookMappingError(
      'sources-ledger-mismatch',
      `sources-input nodeLimit ${input.sources.nodeLimit} != governed NODE_SOURCES_LIMIT ${NODE_SOURCES_LIMIT}`,
    );
  }
  const expected = buildGovernedSourcesEntries({
    candidateRows: input.candidateRows,
    reviews: input.reviews,
    nodeLimit: input.sources.nodeLimit,
  });
  const actual = JSON.stringify(input.sources.entries);
  const rebuilt = JSON.stringify(expected);
  if (actual !== rebuilt) {
    throw new EngineeringTextbookMappingError(
      'sources-ledger-mismatch',
      'sources-input entries do not match the approved mapping ledger; regenerate sources-input from the current governed ledgers',
    );
  }
}
