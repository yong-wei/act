import { describe, expect, it } from 'vitest';

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  FormalResourceRemediationError,
  type HotwordManifest,
  type ResourceProcessingRecord,
} from '@/lib/formal-resource-remediation/contracts';
import {
  assertSameSharedAllocation,
  reopenRemediationAllocation,
  sealRemediationAllocation,
} from '@/lib/formal-resource-remediation/allocation';
import {
  buildRemediationDenominator,
  dispositionsFromRecords,
  validateConservation,
} from '@/lib/formal-resource-remediation/ledger';
import {
  assertNoAnswerPayloads,
  assertPublicProjectionIsSafe,
} from '@/lib/formal-resource-remediation/privacy';
import {
  assertNoOrphanOutputs,
  assertSourceHashMatches,
  buildRemediationSummary,
} from '@/lib/formal-resource-remediation/summary';
import { segmentMarkdown } from '@/lib/formal-resource-remediation/processors/markdown';
import { processCard, processHandout } from '@/lib/formal-resource-remediation/processors/text';
import {
  DEFAULT_HOTWORD_CONFIG,
  assertHotwordSourceBinding,
  extractHotwordManifest,
  hotwordConfigDigest,
} from '@/lib/formal-resource-remediation/processors/hotwords';

const H = (c: string) => c.repeat(64);

function allocationInput() {
  return {
    sealedAt: '2026-08-23T00:00:00.000Z',
    capture: {
      captureHash: H('a'),
      compatibility: {
        contract: 'authority-adapter-compatibility/v1' as const,
        adapterContractVersion: 'existing-act-adapter',
        classification: 'COMPATIBLE' as const,
        incompatibleReasons: [],
        captured: {
          schemaVersion: '0.3.0',
          schemaSha256: H('a'),
          contractVersion: 'actkg-public-bundle/2',
          requiredMembers: ['release'],
          profiles: ['runtime'],
          representativeParse: 'COMPLETE' as const,
        },
      },
    },
    scopeHash: H('b'),
    denominatorHash: H('c'),
    policyVersions: { continuity: 'v1' },
    implementationIdentities: { builder: 'b1' },
    remediation: {
      terminologyRegistryId: 'terminology/v1',
      localeIdentity: 'zh-CN',
      sourceRegistryIds: ['videos@b3ef241', 'act-authoring@e88f64b'],
      processorRegistryHash: H('d'),
      courseOwnerId: 'course-owner',
    },
  };
}

