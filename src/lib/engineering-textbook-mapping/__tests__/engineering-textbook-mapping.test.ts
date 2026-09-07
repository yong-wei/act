import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, afterEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  assertCoverageGate,
  candidateKeyOf,
  computeCoverage,
  EngineeringTextbookMappingError,
  MAPPING_COVERAGE_GATE,
  MAPPING_EXCEPTIONS_CONTRACT,
  MAPPING_REVIEWS_CONTRACT,
  MAPPING_SOURCES_INPUT_CONTRACT,
  NODE_SOURCES_LIMIT,
  resolveTextbookAlias,
  TEXTBOOK_ID_ALIASES,
  verifyCoverageLedgerBinding,
  verifySourcesInputMatchesApprovedMappings,
  verifyTextbookAliasesAgainstManifests,
  buildGovernedSourcesEntries,
  type MappingCandidatesFile,
  type MappingDenominatorFile,
  type MappingExceptionRow,
  type MappingReviewRow,
} from '@/lib/engineering-textbook-mapping';
import { loadReviewLedger } from '@/lib/engineering-textbook-mapping/ledger';

const RELEASE = 'ctr:release:control-theory-engineering-v0.37';

function denominatorFixture(): MappingDenominatorFile {
  return {
    contract: 'engineering-textbook-mapping-denominator/v1',
    authorityReleaseId: RELEASE,
    snapshotId: 'snap-x',
    catalogId: 'adc-x',
    generatorVersion: 'test',
    totalObjects: 5,
    domains: [
      { domainId: 'domain-a', objectCount: 3, canonicalIds: ['ctc:a1', 'ctc:a2', 'ctc:a3'] },
      { domainId: 'domain-b', objectCount: 2, canonicalIds: ['ctc:b1', 'ctc:b2'] },
    ],
  };
}

const UNIT_DORF = 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-04';

function candidatesFixture(): MappingCandidatesFile {
  return {
    contract: 'engineering-textbook-mapping-candidates/v1',
    authorityReleaseId: RELEASE,
    denominatorDigest: 'd'.repeat(64),
    generatorVersion: 'test',
    generatedAt: '2026-09-06T00:00:00.000Z',
    rows: [
      {
        canonicalId: 'ctc:a1',
        domainId: 'domain-a',
        structuralUnitId: UNIT_DORF,
        bookId: 'dorf-modern-control-systems',
        edition: '14th Global Edition',
        structuralPath: ['chapter-chapter-04'],
        unitTitle: 'chapter-chapter-04',
        rank: 1,
        recallQuery: 'root locus',
        lexicalScore: 1,
        vectorScore: 0.8,
      },
    ],
  };
}

function reviewRow(
  ordinal: number,
  canonicalId: string,
  verdict: 'approved' | 'rejected',
): MappingReviewRow {
  return {
    schemaVersion: MAPPING_REVIEWS_CONTRACT,
    reviewOrdinal: ordinal,
    candidateKey: candidateKeyOf({ canonicalId, structuralUnitId: UNIT_DORF }),
    verdict,
    reason: verdict === 'approved' ? '定义级覆盖' : '未达定义级绑定',
    reviewerIdentity: 'test-reviewer',
    reviewerModel: 'test-model',
    appendedAt: '2026-09-06T00:00:00.000Z',
  };
}

function exceptionRow(
  canonicalId: string,
  domainId: string,
  reason: MappingExceptionRow['reason'] = 'no-textbook-content',
): MappingExceptionRow {
  return {
    schemaVersion: MAPPING_EXCEPTIONS_CONTRACT,
    canonicalId,
    domainId,
    reason,
    detail: 'test',
  };
}

