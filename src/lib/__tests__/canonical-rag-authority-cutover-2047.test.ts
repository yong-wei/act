import { afterEach, describe, expect, it } from 'vitest';

import {
  assertProductionSelectorUnchanged,
  assertShadowCannotActivateCutover,
  productionAnswerUsesLegacy,
  RAG_PRODUCTION_AUTHORITY_ENV,
  readRagProductionAuthorityDial,
  selectRagAuthority,
} from '@/lib/canonical-rag/authority';

afterEach(() => {
  delete process.env[RAG_PRODUCTION_AUTHORITY_ENV];
});

describe('RAG 生产权威拨盘（#2047 cutover 治理）', () => {
  it('未配置时缺省为授权切换后的 composed 通道', () => {
    expect(readRagProductionAuthorityDial({})).toBe('canonical-composed');
    const selector = selectRagAuthority('PRODUCTION_ANSWER');
    expect(selector).toMatchObject({
      authority: 'CANONICAL',
      productionAuthoritative: true,
      canonicalExpansionVisible: true,
      allowsLegacyFallback: true,
      productionChannel: 'canonical-composed',
    });
    expect(productionAnswerUsesLegacy(selector)).toBe(false);
  });

  it('拨回 legacy（回滚路径）恢复 LEGACY 且无数据迁移语义', () => {
    expect(readRagProductionAuthorityDial({ KONLING_RAG_PRODUCTION_AUTHORITY: 'legacy' }))
      .toBe('legacy');
    const selector = selectRagAuthority('PRODUCTION_ANSWER', { productionAuthority: 'legacy' });
    expect(selector).toMatchObject({
      authority: 'LEGACY',
      productionAuthoritative: true,
      canonicalExpansionVisible: false,
      allowsLegacyFallback: true,
    });
    expect(productionAnswerUsesLegacy(selector)).toBe(true);
  });

  it('非法配置 fail-safe 回 LEGACY；非生产消费者仍为 CANONICAL_SHADOW', () => {
    expect(readRagProductionAuthorityDial({ KONLING_RAG_PRODUCTION_AUTHORITY: 'typo-value' }))
      .toBe('legacy');
    expect(selectRagAuthority('SHADOW_COMPARISON')).toMatchObject({
      authority: 'CANONICAL_SHADOW',
      productionAuthoritative: false,
    });
  });

  it('生产选择器不变量与拨盘一致；legacy 拨盘禁止暴露 Canonical expansion', () => {
    expect(() => assertProductionSelectorUnchanged({
      requestedConsumer: 'PRODUCTION_ANSWER',
      selected: selectRagAuthority('PRODUCTION_ANSWER', { productionAuthority: 'legacy' }),
      shadowSucceeded: true,
      productionAuthority: 'legacy',
    })).not.toThrow();

    expect(() => assertProductionSelectorUnchanged({
      requestedConsumer: 'PRODUCTION_ANSWER',
      // legacy 拨盘下混入 composed 选择器：不变量必须拒绝。
      selected: selectRagAuthority('PRODUCTION_ANSWER'),
      shadowSucceeded: false,
      productionAuthority: 'legacy',
    })).toThrow(/does not match the configured dial/);

    expect(() => assertProductionSelectorUnchanged({
      requestedConsumer: 'PRODUCTION_ANSWER',
      selected: selectRagAuthority('PRODUCTION_ANSWER', { productionAuthority: 'canonical-composed' }),
      shadowSucceeded: false,
      productionAuthority: 'canonical-composed',
    })).not.toThrow();

    // composed 拨盘下 legacy 选择器同样违反不变量（配置漂移检测）。
    expect(() => assertProductionSelectorUnchanged({
      requestedConsumer: 'PRODUCTION_ANSWER',
      selected: selectRagAuthority('PRODUCTION_ANSWER', { productionAuthority: 'legacy' }),
      shadowSucceeded: false,
      productionAuthority: 'canonical-composed',
    })).toThrow(/does not match the configured dial/);
  });

  it('shadow 成功与自铸收据仍不能越过 CUTOVER_ACTIVATION 门禁', () => {
    expect(() => assertShadowCannotActivateCutover({
      shadowSucceeded: true,
      cutoverReceipt: {
        schemaVersion: 'act-rag-cutover-authority/v1',
        receiptId: 'r-1',
        releaseSetId: 'rs-1',
        releaseId: 'rel-1',
        releaseHash: 'h',
        captureRevision: 'rev-1',
        authorityDigest: 'd',
        activatedAt: '2026-09-08T00:00:00.000Z',
      },
    })).not.toThrow();
  });
});
