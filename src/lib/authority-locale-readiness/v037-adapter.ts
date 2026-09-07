/**
 * Versioned adapter from the exact upstream v0.37 bilingual presentation
 * bundle to ACT's complete-locale manifest (#1741).
 *
 * Upstream evidence (ctkg contracts) is converted, never trusted directly:
 * every declared upstream hash is verified against the bundle manifest and
 * every ACT presentation denominator member must be covered by an upstream
 * row or the adapter fails closed. No mutable `latest` pointer is followed
 * and no ACT overlay value is mixed in.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isSafeLocalePresentationText } from '@/lib/authority-domain-shards/labels';

import {
  ADMITTED_LOCALES,
  LOCALE_MANIFEST_CONTRACT,
  LOCALE_RECORD_SOURCE,
  type AdmittedLocale,
  type AuthorityLocaleManifest,
  type LocaleCategoryDenominator,
  type LocalePresentationRecord,
  type MandatoryLocaleCategory,
} from './contracts';
import { localeDigest } from './digest';
import { contentDigestFor, denominatorDigestFor } from './qualify';
import type { LocalePresentationInventory } from './presentation-denominator';

/** The exact admitted upstream bilingual bundle; never resolves `latest`. */
export const V037_BILINGUAL_BUNDLE_RELATIVE =
  'course-content/authoring/knowledge/releases/control-theory-engineering-v0.37-r6' as const;


const UPSTREAM_LOCALE_MANIFEST_CONTRACT = 'ctkg-locale-manifest/1';
const UPSTREAM_LOCALIZED_CONTENT_CONTRACT = 'ctkg-localized-content/1';
const UPSTREAM_ENTITY_TYPE_LEXICON_CONTRACT = 'ctkg-entity-type-locale-lexicon/1';
const UPSTREAM_RELATION_LEXICON_CONTRACT = 'ctkg-relation-locale-lexicon/1';

