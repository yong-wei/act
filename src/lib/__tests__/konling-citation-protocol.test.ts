import { describe, expect, it, vi } from 'vitest';

import {
  assignKonlingCitationDisplayNumbers,
  buildKonlingCitationCanonicalKey,
  type KonlingAssignableCitation,
} from '@/lib/konling-citation-protocol';
import {
  normalizeAndRepairKonlingCitations,
  normalizeKonlingCitations,
} from '@/lib/konling-citation-repair';

const sources: KonlingAssignableCitation[] = [
  {
    id: 'textbook-unit:one',
    sourceType: 'textbook',
    displayTitle: '单位阶跃响应',
    href: '/textbooks/book-a/e8/chapter-3',
    identity: {
      kind: 'textbook',
      bookId: 'book-a',
      edition: 'e8',
      sourceRevision: 'e8',
      unitId: 'unit-1',
      fragmentId: null,
    },
  },
  {
    id: 'evidence:state-1',
    sourceType: 'learner-state',
    displayTitle: '本次学习证据',
    href: null,
    identity: {
      kind: 'evidence',
      sourceType: 'learner-state',
      evidenceId: 'state-1',
      timeSemantic: '2026-07-26T00:00:00Z',
    },
  },
];

const serverContext = {
  role: 'student',
  topic: '单位阶跃响应',
  courseTitle: '自动控制原理',
} as const;

