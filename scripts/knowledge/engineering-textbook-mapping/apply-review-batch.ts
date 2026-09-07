#!/usr/bin/env tsx
/**
 * #2043 task 1.3 — append an independent semantic review batch.
 *
 * Review batches carry candidate verdicts (approved/rejected with reasons)
 * and node-level exception proposals. The apply step validates every entry
 * against the denominator and candidate ledger before appending to the
 * immutable review ledger with globally increasing ordinals.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import {
  candidateKeyOf,
  EXCEPTION_REASONS,
  loadCandidates,
  loadDenominator,
  loadReviewLedger,
  MAPPING_EXCEPTIONS_PROPOSED_CONTRACT,
  MAPPING_REVIEWS_CONTRACT,
  mappingArtifactPath,
  type MappingExceptionReason,
  type MappingReviewRow,
} from '@/lib/engineering-textbook-mapping';

const ROOT = process.cwd();

interface ReviewBatch {
  reviewerIdentity: string;
  reviewerModel: string;
  candidateVerdicts: Array<{
    canonicalId: string;
    structuralUnitId: string;
    verdict: 'approved' | 'rejected';
    reason: string;
  }>;
  nodeExceptions: Array<{
    canonicalId: string;
    reason: MappingExceptionReason;
    detail: string;
  }>;
}

interface VerdictFile {
  batchId: string;
  candidateVerdicts: Array<{
    canonicalId: string;
    unitId: string;
    verdict: 'approved' | 'rejected';
    reason: string;
  }>;
  nodeExceptions?: Array<{
    canonicalId: string;
    reason: string;
    detail: string;
  }>;
}

/** Convert a reviewer subagent verdict file into an apply batch. */
function verdictFileToBatch(file: VerdictFile): ReviewBatch {
  return {
    reviewerIdentity: `zcode-subagent:${file.batchId}`,
    reviewerModel: 'zcode/glm-5.3',
    candidateVerdicts: file.candidateVerdicts.map((row) => ({
      canonicalId: row.canonicalId,
      structuralUnitId: row.unitId,
      verdict: row.verdict,
      reason: row.reason,
    })),
    nodeExceptions: (file.nodeExceptions ?? []).map((row) => ({
      canonicalId: row.canonicalId,
      reason: (EXCEPTION_REASONS as readonly string[]).includes(row.reason)
        ? row.reason as MappingExceptionReason
        : 'no-textbook-content',
      detail: row.detail,
    })),
  };
}

function appendJsonl(filePath: string, rows: unknown[]): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  writeFileSync(filePath, existing + rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''));
}

function main(): void {
  const fromVerdictsIndex = process.argv.indexOf('--from-verdicts');
  const batches: ReviewBatch[] = [];
  if (fromVerdictsIndex >= 0) {
    const workDir = process.argv[fromVerdictsIndex + 1]
      ?? path.join(ROOT, 'course-content/authoring/knowledge/engineering-textbook-mapping/review-work');
    const files = readdirSync(workDir)
      .filter((name) => /^batch-\d+\.verdicts\.json$/.test(name))
      .sort();
    if (files.length === 0) throw new Error(`no verdict files under ${workDir}`);
    for (const name of files) {
      batches.push(verdictFileToBatch(JSON.parse(readFileSync(path.join(workDir, name), 'utf8')) as VerdictFile));
    }
  } else {
    const batchPath = process.argv[2];
    if (!batchPath || !existsSync(batchPath)) {
      throw new Error('usage: apply-review-batch.ts <review-batch.json> | apply-review-batch.ts --from-verdicts [dir]');
    }
    batches.push(JSON.parse(readFileSync(batchPath, 'utf8')) as ReviewBatch);
  }

  const denominator = loadDenominator(ROOT);
  const candidates = loadCandidates(ROOT);
  const denominatorIds = new Set(denominator.domains.flatMap((domain) => domain.canonicalIds));
  const candidateUnitsByNode = new Map<string, Set<string>>();
  for (const row of candidates.rows) {
    const set = candidateUnitsByNode.get(row.canonicalId) ?? new Set<string>();
    set.add(row.structuralUnitId);
    candidateUnitsByNode.set(row.canonicalId, set);
  }

  const reviewsPath = mappingArtifactPath(ROOT, 'reviews.jsonl');
  const existingReviews = existsSync(reviewsPath) ? loadReviewLedger({ filePath: reviewsPath }) : [];
  let ordinal = existingReviews.length === 0 ? 0 : existingReviews[existingReviews.length - 1]!.reviewOrdinal;
  const seenKeys = new Set(existingReviews.map((row) => row.candidateKey));

  const allReviewRows: MappingReviewRow[] = [];
  const allExceptionRows: Array<Record<string, unknown>> = [];
  for (const batch of batches) {
    const appendedAt = new Date().toISOString();
    for (const verdict of batch.candidateVerdicts) {
      if (!denominatorIds.has(verdict.canonicalId)) {
        throw new Error(`batch names canonical outside denominator: ${verdict.canonicalId}`);
      }
      const units = candidateUnitsByNode.get(verdict.canonicalId);
      if (!units?.has(verdict.structuralUnitId)) {
        throw new Error(`batch verdict names a non-candidate unit: ${verdict.canonicalId} -> ${verdict.structuralUnitId}`);
      }
      const key = candidateKeyOf(verdict);
      if (seenKeys.has(key)) {
        throw new Error(`duplicate verdict for candidate ${key}`);
      }
      seenKeys.add(key);
      ordinal += 1;
      allReviewRows.push({
        schemaVersion: MAPPING_REVIEWS_CONTRACT,
        reviewOrdinal: ordinal,
        candidateKey: key,
        verdict: verdict.verdict,
        reason: verdict.reason,
        reviewerIdentity: batch.reviewerIdentity,
        reviewerModel: batch.reviewerModel,
        appendedAt,
      });
    }
    for (const proposal of batch.nodeExceptions ?? []) {
      if (!denominatorIds.has(proposal.canonicalId)) {
        throw new Error(`exception proposal names canonical outside denominator: ${proposal.canonicalId}`);
      }
      if (!(EXCEPTION_REASONS as readonly string[]).includes(proposal.reason)) {
        throw new Error(`exception reason not classified: ${proposal.reason}`);
      }
      allExceptionRows.push({
        schemaVersion: MAPPING_EXCEPTIONS_PROPOSED_CONTRACT,
        canonicalId: proposal.canonicalId,
        reason: proposal.reason,
        detail: proposal.detail,
        reviewerIdentity: batch.reviewerIdentity,
        appendedAt,
      });
    }
  }
  if (allReviewRows.length > 0) appendJsonl(reviewsPath, allReviewRows);
  if (allExceptionRows.length > 0) {
    appendJsonl(mappingArtifactPath(ROOT, 'exceptions-proposed.jsonl'), allExceptionRows);
  }

  process.stdout.write(`${JSON.stringify({
    appliedBatches: batches.length,
    appendedVerdicts: allReviewRows.length,
    appendedExceptionProposals: allExceptionRows.length,
    nextOrdinal: ordinal,
    gitRevision: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(),
  }, null, 2)}\n`);
}

void main();
