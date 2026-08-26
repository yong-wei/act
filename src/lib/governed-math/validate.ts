import {
  admittedMacroProfile,
  isAdmittedRenderEngineContract,
  latexContainsUnsafeCommands,
} from './katex-config';
import { tryRenderGovernedKatex } from './render-cache';
import {
  expectedSidecarHashesFromBundleManifest,
  GOVERNED_MATH_PRESENTATION_BUNDLE,
  GOVERNED_MATH_SIDECAR_FILES,
  type GovernedMathSidecarCorpus,
} from './sidecar';
import {
  GOVERNED_KATEX_MACRO_PROFILE_HASH,
  GOVERNED_KATEX_MACRO_PROFILE_ID,
  GOVERNED_MATH_LOCALES,
} from './types';

export interface GovernedMathValidationIssue {
  readonly code: string;
  readonly message: string;
}

export interface GovernedMathValidationResult {
  readonly ok: boolean;
  readonly issues: readonly GovernedMathValidationIssue[];
  readonly counts: {
    readonly documents: number;
    readonly mathSpans: number;
    readonly fragments: number;
    readonly formulas: number;
    readonly locales: readonly string[];
  };
}

function issue(code: string, message: string): GovernedMathValidationIssue {
  return { code, message };
}

export function validateGovernedMathCorpus(
  corpus: GovernedMathSidecarCorpus,
): GovernedMathValidationResult {
  const issues: GovernedMathValidationIssue[] = [];
  const manifestIndex = expectedSidecarHashesFromBundleManifest(corpus.bundleDir);
  for (const path of manifestIndex.duplicatePaths) {
    issues.push(issue('duplicate-manifest-entry', `${path} is duplicated in the bundle manifest`));
  }
  for (const path of Object.values(GOVERNED_MATH_SIDECAR_FILES)) {
    const pinned = GOVERNED_MATH_PRESENTATION_BUNDLE.fileHashes[
      path as keyof typeof GOVERNED_MATH_PRESENTATION_BUNDLE.fileHashes
    ];
    const actual = corpus.fileHashes[path];
    if (!actual) {
      issues.push(issue('missing-sidecar', `${path} is missing from the loaded presentation bundle`));
      continue;
    }
    if (actual !== pinned) {
      issues.push(issue('hash-drift', `${path} sha256 drifted from the presentation-bundle pin`));
    }
    if (path !== GOVERNED_MATH_SIDECAR_FILES.bundleManifest && !manifestIndex.hashes[path]) {
      issues.push(issue('missing-manifest-entry', `${path} is missing from bundle-manifest.json`));
    } else if (manifestIndex.hashes[path] && manifestIndex.hashes[path] !== actual) {
      issues.push(issue('hash-drift', `${path} sha256 drifted from the bundle manifest`));
    }
  }
  if (corpus.readiness.contract !== 'ctkg-rich-text-readiness/1') {
    issues.push(issue('contract', 'rich-text readiness contract is not admitted'));
  }
  if (!corpus.readiness.release_id || !corpus.readiness.release_hash) {
    issues.push(issue('release-identity', 'readiness is missing release identity'));
  }

  const documentIds = new Set<string>();
  let mathSpans = 0;
  for (const document of corpus.documents) {
    if (documentIds.has(document.id)) {
      issues.push(issue('duplicate-identity', `duplicate rich-text document ${document.id}`));
    }
    documentIds.add(document.id);
    if (document.contract !== 'ctkg-localized-rich-text/1') {
      issues.push(issue('contract', `document ${document.id} uses an unknown contract`));
    }
    const slotIds: string[] = [];
    for (const block of document.blocks) {
      for (const span of block.spans) {
        if (span.kind !== 'math') continue;
        mathSpans += 1;
        if (span.math_slot_id && !slotIds.includes(span.math_slot_id)) slotIds.push(span.math_slot_id);
        const ref = span.math_ref;
        if (!ref) {
          issues.push(issue('missing-fragment', `document ${document.id} has a math span without a reference`));
          continue;
        }
        if (ref.kind === 'fragment' && !corpus.fragments.has(ref.id)) {
          issues.push(issue('missing-fragment', `document ${document.id} references missing fragment ${ref.id}`));
        }
        if (ref.kind === 'formula' && !corpus.formulas.has(ref.id)) {
          issues.push(issue('missing-fragment', `document ${document.id} references missing formula ${ref.id}`));
        }
        if (ref.kind !== 'fragment' && ref.kind !== 'formula') {
          issues.push(issue('unknown-math-kind', `document ${document.id} uses unknown math ref kind`));
        }
      }
    }
    if (JSON.stringify(slotIds) !== JSON.stringify(document.math_slot_ids)) {
      issues.push(issue('slot-order', `document ${document.id} math slot order drifted`));
    }
  }

  const fragmentIds = new Set<string>();
  for (const fragment of corpus.fragments.values()) {
    if (fragmentIds.has(fragment.id)) {
      issues.push(issue('duplicate-identity', `duplicate fragment ${fragment.id}`));
    }
    fragmentIds.add(fragment.id);
    if (!admittedMacroProfile(fragment.macro_profile_id, fragment.macro_profile_hash)) {
      issues.push(issue('undeclared-macro-profile', `fragment ${fragment.id} macro profile is not admitted`));
    }
    if (latexContainsUnsafeCommands(fragment.render_latex)) {
      issues.push(issue('unsafe-render-option', `fragment ${fragment.id} contains a disallowed command`));
    }
  }

  const formulaIds = new Set<string>();
  for (const formula of corpus.formulas.values()) {
    if (formulaIds.has(formula.formula_id)) {
      issues.push(issue('duplicate-identity', `duplicate formula ${formula.formula_id}`));
    }
    formulaIds.add(formula.formula_id);
    if (!isAdmittedRenderEngineContract(formula.render_engine_contract)) {
      issues.push(issue('unsafe-render-option', `formula ${formula.formula_id} uses an unadmitted engine contract`));
    }
    const formulaLatex = formula.render_latex ?? formula.original_latex ?? '';
    if (latexContainsUnsafeCommands(formulaLatex)) {
      issues.push(issue('unsafe-render-option', `formula ${formula.formula_id} contains a disallowed command`));
    }
  }

  const groups = new Map<string, Set<string>>();
  for (const document of corpus.documents) {
    const locales = groups.get(document.equivalence_group_id) ?? new Set<string>();
    locales.add(document.locale);
    groups.set(document.equivalence_group_id, locales);
  }
  for (const [groupId, locales] of groups) {
    for (const locale of GOVERNED_MATH_LOCALES) {
      if (!locales.has(locale)) {
        issues.push(issue('locale-parity', `equivalence group ${groupId} is missing ${locale}`));
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    counts: {
      documents: corpus.documents.length,
      mathSpans,
      fragments: corpus.fragments.size,
      formulas: corpus.formulas.size,
      locales: [...GOVERNED_MATH_LOCALES],
    },
  };
}

export function sampleKatexStrictPass(corpus: GovernedMathSidecarCorpus, limit = 32): GovernedMathValidationIssue[] {
  const issues: GovernedMathValidationIssue[] = [];
  let checked = 0;
  for (const fragment of corpus.fragments.values()) {
    if (checked >= limit) break;
    checked += 1;
    const rendered = tryRenderGovernedKatex({
      latex: fragment.render_latex,
      displayMode: fragment.display_mode === 'block',
      macroProfileId: fragment.macro_profile_id,
      macroProfileHash: fragment.macro_profile_hash,
      theme: 'dark',
    });
    if (!rendered.ok) {
      issues.push(issue('katex-strict-failed', `fragment ${fragment.id}: ${rendered.error}`));
    }
  }
  checked = 0;
  for (const formula of corpus.formulas.values()) {
    if (checked >= limit) break;
    checked += 1;
    const latex = formula.render_latex ?? formula.original_latex;
    if (!latex) {
      issues.push(issue('katex-strict-failed', `formula ${formula.formula_id}: empty latex`));
      continue;
    }
    const rendered = tryRenderGovernedKatex({
      latex,
      displayMode: formula.display_mode === 'block',
      macroProfileId: GOVERNED_KATEX_MACRO_PROFILE_ID,
      macroProfileHash: GOVERNED_KATEX_MACRO_PROFILE_HASH,
      theme: 'dark',
    });
    if (!rendered.ok) {
      issues.push(issue('katex-strict-failed', `formula ${formula.formula_id}: ${rendered.error}`));
    }
  }
  return issues;
}
