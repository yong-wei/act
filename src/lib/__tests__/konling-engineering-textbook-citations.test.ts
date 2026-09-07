import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resolveKonlingEngineeringTextbookCitations } from '@/lib/konling-engineering-textbook-citations';
import { extractVersionBoundHandle } from '@/lib/textbook-resource-coach/href';

/**
 * 消费真实治理台账（candidates + append-only reviews 的 approved 判定）与
 * textbooks-v2 runtime manifest 的坐标解析；canonicalId 取自当前 approved 集。
 */
const DORF_MAPPED_CANONICAL_ID = 'ctc:909e732d40f972bf760fa8ff';

beforeEach(() => {
  process.env.KONLING_SERVER_MODE_CONTEXT_SECRET = 'unit-test-strong-secret-0f3a1b';
});

afterEach(() => {
  delete process.env.KONLING_SERVER_MODE_CONTEXT_SECRET;
});

describe('konling-engineering-textbook-citations', () => {
  it('approved 映射解析为带 vbh 的教材引用（真实台账 + runtime manifest）', async () => {
    const resolution = await resolveKonlingEngineeringTextbookCitations({
      canonicalIds: [DORF_MAPPED_CANONICAL_ID, 'ctc:no-mapping-known-unknown'],
    });

    expect(resolution.citations).toHaveLength(1);
    const citation = resolution.citations[0]!;
    expect(citation.sourceType).toBe('textbook');
    expect(citation.identity).toMatchObject({
      kind: 'textbook',
      bookId: 'dorf-modern-control-systems',
      edition: '14th Global Edition',
    });
    expect(citation.href).toContain('/textbooks/dorf-modern-control-systems/');
    expect(extractVersionBoundHandle(citation.href ?? '')).toBeTruthy();
    expect(citation.evidenceBasis).toBe('engineering-textbook-mapping:approved');
    // 未映射节点保持无出处，不伪造教材。
    expect(resolution.unmappedCanonicalIds).toContain('ctc:no-mapping-known-unknown');
    expect(resolution.unmappedCanonicalIds).not.toContain(DORF_MAPPED_CANONICAL_ID);
  });

  it('重复映射到同一结构单元的节点共享同一引用（编号去重由 allocator 收口）', async () => {
    const resolution = await resolveKonlingEngineeringTextbookCitations({
      canonicalIds: [DORF_MAPPED_CANONICAL_ID],
    });
    expect(resolution.citations).toHaveLength(1);
    expect(resolution.unmappedCanonicalIds).toEqual([]);
  });
});
