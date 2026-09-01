import type { AdmittedLocale } from '@/lib/authority-locale-readiness/contracts';
import type {
  AuthorityDomainSearchHit,
  AuthorityLearnerShard,
  AuthorityNodeDetailShard,
  AuthorityShardObject,
} from '@/lib/authority-domain-shards/contracts';

import {
  projectGovernedDescription,
  projectGovernedFormula,
  projectGovernedTitle,
} from './project';
import { stripLatexCommandNoise } from './search-text';
import { titleIsProductHidden } from './types';
import {
  GOVERNED_MATH_PRESENTATION_BUNDLE,
  loadGovernedMathSidecarCorpus,
  type GovernedMathSidecarCorpus,
} from './sidecar';
import { validateGovernedMathCorpus } from './validate';
import type {
  GovernedFormulaProjection,
  GovernedMathLocale,
  GovernedRichTextProjection,
} from './types';

export interface GovernedMathRuntimeFields {
  richTitle?: GovernedRichTextProjection;
  richDescription?: GovernedRichTextProjection;
  searchText?: string;
  accessibleName?: string;
  mathematics?: GovernedFormulaProjection;
}

const corpusCache = new Map<string, GovernedMathSidecarCorpus>();

export function admitGovernedMathCorpus(
  corpus: GovernedMathSidecarCorpus,
): GovernedMathSidecarCorpus | null {
  if (
    corpus.readiness.release_id !== GOVERNED_MATH_PRESENTATION_BUNDLE.releaseId
    || corpus.readiness.release_hash !== GOVERNED_MATH_PRESENTATION_BUNDLE.releaseHash
  ) {
    return null;
  }
  const validation = validateGovernedMathCorpus(corpus);
  if (!validation.ok) return null;
  return corpus;
}

export function loadGovernedMathRuntime(): GovernedMathSidecarCorpus | null {
  try {
    const cacheKey = `${GOVERNED_MATH_PRESENTATION_BUNDLE.releaseId}:${GOVERNED_MATH_PRESENTATION_BUNDLE.releaseHash}`;
    const cached = corpusCache.get(cacheKey);
    if (cached) return cached;
    const admitted = admitGovernedMathCorpus(loadGovernedMathSidecarCorpus());
    if (!admitted) return null;
    corpusCache.set(cacheKey, admitted);
    return admitted;
  } catch {
    return null;
  }
}

function asLocale(locale: AdmittedLocale): GovernedMathLocale {
  return locale === 'en' ? 'en' : 'zh-CN';
}

/**
 * Bounded governed formula projection for canvas surfaces (#1740). The
 * disposition ledger stays offline at runtime: a record without a renderable
 * expression degrades to `missing` so the prose label keeps rendering as the
 * object name — never as a substitute formula presentation.
 */
function projectFormulaPresentation(
  corpus: GovernedMathSidecarCorpus,
  formulaId: string,
  locale: GovernedMathLocale,
): GovernedFormulaProjection {
  try {
    return projectGovernedFormula(corpus, formulaId, locale, null);
  } catch {
    return { state: 'missing' };
  }
}

function attachObject(
  object: AuthorityShardObject,
  locale: GovernedMathLocale,
  corpus: GovernedMathSidecarCorpus,
  formulaReleaseMatches: boolean,
): AuthorityShardObject & GovernedMathRuntimeFields {
  try {
    const richTitle = projectGovernedTitle(corpus, object.id, locale, null);
    const richDescription = projectGovernedDescription(corpus, object.id, locale, null);
    // 只为有界 Formula 对象携带投影；missing 不上线（无记录即无字段，
    // 客户端按 missing 处理），#1740。
    const mathematics = object.canonicalType === 'Formula' && formulaReleaseMatches
      ? projectFormulaPresentation(corpus, object.id, locale)
      : null;
    if (titleIsProductHidden(richTitle)) {
      return {
        ...object,
        label: '名称暂不可用',
        richTitle,
        richDescription,
      };
    }
    const governedMathematics = mathematics && mathematics.state !== 'missing' ? mathematics : null;
    const formulaAccessibleLabel = governedMathematics?.state === 'available'
      ? governedMathematics.accessibleLabel
      : null;
    const searchText = [
      richTitle.state === 'available' ? richTitle.searchText : object.label,
      richDescription.state === 'available' ? richDescription.searchText : object.description,
      formulaAccessibleLabel,
    ].filter((value): value is string => Boolean(value)).join(' ');
    const accessibleName = formulaAccessibleLabel
      ?? (richTitle.state === 'available' ? richTitle.accessibleName : object.label);
    return {
      ...object,
      richTitle,
      richDescription,
      ...(governedMathematics ? { mathematics: governedMathematics } : {}),
      searchText,
      accessibleName,
    };
  } catch {
    return object;
  }
}

