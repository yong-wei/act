/**
 * Handout-derived hotword extractor (#1515, tasks 4.4–4.5).
 *
 * A deterministic versioned extractor parses the exact frozen handout or
 * lecture Markdown from which an ASR media item was produced: it normalizes
 * Chinese and Latin terminology, deduplicates entries, and assigns bounded
 * weights. It may use the captured terminology registry to recognize safe
 * pronunciation aliases, but it can never introduce a term absent from the
 * bound handout truth. The manifest is immutable and its hash covers every
 * input dependency; any drift invalidates the transcript and everything
 * derived from it.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  FormalResourceRemediationError,
  HOTWORD_MANIFEST_CONTRACT,
  type HotwordManifest,
} from '../contracts';
import { segmentMarkdown } from './markdown';

export const HOTWORD_EXTRACTOR_VERSION = 'handout-hotword-extractor/v1' as const;
export const MAX_HOTWORD_ENTRIES = 96;
export const MAX_HOTWORD_WEIGHT = 5;

export interface HotwordExtractorConfig {
  /** Minimum occurrences in the source for a candidate to be admitted. */
  readonly minOccurrences: number;
  /** Bounded weight ladder: occurrence count maps onto 1..MAX_HOTWORD_WEIGHT. */
  readonly weightCeiling: number;
  /** Terms excluded by policy, with the reason recorded. */
  readonly exclusions: readonly { readonly term: string; readonly reason: string }[];
  /** Governed terminology aliases captured from the registry. */
  readonly terminologyAliases: Readonly<Record<string, string>>;
  /**
   * Governed registry terms eligible for Chinese hotword admission. Chinese
   * has no tokenizer here, so Chinese terms enter only through this
   * registry-and-source match; Latin tokens are still pattern-extracted.
   */
  readonly terminologyTerms: readonly string[];
}

export const DEFAULT_HOTWORD_CONFIG: HotwordExtractorConfig = {
  minOccurrences: 1,
  weightCeiling: MAX_HOTWORD_WEIGHT,
  exclusions: [],
  terminologyAliases: {},
  terminologyTerms: [],
};

// Latin identifier tokens can be pattern-extracted safely; Chinese terms
// have no tokenizer here and enter only through the governed registry.
const LATIN_TERM_TOKEN = /[A-Za-z][A-Za-z0-9\-]{1,31}/gu;

// LaTeX commands, media/format artifacts, and generic file vocabulary that
// appear in authoring Markdown but are never spoken terminology.
const LATEX_AND_ARTIFACT_DENYLIST = new Set([
  'frac', 'dfrac', 'tfrac', 'cdot', 'cdots', 'ldots', 'vdots', 'ddots', 'quad',
  'qquad', 'left', 'right', 'begin', 'end', 'array', 'matrix', 'pmatrix',
  'bmatrix', 'cases', 'aligned', 'align', 'text', 'mathrm', 'mathbf', 'sum',
  'int', 'oint', 'prod', 'lim', 'infty', 'partial', 'nabla', 'sqrt', 'overline',
  'underline', 'hat', 'bar', 'vec', 'dot', 'ddot', 'times', 'div', 'pm', 'mp',
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'theta', 'lambda',
  'mu', 'rho', 'sigma', 'tau', 'phi', 'varphi', 'omega', 'Omega', 'zeta', 'eta',
  'xi', 'pi', 'Pi', 'Sigma', 'Phi', 'Delta', 'Gamma', 'Theta', 'Lambda',
  'png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'pdf', 'mp4', 'm4a', 'mp3',
  'media', 'processed', 'raw', 'design', 'assets', 'images', 'img', 'http',
  'https', 'www', 'com', 'html', 'css', 'json', 'yaml', 'md', 'tex',
  'width', 'height', 'px', 'em', 'rem', 'src', 'alt', 'href', 'ref', 'label',
  'eqref', 'cite', 'footnote', 'item', 'subitem', 'caption', 'figure', 'table',
  'unit', 'lesson', 'lessons', 'authoring', 'runtime', 'course', 'content',
]);
const GENERIC_STOPWORDS = new Set([
  '我们', '你们', '他们', '这个', '那个', '什么', '怎样', '如何', '可以', '需要',
  '一个', '每个', '其中', '以及', '但是', '因此', '所以', '如果', '这些', '那些',
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'are', 'was', 'into',
]);

