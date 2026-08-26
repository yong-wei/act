import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createGovernedKatexOptions,
  latexContainsUnsafeCommands,
} from '@/lib/governed-math/katex-config';
import {
  assertLedgerClosesCorpus,
  GOVERNED_MATH_LEDGER_RELATIVE,
  readGovernedMathLedger,
  readGovernedMathReview,
  readGovernedMathUpstreamRepair,
} from '@/lib/governed-math/ledger';
import {
  projectGovernedDescription,
  projectGovernedFormula,
  projectGovernedRichText,
  projectGovernedTitle,
} from '@/lib/governed-math/project';
import { qualifyGovernedMathRelease } from '@/lib/governed-math/qualify';
import {
  governedKatexCallCount,
  renderGovernedKatexHtml,
  resetGovernedKatexCache,
} from '@/lib/governed-math/render-cache';
import { matchesGovernedSearch, stripLatexCommandNoise } from '@/lib/governed-math/search-text';
import { loadGovernedMathSidecarCorpus } from '@/lib/governed-math/sidecar';
import { validateGovernedMathCorpus } from '@/lib/governed-math/validate';
import { GOVERNED_KATEX_MACRO_PROFILE_HASH, GOVERNED_KATEX_MACRO_PROFILE_ID } from '@/lib/governed-math/types';