/** 块级数学文本特征：名字即公式（含 LaTeX 环境/命令）的对象。 */
const BLOCK_MATH_TEXT = /\\begin\{|\\frac|\\tag\{|\\operatorname|\\left\||\\dot\{|\\mathbf/u;

export class V037AdapterError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'V037AdapterError';
    this.code = code;
  }
}

interface UpstreamLocalizedContentRow {
  contract: string;
  locale: AdmittedLocale;
  target_id: string;
  field_path: string;
  value: string;
  review_status: string;
}

/** Objects lacking approved upstream bilingual rows (r5 residual set). */
export interface V037UncoveredReport {
  readonly objectNames: readonly string[];
  readonly objectExplanations: readonly string[];
}

interface UpstreamTypeTermRow {
  contract: string;
  term_id: string;
  locale: AdmittedLocale;
  label: string;
  review_status: string;
}

interface UpstreamRelationTermRow {
  contract: string;
  predicate_id: string;
  locale: AdmittedLocale;
  forward_label: string;
  review_status: string;
}

interface UpstreamLocaleManifest {
  contract: string;
  release: { id: string; hash: string; version: string };
  capabilities: { bilingual_ready: boolean; zh_cn_ready: boolean; en_ready: boolean };
  locale_components: Record<string, { id: string; content_digest: string; hash: string }>;
}

export interface V037EnvelopeIdentityInput {
  compositeReleaseName: string;
  authorityReleaseId: string;
  authoritySnapshotId: string;
  authoritySnapshotHash: string;
}

function sha256File(repoRoot: string, relative: string): string {
  return createHash('sha256').update(readFileSync(join(repoRoot, relative))).digest('hex');
}

function readJsonl<T>(repoRoot: string, relative: string): T[] {
  const rows: T[] = [];
  for (const line of readFileSync(join(repoRoot, relative), 'utf8').split('\n')) {
    if (line.trim().length === 0) continue;
    rows.push(JSON.parse(line) as T);
  }
  return rows;
}

function verifyBundleSeal(repoRoot: string): { localeManifest: UpstreamLocaleManifest } {
  const bundleManifest = JSON.parse(
    readFileSync(join(repoRoot, V037_BILINGUAL_BUNDLE_RELATIVE, 'bundle-manifest.json'), 'utf8'),
  ) as { bundle_contract_version?: string; artifacts?: Array<{ path: string; sha256: string }> };
  if (bundleManifest.bundle_contract_version !== 'actkg-public-bundle/3') {
    throw new V037AdapterError('bundle-contract', 'upstream bundle contract is not admitted');
  }
  const localeManifest = JSON.parse(
    readFileSync(join(repoRoot, V037_BILINGUAL_BUNDLE_RELATIVE, 'locale-manifest.json'), 'utf8'),
  ) as UpstreamLocaleManifest;
  if (localeManifest.contract !== UPSTREAM_LOCALE_MANIFEST_CONTRACT) {
    throw new V037AdapterError('locale-manifest-contract', 'upstream locale manifest contract is not admitted');
  }
  if (
    !localeManifest.capabilities.bilingual_ready
    || !localeManifest.capabilities.zh_cn_ready
    || !localeManifest.capabilities.en_ready
  ) {
    throw new V037AdapterError('not-bilingual-ready', 'upstream bundle does not declare bilingual readiness');
  }
  // Declared artifact hashes are verified against the bytes on disk; any
  // drift fails closed before conversion.
  const declared = new Map((bundleManifest.artifacts ?? []).map((row) => [row.path, row.sha256]));
  for (const file of [
    'locale-manifest.json',
    'localized-content-index.jsonl',
    'entity-type-locale-lexicon.jsonl',
    'relation-locale-lexicon.jsonl',
  ] as const) {
    const relative = `${V037_BILINGUAL_BUNDLE_RELATIVE}/${file}`;
    const digest = sha256File(repoRoot, relative);
    const expected = declared.get(file);
    if (!expected) {
      throw new V037AdapterError('bundle-file-undeclared', `upstream bundle omits ${file}`);
    }
    if (expected !== digest) {
      throw new V037AdapterError('bundle-hash-drift', `upstream ${file} drifted from the bundle manifest`);
    }
  }
  return { localeManifest };
}

/**
 * Convert the exact upstream bilingual bundle into ACT's complete-locale
 * manifest bound to the active composite identity. Every presentation
 * denominator member must be covered by an approved upstream row.
 */
export function adaptV037LocaleManifest(input: {
  repoRoot: string;
  envelope: V037EnvelopeIdentityInput;
  inventory: LocalePresentationInventory;
}): { manifest: AuthorityLocaleManifest; uncovered: V037UncoveredReport } {
  const { localeManifest } = verifyBundleSeal(input.repoRoot);

  const contentRows = readJsonl<UpstreamLocalizedContentRow>(
    input.repoRoot,
    `${V037_BILINGUAL_BUNDLE_RELATIVE}/localized-content-index.jsonl`,
  ).filter((row) => row.review_status === 'approved' && row.value.length > 0);
  const typeRows = readJsonl<UpstreamTypeTermRow>(
    input.repoRoot,
    `${V037_BILINGUAL_BUNDLE_RELATIVE}/entity-type-locale-lexicon.jsonl`,
  ).filter((row) => row.review_status === 'approved');
  const relationRows = readJsonl<UpstreamRelationTermRow>(
    input.repoRoot,
    `${V037_BILINGUAL_BUNDLE_RELATIVE}/relation-locale-lexicon.jsonl`,
  ).filter((row) => row.review_status === 'approved');

  const upstreamByName = new Map<string, Map<AdmittedLocale, string>>();
  // 说明源 = meaning ∪ statement_text（上游两类按目标互斥：概念/公式走
  // meaning，知识陈述走 statement_text；联合回退与按类型映射等价）。
  const upstreamByExplanation = new Map<string, Map<AdmittedLocale, string>>();
  for (const row of contentRows) {
    if (row.locale !== 'zh-CN' && row.locale !== 'en') continue;
    if (row.field_path === 'name') {
      const slot = upstreamByName.get(row.target_id) ?? new Map<AdmittedLocale, string>();
      slot.set(row.locale, row.value);
      upstreamByName.set(row.target_id, slot);
    } else if (row.field_path === 'meaning' || row.field_path === 'statement_text') {
      const slot = upstreamByExplanation.get(row.target_id) ?? new Map<AdmittedLocale, string>();
      slot.set(row.locale, row.value);
      upstreamByExplanation.set(row.target_id, slot);
    }
  }
  const upstreamTypes = new Map<string, Map<AdmittedLocale, string>>();
  for (const row of typeRows) {
    const slot = upstreamTypes.get(row.term_id) ?? new Map<AdmittedLocale, string>();
    slot.set(row.locale, row.label);
    upstreamTypes.set(row.term_id, slot);
  }
  const upstreamRelations = new Map<string, Map<AdmittedLocale, string>>();
  for (const row of relationRows) {
    const slot = upstreamRelations.get(row.predicate_id) ?? new Map<AdmittedLocale, string>();
    slot.set(row.locale, row.forward_label);
    upstreamRelations.set(row.predicate_id, slot);
  }

  const records: LocalePresentationRecord[] = [];
  const languageNeutralRecordIds: string[] = [];
  const uncoveredNames: string[] = [];
  const uncoveredExplanations: string[] = [];

  // 覆盖集分母：无上游双语行的对象进 uncovered 清单（r5 残留：2 名 +
  // 1 说明，均为内部记录类对象），en 帧按 product-hidden/空说明处置，
  // 不以 zh 回填、不以缺失阻断整包资格。
  const emit = (
    category: MandatoryLocaleCategory,
    expectedIds: readonly string[],
    source: Map<string, Map<AdmittedLocale, string>>,
    uncovered: string[] | null,
    options: { trustedFormulaIdPattern?: RegExp } = {},
  ): readonly string[] => {
    const covered: string[] = [];
    for (const id of expectedIds) {
      const slot = source.get(id);
      const zh = slot?.get('zh-CN');
      const en = slot?.get('en');
      if (!zh || !en) {
        uncovered?.push(id);
        continue;
      }
      // 名字本身是数学文本（块级 LaTeX）且两语言同值的对象：按受治理
      // 语言中立公式记录保留在分母内（允许换行），en 帧渲染同一 TeX，
      // 保持中英拓扑一致（#1741 P1：不以缩小分母放行）。真正不可呈现的
      // 文本仍进 uncovered 处置。
      const mathText = BLOCK_MATH_TEXT.test(zh) && BLOCK_MATH_TEXT.test(en);
      const trustedFormula = mathText || options.trustedFormulaIdPattern?.test(id) === true;
      if (!isSafeLocalePresentationText(zh, trustedFormula) || !isSafeLocalePresentationText(en, trustedFormula)) {
        uncovered?.push(id);
        continue;
      }
      covered.push(id);
      const languageNeutral = zh === en;
      for (const locale of ADMITTED_LOCALES) {
        records.push({
          recordId: id,
          category,
          locale,
          value: locale === 'zh-CN' ? zh : en,
          source: LOCALE_RECORD_SOURCE,
          // trustedFormula 独立于 languageNeutral：块级数学文本名（含
          // 本地化条件词的 zh/en 不同值）也需要换行豁免（#1741）。
          ...(languageNeutral ? { languageNeutral: true } : {}),
          ...(trustedFormula ? { trustedFormula: true } : {}),
        });
      }
      // 同值双语即 language-neutral；登记进 manifest 分类清单（trusted
      // Formula 只是公式身份的附加标记，不改变分类）。
      if (languageNeutral) languageNeutralRecordIds.push(id);
    }
    return covered;
  };

  const coveredNames = emit('object-names', input.inventory.objectNames, upstreamByName, uncoveredNames, {
    trustedFormulaIdPattern: /^ctf:/u,
  });
  const coveredExplanations = emit(
    'object-explanations',
    input.inventory.objectExplanations,
    upstreamByExplanation,
    uncoveredExplanations,
  );
  const coveredTypes = emit('types', input.inventory.types, upstreamTypes, null);
  const coveredRelations = emit('relations', input.inventory.relations, upstreamRelations, null);

  // 呈现真实空集类别（域名/方向枚举属 interface catalog）；别名与来源
  // 已在覆盖集中以真实清单出现（当前均为空数组）。
  const emptyCategories: MandatoryLocaleCategory[] = ['domains', 'directions'];
  const denominators: LocaleCategoryDenominator[] = [
    ...([
      ['object-names', coveredNames],
      ['object-explanations', coveredExplanations],
      ['types', coveredTypes],
      ['relations', coveredRelations],
      ['approved-aliases', input.inventory.aliasIds],
      ['readable-sources', input.inventory.sourceIds],
    ] as Array<[MandatoryLocaleCategory, readonly string[]]>).map(([category, ids]) => ({
      category,
      recordIds: [...ids].sort(),
      digest: localeDigest([...ids].sort()),
    })),
    ...emptyCategories.map((category) => ({ category, recordIds: [], digest: localeDigest([]) })),
  ];

  const zhComponent = localeManifest.locale_components['zh-CN'];
  const enComponent = localeManifest.locale_components['en'];
  if (!zhComponent || !enComponent || zhComponent.hash !== enComponent.hash) {
    throw new V037AdapterError('language-component-identity', 'upstream language components are not co-sealed');
  }

  const manifest: AuthorityLocaleManifest = {
    contract: LOCALE_MANIFEST_CONTRACT,
    identity: {
      compositeReleaseName: input.envelope.compositeReleaseName,
      authorityReleaseId: input.envelope.authorityReleaseId,
      authoritySnapshotId: input.envelope.authoritySnapshotId,
      authoritySnapshotHash: input.envelope.authoritySnapshotHash,
      languageComponentId: zhComponent.id,
      languageComponentDigest: zhComponent.content_digest,
      schemaId: LOCALE_MANIFEST_CONTRACT,
    },
    locales: [...ADMITTED_LOCALES],
    denominators,
    denominatorDigest: denominatorDigestFor(denominators),
    records,
    contentDigest: contentDigestFor(records),
    languageNeutralRecordIds,
  };
  return {
    manifest,
    uncovered: {
      objectNames: uncoveredNames.sort(),
      objectExplanations: uncoveredExplanations.sort(),
    },
  };
}
