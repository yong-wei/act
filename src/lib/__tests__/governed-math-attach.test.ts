/**
 * Bounded governed formula projection on canvas surfaces (#1740).
 *
 * Materialized Formula objects in domain/relation-family/neighborhood shards
 * and bounded search hits carry the exact-release governed formula render
 * projection. Cross-release or unregistered records degrade to `missing` so
 * the prose label keeps rendering as the object name — never as a substitute
 * formula presentation.
 */

import { describe, expect, it } from 'vitest';

import {
  loadDomainSearchIndexShard,
  loadNodeNeighborhoodShard,
  loadRelationFamilyShard,
  loadShardSetCoverage,
} from '@/lib/authority-domain-shards';
import type { AuthorityNodeNeighborhoodShard } from '@/lib/authority-domain-shards/contracts';
import {
  attachGovernedMathToLearnerShard,
  attachGovernedMathToSearchHits,
  governedFormulaSearchTerms,
} from '@/lib/governed-math/attach';
import { readGovernedMathLedger } from '@/lib/governed-math/ledger';
import { projectGovernedFormula } from '@/lib/governed-math/project';
import {
  governedKatexCallCount,
  resetGovernedKatexCache,
} from '@/lib/governed-math/render-cache';
import { loadGovernedMathSidecarCorpus } from '@/lib/governed-math/sidecar';
import type { AuthorityDomainSearchHit } from '@/lib/authority-domain-shards/contracts';

const corpus = loadGovernedMathSidecarCorpus();

/** The ledger-reviewed katex-strict failure: offline ledger → missing. */
const LEDGER_UNAVAILABLE_FORMULA = 'ctkg:v3e-object-7eff4a56f030e68b38e4fe61';
/** Record with null render_latex: projection falls back to original_latex. */
const NULL_RENDER_LATEX_FORMULA = 'ctf:28bfbee3df87fbdabc78a1b6';

function findFormulaEntry(): { id: string; domainId: string } {
  const coverage = loadShardSetCoverage();
  for (const domain of coverage.domains) {
    const index = loadDomainSearchIndexShard(domain.domainId);
    const entry = index.entries.find((row) => row.canonicalType === 'Formula');
    if (entry) return { id: entry.id, domainId: domain.domainId };
  }
  throw new Error('no Formula entry found in the sealed search indexes');
}

function withReleaseId(
  shard: AuthorityNodeNeighborhoodShard,
  releaseId: string,
): AuthorityNodeNeighborhoodShard {
  return {
    ...shard,
    envelope: {
      ...shard.envelope,
      authority: { ...shard.envelope.authority, releaseId },
    },
  };
}

