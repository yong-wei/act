import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  enforceKonlingCitationNumberWhitelist,
  enforceAnswerUnitCitationCoverage,
} from '@/lib/konling-fair-experiment/citation-whitelist-enforcement';

function citation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cit-1',
    citationTargetId: 'target-1',
    verified: true,
    displayNumber: 1,
    sourceType: 'course-content',
    href: '/course/unit-1',
    answerRelevanceBasis: 'query-exact',
    ...overrides,
  };
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

describe('enforceKonlingCitationNumberWhitelist (#2017)', () => {
  it('keeps assigned numbers and removes unassigned fake numbers deterministically', () => {
    const answer = '闭环结论[1] 正确。开环结论[2] 待核验。采样结论[3] 同样待核验。';
    const result = enforceKonlingCitationNumberWhitelist({
      answer,
      citations: [citation()],
    });

    // 唯一分配编号 [1] 保留；[2][3] 为未分配伪编号，删除标记并降级。
    expect(result.body).toBe('闭环结论[1] 正确。开环结论 待核验。采样结论 同样待核验。');
    expect(result.removedMarkers.sort()).toEqual(['[2]', '[3]']);
    expect(result.demotedClaimCount).toBe(2);
    expect(result.downgraded).toBe(true);
  });

  it('does not touch technical indexes or code blocks', () => {
    const answer = '矩阵下标 a[2] 是技术索引。\n```\narr[3]\n```';
    const result = enforceKonlingCitationNumberWhitelist({
      answer,
      citations: [citation()],
    });

    expect(result.body).toBe(answer);
    expect(result.removedMarkers).toEqual([]);
    expect(result.downgraded).toBe(false);
  });

  it('deletes duplicate markers of the same number but keeps first, without fabricating coverage', () => {
    const answer = '主张一[1] 与主张二[1] 都引用同一来源。';
    const result = enforceKonlingCitationNumberWhitelist({
      answer,
      citations: [citation()],
    });

    // 重复编号保留合法标记：审计按唯一编号口径计数，重复不是伪编号。
    expect(result.body).toBe(answer);
    expect(result.removedMarkers).toEqual([]);
    expect(result.downgraded).toBe(false);
  });

  it('returns verification hash of the enforced body', () => {
    const answer = '开环结论[1]。';
    const result = enforceKonlingCitationNumberWhitelist({
      answer,
      citations: [citation()],
    });

    expect(result.bodyHash).toBe(sha256('开环结论[1]。'));
  });
});

describe('enforceAnswerUnitCitationCoverage (#2017)', () => {
  it('appends the bounded repair notice when evidence-required claims lack citations', () => {
    const answer = [
      '## 概念界定',
      '',
      '闭环系统的传递函数由误差定义推导而来。',
      '',
      '## 推导要点',
      '',
      '特征方程 1+G(s)H(s)=0 的根决定稳定性。',
    ].join('\n');
    const result = enforceAnswerUnitCitationCoverage({
      answer,
      requiredUnitCount: 2,
      coveredUnitCount: 0,
    });

    expect(result.coverageRepaired).toBe(true);
    expect(result.body).toContain('证据缺口');
    expect(result.body).toContain('待核验');
  });

  it('leaves the answer unchanged when coverage already satisfies the policy', () => {
    const answer = '完整且已覆盖引用的回答。';
    const result = enforceAnswerUnitCitationCoverage({
      answer,
      requiredUnitCount: 2,
      coveredUnitCount: 2,
    });

    expect(result.coverageRepaired).toBe(false);
    expect(result.body).toBe(answer);
  });

  it('does not upgrade unverified sources into verified authority for normative answers', () => {
    const result = enforceAnswerUnitCitationCoverage({
      answer: '按 GB/T 规范应这样验收。',
      requiredUnitCount: 1,
      coveredUnitCount: 0,
      normativeGuidance: 'verification-required',
    });

    // 规范类回答的修复只声明证据缺口：缺失的引用不构成核验，
    // 不得把非权威来源升级为已核验结论。
    expect(result.coverageRepaired).toBe(true);
    expect(result.body).toContain('待核验');
    expect(result.body).toContain('不构成核验');
  });
});
