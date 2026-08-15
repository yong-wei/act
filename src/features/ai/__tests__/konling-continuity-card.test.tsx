import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { KonlingContinuityCard } from '@/components/ai/konling-continuity-card';

describe('KonlingContinuityCard', () => {
  it('renders only governed structured cause content', () => {
    const html = renderToStaticMarkup(<KonlingContinuityCard
      snapshot={{
        snapshotId: 'continuity:1',
        state: 'recent_mistake',
        evidenceAsOf: '2026-08-01T09:00:00.000Z',
        recentMistake: {
          answerId: 'answer-1',
          knowledgeId: 'root-locus',
          knowledgeLabel: '根轨迹',
          structuredCauseId: null,
          structuredCauseLabel: null,
        },
      }}
      onDismiss={vi.fn()}
      onReExplain={vi.fn()}
      onGoalEntry={vi.fn()}
    />);
    expect(html).toContain('没有可引用的结构化错因');
    expect(html).toContain('data-konling-continuity-card="recent_mistake"');
    expect(html).toContain('flex flex-wrap gap-2');
  });

  it('keeps temporary skip as a local button action', () => {
    const html = renderToStaticMarkup(<KonlingContinuityCard
      snapshot={{
        snapshotId: 'continuity:2',
        state: 'unfinished_task',
        evidenceAsOf: '2026-08-01T09:00:00.000Z',
        unfinishedTask: { pathId: 'path-1', nodeId: 'node-1', title: '继续任务', href: '/assessment/adaptive-practice?pathId=path-1' },
      }}
      onDismiss={vi.fn()}
      onReExplain={vi.fn()}
      onGoalEntry={vi.fn()}
    />);
    expect(html).toContain('暂时跳过');
    expect(html).not.toContain('/api/learning-paths');
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain('<a href="/assessment/adaptive-practice?pathId=path-1"');
  });
});
