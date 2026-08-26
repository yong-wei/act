import { sha256Text } from '@/lib/source-pack/sha256';

import {
  admittedMacroProfile,
  isAdmittedRenderEngineContract,
  latexContainsUnsafeCommands,
} from './katex-config';
import { tryRenderGovernedKatex } from './render-cache';
import { stripLatexCommandNoise, uniqueSearchTerms } from './search-text';
import type {
  FormulaRenderRecord,
  GovernedMathSidecarCorpus,
  LocalizedContentRecord,
  LocalizedRichTextDocument,
  TypedMathFragmentRecord,
} from './sidecar';
import type {
  GovernedFormulaProjection,
  GovernedMathDispositionLedger,
  GovernedMathLocale,
  GovernedMathSpan,
  GovernedRichTextBlock,
  GovernedRichTextProjection,
  GovernedRichTextSpan,
} from './types';
import {
  GOVERNED_KATEX_MACRO_PROFILE_HASH,
  GOVERNED_KATEX_MACRO_PROFILE_ID,
  GOVERNED_RICH_TEXT_DESCRIPTION_FIELDS,
  GOVERNED_RICH_TEXT_TITLE_FIELD,
} from './types';

const LANGUAGE_NEUTRAL = 'language_neutral';

export function opaqueRenderKey(parts: readonly string[]): string {
  return sha256Text(parts.join('\u0000')).slice(0, 32);
}

export function identityKey(input: {
  releaseHash: string;
  documentId: string;
  fieldPath: string;
  locale: string;
  mathAssetId: string;
}): string {
  return [input.releaseHash, input.documentId, input.fieldPath, input.locale, input.mathAssetId].join(':');
}

function lookupUnavailable(
  ledger: GovernedMathDispositionLedger | null,
  key: string,
) {
  return ledger?.registeredUnavailable.find((row) => row.identityKey === key) ?? null;
}

function accessibleLabelForFragment(
  fragment: TypedMathFragmentRecord,
  locale: GovernedMathLocale,
  content: ReadonlyMap<string, LocalizedContentRecord>,
): string | null {
  const assertionId = fragment.accessible_label_assertion_ids[locale];
  if (assertionId) {
    const assertion = content.get(assertionId);
    if (assertion && assertion.locale === locale) {
      const value = assertion.value.replace(/^\$+|\$+$/gu, '').trim();
      if (value) return value;
    }
  }
  for (const record of content.values()) {
    if (record.field_path === 'accessibility_label' && record.target_id === fragment.id && record.locale === locale) {
      const value = record.value.replace(/^\$+|\$+$/gu, '').trim();
      if (value) return value;
    }
  }
  if (fragment.language_mode === LANGUAGE_NEUTRAL) {
    const source = (fragment.source_text ?? fragment.normalized_latex).trim();
    return source || null;
  }
  return null;
}

function trustedLatex(fragment: TypedMathFragmentRecord): string {
  return fragment.render_latex || fragment.normalized_latex;
}

function projectMathSpan(input: {
  fragment: TypedMathFragmentRecord;
  locale: GovernedMathLocale;
  corpus: GovernedMathSidecarCorpus;
  displayMode: 'inline' | 'block';
}): { ok: true; span: GovernedMathSpan } | { ok: false; reasonCode: string } {
  if (input.fragment.validation.katex !== 'PASS' || input.fragment.validation.safety !== 'PASS') {
    return { ok: false, reasonCode: 'fragment-validation-failed' };
  }
  const profile = admittedMacroProfile(input.fragment.macro_profile_id, input.fragment.macro_profile_hash);
  if (!profile) return { ok: false, reasonCode: 'macro-profile-not-admitted' };
  const latex = trustedLatex(input.fragment);
  if (!latex || latexContainsUnsafeCommands(latex)) {
    return { ok: false, reasonCode: 'unsafe-or-empty-latex' };
  }
  const rendered = tryRenderGovernedKatex({
    latex,
    displayMode: input.displayMode === 'block',
    macroProfileId: profile.id,
    macroProfileHash: profile.hash,
    theme: 'dark',
  });
  if (!rendered.ok) return { ok: false, reasonCode: 'katex-strict-failed' };
  const accessibleLabel = accessibleLabelForFragment(input.fragment, input.locale, input.corpus.localizedContent);
  if (!accessibleLabel) return { ok: false, reasonCode: 'missing-accessible-label' };
  return {
    ok: true,
    span: {
      kind: 'math',
      display: input.displayMode,
      latex,
      macroProfileId: profile.id,
      macroProfileHash: profile.hash,
      accessibleLabel,
      copyLatex: latex,
      renderKey: opaqueRenderKey([profile.id, profile.hash, input.displayMode, latex]),
    },
  };
}