/**
 * Extract one immutable hotword manifest from the bound handout truth.
 * Every term originates in the source paragraphs; safe pronunciation
 * aliases come only from the governed registry mapping.
 */
export function extractHotwordManifest(input: {
  allocationHash: string;
  resourceId: string;
  sourceResourceId: string;
  sourceMarkdown: string;
  sourceContentSha256: string;
  locale: string;
  terminologyRegistryId: string;
  config?: HotwordExtractorConfig;
}): HotwordManifest {
  const config = input.config ?? DEFAULT_HOTWORD_CONFIG;
  if (config.weightCeiling < 1 || config.weightCeiling > MAX_HOTWORD_WEIGHT) {
    throw new FormalResourceRemediationError(
      'hotword-config-invalid',
      `Hotword weight ceiling must stay within 1..${MAX_HOTWORD_WEIGHT}.`,
    );
  }
  const { segmentation } = segmentMarkdown(input.sourceMarkdown, { resourceId: input.sourceResourceId });
  const sourceParagraphIds = segmentation.sections.flatMap((section) =>
    section.paragraphs.map((paragraph) => paragraph.paragraphId),
  );
  if (sourceParagraphIds.length === 0) {
    throw new FormalResourceRemediationError(
      'hotword-source-empty',
      `Resource ${input.resourceId} binds a handout source with zero semantic paragraphs.`,
    );
  }
  const occurrences = new Map<string, number>();
  const fullProse: string[] = [];
  for (const section of segmentation.sections) {
    for (const paragraph of section.paragraphs) {
      // Strip formulas, LaTeX commands, media/link paths, and emphasis so
      // tokens reflect spoken prose only.
      const prose = paragraph.text
        .replace(/\$\$[^$]*\$\$|\$[^$]*\$/gu, ' ')
        .replace(/\\\[[\s\S]*?\\\]|\\\(([\s\S]*?)\\\)/gu, ' ')
        .replace(/\\[a-zA-Z]+/gu, ' ')
        .replace(/\((?:\.\.?\/|\/)?[^)\s]*\)/gu, ' ')
        .replace(/[*`_#\[\]]/gu, ' ');
      fullProse.push(prose);
      for (const match of prose.matchAll(LATIN_TERM_TOKEN)) {
        const term = normalizeTerm(match[0]);
        if (term.length < 2) continue;
        if (GENERIC_STOPWORDS.has(term.toLowerCase())) continue;
        if (LATEX_AND_ARTIFACT_DENYLIST.has(term)) continue;
        if (/^-?\d+$|^m-\d+$|^\d+x\d+$|^x\d+$|^k[0-9]*$|^s[0-9]*$|^t[0-9]*$|^j\w{0,2}$/u.test(term)) continue;
        if (/^\d/.test(term)) continue;
        occurrences.set(term, (occurrences.get(term) ?? 0) + 1);
      }
    }
  }
  const joinedProse = fullProse.join('\n');
  // Governed Chinese terminology enters only through the registry: a term
  // is admitted when the bound source actually contains it.
  for (const term of config.terminologyTerms) {
    if (!term || occurrences.has(term)) continue;
    let count = 0;
    let searchFrom = 0;
    for (;;) {
      const found = joinedProse.indexOf(term, searchFrom);
      if (found === -1) break;
      count += 1;
      searchFrom = found + term.length;
    }
    if (count > 0) occurrences.set(term, count);
  }
  const exclusionSet = new Map(input.config?.exclusions.map((entry) => [entry.term, entry.reason])
    ?? config.exclusions.map((entry) => [entry.term, entry.reason]));
  const candidates = [...occurrences.entries()]
    .filter(([term, count]) => count >= config.minOccurrences && !exclusionSet.has(term))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_HOTWORD_ENTRIES);
  const maxCount = candidates[0]?.[1] ?? 1;
  const entries = candidates.map(([term, count]) => {
    const alias = config.terminologyAliases[term];
    return {
      term,
      weight: Math.max(1, Math.round((count / maxCount) * config.weightCeiling)),
      ...(alias ? { pronunciationAlias: alias } : {}),
    };
  });
  const exclusions = [...occurrences.keys()]
    .filter((term) => exclusionSet.has(term))
    .sort()
    .map((term) => ({ term, reason: exclusionSet.get(term) as string }));
  const requestRepresentation = JSON.stringify(
    entries.map((entry) => ({ w: entry.term, v: entry.weight })),
    null,
    0,
  );
  const manifestHash = projectionDigest({
    allocationHash: input.allocationHash,
    resourceId: input.resourceId,
    sourceResourceId: input.sourceResourceId,
    sourceContentSha256: input.sourceContentSha256,
    locale: input.locale,
    extractorVersion: HOTWORD_EXTRACTOR_VERSION,
    extractorConfigDigest: hotwordConfigDigest(config),
    terminologyRegistryId: input.terminologyRegistryId,
    entries,
    exclusions,
  });
  return {
    contract: HOTWORD_MANIFEST_CONTRACT,
    manifestId: `hw-${manifestHash.slice(0, 24)}`,
    allocationHash: input.allocationHash,
    resourceId: input.resourceId,
    sourceResourceId: input.sourceResourceId,
    sourceParagraphIds,
    sourceContentSha256: input.sourceContentSha256,
    locale: input.locale,
    extractorVersion: HOTWORD_EXTRACTOR_VERSION,
    extractorConfigDigest: hotwordConfigDigest(config),
    terminologyRegistryId: input.terminologyRegistryId,
    entries,
    exclusions,
    requestRepresentation,
    manifestHash,
  };
}

/** The configuration digest is part of the manifest's invalidation identity. */
export function hotwordConfigDigest(config: HotwordExtractorConfig): string {
  return projectionDigest({
    minOccurrences: config.minOccurrences,
    weightCeiling: config.weightCeiling,
    exclusions: [...config.exclusions].sort((a, b) => a.term.localeCompare(b.term)),
    terminologyAliases: config.terminologyAliases,
    terminologyTerms: [...config.terminologyTerms].sort(),
  });
}

/**
 * An ASR-targeted media resource without an exact handout source binding
 * fails formal admission instead of receiving a generic course-wide list.
 */
export function assertHotwordSourceBinding(input: {
  resourceId: string;
  sourceResourceId: string | null;
}): void {
  if (!input.sourceResourceId) {
    throw new FormalResourceRemediationError(
      'missing-source',
      `ASR media ${input.resourceId} has no exact handout/lecture source binding; a generic course hotlist is not admissible.`,
    );
  }
}

function normalizeTerm(term: string): string {
  // Full-width Latin letters and digits normalize to their ASCII forms so
  // the same spoken term cannot enter the manifest twice.
  return term
    .replace(/[\uff01-\uff5e]/gu, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\s+/gu, '')
    .toLowerCase();
}

/** Generic non-terminology words that harm decoding when used as hotwords. */
const GENERIC_TERM_DENYLIST = new Set([
  '引入', '讲义', '对象系统', '通用', '结合起来', '更重要的是',
  '我们可以看到', '换句话说', '正式展开', '控制系统的',
]);

/**
 * Select the terminology hotwords admitted to the ASR request (calibration
 * finding #1515-4.7): only multi-character Chinese professional terms, at
 * most `limit` of them, with generic words and substring-duplicates of
 * other selected terms excluded ("递函数" ⊂ "传递函数" collapsed 2-1).
 */
export function selectTerminologyHotwords(
  manifest: HotwordManifest,
  limit = 20,
): readonly string[] {
  const candidates = manifest.entries
    .map((entry) => entry.term)
    .filter((term) => term.length >= 3
      && !GENERIC_TERM_DENYLIST.has(term)
      && !/[A-Za-z0-9]/u.test(term));
  // Longest-first greedy selection: a truncated substring ("递函数" of
  // "传递函数") can never eliminate its full term.
  candidates.sort((a, b) => b.length - a.length || a.localeCompare(b));
  const selected: string[] = [];
  for (const term of candidates) {
    // Substring dedup only removes short truncation noise ("递函数"):
    // a 4+ character term ("传递函数") stays even when a longer selected
    // term ("闭环传递函数") contains it — both are independent terms.
    if (term.length < 4 && selected.some((existing) => existing.includes(term))) continue;
    selected.push(term);
    if (selected.length >= limit) break;
  }
  return selected;
}
