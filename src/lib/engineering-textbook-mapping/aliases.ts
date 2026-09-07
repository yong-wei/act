/**
 * Explicit alias table from projection/Authority source-document ids to
 * unified-reader book identities (#2043 design decision 5).
 *
 * Resolution fails closed when the alias or the target v2 runtime manifest is
 * absent; guessing or prefix matching is forbidden.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { EngineeringTextbookMappingError } from './contracts';

export interface TextbookAliasRow {
  sourceDocumentId: string;
  readerBookId: string;
  edition: string;
}

/**
 * The three extraction-source books only. New books require a governed
 * mapping-pipeline change, not an alias edit (#2043 non-goal).
 */
export const TEXTBOOK_ID_ALIASES: readonly TextbookAliasRow[] = [
  {
    sourceDocumentId: 'dorf-modern-control-systems-14th',
    readerBookId: 'dorf-modern-control-systems',
    edition: '14th Global Edition',
  },
  {
    sourceDocumentId: 'franklin-feedback-control-7th',
    readerBookId: 'feedback-control-of-dynamic-systems',
    edition: '7th edition',
  },
  {
    sourceDocumentId: 'hu-shousong-auto-control-8th',
    readerBookId: 'hu-shousong-auto-control-8th',
    edition: '第八版',
  },
] as const;

export const DEFAULT_TEXTBOOKS_V2_RUNTIME_RELATIVE =
  'course-content/runtime/resources/textbooks-v2' as const;

interface StructuredTextbookManifestLike {
  bookId?: unknown;
  edition?: unknown;
}

export function resolveTextbookAlias(
  sourceDocumentId: string,
): TextbookAliasRow {
  const row = TEXTBOOK_ID_ALIASES.find((alias) => alias.sourceDocumentId === sourceDocumentId);
  if (!row) {
    throw new EngineeringTextbookMappingError(
      'alias-missing',
      `no alias row for sourceDocumentId ${sourceDocumentId}; resolution fails closed`,
    );
  }
  return row;
}

/**
 * Verify every alias target exists in the textbooks-v2 runtime manifests with
 * the pinned edition. Fails closed on the first absent or mismatched book.
 */
export function verifyTextbookAliasesAgainstManifests(input?: {
  runtimeRoot?: string;
  aliases?: readonly TextbookAliasRow[];
}): void {
  const aliases = input?.aliases ?? TEXTBOOK_ID_ALIASES;
  for (const alias of aliases) {
    const manifestPath = path.join(
      input?.runtimeRoot ?? path.join(process.cwd(), DEFAULT_TEXTBOOKS_V2_RUNTIME_RELATIVE),
      alias.readerBookId,
      'manifest.json',
    );
    if (!existsSync(/*turbopackIgnore: true*/ manifestPath)) {
      throw new EngineeringTextbookMappingError(
        'alias-manifest-missing',
        `alias target manifest missing: ${manifestPath}`,
      );
    }
    const manifest = JSON.parse(
      readFileSync(/*turbopackIgnore: true*/ manifestPath, 'utf8'),
    ) as StructuredTextbookManifestLike;
    if (manifest.bookId !== alias.readerBookId || manifest.edition !== alias.edition) {
      throw new EngineeringTextbookMappingError(
        'alias-manifest-mismatch',
        `alias ${alias.sourceDocumentId} expects ${alias.readerBookId}/${alias.edition}, manifest has ${String(manifest.bookId)}/${String(manifest.edition)}`,
      );
    }
  }
}
