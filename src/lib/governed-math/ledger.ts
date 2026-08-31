import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sha256Text } from '@/lib/source-pack/sha256';

import { identityKey } from './project';
import type { GovernedMathSidecarCorpus } from './sidecar';
import type {
  GovernedMathDispositionLedger,
  GovernedMathReviewRecord,
  GovernedMathUpstreamRepairPackage,
} from './types';

export const GOVERNED_MATH_LEDGER_RELATIVE =
  'course-content/authoring/knowledge/governance/governed-math/control-theory-engineering-v0.37-r3' as const;

export function governedMathLedgerDir(repoRoot = process.cwd()): string {
  return join(repoRoot, GOVERNED_MATH_LEDGER_RELATIVE);
}

export function renderableDigestFor(keys: readonly string[]): string {
  return sha256Text([...keys].sort().join('\n'));
}

export function collectRenderableIdentityKeys(corpus: GovernedMathSidecarCorpus): string[] {
  const keys: string[] = [];
  for (const document of corpus.documents) {
    for (const block of document.blocks) {
      for (const span of block.spans) {
        if (span.kind !== 'math' || !span.math_ref) continue;
        keys.push(identityKey({
          releaseHash: corpus.readiness.release_hash,
          documentId: document.id,
          fieldPath: document.field_path,
          locale: document.locale,
          mathAssetId: span.math_ref.id,
        }));
      }
    }
  }
  for (const formula of corpus.formulas.values()) {
    for (const locale of ['zh-CN', 'en'] as const) {
      keys.push(identityKey({
        releaseHash: corpus.readiness.release_hash,
        documentId: formula.formula_id,
        fieldPath: 'formula_render',
        locale,
        mathAssetId: formula.formula_id,
      }));
    }
  }
  return keys.sort();
}

export function readGovernedMathLedger(repoRoot = process.cwd()): GovernedMathDispositionLedger {
  const raw = JSON.parse(readFileSync(join(governedMathLedgerDir(repoRoot), 'disposition.json'), 'utf8')) as GovernedMathDispositionLedger;
  if (raw.contract !== 'act-governed-math-disposition/v1') {
    throw new Error('governed math disposition contract is not admitted');
  }
  return raw;
}

export function readGovernedMathReview(repoRoot = process.cwd()): GovernedMathReviewRecord {
  const raw = JSON.parse(readFileSync(join(governedMathLedgerDir(repoRoot), 'review.json'), 'utf8')) as GovernedMathReviewRecord;
  if (raw.contract !== 'act-governed-math-review/v1') {
    throw new Error('governed math review contract is not admitted');
  }
  return raw;
}

export function readGovernedMathUpstreamRepair(repoRoot = process.cwd()): GovernedMathUpstreamRepairPackage {
  const raw = JSON.parse(readFileSync(join(governedMathLedgerDir(repoRoot), 'upstream-repair.json'), 'utf8')) as GovernedMathUpstreamRepairPackage;
  if (raw.contract !== 'act-governed-math-upstream-repair/v1') {
    throw new Error('governed math upstream repair contract is not admitted');
  }
  return raw;
}

export function ledgerExists(repoRoot = process.cwd()): boolean {
  return existsSync(join(governedMathLedgerDir(repoRoot), 'disposition.json'));
}

export function assertLedgerClosesCorpus(
  corpus: GovernedMathSidecarCorpus,
  ledger: GovernedMathDispositionLedger,
  review: GovernedMathReviewRecord,
  repair: GovernedMathUpstreamRepairPackage,
): void {
  if (ledger.releaseId !== corpus.readiness.release_id || ledger.releaseHash !== corpus.readiness.release_hash) {
    throw new Error('governed math ledger is bound to a different Authority release');
  }
  if (review.releaseId !== ledger.releaseId || review.releaseHash !== ledger.releaseHash) {
    throw new Error('governed math review is bound to a different Authority release');
  }
  if (repair.releaseId !== ledger.releaseId || repair.releaseHash !== ledger.releaseHash) {
    throw new Error('governed math repair package is bound to a different Authority release');
  }
  const renderableKeys = collectRenderableIdentityKeys(corpus);
  const unavailableKeys = new Set(ledger.registeredUnavailable.map((row) => row.identityKey));
  if (unavailableKeys.size !== ledger.registeredUnavailable.length) {
    throw new Error('governed math ledger contains duplicate unavailable rows');
  }
  for (const row of ledger.registeredUnavailable) {
    if (row.releaseHash !== ledger.releaseHash) {
      throw new Error('governed math unavailable row crossed a release boundary');
    }
    if (!row.reviewedBy || !row.reviewedAt || !row.fallbackText) {
      throw new Error('governed math unavailable row is missing course-owner review');
    }
    if (!renderableKeys.includes(row.identityKey)) {
      throw new Error(`governed math unavailable ${row.identityKey} is not in the current corpus`);
    }
  }
  const digest = renderableDigestFor(renderableKeys.filter((key) => !unavailableKeys.has(key)));
  if (digest !== ledger.renderableDigest) {
    throw new Error('governed math renderable digest drifted from the current corpus');
  }
  let documentSpanCount = 0;
  for (const document of corpus.documents) {
    for (const block of document.blocks) {
      for (const span of block.spans) {
        if (span.kind === 'math' && span.math_ref) documentSpanCount += 1;
      }
    }
  }
  if (
    ledger.denominator.documentCount !== corpus.documents.length
    || ledger.denominator.fragmentCount !== corpus.fragments.size
    || ledger.denominator.formulaCount !== corpus.formulas.size
    || ledger.denominator.mathSpanCount !== documentSpanCount
  ) {
    throw new Error(
      `governed math ledger denominator drifted from the current corpus (${corpus.documents.length}/${corpus.fragments.size}/${corpus.formulas.size}/${documentSpanCount})`,
    );
  }
  if (review.unavailableCount !== ledger.registeredUnavailable.length || review.decision !== 'approved') {
    throw new Error('governed math review does not close the unavailable set');
  }
  const repairKeys = new Set(repair.items.map((item) => item.identityKey));
  for (const row of ledger.registeredUnavailable) {
    if (row.upstreamStatus === 'open' && !repairKeys.has(row.identityKey)) {
      throw new Error(`governed math unavailable ${row.identityKey} is missing from the upstream repair package`);
    }
  }
}

export function assertGovernanceArtifactsStayOffline(sourceText: string): void {
  if (sourceText.includes(GOVERNED_MATH_LEDGER_RELATIVE)) {
    throw new Error('governed math governance artifacts must not be imported into runtime modules');
  }
}
