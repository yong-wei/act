import type { AdmittedLocale } from '@/lib/authority-locale-readiness/contracts';
import type {
  AuthorityLearnerShard,
  AuthorityNodeDetailShard,
  AuthorityShardObject,
} from '@/lib/authority-domain-shards/contracts';

import {
  projectGovernedDescription,
  projectGovernedFormula,
  projectGovernedTitle,
} from './project';
import { titleIsProductHidden } from './types';
import {
  GOVERNED_MATH_PRESENTATION_BUNDLE,
  loadGovernedMathSidecarCorpus,
  type GovernedMathSidecarCorpus,
} from './sidecar';
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

export function loadGovernedMathRuntime(): GovernedMathSidecarCorpus | null {
  try {
    const cacheKey = `${GOVERNED_MATH_PRESENTATION_BUNDLE.releaseId}:${GOVERNED_MATH_PRESENTATION_BUNDLE.releaseHash}`;
    const cached = corpusCache.get(cacheKey);
    if (cached) return cached;
    const corpus = loadGovernedMathSidecarCorpus();
    if (
      corpus.readiness.release_id !== GOVERNED_MATH_PRESENTATION_BUNDLE.releaseId
      || corpus.readiness.release_hash !== GOVERNED_MATH_PRESENTATION_BUNDLE.releaseHash
    ) {
      return null;
    }
    corpusCache.set(cacheKey, corpus);
    return corpus;
  } catch {
    return null;
  }
}

function asLocale(locale: AdmittedLocale): GovernedMathLocale {
  return locale === 'en' ? 'en' : 'zh-CN';
}

function attachObject(
  object: AuthorityShardObject,
  locale: GovernedMathLocale,
  corpus: GovernedMathSidecarCorpus,
): AuthorityShardObject & GovernedMathRuntimeFields {
  try {
    const richTitle = projectGovernedTitle(corpus, object.id, locale, null);
    const richDescription = projectGovernedDescription(corpus, object.id, locale, null);
    if (titleIsProductHidden(richTitle)) {
      return {
        ...object,
        label: '名称暂不可用',
        richTitle,
        richDescription,
      };
    }
    const searchText = [
      richTitle.state === 'available' ? richTitle.searchText : object.label,
      richDescription.state === 'available' ? richDescription.searchText : object.description,
    ].filter((value): value is string => Boolean(value)).join(' ');
    const accessibleName = richTitle.state === 'available' ? richTitle.accessibleName : object.label;
    return {
      ...object,
      richTitle,
      richDescription,
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
  if (shard.shardClass === 'domain-default' || shard.shardClass === 'relation-family' || shard.shardClass === 'node-neighborhood') {
    const next = shard as Extract<T, { objects: readonly AuthorityShardObject[] }>;
    return {
      ...next,
      objects: next.objects.map((object) => attachObject(object, governedLocale, corpus)),
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
    }, governedLocale, corpus);
    let mathematics: GovernedFormulaProjection = { state: 'missing' };
    try {
      mathematics = projectGovernedFormula(corpus, detail.node.id, governedLocale, null);
    } catch {
      mathematics = { state: 'missing' };
    }
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
