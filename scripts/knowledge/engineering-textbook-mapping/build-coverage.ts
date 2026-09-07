#!/usr/bin/env tsx
/**
 * #2043 tasks 1.4/1.5 — exception closure and the fail-closed coverage gate.
 *
 * Objects without approved mappings enter the explicit exception ledger:
 * reviewer-proposed node exceptions win, then automatic classification
 * (candidates-rejected / no-candidate). Silent unmapped coverage fails the
 * gate closed; the receipt binds every ledger digest.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  assertCoverageGate,
  candidateKeyOf,
  computeCoverage,
  effectiveVerdicts,
  artifactDigest,
  loadCandidates,
  loadDenominator,
  loadReviewLedger,
  MAPPING_EXCEPTIONS_CONTRACT,
  MAPPING_EXCEPTIONS_PROPOSED_CONTRACT,
  MAPPING_COVERAGE_CONTRACT,
  mappingArtifactPath,
  ENGINEERING_TEXTBOOK_MAPPING_ROOT,
  assertLedgerBytesAreAppendOnlyPrefix,
  type MappingExceptionRow,
} from '@/lib/engineering-textbook-mapping';

const ROOT = process.cwd();

function readProposedExceptions(): Array<{
  schemaVersion: string;
  canonicalId: string;
  reason: MappingExceptionRow['reason'];
  detail: string;
  reviewerIdentity: string;
  appendedAt: string;
}> {
  const filePath = mappingArtifactPath(ROOT, 'exceptions-proposed.jsonl');
  if (!existsSync(filePath)) return [];
  const text = readFileSync(filePath, 'utf8');
  const rows: ReturnType<typeof readProposedExceptions> = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line);
    if (parsed.schemaVersion !== MAPPING_EXCEPTIONS_PROPOSED_CONTRACT) {
      throw new Error(`proposed exception schema mismatch: ${parsed.schemaVersion}`);
    }
    rows.push(parsed);
  }
  // Last proposal per canonical wins (append-only corrections).
  const byNode = new Map<string, (typeof rows)[number]>();
  for (const row of rows) byNode.set(row.canonicalId, row);
  return [...byNode.values()];
}

function readCommittedLedger(relativePath: string): Buffer {
  try {
    return execFileSync('git', ['show', `HEAD:${relativePath}`], {
      cwd: ROOT,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return Buffer.alloc(0);
  }
}

function main(): void {
  const reviewsPath = mappingArtifactPath(ROOT, 'reviews.jsonl');
  assertLedgerBytesAreAppendOnlyPrefix({
    previousBytes: readCommittedLedger(`${ENGINEERING_TEXTBOOK_MAPPING_ROOT}/reviews.jsonl`),
    currentBytes: readFileSync(reviewsPath),
    label: 'reviews.jsonl',
  });
  const denominator = loadDenominator(ROOT);
  const candidates = loadCandidates(ROOT);
  const reviews = loadReviewLedger({ filePath: mappingArtifactPath(ROOT, 'reviews.jsonl') });
  const verdicts = effectiveVerdicts(reviews);

  const proposed = readProposedExceptions();
  const proposedByNode = new Map(proposed.map((row) => [row.canonicalId, row]));

  const domainByNode = new Map<string, string>();
  const denominatorIds = new Set<string>();
  for (const domain of denominator.domains) {
    for (const id of domain.canonicalIds) {
      domainByNode.set(id, domain.domainId);
      denominatorIds.add(id);
    }
  }

  const candidatesByNode = new Map<string, typeof candidates.rows>();
  for (const row of candidates.rows) {
    const list = candidatesByNode.get(row.canonicalId) ?? [];
    list.push(row);
    candidatesByNode.set(row.canonicalId, list);
  }

  const approvedByNode = new Map<string, string[]>();
  const missingVerdicts: string[] = [];
  for (const [canonicalId, rows] of candidatesByNode) {
    for (const row of rows) {
      const verdict = verdicts.get(candidateKeyOf(row));
      if (!verdict) {
        if (!proposedByNode.has(canonicalId)) missingVerdicts.push(candidateKeyOf(row));
        continue;
      }
      if (verdict.verdict === 'approved') {
        const list = approvedByNode.get(canonicalId) ?? [];
        list.push(row.structuralUnitId);
        approvedByNode.set(canonicalId, list);
      }
    }
  }
  if (missingVerdicts.length > 0) {
    throw new Error(`review coverage incomplete: ${missingVerdicts.length} candidates lack verdicts and their nodes lack exception proposals (first: ${missingVerdicts[0]})`);
  }

  const exceptions: MappingExceptionRow[] = [];
  for (const canonicalId of [...denominatorIds].sort()) {
    if (approvedByNode.has(canonicalId)) continue;
    const proposedRow = proposedByNode.get(canonicalId);
    if (proposedRow) {
      exceptions.push({
        schemaVersion: MAPPING_EXCEPTIONS_CONTRACT,
        canonicalId,
        domainId: domainByNode.get(canonicalId) ?? '',
        reason: proposedRow.reason,
        detail: proposedRow.detail,
      });
      continue;
    }
    const rows = candidatesByNode.get(canonicalId);
    exceptions.push({
      schemaVersion: MAPPING_EXCEPTIONS_CONTRACT,
      canonicalId,
      domainId: domainByNode.get(canonicalId) ?? '',
      reason: rows ? 'candidates-rejected' : 'no-candidate',
      detail: rows
        ? `${rows.length} 候选全部未获批准`
        : '检索召回无候选',
    });
  }

  const exceptionsPath = mappingArtifactPath(ROOT, 'exceptions.jsonl');
  mkdirSync(path.dirname(exceptionsPath), { recursive: true });
  writeFileSync(exceptionsPath, exceptions.map((row) => JSON.stringify(row)).join('\n') + '\n');

  const computation = computeCoverage({
    denominator,
    candidates,
    reviews,
    exceptions,
    generatedAt: new Date().toISOString(),
  });
  assertCoverageGate(computation.coverage);

  const coverage = {
    ...computation.coverage,
    contract: MAPPING_COVERAGE_CONTRACT,
    denominatorDigest: artifactDigest(mappingArtifactPath(ROOT, 'denominator.json')),
    candidatesDigest: artifactDigest(mappingArtifactPath(ROOT, 'candidates.json')),
    reviewsDigest: artifactDigest(mappingArtifactPath(ROOT, 'reviews.jsonl')),
    exceptionsDigest: artifactDigest(exceptionsPath),
  };
  const coveragePath = mappingArtifactPath(ROOT, 'coverage.json');
  writeFileSync(coveragePath, `${JSON.stringify(coverage, null, 2)}\n`);

  process.stdout.write(`${JSON.stringify({
    coverageRate: coverage.coverageRate,
    approved: coverage.approvedCount,
    exceptions: coverage.exceptionCount,
    perDomain: coverage.perDomain.map((domain) =>
      `${domain.domainId}: ${(domain.coverageRate * 100).toFixed(1)}% (${domain.approved}+${domain.exceptions}/${domain.denominator})`),
  }, null, 2)}\n`);
}

void main();