export function documentsForTarget(
  corpus: GovernedMathSidecarCorpus,
  targetId: string,
  locale: GovernedMathLocale,
): LocalizedRichTextDocument[] {
  return corpus.documents.filter((row) => row.target_id === targetId && row.locale === locale);
}

export function projectGovernedRichText(input: {
  corpus: GovernedMathSidecarCorpus;
  targetId: string;
  locale: GovernedMathLocale;
  fieldPath: string;
  ledger?: GovernedMathDispositionLedger | null;
  surface?: 'title' | 'description';
}): GovernedRichTextProjection {
  const document = documentsForTarget(input.corpus, input.targetId, input.locale)
    .find((row) => row.field_path === input.fieldPath);
  if (!document) return { state: 'missing' };
  const titleSurface = input.surface === 'title' || input.fieldPath === GOVERNED_RICH_TEXT_TITLE_FIELD;
  const blocks: GovernedRichTextBlock[] = [];
  const accessibleParts: string[] = [];
  const searchParts: string[] = [document.plain_text_fallback];
  for (const block of document.blocks) {
    const spans: GovernedRichTextSpan[] = [];
    for (const span of block.spans) {
      if (span.kind === 'text') {
        const text = span.text ?? '';
        spans.push({ kind: 'text', text });
        accessibleParts.push(text);
        continue;
      }
      if (span.kind !== 'math' || !span.math_ref) {
        return { state: 'missing' };
      }
      const key = identityKey({
        releaseHash: input.corpus.readiness.release_hash,
        documentId: document.id,
        fieldPath: document.field_path,
        locale: document.locale,
        mathAssetId: span.math_ref.id,
      });
      const unavailable = lookupUnavailable(input.ledger ?? null, key);
      if (span.math_ref.kind !== 'fragment') {
        if (unavailable) {
          return {
            state: 'registered-unavailable',
            locale: input.locale,
            reasonCode: unavailable.reasonCode,
            fallbackText: unavailable.fallbackText,
            accessibleName: unavailable.fallbackText,
          };
        }
        return titleSurface
          ? {
            state: 'registered-unavailable',
            locale: input.locale,
            reasonCode: 'unregistered-math-failure',
            fallbackText: document.plain_text_fallback,
            accessibleName: document.plain_text_fallback,
          }
          : {
            state: 'registered-unavailable',
            locale: input.locale,
            reasonCode: 'unregistered-math-failure',
            fallbackText: document.plain_text_fallback,
            accessibleName: document.plain_text_fallback,
          };
      }
      const fragment = input.corpus.fragments.get(span.math_ref.id);
      if (!fragment) {
        if (unavailable) {
          return {
            state: 'registered-unavailable',
            locale: input.locale,
            reasonCode: unavailable.reasonCode,
            fallbackText: unavailable.fallbackText,
            accessibleName: unavailable.fallbackText,
          };
        }
        throw new Error(`unregistered governed math failure: ${key}`);
      }
      const display = span.display_mode === 'block' ? 'block' : 'inline';
      if (titleSurface && display === 'block') {
        if (unavailable) {
          return {
            state: 'registered-unavailable',
            locale: input.locale,
            reasonCode: unavailable.reasonCode,
            fallbackText: unavailable.fallbackText,
            accessibleName: unavailable.fallbackText,
          };
        }
        throw new Error(`unregistered governed math failure: title-block-display:${key}`);
      }
      const projected = projectMathSpan({
        fragment,
        locale: input.locale,
        corpus: input.corpus,
        displayMode: display,
      });
      if (!projected.ok) {
        if (unavailable) {
          spans.push({ kind: 'text', text: unavailable.fallbackText });
          accessibleParts.push(unavailable.fallbackText);
          continue;
        }
        throw new Error(`unregistered governed math failure: ${projected.reasonCode}:${key}`);
      }
      spans.push(projected.span);
      accessibleParts.push(projected.span.accessibleLabel);
      searchParts.push(projected.span.accessibleLabel, stripLatexCommandNoise(fragment.source_text ?? fragment.normalized_latex));
    }
    blocks.push({
      kind: block.kind === 'math_block' || block.kind === 'math-block' ? 'math-block' : 'paragraph',
      spans,
    });
  }
  const accessibleName = accessibleParts.join('').replace(/\s+/gu, ' ').trim() || document.plain_text_fallback;
  return {
    state: 'available',
    locale: input.locale,
    contentHash: document.content_hash,
    renderKey: opaqueRenderKey([document.content_hash, input.locale, document.field_path]),
    accessibleName,
    copyText: document.plain_text_fallback,
    searchText: uniqueSearchTerms(searchParts),
    blocks,
  };
}

