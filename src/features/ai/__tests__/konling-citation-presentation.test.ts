import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AIMessageContent, sanitizeVerifiedCitationMarkdown } from '@/components/ai/ai-message-content';
import { KonlingCitationPanel, normalizeKonlingCitationPresentation } from '@/components/ai/konling-citation-presentation';

describe('Konling verified citation presentation', () => {
  it('suppresses every model-authored link and internal textbook identity', () => {
    const sanitized = sanitizeVerifiedCitationMarkdown(
      [
        '时间常数表示响应速度。[1](#user-content-fn1)',
        '[^content]: 模型伪造的引用',
        '参见 [课程资料](/course-runtime/resources/unit.md)。',
        '裸地址 https://private.example/unit canonicalKey=textbook:book:e8:rev:unit:fragment',
        'bookId=hu-shousong-auto-control-8th edition=第八版 identity={"kind":"textbook"}',
        'unitId=textbook-unit:hu8/direct fragmentId=formula-1 sourceRevision=secret structuralPath=["chapter-3","section-3.2"]',
        'dorf-modern-control-systems chapter-3 section-3.2',
      ].join('\n\n'),
    );

    expect(sanitized).toContain('时间常数表示响应速度。');
    expect(sanitized).toContain('参见 课程资料。');
    expect(sanitized).not.toContain('[1]');
    expect(sanitized).not.toContain('user-content-fn');
    expect(sanitized).not.toContain('[^content]');
    expect(sanitized).not.toContain('https://');
    expect(sanitized).not.toContain('canonicalKey');
    expect(sanitized).not.toContain('bookId');
    expect(sanitized).not.toContain('edition');
    expect(sanitized).not.toContain('identity');
    expect(sanitized).not.toContain('textbook-unit:');
    expect(sanitized).not.toContain('fragmentId');
    expect(sanitized).not.toContain('sourceRevision');
    expect(sanitized).not.toContain('structuralPath');
    expect(sanitized).not.toContain('dorf-modern-control-systems');
    expect(sanitized).not.toContain('chapter-3');
    expect(sanitized).not.toContain('section-3.2');

    const html = renderToStaticMarkup(
      React.createElement(AIMessageContent, { content: sanitized }),
    );
    expect(html).not.toContain('href=');
    expect(sanitizeVerifiedCitationMarkdown('关键变形 [证据: content:formula:derivation]')).toBe('关键变形');
  });

  it('renders final verified citations from server-owned metadata', () => {
    const presentation = normalizeKonlingCitationPresentation({
      konlingCitationGuard: {
        status: 'verified',
        citations: [{
          id: 'content:citation-target:time-constant',
          sourceType: 'content',
          displayTitle: '时间常数教材片段',
          href: '/course-runtime/resources/textbooks/control/ch02.md#time-constant',
          confidence: 'high',
          evidenceBasis: 'source-pack',
        }],
      },
    }) as any;

    expect(presentation.summary.status).toBe('verified');
    expect(presentation.items[0]).toMatchObject({
      key: 'content:content:citation-target:time-constant',
      displayIndex: 1,
      title: '时间常数教材片段',
      sourceType: 'content',
      href: '/course-runtime/resources/textbooks/control/ch02.md#time-constant',
      confidence: 'high',
      limitation: null,
      evidenceBasis: 'source-pack',
    });

    const html = renderToStaticMarkup(
      React.createElement(KonlingCitationPanel, {
        metadata: {
          konlingCitationGuard: {
            status: 'verified',
            citations: [{
              id: 'content:citation-target:time-constant',
              sourceType: 'content',
              displayTitle: '时间常数教材片段',
              href: '/course-runtime/resources/textbooks/control/ch02.md#time-constant',
              confidence: 'high',
              evidenceBasis: 'source-pack',
            }],
          },
        },
      }),
    );

    expect(html).toContain('data-konling-citation-panel');
    expect(html).toContain('data-konling-citation-status="verified"');
    expect(html).toContain('已验证引用');
    expect(html).toContain('时间常数教材片段');
    expect(html).toContain('data-citation-target="/course-runtime/resources/textbooks/control/ch02.md#time-constant"');
    expect(html).not.toContain('user-content-fn');
  });

  it('uses rendered textbook display hrefs without discarding canonical citation metadata', () => {
    const textbookHref = '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-2/section-2.1#figure-02-01';
    const presentation = normalizeKonlingCitationPresentation({
      konlingCitationGuard: {
        status: 'verified',
        citations: [{
          id: 'content:textbook:fig-02-01',
          sourceType: 'content',
          displayTitle: 'Root locus figure',
          href: textbookHref,
          canonicalHref: textbookHref,
          displayHref: textbookHref,
          confidence: 'high',
          evidenceBasis: 'source-pack:konling-answer:pack-1',
          citationTargetId: 'textbook:fig-02-01',
          retrievalChunkId: 'textbook-search:ch02-sec01',
          answerRelevanceBasis: 'query-match',
          answerRelevanceQueryHash: 'hash-1',
          citationChip: {
            chunkId: 'content:textbook:fig-02-01',
            displayTitle: 'Root locus figure',
            displayHref: textbookHref,
            sourceType: 'course-content',
            addressKind: 'image',
            citationAddress: {
              kind: 'image',
              sourceRefId: 'textbook:fig-02-01',
              href: textbookHref,
              locator: 'fig-02-01',
              contentHash: 'sha256:abc',
            },
            authorityLevel: 'canonical',
            confidence: 'high',
            freshnessBucket: 'current',
            privacyVisibility: 'public',
            limitationState: null,
          },
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
      },
    });

    expect(presentation.summary.status).toBe('verified');
    expect(presentation.items[0]?.href).toBe(textbookHref);
    expect(presentation.items[0]?.confidence).toBe('high');
  });

  it('shows limited and unavailable citation states without fake navigation', () => {
    const presentation = normalizeKonlingCitationPresentation({
      konlingCitationGuard: {
        status: 'low-confidence',
        citations: [
          {
            sourceType: 'learner-state',
            displayTitle: '受限学习证据',
            href: '/knowledge#user-content-fn1',
            confidence: 'low',
            evidenceBasis: 'citation-chip',
            citationChip: { limitationState: 'insufficient-authority' },
          },
          {
            sourceType: 'content',
            displayTitle: '无地址资料',
            href: null,
            confidence: 'medium',
            evidenceBasis: 'source-pack',
          },
        ],
      },
    }) as any;

    expect(presentation.items[0]).toMatchObject({
      href: null,
      limitation: 'insufficient-authority',
    });
    expect(presentation.items[1]).toMatchObject({
      href: null,
      limitation: 'unavailable-address',
    });

    const html = renderToStaticMarkup(React.createElement(KonlingCitationPanel, {
      metadata: { konlingCitationGuard: { citations: presentation.items } },
    }));
    expect(html).toContain('data-citation-limited="insufficient-authority"');
    expect(html).toContain('data-citation-limited="unavailable-address"');
    expect(html).not.toContain('/knowledge#user-content-fn1');
  });

  it('keeps verified content citations clickable when personalization is limited', () => {
    const html = renderToStaticMarkup(
      React.createElement(KonlingCitationPanel, {
        metadata: {
          konlingCitationGuard: {
            status: 'low-confidence',
            missingCitationClasses: ['learner-state'],
            personalizationAvailability: {
              status: 'limited',
              missingCitationClasses: ['learner-state'],
              lowConfidenceReasons: ['missing-context:learner-state-summary'],
            },
            citations: [
              {
                id: 'content:citation-target:time-constant',
                sourceType: 'content',
                displayTitle: '高置信课程来源',
                href: '/course-runtime/resources/textbooks/control/ch02.md#time-constant',
                confidence: 'high',
                evidenceBasis: 'source-pack',
              },
              {
                id: 'learner-state:student-1:cold-start',
                sourceType: 'learner-state',
                displayTitle: '缺失学习画像',
                href: null,
                confidence: 'low',
                evidenceBasis: 'ColdStartAdaptiveLearnerStateFallback',
              },
            ],
          },
        },
      }),
    );

    expect(html).toContain('data-konling-citation-status="limited"');
    expect(html).toContain('部分引用未能核验');
    expect(html).not.toContain('已验证引用');
    expect(html).toContain('data-citation-target="/course-runtime/resources/textbooks/control/ch02.md#time-constant"');
    expect(html).toContain('data-citation-limited="unavailable-address"');
  });

  it('keeps streaming diagnostics separate from final citation state', () => {
    const html = renderToStaticMarkup(
      React.createElement(KonlingCitationPanel, {
        metadata: {
          konlingCitationGuard: {
            status: 'verified',
            diagnosticReasons: ['assistant-citations-unverified-stream'],
            citations: [{
              sourceType: 'content',
              displayTitle: '流式预检来源',
              href: '/course-runtime/resources/textbooks/control/ch02.md#time-constant',
              confidence: 'high',
              evidenceBasis: 'source-pack',
            }],
          },
        },
      }),
    );

    expect(html).toContain('data-konling-citation-status="verified"');
    expect(html).toContain('已验证引用');
    expect(html).toContain('data-citation-target="/course-runtime/resources/textbooks/control/ch02.md#time-constant"');
    expect(html).toContain('data-konling-citation-diagnostics');
    expect(html).toContain('开发模式诊断：assistant-citations-unverified-stream');
  });

  it('deduplicates citations by governed identity without merging source types by title', () => {
    const presentation = normalizeKonlingCitationPresentation({
      konlingCitationGuard: {
        status: 'verified',
        citations: [
          {
            id: 'path-execution:path-a:node-1:completed:2026-07-01',
            sourceType: 'path-execution',
            displayTitle: '根轨迹路径节点',
            href: '/adaptive/path-center?path=path-a#node-1',
            confidence: 'medium',
            evidenceBasis: 'path-execution:path-a',
          },
          {
            id: 'path-execution:path-a:node-1:completed:2026-07-01',
            sourceType: 'path-execution',
            displayTitle: '根轨迹路径节点',
            href: '/adaptive/path-center?path=path-a#node-1',
            confidence: 'medium',
            evidenceBasis: 'path-execution:path-a',
          },
          {
            id: 'content:citation-target:node-1',
            sourceType: 'content',
            displayTitle: '根轨迹路径节点',
            href: '/course-runtime/resources/unit.md#node-1',
            confidence: 'high',
            evidenceBasis: 'source-pack',
          },
        ],
      },
    }) as any;

    expect(presentation.items).toHaveLength(2);
    expect(presentation.items.map((item: any) => item.displayIndex)).toEqual([1, 2]);
    expect(presentation.items.map((item: any) => item.sourceType)).toEqual(['path-execution', 'content']);
  });

  it('renders server-assigned display numbers without client reordering', () => {
    const presentation = normalizeKonlingCitationPresentation({
      konlingCitationGuard: {
        status: 'verified',
        citations: [
          {
            id: 'evidence-second',
            canonicalKey: 'learner-state:evidence-second:stable',
            displayNumber: 8,
            sourceType: 'learner-state',
            displayTitle: '学习证据',
            confidence: 'medium',
            evidenceBasis: 'server-owned',
          },
          {
            id: 'content-first',
            canonicalKey: 'content:content-first:current',
            displayNumber: 3,
            sourceType: 'content',
            displayTitle: '教材内容',
            confidence: 'high',
            evidenceBasis: 'server-owned',
          },
        ],
      },
    });

    expect(presentation.items.map((item) => item.displayIndex)).toEqual([8, 3]);
  });

  it('does not collapse legacy retrieval sources without stable ids into unknown keys', () => {
    const presentation = normalizeKonlingCitationPresentation({
      konlingCitationGuard: {
        status: 'verified',
        retrievalSources: [
          {
            sourceType: 'content',
            displayTitle: '第一段教材引用',
            href: '/course-runtime/resources/unit.md#first',
            confidence: 'high',
            evidenceBasis: 'legacy-retrieval-source',
          },
          {
            sourceType: 'content',
            displayTitle: '第二段教材引用',
            href: '/course-runtime/resources/unit.md#second',
            confidence: 'medium',
            evidenceBasis: 'legacy-retrieval-source',
          },
          {
            sourceType: 'content',
            displayTitle: '无地址教材引用',
            href: null,
            confidence: 'medium',
            evidenceBasis: 'legacy-retrieval-source',
          },
        ],
      },
    }) as any;

    expect(presentation.items).toHaveLength(3);
    expect(presentation.items.map((item: any) => item.key)).toEqual([
      'content:/course-runtime/resources/unit.md#first',
      'content:/course-runtime/resources/unit.md#second',
      'content:无地址教材引用:legacy-retrieval-source',
    ]);
  });

  it('deduplicates source-pack entries by governed citation target before item id', () => {
    const presentation = normalizeKonlingCitationPresentation({
      konlingCitationGuard: {
        status: 'verified',
        citations: [
          {
            id: 'source-pack-item-a',
            citationTargetId: 'citation-target:time-constant',
            sourceType: 'content',
            displayTitle: '时间常数教材片段',
            href: '/course-runtime/resources/textbooks/control/ch02.md#time-constant',
            confidence: 'high',
            evidenceBasis: 'source-pack',
          },
          {
            id: 'source-pack-item-b',
            citationTargetId: 'citation-target:time-constant',
            sourceType: 'content',
            displayTitle: '时间常数教材片段',
            href: '/course-runtime/resources/textbooks/control/ch02.md#time-constant',
            confidence: 'high',
            evidenceBasis: 'source-pack',
          },
        ],
      },
    }) as any;

    expect(presentation.items).toHaveLength(1);
    expect(presentation.items[0]).toMatchObject({
      key: 'content:citation-target:time-constant',
      displayIndex: 1,
    });
  });

  it('uses CitationChip display metadata when top-level citation fields are missing', () => {
    const presentation = normalizeKonlingCitationPresentation({
      konlingCitationGuard: {
        status: 'verified',
        citations: [{
          sourceType: 'content',
          citationChip: {
            displayTitle: 'CitationChip 教材片段',
            displayHref: '/course-runtime/resources/textbooks/control/ch02.md#chip',
            confidence: 'high',
          },
          evidenceBasis: 'citation-chip',
        }],
      },
    }) as any;

    expect(presentation.items[0]).toMatchObject({
      title: 'CitationChip 教材片段',
      href: '/course-runtime/resources/textbooks/control/ch02.md#chip',
      confidence: 'high',
      limitation: null,
    });
  });

  it('chooses source-type governed identity before cross-type fallbacks', () => {
    const presentation = normalizeKonlingCitationPresentation({
      konlingCitationGuard: {
        status: 'verified',
        citations: [
          {
            sourceType: 'knowledge-node',
            knowledgeNodeId: 'kn:node-a',
            resourceNodeId: 'resource-node:shared',
            displayTitle: '知识节点 A',
            href: '/knowledge?node=kn%3Anode-a',
            confidence: 'high',
            evidenceBasis: 'knowledge-node',
          },
          {
            sourceType: 'knowledge-node',
            knowledgeNodeId: 'kn:node-b',
            resourceNodeId: 'resource-node:shared',
            displayTitle: '知识节点 B',
            href: '/knowledge?node=kn%3Anode-b',
            confidence: 'high',
            evidenceBasis: 'knowledge-node',
          },
        ],
      },
    }) as any;

    expect(presentation.items).toHaveLength(2);
    expect(presentation.items.map((item: any) => item.key)).toEqual([
      'knowledge-node:kn:node-a',
      'knowledge-node:kn:node-b',
    ]);
  });

  it('renders a missing verified citation state separately from diagnostics', () => {
    const html = renderToStaticMarkup(
      React.createElement(KonlingCitationPanel, {
        metadata: {
          konlingCitationGuard: {
            status: 'low-confidence',
            citations: [],
            missingCitationClasses: ['content'],
            diagnosticReasons: ['streaming-guard'],
          },
        },
      }),
    );

    expect(html).toContain('data-konling-citation-missing');
    expect(html).toContain('data-konling-citation-status="missing"');
    expect(html).toContain('content');
    expect(html).not.toContain('href=');
  });

  it('renders the study-question contract and material answer evidence bindings from server metadata', () => {
    const html = renderToStaticMarkup(
      React.createElement(KonlingCitationPanel, {
        metadata: {
          konlingCitationGuard: {
            status: 'low-confidence',
            lowConfidenceReasons: ['normative-guidance-verification-required'],
            studyQuestion: {
              intent: 'normative-content',
              requiredSections: ['适用范围', '规范结论', '核验来源'],
              normativeGuidance: 'verification-required',
            },
            citations: [{
              id: 'content:formula:derivation',
              citationTargetId: 'formula:derivation',
              sourceType: 'content',
              displayTitle: '闭环传递函数教材片段',
              href: '/course-runtime/resources/control.md#closed-loop',
              confidence: 'high',
              evidenceBasis: 'source-pack',
            }],
            answerUnits: [{
              unit: '关键变形：分母为 1 + G(s)H(s)',
              citationId: 'content:formula:derivation',
              citationTargetId: 'formula:derivation',
              limitation: null,
              sectionId: 'transform',
              sectionTitle: '关键变形',
            }, {
              unit: '伪造来源',
              citationId: 'content:unknown',
              citationTargetId: 'unknown',
              limitation: null,
            }],
            answerUnitCoverage: {
              intent: 'normative-content',
              sections: [{
                sectionId: 'rule',
                sectionTitle: '规范结论',
                citationPolicy: 'evidence-required',
                covered: false,
              }, {
                sectionId: 'source',
                sectionTitle: '核验来源',
                citationPolicy: 'evidence-required',
                covered: false,
              }],
              coveredCount: 0,
              requiredCount: 2,
              ratio: 0,
            },
          },
        },
      }),
    );

    expect(html).toContain('data-konling-study-question-contract');
    expect(html).toContain('规范内容需核验');
    expect(html).toContain('data-konling-answer-unit-bindings');
    expect(html).toContain('「关键变形」');
    expect(html).toContain('关键变形：分母为 1 + G(s)H(s)');
    expect(html).toContain('闭环传递函数教材片段');
    expect(html).not.toContain('data-konling-derived-sections');
    expect(html).not.toContain('伪造来源');
  });

  it('labels model-derived sections so derivation content is not presented as source text', () => {
    const html = renderToStaticMarkup(
      React.createElement(KonlingCitationPanel, {
        metadata: {
          konlingCitationGuard: {
            status: 'verified',
            studyQuestion: {
              intent: 'formula-derivation',
              requiredSections: ['前提与符号', '关键变形', '适用条件', '结果校验'],
            },
            citations: [{
              id: 'content:formula:derivation',
              citationTargetId: 'formula:derivation',
              sourceType: 'content',
              displayTitle: '闭环传递函数教材片段',
              href: '/course-runtime/resources/control.md#closed-loop',
              confidence: 'high',
              evidenceBasis: 'source-pack',
            }],
            answerUnits: [{
              unit: 'G(s) 为前向通道',
              citationId: 'content:formula:derivation',
              citationTargetId: 'formula:derivation',
              limitation: null,
              sectionId: 'assumptions',
              sectionTitle: '前提与符号',
            }],
            answerUnitCoverage: {
              intent: 'formula-derivation',
              sections: [{
                sectionId: 'assumptions',
                sectionTitle: '前提与符号',
                citationPolicy: 'evidence-required',
                covered: true,
              }, {
                sectionId: 'transform',
                sectionTitle: '关键变形',
                citationPolicy: 'model-derived',
                covered: false,
              }],
              coveredCount: 1,
              requiredCount: 1,
              ratio: 1,
            },
            derivedSectionIds: ['transform'],
          },
        },
      }),
    );

    expect(html).toContain('data-konling-derived-sections');
    expect(html).toContain('模型推导章节：关键变形');
    expect(html).toContain('非来源原文');
  });
});