describe('governed math sidecar consumption', () => {
  const corpus = loadGovernedMathSidecarCorpus();

  it('closes r3 sidecar hashes, identity and references', () => {
    const validation = validateGovernedMathCorpus(corpus);
    expect(validation.ok).toBe(true);
    expect(validation.counts.documents).toBe(2578);
    expect(validation.counts.mathSpans).toBe(6268);
    expect(validation.counts.fragments).toBe(297);
    expect(validation.counts.formulas).toBe(1995);
    expect(corpus.readiness.release_id).toBe('ctr:release:control-theory-engineering-v0.37');
    expect(corpus.readiness.release_hash).toBe(
      'cc73fa150a94fb0a3891c4b5d26eba9ca190f28334782a974333016f734fea39',
    );
  });

  it('projects a real bilingual title with inline math instead of formula_latex', () => {
    const document = corpus.documents.find((row) => (
      row.locale === 'zh-CN'
      && row.field_path === 'statement_text'
      && row.blocks.some((block) => block.spans.some((span) => span.kind === 'math'))
    ));
    expect(document).toBeTruthy();
    const projected = projectGovernedTitle(corpus, document!.target_id, 'zh-CN');
    expect(projected.state).toBe('available');
    if (projected.state !== 'available') return;
    expect(projected.blocks.some((block) => block.spans.some((span) => span.kind === 'math'))).toBe(true);
    expect(projected.copyText).toBe(document!.plain_text_fallback);
    expect(JSON.stringify(projected)).not.toContain('formula_latex');
    expect(JSON.stringify(projected)).not.toContain(corpus.readiness.release_id);
  });

  it('keeps historical delimiters as ordinary text', () => {
    const projected = projectGovernedRichText({
      corpus: {
        ...corpus,
        documents: [{
          ...corpus.documents[0],
          id: 'ctrich:test-plain-delimiters',
          target_id: 'ctc:test-plain-delimiters',
          field_path: 'meaning',
          locale: 'zh-CN',
          plain_text_fallback: '增益 $G(s)$ 与 $$H(s)$$',
          blocks: [{
            id: 'ctrb:test',
            kind: 'paragraph',
            source_range: { start: 0, end: 18 },
            spans: [{
              id: 'ctrs:test',
              kind: 'text',
              source_range: { start: 0, end: 18 },
              text: '增益 $G(s)$ 与 $$H(s)$$',
            }],
          }],
          math_slot_ids: [],
        }],
      },
      targetId: 'ctc:test-plain-delimiters',
      locale: 'zh-CN',
      fieldPath: 'meaning',
    });
    expect(projected.state).toBe('available');
    if (projected.state !== 'available') return;
    expect(projected.blocks[0]?.spans).toEqual([
      { kind: 'text', text: '增益 $G(s)$ 与 $$H(s)$$' },
    ]);
  });

  it('rejects unsafe commands and unknown macros', () => {
    expect(latexContainsUnsafeCommands('\\href{javascript:alert(1)}{x}')).toBe(true);
    expect(() => createGovernedKatexOptions({
      displayMode: false,
      macroProfileId: 'ctmacro:unknown',
      macroProfileHash: '0'.repeat(64),
    })).toThrow(/macro profile is not admitted/);
    resetGovernedKatexCache();
    expect(() => renderGovernedKatexHtml({
      latex: '\\html{<img src=x>}',
      displayMode: false,
      macroProfileId: GOVERNED_KATEX_MACRO_PROFILE_ID,
      macroProfileHash: GOVERNED_KATEX_MACRO_PROFILE_HASH,
      theme: 'dark',
    })).toThrow();
  });

  it('caches KaTeX by content identity instead of coordinates', () => {
    resetGovernedKatexCache();
    const input = {
      latex: '\\tau',
      displayMode: false,
      macroProfileId: GOVERNED_KATEX_MACRO_PROFILE_ID,
      macroProfileHash: GOVERNED_KATEX_MACRO_PROFILE_HASH,
      theme: 'dark' as const,
    };
    renderGovernedKatexHtml(input);
    renderGovernedKatexHtml(input);
    expect(governedKatexCallCount()).toBe(1);
  });

  it('search matches accessible labels without treating command noise as the default term', () => {
    expect(stripLatexCommandNoise('\\frac{1}{s}')).not.toContain('\\frac');
    expect(matchesGovernedSearch('时间常数 tau', 'tau')).toBe(true);
    expect(matchesGovernedSearch('时间常数 tau', '\\frac')).toBe(false);
  });

  it('closes the reviewed unavailable ledger and keeps governance offline', () => {
    const ledger = readGovernedMathLedger();
    const review = readGovernedMathReview();
    const repair = readGovernedMathUpstreamRepair();
    assertLedgerClosesCorpus(corpus, ledger, review, repair);
    expect(ledger.registeredUnavailable).toHaveLength(2);
    const attachSource = readFileSync(path.join(process.cwd(), 'src/lib/governed-math/attach.ts'), 'utf8');
    const apiSource = readFileSync(path.join(process.cwd(), 'src/app/api/knowledge/_active-authority.ts'), 'utf8');
    expect(attachSource).not.toContain(GOVERNED_MATH_LEDGER_RELATIVE);
    expect(apiSource).not.toContain('disposition.json');
    expect(apiSource).not.toContain('upstream-repair.json');
  });

  it('qualifies the current Authority release and writes a baseline report', () => {
    const report = qualifyGovernedMathRelease();
    expect(report.validationOk).toBe(true);
    expect(report.ledgerClosed).toBe(true);
    expect(report.counts.mathSpans).toBe(6268);
    const written = JSON.parse(readFileSync(path.join(
      process.cwd(),
      'course-content/authoring/knowledge/governance/governed-math/control-theory-engineering-v0.37-r3/baseline-report.json',
    ), 'utf8')) as { releaseHash: string };
    expect(written.releaseHash).toBe(corpus.readiness.release_hash);
  });

  it('does not project the registered unavailable formula as copyable LaTeX', () => {
    expect(() => projectGovernedFormula(
      corpus,
      'ctkg:v3e-object-7eff4a56f030e68b38e4fe61',
      'zh-CN',
    )).toThrow(/unregistered governed math failure/);
    const projected = projectGovernedFormula(
      corpus,
      'ctkg:v3e-object-7eff4a56f030e68b38e4fe61',
      'zh-CN',
      readGovernedMathLedger(),
    );
    expect(projected.state).toBe('registered-unavailable');
    if (projected.state !== 'registered-unavailable') return;
    expect(projected).not.toHaveProperty('copyLatex');
  });

  it('keeps a description projection for meaning fields', () => {
    const document = corpus.documents.find((row) => row.locale === 'en' && row.field_path === 'meaning');
    expect(document).toBeTruthy();
    const projected = projectGovernedDescription(corpus, document!.target_id, 'en');
    expect(projected.state === 'available' || projected.state === 'missing').toBe(true);
  });
});
