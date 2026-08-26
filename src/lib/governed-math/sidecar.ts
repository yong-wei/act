import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { GOVERNED_MATH_LOCALES, type GovernedMathLocale } from './types';

export const R3_RICH_TEXT_RELEASE_RELATIVE =
  'course-content/authoring/knowledge/releases/control-theory-engineering-v0.37-r3' as const;

/** Presentation-bundle pin. Independent of the production Authority selector. */
export const GOVERNED_MATH_PRESENTATION_BUNDLE = {
  relativePath: R3_RICH_TEXT_RELEASE_RELATIVE,
  releaseId: 'ctr:release:control-theory-engineering-v0.37',
  releaseHash: 'cc73fa150a94fb0a3891c4b5d26eba9ca190f28334782a974333016f734fea39',
  fileHashes: {
    'rich-text-readiness-manifest.json': '41c9e44840a692b340a79d603980f8ff8d554a93c4f1e78558904ad6ea202f5c',
    'localized-rich-text-index.jsonl': '0b716fb2d07616d9f342ab8b00022c1c390b9485eb6545dc622346fcb8192d5c',
    'typed-math-fragment-index.jsonl': '746216f8b912ccf4056a5aa9015cc7375fe152a8e3cd63a2d6c5f8a87ee1035a',
    'formula-render-index.jsonl': 'c71573c2b78af5162b97afa30f39e293af3f0a3f9c59c20051dbc034125a7ef0',
    'localized-content-index.jsonl': 'c84fc834551e44101cc51cb009ff2d97577e1b2585f67c9ca3e126bd9d02ee77',
    'bundle-manifest.json': '694046f5f851f428dc639f11721c68bfe0f10e169fd7c512ad3493bf1c160bcd',
  },
} as const;

export const GOVERNED_MATH_SIDECAR_FILES = {
  readiness: 'rich-text-readiness-manifest.json',
  richText: 'localized-rich-text-index.jsonl',
  fragments: 'typed-math-fragment-index.jsonl',
  formulas: 'formula-render-index.jsonl',
  localizedContent: 'localized-content-index.jsonl',
  bundleManifest: 'bundle-manifest.json',
} as const;

export interface GovernedMathSourceRange {
  start: number;
  end: number;
}

export interface GovernedMathRef {
  id: string;
  kind: 'fragment' | 'formula';
}

export interface LocalizedRichTextSpan {
  id: string;
  kind: 'text' | 'math';
  source_range: GovernedMathSourceRange;
  text?: string;
  text_hash?: string;
  display_mode?: 'inline' | 'block';
  math_ref?: GovernedMathRef;
  math_slot_id?: string;
  source_text?: string;
  source_text_hash?: string;
}

export interface LocalizedRichTextBlock {
  id: string;
  kind: 'paragraph' | 'math_block' | 'math-block';
  source_range: GovernedMathSourceRange;
  spans: LocalizedRichTextSpan[];
}

export interface LocalizedRichTextDocument {
  id: string;
  contract: string;
  locale: GovernedMathLocale;
  target_id: string;
  field_path: string;
  content_hash: string;
  equivalence_group_id: string;
  math_slot_ids: string[];
  plain_text_fallback: string;
  source_text: string;
  review_status: string;
  blocks: LocalizedRichTextBlock[];
}

export interface TypedMathFragmentRecord {
  id: string;
  contract: string;
  display_mode: 'inline' | 'block';
  language_mode: string;
  macro_profile_id: string;
  macro_profile_hash: string;
  normalized_latex: string;
  render_latex: string;
  content_hash: string;
  source_text?: string;
  accessible_label_assertion_ids: Partial<Record<GovernedMathLocale, string>>;
  validation: Record<string, string>;
}

export interface FormulaRenderRecord {
  formula_id: string;
  contract: string;
  display_mode: 'inline' | 'block';
  render_engine: string;
  render_engine_contract: string;
  normalized_latex: string;
  original_latex: string;
  render_latex: string | null;
  original_hash: string;
  render_hash: string;
  validation: Record<string, string>;
}

export interface LocalizedContentRecord {
  id: string;
  locale: GovernedMathLocale;
  field_path: string;
  target_id: string;
  value: string;
}

export interface RichTextReadinessManifest {
  contract: string;
  release_id: string;
  release_hash: string;
  manifest_hash: string;
  capabilities: {
    math_ready: boolean;
    production_ready: boolean;
    rich_text_ready: boolean;
  };
  math_assets: {
    formula_count: number;
    fragment_count: number;
    unresolved_count: number;
    status: string;
  };
  locales: Record<string, { rich_text_document_count: number; inline_math_span_count: number }>;
}

