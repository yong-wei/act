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
    const html = renderToStaticMarkup(
      React.createElement(KonlingCitationPanel, {
        metadata: {
          konlingCitationGuard: {
            status: 'verified',
            citations: [{
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
    });

    expect(presentation.citations[0]).toMatchObject({
      href: null,
      limitationState: 'insufficient-authority',
    });
    expect(presentation.citations[1]).toMatchObject({
      href: null,
      limitationState: 'guard-low-confidence',
    });

    const html = renderToStaticMarkup(React.createElement(KonlingCitationPanel, {
      metadata: { konlingCitationGuard: { citations: presentation.citations } },
    }));
    expect(html).toContain('data-citation-limited="insufficient-authority"');
    expect(html).not.toContain('/knowledge#user-content-fn1');
  });

  it('disables clicks when the whole guard is low confidence', () => {
    const html = renderToStaticMarkup(
      React.createElement(KonlingCitationPanel, {
        metadata: {
          konlingCitationGuard: {
            status: 'low-confidence',
            lowConfidenceReasons: ['assistant-citations-missing'],
            citations: [{
              sourceType: 'content',
              displayTitle: '高置信来源但整体核验有限',
              href: '/course-runtime/resources/textbooks/control/ch02.md#time-constant',
              confidence: 'high',
              evidenceBasis: 'source-pack',
            }],
          },
        },
      }),
    );

    expect(html).toContain('data-konling-citation-status="low-confidence"');
    expect(html).toContain('引用核验有限');
    expect(html).not.toContain('已验证引用');
    expect(html).toContain('data-citation-limited="guard-low-confidence"');
    expect(html).not.toContain('data-citation-target=');
  });

  it('downgrades streaming preflight citation metadata before final verification', () => {
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

    expect(html).toContain('data-konling-citation-status="low-confidence"');
    expect(html).toContain('引用核验有限');
    expect(html).not.toContain('已验证引用');
    expect(html).toContain('data-citation-limited="guard-low-confidence"');
    expect(html).not.toContain('data-citation-target=');
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
