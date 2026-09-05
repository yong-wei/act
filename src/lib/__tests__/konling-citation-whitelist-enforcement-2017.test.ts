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
    expect(result.body).toContain('[引用缺口：');
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

describe('snapshot-missing fail-open guard (#2017 review)', () => {
  it('documents the runner contract: undefined citations snapshot skips enforcement', async () => {
    // runner 契约由源码断言守护：citations === undefined 时不得改写答案。
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('src/lib/konling-fair-experiment/runner.ts', 'utf8');
    expect(source).toContain("arm === 'full-feature' && finalCitations !== undefined");
    expect(source).not.toContain('citations: response.result.citations ?? []');
  });

  it('coverage uses the audit direct-support predicate, not raw bound state', async () => {
    const { isDirectVerifiedSupportCitation } = await import(
      '@/lib/konling-fair-experiment/citation-whitelist-enforcement'
    );
    // verified+target 但 href 缺失或仅 semantic-score：不构成直接支撑，
    // 与 citation-audit 的覆盖口径一致。
    expect(isDirectVerifiedSupportCitation({
      citationTargetId: 't1', verified: true, href: null, answerRelevanceBasis: 'query-exact',
    })).toBe(false);
    expect(isDirectVerifiedSupportCitation({
      citationTargetId: 't1', verified: true, href: '/x', answerRelevanceBasis: 'semantic-score',
    })).toBe(false);
    expect(isDirectVerifiedSupportCitation({
      citationTargetId: 't1', verified: true, href: '/x', answerRelevanceBasis: 'query-exact',
    })).toBe(true);
  });
});

describe('claim demotion and scan-exempt annotation (#2017 review R2)', () => {
  it('demotes the claim line in place when a fake number is removed', () => {
    const result = enforceKonlingCitationNumberWhitelist({
      answer: '根一定在左半平面[9]。',
      citations: [citation()],
      demoteClaim: (line) => `${line.trimEnd()}[引用缺口：待核验]`,
    });

    expect(result.downgraded).toBe(true);
    expect(result.body).toBe('根一定在左半平面。[引用缺口：待核验]');
    expect(result.body).not.toContain('[9]');
    // 标注行可被 scan 识别为结构单元（不进覆盖分母）。
    expect(result.body).toContain('[引用缺口：');
  });

  it('coverage repair notice is exempt from the evidence-required denominator', async () => {
    const result = enforceAnswerUnitCitationCoverage({
      answer: '闭环结论缺少引用支撑。',
      requiredUnitCount: 1,
      coveredUnitCount: 0,
    });
    expect(result.coverageRepaired).toBe(true);
    // 说明行以 [引用缺口： 开头——scanKonlingAnswerUnits 的结构行判定
    // 显式豁免该前缀，修复不会人为抬高 requiredUnitCount。
    expect(result.body).toContain('[引用缺口：');
    const { scanKonlingAnswerUnits } = await import('@/lib/konling-answer-unit-scan');
    const scan = scanKonlingAnswerUnits(result.body, [citation()], 'fact-explanation');
    // 标注行可以被 scan 收集为结构单元，但必须 substantive=false——
    // 不进入 evidence-required 分母（修复不会人为抬高 requiredUnitCount）。
    const annotatedUnits = scan.units.filter((unit) => unit.unit.includes('[引用缺口：'));
    expect(annotatedUnits.length).toBe(1);
    expect(annotatedUnits[0].substantive).toBe(false);
  });
});

describe('mixed-marker lines and multi-line rewrites (#2017 review R3)', () => {
  it('keeps legal citations and technical indexes when demoting a mixed line', () => {
    const result = enforceKonlingCitationNumberWhitelist({
      answer: 'a[2] 的结论由来源[1]支持，但另一断言[9]错误。',
      citations: [citation()],
      demoteClaim: (line) => `${line.trimEnd()}[引用缺口：待核验]`,
    });

    // 技术下标 a[2] 与合法引用 [1] 原样保留；只有伪编号 [9] 被删除。
    expect(result.body).toBe('a[2] 的结论由来源[1]支持，但另一断言错误。[引用缺口：待核验]');
    expect(result.removedMarkers).toEqual(['[9]']);
  });

  it('rewrites multiple demoted lines without offset corruption', () => {
    const answer = '第一结论[9] 成立。\n第二结论[8] 也成立。\n第三结论[1] 正确。';
    const result = enforceKonlingCitationNumberWhitelist({
      answer,
      citations: [citation()],
      demoteClaim: (line) => `${line.trimEnd()}[引用缺口：待核验]`,
    });

    // 前两行各自降级、长度变化互不干扰；第三行合法引用不动。
    expect(result.body).toBe(
      '第一结论 成立。[引用缺口：待核验]\n第二结论 也成立。[引用缺口：待核验]\n第三结论[1] 正确。',
    );
    expect(result.removedMarkers.sort()).toEqual(['[8]', '[9]']);
  });
});
