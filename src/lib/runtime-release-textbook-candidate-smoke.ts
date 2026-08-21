import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadStructuredTextbookBook } from '@/lib/structured-textbook-runtime';
import { loadTextbookCatalog, loadTextbookReaderProjection } from '@/lib/textbook-reader';

const BOOK_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;
const PROVENANCE_V2 = 'act.textbook-runtime-input-provenance.v2';
const PROVENANCE_V1 = 'act.textbook-runtime-input-provenance.v1';

export interface TextbookCandidateSmokeResult {
  provenanceGeneration: 'v2' | 'legacy';
  bookIds: string[];
  resourceSetId: string | null;
  authoringSourceRevision: string | null;
}

function sorted(values: readonly string[]) {
  return [...values].sort();
}

function assertExactSet(expected: readonly string[], actual: readonly string[], message: string) {
  if (JSON.stringify(sorted(expected)) !== JSON.stringify(sorted(actual))) {
    throw new Error(`${message}: expected=${sorted(expected).join(',')} actual=${sorted(actual).join(',')}`);
  }
}

async function listRuntimeBookIds(runtimeRoot: string) {
  const entries = await readdir(runtimeRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && BOOK_ID_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function readProvenance(runtimeRoot: string) {
  const raw = JSON.parse(await readFile(path.join(runtimeRoot, 'input-provenance.json'), 'utf8')) as {
    schemaVersion?: string;
    sourceRevision?: string;
    authoringSourceRevision?: string;
    resourceSetId?: string;
    bookIds?: string[];
  };
  if (raw.schemaVersion === PROVENANCE_V2) {
    if (!Array.isArray(raw.bookIds) || raw.bookIds.length === 0) {
      throw new Error('candidate textbook v2 provenance book set is invalid');
    }
    return {
      generation: 'v2' as const,
      bookIds: raw.bookIds,
      resourceSetId: typeof raw.resourceSetId === 'string' ? raw.resourceSetId : null,
      authoringSourceRevision: raw.authoringSourceRevision ?? null,
    };
  }
  if (raw.schemaVersion !== PROVENANCE_V1) {
    throw new Error(`candidate textbook provenance schema is unsupported:${String(raw.schemaVersion)}`);
  }
  return {
    generation: 'legacy' as const,
    bookIds: null as string[] | null,
    resourceSetId: null,
    authoringSourceRevision: raw.sourceRevision ?? null,
  };
}

async function indexBookIds(indexRoot: string) {
  const manifest = JSON.parse(await readFile(path.join(indexRoot, 'manifest.json'), 'utf8')) as {
    books?: Array<{ bookId?: string } | string>;
    resourceSetId?: string;
    sourceRevision?: string;
  };
  const bookIds = Array.isArray(manifest.books)
    ? manifest.books.map((book) => (typeof book === 'string' ? book : book.bookId)).filter((bookId): bookId is string => typeof bookId === 'string')
    : [];
  return {
    bookIds,
    resourceSetId: typeof manifest.resourceSetId === 'string' ? manifest.resourceSetId : null,
    sourceRevision: typeof manifest.sourceRevision === 'string' ? manifest.sourceRevision : null,
  };
}

export async function smokeCandidateTextbookCorpus(input: {
  runtimeRoot: string;
  textbookRoot?: string;
  indexRoot?: string;
}): Promise<TextbookCandidateSmokeResult> {
  const textbookRoot = input.textbookRoot ?? path.join(input.runtimeRoot, 'resources', 'textbooks-v2');
  const indexRoot = input.indexRoot ?? path.join(input.runtimeRoot, 'resources', 'textbook-hybrid-retrieval', 'bge-m3');
  const provenance = await readProvenance(textbookRoot);
  const runtimeBookIds = await listRuntimeBookIds(textbookRoot);
  const catalog = await loadTextbookCatalog({ userId: 'candidate-runtime-smoke', runtimeRoot: textbookRoot });
  const catalogBookIds = catalog.map((entry) => entry.bookId);
  const expectedBookIds = provenance.bookIds ?? runtimeBookIds;
  if (expectedBookIds.length === 0) throw new Error('candidate textbook corpus has no books');
  assertExactSet(expectedBookIds, runtimeBookIds, 'candidate textbook runtime book set mismatch');
  assertExactSet(expectedBookIds, catalogBookIds, 'candidate textbook catalog book set mismatch');
  for (const bookId of expectedBookIds) {
    const matches = catalog.filter((entry) => entry.bookId === bookId);
    if (matches.length !== 1) {
      throw new Error(`candidate textbook catalog entry is ambiguous:${bookId}:${matches.length}`);
    }
    const catalogEntry = matches[0]!;
    const book = await loadStructuredTextbookBook(catalogEntry.bookId, textbookRoot);
    if (
      provenance.generation === 'v2'
      && provenance.authoringSourceRevision
      && book.manifest.sourceRevision !== provenance.authoringSourceRevision
    ) {
      throw new Error(`candidate textbook authoring revision mismatch:${bookId}`);
    }
    const unit = book.units.find((entry) => entry.structuralPath.length > 0);
    if (!unit) throw new Error(`candidate textbook has no readable structural unit:${bookId}`);
    const textbookProjection = await loadTextbookReaderProjection({
      userId: 'candidate-runtime-smoke',
      bookId: catalogEntry.bookId,
      edition: catalogEntry.edition,
      unitPath: unit.structuralPath,
      runtimeRoot: textbookRoot,
    });
    if (!textbookProjection.unit.markdown.trim() || textbookProjection.hierarchy.length === 0) {
      throw new Error(`candidate textbook reader projection is incomplete:${bookId}`);
    }
  }
  const index = await indexBookIds(indexRoot);
  assertExactSet(expectedBookIds, index.bookIds, 'candidate textbook index book set mismatch');
  if (provenance.generation === 'v2') {
    if (!provenance.resourceSetId || index.resourceSetId !== provenance.resourceSetId) {
      throw new Error('candidate textbook index resourceSetId mismatch');
    }
    if (!provenance.authoringSourceRevision || index.sourceRevision !== provenance.authoringSourceRevision) {
      throw new Error('candidate textbook index authoring revision mismatch');
    }
  }
  return {
    provenanceGeneration: provenance.generation,
    bookIds: expectedBookIds,
    resourceSetId: provenance.resourceSetId,
    authoringSourceRevision: provenance.authoringSourceRevision,
  };
}
