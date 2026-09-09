/**
 * Textbooks-v2 structural-unit coordinate resolution (#2043).
 *
 * A mapping coordinate resolves only when the named unit exists in the target
 * book's v2 runtime units.jsonl; resolution then yields the unified reader
 * href via buildTextbookReaderHref — the same URL system as the hybrid
 * retrieval index and the in-app reader.
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';

import { DEFAULT_TEXTBOOKS_V2_RUNTIME_RELATIVE } from './aliases';
import {
  EngineeringTextbookMappingError,
  type StructuralUnitCoordinate,
} from './contracts';

export interface StructuralUnitRecord {
  bookId: string;
  edition: string;
  unitId: string;
  chapterId: string;
  structuralPath: string[];
  kind: string;
  naturalNumber: string | null;
  title: string;
}

export interface StructuralUnitIndex {
  byUnitId: Map<string, StructuralUnitRecord>;
  byBookAndPath: Map<string, StructuralUnitRecord>;
  unitCount: number;
}

function pathKey(bookId: string, structuralPath: readonly string[]): string {
  return `${bookId}\u001f${structuralPath.join('/')}`;
}

async function readUnitsFile(
  runtimeRoot: string,
  bookId: string,
): Promise<StructuralUnitRecord[]> {
  const unitsPath = path.join(runtimeRoot, bookId, 'units.jsonl');
  const rows: StructuralUnitRecord[] = [];
  const lines = createInterface({
    input: createReadStream(unitsPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const unit = JSON.parse(line) as {
      id: string;
      bookId: string;
      edition: string;
      chapterId: string;
      structuralPath: string[];
      kind: string;
      naturalNumber: string | null;
      title: string;
    };
    rows.push({
      bookId: unit.bookId,
      edition: unit.edition,
      unitId: unit.id,
      chapterId: unit.chapterId,
      structuralPath: unit.structuralPath,
      kind: unit.kind,
      naturalNumber: unit.naturalNumber,
      title: unit.title,
    });
  }
  return rows;
}

/** Load the structural-unit index for the given books from the v2 runtime root. */
export async function loadStructuralUnitIndex(input: {
  runtimeRoot?: string;
  bookIds: readonly string[];
}): Promise<StructuralUnitIndex> {
  const runtimeRoot = input.runtimeRoot
    ?? path.join(/*turbopackIgnore: true*/ process.cwd(), DEFAULT_TEXTBOOKS_V2_RUNTIME_RELATIVE);
  const byUnitId = new Map<string, StructuralUnitRecord>();
  const byBookAndPath = new Map<string, StructuralUnitRecord>();
  for (const bookId of input.bookIds) {
    const units = await readUnitsFile(runtimeRoot, bookId);
    for (const unit of units) {
      if (byUnitId.has(unit.unitId)) {
        throw new EngineeringTextbookMappingError(
          'unit-id-duplicate',
          `structural unit id appears twice: ${unit.unitId}`,
        );
      }
      byUnitId.set(unit.unitId, unit);
      byBookAndPath.set(pathKey(unit.bookId, unit.structuralPath), unit);
    }
  }
  return { byUnitId, byBookAndPath, unitCount: byUnitId.size };
}

/**
 * Resolve a mapping coordinate against the index. Fails closed when the
 * structuralUnitId or the bookId/structuralPath pair is unknown.
 */
export function resolveStructuralUnit(
  index: StructuralUnitIndex,
  coordinate: {
    bookId: string;
    structuralUnitId?: string | null;
    structuralPath?: readonly string[] | null;
  },
): StructuralUnitRecord {
  let unit: StructuralUnitRecord | undefined;
  if (coordinate.structuralUnitId) {
    unit = index.byUnitId.get(coordinate.structuralUnitId);
    if (unit && unit.bookId !== coordinate.bookId) {
      throw new EngineeringTextbookMappingError(
        'coordinate-mismatch',
        `structuralUnitId ${coordinate.structuralUnitId} belongs to ${unit.bookId}, not ${coordinate.bookId}`,
      );
    }
    if (!unit && coordinate.structuralPath) {
      const byPath = index.byBookAndPath.get(pathKey(coordinate.bookId, coordinate.structuralPath));
      if (byPath && byPath.unitId === coordinate.structuralUnitId) unit = byPath;
    }
  }
  if (!unit && coordinate.structuralPath) {
    unit = index.byBookAndPath.get(pathKey(coordinate.bookId, coordinate.structuralPath));
  }
  if (!unit) {
    throw new EngineeringTextbookMappingError(
      'coordinate-unresolved',
      `coordinate does not resolve in the v2 runtime manifests: ${coordinate.bookId} ${coordinate.structuralUnitId ?? coordinate.structuralPath?.join('/') ?? '(empty)'}`,
    );
  }
  return unit;
}

/**
 * Reader href for a resolved structural unit — same URL system as retrieval.
 * Callers build it via `buildTextbookReaderHref` with the resolved unit's
 * bookId/edition/structuralPath; this module stays importable from plain
 * node (pipeline scripts) by not depending on the course-bundle runtime.
 */
export type { StructuralUnitCoordinate };
