import { describe, expect, it, vi } from 'vitest';

import {
  applyKonlingCitationFallback,
  buildKonlingCitationGuard,
  mergeCandidateAssignedCitations,
  stripUnverifiedKonlingCitationMarkers,
  type KonlingRuntimeContext,
} from '@/lib/konling-agent-runtime';
import { assignKonlingCitationDisplayNumbers, buildKonlingCitationCanonicalKey } from '@/lib/konling-citation-protocol';

vi.mock('server-only', () => ({}));

// 非 study-question 的正式回答：citationContext 内 #1 可绑定（verified 且有
// 目标），#2 未核验。数字碰撞到 #2 的占位标记必须被收集并剥离（#1949）。
function createCitationContext(): KonlingRuntimeContext['citationContext'] {
  return {
    required: true,
    contentCitations: [
      {
        id: 'content:evidence:primary',
        sourceType: 'content',
        displayTitle: '闭环控制教材片段',
        href: '/course-runtime/resources/closed-loop.md',
        confidence: 'high',
        evidenceBasis: 'source-pack:konling-answer:test',
        owner: 'answer',
        citationTargetId: 'content:closed-loop',
        verified: true,
        resolver: 'course-runtime',
        displayNumber: 1,
      },
      {
        id: 'content:evidence:unverified',
        sourceType: 'content',
        displayTitle: '未验证材料',
        href: '/course-runtime/resources/unverified.md',
        confidence: 'medium',
        evidenceBasis: 'source-pack:konling-answer:test',
        owner: 'answer',
        displayNumber: 2,
      },
    ],
    evidenceCitations: [],
    missingCitationClasses: [],
    lowConfidenceReasons: [],
    responseProtocol: {
      requiredOwners: ['answer'],
      minimum: { content: 1, evidenceWhenAvailable: 0 },
      fallbackWhenMissing: 'low-confidence',
    },
  };
}

function guardFor(answer: string) {
  return buildKonlingCitationGuard({ citationContext: createCitationContext() }, answer);
}

