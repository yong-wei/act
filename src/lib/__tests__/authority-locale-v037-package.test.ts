/**
 * Sealed v0.37 bilingual qualification package (#1741).
 *
 * Runtime reads only this package; drift of identity, shard set, interface
 * catalog or manifest content fails closed to the historical capability.
 * Projection checks cover the ACT-vocabulary labels (domains, teaching
 * predicate, direction enums), engineering predicate labels from the release
 * language component, and uncovered-object dispositions in the en frame.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  LOCALE_QUALIFICATION_PACKAGE_CONTRACT,
  readLocaleQualificationPackage,
  verifyLocaleQualificationPackage,
  localeQualificationPackagePath,
} from '@/lib/authority-locale-readiness/qualification-package';
import { resolveActiveLocaleQualification } from '@/lib/authority-locale-readiness/request';
import {
  applyLocaleToLearnerShard,
  localeProjectedObjectLabel,
} from '@/lib/authority-locale-readiness/project-shard';
import type {
  AuthorityLocaleManifest,
  LocaleQualificationReceipt,
} from '@/lib/authority-locale-readiness/contracts';
import type {
  AuthorityRootShard,
  AuthorityNodeNeighborhoodShard,
} from '@/lib/authority-domain-shards/contracts';

const COMPOSITE = 'control-theory-engineering-v0.37';
const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

const sealed = readLocaleQualificationPackage(process.cwd(), COMPOSITE)!;

function receiptFor(locale: 'zh-CN' | 'en'): LocaleQualificationReceipt {
  const receipt = locale === 'en' ? sealed.qualification.en : sealed.qualification.zhCN;
  if (!receipt || receipt.status !== 'ready') throw new Error(`sealed ${locale} receipt is not ready`);
  return receipt;
}

function rootShardFixture(): AuthorityRootShard {
  return {
    shardClass: 'root',
    envelope: {} as AuthorityRootShard['envelope'],
    root: {
      kind: 'presentation-root-catalog',
      domains: [
        {
          kind: 'presentation-domain',
          order: 1,
          displayName: '系统建模',
          summary: '',
          presentationRole: 'domain',
          visualRole: 'modeling',
          memberCount: 10,
        },
      ],
      aggregate: {
        kind: 'presentation-aggregate',
        order: 0,
        displayName: '控制理论综合',
        summary: '',
        presentationRole: 'aggregate',
        visualRole: 'aggregate',
        domainCount: 15,
      },
    },
  };
}

function neighborhoodFixture(): AuthorityNodeNeighborhoodShard {
  const coveredId = sealed.manifest.denominators
    .find((row) => row.category === 'object-names')?.recordIds[0]!;
  const uncoveredId = sealed.uncovered.objectNames[0]!;
  return {
    shardClass: 'node-neighborhood',
    envelope: {} as AuthorityNodeNeighborhoodShard['envelope'],
    nodeId: coveredId,
    limit: 32,
    truncated: false,
    objects: [
      {
        id: coveredId,
        canonicalType: 'DomainConcept',
        label: '中文概念名',
        aliases: [],
        description: '中文说明',
        governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: null },
        semanticSupport: { supported: true, readOnly: true },
        memberships: [],
      },
      {
        id: uncoveredId,
        canonicalType: 'DomainConcept',
        label: '内部记录',
        aliases: [],
        description: '内部说明',
        governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: null },
        semanticSupport: { supported: true, readOnly: true },
        memberships: [],
      },
    ],
    relations: [
      {
        id: 'rel-teaching-1',
        predicate: 'PREREQUISITE',
        sourceId: coveredId,
        targetId: uncoveredId,
        direction: 'source_to_target',
        direct: true,
        qualityTier: 'gold',
        governance: { reviewStatus: 'approved', publicationStatus: 'published' },
        semanticSupport: { supported: true, readOnly: true },
        layer: 'ACT_TEACHING',
        relationFamily: 'teaching-prerequisite',
        predicateLabel: '先修关系',
        directionLabel: '由前者指向后者',
      },
      {
        id: 'rel-eng-1',
        predicate: 'applies_to',
        sourceId: coveredId,
        targetId: uncoveredId,
        direction: 'unordered',
        direct: null,
        qualityTier: 'gold',
        governance: { reviewStatus: 'approved', publicationStatus: 'published' },
        semanticSupport: { supported: true, readOnly: true },
        layer: 'ENGINEERING',
        relationFamily: 'application-and-analysis',
        predicateLabel: '适用于',
        directionLabel: '关联关系',
      },
    ],
    boundaries: [],
  };
}

describe('sealed v0.37 locale qualification package (#1741)', () => {
  it('loads the sealed package and verifies it against the live identity', () => {
    expect(sealed.contract).toBe(LOCALE_QUALIFICATION_PACKAGE_CONTRACT);
    expect(sealed.compositeReleaseName).toBe(COMPOSITE);
    const verified = verifyLocaleQualificationPackage({ repoRoot: process.cwd(), package: sealed });
    expect(verified.ok).toBe(true);
    expect(sealed.qualification.bilingualReady).toBe(true);
    expect(sealed.qualification.zhCN?.status).toBe('ready');
    expect(sealed.qualification.en?.status).toBe('ready');
  });

  it('records the complete adapter denominators and the residual uncovered set', () => {
    const byCategory = new Map(sealed.manifest.denominators.map((row) => [row.category, row.recordIds.length]));
    expect(sealed.manifest.denominators).toHaveLength(8);
    expect(byCategory.get('object-names')).toBeGreaterThan(2800);
    expect(byCategory.get('object-explanations')).toBeGreaterThan(2300);
    expect(byCategory.get('types')).toBe(7);
    // r6 admits the published engineering prerequisite predicate (#2058).
    expect(byCategory.get('relations')).toBe(10);
    expect(byCategory.get('domains')).toBe(0);
    expect(byCategory.get('directions')).toBe(0);
    // Governed aliases with complete bilingual upstream rows qualify for the
    // complete-locale denominator; readable sources stay a zh-base surface.
    expect(byCategory.get('approved-aliases')).toBeGreaterThan(600);
    expect(byCategory.get('readable-sources')).toBe(0);
    expect(sealed.uncovered.objectNames.length).toBeGreaterThan(0);
    expect(sealed.uncovered.objectExplanations.length).toBeGreaterThan(0);
  });

  it('resolves complete-locale capability from the package without walking shards', () => {
    const resolved = resolveActiveLocaleQualification();
    expect(resolved.capability.mode).toBe('complete-locale');
    expect(resolved.capability.bilingualReady).toBe(true);
    expect(resolved.expectedDenominators).toBe(resolved.manifest?.denominators);
  });

  it('fails closed when the package authority identity drifts from the live pointer', () => {
    const tampered = {
      ...sealed,
      authority: { ...sealed.authority, snapshotHash: 'f'.repeat(64) },
    };
    const verified = verifyLocaleQualificationPackage({ repoRoot: process.cwd(), package: tampered });
    expect(verified.ok).toBe(false);
  });

  it('resolves to the historical capability when activation inputs are absent', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'act-empty-'));
    tempRoots.push(root);
    const resolved = resolveActiveLocaleQualification(root);
    expect(resolved.capability.mode).toBe('historical');
    expect(resolved.capability.bilingualReady).toBe(false);
    expect(resolved.manifest).toBeNull();
  });

  it('fails closed to historical when the interface catalog digest drifts', () => {
    const tampered = { ...sealed, interfaceCatalogDigest: '0'.repeat(64) };
    const verified = verifyLocaleQualificationPackage({ repoRoot: process.cwd(), package: tampered });
    expect(verified.ok).toBe(false);
  });
});

describe('v0.37 locale projection (#1741)', () => {
  it('retains a qualified English explanation in both bounded nodes and detail', () => {
    const id = 'ctkg:v3e-canonical-9988510f6127d3086f4aa265';
    const expected = sealed.manifest.records.find((row) => row.recordId === id && row.locale === 'en' && row.category === 'object-explanations')!.value;
    const neighborhood = neighborhoodFixture();
    neighborhood.objects = [{ ...neighborhood.objects[0]!, id, description: '中文说明' }];
    const projected = applyLocaleToLearnerShard(neighborhood, 'en', sealed.manifest, receiptFor('en'));
    expect(projected.objects[0]?.description).toBe(expected);
    const detail = { shardClass: 'node-detail' as const, envelope: neighborhood.envelope,
      node: { ...neighborhood.objects[0]!, teachingFields: {}, sources: [], media: { cardAvailable: false as const, infographAvailable: false as const } } };
    expect(applyLocaleToLearnerShard(detail, 'en', sealed.manifest, receiptFor('en')).node.description).toBe(expected);
  });
  it('projects root domain names and the aggregate entry from the interface catalog', () => {
    const projected = applyLocaleToLearnerShard(
      rootShardFixture(),
      'en',
      sealed.manifest,
      receiptFor('en'),
    ) as AuthorityRootShard;
    expect(projected.root.domains[0]!.displayName).toBe('System modeling');
    expect(projected.root.aggregate.displayName).toBe('Control theory integration');
    const zh = applyLocaleToLearnerShard(
      rootShardFixture(),
      'zh-CN',
      sealed.manifest,
      receiptFor('zh-CN'),
    ) as AuthorityRootShard;
    expect(zh.root.domains[0]!.displayName).toBe('系统建模');
  });

  it('labels the teaching predicate and direction enums from the interface catalog', () => {
    const en = applyLocaleToLearnerShard(
      neighborhoodFixture(),
      'en',
      sealed.manifest,
      receiptFor('en'),
    ) as AuthorityNodeNeighborhoodShard;
    const teaching = en.relations.find((row) => row.layer === 'ACT_TEACHING')!;
    expect(teaching.predicateLabel).toBe('Prerequisite');
    expect(teaching.directionLabel).toBe('From the former to the latter');
    const engineering = en.relations.find((row) => row.layer === 'ENGINEERING')!;
    // 工程谓词来自 release 语言组件（applies_to 的上游英文 forward label）。
    expect(engineering.predicateLabel?.toLowerCase()).toBe('applies to');
    expect(engineering.directionLabel).toBe('Undirected relation');
  });

  it('projects covered en names and fails closed on uncovered objects', () => {
    const neighborhood = neighborhoodFixture();
    const coveredId = neighborhood.objects[0]!.id;
    const uncoveredId = neighborhood.objects[1]!.id;
    const en = applyLocaleToLearnerShard(
      neighborhood,
      'en',
      sealed.manifest,
      receiptFor('en'),
    ) as AuthorityNodeNeighborhoodShard;
    const covered = en.objects.find((row) => row.id === coveredId)!;
    const uncovered = en.objects.find((row) => row.id === uncoveredId)!;
    expect(covered.label).not.toBe('中文概念名');
    expect(covered.description).not.toBe('中文说明');
    expect(uncovered.label).toBe('名称暂不可用');
    expect(uncovered.description).toBeNull();
    expect(uncovered.aliases).toEqual([]);
    // zh 帧不受 uncovered 处置影响。
    const zh = applyLocaleToLearnerShard(
      neighborhoodFixture(),
      'zh-CN',
      sealed.manifest,
      receiptFor('zh-CN'),
    ) as AuthorityNodeNeighborhoodShard;
    const zhUncovered = zh.objects.find((row) => row.id === uncoveredId)!;
    expect(zhUncovered.label).toBe('内部记录');
    // r6：名字未覆盖不等于说明未覆盖——该对象若有 zh 说明记录则按记录
    // 呈现，仅 en 帧才隐藏说明（uncovered 处置是按 locale 的）。
    const zhExplanation = sealed.manifest.records.find(
      (row) => row.category === 'object-explanations' && row.recordId === uncoveredId && row.locale === 'zh-CN',
    );
    expect(zhUncovered.description).toBe(zhExplanation ? zhExplanation.value : '内部说明');
  });

  it('exposes locale-projected object labels for search matching', () => {
    const coveredId = sealed.manifest.denominators
      .find((row) => row.category === 'object-names')?.recordIds[0]!;
    const enLabel = localeProjectedObjectLabel(coveredId, 'en', sealed.manifest);
    const zhLabel = localeProjectedObjectLabel(coveredId, 'zh-CN', sealed.manifest);
    expect(enLabel).toBeTruthy();
    expect(zhLabel).toBeTruthy();
    expect(enLabel).not.toBe(zhLabel);
    expect(localeProjectedObjectLabel(sealed.uncovered.objectNames[0]!, 'en', sealed.manifest)).toBeNull();
    expect(localeProjectedObjectLabel(coveredId, 'en', null)).toBeNull();
  });
});