describe('Konling citation protocol', () => {
  it('deduplicates typed identities and assigns one immutable sequence', () => {
    const assigned = assignKonlingCitationDisplayNumbers([
      sources[0],
      { ...sources[0], id: 'window-duplicate' },
      sources[1],
    ]);

    expect(assigned.map((item) => [item.sourceType, item.displayNumber])).toEqual([
      ['textbook', 1],
      ['learner-state', 2],
    ]);
    expect(Object.isFrozen(assigned[0])).toBe(true);
    expect(buildKonlingCitationCanonicalKey(sources[0].identity)).toContain('book-a:e8:e8:unit-1:unit');
  });

  it('keeps retrieval windows out of textbook identity', () => {
    const identity = sources[0].identity;
    if (identity.kind !== 'textbook') throw new Error('fixture must be a textbook identity');
    expect(buildKonlingCitationCanonicalKey(identity)).toBe(
      buildKonlingCitationCanonicalKey({ ...identity, fragmentId: null }),
    );
  });

  it('keeps textbook revisions distinct even when book, edition, and unit are unchanged', () => {
    const base = sources[0];
    if (base.identity.kind !== 'textbook') throw new Error('fixture must be a textbook identity');
    const assigned = assignKonlingCitationDisplayNumbers([
      base,
      {
        ...base,
        id: 'textbook-unit:one:new-revision',
        identity: {
          ...base.identity,
          sourceRevision: 'e8-revision-2',
        },
      },
    ]);

    expect(assigned).toHaveLength(2);
    expect(assigned.map((citation) => citation.displayNumber)).toEqual([1, 2]);
    expect(assigned[0]?.canonicalKey).not.toBe(assigned[1]?.canonicalKey);
  });

  it('normalizes assigned numbers, complete ids, and unique titles without a model call', async () => {
    const assigned = assignKonlingCitationDisplayNumbers(sources);
    const repair = vi.fn();
    const result = await normalizeAndRepairKonlingCitations({
      answer: '编号 [1]，ID [content: textbook-unit:one]，标题 [引用: 本次学习证据]。',
      assignedCitations: assigned,
      originalQuestion: '解释单位阶跃响应',
      serverContext,
      repair,
    });

    expect(result.body).toBe('编号 [1]，ID [1]，标题 [2]。');
    expect(result.citations.map((item) => item.displayNumber)).toEqual([1, 2]);
    expect(repair).not.toHaveBeenCalled();
  });

  it('uses exactly one mapping-only repair for multiple unknown markers', async () => {
    const assigned = assignKonlingCitationDisplayNumbers(sources);
    const repair = vi.fn(async (request) => {
      expect(Object.isFrozen(request)).toBe(true);
      expect(Object.isFrozen(request.serverContext)).toBe(true);
      expect(Object.isFrozen(request.assignedCitations)).toBe(true);
      expect(Object.isFrozen(request.assignedCitations[0])).toBe(true);
      expect(Object.isFrozen(request.unresolvedMarkers)).toBe(true);
      expect(request.serverContext).toEqual(serverContext);
      expect(Object.keys(request.serverContext).sort()).toEqual([
        'courseTitle',
        'role',
        'topic',
      ]);
      expect(request.originalQuestion).toBe('问题');
      expect(request.originalAnswer).toContain('[引用: A]');
      const serialized = JSON.stringify(request);
      for (const forbidden of [
        '"id"',
        'canonicalKey',
        '"href"',
        '"owner"',
        '"document"',
        '"window"',
        '"path"',
        '"identity"',
        'textbook-unit:one',
        '/textbooks/',
        'student-1',
        '张三',
        'mastery',
        'risk',
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
      expect(request.assignedCitations).toEqual([
        {
          displayNumber: 1,
          sourceType: 'textbook',
          displayTitle: '单位阶跃响应',
        },
        {
          displayNumber: 2,
          sourceType: 'learner-state',
          displayTitle: '本次学习证据',
        },
      ]);
      return [
        { marker: '[引用: A]', displayNumber: 1 },
        { marker: '[引用: B]', displayNumber: 2 },
        { marker: '[引用: C]', displayNumber: 99 },
      ];
    });
    const result = await normalizeAndRepairKonlingCitations({
      answer: '教材结论 [引用: A]，个性化判断 [引用: B]，额外说法 [引用: C]。',
      assignedCitations: assigned,
      originalQuestion: '问题',
      serverContext,
      repair,
    });

    expect(repair).toHaveBeenCalledTimes(1);
    expect(result.repairCalls).toBe(1);
    expect(result.body).toBe('教材结论 [1]，个性化判断 [2]，额外说法 。');
    expect(result.userNotice).toBe('部分引用未能核验');
  });

  it('keeps learner-private prose and internal payloads out of mapping repair', async () => {
    const repair = vi.fn(async (request) => {
      const serialized = JSON.stringify(request);
      expect(request.originalQuestion).toContain('解释单位阶跃响应');
      expect(request.originalAnswer).toContain('阻尼比与超调量关系见');
      for (const forbidden of [
        '张三',
        'student-1',
        'mastery',
        'risk',
        '学习记录',
        '你对阻尼比与超调量的关系仍有混淆',
        'https://private.example',
        'textbook-unit:hu8/private',
        '/Users/a/private.json',
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
      expect(request.unresolvedMarkers).toEqual(['[引用: PRIVATE]']);
      return [];
    });
    await normalizeAndRepairKonlingCitations({
      answer: [
        '阻尼比与超调量关系见 [引用: PRIVATE]。',
        '你对阻尼比与超调量的关系仍有混淆 [引用: PRIVATE]。',
        '张三 student-1 的 mastery=0.2、risk=high、学习记录见 https://private.example [引用: PRIVATE]。',
        '内部载荷 textbook-unit:hu8/private /Users/a/private.json',
      ].join('\n'),
      assignedCitations: assignKonlingCitationDisplayNumbers(sources),
      originalQuestion: '解释阻尼比与超调量的关系。你对该知识仍有混淆。张三 student-1 的学习记录与 risk 如何？',
      serverContext,
      privateValues: ['张三', 'student-1'],
      repair,
    });

    expect(repair).toHaveBeenCalledTimes(1);
  });

  it('preserves bracketed technical expressions that are not citation ids', () => {
    const result = normalizeKonlingCitations({
      answer: [
        '离散序列 y[0]，数组切片 x[0:10]，参数写作 [PID: Kp=1]。',
        '代码 `values[2]` 与：',
        '```ts',
        '[1]',
        '```',
        '教材依据[1]，完整 ID [textbook-unit:one]。',
      ].join('\n'),
      assignedCitations: assignKonlingCitationDisplayNumbers(sources),
    });

    expect(result.body).toContain('y[0]');
    expect(result.body).toContain('x[0:10]');
    expect(result.body).toContain('[PID: Kp=1]');
    expect(result.body).toContain('`values[2]`');
    expect(result.body).toContain('```ts\n[1]\n```');
    expect(result.body).toContain('教材依据[1]，完整 ID [1]');
    expect(result.unresolvedMarkers).toEqual([]);
  });

  it('removes unknown markers, malicious URLs, and internal paths while preserving prose', () => {
    const result = normalizeKonlingCitations({
      answer: [
        '可读正文 [99] [证据: forged] [伪造链接](javascript:alert)',
        '裸地址 https://private.example/unit',
        'canonicalKey=textbook:book:e8:revision:unit-1:fragment-1',
        'bookId=hu-shousong-auto-control-8th edition=第八版',
        'sourceRevision=revision-secret unitId=textbook-unit:hu8/direct identity={"kind":"textbook"}',
        'fragmentId=formula-3.2-1 structuralPath=["chapter-3","section-3.2"]',
        'dorf-modern-control-systems chapter-3 section-3.2 /Users/a/private.json',
      ].join(' '),
      assignedCitations: assignKonlingCitationDisplayNumbers(sources),
    });
    expect(result.body).toContain('可读正文');
    expect(result.body).toContain('伪造链接');
    expect(result.body).not.toContain('[99]');
    expect(result.body).not.toContain('forged');
    expect(result.body).not.toContain('javascript:');
    expect(result.body).not.toContain('https://');
    expect(result.body).not.toContain('canonicalKey');
    expect(result.body).not.toContain('sourceRevision');
    expect(result.body).not.toContain('bookId');
    expect(result.body).not.toContain('edition');
    expect(result.body).not.toContain('unitId');
    expect(result.body).not.toContain('fragmentId');
    expect(result.body).not.toContain('structuralPath');
    expect(result.body).not.toContain('identity');
    expect(result.body).not.toContain('textbook-unit:');
    expect(result.body).not.toContain('dorf-modern-control-systems');
    expect(result.body).not.toContain('chapter-3');
    expect(result.body).not.toContain('section-3.2');
    expect(result.body).not.toContain('/Users/');
    expect(result.userNotice).toBe('引用未能核验');
  });
});