describe('issue #1949 formal answer citation verification', () => {
  it('collects unverified markers without a study-question contract', () => {
    const guard = guardFor('闭环能抑制扰动 [1]，占位结论 [2]，越界引用 [9]。');

    expect(guard.studyQuestion).toBeNull();
    expect(guard.unverifiedCitationMarkers).toEqual([2, 9]);
  });

  it('strips unverified and unassigned markers outside study questions', () => {
    const answer = '闭环能抑制扰动 [1]，占位结论 [2]，越界引用 [9]。';
    const guard = guardFor(answer);
    const stripped = stripUnverifiedKonlingCitationMarkers(answer, guard);

    expect(stripped).toContain('[1]');
    expect(stripped).not.toContain('[2]');
    expect(stripped).not.toContain('[9]');
    expect(stripped).toContain('占位结论');
    expect(stripped).toContain('越界引用');
  });

  it('keeps technical index expressions intact while stripping', () => {
    const answer = [
      '离散序列 y[2] 与 values[9] 保持下标。',
      '代码 `values[2]` 与：',
      '```ts',
      '[2]',
      '```',
      '占位结论 [2]。',
    ].join('\n');
    const guard = guardFor(answer);
    const stripped = stripUnverifiedKonlingCitationMarkers(answer, guard);

    expect(guard.unverifiedCitationMarkers).toEqual([2]);
    expect(stripped).toContain('y[2]');
    expect(stripped).toContain('values[9]');
    expect(stripped).toContain('`values[2]`');
    expect(stripped).toContain('```ts\n[2]\n```');
    expect(stripped).not.toMatch(/占位结论 \[2\]/);
  });

  it('is a no-op when the answer carries no invalid markers', () => {
    const answer = '闭环能抑制扰动 [1]。';
    const guard = guardFor(answer);

    expect(guard.unverifiedCitationMarkers).toEqual([]);
    expect(stripUnverifiedKonlingCitationMarkers(answer, guard)).toBe(answer);
  });

  it('downgrades the guard when unverified markers are the only defect (#1949)', () => {
    const guard = guardFor('闭环能抑制扰动 [1]，占位结论 [2]，越界引用 [9]。');

    expect(guard.status).toBe('low-confidence');
    expect(guard.fallbackRequired).toBe(true);
    expect(guard.lowConfidenceReasons).toContain('assistant-unverified-citation-markers');
    expect(guard.missingCitationClasses).toEqual([]);
  });

  it('surfaces a safe notice when the sessions fallback strips unverified markers (#1949)', () => {
    const answer = '闭环能抑制扰动 [1]，占位结论 [2]，越界引用 [9]。';
    const guard = guardFor(answer);
    const delivered = applyKonlingCitationFallback(answer, guard);

    expect(delivered).toContain('[1]');
    expect(delivered).not.toContain('[2]');
    expect(delivered).not.toContain('[9]');
    expect(delivered).toContain('已移除 2 个未能核验的引用标记。');
    expect(delivered).toContain('证据限制');
  });

  it('keeps the sessions fallback unchanged without unverified markers (#1949)', () => {
    const guard = guardFor('闭环能抑制扰动 [1]。');
    const delivered = applyKonlingCitationFallback('闭环能抑制扰动 [1]。', guard);

    expect(delivered).toBe('闭环能抑制扰动 [1]。');
  });

  it('keeps textbook tool citations visible to the final guard so valid numbers survive stripping (#1949)', () => {
    const runtimeContext = { citationContext: createCitationContext() } as KonlingRuntimeContext;
    // 教材检索工具在回答期间分配的条目：只存在于 assigned 表，runtime
    // citationContext 中没有它；allocator 已把 citationContext 的 #1/#2
    // 计入编号空间，教材条目从 #3 开始。
    const identity = {
      kind: 'textbook',
      bookId: 'hu-shousong-auto-control-8th',
      edition: '第八版',
      sourceRevision: 'r1',
      unitId: 'chapter-3',
      fragmentId: null,
    } as const;
    const assigned = [{
      id: 'textbook-unit:hu8/chapter-3',
      sourceType: 'textbook',
      displayTitle: '胡寿松《自动控制原理》第三章',
      href: '/textbooks/hu-shousong-auto-control-8th/r1/chapter-3',
      verifiable: true,
      identity,
      displayNumber: 3,
      canonicalKey: buildKonlingCitationCanonicalKey(identity),
    }];
    const merged = mergeCandidateAssignedCitations(runtimeContext, assigned);

    expect(merged.citationContext.contentCitations).toHaveLength(3);
    // 投影条目在 runtime citation 分类里归一为 content，但保留教材身份
    // （id/citationTargetId/identity/canonicalKey）与原编号。
    const textbookCitation = merged.citationContext.contentCitations
      .find((citation) => citation.id === 'textbook-unit:hu8/chapter-3');
    expect(textbookCitation).toMatchObject({
      displayNumber: 3,
      citationTargetId: 'chapter-3',
      verified: true,
      href: '/textbooks/hu-shousong-auto-control-8th/r1/chapter-3',
    });

    const answer = '教材结论 [3]。';
    const guard = buildKonlingCitationGuard(merged, answer);
    expect(guard.unverifiedCitationMarkers).toEqual([]);
    expect(stripUnverifiedKonlingCitationMarkers(answer, guard)).toBe(answer);
  });

  it('does not duplicate runtime citations already present in the citation context (#1949)', () => {
    const runtimeContext = { citationContext: createCitationContext() } as KonlingRuntimeContext;
    // assigned 表与 citationContext 含相同 canonicalKey 的条目：不重复投影。
    const assigned = assignKonlingCitationDisplayNumbers([
      {
        id: 'content:evidence:primary',
        sourceType: 'content',
        displayTitle: '闭环控制教材片段',
        href: '/course-runtime/resources/closed-loop.md',
        identity: {
          kind: 'content',
          sourceType: 'content',
          contentId: 'content:closed-loop',
        },
      },
    ]);
    const merged = mergeCandidateAssignedCitations(runtimeContext, assigned);

    // fixture 的 #1（canonicalKey 等价）不被重复投影，#2 原样保留：
    // 投影只追加 assigned 表中新增的条目。
    expect(merged.citationContext.contentCitations).toHaveLength(2);
    expect(merged.citationContext.contentCitations.map((citation) => citation.displayNumber))
      .toEqual([1, 2]);
    expect(merged.citationContext.contentCitations[0]?.id).toBe('content:evidence:primary');
  });

  it('preserves display-number gaps left by removed textbook optimization candidates (#1949)', () => {
    const runtimeContext = { citationContext: createCitationContext() } as KonlingRuntimeContext;
    // 后台优化删除了较早分配的教材候选 #3：final 表仍有缺口，正文与
    // normalize 层都按原编号引用 [4]（allocator 编号空间：#1/#2 为
    // citationContext 条目，#3/#4 为工具追加的教材候选）。
    const keptIdentity = {
      kind: 'textbook',
      bookId: 'hu-shousong-auto-control-8th',
      edition: '第八版',
      sourceRevision: 'r1',
      unitId: 'chapter-5',
      fragmentId: null,
    } as const;
    const optimizedTable = [{
      id: 'textbook-unit:hu8/chapter-5',
      sourceType: 'textbook',
      displayTitle: '胡寿松《自动控制原理》第五章',
      href: '/textbooks/hu-shousong-auto-control-8th/r1/chapter-5',
      verifiable: true,
      identity: keptIdentity,
      displayNumber: 4,
      canonicalKey: buildKonlingCitationCanonicalKey(keptIdentity),
    }];

    const merged = mergeCandidateAssignedCitations(runtimeContext, optimizedTable);
    const projected = merged.citationContext.contentCitations
      .find((citation) => citation.id === 'textbook-unit:hu8/chapter-5');
    expect(projected?.displayNumber).toBe(4);

    const answer = '教材结论 [4]。';
    const guard = buildKonlingCitationGuard(merged, answer);
    expect(guard.unverifiedCitationMarkers).toEqual([]);
    expect(stripUnverifiedKonlingCitationMarkers(answer, guard)).toBe(answer);
  });
});