export interface BundleManifestArtifact {
  path: string;
  sha256: string;
  record_count: number | null;
}

export interface BundleManifest {
  artifacts: BundleManifestArtifact[];
}

export interface GovernedMathSidecarCorpus {
  readonly bundleDir: string;
  readonly fileHashes: Readonly<Record<string, string>>;
  readonly readiness: RichTextReadinessManifest;
  readonly documents: readonly LocalizedRichTextDocument[];
  readonly fragments: ReadonlyMap<string, TypedMathFragmentRecord>;
  readonly formulas: ReadonlyMap<string, FormulaRenderRecord>;
  readonly localizedContent: ReadonlyMap<string, LocalizedContentRecord>;
}

function sha256Bytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseJsonl<T>(text: string, label: string): T[] {
  const rows: T[] = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line) as T);
    } catch {
      throw new Error(`${label} line ${index + 1} is not valid JSON`);
    }
  }
  return rows;
}

function isLocale(value: string): value is GovernedMathLocale {
  return (GOVERNED_MATH_LOCALES as readonly string[]).includes(value);
}

export function governedMathBundleDir(repoRoot = process.cwd()): string {
  return join(repoRoot, R3_RICH_TEXT_RELEASE_RELATIVE);
}

export function loadGovernedMathSidecarCorpus(
  bundleDir = governedMathBundleDir(),
): GovernedMathSidecarCorpus {
  const read = (name: string) => readFileSync(join(bundleDir, name));
  const fileHashes: Record<string, string> = {};
  for (const name of Object.values(GOVERNED_MATH_SIDECAR_FILES)) {
    fileHashes[name] = sha256Bytes(read(name));
  }
  const readiness = JSON.parse(read(GOVERNED_MATH_SIDECAR_FILES.readiness).toString('utf8')) as RichTextReadinessManifest;
  const documents = parseJsonl<LocalizedRichTextDocument>(
    read(GOVERNED_MATH_SIDECAR_FILES.richText).toString('utf8'),
    GOVERNED_MATH_SIDECAR_FILES.richText,
  ).filter((row) => isLocale(row.locale));
  const fragments = new Map<string, TypedMathFragmentRecord>();
  for (const row of parseJsonl<TypedMathFragmentRecord>(
    read(GOVERNED_MATH_SIDECAR_FILES.fragments).toString('utf8'),
    GOVERNED_MATH_SIDECAR_FILES.fragments,
  )) {
    const existing = fragments.get(row.id);
    if (existing) {
      const samePresentation = (
        existing.render_latex === row.render_latex
        && existing.display_mode === row.display_mode
        && existing.macro_profile_id === row.macro_profile_id
        && existing.macro_profile_hash === row.macro_profile_hash
      );
      if (!samePresentation) {
        throw new Error(`duplicate fragment ${row.id} changed presentation fields`);
      }
      continue;
    }
    fragments.set(row.id, row);
  }
  const formulas = new Map(
    parseJsonl<FormulaRenderRecord>(
      read(GOVERNED_MATH_SIDECAR_FILES.formulas).toString('utf8'),
      GOVERNED_MATH_SIDECAR_FILES.formulas,
    ).map((row) => [row.formula_id, row]),
  );
  const localizedContent = new Map(
    parseJsonl<LocalizedContentRecord>(
      read(GOVERNED_MATH_SIDECAR_FILES.localizedContent).toString('utf8'),
      GOVERNED_MATH_SIDECAR_FILES.localizedContent,
    ).filter((row) => isLocale(row.locale)).map((row) => [row.id, row]),
  );
  return {
    bundleDir,
    fileHashes,
    readiness,
    documents,
    fragments,
    formulas,
    localizedContent,
  };
}

export function expectedSidecarHashesFromBundleManifest(bundleDir: string): {
  hashes: Record<string, string>;
  duplicatePaths: string[];
} {
  const manifest = JSON.parse(
    readFileSync(join(bundleDir, GOVERNED_MATH_SIDECAR_FILES.bundleManifest), 'utf8'),
  ) as BundleManifest;
  const hashes: Record<string, string> = {};
  const duplicatePaths: string[] = [];
  for (const artifact of manifest.artifacts) {
    if (Object.prototype.hasOwnProperty.call(hashes, artifact.path)) {
      duplicatePaths.push(artifact.path);
    }
    hashes[artifact.path] = artifact.sha256;
  }
  return { hashes, duplicatePaths };
}