export function projectGovernedTitle(
  corpus: GovernedMathSidecarCorpus,
  targetId: string,
  locale: GovernedMathLocale,
  ledger?: GovernedMathDispositionLedger | null,
): GovernedRichTextProjection {
  return projectGovernedRichText({
    corpus,
    targetId,
    locale,
    fieldPath: GOVERNED_RICH_TEXT_TITLE_FIELD,
    ledger,
    surface: 'title',
  });
}

export function projectGovernedDescription(
  corpus: GovernedMathSidecarCorpus,
  targetId: string,
  locale: GovernedMathLocale,
  ledger?: GovernedMathDispositionLedger | null,
): GovernedRichTextProjection {
  for (const fieldPath of GOVERNED_RICH_TEXT_DESCRIPTION_FIELDS) {
    const projected = projectGovernedRichText({
      corpus,
      targetId,
      locale,
      fieldPath,
      ledger,
      surface: 'description',
    });
    if (projected.state !== 'missing') return projected;
  }
  return { state: 'missing' };
}

export function projectGovernedFormula(
  corpus: GovernedMathSidecarCorpus,
  formulaId: string,
  locale: GovernedMathLocale,
  ledger?: GovernedMathDispositionLedger | null,
): GovernedFormulaProjection {
  const record: FormulaRenderRecord | undefined = corpus.formulas.get(formulaId);
  if (!record) return { state: 'missing' };
  const key = identityKey({
    releaseHash: corpus.readiness.release_hash,
    documentId: formulaId,
    fieldPath: 'formula_render',
    locale,
    mathAssetId: formulaId,
  });
  const unavailable = lookupUnavailable(ledger ?? null, key);
  if (
    record.validation.katex !== 'PASS'
    || record.validation.safety !== 'PASS'
    || !isAdmittedRenderEngineContract(record.render_engine_contract)
    || latexContainsUnsafeCommands(record.render_latex ?? record.original_latex ?? '')
  ) {
    if (unavailable) {
      return {
        state: 'registered-unavailable',
        reasonCode: unavailable.reasonCode,
        fallbackText: unavailable.fallbackText,
        accessibleName: unavailable.fallbackText,
      };
    }
    throw new Error(`unregistered governed math failure: ${key}`);
  }
  const latex = record.render_latex ?? record.original_latex;
  if (!latex) {
    if (unavailable) {
      return {
        state: 'registered-unavailable',
        reasonCode: unavailable.reasonCode,
        fallbackText: unavailable.fallbackText,
        accessibleName: unavailable.fallbackText,
      };
    }
    throw new Error(`unregistered governed math failure: empty-latex:${key}`);
  }
  const rendered = tryRenderGovernedKatex({
    latex,
    displayMode: record.display_mode === 'block',
    macroProfileId: GOVERNED_KATEX_MACRO_PROFILE_ID,
    macroProfileHash: GOVERNED_KATEX_MACRO_PROFILE_HASH,
    theme: 'dark',
  });
  if (!rendered.ok) {
    if (unavailable) {
      return {
        state: 'registered-unavailable',
        reasonCode: unavailable.reasonCode,
        fallbackText: unavailable.fallbackText,
        accessibleName: unavailable.fallbackText,
      };
    }
    throw new Error(`unregistered governed math failure: katex-strict-failed:${key}`);
  }
  return {
    state: 'available',
    display: record.display_mode,
    latex,
    macroProfileId: GOVERNED_KATEX_MACRO_PROFILE_ID,
    macroProfileHash: GOVERNED_KATEX_MACRO_PROFILE_HASH,
    accessibleLabel: stripLatexCommandNoise(record.original_latex) || record.original_latex,
    copyLatex: latex,
    renderKey: opaqueRenderKey([formulaId, record.render_hash, record.display_mode]),
  };
}


