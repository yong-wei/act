import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertLedgerClosesCorpus,
  collectRenderableIdentityKeys,
  governedMathLedgerDir,
  readGovernedMathLedger,
  readGovernedMathReview,
  readGovernedMathUpstreamRepair,
  renderableDigestFor,
} from './ledger';
import { loadGovernedMathSidecarCorpus, type GovernedMathSidecarCorpus } from './sidecar';
import { sampleKatexStrictPass, validateGovernedMathCorpus } from './validate';

export interface GovernedMathQualificationReport {
  readonly releaseId: string;
  readonly releaseHash: string;
  readonly fileHashes: Readonly<Record<string, string>>;
  readonly counts: {
    readonly documents: number;
    readonly mathSpans: number;
    readonly fragments: number;
    readonly formulas: number;
  };
  readonly validationOk: boolean;
  readonly ledgerClosed: boolean;
  readonly katexSampleIssues: readonly string[];
}

export function qualifyGovernedMathRelease(repoRoot = process.cwd()): GovernedMathQualificationReport {
  const corpus = loadGovernedMathSidecarCorpus(join(repoRoot, 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.37-r3'));
  return qualifyGovernedMathCorpus(corpus, repoRoot);
}

export function qualifyGovernedMathCorpus(
  corpus: GovernedMathSidecarCorpus,
  repoRoot = process.cwd(),
): GovernedMathQualificationReport {
  const validation = validateGovernedMathCorpus(corpus);
  if (!validation.ok) {
    throw new Error(`governed math sidecar validation failed: ${validation.issues.map((row) => row.code).join(',')}`);
  }
  const ledger = readGovernedMathLedger(repoRoot);
  const katexIssues = sampleKatexStrictPass(corpus, Number.POSITIVE_INFINITY).filter((issue) => {
    return !ledger.registeredUnavailable.some((row) => issue.message.includes(row.mathAssetId));
  });
  if (katexIssues.length > 0) {
    throw new Error(`governed math KaTeX sample failed: ${katexIssues.map((row) => row.message).join('; ')}`);
  }
  const review = readGovernedMathReview(repoRoot);
  const repair = readGovernedMathUpstreamRepair(repoRoot);
  assertLedgerClosesCorpus(corpus, ledger, review, repair);
  const report: GovernedMathQualificationReport = {
    releaseId: corpus.readiness.release_id,
    releaseHash: corpus.readiness.release_hash,
    fileHashes: corpus.fileHashes,
    counts: {
      documents: validation.counts.documents,
      mathSpans: validation.counts.mathSpans,
      fragments: validation.counts.fragments,
      formulas: validation.counts.formulas,
    },
    validationOk: true,
    ledgerClosed: true,
    katexSampleIssues: [],
  };
  const outDir = governedMathLedgerDir(repoRoot);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'baseline-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function buildEmptyRenderableLedger(corpus: GovernedMathSidecarCorpus): {
  renderableDigest: string;
  mathSpanCount: number;
} {
  const keys = collectRenderableIdentityKeys(corpus);
  return {
    renderableDigest: renderableDigestFor(keys),
    mathSpanCount: keys.length,
  };
}