describe('shared coordination allocation reuse', () => {
  it('seals one allocation that passes both shared and remediation validators', () => {
    const allocation = sealRemediationAllocation(allocationInput());
    expect(allocation.allocationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(() => reopenRemediationAllocation(allocation)).not.toThrow();
    // Deterministic over the shared field set: the same inputs seal again.
    const again = sealRemediationAllocation(allocationInput());
    expect(again.policyVersions['remediation.courseOwnerId']).toBe('course-owner');
  });

  it('rejects allocations missing remediation extensions or registries', () => {
    const missing = allocationInput();
    missing.remediation = { ...missing.remediation, sourceRegistryIds: [] };
    expect(() => sealRemediationAllocation(missing)).toThrow(/at least one governed source registry/);
    const tampered = sealRemediationAllocation(allocationInput());
    const forged = {
      ...tampered,
      remediation: { ...tampered.remediation, sourceRegistryIds: ['extra'] },
    };
    expect(() => reopenRemediationAllocation(forged)).toThrow(/do not match the sealed allocation/);
    expect(() => assertSameSharedAllocation(tampered, { ...tampered, allocationHash: H('e') }))
      .toThrow(/not the remediation allocation/);
  });
});

function activeRelease() {
  return {
    releaseId: 'runtime-89fef308a',
    manifestSha256: H('a'),
    treeSha256: H('b'),
    activeReceiptHash: H('c'),
    lifecycleGeneration: 12,
  };
}

function baselineEntries() {
  return [
    { entryId: 'e1', resourceId: 'handout-1-1', classification: 'resource' as const, subtype: 'handout' },
    { entryId: 'e2', resourceId: 'card-anfis', classification: 'resource' as const, subtype: 'card' },
  ];
}

function processingRecord(overrides: Partial<ResourceProcessingRecord> = {}): ResourceProcessingRecord {
  return {
    contract: 'resource-processing-record/v1',
    recordId: 'rec-1',
    allocationHash: H('f'),
    resourceId: 'handout-1-1',
    resourceSubtype: 'handout',
    origin: 'ACTIVE_BASELINE',
    sourceIdentity: 'git:blob-1',
    externalInputId: null,
    processorIdentity: 'handout-processor/v1',
    validatorIdentity: 'remediation-validator/v1',
    atomOutputIds: ['atom-1'],
    mappingOutputIds: ['map-1'],
    anchorOutputIds: ['anchor-1'],
    launchOutputIds: ['launch-1'],
    disposition: 'INCLUDED',
    failureCodes: [],
    limitations: [],
    outputManifestHash: H('9'),
    ...overrides,
  };
}

describe('denominator conservation and continuity', () => {
  it('conserves a complete run and maps records onto continuity dispositions', () => {
    const denominator = buildRemediationDenominator({
      activeRelease: activeRelease(),
      entries: baselineEntries(),
      delta: [{ resourceId: 'card-new', subtype: 'card', change: 'NEW', sourceIdentity: 'git:blob-2' }],
    });
    const records = [
      processingRecord(),
      processingRecord({
        recordId: 'rec-2',
        resourceId: 'card-anfis',
        resourceSubtype: 'card',
        processorIdentity: 'card-processor/v1',
      }),
      processingRecord({
        recordId: 'rec-3',
        resourceId: 'card-new',
        origin: 'NEW_DELTA',
        disposition: 'EXCLUDED',
        failureCodes: ['ambiguous-mapping'],
        atomOutputIds: [],
        mappingOutputIds: [],
        anchorOutputIds: [],
        launchOutputIds: [],
      }),
    ];
    const result = validateConservation({
      denominator,
      processingRecords: records,
      atomRows: [
        { atomId: 'atom-1', resourceId: 'handout-1-1', disposition: 'BOUND', nonTeachingEvidenceRefs: [] },
        { atomId: 'atom-2', resourceId: 'card-anfis', disposition: 'BOUND', nonTeachingEvidenceRefs: [] },
      ],
      retirements: [],
      baselineReleaseId: activeRelease().releaseId,
    });
    expect(result.conserved).toBe(true);
    const dispositions = dispositionsFromRecords(records);
    expect(dispositions.find((entry) => entry.resourceId === 'card-new')?.failureKinds)
      .toContain('weak-canonical-mapping');
  });

  it('fails completion when a baseline row disappears or ends non-included', () => {
    const denominator = buildRemediationDenominator({
      activeRelease: activeRelease(),
      entries: baselineEntries(),
      delta: [],
    });
    const missing = validateConservation({
      denominator,
      processingRecords: [processingRecord()],
      atomRows: [{ atomId: 'atom-1', resourceId: 'handout-1-1', disposition: 'BOUND', nonTeachingEvidenceRefs: [] }],
      retirements: [],
      baselineReleaseId: activeRelease().releaseId,
    });
    expect(missing.conserved).toBe(false);
    expect(missing.missingResourceIds).toEqual(['card-anfis']);
    const violated = validateConservation({
      denominator,
      processingRecords: [
        processingRecord(),
        processingRecord({ recordId: 'rec-2', resourceId: 'card-anfis', disposition: 'EXCLUDED', failureCodes: ['processor-failure'] }),
      ],
      atomRows: [{ atomId: 'atom-1', resourceId: 'handout-1-1', disposition: 'BOUND', nonTeachingEvidenceRefs: [] }],
      retirements: [],
      baselineReleaseId: activeRelease().releaseId,
    });
    expect(violated.violatedBaselineIds).toEqual(['card-anfis']);
  });
});

describe('privacy validation', () => {
  it('rejects absolute paths, credentials, signed URLs, and answer fields', () => {
    expect(() => assertPublicProjectionIsSafe('leak-1', { path: '/Users/yw/secret.md' }))
      .toThrow(/absolute-local-path/);
    expect(() => assertPublicProjectionIsSafe('leak-2', { url: 'https://x?OSSAccessKeyId=abc&Signature=zzz' }))
      .toThrow(/signed-url/);
    expect(() => assertPublicProjectionIsSafe('leak-3', { apiKey: '0123456789abcdef' }))
      .toThrow(/credential-pair/);
    expect(() => assertNoAnswerPayloads('leak-4', JSON.stringify({ answer: 'B' })))
      .toThrow(/answer\/scoring field/);
    expect(() => assertPublicProjectionIsSafe('safe', { title: '单元 1-1 讲义', paragraphId: 'p-1' }))
      .not.toThrow();
  });
});

describe('deterministic summaries', () => {
  it('fails closed on duplicate rows, unknown dispositions, and cross-capture inputs', () => {
    const allocationHash = H('f');
    const row = (resourceId: string, disposition = 'INCLUDED') => ({
      resourceId,
      subtype: 'handout',
      disposition,
      atomCount: 2,
      bindingCount: 1,
      sourceSha256: H('1'),
      allocationHash,
    });
    expect(() => buildRemediationSummary(allocationHash, [row('a'), row('a')]))
      .toThrow(/appears more than once/);
    expect(() => buildRemediationSummary(allocationHash, [row('a', 'MAYBE')]))
      .toThrow(/unknown disposition/);
    expect(() => buildRemediationSummary(allocationHash, [{ ...row('a'), allocationHash: H('e') }]))
      .toThrow(/produced under allocation/);
    const summary = buildRemediationSummary(allocationHash, [row('a'), row('b', 'EXCLUDED')]);
    expect(summary.includedCount).toBe(1);
    expect(summary.excludedCount).toBe(1);
    expect(() => assertNoOrphanOutputs(
      [processingRecord()],
      ['atom-1', 'map-1', 'anchor-1', 'launch-1'],
    )).not.toThrow();
    expect(() => assertNoOrphanOutputs([processingRecord()], ['atom-1']))
      .toThrow(/absent from the declared inventory/);
    expect(() => assertSourceHashMatches('r1', H('1'), H('2'))).toThrow(/hashes to/);
  });
});

const HANDOUT_MARKDOWN = `# 单元 1-1 | 看见整门课

## 一、同样的问题，不同的面孔

高速行驶中的车辆需要保持在车道中心。被控对象在被持续地测量、比较和修正。

反馈思想是自动控制原理的核心。开环传递函数与闭环传递函数的差别在于反馈路径。

## 封面漫画

![封面](cover.png)
`;

describe('markdown segmentation and text processors', () => {
  it('segments semantic paragraphs with stable ids and non-teaching cover sections', () => {
    const first = segmentMarkdown(HANDOUT_MARKDOWN, { resourceId: 'handout-1-1' }).segmentation;
    const second = segmentMarkdown(HANDOUT_MARKDOWN, { resourceId: 'handout-1-1' }).segmentation;
    expect(first.paragraphCount).toBeGreaterThan(1);
    expect(first.segmentationHash).toBe(second.segmentationHash);
    const handout = processHandout({
      resourceId: 'handout-1-1',
      subtype: 'handout',
      markdown: HANDOUT_MARKDOWN,
      sourceContentSha256: H('1'),
      derivedPdfRelativePath: 'lessons/1-1/design/1-1-handout.pdf',
    });
    expect(handout.atoms.filter((atom) => atom.disposition === 'BOUND').length).toBeGreaterThan(0);
    const cover = handout.atoms.find((atom) => atom.headingPath.join('/').includes('封面'));
    expect(cover?.disposition).toBe('NON_TEACHING');
    expect(cover?.nonTeachingEvidenceRefs.length).toBeGreaterThan(0);
  });

  it('processes cards with mandatory Canonical keys and rejects whole-file fallbacks', () => {
    const CARD = `---
node_id: Bode图_1_1
name: Bode图
category: 概念性
---

## 首页

# Bode图

**一句话定义**：频率特性的对数坐标图示。

## 详情

### 完整解释

Bode 图由对数幅频特性和相频特性两张图组成。
`;
    const card = processCard({
      resourceId: 'card-bode',
      markdown: CARD,
      sourceContentSha256: H('2'),
    });
    expect(card.canonicalKey).toBe('Bode图_1_1');
    expect(card.atoms.length).toBeGreaterThan(1);
    expect(() => processCard({
      resourceId: 'card-bad',
      markdown: '## 无 frontmatter 的卡片\n\n正文。',
      sourceContentSha256: H('2'),
    })).toThrow(/no frontmatter node_id/);
    expect(() => processHandout({
      resourceId: 'handout-empty',
      subtype: 'handout',
      markdown: '\n\n',
      sourceContentSha256: H('3'),
      derivedPdfRelativePath: null,
    })).toThrow(/zero semantic paragraphs/);
  });
});

describe('handout-derived hotword extraction', () => {
  it('derives bounded, deduplicated entries only from the bound source', () => {
    const manifest = extractHotwordManifest({
      allocationHash: H('f'),
      resourceId: 'video-1-1-intro',
      sourceResourceId: 'handout-1-1',
      sourceMarkdown: HANDOUT_MARKDOWN,
      sourceContentSha256: H('1'),
      locale: 'zh-CN',
      terminologyRegistryId: 'terminology/v1',
      config: {
        ...DEFAULT_HOTWORD_CONFIG,
        terminologyAliases: { '传递函数': 'chuán dì hán shù' },
        terminologyTerms: ['传递函数', '反馈思想', '神经网络'],
      },
    });
    expect(manifest.contract).toBe('handout-derived-hotword-manifest/v1');
    expect(manifest.entries.length).toBeGreaterThan(0);
    expect(manifest.entries.length).toBeLessThanOrEqual(96);
    for (const entry of manifest.entries) {
      expect(entry.weight).toBeGreaterThanOrEqual(1);
      expect(entry.weight).toBeLessThanOrEqual(5);
    }
    // Terms absent from the source can never appear.
    expect(manifest.entries.some((entry) => entry.term === '神经网络')).toBe(false);
    const alias = manifest.entries.find((entry) => entry.term === '传递函数');
    expect(alias?.pronunciationAlias).toBe('chuán dì hán shù');
    // Deterministic: same inputs, same manifest hash; config drift changes it.
    const again = extractHotwordManifest({
      allocationHash: H('f'),
      resourceId: 'video-1-1-intro',
      sourceResourceId: 'handout-1-1',
      sourceMarkdown: HANDOUT_MARKDOWN,
      sourceContentSha256: H('1'),
      locale: 'zh-CN',
      terminologyRegistryId: 'terminology/v1',
      config: {
        ...DEFAULT_HOTWORD_CONFIG,
        terminologyAliases: { '传递函数': 'chuán dì hán shù' },
        terminologyTerms: ['传递函数', '反馈思想', '神经网络'],
      },
    });
    expect(again.manifestHash).toBe(manifest.manifestHash);
    const drifted = extractHotwordManifest({
      allocationHash: H('f'),
      resourceId: 'video-1-1-intro',
      sourceResourceId: 'handout-1-1',
      sourceMarkdown: HANDOUT_MARKDOWN,
      sourceContentSha256: H('1'),
      locale: 'zh-CN',
      terminologyRegistryId: 'terminology/v1',
      config: { ...DEFAULT_HOTWORD_CONFIG, minOccurrences: 2 },
    });
    expect(drifted.manifestHash).not.toBe(manifest.manifestHash);
    expect(() => assertHotwordSourceBinding({ resourceId: 'video-x', sourceResourceId: null }))
      .toThrow(/no exact handout\/lecture source binding/);
  });
});

import { processExerciseResource, projectExerciseAtomPublic } from '@/lib/formal-resource-remediation/processors/exercise';

describe('exercise processor', () => {
  const question = (overrides: Partial<Parameters<typeof processExerciseResource>[0]['questions'][number]> = {}) => ({
    questionId: 'q-1',
    stem: '求单位反馈系统的稳态误差',
    options: ['A. 0', 'B. 1/K'],
    answer: 'B',
    explanation: '由误差传递函数推得。',
    originLocator: 'lesson:2-2:step-3',
    ...overrides,
  });

  it('materializes one atom per question with answer isolation', () => {
    const { atoms } = processExerciseResource({
      resourceId: 'ex-2-2-set',
      questions: [question(), question({ questionId: 'q-2', stem: '另一题', answer: 'A' })],
    });
    expect(atoms.length).toBe(2);
    expect(atoms[0]?.disposition).toBe('BOUND');
    expect(atoms[0]?.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    const publicView = JSON.stringify(projectExerciseAtomPublic(atoms[0] as ReturnType<typeof processExerciseResource>['atoms'][number]));
    expect(publicView).not.toContain('稳态误差');
    expect(publicView).not.toContain('"B"');
    expect(publicView).toContain('originLocator');
    // Content drift invalidates identity; same content reproduces it.
    const drifted = processExerciseResource({
      resourceId: 'ex-2-2-set',
      questions: [question({ stem: '改过的题干' })],
    });
    expect(drifted.atoms[0]?.contentSha256).not.toBe(atoms[0]?.contentSha256);
    const same = processExerciseResource({ resourceId: 'ex-2-2-set', questions: [question()] });
    expect(same.atoms[0]?.atomId).toBe(atoms[0]?.atomId);
  });

  it('fails closed on duplicates, missing stem/answer, and missing locators', () => {
    expect(() => processExerciseResource({
      resourceId: 'r',
      questions: [question(), question()],
    })).toThrow(/appears twice/);
    expect(() => processExerciseResource({
      resourceId: 'r',
      questions: [question({ stem: '  ' })],
    })).toThrow(/cannot be sealed/);
    expect(() => processExerciseResource({
      resourceId: 'r',
      questions: [question({ originLocator: '' })],
    })).toThrow(/no origin locator/);
    expect(() => processExerciseResource({ resourceId: 'r', questions: [] }))
      .toThrow(/declares no questions/);
  });
});

import { selectTerminologyHotwords } from '@/lib/formal-resource-remediation/processors/hotwords';

describe('terminology hotword selection', () => {
  it('excludes generic, short, Latin, and substring-duplicate terms', () => {
    const manifest = extractHotwordManifest({
      allocationHash: H('f'),
      resourceId: 'video-2-1',
      sourceResourceId: 'handout-2-1',
      sourceMarkdown: '传递函数 控制器 递函数 复变量',
      sourceContentSha256: H('1'),
      locale: 'zh-CN',
      terminologyRegistryId: 'terminology/v1',
      config: {
        ...DEFAULT_HOTWORD_CONFIG,
        terminologyTerms: ['传递函数', '控制器', '递函数', '复变量', '控制', 'bode'],
      },
    });
    const selected = selectTerminologyHotwords(manifest);
    expect(selected).toContain('传递函数');
    expect(selected).toContain('控制器');
    expect(selected).not.toContain('递函数');
    expect(selected).not.toContain('控制');
    expect(selected).not.toContain('bode');
    expect(selected.length).toBeLessThanOrEqual(20);
  });
});
