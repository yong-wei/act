/**
 * Append-only mapping ledger IO (#2043).
 *
 * The review ledger and exception ledger are immutable-append JSONL
 * artifacts; corrections are new entries and the effective verdict is the
 * last entry per key. Coverage receipts bind ledger file digests so in-place
 * edits fail closed at the gate.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  EngineeringTextbookMappingError,
  ENGINEERING_TEXTBOOK_MAPPING_ROOT,
  MAPPING_EXCEPTIONS_CONTRACT,
  MAPPING_REVIEWS_CONTRACT,
  type MappingCandidatesFile,
  type MappingCoverageFile,
  type MappingDenominatorFile,
  type MappingExceptionRow,
  type MappingReviewRow,
  type MappingSourcesInputFile,
} from './contracts';

export function mappingArtifactPath(
  repoRoot: string,
  fileName: string,
): string {
  return path.join(repoRoot, ENGINEERING_TEXTBOOK_MAPPING_ROOT, fileName);
}

export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function readJsonArtifact<T>(filePath: string): T {
  return JSON.parse(readFileSync(/*turbopackIgnore: true*/ filePath, 'utf8')) as T;
}

export function readJsonlArtifact<T extends { schemaVersion?: string }>(
  filePath: string,
  expectedSchema: string,
): T[] {
  const text = readFileSync(/*turbopackIgnore: true*/ filePath, 'utf8');
  const rows: T[] = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim();
    if (!line) continue;
    let parsed: T;
    try {
      parsed = JSON.parse(line) as T;
    } catch {
      throw new EngineeringTextbookMappingError(
        'ledger-row-invalid',
        `${filePath}:${index + 1} is not valid JSON`,
      );
    }
    if (parsed.schemaVersion !== expectedSchema) {
      throw new EngineeringTextbookMappingError(
        'ledger-row-invalid',
        `${filePath}:${index + 1} schemaVersion ${String(parsed.schemaVersion)} != ${expectedSchema}`,
      );
    }
    rows.push(parsed);
  }
  return rows;
}

/**
 * Load the review ledger enforcing append-only ordering: reviewOrdinal must
 * be strictly increasing across the file. Duplicate candidateKeys are legal
 * (corrections); the effective verdict is the last one.
 */
export function loadReviewLedger(input: {
  filePath: string;
}): MappingReviewRow[] {
  const rows = readJsonlArtifact<MappingReviewRow>(
    input.filePath,
    MAPPING_REVIEWS_CONTRACT,
  );
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    if (typeof row.reviewOrdinal !== 'number' || !Number.isInteger(row.reviewOrdinal)) {
      throw new EngineeringTextbookMappingError(
        'ledger-order-invalid',
        `${input.filePath}: row ${index + 1} reviewOrdinal must be an integer`,
      );
    }
    if (index > 0 && row.reviewOrdinal <= rows[index - 1]!.reviewOrdinal) {
      throw new EngineeringTextbookMappingError(
        'ledger-order-invalid',
        `${input.filePath}: row ${index + 1} reviewOrdinal ${row.reviewOrdinal} does not advance past ${rows[index - 1]!.reviewOrdinal}; append-only ordering violated`,
      );
    }
    if (row.verdict !== 'approved' && row.verdict !== 'rejected') {
      throw new EngineeringTextbookMappingError(
        'ledger-row-invalid',
        `${input.filePath}: row ${index + 1} verdict must be approved|rejected`,
      );
    }
    if (typeof row.reason !== 'string' || row.reason.trim().length === 0) {
      throw new EngineeringTextbookMappingError(
        'ledger-row-invalid',
        `${input.filePath}: row ${index + 1} reason must be a non-empty string`,
      );
    }
  }
  return rows;
}

export function effectiveVerdicts(
  rows: readonly MappingReviewRow[],
): Map<string, MappingReviewRow> {
  const effective = new Map<string, MappingReviewRow>();
  for (const row of rows) effective.set(row.candidateKey, row);
  return effective;
}

export function loadExceptionLedger(input: {
  filePath: string;
}): MappingExceptionRow[] {
  return readJsonlArtifact<MappingExceptionRow>(
    input.filePath,
    MAPPING_EXCEPTIONS_CONTRACT,
  );
}

/** File digest used by coverage receipts to bind ledger immutability. */
export function artifactDigest(filePath: string): string {
  return sha256Text(readFileSync(/*turbopackIgnore: true*/ filePath, 'utf8'));
}

export function loadDenominator(repoRoot: string): MappingDenominatorFile {
  const file = readJsonArtifact<MappingDenominatorFile>(
    mappingArtifactPath(repoRoot, 'denominator.json'),
  );
  const counted = file.domains.reduce((total, domain) => total + domain.objectCount, 0);
  if (counted !== file.totalObjects) {
    throw new EngineeringTextbookMappingError(
      'denominator-invalid',
      `denominator domain counts ${counted} != totalObjects ${file.totalObjects}`,
    );
  }
  return file;
}

export function loadCandidates(repoRoot: string): MappingCandidatesFile {
  return readJsonArtifact<MappingCandidatesFile>(
    mappingArtifactPath(repoRoot, 'candidates.json'),
  );
}

export function loadCoverage(repoRoot: string): MappingCoverageFile {
  return readJsonArtifact<MappingCoverageFile>(
    mappingArtifactPath(repoRoot, 'coverage.json'),
  );
}

export function loadSourcesInput(repoRoot: string): MappingSourcesInputFile {
  return readJsonArtifact<MappingSourcesInputFile>(
    mappingArtifactPath(repoRoot, 'sources-input.json'),
  );
}

/**
 * Fail closed when a coverage receipt's bound ledger digests no longer match
 * the artifacts on disk (in-place ledger edit detection).
 */
export function verifyCoverageLedgerBinding(input: {
  coverage: MappingCoverageFile;
  repoRoot: string;
}): void {
  const pairs: Array<[string, string, string]> = [
    ['denominator.json', input.coverage.denominatorDigest, 'denominator'],
    ['candidates.json', input.coverage.candidatesDigest, 'candidates'],
    ['reviews.jsonl', input.coverage.reviewsDigest, 'reviews'],
    ['exceptions.jsonl', input.coverage.exceptionsDigest, 'exceptions'],
  ];
  for (const [fileName, expected, label] of pairs) {
    const actual = artifactDigest(mappingArtifactPath(input.repoRoot, fileName));
    if (actual !== expected) {
      throw new EngineeringTextbookMappingError(
        'ledger-tampered',
        `${label} digest ${actual} != coverage receipt binding ${expected}; ledgers are append-only`,
      );
    }
  }
}