describe('governed math formula attach (#1740)', () => {
  it('attaches the governed formula projection to a materialized Formula object', () => {
    const entry = findFormulaEntry();
    const neighborhood = loadNodeNeighborhoodShard(entry.id);
    const attached = attachGovernedMathToLearnerShard(neighborhood, 'zh-CN');
    const formula = attached.objects.find((object) => object.id === entry.id);
    expect(formula).toBeTruthy();
    const mathematics = formula?.mathematics;
    expect(mathematics?.state).toBe('available');
    if (mathematics?.state !== 'available') return;
    const record = corpus.formulas.get(entry.id);
    expect(record).toBeTruthy();
    expect(mathematics.latex).toBe(record?.render_latex ?? record?.original_latex);
    expect(mathematics.macroProfileId).toBe('ctmacro:katex-default-v1');
    expect(mathematics.renderKey).toHaveLength(32);
    // Prose label keeps its identity role; the accessible name follows the
    // governed formula meaning (#1740 spec: same identity across surfaces).
    expect(formula?.label).toBe(
      neighborhood.objects.find((object) => object.id === entry.id)?.label,
    );
    expect(formula?.accessibleName).toBe(mathematics.accessibleLabel);
    expect(formula?.searchText).toContain(mathematics.accessibleLabel);
    // No raw upstream fields cross the API boundary.
    const serialized = JSON.stringify(formula);
    expect(serialized).not.toContain('original_latex');
    expect(serialized).not.toContain('render_engine');
    expect(serialized).not.toContain('normalized_latex');
  });

  it('keeps non-Formula objects free of formula projections', () => {
    const entry = findFormulaEntry();
    const neighborhood = loadNodeNeighborhoodShard(entry.id);
    const attached = attachGovernedMathToLearnerShard(neighborhood, 'zh-CN');
    const other = attached.objects.find((object) => object.id !== entry.id);
    if (!other) return;
    expect(other.mathematics).toBeUndefined();
  });

  it('does not attach formula projections across Authority releases', () => {
    const entry = findFormulaEntry();
    const neighborhood = withReleaseId(
      loadNodeNeighborhoodShard(entry.id),
      'ctr:release:control-theory-engineering-v0.9',
    );
    const attached = attachGovernedMathToLearnerShard(neighborhood, 'zh-CN');
    const formula = attached.objects.find((object) => object.id === entry.id);
    // Fail closed: no cross-release fallback, no prose-as-formula.
    expect(formula?.mathematics).toBeUndefined();
    expect(formula?.label).toBe(
      neighborhood.objects.find((object) => object.id === entry.id)?.label,
    );
  });

  it('degrades the ledger-reviewed unavailable formula to missing at runtime', () => {
    const neighborhood = loadNodeNeighborhoodShard(LEDGER_UNAVAILABLE_FORMULA);
    const attached = attachGovernedMathToLearnerShard(neighborhood, 'zh-CN');
    const formula = attached.objects.find((object) => object.id === LEDGER_UNAVAILABLE_FORMULA);
    expect(formula).toBeTruthy();
    // The disposition ledger stays offline; without it the projection is
    // missing and the node keeps its upstream name instead of a fake formula.
    expect(formula?.mathematics).toBeUndefined();
  });

  it('projects a null render_latex record through the reviewed original latex', () => {
    const neighborhood = loadNodeNeighborhoodShard(NULL_RENDER_LATEX_FORMULA);
    const attached = attachGovernedMathToLearnerShard(neighborhood, 'zh-CN');
    const formula = attached.objects.find((object) => object.id === NULL_RENDER_LATEX_FORMULA);
    expect(formula?.mathematics?.state).toBe('available');
    if (formula?.mathematics?.state !== 'available') return;
    expect(formula.mathematics.latex).toContain('\\text{或}');
    // 请求 locale 选择受治理的 locale 限定表达式（#1740 同 locale 投影）。
    const english = attachGovernedMathToLearnerShard(neighborhood, 'en');
    const englishFormula = english.objects.find((object) => object.id === NULL_RENDER_LATEX_FORMULA);
    expect(englishFormula?.mathematics?.state).toBe('available');
    if (englishFormula?.mathematics?.state !== 'available') return;
    expect(englishFormula.mathematics.latex).toContain('\\text{or}');
    expect(englishFormula.mathematics.latex).not.toContain('或');
    expect(englishFormula.mathematics.renderKey).not.toBe(formula.mathematics.renderKey);
  });

  it('attaches projections only to bounded Formula search hits of the same release', () => {
    const coverage = loadShardSetCoverage();
    const domain = coverage.domains[0]!;
    const index = loadDomainSearchIndexShard(domain.domainId);
    const formulaEntry = index.entries.find((row) => row.canonicalType === 'Formula');
    const conceptEntry = index.entries.find((row) => row.canonicalType === 'DomainConcept');
    expect(formulaEntry).toBeTruthy();
    const hits: AuthorityDomainSearchHit[] = [
      { ...formulaEntry!, typeLabel: null },
      { ...conceptEntry!, typeLabel: null },
    ];
    const attached = attachGovernedMathToSearchHits(hits, 'zh-CN', corpus.readiness.release_id);
    expect(attached[0]?.mathematics?.state).toBe('available');
    expect(attached[1]?.mathematics).toBeUndefined();
    const crossRelease = attachGovernedMathToSearchHits(
      [hits[0]!],
      'zh-CN',
      'ctr:release:control-theory-engineering-v0.9',
    );
    expect(crossRelease[0]?.mathematics?.state ?? 'missing').toBe('missing');
  });

  it('derives locale-bound governed search terms without rendering KaTeX', () => {
    resetGovernedKatexCache();
    const terms = governedFormulaSearchTerms(
      [NULL_RENDER_LATEX_FORMULA],
      'en',
      corpus.readiness.release_id,
    );
    expect(terms.get(NULL_RENDER_LATEX_FORMULA)).toContain('or');
    expect(terms.get(NULL_RENDER_LATEX_FORMULA)).not.toContain('\\text');
    const zhTerms = governedFormulaSearchTerms(
      [NULL_RENDER_LATEX_FORMULA],
      'zh-CN',
      corpus.readiness.release_id,
    );
    expect(zhTerms.get(NULL_RENDER_LATEX_FORMULA)).toContain('或');
    const crossRelease = governedFormulaSearchTerms(
      [NULL_RENDER_LATEX_FORMULA],
      'en',
      'ctr:release:control-theory-engineering-v0.9',
    );
    expect(crossRelease.size).toBe(0);
    // 字符串推导不执行 KaTeX。
    expect(governedKatexCallCount()).toBe(0);
  });

  it('closes the complete reachable Formula denominator against the sealed render index', () => {
    const coverage = loadShardSetCoverage();
    const formulaIds = new Set<string>();
    for (const domain of coverage.domains) {
      const index = loadDomainSearchIndexShard(domain.domainId);
      for (const entry of index.entries) {
        if (entry.canonicalType === 'Formula') formulaIds.add(entry.id);
      }
    }
    // Exact-release denominator: every reachable Formula owns a current
    // formula-render record (#1740 fail-closed qualification).
    // r6 分片集（ads-d9dfe50b，#2058）较 r4 少 2 条可达 Formula：1995 → 1993。
    expect(formulaIds.size).toBe(1993);
    for (const id of formulaIds) {
      expect(corpus.formulas.has(id)).toBe(true);
    }
    // 资格阶段闭合证据：唯一严格渲染失败记录持有课程负责人已审核的
    // registered-unavailable 处置（corpus 级全量采样闭合由
    // governed-math-sidecar qualification 测试承担），运行期才能安全地
    // 把治理 ledger 保持离线（#1740）。
    const ledger = readGovernedMathLedger();
    for (const locale of ['zh-CN', 'en'] as const) {
      const projection = projectGovernedFormula(corpus, LEDGER_UNAVAILABLE_FORMULA, locale, ledger);
      expect(projection.state).toBe('registered-unavailable');
    }
  });

  it('materializes Formula objects in relation-family shards with the same projection', () => {
    const coverage = loadShardSetCoverage();
    const domain = coverage.domains.find((row) => row.domainId === 'system-modeling') ?? coverage.domains[0]!;
    const family = loadRelationFamilyShard(domain.domainId, 'derivation-and-representation');
    const attached = attachGovernedMathToLearnerShard(family, 'zh-CN');
    const formula = attached.objects.find((object) => object.canonicalType === 'Formula');
    if (!formula) return;
    expect(formula.mathematics?.state).toBe('available');
    if (formula.mathematics?.state !== 'available') return;
    expect(corpus.formulas.get(formula.id)).toBeTruthy();
  });
});