export function attachGovernedMathToLearnerShard<T extends AuthorityLearnerShard>(
  shard: T,
  locale: AdmittedLocale,
): T {
  const corpus = loadGovernedMathRuntime();
  if (!corpus) return shard;
  const governedLocale = asLocale(locale);
  // 公式投影与分片 Authority 严格同版：跨 release 不投影、不回退、不修复
  // （#1740 spec：Formula projection drifts → fail closed）。
  const formulaReleaseMatches = shard.envelope.authority.releaseId === corpus.readiness.release_id;
  if (shard.shardClass === 'domain-default' || shard.shardClass === 'relation-family' || shard.shardClass === 'node-neighborhood') {
    const next = shard as Extract<T, { objects: readonly AuthorityShardObject[] }>;
    return {
      ...next,
      objects: next.objects.map((object) => attachObject(object, governedLocale, corpus, formulaReleaseMatches)),
    } as T;
  }
  if (shard.shardClass === 'node-detail') {
    const detail = shard as AuthorityNodeDetailShard;
    const attached = attachObject({
      id: detail.node.id,
      canonicalType: detail.node.canonicalType,
      label: detail.node.label,
      aliases: detail.node.aliases ?? [],
      description: detail.node.description,
      governance: detail.node.governance,
      semanticSupport: detail.node.semanticSupport,
      memberships: [],
      typeLabel: detail.node.typeLabel ?? null,
    }, governedLocale, corpus, formulaReleaseMatches);
    const mathematics = detail.node.canonicalType === 'Formula' && formulaReleaseMatches
      ? projectFormulaPresentation(corpus, detail.node.id, governedLocale)
      : { state: 'missing' } as const;
    return {
      ...detail,
      node: {
        ...detail.node,
        richTitle: attached.richTitle,
        richDescription: attached.richDescription,
        searchText: attached.searchText,
        accessibleName: attached.accessibleName,
        mathematics,
      },
    } as T;
  }
  return shard;
}

/**
 * Attach the bounded governed formula projection to bounded domain-search
 * hits that are Formula objects of the same Authority release (#1740).
 * Only hits present in the response receive projections — never a global
 * formula index.
 */
export function attachGovernedMathToSearchHits<T extends AuthorityDomainSearchHit>(
  hits: readonly T[],
  locale: AdmittedLocale,
  shardReleaseId: string,
): T[] {
  const corpus = loadGovernedMathRuntime();
  if (!corpus || corpus.readiness.release_id !== shardReleaseId) return [...hits];
  const governedLocale = asLocale(locale);
  return hits.map((hit) => {
    if (hit.canonicalType !== 'Formula') return hit;
    const mathematics = projectFormulaPresentation(corpus, hit.id, governedLocale);
    return mathematics.state === 'missing' ? hit : { ...hit, mathematics };
  });
}

/**
 * Locale-bound governed search terms for Formula entries (#1740): the
 * accessible label derived from the selected render latex, command noise
 * stripped. String-only — no KaTeX execution — and used for matching, never
 * displayed. Raw index labels stay untouched.
 */
export function governedFormulaSearchTerms(
  formulaIds: readonly string[],
  locale: AdmittedLocale,
  shardReleaseId: string,
): Map<string, string> {
  const terms = new Map<string, string>();
  const corpus = loadGovernedMathRuntime();
  if (!corpus || corpus.readiness.release_id !== shardReleaseId) return terms;
  const governedLocale = asLocale(locale);
  for (const formulaId of formulaIds) {
    const record = corpus.formulas.get(formulaId);
    if (!record) continue;
    const localeLatex = record.render_latex_by_locale?.[governedLocale];
    const latex = (typeof localeLatex === 'string' && localeLatex.length > 0
      ? localeLatex
      : record.render_latex) ?? record.original_latex;
    if (!latex) continue;
    const label = stripLatexCommandNoise(latex) || latex;
    if (label) terms.set(formulaId, label);
  }
  return terms;
}