describe('textbook alias table', () => {
  it('resolves the three extraction-source books', () => {
    expect(resolveTextbookAlias('dorf-modern-control-systems-14th')).toEqual({
      sourceDocumentId: 'dorf-modern-control-systems-14th',
      readerBookId: 'dorf-modern-control-systems',
      edition: '14th Global Edition',
    });
    expect(TEXTBOOK_ID_ALIASES).toHaveLength(3);
  });

  it('fails closed for unknown source documents without guessing', () => {
    expect(() => resolveTextbookAlias('dorf-modern-control-systems')).toThrow(
      EngineeringTextbookMappingError,
    );
    try {
      resolveTextbookAlias('dorf-modern-control-systems-15th');
      expect.unreachable();
    } catch (error) {
      expect((error as EngineeringTextbookMappingError).code).toBe('alias-missing');
    }
  });

  it('verifies alias targets against v2 runtime manifest fixtures', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'aliases-ok-'));
    try {
      const bookDir = path.join(dir, 'dorf-modern-control-systems');
      mkdirSync(bookDir);
      writeFileSync(
        path.join(bookDir, 'manifest.json'),
        JSON.stringify({ bookId: 'dorf-modern-control-systems', edition: '14th Global Edition' }),
      );
      expect(() =>
        verifyTextbookAliasesAgainstManifests({
          runtimeRoot: dir,
          aliases: [{
            sourceDocumentId: 'dorf-modern-control-systems-14th',
            readerBookId: 'dorf-modern-control-systems',
            edition: '14th Global Edition',
          }],
        }),
      ).not.toThrow();
      expect(() =>
        verifyTextbookAliasesAgainstManifests({
          runtimeRoot: dir,
          aliases: [{
            sourceDocumentId: 'franklin-feedback-control-7th',
            readerBookId: 'feedback-control-of-dynamic-systems',
            edition: '7th edition',
          }],
        }),
      ).toThrow(EngineeringTextbookMappingError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails closed when the manifest edition drifts from the alias', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'aliases-'));
    try {
      const bookDir = path.join(dir, 'dorf-modern-control-systems');
      mkdirSync(bookDir);
      writeFileSync(
        path.join(bookDir, 'manifest.json'),
        JSON.stringify({ bookId: 'dorf-modern-control-systems', edition: '15th Global Edition' }),
      );
      expect(() =>
        verifyTextbookAliasesAgainstManifests({
          runtimeRoot: dir,
          aliases: [{
            sourceDocumentId: 'dorf-modern-control-systems-14th',
            readerBookId: 'dorf-modern-control-systems',
            edition: '14th Global Edition',
          }],
        }),
      ).toThrow(EngineeringTextbookMappingError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('coverage gate', () => {
  it('passes at the 95% line with approved plus explicit exceptions', () => {
    // a1 approved; a2/a3/b1/b2 explicit exceptions → 100% coverage.
    const result = computeCoverage({
      denominator: denominatorFixture(),
      candidates: candidatesFixture(),
      reviews: [reviewRow(1, 'ctc:a1', 'approved')],
      exceptions: [
        exceptionRow('ctc:a2', 'domain-a'),
        exceptionRow('ctc:a3', 'domain-a'),
        exceptionRow('ctc:b1', 'domain-b'),
        exceptionRow('ctc:b2', 'domain-b'),
      ],
      generatedAt: '2026-09-06T00:00:00.000Z',
    });
    expect(result.coverage.passed).toBe(true);
    expect(result.coverage.coverageRate).toBe(1);
    expect(result.approvedByNode.get('ctc:a1')).toEqual([UNIT_DORF]);
    expect(result.coverage.perDomain[0]).toMatchObject({
      domainId: 'domain-a',
      approved: 1,
      exceptions: 2,
    });
  });

  it('fails closed below the gate', () => {
    // computeCoverage under full ledger closure always yields 100%; the
    // fail-closed threshold itself is the gate assertion consumed by the
    // pipeline before runtime consumption may switch.
    const below = {
      ...computeCoverage({
        denominator: denominatorFixture(),
        candidates: candidatesFixture(),
        reviews: [reviewRow(1, 'ctc:a1', 'approved')],
        exceptions: [
          exceptionRow('ctc:a2', 'domain-a'),
          exceptionRow('ctc:a3', 'domain-a'),
          exceptionRow('ctc:b1', 'domain-b'),
          exceptionRow('ctc:b2', 'domain-b'),
        ],
        generatedAt: '2026-09-06T00:00:00.000Z',
      }).coverage,
      coverageRate: 0.9,
      passed: false,
    };
    expect(() => assertCoverageGate(below)).toThrow(EngineeringTextbookMappingError);
    try {
      assertCoverageGate(below);
      expect.unreachable();
    } catch (error) {
      expect((error as EngineeringTextbookMappingError).code).toBe('coverage-gate-failed');
    }
    expect(MAPPING_COVERAGE_GATE).toBe(0.95);
  });

  it('fails closed when an object is absent from both ledgers', () => {
    expect(() =>
      computeCoverage({
        denominator: denominatorFixture(),
        candidates: candidatesFixture(),
        reviews: [reviewRow(1, 'ctc:a1', 'approved')],
        exceptions: [exceptionRow('ctc:a2', 'domain-a')],
        generatedAt: '2026-09-06T00:00:00.000Z',
      }),
    ).toThrow(EngineeringTextbookMappingError);
    try {
      computeCoverage({
        denominator: denominatorFixture(),
        candidates: candidatesFixture(),
        reviews: [reviewRow(1, 'ctc:a1', 'approved')],
        exceptions: [exceptionRow('ctc:a2', 'domain-a')],
        generatedAt: '2026-09-06T00:00:00.000Z',
      });
      expect.unreachable();
    } catch (error) {
      expect((error as EngineeringTextbookMappingError).code).toBe('silent-unmapped-nodes');
    }
  });

  it('fails closed when a node is both approved and excepted', () => {
    expect(() =>
      computeCoverage({
        denominator: denominatorFixture(),
        candidates: candidatesFixture(),
        reviews: [reviewRow(1, 'ctc:a1', 'approved')],
        exceptions: [
          exceptionRow('ctc:a1', 'domain-a'),
          exceptionRow('ctc:a2', 'domain-a'),
          exceptionRow('ctc:a3', 'domain-a'),
          exceptionRow('ctc:b1', 'domain-b'),
          exceptionRow('ctc:b2', 'domain-b'),
        ],
        generatedAt: '2026-09-06T00:00:00.000Z',
      }),
    ).toThrow(EngineeringTextbookMappingError);
  });

  it('treats the last review entry as the effective verdict (corrections append)', () => {
    const result = computeCoverage({
      denominator: denominatorFixture(),
      candidates: candidatesFixture(),
      reviews: [
        reviewRow(1, 'ctc:a1', 'approved'),
        { ...reviewRow(2, 'ctc:a1', 'rejected'), reason: '复审推翻' },
      ],
      exceptions: [
        exceptionRow('ctc:a1', 'domain-a', 'candidates-rejected'),
        exceptionRow('ctc:a2', 'domain-a'),
        exceptionRow('ctc:a3', 'domain-a'),
        exceptionRow('ctc:b1', 'domain-b'),
        exceptionRow('ctc:b2', 'domain-b'),
      ],
      generatedAt: '2026-09-06T00:00:00.000Z',
    });
    expect(result.approvedByNode.has('ctc:a1')).toBe(false);
    expect(result.coverage.passed).toBe(true);
  });
});

describe('review ledger append-only ordering', () => {
  const tmpFiles: string[] = [];

  afterEach(() => {
    for (const file of tmpFiles.splice(0)) rmSync(file, { force: true });
  });

  function writeLedger(rows: MappingReviewRow[]): string {
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'ledger-')), 'reviews.jsonl');
    writeFileSync(file, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
    tmpFiles.push(file);
    return file;
  }

  it('loads an ordered ledger', () => {
    const rows = loadReviewLedger({ filePath: writeLedger([reviewRow(1, 'ctc:a1', 'approved'), reviewRow(2, 'ctc:a1', 'rejected')]) });
    expect(rows).toHaveLength(2);
  });

  it('fails closed on non-increasing reviewOrdinal', () => {
    const file = writeLedger([reviewRow(2, 'ctc:a1', 'approved'), reviewRow(2, 'ctc:a2', 'rejected')]);
    expect(() => loadReviewLedger({ filePath: file })).toThrow(EngineeringTextbookMappingError);
  });

  it('fails closed on tampered coverage ledger binding', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'binding-'));
    try {
      const root = path.join(dir, 'course-content/authoring/knowledge/engineering-textbook-mapping');
      mkdirSync(root, { recursive: true });
      const reviewLine = JSON.stringify(reviewRow(1, 'ctc:a1', 'approved')) + '\n';
      writeFileSync(path.join(root, 'denominator.json'), '{}');
      writeFileSync(path.join(root, 'candidates.json'), '{}');
      writeFileSync(path.join(root, 'reviews.jsonl'), reviewLine);
      writeFileSync(path.join(root, 'exceptions.jsonl'), '');
      const sha = (text: string) =>
        createHash('sha256').update(text, 'utf8').digest('hex');
      const coverage = {
        denominatorDigest: sha('{}'),
        candidatesDigest: sha('{}'),
        reviewsDigest: sha(reviewLine),
        exceptionsDigest: sha(''),
      };
      expect(() =>
        verifyCoverageLedgerBinding({ coverage: coverage as never, repoRoot: dir }),
      ).not.toThrow();
      // In-place edit: file no longer matches the receipt binding.
      writeFileSync(path.join(root, 'reviews.jsonl'), reviewLine + JSON.stringify(reviewRow(2, 'ctc:a2', 'approved')) + '\n');
      try {
        verifyCoverageLedgerBinding({ coverage: coverage as never, repoRoot: dir });
        expect.unreachable();
      } catch (error) {
        expect((error as EngineeringTextbookMappingError).code).toBe('ledger-tampered');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('governed sources-input binding', () => {
  it('rebuilds citations from the approved mapping ledger', () => {
    const candidates = candidatesFixture();
    const reviews = [reviewRow(1, 'ctc:a1', 'approved')];
    const entries = buildGovernedSourcesEntries({
      candidateRows: candidates.rows,
      reviews,
    });
    expect(entries).toEqual([
      {
        nodeId: 'ctc:a1',
        sources: [
          {
            sourceEditionId: 'dorf-modern-control-systems-14th',
            sectionId: UNIT_DORF,
            label: expect.stringContaining('Modern Control Systems'),
          },
        ],
      },
    ]);
  });

  it('fails closed when sources-input entries diverge while coverageDigest is unchanged', () => {
    const candidates = candidatesFixture();
    const reviews = [reviewRow(1, 'ctc:a1', 'approved')];
    const honest = buildGovernedSourcesEntries({
      candidateRows: candidates.rows,
      reviews,
    });
    const sources = {
      contract: MAPPING_SOURCES_INPUT_CONTRACT,
      authorityReleaseId: RELEASE,
      coverageDigest: 'd'.repeat(64),
      nodeLimit: NODE_SOURCES_LIMIT,
      entries: [
        {
          nodeId: honest[0]!.nodeId,
          sources: [{ ...honest[0]!.sources[0]!, sectionId: 'forged-unit' }],
        },
      ],
    };
    try {
      verifySourcesInputMatchesApprovedMappings({
        sources,
        candidateRows: candidates.rows,
        reviews,
      });
      expect.unreachable();
    } catch (error) {
      expect((error as EngineeringTextbookMappingError).code).toBe('sources-ledger-mismatch');
    }
  });
});
