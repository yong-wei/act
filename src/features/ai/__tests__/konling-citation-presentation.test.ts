import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AIMessageContent, sanitizeVerifiedCitationMarkdown } from '@/components/ai/ai-message-content';
import { KonlingCitationPanel, normalizeKonlingCitationPresentation } from '@/components/ai/konling-citation-presentation';

describe('Konling verified citation presentation', () => {
  it('suppresses model-authored footnotes without removing ordinary links', () => {
    const sanitized = sanitizeVerifiedCitationMarkdown(
      '时间常数表示响应速度。[1](#user-content-fn1)\n\n[^content]: 模型伪造的引用\n\n参见 [课程资料](/course-runtime/resources/unit.md)。',
    );

    expect(sanitized).toContain('时间常数表示响应速度。');
    expect(sanitized).toContain('[课程资料](/course-runtime/resources/unit.md)');
    expect(sanitized).not.toContain('[1]');
    expect(sanitized).not.toContain('user-content-fn');
    expect(sanitized).not.toContain('[^content]');

    const html = renderToStaticMarkup(
      React.createElement(AIMessageContent, { content: sanitized }),
    );
    expect(html).toContain('href="/course-runtime/resources/unit.md"');
    expect(html).not.toContain('href="#user-content-fn');
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
    expect(html).toContain('引用核验有限');
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
    expect(html).toContain('开发诊断：assistant-citations-unverified-stream');
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
});
